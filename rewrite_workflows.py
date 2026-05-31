import re

with open("strategy/workflows.py", "r") as f:
    content = f.read()

imports_to_add = """
from strategy.agents.client import LLMClient
from strategy.agents.context import AgentContextBuilder
from strategy.agents.schemas import ProductManagerOutput, StrategyManagerOutput, ExecutiveReviewOutput, EvaluationOutput
from strategy.agents.prompts import (
    build_product_manager_prompt,
    build_strategy_manager_prompt,
    build_executive_reviewer_prompt,
    build_evaluation_prompt,
    PRODUCT_MANAGER_VERSION,
    STRATEGY_MANAGER_VERSION,
    EXECUTIVE_REVIEWER_VERSION,
    EVALUATION_VERSION
)
from django.conf import settings
"""

# Add imports after first few lines
content = content.replace('from langgraph.graph import StateGraph, END\n', 'from langgraph.graph import StateGraph, END\n' + imports_to_add)

nodes_code = """
def agent_router_node(state: StrategyWorkflowState) -> StrategyWorkflowState:
    task_id = state["current_task_id"]
    task = TaskLedgerEntry.objects.get(id=task_id)
    
    if task.task_type in ["metrics_definition", "implementation_plan", "roadmap", "execution_tracking"]:
        next_step = "product_manager_node"
    else:
        next_step = "strategy_manager_node"
        
    return {**state, "current_node": "agent_router", "next_step": next_step}

def product_manager_node(state: StrategyWorkflowState) -> StrategyWorkflowState:
    workflow = WorkflowRun.objects.get(id=state["workflow_run_id"])
    task = TaskLedgerEntry.objects.get(id=state["current_task_id"])

    context = AgentContextBuilder(task).build()
    prompt, version = build_product_manager_prompt(task)

    try:
        result = LLMClient().execute(
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
    workflow = WorkflowRun.objects.get(id=state["workflow_run_id"])
    task = TaskLedgerEntry.objects.get(id=state["current_task_id"])

    context = AgentContextBuilder(task).build()
    prompt, version = build_strategy_manager_prompt(task)

    try:
        result = LLMClient().execute(
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
    workflow = WorkflowRun.objects.get(id=state["workflow_run_id"])
    task = TaskLedgerEntry.objects.get(id=state["current_task_id"])

    draft = (task.outputs or {}).get("agent_output", {})
    context = AgentContextBuilder(task).build()
    prompt, version = build_executive_reviewer_prompt(task, draft_output=draft)

    try:
        result = LLMClient().execute(
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
            task.status = "revision_required"
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
    workflow = WorkflowRun.objects.get(id=state["workflow_run_id"])
    task = TaskLedgerEntry.objects.get(id=state["current_task_id"])

    context = AgentContextBuilder(task).build()
    prompt, version = build_evaluation_prompt(task)

    try:
        result = LLMClient().execute(
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
"""

content = re.sub(r'def create_placeholder_output_node\(state: StrategyWorkflowState\) -> StrategyWorkflowState:.*?def update_task_ledger_node\(state: StrategyWorkflowState\) -> StrategyWorkflowState:', nodes_code, content, flags=re.DOTALL)

# Update mark_task_completed_from_workflow call to not overwrite outputs
content = content.replace('''    mark_task_completed_from_workflow(
        task=task,
        workflow=workflow,
        output_summary="Simulated Phase 2 output. Real agent execution will be added in Phase 3."
    )''', '''    # Phase 3 updates task directly during agent nodes
    task.status = "completed"
    task.save()''')

# Update graph builder
graph_code = """
    builder = StateGraph(StrategyWorkflowState)
    builder.add_node("load_plan", load_plan_node)
    builder.add_node("risk_router", risk_router_node)
    builder.add_node("execute_low_risk_task", execute_low_risk_task_node)
    builder.add_node("pause_for_task_approval", pause_for_task_approval_node)
    builder.add_node("execute_approved_task", execute_approved_task_node)
    
    builder.add_node("agent_router", agent_router_node)
    builder.add_node("product_manager_node", product_manager_node)
    builder.add_node("strategy_manager_node", strategy_manager_node)
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
        "strategy_manager_node": "strategy_manager_node"
    })
    
    builder.add_edge("product_manager_node", "executive_reviewer_node")
    builder.add_edge("strategy_manager_node", "executive_reviewer_node")
    
    def route_after_reviewer(state):
        if state.get("status") == "failed": return "failed"
        return state["next_step"]
        
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
"""

content = re.sub(r'    builder = StateGraph\(StrategyWorkflowState\).*?graph = builder.compile\(\)', graph_code, content, flags=re.DOTALL)

with open("strategy/workflows.py", "w") as f:
    f.write(content)
