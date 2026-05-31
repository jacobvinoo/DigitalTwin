import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from strategy.models import Topic, ActionRequest

User = get_user_model()

@pytest.fixture
def user1():
    return User.objects.create_user(username="u1", email="u1@test.com", password="pw")

@pytest.fixture
def user2():
    return User.objects.create_user(username="u2", email="u2@test.com", password="pw")

@pytest.fixture
def client1(user1):
    c = APIClient()
    c.force_authenticate(user=user1)
    return c

@pytest.fixture
def client2(user2):
    c = APIClient()
    c.force_authenticate(user=user2)
    return c

@pytest.fixture
def topic1(user1):
    return Topic.objects.create(title="T1", owner=user1)

@pytest.fixture
def topic2(user2):
    return Topic.objects.create(title="T2", owner=user2)

@pytest.mark.django_db
def test_create_action_request(client1, topic1):
    res = client1.post("/api/actions/", {
        "topic": topic1.id,
        "action_type": "email_draft",
        "title": "Draft this",
        "instruction": "Draft an email"
    }, format="json")
    assert res.status_code == 201
    assert res.data["action_type"] == "email_draft"

@pytest.mark.django_db
def test_list_and_retrieve_actions(client1, topic1, user1):
    action = ActionRequest.objects.create(topic=topic1, action_type="follow_up_task", title="Follow up", instruction="Do it")
    
    res = client1.get("/api/actions/")
    assert res.status_code == 200
    assert len(res.data) == 1
    
    res2 = client1.get(f"/api/actions/{action.id}/")
    assert res2.status_code == 200
    assert res2.data["title"] == "Follow up"

@pytest.mark.django_db
def test_cannot_execute_unapproved_high_risk_action(client1, topic1):
    action = ActionRequest.objects.create(
        topic=topic1, 
        action_type="email_send", 
        title="Send", 
        instruction="Send", 
        risk_level="high", 
        approval_required=True,
        status="awaiting_approval"
    )
    res = client1.post(f"/api/actions/{action.id}/execute/", format="json")
    assert res.status_code == 400
    assert "approve" in res.data["error"].lower()

@pytest.mark.django_db
def test_approved_action_records_approved_by_and_at(client1, topic1, user1):
    action = ActionRequest.objects.create(
        topic=topic1, 
        action_type="email_send", 
        title="Send", 
        instruction="Send", 
        risk_level="high", 
        approval_required=True,
        status="awaiting_approval"
    )
    res = client1.post(f"/api/actions/{action.id}/approve/", format="json")
    assert res.status_code == 200
    
    action.refresh_from_db()
    assert action.status == "approved"
    assert action.approved_by == user1
    assert action.approved_at is not None

@pytest.mark.django_db
def test_rejected_action_cannot_execute(client1, topic1):
    action = ActionRequest.objects.create(
        topic=topic1, 
        action_type="email_send", 
        title="Send", 
        instruction="Send", 
        risk_level="high", 
        approval_required=True,
        status="awaiting_approval"
    )
    res = client1.post(f"/api/actions/{action.id}/reject/", {"reason": "Not ready"}, format="json")
    assert res.status_code == 200
    
    action.refresh_from_db()
    assert action.status == "rejected"
    assert action.rejected_reason == "Not ready"
    
    res2 = client1.post(f"/api/actions/{action.id}/execute/", format="json")
    assert res2.status_code == 400
    assert "reject" in res2.data["error"].lower()

@pytest.mark.django_db
def test_executed_action_records_execution_result(client1, topic1):
    action = ActionRequest.objects.create(
        topic=topic1, 
        action_type="follow_up_task", 
        title="Follow up", 
        instruction="Do it", 
        risk_level="low", 
        approval_required=False,
        status="drafted"
    )
    res = client1.post(f"/api/actions/{action.id}/execute/", format="json")
    assert res.status_code == 200
    
    action.refresh_from_db()
    assert action.status == "executed"
    assert action.execution_result is not None
    assert action.execution_result.get("status") == "success"

@pytest.mark.django_db
def test_user_cannot_approve_another_users_action(client2, topic1):
    action = ActionRequest.objects.create(
        topic=topic1, 
        action_type="email_send", 
        title="Send", 
        instruction="Send", 
        risk_level="high", 
        approval_required=True,
        status="awaiting_approval"
    )
    res = client2.post(f"/api/actions/{action.id}/approve/", format="json")
    assert res.status_code == 404
