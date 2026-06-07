import pytest
import json
from django.contrib.auth import get_user_model
from django.test import Client
from strategy.models import Topic, TaskLedgerEntry, ActionRequest

pytestmark = pytest.mark.django_db

@pytest.fixture
def client():
    return Client()

@pytest.fixture
def user1():
    User = get_user_model()
    return User.objects.create_user(username="pm_alice", password="password")

@pytest.fixture
def user2():
    User = get_user_model()
    return User.objects.create_user(username="pm_bob", password="password")

@pytest.fixture
def topic(user1):
    return Topic.objects.create(
        title="Search for Supermarket",
        description="Strategic context",
        owner=user1,
        status="active"
    )

@pytest.fixture
def task(topic):
    return TaskLedgerEntry.objects.create(
        topic=topic,
        title="Create Algolia implementation plan",
        task_type="implementation_plan",
        risk_level="medium",
        approval_required=True,
        status="proposed"
    )

def test_create_topic_api(client, user1):
    client.force_login(user1)
    payload = {
        "title": "Search for Supermarket",
        "objective": "Improve search relevance",
        "strategic_context": "Q3 priority"
    }
    response = client.post("/api/topics/", data=json.dumps(payload), content_type="application/json")
    assert response.status_code == 201
    assert Topic.objects.count() == 1

def test_list_topics_api(client, user1, topic):
    client.force_login(user1)
    response = client.get("/api/topics/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["title"] == "Search for Supermarket"

def test_get_topic_detail_api(client, user1, topic):
    client.force_login(user1)
    response = client.get(f"/api/topics/{topic.id}/")
    assert response.status_code == 200
    data = response.json()
    assert "objectives" in data
    assert "workstreams" in data
    assert "tasks" in data
    assert "pending_approvals" in data
    assert "scorecards" in data
    assert "feedback_summary" in data

def test_approve_task_api(client, user1, task):
    client.force_login(user1)
    response = client.post(f"/api/tasks/{task.id}/approve/")
    assert response.status_code == 200
    task.refresh_from_db()
    assert task.status == "approved"

def test_reject_task_api(client, user1, task):
    client.force_login(user1)
    payload = {"reason": "Not enough detail"}
    response = client.post(f"/api/tasks/{task.id}/reject/", data=json.dumps(payload), content_type="application/json")
    assert response.status_code == 200
    task.refresh_from_db()
    assert task.status == "rejected"

def test_add_feedback_to_task_api(client, user1, task):
    client.force_login(user1)
    payload = {"raw_feedback": "Looks good", "feedback_type": "quality", "sentiment": "positive"}
    response = client.post(f"/api/tasks/{task.id}/feedback/", data=json.dumps(payload), content_type="application/json")
    assert response.status_code == 201

def test_add_scorecard_to_task_api(client, user1, task):
    client.force_login(user1)
    payload = {"relevance": 4.0, "quality": 5.0}
    response = client.post(f"/api/tasks/{task.id}/score/", data=json.dumps(payload), content_type="application/json")
    assert response.status_code == 201

def test_command_centre_api(client, user1, topic):
    client.force_login(user1)
    response = client.get(f"/api/topics/{topic.id}/command-centre/")
    assert response.status_code == 200
    data = response.json()
    assert "active_tasks_count" in data
    assert "completed_tasks_count" in data
    assert "pending_approval_count" in data
    assert "blocked_tasks_count" in data
    assert "next_actions" in data
    assert "average_quality_score" in data
    assert "average_relevance_score" in data

def test_authz_user_cannot_see_another_users_topics(client, user2, topic):
    client.force_login(user2)
    response = client.get("/api/topics/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 0  # Should be empty for user2
    
    response_detail = client.get(f"/api/topics/{topic.id}/")
    assert response_detail.status_code == 404

def test_authz_user_cannot_approve_another_users_tasks(client, user2, task):
    client.force_login(user2)
    response = client.post(f"/api/tasks/{task.id}/approve/")
    assert response.status_code in [403, 404]
    task.refresh_from_db()
    assert task.status != "approved"

def test_create_task_via_api(client, user1, topic):
    client.force_login(user1)
    payload = {
        "topic": topic.id,
        "title": "Custom Test Task",
        "task_type": "generic",
        "risk_level": "medium"
    }
    response = client.post("/api/tasks/", data=json.dumps(payload), content_type="application/json")
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Custom Test Task"
    assert data["status"] == "proposed"
    assert data["risk_level"] == "medium"
    assert data["approval_required"] is True

def test_create_task_via_api_forbidden_topic(client, user2, topic):
    client.force_login(user2)
    payload = {
        "topic": topic.id,
        "title": "Custom Test Task",
        "task_type": "generic",
        "risk_level": "medium"
    }
    response = client.post("/api/tasks/", data=json.dumps(payload), content_type="application/json")
    assert response.status_code in [403, 404]

def test_delete_task_via_api(client, user1, task):
    client.force_login(user1)
    response = client.delete(f"/api/tasks/{task.id}/")
    assert response.status_code == 204
    assert TaskLedgerEntry.objects.filter(id=task.id).count() == 0

def test_delete_task_via_api_forbidden(client, user2, task):
    client.force_login(user2)
    response = client.delete(f"/api/tasks/{task.id}/")
    assert response.status_code == 404
    assert TaskLedgerEntry.objects.filter(id=task.id).count() == 1

def test_delete_action_request_via_api(client, user1, topic):
    client.force_login(user1)
    action_req = ActionRequest.objects.create(
        topic=topic,
        title="Action Title",
        action_type="email",
        status="proposed",
        instruction="Send email"
    )
    response = client.delete(f"/api/actions/{action_req.id}/")
    assert response.status_code == 204
    assert ActionRequest.objects.filter(id=action_req.id).count() == 0

def test_delete_action_request_via_api_forbidden(client, user2, topic):
    client.force_login(user2)
    action_req = ActionRequest.objects.create(
        topic=topic,
        title="Action Title",
        action_type="email",
        status="proposed",
        instruction="Send email"
    )
    response = client.delete(f"/api/actions/{action_req.id}/")
    assert response.status_code == 404
    assert ActionRequest.objects.filter(id=action_req.id).count() == 1

def test_approve_changes_api(client, user1, task):
    import os
    from django.conf import settings
    client.force_login(user1)
    
    test_file_path = os.path.join(settings.BASE_DIR, "strategy_documents", f"test_approve_{task.id}.md")
    if os.path.exists(test_file_path):
        os.remove(test_file_path)
        
    task.outputs = {
        "suggested_document_markdown": "# Suggested Content\nNew line.",
        "generated_document_path": test_file_path
    }
    task.save()
    
    response = client.post(f"/api/tasks/{task.id}/approve-changes/")
    assert response.status_code == 200
    
    # Check database outputs updated
    task.refresh_from_db()
    assert "suggested_document_markdown" not in task.outputs
    assert task.outputs["generated_document_markdown"] == "# Suggested Content\nNew line."
    
    # Check file exists and has content
    assert os.path.exists(test_file_path)
    with open(test_file_path, "r", encoding="utf-8") as f:
        assert f.read() == "# Suggested Content\nNew line."
        
    # Clean up
    if os.path.exists(test_file_path):
        os.remove(test_file_path)

