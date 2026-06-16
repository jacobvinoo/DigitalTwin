from django.db import models
from django.conf import settings

class Topic(models.Model):
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("active", "Active"),
        ("paused", "Paused"),
        ("completed", "Completed"),
        ("deleted", "Deleted"),
    ]

    WORKSPACE_TYPES = [
        ("strategy", "Strategy Workspace"),
        ("custom_agent_chain", "Custom Agent Chain Workspace"),
    ]

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    strategic_context = models.TextField(blank=True)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="draft")
    workspace_type = models.CharField(max_length=50, choices=WORKSPACE_TYPES, default="strategy")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class Objective(models.Model):
    PRIORITY_CHOICES = [
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
        ("critical", "Critical"),
    ]
    
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name="objectives")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    success_metric = models.CharField(max_length=255, blank=True)
    priority = models.CharField(max_length=32, choices=PRIORITY_CHOICES, default="medium")
    status = models.CharField(max_length=32, default="draft")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class Workstream(models.Model):
    TYPE_CHOICES = [
        ("competitive_analysis", "Competitive Analysis"),
        ("market_metrics", "Market Metrics"),
        ("implementation_plan", "Implementation Plan"),
        ("risk_analysis", "Risk Analysis"),
        ("product_strategy", "Product Strategy"),
        ("roadmap", "Roadmap"),
        ("execution_tracking", "Execution Tracking"),
    ]
    
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name="workstreams")
    title = models.CharField(max_length=255)
    type = models.CharField(max_length=64, choices=TYPE_CHOICES)
    status = models.CharField(max_length=32, default="active")
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class TaskLedgerEntry(models.Model):
    STATUS_CHOICES = [
        ("proposed", "Proposed"),
        ("approved", "Approved"),
        ("pending_approval", "Pending Approval"),
        ("in_progress", "In Progress"),
        ("completed", "Completed"),
        ("rejected", "Rejected"),
        ("blocked", "Blocked"),
        ("archived", "Archived"),
    ]

    RISK_CHOICES = [
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
    ]

    topic = models.ForeignKey(Topic, on_delete=models.PROTECT, related_name="tasks")
    objective = models.ForeignKey(Objective, null=True, blank=True, on_delete=models.SET_NULL)
    workstream = models.ForeignKey(Workstream, null=True, blank=True, on_delete=models.SET_NULL)

    title = models.CharField(max_length=255)
    task_type = models.CharField(max_length=100)
    owner_agent_label = models.CharField(max_length=100, default="assistant")
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="proposed")
    risk_level = models.CharField(max_length=32, choices=RISK_CHOICES, default="low")

    approval_required = models.BooleanField(default=False)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="approved_tasks",
    )

    execution_lineage = models.JSONField(default=dict, blank=True)
    governance = models.JSONField(default=dict, blank=True)
    inputs = models.JSONField(default=dict, blank=True)
    telemetry = models.JSONField(default=dict, blank=True)
    outputs = models.JSONField(default=dict, blank=True)
    evaluation = models.JSONField(default=dict, blank=True)
    next_actions = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        from django.core.exceptions import ValidationError
        
        if self.status == "rejected":
            if not self.governance or "rejection_reason" not in self.governance:
                raise ValidationError("rejection_reason is required")
                
        if self.status == "in_progress" and self.risk_level in ["medium", "high"]:
            if not self.approved_at:
                raise ValidationError("Cannot move to in_progress without approval")
                
        super().clean()

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new and self.task_type == "competitive_research":
            if not hasattr(self, "researchbrief"):
                desc = (self.inputs or {}).get("description", "")
                objective = desc if desc else self.title
                questions = [
                    f"What are the core industry standards for {self.title}?",
                    f"How do leading platforms solve {self.title}?",
                    f"What key metrics define success for {self.title}?",
                    f"What are the major risks and pitfalls in {self.title}?",
                    f"What technologies or integrations are recommended for {self.title}?"
                ]
                ResearchBrief.objects.create(
                    topic=self.topic,
                    task=self,
                    objective=objective,
                    research_questions=questions,
                    status="draft"
                )

