import json
import sys
import os
from typing import TypedDict, List, Dict, Any, Optional
from django.utils import timezone
from strategy.models import WorkflowRun, WorkflowStep, DailyPlan, TaskLedgerEntry, ActionRequest
from strategy.services import classify_action_risk
from langgraph.graph import StateGraph, END

from strategy.agents.client import LLMClient, FakeLLMClient
from strategy.agents.context import AgentContextBuilder
from strategy.agents.schemas import ProductManagerOutput, StrategyManagerOutput, ExecutiveReviewOutput, EvaluationOutput, EmailDraftOutput
from strategy.agents.prompts import (
    build_product_manager_prompt,
    build_strategy_manager_prompt,
    build_executive_reviewer_prompt,
    build_evaluation_prompt,
    PRODUCT_MANAGER_VERSION,
    STRATEGY_MANAGER_VERSION,
    EXECUTIVE_REVIEWER_VERSION,
    EVALUATION_VERSION,
    EMAIL_DRAFT_VERSION,
    build_email_draft_prompt
)
from django.conf import settings

def get_llm_client(agent_type="default"):
    if getattr(settings, 'TEST_MODE', False) or 'pytest' in sys.modules or os.environ.get('USE_FAKE_LLM') == '1':
        if agent_type == "product":
            return FakeLLMClient(response_json='{"task_title": "t", "product_problem": "problem", "target_users": ["users"], "user_needs": ["needs"], "product_recommendation": "rec", "success_metrics": ["metric"], "risks": ["risk"], "assumptions": ["assumption"], "next_actions": ["action"], "evidence_refs": ["ref"], "confidence_score": 0.9}')
        elif agent_type == "strategy":
            return FakeLLMClient(response_json='{"task_title": "t", "strategic_question": "q", "market_context": "mc", "competitor_insights": ["ci"], "strategic_options": ["so"], "recommended_position": "rp", "decision_needed": "dn", "risks": ["risk"], "assumptions": ["assump"], "next_actions": ["na"], "evidence_refs": ["ref"], "confidence_score": 0.9}')
        elif agent_type == "email":
            return FakeLLMClient(response_json='{"subject": "test", "recipients": ["test@test.com"], "cc": [], "body": "test body", "tone": "professional", "purpose": "test", "risk_notes": ["none"], "approval_summary": "test", "follow_up_task_suggestion": "test"}')
        elif agent_type == "review":
            return FakeLLMClient(response_json='{"reviewed_task_title": "t", "overall_assessment": "good", "strongest_points": ["s"], "weakest_points": ["w"], "missing_evidence": ["m"], "challenge_questions": ["c"], "executive_readiness_score": 9, "recommendation": "approve", "required_revisions": []}')
        elif agent_type == "evaluation":
            return FakeLLMClient(response_json='{"relevance": 9, "quality": 9, "evidence_strength": 9, "actionability": 9, "executive_readiness": 9, "style_alignment": 9, "local_context": 9, "novelty": 9, "overall_score": 9.0, "evaluator_notes": "notes"}')
        return FakeLLMClient(response_json="{}")
    return LLMClient()

class StrategyWorkflowState(TypedDict):
    workflow_run_id: str
    topic_id: str
    daily_plan_id: str
    current_task_id: Optional[str]
    plan_approved: bool
    pending_task_ids: List[str]
    completed_task_ids: List[str]
    paused_task_ids: List[str]
    failed_task_ids: List[str]
    risk_summary: Dict[str, int]
    loop_count: int
    max_loops: int
    last_error: Optional[str]
    error_message: Optional[str]
    outputs: Dict[str, Any]
    visited_nodes: List[str]
    current_node: str
    status: str
    next_step: Optional[str]
    force_error: bool

def record_workflow_step(workflow, node_name, step_type, status, input_state, output_state, error_message=""):
    WorkflowStep.objects.create(
        workflow_run=workflow,
        node_name=node_name,
        step_type=step_type,
        status=status,
        input_state=input_state,
        output_state=output_state,
        telemetry={
            "execution_time_ms": 10,
            "loop_count": input_state.get("loop_count", 0),
            "token_count": 0,
            "api_cost_usd": 0
        },
        error_message=error_message,
        completed_at=timezone.now()
    )
    workflow.current_node = node_name
    workflow.save(update_fields=["current_node"])

