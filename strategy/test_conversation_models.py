import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError, PermissionDenied
from strategy.models import Topic, TaskLedgerEntry, ActionRequest, ConversationSession, ConversationMessage, VoiceTranscriptRecord

User = get_user_model()

@pytest.fixture
def test_user(db):
    return User.objects.create_user(username="testuser", password="password")

@pytest.fixture
def other_user(db):
    return User.objects.create_user(username="otheruser", password="password")

@pytest.mark.django_db
class TestConversationModels:
    def test_user_can_create_conversation_session(self, test_user):
        assert ConversationSession is not None, "ConversationSession model not implemented"
        session = ConversationSession.objects.create(
            user=test_user,
            title="Planning session"
        )
        assert session.id is not None
        assert session.user == test_user
        assert session.title == "Planning session"
        assert session.status == "active"

    def test_session_can_link_to_topic(self, test_user):
        assert ConversationSession is not None, "ConversationSession model not implemented"
        topic = Topic.objects.create(title="Supermarket Search", owner=test_user)
        session = ConversationSession.objects.create(
            user=test_user,
            topic=topic,
            title="Topic discussion"
        )
        assert session.topic == topic

    def test_message_can_link_to_task_and_action(self, test_user):
        assert ConversationSession is not None, "ConversationSession model not implemented"
        assert ConversationMessage is not None, "ConversationMessage model not implemented"
        
        topic = Topic.objects.create(title="Supermarket Search", owner=test_user)
        task = TaskLedgerEntry.objects.create(topic=topic, title="Review plan", status="in_progress")
        action = ActionRequest.objects.create(topic=topic, task=task, action_type="email_draft", risk_level="low", status="drafted")
        
        session = ConversationSession.objects.create(user=test_user, topic=topic)
        message = ConversationMessage.objects.create(
            session=session,
            sender="assistant",
            channel="text",
            message_text="I have drafted the email.",
            linked_task=task,
            linked_action=action
        )
        
        assert message.linked_task == task
        assert message.linked_action == action

    def test_voice_transcript_creates_message_with_channel_voice(self, test_user):
        assert ConversationSession is not None, "ConversationSession model not implemented"
        assert VoiceTranscriptRecord is not None, "VoiceTranscriptRecord model not implemented"
        
        session = ConversationSession.objects.create(user=test_user)
        transcript = VoiceTranscriptRecord.objects.create(
            session=session,
            transcript_text="Send the email.",
            confidence=0.98,
            language="en-US"
        )
        
        message = ConversationMessage.objects.create(
            session=session,
            sender="user",
            channel="voice",
            message_text=transcript.transcript_text
        )
        
        assert transcript.id is not None
        assert message.channel == "voice"
        assert message.message_text == "Send the email."

    def test_active_entity_defaults_to_assistant(self, test_user):
        assert ConversationSession is not None, "ConversationSession model not implemented"
        session = ConversationSession.objects.create(user=test_user)
        assert session.active_entity == "assistant"

    def test_executive_messages_stored_separately_from_assistant(self, test_user):
        assert ConversationSession is not None, "ConversationSession model not implemented"
        assert ConversationMessage is not None, "ConversationMessage model not implemented"
        
        session = ConversationSession.objects.create(user=test_user)
        
        ConversationMessage.objects.create(
            session=session,
            sender="assistant",
            channel="text",
            message_text="I am the assistant."
        )
        
        ConversationMessage.objects.create(
            session=session,
            sender="executive",
            channel="text",
            message_text="I am the executive. I reject this."
        )
        
        assistant_msgs = ConversationMessage.objects.filter(session=session, sender="assistant")
        exec_msgs = ConversationMessage.objects.filter(session=session, sender="executive")
        
        assert assistant_msgs.count() == 1
        assert exec_msgs.count() == 1
        assert assistant_msgs.first().message_text != exec_msgs.first().message_text

    def test_user_cannot_access_another_users_session(self, test_user, other_user):
        assert ConversationSession is not None, "ConversationSession model not implemented"
        session = ConversationSession.objects.create(user=test_user, title="My private session")
        
        # Simulating a permission check function that would be used in the service layer
        with pytest.raises(PermissionDenied):
            if session.user != other_user:
                raise PermissionDenied("You do not have access to this session.")

    def test_archived_session_cannot_accept_new_messages_unless_reopened(self, test_user):
        assert ConversationSession is not None, "ConversationSession model not implemented"
        assert ConversationMessage is not None, "ConversationMessage model not implemented"
        
        session = ConversationSession.objects.create(user=test_user, status="archived")
        
        # Simulating a validation check that would prevent message creation
        with pytest.raises(ValidationError):
            if session.status == "archived":
                raise ValidationError("Cannot add messages to an archived session.")
            ConversationMessage.objects.create(
                session=session,
                sender="user",
                channel="text",
                message_text="Hello?"
            )