class MemoryRecord(models.Model):
    MEMORY_TYPE_CHOICES = [
        ("user_preference", "User Preference"),
        ("project_context", "Project Context"),
        ("feedback", "Feedback"),
        ("style_rule", "Style Rule"),
        ("source_insight", "Source Insight"),
    ]
    topic = models.ForeignKey(Topic, null=True, blank=True, on_delete=models.CASCADE)
    memory_type = models.CharField(max_length=64, choices=MEMORY_TYPE_CHOICES)
    content = models.TextField()
    source = models.CharField(max_length=255, blank=True)
    confidence = models.FloatField(default=1.0)
    approved_for_reuse = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class FeedbackRecord(models.Model):
    FEEDBACK_TYPE_CHOICES = [
        ("quality", "Quality"),
        ("relevance", "Relevance"),
        ("style", "Style"),
        ("accuracy", "Accuracy"),
        ("usefulness", "Usefulness"),
    ]
    SENTIMENT_CHOICES = [
        ("positive", "Positive"),
        ("neutral", "Neutral"),
        ("negative", "Negative"),
    ]
    topic = models.ForeignKey(Topic, null=True, blank=True, on_delete=models.CASCADE)
    task = models.ForeignKey(TaskLedgerEntry, null=True, blank=True, on_delete=models.CASCADE)
    raw_feedback = models.TextField()
    feedback_type = models.CharField(max_length=32, choices=FEEDBACK_TYPE_CHOICES)
    sentiment = models.CharField(max_length=32, choices=SENTIMENT_CHOICES)
    improvement_suggestion = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new and self.topic:
            MemoryRecord.objects.create(
                topic=self.topic,
                memory_type="feedback",
                content=self.raw_feedback,
                source=f"feedback_{self.id}",
                approved_for_reuse=False
            )

class EvaluationScorecard(models.Model):
    task = models.ForeignKey(TaskLedgerEntry, on_delete=models.CASCADE, related_name="scorecards")
    relevance = models.FloatField(null=True, blank=True)
    quality = models.FloatField(null=True, blank=True)
    evidence_strength = models.FloatField(null=True, blank=True)
    actionability = models.FloatField(null=True, blank=True)
    executive_readiness = models.FloatField(null=True, blank=True)
    style_alignment = models.FloatField(null=True, blank=True)
    local_context = models.FloatField(null=True, blank=True)
    novelty = models.FloatField(null=True, blank=True)
    user_score = models.FloatField(null=True, blank=True)
    hallucination_detected = models.BooleanField(default=False)
    overall_score = models.FloatField(null=True, blank=True)
    reviewer_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        scores = [
            self.relevance, self.quality, self.evidence_strength, 
            self.actionability, self.executive_readiness, self.style_alignment, 
            self.local_context, self.novelty, self.user_score
        ]
        valid_scores = [s for s in scores if s is not None]
        if valid_scores:
            self.overall_score = sum(valid_scores) / len(valid_scores)
        super().save(*args, **kwargs)

class WorkflowRun(models.Model):
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("awaiting_plan_approval", "Awaiting Plan Approval"),
        ("approved", "Approved"),
        ("running", "Running"),
        ("paused", "Paused"),
        ("completed", "Completed"),
        ("failed", "Failed"),
        ("cancelled", "Cancelled"),
    ]

    RUN_TYPE_CHOICES = [
        ("daily_plan", "Daily Plan"),
        ("task_execution", "Task Execution"),
        ("review_cycle", "Review Cycle"),
    ]

    topic = models.ForeignKey(Topic, on_delete=models.PROTECT, related_name="workflow_runs")
    run_type = models.CharField(max_length=64, choices=RUN_TYPE_CHOICES)
    status = models.CharField(max_length=64, choices=STATUS_CHOICES, default="draft")
    current_node = models.CharField(max_length=128, blank=True)
    state = models.JSONField(default=dict, blank=True)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="approved_workflow_runs",
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.status == "approved":
            if not self.approved_by or not self.approved_at:
                raise ValidationError("Must be approved via service (missing approved_by/approved_at)")
        super().clean()