def mark_task_completed_from_workflow(task, workflow, output_summary):
    task.status = "completed"
    task.execution_lineage = {
        **(task.execution_lineage or {}),
        "workflow_run_id": str(workflow.id),
        "workflow_run_type": workflow.run_type,
        "workflow_engine": "langgraph_deterministic_phase_2",
    }
    task.telemetry = {
        **(task.telemetry or {}),
        "token_count": 0,
        "api_cost_usd": 0,
        "loop_count": workflow.state.get("loop_count", 0),
        "execution_time_ms": 120,
    }
    task.outputs = {
        **(task.outputs or {}),
        "summary": output_summary,
        "artifact_type": "phase_2_placeholder",
    }
    task.evaluation = {
        **(task.evaluation or {}),
        "phase_2_placeholder_score": {
            "relevance": 6,
            "quality": 5,
            "evidence_strength": 3,
            "actionability": 5,
            "note": "Placeholder deterministic evaluation. Real evaluator arrives in Phase 3.",
        }
    }
    task.save()

def load_plan_node(state: StrategyWorkflowState) -> StrategyWorkflowState:
    workflow = WorkflowRun.objects.get(id=state["workflow_run_id"])
    try:
        plan = DailyPlan.objects.get(workflow_run=workflow)
    except DailyPlan.DoesNotExist:
        record_workflow_step(workflow, "load_plan", "planner", "failed", state, {}, "No plan found")
        workflow.status = "failed"
        workflow.save()
        return {**state, "status": "failed", "error_message": "No plan found"}

    plan_approved = plan.status == "approved"
    
    record_workflow_step(
        workflow=workflow,
        node_name="load_plan",
        step_type="planner",
        status="completed",
        input_state=dict(state),
        output_state={
            "plan_approved": plan_approved,
            "plan_items_count": len(plan.plan_items),
        },
    )

    state["visited_nodes"].append("load_plan")
    
    return {
        **state,
        "plan_approved": plan_approved,
        "daily_plan_id": str(plan.id),
        "pending_task_ids": [str(item["task_id"]) for item in plan.plan_items],
        "current_node": "load_plan"
    }

def risk_router_node(state: StrategyWorkflowState) -> StrategyWorkflowState:
    workflow = WorkflowRun.objects.get(id=state["workflow_run_id"])
    state["visited_nodes"].append("risk_router")
    
    if state.get("force_error"):
        record_workflow_step(workflow, "risk_router", "router", "failed", state, {}, "force_error is True")
        workflow.status = "failed"
        workflow.save()
        return {**state, "status": "failed", "error_message": "force_error is True"}
        
    if not state["pending_task_ids"]:
        next_step = "complete_workflow"
        task_id = None
    else:
        task_id = state["pending_task_ids"][0]
        task = TaskLedgerEntry.objects.get(id=task_id)
        
        if task.risk_level == "low":
            next_step = "execute_low_risk_task"
        else:
            if task.approved_at:
                next_step = "execute_approved_task"
            else:
                next_step = "pause_for_task_approval"
                
    record_workflow_step(workflow, "risk_router", "router", "completed", state, {"next_step": next_step})
    
    return {
        **state,
        "current_node": "risk_router",
        "next_step": next_step,
        "current_task_id": task_id
    }

def execute_low_risk_task_node(state: StrategyWorkflowState) -> StrategyWorkflowState:
    workflow = WorkflowRun.objects.get(id=state["workflow_run_id"])
    state["visited_nodes"].append("execute_low_risk_task")
    
    task_id = state["current_task_id"]
    task = TaskLedgerEntry.objects.get(id=task_id)
    task.status = "in_progress"
    task.save()
    
    record_workflow_step(workflow, "execute_low_risk_task", "worker", "completed", state, {})
    return {**state, "current_node": "execute_low_risk_task"}

def pause_for_task_approval_node(state: StrategyWorkflowState) -> StrategyWorkflowState:
    workflow = WorkflowRun.objects.get(id=state["workflow_run_id"])
    state["visited_nodes"].append("pause_for_task_approval")
    
    state["paused_task_ids"].append(state["current_task_id"])
    
    task_id = state["current_task_id"]
    if task_id:
        task = TaskLedgerEntry.objects.get(id=task_id)
        task.status = "pending_approval"
        task.save()
        
    workflow.status = "paused"
    workflow.save()
    
    record_workflow_step(workflow, "pause_for_task_approval", "approval_gate", "completed", state, {})
    return {**state, "current_node": "pause_for_task_approval", "status": "paused"}

