import pytest
from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from strategy.models import Topic, TaskLedgerEntry, WorkflowRun
from strategy.agents.client import AgentOutputValidationError

try:
    from strategy.workflows import (
        product_manager_node,
        strategy_manager_node,
        executive_reviewer_node,
        evaluation_node,
        agent_router_node
    )
except ImportError:
    pass # Will fail in tests naturally

User = get_user_model()

class SpecialistNodesTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="password")
        self.topic = Topic.objects.create(title="Topic", owner=self.user)
        self.workflow_run = WorkflowRun.objects.create(topic=self.topic, run_type="daily_plan", created_by=self.user)
        self.task = TaskLedgerEntry.objects.create(
            topic=self.topic,
            title="Task",
            task_type="implementation_plan",
            status="in_progress"
        )
        self.state = {
            "workflow_run_id": str(self.workflow_run.id),
            "current_task_id": str(self.task.id),
            "visited_nodes": [],
            "status": "running"
        }

    def test_product_manager_routing(self):
        for ttype in ["metrics_definition", "implementation_plan", "roadmap", "execution_tracking"]:
            self.task.task_type = ttype
            self.task.save()
            next_node = agent_router_node(self.state)
            self.assertEqual(next_node["next_step"], "product_manager_node")

    def test_strategy_manager_routing(self):
        for ttype in ["competitive_research", "risk_analysis", "product_strategy"]:
            self.task.task_type = ttype
            self.task.save()
            next_node = agent_router_node(self.state)
            self.assertEqual(next_node["next_step"], "strategy_manager_node")

    @patch('strategy.workflows.get_llm_client')
    def test_product_manager_node_updates_outputs_and_lineage(self, MockClient):
        mock_result = MagicMock()
        mock_result.data.model_dump.return_value = {"product_recommendation": "Use Algolia"}
        mock_result.telemetry = {"model": "gpt-4o", "prompt_version": "v1.0.0", "total_tokens": 50, "api_cost_usd": 0.001, "execution_time_ms": 100}
        mock_result.audit = {"raw_prompt": "x", "raw_response": "y"}
        MockClient().execute.return_value = mock_result
        
        result_state = product_manager_node(self.state)
        
        self.task.refresh_from_db()
        self.assertEqual(self.task.outputs["agent_output"]["product_recommendation"], "Use Algolia")
        self.assertEqual(self.task.execution_lineage["node_name"], "product_manager_node")
        self.assertEqual(self.task.execution_lineage["model"], "gpt-4o")
        self.assertEqual(self.task.telemetry["agent_runs"][-1]["total_tokens"], 50)
        
        # Agents do not choose next step
        self.assertNotIn("next_step", result_state)

    @patch('strategy.workflows.get_llm_client')
    def test_executive_reviewer_revise_blocks_completion(self, MockClient):
        mock_result = MagicMock()
        mock_result.data.recommendation = "revise"
        mock_result.data.model_dump.return_value = {"recommendation": "revise", "weakest_points": ["too generic"]}
        mock_result.telemetry = {"model": "gpt-4o"}
        mock_result.audit = {}
        MockClient().execute.return_value = mock_result
        
        result_state = executive_reviewer_node(self.state)
        self.assertNotEqual(result_state.get("status"), "failed", result_state.get("error_message"))
        self.task.refresh_from_db()
        
        self.assertEqual(self.task.status, "blocked")
        self.assertTrue(self.task.governance.get("revision_required"))

    @patch('strategy.workflows.get_llm_client')
    def test_executive_reviewer_approve_allows_evaluation(self, MockClient):
        mock_result = MagicMock()
        mock_result.data.recommendation = "approve"
        mock_result.data.model_dump.return_value = {"recommendation": "approve"}
        mock_result.telemetry = {"model": "gpt-4o"}
        mock_result.audit = {}
        MockClient().execute.return_value = mock_result
        
        executive_reviewer_node(self.state)
        self.task.refresh_from_db()
        
        self.assertNotEqual(self.task.status, "revision_required")

    @patch('strategy.workflows.get_llm_client')
    def test_evaluation_node_updates_evaluation(self, MockClient):
        mock_result = MagicMock()
        mock_result.data.model_dump.return_value = {"overall_score": 8.5}
        mock_result.data.overall_score = 8.5
        mock_result.telemetry = {"model": "gpt-4o"}
        mock_result.audit = {}
        MockClient().execute.return_value = mock_result
        
        result_state = evaluation_node(self.state)
        self.assertNotEqual(result_state.get("status"), "failed", result_state.get("error_message"))
        
        self.task.refresh_from_db()
        self.assertEqual(self.task.evaluation["overall_score"], 8.5)

    @patch('strategy.workflows.get_llm_client')
    def test_schema_validation_failure_marks_run_failed(self, MockClient):
        MockClient().execute.side_effect = AgentOutputValidationError("bad json")
        
        result_state = product_manager_node(self.state)
        
        self.workflow_run.refresh_from_db()
        self.assertEqual(self.workflow_run.status, "failed")
        self.assertEqual(result_state["status"], "failed")