class WorkflowStep(models.Model):
    STEP_TYPE_CHOICES = [
        ("planner", "Planner"),
        ("approval_gate", "Approval Gate"),
        ("worker", "Worker"),
        ("reviewer", "Reviewer"),
        ("evaluator", "Evaluator"),
        ("memory_update", "Memory Update"),
    ]
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("running", "Running"),
        ("paused", "Paused"),
        ("completed", "Completed"),
        ("failed", "Failed"),
        ("skipped", "Skipped"),
    ]

    workflow_run = models.ForeignKey(WorkflowRun, on_delete=models.CASCADE, related_name="steps")
    node_name = models.CharField(max_length=128)
    step_type = models.CharField(max_length=64, choices=STEP_TYPE_CHOICES)
    status = models.CharField(max_length=64, choices=STATUS_CHOICES, default="pending")
    
    input_state = models.JSONField(default=dict, blank=True)
    output_state = models.JSONField(default=dict, blank=True)
    telemetry = models.JSONField(default=dict, blank=True)
    
    error_message = models.TextField(blank=True)
    
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    sort_order = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class DailyPlan(models.Model):
    STATUS_CHOICES = [
        ("proposed", "Proposed"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
        ("completed", "Completed"),
    ]
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name="daily_plans")
    workflow_run = models.ForeignKey(WorkflowRun, on_delete=models.CASCADE, related_name="daily_plans")
    plan_date = models.DateField()
    status = models.CharField(max_length=64, choices=STATUS_CHOICES, default="proposed")
    summary = models.TextField(blank=True)
    plan_items = models.JSONField(default=list, blank=True)
    risk_summary = models.JSONField(default=dict, blank=True)
    diff_from_previous = models.JSONField(default=dict, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="approved_daily_plans",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.status == "approved":
            if not self.approved_by or not self.approved_at:
                raise ValidationError("DailyPlan cannot become approved without approved_by and approved_at")
        super().clean()

class ActionRequest(models.Model):
    ACTION_TYPES = [
        ("email_draft", "Email Draft"),
        ("email_send", "Email Send"),
        ("document_create", "Document Create"),
        ("stakeholder_update", "Stakeholder Update"),
        ("research_request", "Research Request"),
        ("follow_up_task", "Follow-up Task"),
    ]

    STATUS_CHOICES = [
        ("proposed", "Proposed"),
        ("drafted", "Drafted"),
        ("awaiting_approval", "Awaiting Approval"),
        ("approved", "Approved"),
        ("executed", "Executed"),
        ("rejected", "Rejected"),
        ("failed", "Failed"),
    ]

    topic = models.ForeignKey(Topic, on_delete=models.PROTECT, related_name="actions")
    task = models.ForeignKey(TaskLedgerEntry, null=True, blank=True, on_delete=models.SET_NULL)

    action_type = models.CharField(max_length=64, choices=ACTION_TYPES)
    title = models.CharField(max_length=255)
    instruction = models.TextField()

    status = models.CharField(max_length=64, choices=STATUS_CHOICES, default="proposed")
    risk_level = models.CharField(max_length=32, default="medium")
    approval_required = models.BooleanField(default=True)

    payload = models.JSONField(default=dict, blank=True)
    generated_output = models.JSONField(default=dict, blank=True)
    execution_result = models.JSONField(default=dict, blank=True)
    telemetry = models.JSONField(default=dict, blank=True)

    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="approved_actions",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_reason = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        from django.core.exceptions import ValidationError
        
        if self.action_type == "email_send" and not self.approval_required:
            raise ValidationError("For email_send, approval_required must be True")
            
        if self.status == "rejected" and not self.rejected_reason:
            raise ValidationError("rejected_reason is required when status is rejected")
            
        if self.status == "executed" and not self.execution_result:
            raise ValidationError("execution_result is required when status is executed")
            
        super().clean()

class ConversationSession(models.Model):
    ENTITY_CHOICES = [
        ("assistant", "Assistant"),
        ("executive", "Executive"),
    ]

    STATUS_CHOICES = [
        ("active", "Active"),
        ("archived", "Archived"),
    ]

    topic = models.ForeignKey(
        Topic,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="conversation_sessions",
    )
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    active_entity = models.CharField(
        max_length=32,
        choices=ENTITY_CHOICES,
        default="assistant",
    )
    title = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="active")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class ConversationMessage(models.Model):
    SENDER_CHOICES = [
        ("user", "User"),
        ("assistant", "Assistant"),
        ("executive", "Executive"),
        ("system", "System"),
    ]

    CHANNEL_CHOICES = [
        ("text", "Text"),
        ("voice", "Voice"),
    ]

    session = models.ForeignKey(
        ConversationSession,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    sender = models.CharField(max_length=32, choices=SENDER_CHOICES)
    channel = models.CharField(max_length=32, choices=CHANNEL_CHOICES, default="text")
    message_text = models.TextField()
    intent = models.CharField(max_length=100, blank=True)

    linked_topic = models.ForeignKey(Topic, null=True, blank=True, on_delete=models.SET_NULL)
    linked_task = models.ForeignKey(TaskLedgerEntry, null=True, blank=True, on_delete=models.SET_NULL)
    linked_action = models.ForeignKey(ActionRequest, null=True, blank=True, on_delete=models.SET_NULL)

    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class VoiceTranscriptRecord(models.Model):
    session = models.ForeignKey(ConversationSession, on_delete=models.CASCADE, related_name="transcripts")
    raw_audio_ref = models.CharField(max_length=255, blank=True)
    transcript_text = models.TextField()
    confidence = models.FloatField(null=True, blank=True)
    language = models.CharField(max_length=32, default="en-US")
    provider = models.CharField(max_length=64, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    telemetry = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class AgentDefinition(models.Model):
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name="agent_definitions")
    name = models.CharField(max_length=255)
    role = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    system_prompt = models.TextField()
    instructions = models.TextField(blank=True)
    input_schema = models.JSONField(default=dict, blank=True)
    output_schema = models.JSONField(default=dict)
    memory_scope = models.CharField(
        max_length=50,
        choices=[
            ("agent_only", "Agent Only"),
            ("workspace_shared", "Workspace Shared"),
            ("none", "No Memory"),
        ],
        default="agent_only",
    )
    rag_collection_id = models.CharField(max_length=255, blank=True)
    model_name = models.CharField(max_length=100, default="default")
    temperature = models.FloatField(default=0.2)
    position_x = models.FloatField(default=0)
    position_y = models.FloatField(default=0)
    is_entrypoint = models.BooleanField(default=False)
    is_terminal = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class AgentEdge(models.Model):
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name="agent_edges")
    source_agent = models.ForeignKey(
        AgentDefinition,
        on_delete=models.CASCADE,
        related_name="outgoing_edges",
    )
    target_agent = models.ForeignKey(
        AgentDefinition,
        on_delete=models.CASCADE,
        related_name="incoming_edges",
    )
    label = models.CharField(max_length=255, blank=True)
    data_mapping = models.JSONField(default=dict, blank=True)
    condition = models.JSONField(default=dict, blank=True)
    requires_approval = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

