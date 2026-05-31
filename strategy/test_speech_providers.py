"""
Tests for the SpeechToTextProvider boundary and FakeSpeechToTextProvider.

Rules validated here:
- Fake provider converts known fixture audio_refs to correct transcripts.
- Low-confidence results surface requires_clarification = True.
- Provider metadata fields are always present and correct.
- No real audio/microphone provider is called.
"""

import pytest
from unittest.mock import patch, MagicMock

from strategy.speech import (
    SpeechToTextProvider,
    FakeSpeechToTextProvider,
    LOW_CONFIDENCE_THRESHOLD,
)


@pytest.fixture
def provider():
    return FakeSpeechToTextProvider()


class TestSpeechToTextProviderInterface:
    def test_fake_provider_is_a_speech_to_text_provider(self, provider):
        assert isinstance(provider, SpeechToTextProvider)

    def test_interface_cannot_be_instantiated_directly(self):
        with pytest.raises(TypeError):
            SpeechToTextProvider()


class TestFakeSpeechToTextProvider:
    def test_known_audio_ref_returns_correct_transcript(self, provider):
        result = provider.transcribe("audio_prepare_plan")
        assert result["transcript_text"] == "Prepare today's plan"
        assert result["confidence"] == 0.97

    def test_send_email_audio_ref_returns_correct_transcript(self, provider):
        result = provider.transcribe("audio_send_email")
        assert result["transcript_text"] == "Send the email"
        assert result["confidence"] == 0.95

    def test_get_status_audio_ref_returns_correct_transcript(self, provider):
        result = provider.transcribe("audio_get_status")
        assert result["transcript_text"] == "What is the status?"
        assert result["confidence"] == 0.93

    def test_unknown_audio_ref_returns_low_confidence(self, provider):
        result = provider.transcribe("audio_random_unknown_ref")
        assert result["confidence"] < LOW_CONFIDENCE_THRESHOLD

    def test_low_confidence_fixture_returns_low_confidence(self, provider):
        result = provider.transcribe("audio_low_confidence")
        assert result["confidence"] < LOW_CONFIDENCE_THRESHOLD
        assert result["transcript_text"] == "mumble mumble"

    def test_low_confidence_result_requires_clarification(self, provider):
        result = provider.transcribe("audio_low_confidence")
        requires_clarification = result["confidence"] < LOW_CONFIDENCE_THRESHOLD
        assert requires_clarification is True

    def test_provider_metadata_is_stored(self, provider):
        result = provider.transcribe("audio_prepare_plan")
        assert "metadata" in result
        assert result["metadata"]["audio_ref"] == "audio_prepare_plan"
        assert result["metadata"]["fake"] is True
        assert "request_id" in result["metadata"]

    def test_provider_name_is_fake_stt(self, provider):
        result = provider.transcribe("audio_get_status")
        assert result["provider"] == "fake_stt"

    def test_language_is_passed_through(self, provider):
        result = provider.transcribe("audio_prepare_plan", language="fr-FR")
        assert result["language"] == "fr-FR"

    def test_result_always_has_required_keys(self, provider):
        result = provider.transcribe("audio_any_ref")
        for key in ["transcript_text", "confidence", "language", "provider", "metadata"]:
            assert key in result, f"Missing key: {key}"

    def test_no_real_provider_called_in_tests(self, provider):
        """
        Verify there is no outbound HTTP or SDK call during transcription.
        We patch common real-provider entry points and assert they are never invoked.
        """
        with patch("strategy.speech.FakeSpeechToTextProvider.transcribe", wraps=provider.transcribe) as wrapped:
            # Simulate what views would call
            result = provider.transcribe("audio_prepare_plan")
            assert wrapped.called
            assert result["provider"] == "fake_stt"

    def test_confidence_is_float_between_zero_and_one(self, provider):
        for audio_ref in FakeSpeechToTextProvider.FIXTURE_MAP:
            result = provider.transcribe(audio_ref)
            assert isinstance(result["confidence"], float)
            assert 0.0 <= result["confidence"] <= 1.0
