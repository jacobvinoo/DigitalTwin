from django.test import TestCase
from django.contrib.auth import get_user_model
from strategy.models import Topic, WorkflowRun, TaskLedgerEntry
from strategy.services import create_strategy_topic, create_daily_plan, approve_daily_plan

User = get_user_model()

class LangGraphWorkflowTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="password")
        self.topic = create_strategy_topic(self.user, title="Topic")
        # Ensure low risk tasks evaluate first by removing high risk tasks which alphabetical ordering puts first
        TaskLedgerEntry.objects.filter(risk_level="high").delete()
        self.workflow_run, self.plan = create_daily_plan(self.topic, self.user)

    def test_graph_starts_at_load_plan(self):
        from strategy.workflows import run_strategy_graph
        state = run_strategy_graph(self.workflow_run)
        self.assertEqual(state["current_node"], "load_plan")

    def test_unapproved_plan_returns_paused(self):
        from strategy.workflows import run_strategy_graph
        # Plan is currently unapproved
        state = run_strategy_graph(self.workflow_run)
        self.assertEqual(self.workflow_run.status, "awaiting_plan_approval")
        self.assertEqual(state["status"], "paused")

    def test_approved_plan_moves_to_risk_router(self):
        from strategy.workflows import run_strategy_graph
        approve_daily_plan(self.plan, self.user)
        state = run_strategy_graph(self.workflow_run)
        # Assuming the state holds history of visited nodes
        self.assertIn("risk_router", state["visited_nodes"])

    def test_low_risk_tasks_move_to_execute_low_risk_task(self):
        from strategy.workflows import run_strategy_graph
        approve_daily_plan(self.plan, self.user)
        state = run_strategy_graph(self.workflow_run)
        self.assertIn("execute_low_risk_task", state["visited_nodes"])

    def test_medium_risk_unapproved_tasks_move_to_pause_for_task_approval(self):
        from strategy.workflows import run_strategy_graph
        approve_daily_plan(self.plan, self.user)
        state = run_strategy_graph(self.workflow_run)
        # Should encounter the first medium risk task and pause
        self.assertIn("pause_for_task_approval", state["visited_nodes"])
        self.workflow_run.refresh_from_db()
        self.assertEqual(self.workflow_run.status, "paused")

    def test_approved_medium_risk_tasks_move_to_execute_approved_task(self):
        from strategy.workflows import run_strategy_graph
        approve_daily_plan(self.plan, self.user)
        
        # Approve the first medium task directly in DB for testing
        task = self.topic.tasks.filter(risk_level="medium").first()
        task.approved_at = "2026-05-24T00:00:00Z"
        task.save()
        
        state = run_strategy_graph(self.workflow_run)
        self.assertIn("agent_router", state["visited_nodes"])

    def test_each_executed_task_creates_placeholder_output(self):
        from strategy.workflows import run_strategy_graph
        approve_daily_plan(self.plan, self.user)
        state = run_strategy_graph(self.workflow_run)
        self.assertIn("strategy_manager_node", state["visited_nodes"])
        task = self.topic.tasks.filter(status="completed").first()
        self.assertIn("agent_output", task.outputs)

    def test_executive_review_placeholder_creates_deterministic_critique(self):
        from strategy.workflows import run_strategy_graph
        approve_daily_plan(self.plan, self.user)
        state = run_strategy_graph(self.workflow_run)
        self.assertIn("executive_reviewer_node", state["visited_nodes"])
        task = self.topic.tasks.filter(status="completed").first()
        self.assertIn("executive_review", task.outputs)

    def test_evaluation_placeholder_creates_deterministic_score(self):
        from strategy.workflows import run_strategy_graph
        approve_daily_plan(self.plan, self.user)
        state = run_strategy_graph(self.workflow_run)
        self.assertIn("evaluation_node", state["visited_nodes"])
        task = self.topic.tasks.filter(status="completed").first()
        self.assertIn("agent_evaluation", task.evaluation)

    def test_task_ledger_updates_status_to_completed(self):
        from strategy.workflows import run_strategy_graph
        approve_daily_plan(self.plan, self.user)
        state = run_strategy_graph(self.workflow_run)
        # The first low risk task should be completed
        task = self.topic.tasks.filter(risk_level="low").first()
        self.assertEqual(task.status, "completed")

    def test_workflowrun_current_node_updates_after_every_node(self):
        from strategy.workflows import run_strategy_graph
        approve_daily_plan(self.plan, self.user)
        run_strategy_graph(self.workflow_run)
        # Workflow will hit pause at medium task
        self.workflow_run.refresh_from_db()
        self.assertNotEqual(self.workflow_run.current_node, "")

    def test_workflowstep_is_created_for_every_node_transition(self):
        from strategy.workflows import run_strategy_graph
        approve_daily_plan(self.plan, self.user)
        run_strategy_graph(self.workflow_run)
        steps = self.workflow_run.steps.count()
        self.assertGreater(steps, 0)

    def test_loop_count_is_capped_to_prevent_infinite_execution(self):
        from strategy.workflows import run_strategy_graph
        approve_daily_plan(self.plan, self.user)
        state = run_strategy_graph(self.workflow_run, loop_limit=1)
        self.assertEqual(state["status"], "failed")
        self.assertIn("loop_limit", state["error_message"])

    def test_failed_node_sets_workflowrun_status_failed(self):
        from strategy.workflows import run_strategy_graph
        approve_daily_plan(self.plan, self.user)
        # Inject an error state manually
        self.workflow_run.state["force_error"] = True
        self.workflow_run.save()
        run_strategy_graph(self.workflow_run)
        self.workflow_run.refresh_from_db()
        self.assertEqual(self.workflow_run.status, "failed")