class AgentMemoryCollection(models.Model):
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE)
    agent = models.ForeignKey(AgentDefinition, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    collection_key = models.CharField(max_length=255, unique=True)
    visibility = models.CharField(
        max_length=50,
        choices=[
            ("private_to_agent", "Private to Agent"),
            ("workspace_shared", "Workspace Shared"),
        ],
        default="private_to_agent",
    )
    created_at = models.DateTimeField(auto_now_add=True)

from pgvector.django import VectorField

class AgentMemoryChunk(models.Model):
    collection = models.ForeignKey(
        AgentMemoryCollection,
        on_delete=models.CASCADE,
        related_name="chunks",
    )
    source_title = models.CharField(max_length=500)
    source_uri = models.TextField(blank=True)
    chunk_text = models.TextField()
    embedding = VectorField(dimensions=1536)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class ChainExecutionVersion(models.Model):
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name="chain_versions")
    version_number = models.PositiveIntegerField()
    status = models.CharField(
        max_length=50,
        choices=[
            ("draft", "Draft"),
            ("running", "Running"),
            ("paused", "Paused"),
            ("completed", "Completed"),
            ("failed", "Failed"),
            ("cancelled", "Cancelled"),
        ],
        default="draft",
    )
    trigger_input = models.JSONField(default=dict)
    graph_snapshot = models.JSONField(default=dict)
    started_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("topic", "version_number")

