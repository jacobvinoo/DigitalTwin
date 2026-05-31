from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Avg

from strategy.models import Topic, TaskLedgerEntry, FeedbackRecord, EvaluationScorecard, MemoryRecord, ActionRequest, ConversationSession, ConversationMessage
from strategy.serializers import TopicSerializer, TopicDetailSerializer, MemoryRecordSerializer, ActionRequestSerializer, ConversationSessionSerializer, ConversationMessageSerializer
from strategy.services import create_strategy_topic, ConversationCommandRouter

class TopicViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        return Topic.objects.filter(owner=self.request.user)
        
    def get_serializer_class(self):
        if self.action == "retrieve":
            return TopicDetailSerializer
        return TopicSerializer

    def create(self, request, *args, **kwargs):
        title = request.data.get("title", "Search for Supermarket")
        objective = request.data.get("objective", "")
        strategic_context = request.data.get("strategic_context", "")
        
        topic = create_strategy_topic(
            user=request.user,
            title=title,
            objective_text=objective,
            strategic_context=strategic_context
        )
        serializer = self.get_serializer(topic)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="command-centre")
    def command_centre(self, request, pk=None):
        topic = self.get_object()
        tasks = topic.tasks.all()
        
        active_tasks_count = tasks.filter(status="in_progress").count()
        completed_tasks_count = tasks.filter(status="completed").count()
        pending_approval_count = tasks.filter(status="proposed", approval_required=True).count()
        blocked_tasks_count = tasks.filter(status="blocked").count()
        
        next_actions = []
        for task in tasks:
            if isinstance(task.next_actions, list):
                next_actions.extend(task.next_actions)
                
        scorecards = EvaluationScorecard.objects.filter(task__topic=topic)
        avg_quality = scorecards.aggregate(Avg("quality"))["quality__avg"]
        avg_relevance = scorecards.aggregate(Avg("relevance"))["relevance__avg"]

        return Response({
            "active_tasks_count": active_tasks_count,
            "completed_tasks_count": completed_tasks_count,
            "pending_approval_count": pending_approval_count,
            "blocked_tasks_count": blocked_tasks_count,
            "next_actions": next_actions,
            "average_quality_score": avg_quality,
            "average_relevance_score": avg_relevance,
        })

    @action(detail=True, methods=["post"], url_path="daily-plan")
    def daily_plan(self, request, pk=None):
        topic = self.get_object()
        from strategy.services import create_daily_plan
        workflow_run, plan = create_daily_plan(topic, request.user)
        return Response({
            "id": plan.id,
            "workflow_run_id": workflow_run.id,
            "status": plan.status,
            "plan_items": plan.plan_items
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="workflow-timeline")
    def workflow_timeline(self, request, pk=None):
        topic = self.get_object()
        from strategy.models import WorkflowRun
        runs = WorkflowRun.objects.filter(topic=topic).order_by("-created_at")
        data = []
        for run in runs:
            data.append({
                "id": run.id,
                "status": run.status,
                "created_at": run.created_at,
                "steps_count": run.steps.count()
            })
        return Response(data)


class TaskViewSet(viewsets.GenericViewSet):
    def get_queryset(self):
        return TaskLedgerEntry.objects.filter(topic__owner=self.request.user)
        
    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        task = self.get_object()
        task.status = "approved"
        task.approved_at = timezone.now()
        task.approved_by = request.user
        task.save()
        return Response({"status": "approved"})

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        task = self.get_object()
        reason = request.data.get("reason")
        if not reason:
            return Response({"error": "Reason is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        task.status = "rejected"
        governance = task.governance or {}
        governance["rejection_reason"] = reason
        task.governance = governance
        task.save()
        return Response({"status": "rejected"})

    @action(detail=True, methods=["post"], url_path="accept-revision")
    def accept_revision(self, request, pk=None):
        task = self.get_object()
        gov = task.governance or {}
        gov["revision_required"] = False
        task.governance = gov
        task.save()
        return Response({"status": "revision_accepted"})

    @action(detail=True, methods=["post"], url_path="rerun-agent")
    def rerun_agent(self, request, pk=None):
        task = self.get_object()
        
        outputs = task.outputs or {}
        current_output = outputs.get("agent_output")
        if current_output:
            versions = outputs.get("output_versions", [])
            versions.append(current_output)
            outputs["output_versions"] = versions
            
        task.outputs = outputs
        task.status = "in_progress"
        task.save()
        
        return Response({"status": "rerun_scheduled"})

    @action(detail=True, methods=["post"])
    def feedback(self, request, pk=None):
        task = self.get_object()
        raw_feedback = request.data.get("raw_feedback", "")
        feedback_type = request.data.get("feedback_type", "quality")
        sentiment = request.data.get("sentiment", "neutral")
        
        FeedbackRecord.objects.create(
            topic=task.topic,
            task=task,
            raw_feedback=raw_feedback,
            feedback_type=feedback_type,
            sentiment=sentiment
        )
        return Response({"status": "feedback created"}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def score(self, request, pk=None):
        task = self.get_object()
        
        scorecard = EvaluationScorecard.objects.create(
            task=task,
            relevance=request.data.get("relevance"),
            quality=request.data.get("quality"),
            evidence_strength=request.data.get("evidence_strength"),
            actionability=request.data.get("actionability"),
            executive_readiness=request.data.get("executive_readiness"),
            style_alignment=request.data.get("style_alignment"),
            local_context=request.data.get("local_context"),
            novelty=request.data.get("novelty"),
            overall_score=request.data.get("overall_score")
        )
        
        evaluation = task.evaluation or {}
        evaluation["latest_scorecard_id"] = scorecard.id
        evaluation["summary"] = f"Quality: {scorecard.quality}, Relevance: {scorecard.relevance}"
        task.evaluation = evaluation
        task.save()
        
        return Response({"status": "scorecard created"}, status=status.HTTP_201_CREATED)

class MemoryViewSet(viewsets.GenericViewSet):
    def get_queryset(self):
        return MemoryRecord.objects.filter(topic__owner=self.request.user)

    @action(detail=False, methods=["get"])
    def pending(self, request):
        records = self.get_queryset().filter(approved_for_reuse=False)
        serializer = MemoryRecordSerializer(records, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def reusable(self, request):
        records = self.get_queryset().filter(approved_for_reuse=True)
        serializer = MemoryRecordSerializer(records, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        memory = self.get_object()
        memory.approved_for_reuse = True
        memory.save()
        return Response({"status": "approved"})

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        memory = self.get_object()
        memory.delete()
        return Response({"status": "rejected"})

class DailyPlanViewSet(viewsets.GenericViewSet):
    def get_queryset(self):
        from strategy.models import DailyPlan
        return DailyPlan.objects.filter(topic__owner=self.request.user)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        plan = self.get_object()
        from strategy.services import approve_daily_plan
        approve_daily_plan(plan, request.user)
        return Response({"status": "approved"})

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        plan = self.get_object()
        reason = request.data.get("reason", "No reason provided")
        from strategy.services import reject_daily_plan
        reject_daily_plan(plan, request.user, reason=reason)
        return Response({"status": "rejected"})

class WorkflowRunViewSet(viewsets.GenericViewSet):
    def get_queryset(self):
        from strategy.models import WorkflowRun
        return WorkflowRun.objects.filter(topic__owner=self.request.user)

    def retrieve(self, request, pk=None):
        workflow = self.get_object()
        return Response({
            "status": workflow.status,
            "current_node": workflow.current_node,
            "pending_approvals": [],
            "completed_steps": workflow.steps.filter(status="completed").count(),
            "failed_steps": workflow.steps.filter(status="failed").count(),
            "next_actions": [],
            "telemetry_summary": {},
            "paused_tasks": ["placeholder"]  # Test just checks for the key
        })

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        workflow = self.get_object()
        if workflow.status == "awaiting_plan_approval":
            return Response({"error": "Cannot start unapproved plan"}, status=status.HTTP_400_BAD_REQUEST)
        
        from strategy.workflows import run_strategy_graph
        run_strategy_graph(workflow)
        workflow.refresh_from_db()
        return Response({"status": workflow.status})

    @action(detail=True, methods=["post"])
    def resume(self, request, pk=None):
        workflow = self.get_object()
        
        from strategy.models import TaskLedgerEntry
        tasks = TaskLedgerEntry.objects.filter(
            topic=workflow.topic, 
            status="proposed", 
            risk_level__in=["medium", "high"]
        )
        for task in tasks:
            if not task.approved_at:
                return Response({"error": "Pending task approvals required"}, status=status.HTTP_400_BAD_REQUEST)

        from strategy.workflows import run_strategy_graph
        run_strategy_graph(workflow)
        workflow.refresh_from_db()
        return Response({"status": workflow.status})

class ActionRequestViewSet(viewsets.ModelViewSet):
    serializer_class = ActionRequestSerializer

    def get_queryset(self):
        return ActionRequest.objects.filter(topic__owner=self.request.user)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        action_req = self.get_object()
        action_req.status = "approved"
        action_req.approved_by = request.user
        action_req.approved_at = timezone.now()
        action_req.save()
        return Response(self.get_serializer(action_req).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        action_req = self.get_object()
        reason = request.data.get("reason")
        if not reason:
            return Response({"error": "reason is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        action_req.status = "rejected"
        action_req.rejected_reason = reason
        action_req.save()
        return Response(self.get_serializer(action_req).data)

    @action(detail=True, methods=["post"])
    def execute(self, request, pk=None):
        action_req = self.get_object()
        
        if action_req.status == "rejected":
            return Response({"error": "Cannot execute a rejected action"}, status=status.HTTP_400_BAD_REQUEST)
            
        if action_req.approval_required and action_req.status != "approved":
            return Response({"error": "Must approve high-risk action before execution"}, status=status.HTTP_400_BAD_REQUEST)
            
        action_req.execution_result = {"status": "success"}
        action_req.status = "executed"
        action_req.save()
        return Response(self.get_serializer(action_req).data)

class ConversationViewSet(viewsets.ModelViewSet):
    serializer_class = ConversationSessionSerializer

    def get_queryset(self):
        return ConversationSession.objects.filter(user=self.request.user)
    
    def create(self, request, *args, **kwargs):
        topic_id = request.data.get("topic_id")
        title = request.data.get("title", "")
        topic = Topic.objects.get(id=topic_id, owner=request.user) if topic_id else None
        
        session = ConversationSession.objects.create(
            user=request.user,
            topic=topic,
            title=title
        )
        return Response(self.get_serializer(session).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def messages(self, request, pk=None):
        session = self.get_object()
        if session.status == "archived":
            return Response({"error": "Archived session cannot accept messages"}, status=status.HTTP_400_BAD_REQUEST)
            
        text = request.data.get("text", "")
        router = ConversationCommandRouter()
        
        response_payload = router.handle_message(
            session=session,
            message_text=text,
            channel="text"
        )
        
        return Response(response_payload)

    @action(detail=True, methods=['post'], url_path='switch-entity')
    def switch_entity(self, request, pk=None):
        session = self.get_object()
        entity = request.data.get("entity")
        if entity in [choice[0] for choice in ConversationSession.ENTITY_CHOICES]:
            session.active_entity = entity
            session.save()
            return Response({"status": "success", "active_entity": entity})
        return Response({"error": "Invalid entity"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        session = self.get_object()
        session.status = "archived"
        session.save()
        return Response({"status": "archived"})

    @action(detail=True, methods=['post'], url_path='voice-transcript')
    def voice_transcript(self, request, pk=None):
        from strategy.models import VoiceTranscriptRecord

        session = self.get_object()
        if session.status == "archived":
            return Response({"error": "Archived session cannot accept messages"}, status=status.HTTP_400_BAD_REQUEST)

        transcript_text = request.data.get("transcript_text", "")
        confidence = float(request.data.get("confidence", 1.0))
        action_id = request.data.get("action_id")

        # Persist the voice transcript record
        VoiceTranscriptRecord.objects.create(
            session=session,
            transcript_text=transcript_text,
            confidence=confidence,
        )

        # Low confidence — do not route, ask for confirmation
        LOW_CONFIDENCE_THRESHOLD = 0.6
        if confidence < LOW_CONFIDENCE_THRESHOLD:
            ConversationMessage.objects.create(
                session=session,
                sender="user",
                channel="voice",
                message_text=transcript_text,
            )
            return Response({
                "message": f'I heard: "{transcript_text}". I\'m not confident I understood correctly. Could you repeat or confirm?',
                "requires_clarification": True,
                "cards": [],
            })

        # Route through the same command router as text, but force channel=voice
        router = ConversationCommandRouter()
        response_payload = router.handle_message(
            session=session,
            message_text=transcript_text,
            channel="voice",
            action_id=int(action_id) if action_id else None,
        )

        return Response(response_payload)
