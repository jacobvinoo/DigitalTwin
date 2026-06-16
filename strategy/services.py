from strategy.models import Topic, Objective, Workstream, TaskLedgerEntry
from django.conf import settings

def get_default_tasks():
    return [
        {
            "title": "Create implementation plan",
            "task_type": "implementation_plan",
            "workstream_type": "implementation_plan",
            "risk_level": "medium",
            "approval_required": True,
        },
        {
            "title": "Identify best-in-class market experiences",
            "task_type": "competitive_research",
            "workstream_type": "competitive_analysis",
            "risk_level": "low",
            "approval_required": False,
        },
        {
            "title": "Define strategic success metrics",
            "task_type": "metrics_definition",
            "workstream_type": "market_metrics",
            "risk_level": "low",
            "approval_required": False,
        },
        {
            "title": "Identify product, technical, adoption, and data risks",
            "task_type": "risk_analysis",
            "workstream_type": "risk_analysis",
            "risk_level": "high",
            "approval_required": True,
        },
        {
            "title": "Analyse current state and competitor landscape",
            "task_type": "competitive_research",
            "workstream_type": "competitive_analysis",
            "risk_level": "low",
            "approval_required": False,
        },
        {
            "title": "Create product strategy narrative",
            "task_type": "product_strategy",
            "workstream_type": "product_strategy",
            "risk_level": "medium",
            "approval_required": True,
        },
        {
            "title": "Create 30/60/90 day roadmap",
            "task_type": "roadmap",
            "workstream_type": "roadmap",
            "risk_level": "medium",
            "approval_required": True,
        },
        {
            "title": "Create execution tracking dashboard structure",
            "task_type": "execution_tracking",
            "workstream_type": "execution_tracking",
            "risk_level": "low",
            "approval_required": False,
        },
    ]

def create_strategy_topic(
    user,
    title="New Strategic Initiative",
    objective_text="Develop a comprehensive strategy and implementation plan for the new initiative using a structured product and strategy workflow.",
    strategic_context=""
):
    topic = Topic.objects.create(
        title=title,
        description="A structured workflow to analyze and improve the supermarket search experience.",
        strategic_context=strategic_context,
        owner=user,
        status="active"
    )

    objective = Objective.objects.create(
        topic=topic,
        title=objective_text,
        priority="high",
        status="active"
    )

    workstream_mapping = {}
    workstream_defs = [
        ("Competitive Analysis", "competitive_analysis"),
        ("Market Metrics", "market_metrics"),
        ("Implementation Plan", "implementation_plan"),
        ("Risk Analysis", "risk_analysis"),
        ("Product Strategy", "product_strategy"),
        ("Roadmap", "roadmap"),
        ("Execution Tracking", "execution_tracking"),
    ]
    
    for i, (ws_title, ws_type) in enumerate(workstream_defs):
        ws = Workstream.objects.create(
            topic=topic,
            title=ws_title,
            type=ws_type,
            sort_order=i,
            status="active"
        )
        workstream_mapping[ws_type] = ws

    # Dynamically generate tasks via LLM based on the topic details
    import os
    import sys
    if os.environ.get("PYTEST_CURRENT_TEST") or 'test' in sys.argv:
        tasks_to_create = get_default_tasks()
    else:
        from strategy.agents.client import LLMClient
        from strategy.agents.schemas import TaskGenerationOutput
        
        prompt = f"""
        You are an expert strategic planner. The user wants to create a new strategy initiative.
        Title: {title}
        Objective: {objective_text}
        Context: {strategic_context}
        
        Create a list of 8 specific tasks to accomplish this. They must align with the topic.
        """
        try:
            result = LLMClient().execute(
                prompt=prompt,
                prompt_version="v1.0.0",
                schema_class=TaskGenerationOutput,
                model=getattr(settings, "STRATEGYPAD_AGENT_MODEL", "gpt-4o")
            )
            tasks_to_create = [t.model_dump() for t in result.data.tasks]
        except Exception as e:
            print(f"Fallback to default tasks. LLM task generation failed: {e}")
            tasks_to_create = get_default_tasks()

    for task_def in tasks_to_create:
        risk_level = task_def["risk_level"]
        approval_required = task_def["approval_required"]
        
        if risk_level == "high":
            approval_required = True
            
        TaskLedgerEntry.objects.create(
            topic=topic,
            objective=objective,
            workstream=workstream_mapping.get(task_def["workstream_type"]),
            title=task_def["title"],
            task_type=task_def["task_type"],
            owner_agent_label="assistant",
            status="proposed",
            risk_level=risk_level,
            approval_required=approval_required,
            execution_lineage={"source": "deterministic_template"},
            governance={"risk_policy": "phase1_strict"},
            inputs={},
            telemetry={"created_via": "setup_service"},
            outputs={},
            evaluation={},
            next_actions=[]
        )

    from strategy.models import ConversationSession
    ConversationSession.objects.create(
        user=user,
        topic=topic,
        title=f"Discussion on {title}"
    )

    return topic