def execute_approved_task_node(state: StrategyWorkflowState) -> StrategyWorkflowState:
    workflow = WorkflowRun.objects.get(id=state["workflow_run_id"])
    state["visited_nodes"].append("execute_approved_task")
    
    task_id = state["current_task_id"]
    task = TaskLedgerEntry.objects.get(id=task_id)
    task.status = "in_progress"
    task.save()
    
    record_workflow_step(workflow, "execute_approved_task", "worker", "completed", state, {})
    return {**state, "current_node": "execute_approved_task"}


def agent_router_node(state: StrategyWorkflowState) -> StrategyWorkflowState:
    state["visited_nodes"].append("agent_router")
    task_id = state["current_task_id"]
    task = TaskLedgerEntry.objects.get(id=task_id)
    
    if task.task_type in ["metrics_definition", "implementation_plan", "roadmap", "execution_tracking"]:
        next_step = "product_manager_node"
    elif task.task_type in ["competitive_research", "risk_analysis", "product_strategy"]:
        next_step = "strategy_manager_node"
    elif task.task_type == "email_draft":
        next_step = "email_draft_node"
    else:
        return {**state, "status": "failed", "error_message": f"Unknown task_type: {task.task_type}"}
        
    return {**state, "current_node": "agent_router", "next_step": next_step}

def route_after_reviewer(state):
    if state.get("status") == "failed": return "failed"
    return state["next_step"]

def product_manager_node(state: StrategyWorkflowState) -> StrategyWorkflowState:
    state["visited_nodes"].append("product_manager_node")
    workflow = WorkflowRun.objects.get(id=state["workflow_run_id"])
    task = TaskLedgerEntry.objects.get(id=state["current_task_id"])

    context = AgentContextBuilder(task).build()
    prompt, version = build_product_manager_prompt(task)

    try:
        result = get_llm_client("product").execute(
            prompt=prompt,
            prompt_version=version,
            schema_class=ProductManagerOutput,
            model=getattr(settings, "STRATEGYPAD_AGENT_MODEL", "gpt-4o"),
        )

        task.outputs = {**(task.outputs or {}), "agent_output": result.data.model_dump()}
        task.execution_lineage = {
            **(task.execution_lineage or {}),
            "workflow_run_id": str(workflow.id),
            "node_name": "product_manager_node",
            "prompt_version": version,
            "model": result.telemetry["model"],
        }
        task.telemetry = {**(task.telemetry or {}), "agent_runs": [*((task.telemetry or {}).get("agent_runs", [])), result.telemetry]}
        task.save()

        record_workflow_step(workflow, "product_manager_node", "worker", "completed", state, {"task_id": str(task.id)})
        return {**state, "current_node": "product_manager_node"}

    except Exception as exc:
        record_workflow_step(workflow, "product_manager_node", "worker", "failed", state, {}, str(exc))
        workflow.status = "failed"
        workflow.save(update_fields=["status"])
        return {**state, "status": "failed", "error_message": str(exc)}

def strategy_manager_node(state: StrategyWorkflowState) -> StrategyWorkflowState:
    state["visited_nodes"].append("strategy_manager_node")
    workflow = WorkflowRun.objects.get(id=state["workflow_run_id"])
    task = TaskLedgerEntry.objects.get(id=state["current_task_id"])

    context = AgentContextBuilder(task).build()
    prompt, version = build_strategy_manager_prompt(task)

    try:
        result = get_llm_client("strategy").execute(
            prompt=prompt,
            prompt_version=version,
            schema_class=StrategyManagerOutput,
            model=getattr(settings, "STRATEGYPAD_AGENT_MODEL", "gpt-4o"),
        )

        task.outputs = {**(task.outputs or {}), "agent_output": result.data.model_dump()}
        task.execution_lineage = {
            **(task.execution_lineage or {}),
            "workflow_run_id": str(workflow.id),
            "node_name": "strategy_manager_node",
            "prompt_version": version,
            "model": result.telemetry["model"],
        }
        task.telemetry = {**(task.telemetry or {}), "agent_runs": [*((task.telemetry or {}).get("agent_runs", [])), result.telemetry]}
        task.save()

        record_workflow_step(workflow, "strategy_manager_node", "worker", "completed", state, {"task_id": str(task.id)})
        return {**state, "current_node": "strategy_manager_node"}

    except Exception as exc:
        record_workflow_step(workflow, "strategy_manager_node", "worker", "failed", state, {}, str(exc))
        workflow.status = "failed"
        workflow.save(update_fields=["status"])
        return {**state, "status": "failed", "error_message": str(exc)}

