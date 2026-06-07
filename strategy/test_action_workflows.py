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


@pytest.mark.django_db
def test_task_completion_triggers_action_creation(test_user):
    topic = Topic.objects.create(title="Test Topic", owner=test_user)
    task = TaskLedgerEntry.objects.create(
        topic=topic,
        title="Analyze Competitors",
        status="in_progress",
        task_type="competitive_research",
        outputs={"agent_output": {"next_actions": ["Research Walmart", "Research Target"]}}
    )
    
    from strategy.workflows import create_execution_actions_from_task
    create_execution_actions_from_task(task)
    
    actions = ActionRequest.objects.filter(task=task)
    assert actions.count() == 2
    assert actions.filter(title__contains="Research Walmart").exists()
    assert actions.filter(title__contains="Research Target").exists()


@pytest.mark.django_db
def test_roadmap_completion_triggers_30_60_90_day_actions(test_user):
    topic = Topic.objects.create(title="Test Topic", owner=test_user)
    task = TaskLedgerEntry.objects.create(
        topic=topic,
        title="Create 30/60/90 Day Roadmap",
        status="in_progress",
        task_type="roadmap",
        outputs={"agent_output": {
            "next_actions": [
                "Setup Algolia sandbox",
                "Integrate front-end components",
                "Launch to 100% production users"
            ]
        }}
    )
    
    from strategy.workflows import create_execution_actions_from_task
    create_execution_actions_from_task(task)
    
    actions = ActionRequest.objects.filter(task=task)
    assert actions.count() == 3
    assert actions.filter(title__contains="30-Day Plan").exists()
    assert actions.filter(title__contains="60-Day Plan").exists()
    assert actions.filter(title__contains="90-Day Plan").exists()


@pytest.mark.django_db
def test_executed_actions_included_in_context(test_user):
    topic = Topic.objects.create(title="Test Topic", owner=test_user)
    task = TaskLedgerEntry.objects.create(
        topic=topic,
        title="Analyze Competitors",
        status="completed",
        task_type="competitive_research"
    )
    action = ActionRequest.objects.create(
        topic=topic,
        task=task,
        action_type="follow_up_task",
        title="30-Day Plan - Setup Algolia",
        instruction="Setup Algolia sandbox",
        status="executed",
        execution_result={"status": "success", "result_document": "### Sandbox setup successful"}
    )
    
    from strategy.agents.context import AgentContextBuilder
    # Build context for a new task in the same topic
    new_task = TaskLedgerEntry.objects.create(
        topic=topic,
        title="Define Search Metrics",
        status="proposed",
        task_type="metrics_definition"
    )
    context = AgentContextBuilder(new_task).build()
    
    import json
    data = json.loads(context["text"])
    
    # Verify executed action result document is present in topic-level actions and related tasks
    assert "executed_topic_actions" in data["topic"]
    assert len(data["topic"]["executed_topic_actions"]) == 1
    assert data["topic"]["executed_topic_actions"][0]["result_document"] == "### Sandbox setup successful"
    
    assert len(data["related_outputs"]) == 1
    assert len(data["related_outputs"][0]["executed_actions"]) == 1
    assert data["related_outputs"][0]["executed_actions"][0]["result_document"] == "### Sandbox setup successful"


@pytest.mark.django_db
def test_task_completion_creates_draft_tasks(test_user):
    topic = Topic.objects.create(title="Test Topic", owner=test_user)
    task = TaskLedgerEntry.objects.create(
        topic=topic,
        title="Analyze Competitors",
        status="in_progress",
        task_type="competitive_research",
        outputs={"agent_output": {"next_actions": ["Research Walmart", "Research Target"]}}
    )
    
    from strategy.workflows import create_execution_actions_from_task
    create_execution_actions_from_task(task)
    
    draft_tasks = TaskLedgerEntry.objects.filter(topic=topic, governance__is_draft=True)
    assert draft_tasks.count() == 2
    assert draft_tasks.filter(title__contains="Research Walmart").exists()


@pytest.mark.django_db
def test_add_draft_task_to_board_endpoint(test_user):
    from rest_framework.test import APIClient
    client = APIClient()
    client.force_authenticate(user=test_user)
    
    topic = Topic.objects.create(title="Test Topic", owner=test_user)
    draft_task = TaskLedgerEntry.objects.create(
        topic=topic,
        title="Draft task from roadmap",
        status="proposed",
        task_type="draft_focus_task",
        governance={"is_draft": True}
    )
    
    # Call the add-to-board endpoint
    response = client.post(f"/api/tasks/{draft_task.id}/add-to-board/")
    assert response.status_code == 200
    
    draft_task.refresh_from_db()
    assert not draft_task.governance.get("is_draft")
    assert draft_task.status == "proposed"
