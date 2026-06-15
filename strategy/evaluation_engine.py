import json
from pydantic import BaseModel, Field

from .models import (
    EvaluationAssignment,
    EvaluationRun,
    AgentEvaluationHistory,
    AgentImprovementRecommendation
)
from .chain_engine import get_llm_client

class EvaluationResultSchema(BaseModel):
    score: int = Field(..., description="A score from 1 to 10")
    feedback: str = Field(..., description="Brief feedback explaining the score")

class ImprovementRecommendationSchema(BaseModel):
    recommendation: str = Field(..., description="Concrete, actionable rule to append to the system prompt.")

def run_post_agent_evaluation(agent_trace):
    """
    1. Load enabled EvaluationAssignment records for agent_trace.agent.
    2. Run each EvaluationTemplate against the trace output.
    3. Create EvaluationRun.
    4. Calculate aggregate scores.
    5. Create AgentEvaluationHistory.
    6. Generate AgentImprovementRecommendation for weak scores.
    7. Return evaluations summary.
    """
    agent = agent_trace.agent
    execution_version = agent_trace.execution_version
    output_payload_dict = agent_trace.output_payload or {}
    
    evaluations = []
    eval_assignments = EvaluationAssignment.objects.filter(agent=agent, enabled=True).order_by('sort_order')
    
    if not eval_assignments.exists():
        return evaluations

    llm = get_llm_client()

    for eval_assignment in eval_assignments:
        et = eval_assignment.evaluation_template
        
        eval_prompt = (
            f"You are an evaluator grading an agent's output.\n\n"
            f"Rubric/Instructions:\n{et.evaluation_prompt}\n\n"
            f"Agent Output to Evaluate:\n{json.dumps(output_payload_dict, indent=2)}"
        )
        
        try:
            if et.scoring_schema:
                eval_res = llm.execute(
                    prompt=eval_prompt,
                    prompt_version=str(et.version),
                    schema_dict=et.scoring_schema,
                    model="gpt-4o"
                )
            else:
                eval_res = llm.execute(
                    prompt=eval_prompt,
                    prompt_version=str(et.version),
                    schema_class=EvaluationResultSchema,
                    model="gpt-4o"
                )
            
            eval_data = eval_res.data
            if isinstance(eval_data, dict):
                score_key = et.score_field if et.score_field else "score"
                if score_key in eval_data:
                    score = eval_data.get(score_key)
                else:
                    raise ValueError(f"Output schema missing configured score_field '{score_key}'")
                
                feedback = eval_data.get("feedback", "No direct feedback key.")
                rich_output = eval_data
            else:
                score = getattr(eval_data, "score", 0)
                feedback = getattr(eval_data, "feedback", "No feedback provided.")
                rich_output = {"score": score, "feedback": feedback}
            
            eval_dict = {
                "evaluator": et.name,
                "category": getattr(et, "category", "custom"),
                "score": score,
                "feedback": feedback,
                "passed": score >= 7,
                "rich_output": rich_output
            }
            evaluations.append(eval_dict)
            
            EvaluationRun.objects.create(
                agent_trace=agent_trace,
                evaluation_template=et,
                result=eval_dict,
                overall_score=score
            )
        except Exception as e:
            evaluations.append({
                "evaluator": et.name,
                "score": 0,
                "feedback": f"Evaluation failed: {str(e)}",
                "passed": False
            })

    # Save evaluations to the trace record
    agent_trace.validation_result = evaluations
    agent_trace.save(update_fields=['validation_result'])
    
    # Calculate aggregates
    # Weights for specific evaluation categories
    weights = {
        "quality": 0.25,
        "evidence": 0.30,
        "executive": 0.20,
        "hallucination": 0.25
    }
    
    total_weight = 0
    weighted_sum = 0
    fallback_sum = 0
    fallback_count = 0
    
    for e in evaluations:
        cat = e.get("category", "")
        sc = e.get("score", 0)
        
        # We try to match the category closely.
        weight = weights.get(cat, None)
        
        # If the template's category wasn't explicitly one of these, we can fallback to matching the evaluator name
        if weight is None:
            eval_name = str(e.get("evaluator", "")).lower()
            if "quality" in eval_name: weight = 0.25
            elif "evidence" in eval_name: weight = 0.30
            elif "executive" in eval_name: weight = 0.20
            elif "hallucination" in eval_name: weight = 0.25
            
        if weight is not None:
            total_weight += weight
            weighted_sum += sc * weight
        else:
            fallback_sum += sc
            fallback_count += 1
            
    if total_weight > 0:
        # If there are categories with defined weights, we normalize across only those weights.
        avg_score = weighted_sum / total_weight
    else:
        # If no weighted categories exist, fallback to simple average.
        avg_score = fallback_sum / fallback_count if fallback_count > 0 else 0
        
    # Extract specific scores for the DB model
    quality = next((e.get("score", 0) for e in evaluations if "quality" in str(e.get("category", "")).lower() or "quality" in str(e.get("evaluator", "")).lower()), avg_score)
    evidence = next((e.get("score", 0) for e in evaluations if "evidence" in str(e.get("category", "")).lower() or "evidence" in str(e.get("evaluator", "")).lower()), avg_score)
    executive = next((e.get("score", 0) for e in evaluations if "executive" in str(e.get("category", "")).lower() or "executive" in str(e.get("evaluator", "")).lower()), avg_score)
    hallucination = next((e.get("score", 0) for e in evaluations if "hallucination" in str(e.get("category", "")).lower() or "safety" in str(e.get("category", "")).lower() or "hallucination" in str(e.get("evaluator", "")).lower()), avg_score)
    
    AgentEvaluationHistory.objects.create(
        agent=agent,
        execution_version=execution_version,
        overall_score=avg_score,
        quality_score=quality,
        evidence_score=evidence,
        executive_score=executive,
        hallucination_score=hallucination
    )
    
    # Generate Improvement Recommendations
    low_evals = [e for e in evaluations if e.get("score", 0) < 7]
    for low in low_evals:
        cat = low.get("category", "")
        if cat == "evidence":
            rec_text = "Add Source Recording + Evidence Extraction prompt pack"
        elif cat == "safety" or cat == "hallucination":
            rec_text = "Add Hallucination Avoidance + Fact Validation"
        elif cat == "executive":
            rec_text = "Add Decision Framing + Executive Summary"
        elif cat == "quality":
            rec_text = "Add Structured Document Writer"
        else:
            try:
                imp_prompt = f"The agent {agent.name} received a low score ({low.get('score')}) for {low.get('evaluator')}. Output JSON: {json.dumps(low.get('rich_output', {}))}. Please provide a concrete recommendation to append to the agent's system prompt to fix this issue."
                imp_res = llm.execute(prompt=imp_prompt, prompt_version="1.0", schema_class=ImprovementRecommendationSchema, model="gpt-4o-mini")
                rec_text = imp_res.data.recommendation if not isinstance(imp_res.data, dict) else imp_res.data.get("recommendation", "")
            except Exception:
                rec_text = f"Improve system prompt to address: {low.get('feedback')}"
            
        AgentImprovementRecommendation.objects.create(
            agent=agent,
            execution_version=execution_version,
            agent_trace=agent_trace,
            issue_type=low.get("evaluator", "General"),
            source_evaluation=str(low),
            problem=low.get("feedback", "No feedback"),
            recommended_change=rec_text,
            target_area="prompt",
            status="proposed"
        )

    return evaluations
