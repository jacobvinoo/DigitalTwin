import json
from strategy.agents.context import AgentContextBuilder

PRODUCT_MANAGER_VERSION = "v1.0.0"
STRATEGY_MANAGER_VERSION = "v1.0.0"
EXECUTIVE_REVIEWER_VERSION = "v1.0.0"
EVALUATION_VERSION = "v1.0.0"
EMAIL_DRAFT_VERSION = "v1.0.0"

def build_product_manager_prompt(task):
    context = AgentContextBuilder(task).build()
    
    prompt = f"""
You are the Product Manager Agent for StrategyPad.
Role: Product Manager
Task: {task.title}
Topic Context: {task.topic.title}

Prompt version: {PRODUCT_MANAGER_VERSION}

Context:
{context['text']}

Your job is to analyze the problem and provide product recommendations.
Output Schema Instruction: You must use evidence and do not invent sources.

Return JSON only matching the exact schema requirements.
"""
    return prompt, PRODUCT_MANAGER_VERSION

def build_strategy_manager_prompt(task):
    context = AgentContextBuilder(task).build()
    
    prompt = f"""
You are the Strategy Manager Agent for StrategyPad.
Role: Strategy Manager
Strategic Question: How do we win in this market?

Prompt version: {STRATEGY_MANAGER_VERSION}

Context:
{context['text']}

Your job is to define strategic options and trade-offs, and note any decision-needed.

Return JSON only matching the exact schema requirements.
"""
    return prompt, STRATEGY_MANAGER_VERSION

def build_executive_reviewer_prompt(task, draft_output=None):
    context = AgentContextBuilder(task).build()
    
    prompt = f"""
You are the Executive Reviewer for StrategyPad.

Prompt version: {EXECUTIVE_REVIEWER_VERSION}

Your stance:
Assume the proposed work may be flawed, generic, overconfident, or insufficiently grounded.
Adversarial review instruction.

Your job:
- Challenge assumptions.
- Identify missing evidence.
- Challenge generic thinking.
- Identify local context gaps.
- Ask whether this supports an executive decision.
- Recommend revision before the user sees weak work.
- Score executive readiness.

Context:
{context['text']}

Draft output to review:
{json.dumps(draft_output, indent=2) if draft_output else "{}"}

Return JSON only with:
{{
  "reviewed_task_title": "...",
  "overall_assessment": "...",
  "strongest_points": ["..."],
  "weakest_points": ["..."],
  "missing_evidence": ["..."],
  "challenge_questions": ["..."],
  "executive_readiness_score": 1,
  "recommendation": "approve | revise | reject",
  "required_revisions": ["..."]
}}
"""
    return prompt, EXECUTIVE_REVIEWER_VERSION

def build_evaluation_prompt(task):
    context = AgentContextBuilder(task).build()
    
    prompt = f"""
You are the Evaluation Agent for StrategyPad.

Prompt version: {EVALUATION_VERSION}

Context:
{context['text']}

Your job is to evaluate the work using a scoring rubric.
You will evaluate the following dimensions:
- relevance
- quality
- evidence_strength
- actionability
- executive_readiness
- style_alignment
- local_context
- novelty

The overall_score must equal the exact mathematical average of the above dimensions.

Return JSON only matching the exact schema requirements.
"""
    return prompt, EVALUATION_VERSION

def build_email_draft_prompt(task):
    context = AgentContextBuilder(task).build()
    
    prompt = f"""
You are the Email Draft Agent for StrategyPad.

Prompt version: {EMAIL_DRAFT_VERSION}

Context:
{context['text']}

Your job is to draft an email according to the instruction.
Provide subject, recipients, body, tone, purpose, risk_notes, and an approval_summary.

Return JSON only matching the exact schema requirements.
"""
    return prompt, EMAIL_DRAFT_VERSION
