import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from strategy.models import Topic, ConversationSession, ConversationMessage

User = get_user_model()

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def user():
    return User.objects.create_user(username="testuser", password="testpassword")

@pytest.fixture
def other_user():
    return User.objects.create_user(username="otheruser", password="testpassword")

@pytest.fixture
def topic(user):
    return Topic.objects.create(title="My Topic", owner=user)

@pytest.fixture
def session(user, topic):
    return ConversationSession.objects.create(user=user, topic=topic, title="Chat")

@pytest.mark.django_db
class TestConversationAPIs:
    def test_create_session(self, api_client, user, topic):
        api_client.force_authenticate(user=user)
        response = api_client.post("/api/conversations/", {"topic_id": topic.id, "title": "New Session"})
        assert response.status_code == 201
        assert "id" in response.data
        assert ConversationSession.objects.filter(id=response.data["id"]).exists()

    def test_list_sessions(self, api_client, user, session):
        api_client.force_authenticate(user=user)
        response = api_client.get("/api/conversations/")
        assert response.status_code == 200
        assert len(response.data) >= 1
        assert response.data[0]["id"] == session.id

    def test_get_session_with_messages(self, api_client, user, session):
        ConversationMessage.objects.create(session=session, sender="user", message_text="Hello")
        ConversationMessage.objects.create(session=session, sender="assistant", message_text="Hi there")
        
        api_client.force_authenticate(user=user)
        response = api_client.get(f"/api/conversations/{session.id}/")
        assert response.status_code == 200
        
        expected_keys = {'id', 'topic', 'user', 'active_entity', 'title', 'status', 'created_at', 'updated_at', 'messages'}
        assert set(response.data.keys()) == expected_keys
        
        assert len(response.data["messages"]) == 2

    def test_posting_message_stores_user_and_assistant_response(self, api_client, user, session):
        api_client.force_authenticate(user=user)
        response = api_client.post(f"/api/conversations/{session.id}/messages/", {"text": "Prepare today's plan"})
        assert response.status_code == 200
        
        expected_keys = {"message", "ui_card", "data", "error", "requires_clarification", "cards"}
        assert set(response.data.keys()) == expected_keys
        
        assert "message" in response.data
        assert "cards" in response.data
        
        # Check DB
        messages = ConversationMessage.objects.filter(session=session)
        assert messages.count() == 2
        assert messages[0].sender == "user"
        assert messages[1].sender == "assistant"

    def test_active_entity_affects_response_sender(self, api_client, user, session):
        session.active_entity = "executive"
        session.save()
        
        api_client.force_authenticate(user=user)
        response = api_client.post(f"/api/conversations/{session.id}/messages/", {"text": "Prepare today's plan"})
        assert response.status_code == 200
        
        assistant_response = ConversationMessage.objects.filter(session=session).last()
        assert assistant_response.sender == "executive"

    def test_executive_entity_can_produce_executive_challenge_response(self, api_client, user, session):
        api_client.force_authenticate(user=user)
        response = api_client.post(f"/api/conversations/{session.id}/messages/", {"text": "Ask the executive to challenge this"})
        assert response.status_code == 200
        assert any(card["type"] == "ExecutiveReviewCard" for card in response.data.get("cards", []))

    def test_archived_conversation_rejects_messages(self, api_client, user, session):
        api_client.force_authenticate(user=user)
        api_client.post(f"/api/conversations/{session.id}/archive/")
        session.refresh_from_db()
        assert session.status == "archived"
        
        response = api_client.post(f"/api/conversations/{session.id}/messages/", {"text": "Hello"})
        assert response.status_code == 400

    def test_user_cannot_access_another_users_session(self, api_client, other_user, session):
        api_client.force_authenticate(user=other_user)
        
        response = api_client.get(f"/api/conversations/{session.id}/")
        assert response.status_code in [403, 404]
        
        response = api_client.post(f"/api/conversations/{session.id}/messages/", {"text": "Hello"})
        assert response.status_code in [403, 404]

    def test_response_includes_ui_cards(self, api_client, user, session):
        api_client.force_authenticate(user=user)
        response = api_client.post(f"/api/conversations/{session.id}/messages/", {"text": "What is the status?"})
        assert response.status_code == 200
        cards = response.data.get("cards", [])
        assert len(cards) > 0
        assert cards[0]["type"] == "StatusCard"

    def test_switch_entity(self, api_client, user, session):
        api_client.force_authenticate(user=user)
        response = api_client.post(f"/api/conversations/{session.id}/switch-entity/", {"entity": "executive"})
        assert response.status_code == 200
        
        session.refresh_from_db()
        assert session.active_entity == "executive"

    def test_voice_transcript_creates_record_and_message(self, api_client, user, session):
        from strategy.models import VoiceTranscriptRecord
        api_client.force_authenticate(user=user)
        response = api_client.post(f"/api/conversations/{session.id}/voice-transcript/", {
            "transcript_text": "Prepare today's plan",
            "confidence": 0.95
        })
        assert response.status_code == 200
        
        # Check VoiceTranscriptRecord
        transcript = VoiceTranscriptRecord.objects.filter(session=session).first()
        assert transcript is not None
        assert transcript.transcript_text == "Prepare today's plan"
        assert transcript.confidence == 0.95
        
        # Check ConversationMessage channel=voice
        user_msg = ConversationMessage.objects.filter(session=session, sender="user").first()
        assert user_msg is not None
        assert user_msg.channel == "voice"
        assert user_msg.message_text == "Prepare today's plan"
        
        # Check routing occurred
        assert "cards" in response.data

    def test_low_confidence_transcript_asks_for_confirmation(self, api_client, user, session):
        api_client.force_authenticate(user=user)
        response = api_client.post(f"/api/conversations/{session.id}/voice-transcript/", {
            "transcript_text": "Prepare today's plan",
            "confidence": 0.40  # Low confidence
        })
        assert response.status_code == 200
        assert response.data.get("requires_clarification") is True

    def test_voice_transcript_send_email_requires_approval(self, api_client, user, session, topic):
        from strategy.models import ActionRequest
        action = ActionRequest.objects.create(topic=topic, action_type="email_send", status="drafted")
        
        api_client.force_authenticate(user=user)
        response = api_client.post(f"/api/conversations/{session.id}/voice-transcript/", {
            "transcript_text": "Send the email",
            "confidence": 0.95,
            "action_id": action.id
        })
        assert response.status_code == 200
        assert "error" in response.data or response.data.get("requires_clarification") is True
        
        action.refresh_from_db()
        assert action.status == "drafted"

    def test_voice_response_includes_text_response(self, api_client, user, session):
        api_client.force_authenticate(user=user)
        response = api_client.post(f"/api/conversations/{session.id}/voice-transcript/", {
            "transcript_text": "What is the status?",
            "confidence": 0.90
        })
        assert response.status_code == 200
        assert "message" in response.data
        assert isinstance(response.data["message"], str)

    def test_user_cannot_post_transcript_to_another_users_session(self, api_client, other_user, session):
        api_client.force_authenticate(user=other_user)
        response = api_client.post(f"/api/conversations/{session.id}/voice-transcript/", {
            "transcript_text": "Hello",
            "confidence": 0.90
        })
        assert response.status_code in [403, 404]
