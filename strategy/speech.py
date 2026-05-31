"""
Speech-to-Text provider boundary.

This module defines the interface for future audio transcription providers
(e.g. Google Speech, Whisper). No real microphone or audio API is connected here.

Only FakeSpeechToTextProvider is active.
Set FEATURE_VOICE_INPUT_ENABLED=true in .env to unlock real provider support
(not connected yet — placeholder only).
"""

import abc
import os
import uuid

LOW_CONFIDENCE_THRESHOLD = 0.6

# Feature flag — disabled by default. Set FEATURE_VOICE_INPUT_ENABLED=true to enable
# a real STT provider once one is wired up.
FEATURE_VOICE_INPUT_ENABLED = os.environ.get("FEATURE_VOICE_INPUT_ENABLED", "false").lower() == "true"


def get_speech_provider() -> "SpeechToTextProvider":
    """Return the active STT provider.
    
    When FEATURE_VOICE_INPUT_ENABLED is false (default) the fake provider is
    always returned regardless of other settings. Real providers can be wired
    here behind the flag without touching any call sites.
    """
    return FakeSpeechToTextProvider()


class SpeechToTextProvider(abc.ABC):
    """Abstract interface every STT provider must implement."""

    @abc.abstractmethod
    def transcribe(self, audio_ref: str, language: str = "en-US") -> dict:
        """
        Transcribe an audio reference.

        Returns:
            {
                "transcript_text": str,
                "confidence": float,      # 0.0–1.0
                "language": str,
                "provider": str,
                "metadata": dict,
            }
        """


class FakeSpeechToTextProvider(SpeechToTextProvider):
    """
    Deterministic fake provider for tests and local development.

    Maps well-known audio_ref fixtures to scripted transcripts.
    Any unrecognised audio_ref returns a low-confidence gibberish result so that
    the caller is always forced to handle the low-confidence path.
    """

    FIXTURE_MAP = {
        "audio_prepare_plan": {
            "transcript_text": "Prepare today's plan",
            "confidence": 0.97,
        },
        "audio_send_email": {
            "transcript_text": "Send the email",
            "confidence": 0.95,
        },
        "audio_get_status": {
            "transcript_text": "What is the status?",
            "confidence": 0.93,
        },
        "audio_low_confidence": {
            "transcript_text": "mumble mumble",
            "confidence": 0.35,
        },
    }

    def transcribe(self, audio_ref: str, language: str = "en-US") -> dict:
        fixture = self.FIXTURE_MAP.get(audio_ref)

        if fixture:
            transcript_text = fixture["transcript_text"]
            confidence = fixture["confidence"]
        else:
            # Unknown audio_ref → low-confidence fallback
            transcript_text = f"[unrecognised audio: {audio_ref}]"
            confidence = 0.10

        return {
            "transcript_text": transcript_text,
            "confidence": confidence,
            "language": language,
            "provider": "fake_stt",
            "metadata": {
                "audio_ref": audio_ref,
                "fake": True,
                "request_id": str(uuid.uuid4()),
            },
        }
