from django.test import TestCase
from django.contrib.auth import get_user_model
from strategy.models import Topic, TaskLedgerEntry, WorkflowRun, DailyPlan
from strategy.services import create_strategy_topic
import datetime

User = get_user_model()

class DailyPlanServiceTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="testpass")
        self.topic = create_strategy_topic(self.user, title="Search for Supermarket")
        # By default all 8 tasks are created as "proposed" or "in_progress" depending on the service.
        # Let's ensure they are all "proposed" or "approved" for testing, except one "completed" to test filtering.
        tasks = TaskLedgerEntry.objects.filter(topic=self.topic)
        tasks.update(status="proposed")
        # Set one to completed to test rule 3
        t = tasks.first()
        t.status = "completed"
        t.save()
        self.completed_task_id = t.id

    def test_creates_workflow_run_awaiting_approval(self):
        from strategy.services import create_daily_plan
        run, plan = create_daily_plan(self.topic, self.user)
        self.assertEqual(run.status, "awaiting_plan_approval")
        self.assertEqual(run.run_type, "daily_plan")

    def test_creates_daily_plan_proposed(self):
        from strategy.services import create_daily_plan
        run, plan = create_daily_plan(self.topic, self.user)
        self.assertEqual(plan.status, "proposed")
        self.assertEqual(plan.workflow_run, run)

    def test_plan_includes_only_proposed_or_approved_tasks(self):
        from strategy.services import create_daily_plan
        run, plan = create_daily_plan(self.topic, self.user)
        # The completed task should not be in the plan_items
        task_ids = [item.get("task_id") for item in plan.plan_items]
        self.assertNotIn(self.completed_task_id, task_ids)

    def test_plan_groups_tasks_by_risk_level(self):
        from strategy.services import create_daily_plan
        run, plan = create_daily_plan(self.topic, self.user)
        for item in plan.plan_items:
            self.assertIn("risk_level", item)
            self.assertIn(item["risk_level"], ["low", "medium", "high"])

    def test_low_risk_tasks_marked_auto_executable(self):
        from strategy.services import create_daily_plan
        run, plan = create_daily_plan(self.topic, self.user)
        low_risk_items = [item for item in plan.plan_items if item.get("risk_level") == "low"]
        self.assertTrue(len(low_risk_items) > 0)
        for item in low_risk_items:
            self.assertEqual(item.get("execution_mode"), "auto-executable")

    def test_medium_risk_tasks_marked_approval_needed(self):
        from strategy.services import create_daily_plan
        run, plan = create_daily_plan(self.topic, self.user)
        medium_risk_items = [item for item in plan.plan_items if item.get("risk_level") == "medium"]
        self.assertTrue(len(medium_risk_items) > 0)
        for item in medium_risk_items:
            self.assertEqual(item.get("execution_mode"), "approval-needed")

    def test_high_risk_tasks_marked_hard_stop(self):
        from strategy.services import create_daily_plan
        run, plan = create_daily_plan(self.topic, self.user)
        high_risk_items = [item for item in plan.plan_items if item.get("risk_level") == "high"]
        self.assertTrue(len(high_risk_items) > 0)
        for item in high_risk_items:
            self.assertEqual(item.get("execution_mode"), "hard-stop")

    def test_plan_summary_under_120_words(self):
        from strategy.services import create_daily_plan
        run, plan = create_daily_plan(self.topic, self.user)
        words = plan.summary.split()
        self.assertTrue(len(words) <= 120)
        self.assertTrue(len(words) > 0)

    def test_plan_includes_diff_from_previous(self):
        from strategy.services import create_daily_plan
        run, plan = create_daily_plan(self.topic, self.user)
        self.assertIsNotNone(plan.diff_from_previous)
        self.assertIsInstance(plan.diff_from_previous, dict)

    def test_first_plan_diff_says_first_plan_true(self):
        from strategy.services import create_daily_plan
        run, plan = create_daily_plan(self.topic, self.user)
        self.assertEqual(plan.diff_from_previous.get("first_plan"), True)

    def test_diff_shows_added_removed_unchanged_task_ids_if_previous_exists(self):
        from strategy.services import create_daily_plan
        # Create an initial run directly for testing diff
        run1 = WorkflowRun.objects.create(topic=self.topic, run_type="daily_plan", created_by=self.user)
        plan1 = DailyPlan.objects.create(
            topic=self.topic, 
            workflow_run=run1, 
            plan_date=datetime.date.today(),
            plan_items=[{"task_id": self.completed_task_id, "risk_level": "low"}]
        )
        
        run2, plan2 = create_daily_plan(self.topic, self.user)
        self.assertFalse(plan2.diff_from_previous.get("first_plan"))
        self.assertIn("added", plan2.diff_from_previous)
        self.assertIn("removed", plan2.diff_from_previous)
        self.assertIn("unchanged", plan2.diff_from_previous)
        # completed_task_id is now filtered out of new plan, so it should be in removed.
        self.assertIn(str(self.completed_task_id), plan2.diff_from_previous["removed"])

    def test_daily_plan_risk_summary_counts_low_medium_high_tasks(self):
        from strategy.services import create_daily_plan
        run, plan = create_daily_plan(self.topic, self.user)
        self.assertIn("low", plan.risk_summary)
        self.assertIn("medium", plan.risk_summary)
        self.assertIn("high", plan.risk_summary)
        
        # Verify counts match the plan_items
        low_count = sum(1 for item in plan.plan_items if item.get("risk_level") == "low")
        self.assertEqual(plan.risk_summary["low"], low_count)
