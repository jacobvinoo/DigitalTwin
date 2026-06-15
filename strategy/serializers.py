from rest_framework import serializers
from strategy.models import (
    Topic, Objective, Workstream, TaskLedgerEntry, MemoryRecord, FeedbackRecord, EvaluationScorecard, ActionRequest, ConversationSession, ConversationMessage,
    PromptTemplate, PromptTemplateVersion, AgentPromptAssignment, PromptExecutionTrace, PromptVersionMetrics, PromptPack,
    EvaluationTemplate, EvaluationPack, EvaluationAssignment, EvaluationRun, AgentEvaluationHistory, ManualSource
)

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
    risk = serializers.SerializerMethodField()
    approval = serializers.SerializerMethodField()
    score = serializers.SerializerMethodField()
    workstream_title = serializers.ReadOnlyField(source="workstream.title", default=None)
    feedbacks = serializers.SerializerMethodField()
    
    def get_actions(self, obj):
        actions = obj.actionrequest_set.all()
        return ActionRequestSerializer(actions, many=True).data

    def get_risk(self, obj):
        return obj.risk_level

    def get_approval(self, obj):
        return "required" if obj.approval_required else "not_required"

    def get_score(self, obj):
        latest_scorecard = obj.scorecards.order_by("-created_at").first()
        if latest_scorecard:
            return latest_scorecard.overall_score
        if isinstance(obj.evaluation, dict) and "agent_evaluation" in obj.evaluation:
            ae = obj.evaluation["agent_evaluation"]
            if isinstance(ae, dict) and "overall_score" in ae:
                return ae["overall_score"]
        return None

    def get_feedbacks(self, obj):
        return [{"id": f.id, "text": f.raw_feedback, "type": f.feedback_type} for f in obj.feedbackrecord_set.all()]

    class Meta:
        model = TaskLedgerEntry
        fields = [
            "id", "topic", "objective", "workstream", "workstream_title", "title", "task_type", 
            "owner_agent_label", "status", "risk_level", "approval_required",
            "approved_at", "approved_by", "execution_lineage", "governance",
            "inputs", "telemetry", "outputs", "evaluation", "next_actions",
            "actions", "created_at", "updated_at", "risk", "approval", "score", "feedbacks"
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
    tasks_count = serializers.SerializerMethodField()
    completed_tasks_count = serializers.SerializerMethodField()
    active_tasks_count = serializers.SerializerMethodField()
    pending_approvals_count = serializers.SerializerMethodField()
    workstreams_count = serializers.SerializerMethodField()

    def get_tasks_count(self, obj):
        return obj.tasks.count()

    def get_completed_tasks_count(self, obj):
        return obj.tasks.filter(status="completed").count()

    def get_active_tasks_count(self, obj):
        return obj.tasks.filter(status="in_progress").count()

    def get_pending_approvals_count(self, obj):
        return obj.tasks.filter(status="proposed", approval_required=True).count()

    def get_workstreams_count(self, obj):
        return obj.workstreams.count()

    class Meta:
        model = Topic
        fields = [
            "id", "title", "description", "strategic_context", "owner", "status", "workspace_type",
            "created_at", "updated_at", "tasks_count", "completed_tasks_count", 
            "active_tasks_count", "pending_approvals_count", "workstreams_count"
        ]
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

class PromptPackSerializer(serializers.ModelSerializer):
    class Meta:
        model = PromptPack
        fields = '__all__'

class EvaluationTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvaluationTemplate
        fields = '__all__'

class EvaluationPackSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvaluationPack
        fields = '__all__'

class EvaluationAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvaluationAssignment
        fields = '__all__'

class EvaluationRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvaluationRun
        fields = '__all__'

class AgentEvaluationHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentEvaluationHistory
        fields = '__all__'

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

# ----------------------------------------------------------------------------
# Prompt Library Serializers
# ----------------------------------------------------------------------------

class PromptVersionMetricsSerializer(serializers.ModelSerializer):
    class Meta:
        model = PromptVersionMetrics
        fields = "__all__"

class PromptTemplateVersionSerializer(serializers.ModelSerializer):
    metrics = PromptVersionMetricsSerializer(read_only=True)
    
    class Meta:
        model = PromptTemplateVersion
        fields = ["id", "prompt_template", "version_number", "prompt_body", "changelog", "created_at", "metrics"]

class PromptTemplateSerializer(serializers.ModelSerializer):
    versions = PromptTemplateVersionSerializer(source='prompttemplateversion_set', many=True, read_only=True)

    class Meta:
        model = PromptTemplate
        fields = ["id", "name", "category", "description", "prompt_body", "version", "is_system_prompt", "created_at", "versions"]
        read_only_fields = ["version", "created_at"]

class AgentPromptAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentPromptAssignment
        fields = "__all__"

class ManualSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ManualSource
        fields = '__all__'

class PromptExecutionTraceSerializer(serializers.ModelSerializer):
    class Meta:
        model = PromptExecutionTrace
        fields = "__all__"

class AgentImprovementRecommendationSerializer(serializers.ModelSerializer):
    agent_name = serializers.CharField(source='agent.name', read_only=True)

    class Meta:
        from strategy.models import AgentImprovementRecommendation
        model = AgentImprovementRecommendation
        fields = "__all__"