class AgentRunTrace(models.Model):
    execution_version = models.ForeignKey(
        ChainExecutionVersion,
        on_delete=models.CASCADE,
        related_name="agent_traces",
    )
    agent = models.ForeignKey(AgentDefinition, on_delete=models.PROTECT)
    run_order = models.PositiveIntegerField()
    status = models.CharField(
        max_length=50,
        choices=[
            ("pending", "Pending"),
            ("running", "Running"),
            ("completed", "Completed"),
            ("failed", "Failed"),
            ("skipped", "Skipped"),
            ("awaiting_approval", "Awaiting Approval"),
        ],
        default="pending",
    )
    input_payload = models.JSONField(default=dict)
    mapped_input_payload = models.JSONField(default=dict)
    memory_context_used = models.JSONField(default=list)
    prompt_snapshot = models.TextField(blank=True)
    output_payload = models.JSONField(default=dict)
    validation_result = models.JSONField(default=dict)
    telemetry = models.JSONField(default=dict)
    active_experiments = models.ManyToManyField('AgentImprovementExperiment', blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

class AgentArtifact(models.Model):
    execution_version = models.ForeignKey(ChainExecutionVersion, on_delete=models.CASCADE)
    agent_trace = models.ForeignKey(AgentRunTrace, on_delete=models.CASCADE)
    artifact_type = models.CharField(
        max_length=100,
        choices=[
            ("markdown", "Markdown"),
            ("html", "HTML"),
            ("json", "JSON"),
            ("document", "Document"),
            ("table", "Table"),
            ("image_reference", "Image Reference"),
        ],
    )
    title = models.CharField(max_length=500)
    content = models.TextField(blank=True)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class ResearchBrief(models.Model):
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE)
    task = models.OneToOneField(TaskLedgerEntry, on_delete=models.CASCADE)
    objective = models.TextField()
    research_questions = models.JSONField(default=list)
    status = models.CharField(max_length=50, default="draft")


class SourceRecord(models.Model):
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name="source_records")
    agent_trace = models.ForeignKey("AgentRunTrace", on_delete=models.SET_NULL, null=True, blank=True, related_name="sources")
    title = models.CharField(max_length=500)
    url = models.URLField(max_length=2000, blank=True)
    publisher = models.CharField(max_length=255, blank=True)
    source_type = models.CharField(max_length=100, default="web")
    content_summary = models.TextField(blank=True)
    relevance_score = models.IntegerField(default=0)
    retrieved_at = models.DateTimeField(auto_now_add=True)

class ManualSource(models.Model):
    agent = models.ForeignKey(AgentDefinition, on_delete=models.CASCADE, related_name="manual_sources")
    title = models.CharField(max_length=500)
    url = models.URLField(max_length=2000, blank=True)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} (Agent: {self.agent.name})"


class EvidenceQuote(models.Model):
    source = models.ForeignKey(SourceRecord, on_delete=models.CASCADE)
    task = models.ForeignKey(TaskLedgerEntry, on_delete=models.CASCADE)
    quote = models.TextField()
    interpretation = models.TextField()
    relevance = models.TextField()
    confidence = models.FloatField(default=0.7)


class ResearchFinding(models.Model):
    task = models.ForeignKey(TaskLedgerEntry, on_delete=models.CASCADE)
    finding = models.TextField()
    evidence = models.ManyToManyField(EvidenceQuote)
    implication = models.TextField()
    confidence = models.FloatField(default=0.7)


class ResearchDocument(models.Model):
    task = models.OneToOneField(TaskLedgerEntry, on_delete=models.CASCADE)
    title = models.CharField(max_length=500)
    markdown = models.TextField()
    html = models.TextField(blank=True)
    doc_type = models.CharField(max_length=100, default="research_report")
    status = models.CharField(max_length=50, default="draft")

