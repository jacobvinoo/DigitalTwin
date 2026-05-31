import pytest
from django.test import override_settings
from strategy.models import Topic, TaskLedgerEntry, ActionRequest, WorkflowRun, DailyPlan
from django.contrib.auth import get_user_model
from django.utils import timezone
from strategy.workflows import run_strategy_graph

User = get_user_model()

@pytest.fixture
def test_user(db):
    return User.objects.create_user(username="testuser")

@pytest.mark.django_db
def test_workflow_recommends_action(test_user):
    # Agent output can recommend an ActionRequest
    topic = Topic.objects.create(title="Test", owner=test_user)
    task = TaskLedgerEntry.objects.create(topic=topic, title="Email team", status="in_progress", task_type="email_draft")
    
    # Run workflow (simulate agent proposing an action)
    workflow = WorkflowRun.objects.create(
        topic=topic, 
        created_by=test_user, 
        run_type="task_execution",
        state={"current_task_id": task.id}
    )
    DailyPlan.objects.create(topic=topic, workflow_run=workflow, status="approved", plan_date=timezone.now().date(), plan_items=[{"task_id": task.id}])
    state = run_strategy_graph(workflow)
    
    # Assert ActionRequest links to TaskLedgerEntry
    action = ActionRequest.objects.filter(task=task).first()
    assert action is not None
    assert action.action_type == "email_draft"
    assert action.topic == topic

@pytest.mark.django_db
def test_workflow_pauses_for_high_risk_action(test_user):
    topic = Topic.objects.create(title="Test", owner=test_user)
    task = TaskLedgerEntry.objects.create(topic=topic, title="Send External Email", status="in_progress", task_type="email_draft")
    
    # Workflow creates a high risk action and pauses
    workflow = WorkflowRun.objects.create(
        topic=topic, 
        created_by=test_user, 
        run_type="task_execution",
        state={"current_task_id": task.id}
    )
    DailyPlan.objects.create(topic=topic, workflow_run=workflow, status="approved", plan_date=timezone.now().date(), plan_items=[{"task_id": task.id}])
    state = run_strategy_graph(workflow)
    
    action = ActionRequest.objects.get(task=task)
    assert action.risk_level == "high"
    assert action.status == "awaiting_approval"
    
    # Workflow task should be paused/pending_approval
    task.refresh_from_db()
    assert task.status == "pending_approval"

@pytest.mark.django_db
def test_workflow_resumes_on_approval(test_user):
    topic = Topic.objects.create(title="Test", owner=test_user)
    task = TaskLedgerEntry.objects.create(topic=topic, title="Send External Email", status="pending_approval", task_type="email_draft")
    action = ActionRequest.objects.create(
        topic=topic, task=task, action_type="email_draft", risk_level="high", status="approved"
    )
    
    # Simulating resume after approval
    workflow = WorkflowRun.objects.create(
        topic=topic, 
        created_by=test_user, 
        run_type="task_execution",
        state={"current_task_id": task.id}
    )
    DailyPlan.objects.create(topic=topic, workflow_run=workflow, status="approved", plan_date=timezone.now().date(), plan_items=[{"task_id": task.id}])
    state = run_strategy_graph(workflow)
    
    task.refresh_from_db()
    assert task.status == "completed"

@pytest.mark.django_db
def test_executed_action_updates_task(test_user):
    topic = Topic.objects.create(title="Test", owner=test_user)
    task = TaskLedgerEntry.objects.create(topic=topic, title="Send External Email", status="in_progress", task_type="email_draft")
    task = TaskLedgerEntry.objects.create(topic=topic, title="Send External Email", status="in_progress", task_type="email_draft")
    action = ActionRequest.objects.create(
        topic=topic, task=task, action_type="email_draft", risk_level="high", status="executed",
        execution_result={"status": "sent", "message_id": "fake-123"}
    )
    
    # The system should append the execution result to the task's next actions or context
    workflow = WorkflowRun.objects.create(
        topic=topic, 
        created_by=test_user, 
        run_type="task_execution",
        state={"current_task_id": task.id}
    )
    DailyPlan.objects.create(topic=topic, workflow_run=workflow, status="approved", plan_date=timezone.now().date(), plan_items=[{"task_id": task.id}])
    state = run_strategy_graph(workflow)
    task.refresh_from_db()
    
    assert "email sent" in str(task.next_actions).lower()