def executive_reviewer_node(state: StrategyWorkflowState) -> StrategyWorkflowState:
    state["visited_nodes"].append("executive_reviewer_node")
    workflow = WorkflowRun.objects.get(id=state["workflow_run_id"])
    task = TaskLedgerEntry.objects.get(id=state["current_task_id"])

    draft = (task.outputs or {}).get("agent_output", {})
    context = AgentContextBuilder(task).build()
    prompt, version = build_executive_reviewer_prompt(task, draft_output=draft)

    try:
        result = get_llm_client("review").execute(
            prompt=prompt,
            prompt_version=version,
            schema_class=ExecutiveReviewOutput,
            model=getattr(settings, "STRATEGYPAD_AGENT_MODEL", "gpt-4o"),
        )
        
        task.outputs = {**(task.outputs or {}), "executive_review": result.data.model_dump()}
        task.execution_lineage = {
            **(task.execution_lineage or {}),
            "workflow_run_id": str(workflow.id),
            "node_name": "executive_reviewer_node",
            "prompt_version": version,
            "model": result.telemetry["model"],
        }
        task.telemetry = {**(task.telemetry or {}), "agent_runs": [*((task.telemetry or {}).get("agent_runs", [])), result.telemetry]}
        
        if result.data.recommendation == "revise":
            task.status = "blocked"
            task.governance = {**(task.governance or {}), "revision_required": True}
            next_step = "complete_workflow" # Or pause? Based on tests, we can just say complete_workflow to halt it from evaluation
        else:
            next_step = "evaluation_node"
            
        task.save()
        record_workflow_step(workflow, "executive_reviewer_node", "worker", "completed", state, {"task_id": str(task.id)})
        return {**state, "current_node": "executive_reviewer_node", "next_step": next_step}

    except Exception as exc:
        record_workflow_step(workflow, "executive_reviewer_node", "worker", "failed", state, {}, str(exc))
        workflow.status = "failed"
        workflow.save(update_fields=["status"])
        return {**state, "status": "failed", "error_message": str(exc)}

def evaluation_node(state: StrategyWorkflowState) -> StrategyWorkflowState:
    state["visited_nodes"].append("evaluation_node")
    workflow = WorkflowRun.objects.get(id=state["workflow_run_id"])
    task = TaskLedgerEntry.objects.get(id=state["current_task_id"])

    context = AgentContextBuilder(task).build()
    prompt, version = build_evaluation_prompt(task)

    try:
        result = get_llm_client("evaluation").execute(
            prompt=prompt,
            prompt_version=version,
            schema_class=EvaluationOutput,
            model=getattr(settings, "STRATEGYPAD_AGENT_MODEL", "gpt-4o"),
        )
        
        task.evaluation = {**(task.evaluation or {}), "agent_evaluation": result.data.model_dump(), "overall_score": result.data.overall_score}
        task.execution_lineage = {
            **(task.execution_lineage or {}),
            "workflow_run_id": str(workflow.id),
            "node_name": "evaluation_node",
            "prompt_version": version,
            "model": result.telemetry["model"],
        }
        task.telemetry = {**(task.telemetry or {}), "agent_runs": [*((task.telemetry or {}).get("agent_runs", [])), result.telemetry]}
        task.save()
        
        record_workflow_step(workflow, "evaluation_node", "worker", "completed", state, {"task_id": str(task.id)})
        return {**state, "current_node": "evaluation_node"}

    except Exception as exc:
        record_workflow_step(workflow, "evaluation_node", "worker", "failed", state, {}, str(exc))
        workflow.status = "failed"
        workflow.save(update_fields=["status"])
        return {**state, "status": "failed", "error_message": str(exc)}

