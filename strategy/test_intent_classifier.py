import pytest
from unittest.mock import patch

from strategy.services import IntentClassifier

class TestIntentClassifier:
    def setup_method(self):
        self.classifier = IntentClassifier()

    def test_classify_create_topic(self):
        result = self.classifier.classify("Create a topic for supermarket search")
        assert result["intent"] == "create_topic"
        assert result["confidence"] > 0.8

    def test_classify_create_daily_plan(self):
        result = self.classifier.classify("Prepare today's plan")
        assert result["intent"] == "create_daily_plan"
        assert result["confidence"] > 0.8

    def test_classify_approve_plan(self):
        result = self.classifier.classify("Approve this plan")
        assert result["intent"] == "approve_plan"
        assert result["confidence"] > 0.8

    def test_classify_get_completed_work(self):
        result = self.classifier.classify("What did you complete today?")
        assert result["intent"] == "get_completed_work"
        assert result["confidence"] > 0.8

    def test_classify_get_pending_approvals(self):
        result = self.classifier.classify("What needs my approval?")
        assert result["intent"] == "get_pending_approvals"
        assert result["confidence"] > 0.8

    def test_classify_executive_challenge(self):
        result = self.classifier.classify("Ask the executive to challenge this")
        assert result["intent"] == "executive_challenge"
        assert result["confidence"] > 0.8

    def test_classify_create_action(self):
        result = self.classifier.classify("Draft an email to the Search team")
        assert result["intent"] == "create_action"
        assert result["confidence"] > 0.8

    def test_classify_execute_action_with_context(self):
        # execute_action should require explicit approval context
        # Without context, it might be unknown or execute_action with low confidence
        result = self.classifier.classify("Send the email")
        assert result["intent"] == "execute_action"
        
    def test_classify_switch_entity(self):
        result = self.classifier.classify("Switch to executive")
        assert result["intent"] == "switch_entity"
        assert result["confidence"] > 0.8

    def test_classify_unclear_message(self):
        result = self.classifier.classify("blargh flargh ping pong")
        assert result["intent"] == "unknown"

    @patch('strategy.agents.client.LLMClient', autospec=True)
    def test_classifier_does_not_call_llm(self, MockLLMClient):
        # Ensure that no LLM calls are made during classification
        self.classifier.classify("Create a daily plan")
        assert not MockLLMClient.called
        assert not MockLLMClient.return_value.execute.called

    def test_classifier_returns_confidence(self):
        result = self.classifier.classify("Approve the action")
        assert "confidence" in result
        assert isinstance(result["confidence"], float)

    def test_low_confidence_requires_clarification(self):
        result = self.classifier.classify("Maybe do the thing?")
        assert result["confidence"] < 0.6
        assert result["requires_clarification"] is True
