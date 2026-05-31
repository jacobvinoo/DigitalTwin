import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from strategy.models import Topic, TaskLedgerEntry, WorkflowRun
from strategy.workflows import agent_router_node, route_after_reviewer

User = get_user_model()

class GraphRoutingTestCase(APITestCase):
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
            result = agent_router_node(self.state)
            self.assertEqual(result["next_step"], "product_manager_node")

    def test_strategy_manager_routing(self):
        for ttype in ["competitive_research", "risk_analysis", "product_strategy"]:
            self.task.task_type = ttype
            self.task.save()
            result = agent_router_node(self.state)
            self.assertEqual(result["next_step"], "strategy_manager_node")

    def test_unknown_task_type_fails(self):
        self.task.task_type = "unknown_type"
        self.task.save()
        result = agent_router_node(self.state)
        self.assertEqual(result["status"], "failed")
        self.assertIn("Unknown task_type", result["error_message"])

    def test_reviewer_routes_to_evaluation_on_approve(self):
        self.state["next_step"] = "evaluation_node"
        self.assertEqual(route_after_reviewer(self.state), "evaluation_node")

    def test_reviewer_routes_to_revision_required_on_revise(self):
        self.state["next_step"] = "revision_required"
        self.assertEqual(route_after_reviewer(self.state), "revision_required")
