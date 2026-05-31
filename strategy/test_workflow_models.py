from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.exceptions import ValidationError
from strategy.models import Topic
# The following models do not exist yet. We import them dynamically in tests to show 8 separate failures.
User = get_user_model()

class WorkflowModelsTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="password")
        self.topic = Topic.objects.create(title="Test Topic", owner=self.user)

    def test_workflow_run_can_be_created_for_a_topic(self):
        from strategy.models import WorkflowRun
        run = WorkflowRun.objects.create(
            topic=self.topic,
            run_type="daily_plan",
            status="draft",
            created_by=self.user
        )
        self.assertEqual(run.topic, self.topic)
        self.assertEqual(run.run_type, "daily_plan")

    def test_workflow_run_stores_current_node_and_state(self):
        from strategy.models import WorkflowRun
        state_data = {"key": "value"}
        run = WorkflowRun.objects.create(
            topic=self.topic,
            run_type="task_execution",
            current_node="generate_plan",
            state=state_data,
            created_by=self.user
        )
        self.assertEqual(run.current_node, "generate_plan")
        self.assertEqual(run.state, state_data)

    def test_workflow_step_records_deterministic_node_transitions(self):
        from strategy.models import WorkflowRun, WorkflowStep
        run = WorkflowRun.objects.create(topic=self.topic, run_type="daily_plan", created_by=self.user)
        step = WorkflowStep.objects.create(
            workflow_run=run,
            node_name="planner_node",
            step_type="planner",
            status="completed",
            input_state={"in": 1},
            output_state={"out": 2},
            sort_order=1
        )
        self.assertEqual(step.workflow_run, run)
        self.assertEqual(step.node_name, "planner_node")
        self.assertEqual(step.status, "completed")
        self.assertEqual(step.output_state, {"out": 2})

    def test_daily_plan_is_linked_to_workflow_run(self):
        from strategy.models import WorkflowRun, DailyPlan
        run = WorkflowRun.objects.create(topic=self.topic, run_type="daily_plan", created_by=self.user)
        plan = DailyPlan.objects.create(
            topic=self.topic,
            workflow_run=run,
            plan_date=timezone.now().date(),
            status="proposed"
        )
        self.assertEqual(plan.workflow_run, run)

    def test_daily_plan_cannot_become_approved_without_approved_by_and_approved_at(self):
        from strategy.models import WorkflowRun, DailyPlan
        run = WorkflowRun.objects.create(topic=self.topic, run_type="daily_plan", created_by=self.user)
        plan = DailyPlan.objects.create(
            topic=self.topic,
            workflow_run=run,
            plan_date=timezone.now().date(),
            status="proposed"
        )
        plan.status = "approved"
        with self.assertRaises(ValidationError):
            plan.clean()

    def test_workflow_run_status_can_move_to_approved_only_through_approval_service(self):
        from strategy.models import WorkflowRun
        run = WorkflowRun.objects.create(
            topic=self.topic,
            run_type="daily_plan",
            status="awaiting_plan_approval",
            created_by=self.user
        )
        run.status = "approved"
        with self.assertRaises(ValidationError):
            run.clean()

    def test_completed_workflow_run_stores_completed_at(self):
        from strategy.models import WorkflowRun
        run = WorkflowRun.objects.create(
            topic=self.topic,
            run_type="daily_plan",
            status="running",
            created_by=self.user
        )
        run.status = "completed"
        run.completed_at = timezone.now()
        run.save()
        self.assertIsNotNone(run.completed_at)

    def test_failed_workflow_step_stores_error_message(self):
        from strategy.models import WorkflowRun, WorkflowStep
        run = WorkflowRun.objects.create(topic=self.topic, run_type="daily_plan", created_by=self.user)
        step = WorkflowStep.objects.create(
            workflow_run=run,
            node_name="failing_node",
            step_type="worker",
            status="failed",
            error_message="Something went wrong",
            sort_order=2
        )
        self.assertEqual(step.error_message, "Something went wrong")
