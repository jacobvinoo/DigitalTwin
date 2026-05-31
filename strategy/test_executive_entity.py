import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied
from strategy.models import (
    Topic, TaskLedgerEntry, ActionRequest,
    ConversationSession, ConversationMessage,
)
from strategy.services import ConversationCommandRouter

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(username="exec_user", password="password")


@pytest.fixture
def topic(user):
    return Topic.objects.create(title="Algolia Search Strategy", owner=user)


@pytest.fixture
def session(user, topic):
    return ConversationSession.objects.create(user=user, topic=topic, active_entity="assistant")


@pytest.fixture
def router():
    return ConversationCommandRouter()


@pytest.mark.django_db
class TestExecutiveEntityBackend:

    def test_switching_entity_to_executive_updates_session(self, session):
        assert session.active_entity == "assistant"
        session.active_entity = "executive"
        session.save()
        session.refresh_from_db()
        assert session.active_entity == "executive"

    def test_switch_entity_via_router_updates_session(self, session, router):
        response = router.handle_message(session, "Switch to executive")
        session.refresh_from_db()
        assert session.active_entity == "executive"

    def test_executive_challenge_intent_routes_correctly(self, session, router):
        response = router.handle_message(session, "Ask the executive to challenge this")
        assert response.get("ui_card") == "ExecutiveReviewCard"

    def test_executive_response_sender_is_executive(self, session, router):
        session.active_entity = "executive"
        session.save()

        router.handle_message(session, "Ask the executive to challenge this")

        response_msg = ConversationMessage.objects.filter(
            session=session, sender="executive"
        ).last()
        assert response_msg is not None
        assert response_msg.sender == "executive"

    def test_executive_does_not_execute_actions(self, session, topic, router):
        action = ActionRequest.objects.create(
            topic=topic,
            action_type="email_send",
            status="awaiting_approval",
            title="Send investor update",
        )
        session.active_entity = "executive"
        session.save()

        # Attempting to execute via router must be refused
        response = router.handle_message(
            session, "Send the email", action_id=action.id
        )

        action.refresh_from_db()
        assert action.status == "awaiting_approval"
        # Must have error or requires approval
        assert response.get("error") is not None or response.get("requires_clarification") is True

    def test_executive_can_challenge_task(self, session, topic, router):
        task = TaskLedgerEntry.objects.create(
            topic=topic, title="Algolia Implementation Plan", status="completed"
        )
        session.active_entity = "executive"
        session.save()

        response = router.handle_message(
            session, "Ask the executive to challenge this", task_id=task.id
        )
        assert response.get("ui_card") == "ExecutiveReviewCard"

    def test_executive_messages_stored_with_executive_sender(self, session, router):
        session.active_entity = "executive"
        session.save()

        router.handle_message(session, "Ask the executive to challenge this")

        msgs = ConversationMessage.objects.filter(session=session)
        senders = list(msgs.values_list("sender", flat=True))
        assert "executive" in senders

    def test_executive_session_cannot_create_daily_plan(self, session, router):
        """Executive entity should not be able to trigger plan creation."""
        session.active_entity = "executive"
        session.save()

        from unittest.mock import patch
        with patch("strategy.services.create_daily_plan") as mock_plan:
            router.handle_message(session, "Prepare today's plan")
            # Executive mode should not call create_daily_plan — it should redirect to review
            # (or at minimum, not call it silently in the background)
            # This test will fail if executive silently generates plans
            assert not mock_plan.called, "Executive entity must not create daily plans"
