import pytest
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from strategy.models import Topic, TaskLedgerEntry, ActionRequest

User = get_user_model()

@pytest.fixture
def user1():
    return User.objects.create_user(username="user1", email="u1@test.com", password="pw")

@pytest.fixture
def user2():
    return User.objects.create_user(username="user2", email="u2@test.com", password="pw")

@pytest.fixture
def topic1(user1):
    return Topic.objects.create(title="Topic 1", owner=user1)

@pytest.fixture
def topic2(user2):
    return Topic.objects.create(title="Topic 2", owner=user2)

@pytest.fixture
def task1(topic1):
    return TaskLedgerEntry.objects.create(topic=topic1, title="Task 1", task_type="some_task")

@pytest.mark.django_db
def test_action_request_links_to_topic_and_task(topic1, task1):
    action = ActionRequest.objects.create(
        topic=topic1,
        task=task1,
        action_type="follow_up_task",
        title="Test Action",
        instruction="Do something"
    )
    assert action.topic == topic1
    assert action.task == task1

@pytest.mark.django_db
def test_email_send_always_requires_approval(topic1):
    action = ActionRequest(
        topic=topic1,
        action_type="email_send",
        title="Send email to team",
        instruction="Send an update",
        approval_required=False
    )
    with pytest.raises(ValidationError, match="approval_required must be True"):
        action.clean()

@pytest.mark.django_db
def test_draft_only_email_action_no_execution(topic1):
    action = ActionRequest.objects.create(
        topic=topic1,
        action_type="email_draft",
        title="Draft email",
        instruction="Draft an update",
        status="drafted"
    )
    assert action.status == "drafted"
    assert action.action_type == "email_draft"

@pytest.mark.django_db
def test_rejected_action_must_store_reason(topic1):
    action = ActionRequest(
        topic=topic1,
        action_type="email_send",
        title="Send email",
        instruction="Send an update",
        status="rejected"
    )
    with pytest.raises(ValidationError, match="rejected_reason is required"):
        action.clean()
        
    action.rejected_reason = "Not needed"
    action.clean() # Should pass

@pytest.mark.django_db
def test_executed_action_stores_result(topic1):
    action = ActionRequest(
        topic=topic1,
        action_type="email_send",
        title="Send email",
        instruction="Send an update",
        status="executed"
    )
    with pytest.raises(ValidationError, match="execution_result is required"):
        action.clean()
        
    action.execution_result = {"status": "sent"}
    action.clean() # Should pass

@pytest.mark.django_db
def test_user_cannot_access_another_users_action(user1, user2, topic1, topic2):
    ActionRequest.objects.create(topic=topic1, action_type="follow_up_task", title="A1", instruction="i1")
    ActionRequest.objects.create(topic=topic2, action_type="follow_up_task", title="A2", instruction="i2")
    
    user1_actions = ActionRequest.objects.filter(topic__owner=user1)
    assert user1_actions.count() == 1
    assert user1_actions.first().topic.owner == user1
