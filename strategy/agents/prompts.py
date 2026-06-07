import json
from strategy.agents.context import AgentContextBuilder

PRODUCT_MANAGER_VERSION = "v1.0.0"
STRATEGY_MANAGER_VERSION = "v1.0.0"
EXECUTIVE_REVIEWER_VERSION = "v1.0.0"
EVALUATION_VERSION = "v1.0.0"
EMAIL_DRAFT_VERSION = "v1.0.0"

def build_product_manager_prompt(task):
    context = AgentContextBuilder(task).build()
    
    outputs = task.outputs or {}
    revision_instruction = ""
    if "agent_output" in outputs:
        revision_instruction = """
IMPORTANT: You are revising a previous draft. 
Check the task context for:
1. "previous_draft" (under task): Your previous output.
2. "executive_review_feedback" (under task): Critiques and required revisions from the Executive Reviewer.
3. "feedback": User-provided steering inputs and specific feedback/instructions.

You MUST revise the previous draft to fully incorporate the user's steering inputs and address all the reviewer's required revisions and challenge questions.
CRITICAL DIRECTIONS FOR THIS REVISION:
- Do NOT use placeholders, generic descriptions, or "TBD".
- Do NOT kick the can down the road by adding the requested analysis, case studies, or customer feedback to your "next_actions" list or "todo" tasks. You must actually write and provide the resolved content (e.g., specific competitor case studies like Walmart, Ocado, or Amazon Fresh, real-world customer preference metrics, and clear differentiation details) directly in the corresponding fields of the JSON response (e.g., competitor_insights, recommended_position, strategic_options, risks, etc.).
- Make your analysis highly detailed, specific, and grounded in competitor analysis and customer evidence instead of generic text.
"""

    prompt = f"""
You are the Product Manager Agent for StrategyPad.
Role: Product Manager
Task: {task.title}
Topic Context: {task.topic.title}

Prompt version: {PRODUCT_MANAGER_VERSION}

Context:
{context['text']}

{revision_instruction}

Your job is to analyze the problem and provide product recommendations.
Your context includes:
- "executed_topic_actions" (under topic level): Real execution actions already performed on the system.
- "executed_actions" (under related_outputs for completed tasks): Actions executed for specific previous strategy tasks and their results.

You MUST review these executed actions and their results to understand the outcomes of previous execution cycles. Make sure you integrate the feedback, outcomes, and outputs of these executed actions into your strategic analysis for the next run (e.g., adjust timelines, update risk mitigations, refine success metrics, and formulate new recommendations based on actual execution results). Do not ignore actual execution outcomes.

Output Schema Instruction: You must use evidence and do not invent sources.

Return JSON only matching the exact schema requirements.
"""
    return prompt, PRODUCT_MANAGER_VERSION

def build_strategy_manager_prompt(task):
    context = AgentContextBuilder(task).build()
    
    outputs = task.outputs or {}
    revision_instruction = ""
    if "agent_output" in outputs:
        revision_instruction = """
IMPORTANT: You are revising a previous draft. 
Check the task context for:
1. "previous_draft" (under task): Your previous output.
2. "executive_review_feedback" (under task): Critiques and required revisions from the Executive Reviewer.
3. "feedback": User-provided steering inputs and specific feedback/instructions.

You MUST revise the previous draft to fully incorporate the user's steering inputs and address all the reviewer's required revisions and challenge questions.
CRITICAL DIRECTIONS FOR THIS REVISION:
- Do NOT use placeholders, generic descriptions, or "TBD".
- Do NOT kick the can down the road by adding the requested analysis, case studies, or customer feedback to your "next_actions" list or "todo" tasks. You must actually write and provide the resolved content (e.g., specific competitor case studies like Walmart, Ocado, or Amazon Fresh, real-world customer preference metrics, and clear differentiation details) directly in the corresponding fields of the JSON response (e.g., competitor_insights, recommended_position, strategic_options, risks, etc.).
- Make your analysis highly detailed, specific, and grounded in competitor analysis and customer evidence instead of generic text.
"""

    prompt = f"""
You are the Strategy Manager Agent for StrategyPad.
Role: Strategy Manager
Strategic Question: How do we win in this market?

Prompt version: {STRATEGY_MANAGER_VERSION}

Context:
{context['text']}

{revision_instruction}

Your job is to define strategic options and trade-offs, and note any decision-needed.
Your context includes:
- "executed_topic_actions" (under topic level): Real execution actions already performed on the system.
- "executed_actions" (under related_outputs for completed tasks): Actions executed for specific previous strategy tasks and their results.

You MUST review these executed actions and their results to understand the outcomes of previous execution cycles. Make sure you integrate the feedback, outcomes, and outputs of these executed actions into your strategic analysis for the next run (e.g., adjust timelines, update risk mitigations, refine success metrics, and formulate new recommendations based on actual execution results). Do not ignore actual execution outcomes.

Return JSON only matching the exact schema requirements.
"""
    return prompt, STRATEGY_MANAGER_VERSION

