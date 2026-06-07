from pydantic import BaseModel, Field, model_validator
from typing import List

class ProductManagerOutput(BaseModel):
    task_title: str
    product_problem: str
    target_users: List[str]
    user_needs: List[str]
    product_recommendation: str
    success_metrics: List[str]
    risks: List[str]
    assumptions: List[str]
    next_actions: List[str]
    evidence_refs: List[str] = Field(default_factory=list)
    confidence_score: float = Field(ge=0, le=1)

class StrategyManagerOutput(BaseModel):
    task_title: str
    strategic_question: str
    market_context: str
    competitor_insights: List[str]
    strategic_options: List[str]
    recommended_position: str
    risks: List[str]
    assumptions: List[str]
    decision_needed: str
    next_actions: List[str]
    evidence_refs: List[str] = Field(default_factory=list)
    confidence_score: float = Field(ge=0, le=1)

class ExecutiveReviewOutput(BaseModel):
    reviewed_task_title: str
    overall_assessment: str
    strongest_points: List[str]
    weakest_points: List[str] = Field(default_factory=list)
    missing_evidence: List[str] = Field(default_factory=list)
    challenge_questions: List[str]
    executive_readiness_score: int = Field(ge=1, le=10)
    recommendation: str
    required_revisions: List[str]

    @model_validator(mode="after")
    def validate_weaknesses_or_evidence(self):
        if not self.weakest_points and not self.missing_evidence:
            raise ValueError("Must include at least one weakness or missing evidence item")
        return self

class EvaluationOutput(BaseModel):
    relevance: int = Field(ge=1, le=10)
    quality: int = Field(ge=1, le=10)
    evidence_strength: int = Field(ge=1, le=10)
    actionability: int = Field(ge=1, le=10)
    executive_readiness: int = Field(ge=1, le=10)
    style_alignment: int = Field(ge=1, le=10)
    local_context: int = Field(ge=1, le=10)
    novelty: int = Field(ge=1, le=10)
    overall_score: float
    evaluator_notes: str

    @model_validator(mode="after")
    def validate_average(self):
        values = [
            self.relevance,
            self.quality,
            self.evidence_strength,
            self.actionability,
            self.executive_readiness,
            self.style_alignment,
            self.local_context,
            self.novelty,
        ]
        expected = round(sum(values) / len(values), 2)
        if round(self.overall_score, 2) != expected:
            raise ValueError("overall_score must equal average of dimensions")
        return self

class EmailDraftOutput(BaseModel):
    subject: str
    recipients: list[str]
    cc: list[str] = Field(default_factory=list)
    body: str
    tone: str
    purpose: str
    risk_notes: list[str]
    approval_summary: str
    follow_up_task_suggestion: str | None = None

    @model_validator(mode="after")
    def validate_body_not_empty(self):
        if not self.body.strip():
            raise ValueError("Body cannot be empty")
        return self

class HousekeepingDocumentStatus(BaseModel):
    filename: str
    title: str
    doc_type: str
    status: str
    issues: list[str] = Field(default_factory=list)

class HousekeepingOutput(BaseModel):
    task_title: str
    summary: str
    verified_documents: list[HousekeepingDocumentStatus]
    system_health_status: str
    next_actions: list[str] = Field(default_factory=list)
    evidence_refs: list[str] = Field(default_factory=list)

