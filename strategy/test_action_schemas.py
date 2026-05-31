import pytest
from pydantic import ValidationError
from strategy.agents.schemas import EmailDraftOutput

def get_valid_email_draft():
    return {
        "subject": "Important Update",
        "recipients": ["team@example.com"],
        "cc": ["manager@example.com"],
        "body": "This is a non-empty body.",
        "tone": "professional",
        "purpose": "update team on status",
        "risk_notes": ["contains some external metrics"],
        "approval_summary": "User is approving sending an update to the team with external metrics.",
        "follow_up_task_suggestion": "Check replies tomorrow"
    }

def test_email_draft_valid_output():
    # Should not raise
    data = get_valid_email_draft()
    output = EmailDraftOutput(**data)
    assert output.subject == "Important Update"

def test_email_draft_subject_required():
    data = get_valid_email_draft()
    del data["subject"]
    with pytest.raises(ValidationError):
        EmailDraftOutput(**data)

def test_email_draft_body_required():
    data = get_valid_email_draft()
    del data["body"]
    with pytest.raises(ValidationError):
        EmailDraftOutput(**data)

def test_email_draft_recipients_list_required():
    data = get_valid_email_draft()
    del data["recipients"]
    with pytest.raises(ValidationError):
        EmailDraftOutput(**data)
        
    data["recipients"] = "team@example.com"  # Not a list
    with pytest.raises(ValidationError):
        EmailDraftOutput(**data)

def test_email_draft_risk_notes_required():
    data = get_valid_email_draft()
    del data["risk_notes"]
    with pytest.raises(ValidationError):
        EmailDraftOutput(**data)

def test_email_draft_no_empty_body():
    data = get_valid_email_draft()
    data["body"] = "   "
    with pytest.raises(ValidationError, match="Body cannot be empty"):
        EmailDraftOutput(**data)

def test_email_draft_approval_summary_required():
    data = get_valid_email_draft()
    del data["approval_summary"]
    with pytest.raises(ValidationError):
        EmailDraftOutput(**data)
