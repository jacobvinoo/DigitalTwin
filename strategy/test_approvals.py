import pytest
from django.utils import timezone
from django.contrib.auth import get_user_model
from strategy.models import Topic, TaskLedgerEntry
from django.core.exceptions import ValidationError

pytestmark = pytest.mark.django_db

@pytest.fixture
def user():
    User = get_user_model()
    return User.objects.create_user(username="approver", password="password")

@pytest.fixture
def topic(user):
    return Topic.objects.create(title="Approval Test Topic", owner=user, status="active")

def test_approved_task_gets_approved_at_and_approved_by(user, topic):
    task = TaskLedgerEntry.objects.create(
        topic=topic,
        title="Medium Risk Task",
        risk_level="medium",
        approval_required=True,
        status="proposed"
    )
    
    task.status = "approved"
    task.approved_at = timezone.now()
    task.approved_by = user
    task.save()
    
    task.refresh_from_db()
    assert task.status == "approved"
    assert task.approved_at is not None
    assert task.approved_by == user

def test_rejected_task_requires_rejection_reason(user, topic):
    task = TaskLedgerEntry.objects.create(
        topic=topic,
        title="Medium Risk Task",
        risk_level="medium",
        approval_required=True,
        status="proposed"
    )
    
    task.status = "rejected"
    with pytest.raises(ValidationError, match="rejection_reason is required"):
        task.clean()

def test_low_risk_task_exists_without_approval(user, topic):
    task = TaskLedgerEntry.objects.create(
        topic=topic,
        title="Low Risk Task",
        risk_level="low",
        approval_required=False,
        status="in_progress"
    )
    task.clean() # Should pass validation

def test_medium_risk_cannot_move_to_in_progress_unless_approved(user, topic):
    task = TaskLedgerEntry.objects.create(
        topic=topic,
        title="Medium Risk Task",
        risk_level="medium",
        approval_required=True,
        status="proposed"
    )
    
    task.status = "in_progress"
    with pytest.raises(ValidationError, match="Cannot move to in_progress without approval"):
        task.clean()
