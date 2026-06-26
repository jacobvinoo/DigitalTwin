from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from strategy.models import Topic, WorkflowRun, DailyPlan, TaskLedgerEntry
from strategy.services import create_strategy_topic, create_daily_plan, approve_daily_plan

User = get_user_model()

class WorkflowAPITestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="password")
        self.other_user = User.objects.create_user(username="other", password="password")
        self.client.force_authenticate(user=self.user)
        
        self.topic = create_strategy_topic(self.user, title="Topic")
        
    def test_create_daily_plan_api(self):
        url = f"/api/topics/{self.topic.id}/daily-plan/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("plan_items", response.data)

    def test_approve_daily_plan_api(self):
        workflow_run, plan = create_daily_plan(self.topic, self.user)
        url = f"/api/daily-plans/{plan.id}/approve/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        plan.refresh_from_db()
        self.assertEqual(plan.status, "approved")

        # Double approval should return HTTP 400
        response2 = self.client.post(url)
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response2.data)

    def test_reject_daily_plan_api(self):
        workflow_run, plan = create_daily_plan(self.topic, self.user)
        url = f"/api/daily-plans/{plan.id}/reject/"
        response = self.client.post(url, {"reason": "Not good enough"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        plan.refresh_from_db()
        self.assertEqual(plan.status, "rejected")

        # Double rejection should return HTTP 400
        response2 = self.client.post(url, {"reason": "Already rejected"})
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response2.data)

    def test_cannot_start_unapproved_plan(self):
        workflow_run, plan = create_daily_plan(self.topic, self.user)
        url = f"/api/workflows/{workflow_run.id}/start/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_starting_approved_plan_updates_status(self):
        workflow_run, plan = create_daily_plan(self.topic, self.user)
        approve_daily_plan(plan, self.user)
        url = f"/api/workflows/{workflow_run.id}/start/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        workflow_run.refresh_from_db()
        self.assertIn(workflow_run.status, ["running", "paused", "completed"])

    def test_completed_workflow_updates_status_completed(self):
        TaskLedgerEntry.objects.filter(risk_level__in=["high", "medium"]).delete()
        workflow_run, plan = create_daily_plan(self.topic, self.user)
        approve_daily_plan(plan, self.user)
        
        url = f"/api/workflows/{workflow_run.id}/start/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        workflow_run.refresh_from_db()
        self.assertEqual(workflow_run.status, "completed")

    def test_paused_workflow_returns_reason(self):
        workflow_run, plan = create_daily_plan(self.topic, self.user)
        approve_daily_plan(plan, self.user)
        
        self.client.post(f"/api/workflows/{workflow_run.id}/start/")
        
        url = f"/api/workflows/{workflow_run.id}/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        expected_keys = {
            "status", "current_node", "pending_approvals", "completed_steps", 
            "failed_steps", "next_actions", "telemetry_summary", "paused_tasks", 
            "current_task_id", "tasks"
        }
        self.assertEqual(set(response.data.keys()), expected_keys)
        
        self.assertEqual(response.data["status"], "paused")
        self.assertIn("placeholder", response.data["paused_tasks"])

    def test_resume_requires_required_task_approvals(self):
        workflow_run, plan = create_daily_plan(self.topic, self.user)
        approve_daily_plan(plan, self.user)
        self.client.post(f"/api/workflows/{workflow_run.id}/start/")
        
        url = f"/api/workflows/{workflow_run.id}/resume/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_user_cannot_access_another_users_workflows(self):
        workflow_run, plan = create_daily_plan(self.topic, self.user)
        self.client.force_authenticate(user=self.other_user)
        url = f"/api/workflows/{workflow_run.id}/"
        response = self.client.get(url)
        self.assertIn(response.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

    def test_topic_workflow_timeline_api(self):
        workflow_run, plan = create_daily_plan(self.topic, self.user)
        url = f"/api/topics/{self.topic.id}/workflow-timeline/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        if len(response.data) > 0:
            expected_keys = {"id", "status", "created_at", "steps_count"}
            self.assertEqual(set(response.data[0].keys()), expected_keys)