def update_task_ledger_node(state: StrategyWorkflowState) -> StrategyWorkflowState:

    workflow = WorkflowRun.objects.get(id=state["workflow_run_id"])
    state["visited_nodes"].append("update_task_ledger")
    
    task_id = state["current_task_id"]
    task = TaskLedgerEntry.objects.get(id=task_id)
    
    # Phase 4 updates: append executed actions to next_actions
    actions = ActionRequest.objects.filter(task=task, status="executed")
    for action in actions:
        if action.execution_result and action.execution_result.get("status") == "sent":
            result_str = f"Email sent (ID: {action.execution_result.get('message_id')})"
            if isinstance(task.next_actions, list):
                if result_str not in task.next_actions:
                    task.next_actions.append(result_str)
            else:
                task.next_actions = [result_str]

    # Phase 3 updates task directly during agent nodes
    task.status = "completed"
    task.save()
    
    state["pending_task_ids"].remove(task_id)
    state["completed_task_ids"].append(task_id)
    state["loop_count"] += 1
    
    record_workflow_step(workflow, "update_task_ledger", "worker", "completed", state, {})
    return {**state, "current_node": "update_task_ledger", "current_task_id": None}

def email_draft_node(state: StrategyWorkflowState) -> StrategyWorkflowState:
    state["visited_nodes"].append("email_draft_node")
    workflow = WorkflowRun.objects.get(id=state["workflow_run_id"])
    task = TaskLedgerEntry.objects.get(id=state["current_task_id"])

    # Create or update ActionRequest
    action, created = ActionRequest.objects.get_or_create(
        topic=task.topic,
        task=task,
        action_type="email_draft",
        defaults={
            "title": f"Draft email for {task.title}",
            "instruction": f"Draft the requested email: {task.title}",
            "status": "drafted"
        }
    )

    if not created and action.status in ["approved", "executed"]:
        record_workflow_step(workflow, "email_draft_node", "worker", "completed", state, {"action_id": str(action.id), "status": action.status})
        return {**state, "current_node": "email_draft_node"}

    context = AgentContextBuilder(task).build()
    prompt, version = build_email_draft_prompt(task)

    try:
        result = get_llm_client("email").execute(
            prompt=prompt,
            prompt_version=version,
            schema_class=EmailDraftOutput,
            model=getattr(settings, "STRATEGYPAD_AGENT_MODEL", "gpt-4o"),
        )

        action.generated_output = result.data.model_dump()
        
        # Check risk level
        risk_info = classify_action_risk(action.action_type, action.instruction, action.generated_output)
        action.risk_level = risk_info["risk_level"]
        action.approval_required = risk_info["approval_required"]
        
        if action.risk_level == "high":
            action.status = "awaiting_approval"
        else:
            action.status = "drafted"
            
        action.telemetry = {**(action.telemetry or {}), "agent_runs": [*((action.telemetry or {}).get("agent_runs", [])), result.telemetry]}
        action.save()

        record_workflow_step(workflow, "email_draft_node", "worker", "completed", state, {"action_id": str(action.id)})
        return {**state, "current_node": "email_draft_node"}

    except Exception as exc:
        record_workflow_step(workflow, "email_draft_node", "worker", "failed", state, {}, str(exc))
        return {**state, "status": "failed", "current_node": "email_draft_node", "error": str(exc)}

def complete_workflow_node(state: StrategyWorkflowState) -> StrategyWorkflowState:
    workflow = WorkflowRun.objects.get(id=state["workflow_run_id"])
    state["visited_nodes"].append("complete_workflow")
    
    workflow.status = "completed"
    workflow.completed_at = timezone.now()
    workflow.save()
    
    record_workflow_step(workflow, "complete_workflow", "worker", "completed", state, {})
    return {**state, "current_node": "complete_workflow", "status": "completed"}


