import pytest
from django.contrib.auth import get_user_model
from strategy.models import Topic, TaskLedgerEntry, FeedbackRecord, EvaluationScorecard, MemoryRecord

pytestmark = pytest.mark.django_db

@pytest.fixture
def user():
    return get_user_model().objects.create_user(username="testuser", password="password")

@pytest.fixture
def topic(user):
    return Topic.objects.create(title="Feedback Topic", owner=user, status="active")

@pytest.fixture
def task(topic):
    return TaskLedgerEntry.objects.create(
        topic=topic,
        title="Sample Task",
        task_type="research",
        status="completed"
    )

def test_feedback_creation_and_memory_generation(topic, task):
    feedback = FeedbackRecord.objects.create(
        topic=topic,
        task=task,
        raw_feedback="This is too generic. Add stronger NZ supermarket search context.",
        feedback_type="relevance",
        sentiment="negative"
    )
    
    assert feedback.id is not None
    assert feedback.raw_feedback == "This is too generic. Add stronger NZ supermarket search context."
    
    memory = MemoryRecord.objects.filter(topic=topic, source=f"feedback_{feedback.id}").first()
    assert memory is not None, "MemoryRecord should be automatically created from Feedback"
    assert memory.approved_for_reuse is False

def test_evaluation_scorecard_calculation(task):
    scorecard = EvaluationScorecard.objects.create(
        task=task,
        relevance=8.0,
        quality=7.0,
        evidence_strength=6.0,
        actionability=9.0,
        executive_readiness=8.0,
        style_alignment=7.0,
        local_context=5.0,
        novelty=6.0
    )
    
    scorecard.save()
    scorecard.refresh_from_db()
    
    assert scorecard.overall_score == 7.0

def test_topic_command_centre_average_quality(topic, task):
    EvaluationScorecard.objects.create(
        task=task,
        quality=8.0,
        relevance=8.0, evidence_strength=8.0, actionability=8.0,
        executive_readiness=8.0, style_alignment=8.0, local_context=8.0, novelty=8.0
    )
    
    task2 = TaskLedgerEntry.objects.create(
        topic=topic,
        title="Another Task",
        status="completed"
    )
    EvaluationScorecard.objects.create(
        task=task2,
        quality=6.0,
        relevance=6.0, evidence_strength=6.0, actionability=6.0,
        executive_readiness=6.0, style_alignment=6.0, local_context=6.0, novelty=6.0
    )
    
    from rest_framework.test import APIClient
    client = APIClient()
    client.force_authenticate(user=topic.owner)
    
    response = client.get(f'/api/topics/{topic.id}/command-centre/')
    assert response.status_code == 200
    assert response.data['average_quality_score'] == 7.0
