from rest_framework import serializers
from strategy.models import Topic, Objective, Workstream, TaskLedgerEntry, MemoryRecord, FeedbackRecord, EvaluationScorecard, ActionRequest, ConversationSession, ConversationMessage

class ObjectiveSerializer(serializers.ModelSerializer):
    class Meta:
        model = Objective
        fields = ["id", "title", "description", "success_metric", "priority", "status", "created_at", "updated_at"]

class MemoryRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = MemoryRecord
        fields = [
            "id", "topic", "memory_type", "content", "source", 
            "confidence", "approved_for_reuse", "created_at", "updated_at"
        ]

class WorkstreamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Workstream
        fields = ["id", "title", "type", "status", "sort_order", "created_at", "updated_at"]

class TaskLedgerEntrySerializer(serializers.ModelSerializer):
    actions = serializers.SerializerMethodField()
    
    def get_actions(self, obj):
        actions = obj.actionrequest_set.all()
        return ActionRequestSerializer(actions, many=True).data

    class Meta:
        model = TaskLedgerEntry
        fields = [
            "id", "topic", "objective", "workstream", "title", "task_type", 
            "owner_agent_label", "status", "risk_level", "approval_required",
            "approved_at", "approved_by", "execution_lineage", "governance",
            "inputs", "telemetry", "outputs", "evaluation", "next_actions",
            "actions", "created_at", "updated_at"
        ]

class EvaluationScorecardSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvaluationScorecard
        fields = [
            "id", "task", "relevance", "quality", "evidence_strength", 
            "actionability", "executive_readiness", "style_alignment",
            "local_context", "novelty", "overall_score", "reviewer_notes",
            "created_at", "updated_at"
        ]

class FeedbackRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeedbackRecord
        fields = [
            "id", "topic", "task", "raw_feedback", "feedback_type", 
            "sentiment", "improvement_suggestion", "created_at", "updated_at"
        ]

class TopicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Topic
        fields = ["id", "title", "description", "strategic_context", "owner", "status", "created_at", "updated_at"]
        read_only_fields = ["owner"]
        
class TopicDetailSerializer(TopicSerializer):
    objectives = ObjectiveSerializer(many=True, read_only=True)
    workstreams = WorkstreamSerializer(many=True, read_only=True)
    tasks = TaskLedgerEntrySerializer(many=True, read_only=True)
    
    pending_approvals = serializers.SerializerMethodField()
    scorecards = serializers.SerializerMethodField()
    feedback_summary = serializers.SerializerMethodField()
    
    def get_pending_approvals(self, obj):
        tasks = obj.tasks.filter(approval_required=True, status="proposed")
        return TaskLedgerEntrySerializer(tasks, many=True).data
        
    def get_scorecards(self, obj):
        scorecards = EvaluationScorecard.objects.filter(task__topic=obj)
        return EvaluationScorecardSerializer(scorecards, many=True).data
        
    def get_feedback_summary(self, obj):
        feedbacks = FeedbackRecord.objects.filter(topic=obj)
        return FeedbackRecordSerializer(feedbacks, many=True).data
        
    class Meta(TopicSerializer.Meta):
        fields = TopicSerializer.Meta.fields + ["objectives", "workstreams", "tasks", "pending_approvals", "scorecards", "feedback_summary"]

class ActionRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActionRequest
        fields = "__all__"
        read_only_fields = ["approved_by", "approved_at", "status", "execution_result"]

class ConversationMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConversationMessage
        fields = ["id", "sender", "channel", "message_text", "intent", "metadata", "created_at"]
        read_only_fields = fields

class ConversationSessionSerializer(serializers.ModelSerializer):
    messages = ConversationMessageSerializer(many=True, read_only=True)

    class Meta:
        model = ConversationSession
        fields = ["id", "topic", "user", "active_entity", "title", "status", "created_at", "updated_at", "messages"]
        read_only_fields = ["user", "active_entity", "status", "created_at", "updated_at"]