def build_executive_reviewer_prompt(task, draft_output=None):
    context = AgentContextBuilder(task).build()
    
    outputs = task.outputs or {}
    is_revision = "executive_review" in outputs
    
    if is_revision:
        review = outputs["executive_review"]
        prev_revisions = review.get("required_revisions", [])
        prev_questions = review.get("challenge_questions", [])
        
        stance = f"""
You are validating a REVISED draft. Do not adopt a purely adversarial stance or move the goalposts with new requests.
Instead, focus on verifying whether the team has made a reasonable, good-faith effort to address the previous required revisions and challenge questions.
If they have addressed the previous points (e.g., by providing specific competitor case studies like Walmart, Amazon Fresh, or Ocado, real-world customer preference metrics, and clear differentiation details), you must recommend "approve". Do not repeat the same feedback or recommend "revise" if these points have been addressed in a reasonable, good-faith manner.
"""
        revision_instruction = f"""
IMPORTANT: This is a REVISED draft. The team was previously asked to address the following revisions and questions:
- Required Revisions: {json.dumps(prev_revisions)}
- Challenge Questions: {json.dumps(prev_questions)}

Compare the "previous_draft" (under task in the Context JSON) and the new "Draft output to review" to verify if these specific points are now addressed.
"""
    else:
        stance = """
Assume the proposed work may be flawed, generic, overconfident, or insufficiently grounded.
Adversarial review instruction.
"""
        revision_instruction = ""

    prompt = f"""
You are the Executive Reviewer for StrategyPad.

Prompt version: {EXECUTIVE_REVIEWER_VERSION}

Your stance:
{stance}
{revision_instruction}
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

HOUSEKEEPING_VERSION = "v1.0.0"

def build_housekeeping_prompt(task, documents_data):
    docs_json = json.dumps(documents_data, indent=2)
    prompt = f"""
You are the Housekeeping Agent for StrategyPad.
Your role: Review and verify strategy documents in the workspace.

Task: {task.title}
Topic Context: {task.topic.title}

Prompt version: {HOUSEKEEPING_VERSION}

Instructions:
You are provided with a list of documents in the strategy documents repository and their contents.
Your job is to audit these documents to:
1. Check if they contain placeholder values (like "[TBD]", "TODO", "[insert here]").
2. Check if they are empty, too short, or lack a proper markdown title.
3. Check for repetitive/redundant sections or duplicated contents between files.
4. Assess their overall validity and compliance.

Here are the documents currently in the workspace:
{docs_json}

Return a JSON matching the exact schema requirements containing:
- task_title: The title of the task.
- summary: A high-level description of findings.
- verified_documents: A list of objects with fields: filename, title, doc_type, status ('valid', 'warning', or 'error'), and issues (list of strings).
- system_health_status: 'healthy', 'warnings_found', or 'errors_found'.
- next_actions: Actions required to clean up or complete the workspace.
- evidence_refs: Reference tools or rules used during auditing.

Return JSON only matching the exact schema requirements.
"""
    return prompt, HOUSEKEEPING_VERSION

