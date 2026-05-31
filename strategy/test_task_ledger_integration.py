from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from strategy.models import Topic, WorkflowRun, DailyPlan, TaskLedgerEntry
from strategy.services import create_strategy_topic, create_daily_plan, approve_daily_plan
from strategy.workflows import run_strategy_graph

User = get_user_model()

class TaskLedgerIntegrationTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="password")
        self.client.force_authenticate(user=self.user)
        self.topic = create_strategy_topic(self.user, title="Topic")
        
        # Ensure consistent ordering: low, then medium
        TaskLedgerEntry.objects.filter(risk_level="high").delete()
        
        self.workflow_run, self.plan = create_daily_plan(self.topic, self.user)
        approve_daily_plan(self.plan, self.user)

    def test_low_risk_task_lifecycle_and_telemetry(self):
        low_task = self.topic.tasks.filter(risk_level="low").first()
        self.assertEqual(low_task.status, "proposed")
        
        run_strategy_graph(self.workflow_run)
        
        low_task.refresh_from_db()
        
        # 1. Starting workflow changes low-risk task status to completed
        self.assertEqual(low_task.status, "completed")
        
        # 2. Completed low-risk task gets agent output
        self.assertIn("agent_output", low_task.outputs)
        
        # 5. Task execution_lineage includes workflow_run_id
        self.assertIn("workflow_run_id", low_task.execution_lineage)
        self.assertEqual(low_task.execution_lineage["workflow_run_id"], str(self.workflow_run.id))
        
        # 6. Task telemetry includes: agent_runs list
        self.assertIn("agent_runs", low_task.telemetry)
        self.assertGreater(len(low_task.telemetry["agent_runs"]), 0)
        
        # 8. Task evaluation includes agent_evaluation
        self.assertIn("agent_evaluation", low_task.evaluation)

    def test_medium_risk_unapproved_task_remains_proposed_and_workflow_pauses(self):
        med_task = self.topic.tasks.filter(risk_level="medium").first()
        
        run_strategy_graph(self.workflow_run)
        
        med_task.refresh_from_db()
        self.workflow_run.refresh_from_db()
        
        # 3. Medium-risk unapproved task remains pending_approval and workflow pauses
        self.assertEqual(med_task.status, "pending_approval")
        self.assertEqual(self.workflow_run.status, "paused")

    def test_approving_medium_risk_task_allows_execution(self):
        med_task = self.topic.tasks.filter(risk_level="medium").first()
        
        # Run graph once so it pauses at medium task
        run_strategy_graph(self.workflow_run)
        
        # Approve task
        med_task.status = "approved"
        med_task.approved_at = "2026-05-24T00:00:00Z"
        med_task.save()
        
        # Resume graph
        run_strategy_graph(self.workflow_run)
        
        med_task.refresh_from_db()
        
        # 4. Approving medium-risk task allows execution to complete
        self.assertEqual(med_task.status, "completed")

    def test_workflow_next_actions_and_command_centre(self):
        med_task = self.topic.tasks.filter(risk_level="medium").first()
        run_strategy_graph(self.workflow_run)
        self.workflow_run.refresh_from_db()
        
        # 9. Workflow next_actions include remaining paused tasks
        self.assertIn(str(med_task.id), self.workflow_run.state.get("next_actions", []))
        
        # 10. Command centre reflects updated counts
        url = f"/api/topics/{self.topic.id}/command-centre/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreater(response.data["completed_tasks_count"], 0)
