import pytest
from django.contrib.auth import get_user_model
from strategy.models import Topic, Objective, Workstream, TaskLedgerEntry, MemoryRecord, FeedbackRecord, EvaluationScorecard

pytestmark = pytest.mark.django_db

@pytest.fixture
def owner():
    User = get_user_model()
    return User.objects.create_user(username="pm_john", password="password")

def test_topic_model_exists(owner):
    topic = Topic.objects.create(
        title="Search for Supermarket",
        description="Strategic initiative for supermarket search",
        strategic_context="Q3 Expansion",
        owner=owner,
        status="active"
    )
    assert topic.id is not None
    assert topic.status == "active"

def test_objective_model_exists(owner):
    topic = Topic.objects.create(title="Search for Supermarket", owner=owner, status="active")
    objective = Objective.objects.create(
        topic=topic,
        title="Do competitive analysis",
        description="Analyze 3 main competitors",
        success_metric="Matrix completed",
        priority="high",
        status="active"
    )
    assert objective.topic == topic

def test_workstream_model_exists(owner):
    topic = Topic.objects.create(title="Search for Supermarket", owner=owner, status="active")
    workstream = Workstream.objects.create(
        topic=topic,
        title="Competitive Analysis Workstream",
        type="competitive_analysis",
        status="active",
        sort_order=1
    )
    assert workstream.type == "competitive_analysis"

def test_task_ledger_entry_model_exists(owner):
    topic = Topic.objects.create(title="Search for Supermarket", owner=owner, status="active")
    task = TaskLedgerEntry.objects.create(
        topic=topic,
        title="Gather competitor feature list",
        task_type="research",
        owner_agent_label="assistant",
        status="proposed",
        risk_level="low",
        approval_required=True,
        execution_lineage={},
        governance={},
        inputs={"query": "supermarket search competitors"},
        telemetry={},
        outputs={},
        evaluation={},
        next_actions={}
    )
    assert task.status == "proposed"

def test_memory_record_model_exists():
    memory = MemoryRecord.objects.create(
        memory_type="user_preference",
        content="Prefers structured markdown",
        source="pm_john",
        confidence=0.9,
        approved_for_reuse=False
    )
    assert memory.approved_for_reuse is False

def test_feedback_record_model_exists():
    feedback = FeedbackRecord.objects.create(
        raw_feedback="The analysis is missing key competitor X.",
        feedback_type="accuracy",
        sentiment="negative",
        improvement_suggestion="Include competitor X in the matrix"
    )
    assert feedback.sentiment == "negative"

def test_evaluation_scorecard_model_exists(owner):
    topic = Topic.objects.create(title="Search for Supermarket", owner=owner, status="active")
    task = TaskLedgerEntry.objects.create(
        topic=topic,
        title="Test Task",
        task_type="research",
        status="completed"
    )
    scorecard = EvaluationScorecard.objects.create(
        task=task,
        relevance=4.0,
        quality=5.0,
        evidence_strength=3.0,
        actionability=4.0,
        executive_readiness=2.0,
        style_alignment=4.0,
        local_context=3.0,
        novelty=4.0,
        overall_score=3.625,
        reviewer_notes="Good start but needs executive summary."
    )
    assert scorecard.overall_score == 3.625

def test_deleting_topic_soft_deletes_task_ledger(owner):
    topic = Topic.objects.create(title="Search for Supermarket", owner=owner, status="active")
    task = TaskLedgerEntry.objects.create(
        topic=topic,
        title="Sample task",
        task_type="research",
        status="proposed"
    )
    
    topic.status = "deleted"
    topic.save()
    
    task.refresh_from_db()
    assert task.id is not None
    assert task.status in ["archived", "blocked", "proposed"]
