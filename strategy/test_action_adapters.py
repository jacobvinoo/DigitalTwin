import pytest
from strategy.adapters import FakeEmailAdapter, FakeDocumentAdapter, FakeTaskAdapter
from strategy.models import TaskLedgerEntry, Topic
from django.contrib.auth import get_user_model

User = get_user_model()

@pytest.fixture
def user():
    return User.objects.create_user(username="u", email="u@u.com", password="pw")

@pytest.fixture
def topic(user):
    return Topic.objects.create(title="T1", owner=user)

def test_fake_email_adapter_records_payload():
    adapter = FakeEmailAdapter()
    result = adapter.execute({
        "subject": "Hello",
        "recipients": ["a@b.com"],
        "body": "Test body"
    })
    assert result["status"] == "sent_simulated"
    assert result["provider"] == "fake_email"
    assert result["payload_recorded"]["subject"] == "Hello"

def test_fake_email_adapter_refuses_missing_recipients():
    adapter = FakeEmailAdapter()
    with pytest.raises(ValueError, match="Email recipients required"):
        adapter.execute({
            "subject": "Hello",
            "body": "Test body",
            "recipients": []
        })

def test_fake_document_adapter_returns_uri_placeholder():
    adapter = FakeDocumentAdapter()
    result = adapter.execute({
        "title": "Doc Title",
        "content": "Doc content"
    })
    assert result["status"] == "success"
    assert "fake-doc-id-" in result["document_uri"]

@pytest.mark.django_db
def test_fake_task_adapter_creates_follow_up(topic):
    adapter = FakeTaskAdapter()
    result = adapter.execute({
        "topic_id": topic.id,
        "title": "Follow up task",
        "task_type": "review"
    })
    assert result["status"] == "success"
    
    # Verify TaskLedgerEntry was actually created
    task_id = result["created_task_id"]
    task = TaskLedgerEntry.objects.get(id=task_id)
    assert task.title == "Follow up task"
    assert task.topic == topic
    assert task.task_type == "review"

# Real Email Adapter Tests

from unittest.mock import MagicMock
from django.test import override_settings
from strategy.models import ActionRequest

def test_real_email_adapter_dry_run_never_sends():
    from strategy.adapters import RealEmailAdapter
    provider_mock = MagicMock()
    adapter = RealEmailAdapter(provider=provider_mock, dry_run=True)
    
    result = adapter.execute({"recipients": ["a@b.com"], "subject": "S", "body": "B"})
    assert result["status"] == "dry_run"
    provider_mock.send_email.assert_not_called()

@pytest.mark.django_db
def test_real_email_adapter_requires_approved_action(topic):
    from strategy.adapters import RealEmailAdapter
    adapter = RealEmailAdapter(dry_run=False)
    
    action = ActionRequest.objects.create(
        topic=topic,
        action_type="email_send",
        title="Send",
        status="awaiting_approval",
        approval_required=True
    )
    
    with pytest.raises(ValueError, match="ActionRequest must be approved"):
        adapter.execute({"recipients": ["a@b.com"], "subject": "S", "body": "B"}, action_request=action)

@pytest.mark.django_db
@override_settings(FEATURE_EMAIL_SEND_ENABLED=True)
def test_real_email_adapter_executes_and_logs(topic):
    from strategy.adapters import RealEmailAdapter
    provider_mock = MagicMock()
    provider_mock.send_email.return_value = "msg-123"
    
    adapter = RealEmailAdapter(provider=provider_mock, dry_run=False)
    action = ActionRequest.objects.create(
        topic=topic,
        action_type="email_send",
        title="Send",
        status="approved",
        approval_required=True
    )
    
    result = adapter.execute({"recipients": ["a@b.com"], "subject": "S", "body": "B"}, action_request=action)
    
    provider_mock.send_email.assert_called_once_with(["a@b.com"], "S", "B")
    assert result["status"] == "sent"
    assert result["message_id"] == "msg-123"
    assert result["logged_recipients"] == ["a@b.com"]

@pytest.mark.django_db
@override_settings(FEATURE_EMAIL_SEND_ENABLED=True)
def test_real_email_adapter_failed_send_marks_action_failed(topic):
    from strategy.adapters import RealEmailAdapter
    provider_mock = MagicMock()
    provider_mock.send_email.side_effect = Exception("SMTP error")
    
    adapter = RealEmailAdapter(provider=provider_mock, dry_run=False)
    action = ActionRequest.objects.create(
        topic=topic,
        action_type="email_send",
        title="Send",
        status="approved",
        approval_required=True
    )
    
    with pytest.raises(Exception, match="SMTP error"):
        adapter.execute({"recipients": ["a@b.com"], "subject": "S", "body": "B"}, action_request=action)
    
    action.refresh_from_db()
    assert action.status == "failed"
