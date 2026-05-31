from django.test import TestCase
from django.contrib.auth import get_user_model
from strategy.models import Topic, WorkflowStep
from strategy.services import create_strategy_topic, create_daily_plan
from django.core.exceptions import PermissionDenied, ValidationError

User = get_user_model()

class PlanApprovalTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="password")
        self.other_user = User.objects.create_user(username="other", password="password")
        self.topic = create_strategy_topic(self.user, title="Topic")
        self.workflow_run, self.plan = create_daily_plan(self.topic, self.user)

    def test_approve_sets_daily_plan_status_approved(self):
        from strategy.services import approve_daily_plan
        approve_daily_plan(self.plan, self.user)
        self.plan.refresh_from_db()
        self.assertEqual(self.plan.status, "approved")

    def test_approve_sets_approved_by_and_at(self):
        from strategy.services import approve_daily_plan
        approve_daily_plan(self.plan, self.user)
        self.plan.refresh_from_db()
        self.assertEqual(self.plan.approved_by, self.user)
        self.assertIsNotNone(self.plan.approved_at)

    def test_approve_sets_workflow_run_status_approved(self):
        from strategy.services import approve_daily_plan
        approve_daily_plan(self.plan, self.user)
        self.workflow_run.refresh_from_db()
        self.assertEqual(self.workflow_run.status, "approved")

    def test_approve_records_workflow_step(self):
        from strategy.services import approve_daily_plan
        approve_daily_plan(self.plan, self.user)
        step = WorkflowStep.objects.get(workflow_run=self.workflow_run, node_name="plan_approval_gate")
        self.assertEqual(step.step_type, "approval_gate")
        self.assertEqual(step.status, "completed")

    def test_reject_sets_daily_plan_status_rejected(self):
        from strategy.services import reject_daily_plan
        reject_daily_plan(self.plan, self.user, reason="Not good enough")
        self.plan.refresh_from_db()
        self.assertEqual(self.plan.status, "rejected")

    def test_reject_sets_workflow_run_status_cancelled(self):
        from strategy.services import reject_daily_plan
        reject_daily_plan(self.plan, self.user, reason="Not good enough")
        self.workflow_run.refresh_from_db()
        self.assertEqual(self.workflow_run.status, "cancelled")

    def test_reject_requires_reason(self):
        from strategy.services import reject_daily_plan
        with self.assertRaises(ValueError):
            reject_daily_plan(self.plan, self.user, reason="")
        with self.assertRaises(ValueError):
            reject_daily_plan(self.plan, self.user, reason=None)

    def test_cannot_approve_another_users_plan(self):
        from strategy.services import approve_daily_plan
        with self.assertRaises(PermissionDenied):
            approve_daily_plan(self.plan, self.other_user)

    def test_approved_plan_cannot_be_approved_twice(self):
        from strategy.services import approve_daily_plan
        approve_daily_plan(self.plan, self.user)
        with self.assertRaises(ValueError):
            approve_daily_plan(self.plan, self.user)

    def test_rejected_plan_cannot_be_executed(self):
        from strategy.services import reject_daily_plan, approve_daily_plan
        try:
            reject_daily_plan(self.plan, self.user, reason="No")
        except ImportError:
            pass # Handle the import error manually so we reach the next line for the failure output
        
        # Test that we cannot approve it
        with self.assertRaises(ValueError):
            from strategy.services import approve_daily_plan
            approve_daily_plan(self.plan, self.user)