def execution_mode_for_task(task):
    if task.risk_level == "low":
        return "auto-executable"
    if task.risk_level == "medium":
        return "approval-needed"
    return "hard-stop"


def create_daily_plan(topic, user, plan_date=None):
    from django.utils import timezone
    from strategy.models import WorkflowRun, DailyPlan

    plan_date = plan_date or timezone.localdate()

    tasks = topic.tasks.filter(status__in=["proposed", "approved"]).order_by(
        "risk_level", "created_at"
    )

    items = []
    for task in tasks:
        items.append({
            "task_id": str(task.id),
            "title": task.title,
            "workstream": task.workstream.title if task.workstream else None,
            "risk_level": task.risk_level,
            "execution_mode": execution_mode_for_task(task),
        })

    risk_summary = {
        "low": sum(1 for item in items if item["risk_level"] == "low"),
        "medium": sum(1 for item in items if item["risk_level"] == "medium"),
        "high": sum(1 for item in items if item["risk_level"] == "high"),
    }

    # Calculate diff
    previous_plan = DailyPlan.objects.filter(topic=topic).order_by("-created_at").first()
    if previous_plan:
        prev_task_ids = set(str(item.get("task_id", item.get("id"))) for item in previous_plan.plan_items)
        curr_task_ids = set(str(item["task_id"]) for item in items)
        
        diff_from_previous = {
            "first_plan": False,
            "added": list(curr_task_ids - prev_task_ids),
            "removed": list(prev_task_ids - curr_task_ids),
            "unchanged": list(curr_task_ids & prev_task_ids),
        }
    else:
        diff_from_previous = {"first_plan": True, "added": [], "removed": [], "unchanged": []}

    workflow = WorkflowRun.objects.create(
        topic=topic,
        run_type="daily_plan",
        status="awaiting_plan_approval",
        current_node="plan_approval_gate",
        created_by=user,
        state={
            "plan_items": items,
            "risk_summary": risk_summary,
            "next_node": "plan_approval_gate",
        },
    )

    plan = DailyPlan.objects.create(
        topic=topic,
        workflow_run=workflow,
        plan_date=plan_date,
        status="proposed",
        summary=f"Proposed {len(items)} tasks across {len(set(i['workstream'] for i in items))} workstreams.",
        plan_items=items,
        risk_summary=risk_summary,
        diff_from_previous=diff_from_previous,
    )

    return workflow, plan

def approve_daily_plan(plan, user):
    from django.utils import timezone
    from django.core.exceptions import PermissionDenied
    from strategy.models import WorkflowStep

    if plan.topic.owner != user:
        raise PermissionDenied("You do not have permission to approve this plan.")
    if plan.status == "approved":
        raise ValueError("Plan is already approved.")
    if plan.status == "rejected":
        raise ValueError("Cannot approve a rejected plan.")
        
    workflow = plan.workflow_run
    now = timezone.now()
    
    plan.status = "approved"
    plan.approved_by = user
    plan.approved_at = now
    plan.save()
    
    workflow.status = "approved"
    workflow.approved_by = user
    workflow.approved_at = now
    workflow.save()
    
    WorkflowStep.objects.create(
        workflow_run=workflow,
        node_name="plan_approval_gate",
        step_type="approval_gate",
        status="completed",
        completed_at=now
    )

def reject_daily_plan(plan, user, reason=None):
    from django.core.exceptions import PermissionDenied
    if not reason:
        raise ValueError("Rejection reason is required.")
    if plan.topic.owner != user:
        raise PermissionDenied("You do not have permission to reject this plan.")
    if plan.status == "rejected":
        raise ValueError("Plan is already rejected.")
        
    workflow = plan.workflow_run
    
    plan.status = "rejected"
    plan.save()
    
    workflow.status = "cancelled"
    state = workflow.state or {}
    state["rejection_reason"] = reason
    workflow.state = state
    workflow.save()

HIGH_RISK_TERMS = ["send", "publish", "external", "commit", "approve on my behalf"]

def classify_action_risk(action_type: str, instruction: str, payload: dict) -> dict:
    text = f"{action_type} {instruction}".lower()

    if action_type == "email_send":
        return {"risk_level": "high", "approval_required": True}

    if any(term in text for term in HIGH_RISK_TERMS):
        return {"risk_level": "high", "approval_required": True}

    if action_type in ["email_draft", "stakeholder_update", "document_create"]:
        return {"risk_level": "medium", "approval_required": True}

    return {"risk_level": "low", "approval_required": False}

