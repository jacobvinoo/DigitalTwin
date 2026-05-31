import pytest
from unittest.mock import patch, MagicMock
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from strategy.models import Topic, TaskLedgerEntry, WorkflowRun
from strategy.workflows import executive_reviewer_node

User = get_user_model()

class RevisionRequiredTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="password")
        self.client.force_authenticate(user=self.user)
        self.topic = Topic.objects.create(title="Topic", owner=self.user)
        self.workflow_run = WorkflowRun.objects.create(topic=self.topic, run_type="daily_plan", created_by=self.user)
        self.task = TaskLedgerEntry.objects.create(
            topic=self.topic,
            title="Task",
            task_type="implementation_plan",
            status="in_progress",
            outputs={"agent_output": {"some": "data"}},
            governance={}
        )
        self.state = {
            "workflow_run_id": str(self.workflow_run.id),
            "current_task_id": str(self.task.id),
            "visited_nodes": [],
            "status": "running"
        }

    @patch('strategy.workflows.get_llm_client')
    def test_reviewer_revise_sets_correct_states(self, MockClient):
        mock_result = MagicMock()
        mock_result.data.recommendation = "revise"
        mock_result.data.model_dump.return_value = {"recommendation": "revise", "required_revisions": ["fix this"]}
        mock_result.telemetry = {"model": "gpt-4o"}
        mock_result.audit = {}
        MockClient().execute.return_value = mock_result
        
        result_state = executive_reviewer_node(self.state)
        
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, "blocked")
        self.assertIn("fix this", self.task.outputs["executive_review"]["required_revisions"])
        self.assertTrue(self.task.governance.get("revision_required"))
        
        # Test workflow pauses and next actions include required revisions
        self.assertEqual(result_state.get("next_step"), "complete_workflow")

    def test_user_can_mark_revision_accepted(self):
        self.task.status = "blocked"
        self.task.governance = {"revision_required": True}
        self.task.save()
        
        url = reverse("task-accept-revision", args=[self.task.id])
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, 200)
        self.task.refresh_from_db()
        self.assertFalse(self.task.governance.get("revision_required"))

    def test_user_can_request_rerun(self):
        self.task.status = "blocked"
        self.task.outputs = {"agent_output": {"data": "old"}}
        self.task.save()
        
        url = reverse("task-rerun-agent", args=[self.task.id])
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, 200)
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, "in_progress")
        
        # Verify previous output is preserved
        self.assertEqual(len(self.task.outputs.get("output_versions", [])), 1)
        self.assertEqual(self.task.outputs["output_versions"][0]["data"], "old")