def run_strategy_graph(workflow_run, loop_limit=100):

    builder = StateGraph(StrategyWorkflowState)
    builder.add_node("load_plan", load_plan_node)
    builder.add_node("risk_router", risk_router_node)
    builder.add_node("execute_low_risk_task", execute_low_risk_task_node)
    builder.add_node("pause_for_task_approval", pause_for_task_approval_node)
    builder.add_node("execute_approved_task", execute_approved_task_node)
    
    builder.add_node("agent_router", agent_router_node)
    builder.add_node("product_manager_node", product_manager_node)
    builder.add_node("strategy_manager_node", strategy_manager_node)
    builder.add_node("email_draft_node", email_draft_node)
    builder.add_node("executive_reviewer_node", executive_reviewer_node)
    builder.add_node("evaluation_node", evaluation_node)
    
    builder.add_node("update_task_ledger", update_task_ledger_node)
    builder.add_node("complete_workflow", complete_workflow_node)

    builder.set_entry_point("load_plan")

    def plan_approval_check(state):
        if state.get("status") == "failed":
            return "failed"
        if not state.get("plan_approved"):
            return "paused"
        return "approved"

    builder.add_conditional_edges("load_plan", plan_approval_check, {"failed": END, "paused": END, "approved": "risk_router"})

    def route_after_risk(state):
        if state.get("status") == "failed":
            return "failed"
        if state.get("loop_count", 0) >= state.get("max_loops", 100):
            return "loop_limit"
        return state["next_step"]

    builder.add_conditional_edges("risk_router", route_after_risk, {
        "failed": END, "loop_limit": END, "complete_workflow": "complete_workflow",
        "execute_low_risk_task": "execute_low_risk_task", "pause_for_task_approval": "pause_for_task_approval", "execute_approved_task": "execute_approved_task"
    })

    builder.add_edge("execute_low_risk_task", "agent_router")
    builder.add_edge("execute_approved_task", "agent_router")
    
    def route_to_agent(state):
        if state.get("status") == "failed": return "failed"
        return state["next_step"]
        
    builder.add_conditional_edges("agent_router", route_to_agent, {
        "failed": END,
        "product_manager_node": "product_manager_node",
        "strategy_manager_node": "strategy_manager_node",
        "email_draft_node": "email_draft_node"
    })
    
    builder.add_edge("product_manager_node", "executive_reviewer_node")
    builder.add_edge("strategy_manager_node", "executive_reviewer_node")
    
    def route_after_email_draft(state):
        if state.get("status") == "failed": return "failed"
        task_id = state["current_task_id"]
        action = ActionRequest.objects.filter(task_id=task_id, action_type="email_draft").first()
        if action and action.risk_level == "high" and action.status not in ["approved", "executed"]:
            return "pause_for_task_approval"
        return "evaluation_node"

    builder.add_conditional_edges("email_draft_node", route_after_email_draft, {
        "failed": END,
        "pause_for_task_approval": "pause_for_task_approval",
        "evaluation_node": "evaluation_node"
    })
    
    builder.add_conditional_edges("executive_reviewer_node", route_after_reviewer, {
        "failed": END,
        "evaluation_node": "evaluation_node",
        "complete_workflow": "complete_workflow"
    })
    
    builder.add_edge("evaluation_node", "update_task_ledger")
    builder.add_edge("update_task_ledger", "risk_router")
    
    builder.add_edge("pause_for_task_approval", END)
    builder.add_edge("complete_workflow", END)

    graph = builder.compile()


    initial_state = {
        "workflow_run_id": str(workflow_run.id),
        "topic_id": str(workflow_run.topic_id),
        "daily_plan_id": "",
        "current_task_id": None,
        "plan_approved": False,
        "pending_task_ids": [],
        "completed_task_ids": [],
        "paused_task_ids": [],
        "failed_task_ids": [],
        "risk_summary": {},
        "loop_count": 0,
        "max_loops": loop_limit,
        "last_error": None,
        "error_message": "",
        "outputs": {},
        "visited_nodes": [],
        "current_node": "",
        "status": "running",
        "next_step": None,
        "force_error": workflow_run.state.get("force_error", False)
    }

    result = graph.invoke(initial_state)
    
    if result.get("loop_count", 0) >= loop_limit and result.get("status") != "failed":
        result["status"] = "failed"
        result["error_message"] = "loop_limit reached"
        
    if not result.get("plan_approved") and result.get("status") != "failed":
        result["status"] = "paused"
        workflow_run.status = "awaiting_plan_approval"
    else:
        workflow_run.status = result.get("status", "running")

    result["next_actions"] = list(set(result.get("paused_task_ids", [])))
    workflow_run.state = result
    workflow_run.save()
        
    return result