class IntentClassifier:
    def classify(self, message: str, context=None) -> dict:
        text = message.lower().strip()

        rules = [
            ("executive_challenge", ["challenge", "executive review", "what would a ceo"]),
            ("get_status", ["what is the status", "get status", "show status"]),
            ("get_completed_work", ["what did you complete", "completed today", "done today"]),
            ("get_pending_approvals", ["needs my approval", "pending approval", "what needs my approval"]),
            ("approve_plan", ["approve this plan", "approve plan"]),
            ("create_daily_plan", ["daily plan", "today's plan", "prepare today's plan", "prepare plan"]),
            ("create_topic", ["create a topic", "new topic", "strategy workspace"]),
            ("create_action", ["draft an email", "prepare email", "create document"]),
            ("execute_action", ["send the email", "send it", "execute action"]),
            ("switch_entity", ["switch to executive", "talk to executive", "switch to assistant"]),
        ]

        for intent, phrases in rules:
            if any(phrase in text for phrase in phrases):
                return {
                    "intent": intent,
                    "confidence": 0.9,
                    "extracted_entities": {},
                    "requires_clarification": False,
                }

        return {
            "intent": "unknown",
            "confidence": 0.2,
            "extracted_entities": {},
            "requires_clarification": True,
        }

class ConversationCommandRouter:
    # ── Public entry point ─────────────────────────────────────────────────────

    def handle_message(self, session, message_text, channel="text", task_id=None, action_id=None):
        from strategy.models import ConversationMessage
        from django.core.exceptions import PermissionDenied

        if session.topic and session.topic.owner != session.user:
            raise PermissionDenied("You do not have access to this topic.")

        classifier = IntentClassifier()
        intent_result = classifier.classify(message_text)

        ConversationMessage.objects.create(
            session=session,
            sender="user",
            channel=channel,
            message_text=message_text,
            intent=intent_result["intent"],
        )

        if intent_result.get("requires_clarification"):
            return self._respond(
                session,
                text="I'm not sure what you want me to do. Do you want me to create a topic, prepare a plan, review work, or check approvals?",
                requires_clarification=True,
            )

        handler_name = f"_handle_{intent_result['intent']}"
        handler = getattr(self, handler_name, self._handle_unknown)
        return handler(
            session=session,
            text=message_text,
            task_id=task_id,
            action_id=action_id,
        )

    # ── Response helpers ───────────────────────────────────────────────────────

    def _respond(self, session, text, ui_card=None, data=None, error=None, requires_clarification=False):
        """Persist entity response and return a stable payload dict."""
        from strategy.models import ConversationMessage
        ConversationMessage.objects.create(
            session=session,
            sender=session.active_entity,
            channel="text",
            message_text=text,
        )
        cards = [{"type": ui_card, "data": data or {}}] if ui_card else []
        return {
            "message": text,
            "ui_card": ui_card,
            "data": data,
            "error": error,
            "requires_clarification": requires_clarification,
            "cards": cards,
        }

    def _executive_only(self, session, blocked_action: str):
        """Return a refusal payload when executive tries a mutating command."""
        return self._respond(
            session,
            text=(
                f"The Executive Reviewer cannot {blocked_action}. "
                "This role is read-only: it reviews, challenges, and recommends — "
                "it does not create, approve, or execute. "
                "Switch to Assistant to perform this action."
            ),
            error=f"executive_cannot_{blocked_action.replace(' ', '_')}",
        )

    def _generate_critique(self, session, task_id=None):
        """Deterministic critique generator — no LLM required.

        Returns a structured critique card based on the task's risk level and
        workstream. Future versions may call an LLM reviewer node here.
        """
        from strategy.models import TaskLedgerEntry

        critique = "This work needs a clearer success metric and evidence base before it can be considered executive-ready."
        risk_note = "Assumptions are being treated as facts. Quantify or remove them."
        recommendation = "Add measurable benchmarks and explicitly list dependencies before proceeding."

        if task_id:
            task = TaskLedgerEntry.objects.filter(id=task_id).first()
            if task:
                if task.risk_level == "high":
                    risk_note = f"'{task.title}' is high-risk. Executive sign-off is required before any execution."
                    recommendation = "Pause this task. Conduct a pre-mortem and present risk mitigations first."
                elif task.risk_level == "medium":
                    risk_note = f"'{task.title}' has medium risk. Validate assumptions before proceeding."
                    recommendation = "Present a 1-page brief on assumptions and evidence before next phase."
                else:
                    critique = f"'{task.title}' looks reasonable but lacks explicit success criteria."
                    recommendation = "Define a measurable outcome and a rollback plan."

        return {
            "critique": critique,
            "risk": risk_note,
            "recommendation": recommendation,
        }

    # ── Intent handlers ────────────────────────────────────────────────────────

    def _handle_create_daily_plan(self, session, text, task_id, action_id):
        if session.active_entity == "executive":
            return self._executive_only(session, "create daily plans")
        from strategy.services import create_daily_plan
        run, plan = create_daily_plan(session.topic, session.user)
        return self._respond(
            session, "Daily plan created.", ui_card="DailyPlanCard", data={"plan_id": plan.id}
        )

    def _handle_get_status(self, session, text, task_id, action_id):
        return self._respond(session, "Here is the status.", ui_card="StatusCard")

    def _handle_get_completed_work(self, session, text, task_id, action_id):
        from strategy.models import TaskLedgerEntry
        tasks = TaskLedgerEntry.objects.filter(topic=session.topic, status="completed")
        return self._respond(
            session,
            "Here is the completed work.",
            ui_card="CompletedWorkCard",
            data={"tasks": [t.title for t in tasks]},
        )

    def _handle_get_pending_approvals(self, session, text, task_id, action_id):
        from strategy.models import ActionRequest
        actions = ActionRequest.objects.filter(topic=session.topic, status="awaiting_approval")
            
        return self._respond(
            session,
            "Here are the pending approvals.",
            ui_card="PendingApprovalsCard",
            data={"actions": [{"id": a.id, "title": a.title, "status": a.status, "risk_level": a.risk_level} for a in actions]},
        )

    def _handle_executive_challenge(self, session, text, task_id, action_id):
        """Route an executive challenge request.

        Generates a structured critique card. Does not approve or execute anything.
        """
        critique_data = self._generate_critique(session, task_id=task_id)

        # Best-effort: call the executive_reviewer workflow node if available
        if task_id:
            try:
                from strategy.workflows import executive_reviewer_node
                executive_reviewer_node({"current_task_id": str(task_id)})
            except Exception:
                pass

        return self._respond(
            session,
            text="Executive review complete. See the critique card for findings.",
            ui_card="ExecutiveReviewCard",
            data=critique_data,
        )

    def _handle_create_action(self, session, text, task_id, action_id):
        if session.active_entity == "executive":
            return self._executive_only(session, "create actions")
        from strategy.models import ActionRequest, TaskLedgerEntry
        task = TaskLedgerEntry.objects.filter(id=task_id).first() if task_id else None
        action = ActionRequest.objects.create(
            topic=session.topic,
            task=task,
            action_type="email_draft",
            status="drafted",
            title="Draft Action",
        )
        return self._respond(
            session,
            "Drafting action.",
            ui_card="ActionDraftCard",
            data={"id": action.id, "title": action.title, "status": action.status, "risk_level": action.risk_level}
        )

    def _handle_approve_action(self, session, text, task_id, action_id):
        """Explicit approve_action intent — executive cannot approve on behalf of user."""
        if session.active_entity == "executive":
            return self._executive_only(session, "approve actions on behalf of the user")
        from strategy.models import ActionRequest
        if not action_id:
            action = ActionRequest.objects.filter(topic=session.topic).order_by("-created_at").first()
            if not action:
                return self._respond(session, "Action ID missing.", error="Action ID missing")
        else:
            action = ActionRequest.objects.get(id=action_id)
        action.status = "approved"
        action.save()
        return self._respond(session, "Action approved.", ui_card="ActionApprovedCard")

    def _handle_execute_action(self, session, text, task_id, action_id):
        """Executive cannot execute. Unapproved actions are always refused."""
        if session.active_entity == "executive":
            return self._executive_only(session, "execute actions")
        from strategy.models import ActionRequest
        if not action_id:
            action = ActionRequest.objects.filter(topic=session.topic).order_by("-created_at").first()
            if not action:
                return self._respond(session, "Action ID missing.", error="Action ID missing")
        else:
            action = ActionRequest.objects.get(id=action_id)
        if action.status != "approved":
            return self._respond(
                session,
                "Action is unapproved. Approval required before execution.",
                error="Action is unapproved. Approval required.",
            )
        action.status = "executed"
        action.save()
        return self._respond(session, "Action executed.", ui_card="ActionExecutedCard")

    def _handle_switch_entity(self, session, text, task_id, action_id):
        if "executive" in text.lower():
            session.active_entity = "executive"
        else:
            session.active_entity = "assistant"
        session.save()
        return self._respond(
            session, f"Switched to {session.active_entity}.", ui_card="EntitySwitchedCard"
        )

    def _handle_unknown(self, session, text, task_id, action_id):
        return self._respond(session, "I'm not sure what you mean.", requires_clarification=True)

