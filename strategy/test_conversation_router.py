import pytest
from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied
from strategy.models import Topic, TaskLedgerEntry, ActionRequest, ConversationSession, ConversationMessage

from strategy.services import ConversationCommandRouter

User = get_user_model()

@pytest.fixture
def test_user(db):
    return User.objects.create_user(username="testuser", password="password")

@pytest.fixture
def other_user(db):
    return User.objects.create_user(username="otheruser", password="password")

@pytest.fixture
def topic(test_user):
    return Topic.objects.create(title="Supermarket Search", owner=test_user)

@pytest.fixture
def session(test_user, topic):
    return ConversationSession.objects.create(user=test_user, topic=topic)

@pytest.mark.django_db
class TestConversationCommandRouter:
    def setup_method(self):
        self.router = ConversationCommandRouter()

    @patch('strategy.services.create_daily_plan')
    def test_create_daily_plan_calls_service(self, mock_create_plan, session):
        # mock returns a tuple (run, plan)
        mock_plan = MagicMock()
        mock_plan.id = 1
        mock_create_plan.return_value = (MagicMock(), mock_plan)
        
        response = self.router.handle_message(session, "Prepare today's plan")
        assert mock_create_plan.called
        assert response.get("ui_card") == "DailyPlanCard"

    def test_get_status_returns_command_centre_summary(self, session):
        response = self.router.handle_message(session, "What is the status?")
        assert response.get("ui_card") == "StatusCard"

    def test_get_completed_work_returns_completed_task_list(self, session, topic):
        TaskLedgerEntry.objects.create(topic=topic, title="Task 1", status="completed")
        response = self.router.handle_message(session, "What did you complete today?")
        assert response.get("ui_card") == "CompletedWorkCard"
        assert "Task 1" in str(response.get("data"))

    def test_get_pending_approvals_returns_approval_cards(self, session, topic):
        ActionRequest.objects.create(topic=topic, action_type="email_draft", status="awaiting_approval", title="Email 1")
        response = self.router.handle_message(session, "What needs my approval?")
        assert response.get("ui_card") == "PendingApprovalsCard"
        assert "Email 1" in str(response.get("data"))

    @patch('strategy.workflows.executive_reviewer_node')
    def test_executive_challenge_routes_to_executive_reviewer(self, mock_executive_node, session, topic):
        task = TaskLedgerEntry.objects.create(topic=topic, title="Task 1", status="completed")
        response = self.router.handle_message(session, "Ask the executive to challenge this", task_id=task.id)
        assert mock_executive_node.called or response.get("ui_card") == "ExecutiveReviewCard"

    def test_create_action_creates_action_request(self, session, topic):
        task = TaskLedgerEntry.objects.create(topic=topic, title="Task 1", status="in_progress")
        response = self.router.handle_message(session, "Draft an email to the Search team", task_id=task.id)
        assert ActionRequest.objects.filter(topic=topic, action_type="email_draft").exists()
        assert response.get("ui_card") == "ActionDraftCard"

    def test_execute_action_refuses_execution_if_unapproved(self, session, topic):
        action = ActionRequest.objects.create(topic=topic, action_type="email_draft", status="awaiting_approval")
        response = self.router.handle_message(session, "Send the email", action_id=action.id)
        assert response.get("error") is not None
        assert "unapproved" in response.get("error").lower() or "approval" in response.get("error").lower()
        
        # Verify action was not executed
        action.refresh_from_db()
        assert action.status == "awaiting_approval"

    def test_switch_entity_updates_active_entity(self, session):
        self.router.handle_message(session, "Switch to executive")
        session.refresh_from_db()
        assert session.active_entity == "executive"
        
        self.router.handle_message(session, "Switch to assistant")
        session.refresh_from_db()
        assert session.active_entity == "assistant"

    def test_unknown_intent_returns_clarification(self, session):
        response = self.router.handle_message(session, "blargh flargh")
        assert response.get("requires_clarification") is True

    def test_all_responses_are_stored_as_conversation_message(self, session):
        initial_count = ConversationMessage.objects.count()
        self.router.handle_message(session, "Switch to executive")
        
        # Should store 1 user message and 1 system/assistant response
        new_count = ConversationMessage.objects.count()
        assert new_count >= initial_count + 2

    def test_router_respects_topic_ownership(self, other_user, topic):
        other_session = ConversationSession.objects.create(user=other_user, topic=topic)
        with pytest.raises(PermissionDenied):
            self.router.handle_message(other_session, "Prepare today's plan")

    def test_router_does_not_bypass_approval_gates(self, session, topic):
        # Even if asked to execute, it must not bypass if high risk and unapproved
        action = ActionRequest.objects.create(topic=topic, action_type="email_send", status="drafted", approval_required=True)
        response = self.router.handle_message(session, "Execute action without approval", action_id=action.id)
        
        action.refresh_from_db()
        assert action.status != "executed"
