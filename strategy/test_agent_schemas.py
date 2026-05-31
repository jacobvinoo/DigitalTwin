import pytest
from pydantic import ValidationError

from strategy.agents.schemas import (
    ProductManagerOutput,
    StrategyManagerOutput,
    ExecutiveReviewOutput,
    EvaluationOutput,
)

def test_product_manager_valid_output():
    data = {
        "task_title": "Define Supermarket Search",
        "product_problem": "Search is too slow",
        "target_users": ["Shoppers"],
        "user_needs": ["Find fast"],
        "product_recommendation": "Use Algolia",
        "success_metrics": ["Latency < 50ms"],
        "risks": ["High cost"],
        "assumptions": ["Data is clean"],
        "next_actions": ["Evaluate pricing"],
        "evidence_refs": ["Ref 1"],
        "confidence_score": 0.9,
    }
    obj = ProductManagerOutput(**data)
    assert obj.task_title == "Define Supermarket Search"

def test_product_manager_missing_required():
    with pytest.raises(ValidationError):
        ProductManagerOutput(task_title="Only Title")

def test_product_manager_confidence_score_bounds():
    data = {
        "task_title": "T",
        "product_problem": "P",
        "target_users": ["U"],
        "user_needs": ["N"],
        "product_recommendation": "R",
        "success_metrics": ["M"],
        "risks": ["R"],
        "assumptions": ["A"],
        "next_actions": ["NA"],
        "evidence_refs": [],
        "confidence_score": 1.5,  # Invalid
    }
    with pytest.raises(ValidationError):
        ProductManagerOutput(**data)
        
    data["confidence_score"] = -0.1
    with pytest.raises(ValidationError):
        ProductManagerOutput(**data)

def test_evaluation_output_scores_and_average():
    data = {
        "relevance": 8,
        "quality": 7,
        "evidence_strength": 6,
        "actionability": 8,
        "executive_readiness": 9,
        "style_alignment": 8,
        "local_context": 7,
        "novelty": 5,
        "evaluator_notes": "Good",
        "overall_score": 7.25, # 58 / 8 = 7.25
    }
    obj = EvaluationOutput(**data)
    assert obj.overall_score == 7.25

def test_evaluation_output_wrong_average():
    data = {
        "relevance": 8,
        "quality": 7,
        "evidence_strength": 6,
        "actionability": 8,
        "executive_readiness": 9,
        "style_alignment": 8,
        "local_context": 7,
        "novelty": 5,
        "evaluator_notes": "Good",
        "overall_score": 8.0, # Wrong
    }
    with pytest.raises(ValidationError, match="overall_score must equal average of dimensions"):
        EvaluationOutput(**data)

def test_evaluation_score_bounds():
    data = {
        "relevance": 11, # Invalid
        "quality": 7,
        "evidence_strength": 6,
        "actionability": 8,
        "executive_readiness": 9,
        "style_alignment": 8,
        "local_context": 7,
        "novelty": 5,
        "evaluator_notes": "Good",
        "overall_score": 7.62,
    }
    with pytest.raises(ValidationError):
        EvaluationOutput(**data)

def test_executive_review_requires_weakness_or_missing_evidence():
    data = {
        "reviewed_task_title": "T",
        "overall_assessment": "O",
        "strongest_points": ["S"],
        "weakest_points": [], # Missing
        "missing_evidence": [], # Missing
        "challenge_questions": ["C"],
        "executive_readiness_score": 5,
        "recommendation": "R",
        "required_revisions": ["R"],
    }
    with pytest.raises(ValidationError, match="Must include at least one weakness or missing evidence"):
        ExecutiveReviewOutput(**data)
        
    data["weakest_points"] = ["W"]
    obj = ExecutiveReviewOutput(**data)
    assert obj.weakest_points == ["W"]
    
def test_strategy_manager_valid_output():
    data = {
        "task_title": "T",
        "strategic_question": "S",
        "market_context": "M",
        "competitor_insights": ["C"],
        "strategic_options": ["O"],
        "recommended_position": "R",
        "risks": ["R"],
        "assumptions": ["A"],
        "decision_needed": "D",
        "next_actions": ["N"],
        "evidence_refs": ["E"],
        "confidence_score": 0.8,
    }
    obj = StrategyManagerOutput(**data)
    assert obj.task_title == "T"
