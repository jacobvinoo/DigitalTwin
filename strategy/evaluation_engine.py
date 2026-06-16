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
    root_cause_diagnosis: str = Field(..., description="The detected root cause underlying the low score (e.g. 'no sources retrieved', 'weak source diversity')")
    recommendation: str = Field(..., description="Actionable fix recommendation (e.g. 'add Source Recording prompt', 'require Evidence Table output schema')")
    target_area: str = Field(..., description="One of: 'prompt', 'memory', 'rag_sources', 'output_schema', 'tooling', 'workflow', 'human_instruction'")

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
                schema_to_pass = et.scoring_schema.get('output_schema') if 'output_schema' in et.scoring_schema else et.scoring_schema
                eval_res = llm.execute(
                    prompt=eval_prompt,
                    prompt_version=str(et.version),
                    schema_dict=schema_to_pass,
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
    from django.conf import settings
    # Weights for specific evaluation categories
    weights = getattr(settings, 'EVALUATION_CATEGORY_WEIGHTS', {})
    
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
        cat = str(low.get("category", "")).lower()
        score_val = low.get("score", 0)
        
        # Calculate recurrence count
        recent_histories = AgentEvaluationHistory.objects.filter(agent=agent).order_by('-created_at')[:20]
        recurring_count = 1
        for h in recent_histories:
            if cat == "evidence" and h.evidence_score > 0 and h.evidence_score < 7: recurring_count += 1
            elif (cat == "safety" or cat == "hallucination") and h.hallucination_score > 0 and h.hallucination_score < 7: recurring_count += 1
            elif cat == "executive" and h.executive_score > 0 and h.executive_score < 7: recurring_count += 1
            elif cat == "quality" and h.quality_score > 0 and h.quality_score < 7: recurring_count += 1

        severity = max(0, 7 - score_val)
        confidence_score = min(10.0, (recurring_count * 0.5) + severity)

        if cat == "evidence":
            root_cause = "- no sources retrieved\n- weak source diversity\n- claims not mapped to evidence"
            rec_text = "- add Source Recording prompt\n- require Evidence Table output schema\n- add minimum source threshold"
            target = "rag_sources"
        elif cat == "safety" or cat == "hallucination":
            root_cause = "- unsupported claims\n- facts hallucinated outside of RAG context"
            rec_text = "- add Hallucination Avoidance prompt\n- require Fact Validation step"
            target = "prompt"
        elif cat == "executive":
            root_cause = "- response lacks top-down clarity\n- too in the weeds"
            rec_text = "- add Decision Framing prompt\n- require Executive Summary output schema"
            target = "output_schema"
        elif cat == "quality":
            root_cause = "- poor formatting and structure"
            rec_text = "- add Structured Document Writer prompt"
            target = "prompt"
        else:
            try:
                imp_prompt = f"The agent {agent.name} received a low score ({score_val}) for {low.get('evaluator')}. Feedback: {low.get('feedback')}. Please diagnose the root cause and provide a specific recommendation."
                imp_res = llm.execute(prompt=imp_prompt, prompt_version="1.0", schema_class=ImprovementRecommendationSchema, model="gpt-4o-mini")
                
                if isinstance(imp_res.data, dict):
                    root_cause = imp_res.data.get("root_cause_diagnosis", "Unknown root cause")
                    rec_text = imp_res.data.get("recommendation", f"Address: {low.get('feedback')}")
                    target = imp_res.data.get("target_area", "prompt")
                else:
                    root_cause = imp_res.data.root_cause_diagnosis
                    rec_text = imp_res.data.recommendation
                    target = imp_res.data.target_area
            except Exception:
                root_cause = "Unknown root cause"
                rec_text = f"Improve system prompt to address: {low.get('feedback')}"
                target = "prompt"
            
        AgentImprovementRecommendation.objects.create(
            agent=agent,
            execution_version=execution_version,
            agent_trace=agent_trace,
            issue_type=low.get("evaluator", "General"),
            source_evaluation=str(low),
            root_cause_diagnosis=root_cause,
            problem=low.get("feedback", "No feedback"),
            recommended_change=rec_text,
            target_area=target,
            confidence_score=confidence_score,
            recurring_count=recurring_count,
            status="proposed"
        )
        
    # Update running experiments
    from .models import AgentImprovementExperiment
    active_experiments = AgentImprovementExperiment.objects.filter(agent=agent, status="monitoring")
    for exp in active_experiments:
        exp.runs_observed += 1
        
        # Calculate new moving average
        recent_histories = AgentEvaluationHistory.objects.filter(agent=agent).order_by('-created_at')[:exp.runs_observed]
        if recent_histories.exists():
            exp.post_change_score = sum(h.overall_score for h in recent_histories) / recent_histories.count()
            exp.delta = exp.post_change_score - exp.baseline_score
            
            # After 5 runs, lock in success or failure
            if exp.runs_observed >= 5:
                if exp.delta >= 0.5:
                    exp.status = "successful"
                elif exp.delta <= -0.5:
                    exp.status = "failed"
                    # We do not automatically rollback, but flag it as failed
        exp.save()

    return evaluations