# ----------------------------------------------------------------------------
# Prompt Library Subsystem
# ----------------------------------------------------------------------------

class PromptTemplate(models.Model):
    name = models.CharField(max_length=255)
    category = models.CharField(
        max_length=100,
        choices=[
            ("safety", "Safety"),
            ("research", "Research"),
            ("reasoning", "Reasoning"),
            ("writing", "Writing"),
            ("evaluation", "Evaluation"),
            ("memory", "Memory"),
            ("improvement_rule", "Improvement Rule"),
            ("custom", "Custom"),
        ],
    )
    description = models.TextField(blank=True)
    prompt_body = models.TextField()
    version = models.IntegerField(default=1)
    is_system_prompt = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    created_at = models.DateTimeField(auto_now_add=True)


class PromptTemplateVersion(models.Model):
    prompt_template = models.ForeignKey(PromptTemplate, on_delete=models.CASCADE)
    version_number = models.IntegerField()
    prompt_body = models.TextField()
    changelog = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class AgentPromptAssignment(models.Model):
    agent = models.ForeignKey(
        AgentDefinition,
        on_delete=models.CASCADE,
        related_name="prompt_assignments",
    )
    prompt_template = models.ForeignKey(PromptTemplate, on_delete=models.CASCADE)
    sort_order = models.IntegerField(default=0)
    enabled = models.BooleanField(default=True)
    required = models.BooleanField(default=True)


class PromptExecutionTrace(models.Model):
    agent_trace = models.ForeignKey(AgentRunTrace, on_delete=models.CASCADE)
    prompt_template = models.ForeignKey(PromptTemplate, on_delete=models.PROTECT)
    version_number = models.IntegerField()
    prompt_snapshot = models.TextField()
    execution_order = models.IntegerField()

    def __str__(self):
        return f"Trace for {self.agent_trace.agent.name} - Template {self.prompt_template.name} v{self.version_number}"

class PromptVersionMetrics(models.Model):
    prompt_version = models.OneToOneField(
        PromptTemplateVersion,
        on_delete=models.CASCADE,
        related_name="metrics"
    )
    tasks_used_count = models.PositiveIntegerField(default=0)
    acceptance_rate = models.FloatField(default=0.0)
    average_executive_score = models.FloatField(default=0.0)
    average_user_score = models.FloatField(default=0.0)
    failure_rate = models.FloatField(default=0.0)
    hallucination_rate = models.FloatField(default=0.0)
    last_calculated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Metrics for {self.prompt_version.prompt_template.name} v{self.prompt_version.version_number}"

class PromptPack(models.Model):
    key = models.CharField(max_length=255, unique=True)
    name = models.CharField(max_length=255)
    templates = models.ManyToManyField(PromptTemplate, related_name="packs")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )

    def __str__(self):
        return self.name

class EvaluationTemplate(models.Model):
    name = models.CharField(max_length=255)
    category = models.CharField(
        max_length=100,
        choices=[
            ("quality", "Quality"),
            ("evidence", "Evidence"),
            ("strategy", "Strategy"),
            ("product", "Product"),
            ("executive", "Executive"),
            ("safety", "Safety"),
            ("writing", "Writing"),
            ("custom", "Custom"),
        ],
    )
    description = models.TextField()
    evaluation_prompt = models.TextField()
    version = models.IntegerField(default=1)
    scoring_schema = models.JSONField(default=dict)
    score_field = models.CharField(max_length=50, default="score", help_text="The JSON key in the output schema containing the numeric score")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} (v{self.version})"

class EvaluationPack(models.Model):
    key = models.CharField(max_length=255, unique=True)
    name = models.CharField(max_length=255)
    templates = models.ManyToManyField(EvaluationTemplate, related_name="packs")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )

    def __str__(self):
        return self.name

class EvaluationAssignment(models.Model):
    agent = models.ForeignKey(AgentDefinition, on_delete=models.CASCADE)
    evaluation_template = models.ForeignKey(EvaluationTemplate, on_delete=models.CASCADE)
    enabled = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ['sort_order']

    def __str__(self):
        return f"{self.agent.name} -> {self.evaluation_template.name}"

