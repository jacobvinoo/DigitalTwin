import pytest
from strategy.services import classify_action_risk

def test_email_send_is_high_risk():
    result = classify_action_risk("email_send", "Just sending an email", {})
    assert result["risk_level"] == "high"
    assert result["approval_required"] is True

def test_external_recipient_is_high_risk():
    result = classify_action_risk("email_draft", "Draft email to external partner", {})
    assert result["risk_level"] == "high"
    assert result["approval_required"] is True

def test_internal_draft_only_is_medium_risk():
    result = classify_action_risk("email_draft", "Draft email to internal team", {})
    assert result["risk_level"] == "medium"
    assert result["approval_required"] is True

def test_document_draft_is_medium_risk():
    result = classify_action_risk("document_create", "Draft the new policy document", {})
    assert result["risk_level"] == "medium"
    assert result["approval_required"] is True

def test_follow_up_task_is_low_risk():
    result = classify_action_risk("follow_up_task", "Remind me to check the stats", {})
    assert result["risk_level"] == "low"
    assert result["approval_required"] is False

def test_stakeholder_update_is_medium_risk():
    result = classify_action_risk("stakeholder_update", "Write update for executives", {})
    assert result["risk_level"] == "medium"
    assert result["approval_required"] is True

def test_high_risk_terms_elevate_to_high_risk():
    terms = ["send", "publish", "external", "commit", "approve on my behalf"]
    for term in terms:
        result = classify_action_risk("follow_up_task", f"Need to {term} this tomorrow", {})
        assert result["risk_level"] == "high"
        assert result["approval_required"] is True
