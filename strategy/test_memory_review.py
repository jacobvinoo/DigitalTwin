import pytest
from django.contrib.auth import get_user_model
from strategy.models import Topic, MemoryRecord
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db

@pytest.fixture
def user():
    return get_user_model().objects.create_user(username="reviewer", password="password")

@pytest.fixture
def topic(user):
    return Topic.objects.create(title="Memory Review Topic", owner=user, status="active")

@pytest.fixture
def unapproved_memory(topic):
    return MemoryRecord.objects.create(
        topic=topic,
        memory_type="feedback",
        content="When analysing regional supermarket strategy, include local market context.",
        approved_for_reuse=False
    )

def test_memory_defaults_to_unapproved(topic):
    record = MemoryRecord.objects.create(
        topic=topic,
        memory_type="feedback",
        content="Random thought"
    )
    assert record.approved_for_reuse is False

def test_memory_review_lists_unapproved(topic, unapproved_memory):
    client = APIClient()
    client.force_authenticate(user=topic.owner)
    
    response = client.get('/api/memory/pending/')
    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]['id'] == unapproved_memory.id

def test_approve_memory_record(topic, unapproved_memory):
    client = APIClient()
    client.force_authenticate(user=topic.owner)
    
    response = client.post(f'/api/memory/{unapproved_memory.id}/approve/')
    assert response.status_code == 200
    
    unapproved_memory.refresh_from_db()
    assert unapproved_memory.approved_for_reuse is True

def test_approved_memory_in_reusable_api(topic, unapproved_memory):
    unapproved_memory.approved_for_reuse = True
    unapproved_memory.save()
    
    client = APIClient()
    client.force_authenticate(user=topic.owner)
    
    response = client.get('/api/memory/reusable/')
    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]['id'] == unapproved_memory.id

def test_unapproved_memory_not_in_reusable_api(topic, unapproved_memory):
    client = APIClient()
    client.force_authenticate(user=topic.owner)
    
    response = client.get('/api/memory/reusable/')
    if response.status_code == 200:
        assert len(response.data) == 0
    else:
        assert response.status_code == 200

def test_reject_memory_record(topic, unapproved_memory):
    client = APIClient()
    client.force_authenticate(user=topic.owner)
    
    response = client.post(f'/api/memory/{unapproved_memory.id}/reject/')
    assert response.status_code == 200
    
    # Verify it is deleted or not in pending
    assert MemoryRecord.objects.filter(id=unapproved_memory.id).exists() is False