class EvaluationRun(models.Model):
    agent_trace = models.ForeignKey(AgentRunTrace, on_delete=models.CASCADE)
    evaluation_template = models.ForeignKey(EvaluationTemplate, on_delete=models.PROTECT)
    result = models.JSONField()
    overall_score = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Run {self.id} - Score: {self.overall_score}"

class AgentEvaluationHistory(models.Model):
    agent = models.ForeignKey(AgentDefinition, on_delete=models.CASCADE)
    execution_version = models.ForeignKey(ChainExecutionVersion, on_delete=models.CASCADE)
    overall_score = models.FloatField()
    quality_score = models.FloatField(default=0.0)
    evidence_score = models.FloatField(default=0.0)
    executive_score = models.FloatField(default=0.0)
    hallucination_score = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"History for {self.agent.name} (Score: {self.overall_score})"

class AgentImprovementRecommendation(models.Model):
    agent = models.ForeignKey(AgentDefinition, on_delete=models.CASCADE)
    execution_version = models.ForeignKey(ChainExecutionVersion, on_delete=models.CASCADE)
    agent_trace = models.ForeignKey(AgentRunTrace, on_delete=models.CASCADE)
    applied_assignment = models.ForeignKey('AgentPromptAssignment', null=True, blank=True, on_delete=models.SET_NULL)

    issue_type = models.CharField(max_length=100)
    source_evaluation = models.CharField(max_length=255)
    
    # Separating diagnosis from the actionable fix
    root_cause_diagnosis = models.TextField(blank=True, help_text="The detected root cause underlying the low score")
    problem = models.TextField(help_text="Detailed problem description")
    recommended_change = models.TextField(help_text="Actionable fix recommendation")
    
    confidence_score = models.FloatField(default=0.0, help_text="Computed confidence in this recommendation")
    recurring_count = models.IntegerField(default=1, help_text="Number of times this issue was observed")

    target_area = models.CharField(
        max_length=50,
        choices=[
            ("prompt", "Prompt"),
            ("memory", "Memory"),
            ("rag_sources", "RAG Sources"),
            ("output_schema", "Output Schema"),
            ("tooling", "Tooling"),
            ("workflow", "Workflow"),
            ("human_instruction", "Human Instruction Needed"),
        ],
    )

    status = models.CharField(
        max_length=50,
        default="proposed",
        choices=[
            ("proposed", "Proposed"),
            ("accepted", "Accepted"),
            ("rejected", "Rejected"),
            ("applied", "Applied"),
            ("monitoring", "Monitoring"),
            ("successful", "Successful"),
            ("failed", "Failed"),
            ("rolled_back", "Rolled Back"),
        ],
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"[{self.status}] {self.issue_type} for {self.agent.name}"

class AgentImprovementExperiment(models.Model):
    recommendation = models.ForeignKey(AgentImprovementRecommendation, on_delete=models.CASCADE)
    agent = models.ForeignKey(AgentDefinition, on_delete=models.CASCADE)

    baseline_score = models.FloatField()
    post_change_score = models.FloatField(null=True, blank=True)
    delta = models.FloatField(null=True, blank=True)

    status = models.CharField(
        max_length=50,
        choices=[
            ("monitoring", "Monitoring"),
            ("successful", "Successful"),
            ("failed", "Failed"),
            ("rolled_back", "Rolled Back"),
        ],
        default="monitoring",
    )

    runs_observed = models.IntegerField(default=0)
    failure_reason = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

class HumanOutputReview(models.Model):
    agent_trace = models.ForeignKey(AgentRunTrace, on_delete=models.CASCADE)
    reviewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    
    status = models.CharField(
        max_length=50,
        choices=[
            ("accepted_unchanged", "Accepted Unchanged"),
            ("accepted_with_edits", "Accepted With Edits"),
            ("rejected", "Rejected"),
        ]
    )
    edited_sections = models.JSONField(default=dict, blank=True)
    feedback_reason = models.TextField(blank=True)
    score = models.IntegerField(null=True, blank=True, help_text="Human score out of 10")
    created_at = models.DateTimeField(auto_now_add=True)
