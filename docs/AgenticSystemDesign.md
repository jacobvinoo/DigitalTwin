this should be designed as a second workspace type, but I would still extend Topic with workspace_type. That keeps dashboards, permissions, documents, and task history unified while allowing different workspace behaviour.

Anthropic’s guidance strongly supports this direction: start with simple composable workflows, keep prompts/responses transparent, avoid unnecessary framework abstraction, use human approval before high-stakes actions, and make the agent’s plan/work visible without overwhelming the user.

Recommended model
Workspace Type 1:
Strategy Workspace
- fixed assistant/product/strategy/executive agents
- predefined workflows

Workspace Type 2:
Custom Agent Chain Workspace
- user-defined agents
- user-defined instructions
- user-defined RAG memory
- user-defined output schemas
- visual graph execution
- versioned traceability
Key design correction

Do not think of this as “agents freely talking to each other.”

Think of it as:

User-configured workflow graph
+
agent nodes
+
typed inputs/outputs
+
versioned execution trace
+
human approval controls

That aligns better with Anthropic’s distinction between predictable workflows and more autonomous agents. Workflows follow predefined code paths, while agents dynamically direct their own process; for this product, the safer default is workflow-first with controlled autonomy later.

Core architecture
Topic
 └── workspace_type = strategy | custom_agent_chain

Custom Agent Chain Workspace
 ├── AgentDefinition
 ├── AgentEdge
 ├── AgentMemoryCollection
 ├── AgentInputSchema
 ├── AgentOutputSchema
 ├── ChainExecutionVersion
 ├── AgentRunTrace
 ├── AgentArtifact
 └── ChainAuditLog
Data model
Extend Topic
class Topic(models.Model):
    WORKSPACE_TYPES = [
        ("strategy", "Strategy Workspace"),
        ("custom_agent_chain", "Custom Agent Chain Workspace"),
    ]

    workspace_type = models.CharField(
        max_length=50,
        choices=WORKSPACE_TYPES,
        default="strategy",
    )
AgentDefinition
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
AgentEdge
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

data_mapping example:

{
  "summary": "research_summary",
  "evidence_table": "source_evidence",
  "recommendations": "draft_inputs.recommendations"
}
AgentMemoryCollection

Use pgvector first, not Pinecone. Since the app already uses Django/Postgres, pgvector is cheaper, simpler, easier to permission, and easier to trace.

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
AgentMemoryChunk
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
Versioned execution trace

This is the most important part.

ChainExecutionVersion
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

graph_snapshot is critical. It freezes the graph at execution time so later edits do not corrupt old traceability.

AgentRunTrace
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

    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
AgentArtifact
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
Execution pattern

The chain should support Anthropic’s composable workflow patterns:

Prompt chaining:
Researcher → Synthesizer → Writer → Reviewer

Routing:
Classifier → Product Agent OR Strategy Agent OR Risk Agent

Parallelization:
Researcher A + Researcher B + Researcher C → Aggregator

Evaluator-optimizer:
Writer → Reviewer → Revision Writer

Orchestrator-workers:
Optional later, only after the deterministic graph works

Anthropic recommends simple composable patterns first and adding complexity only when it improves outcomes.

Chain execution lifecycle
1. User creates Custom Agent Chain Workspace
2. User adds agents visually
3. User defines each agent:
   - role
   - instructions
   - RAG collection
   - input schema
   - output schema
4. User connects agents with edges
5. System validates graph
6. User runs chain
7. System creates ChainExecutionVersion
8. System snapshots graph
9. Each agent runs in order
10. Each agent stores:
   - exact input
   - mapped input
   - memory chunks used
   - prompt snapshot
   - output
   - validation result
   - telemetry
11. UI shows versioned graph trace
Graph validation rules

Before execution:

- exactly one entrypoint unless parallel start enabled
- no cycles unless loop nodes are explicitly enabled
- every edge has valid source and target
- each target input schema can be satisfied by source output mapping
- every agent has output schema
- every agent has instructions
- every RAG collection belongs to same workspace/user
- high-risk tools require approval
Dynamic execution engine

Do not allow LLMs to decide the graph path by default. The user’s graph controls execution.

class AgentChainExecutor:
    def execute(self, *, topic, user, trigger_input):
        graph = self.load_graph(topic)
        self.validate_graph(graph)

        version = self.create_execution_version(
            topic=topic,
            user=user,
            trigger_input=trigger_input,
            graph_snapshot=graph.to_snapshot(),
        )

        for agent in self.topological_sort(graph):
            trace = self.run_agent(
                version=version,
                agent=agent,
                upstream_outputs=self.collect_upstream_outputs(agent, version),
            )

            if trace.status == "failed":
                version.status = "failed"
                version.save(update_fields=["status"])
                break

        version.status = "completed"
        version.completed_at = timezone.now()
        version.save(update_fields=["status", "completed_at"])

        return version
Agent execution node
def run_agent(self, *, version, agent, upstream_outputs):
    input_payload = self.build_input_payload(agent, upstream_outputs)

    memory_context = self.retrieve_agent_memory(
        agent=agent,
        query=json.dumps(input_payload),
    )

    prompt = self.build_prompt(
        agent=agent,
        input_payload=input_payload,
        memory_context=memory_context,
    )

    trace = AgentRunTrace.objects.create(
        execution_version=version,
        agent=agent,
        input_payload=input_payload,
        memory_context_used=memory_context,
        prompt_snapshot=prompt,
        status="running",
        started_at=timezone.now(),
    )

    try:
        output = self.llm_client.complete_json(
            prompt=prompt,
            output_schema=agent.output_schema,
            model=agent.model_name,
        )

        validation = validate_json_schema(output, agent.output_schema)

        trace.output_payload = output
        trace.validation_result = validation
        trace.status = "completed"
        trace.completed_at = timezone.now()
        trace.save()

        return trace

    except Exception as exc:
        trace.status = "failed"
        trace.validation_result = {"error": str(exc)}
        trace.completed_at = timezone.now()
        trace.save()
        return trace
UI design
Workspace creation
Create Workspace
 ├── Strategy Workspace
 └── Custom Agent Chain Workspace

Custom Agent Chain setup:

Workspace Name
Goal
Default input format
Execution mode:
- Run all automatically
- Require approval between agents
- Require approval before terminal artifact
Agent Chain Builder UI

Use React Flow.

+------------------------------------------------------+
| Custom Agent Chain: Market Research Workflow          |
| [Run] [Validate] [Version History]                    |
+-----------------------------+------------------------+
| Graph Canvas                | Agent Config Panel      |
|                             |                        |
| [Researcher] ──> [Writer] ──> [Reviewer]             |
|                             | Name                   |
|                             | Instructions           |
|                             | Input Schema           |
|                             | Output Schema          |
|                             | RAG Sources            |
|                             | Test Agent             |
+-----------------------------+------------------------+
Node display

Each node should show:

Agent Name
Role
Memory scope
Output schema status
Latest run status

Statuses:

grey = not run
blue = running
green = completed
orange = awaiting approval
red = failed
purple = revised
Traceability Inspector
Version: Run #4
Started: 14 Jun 2026, 9:42 AM
Status: Completed

Graph:
Researcher ✓ → Writer ✓ → Reviewer ✓

Selected Agent: Writer

Input:
- research_summary from Researcher
- evidence_table from Researcher

Memory Used:
- chunk 12 from uploaded Search Metrics PDF
- chunk 4 from Algolia Notes

Prompt Snapshot:
[collapsed]

Output:
- markdown document
- recommendations
- risks

Telemetry:
- model
- tokens
- cost
- duration

Upstream / Downstream:
Researcher output → Writer input → Reviewer critique
Key UX requirement

The user must be able to click an edge and see:

What exactly moved across this connection?

Edge inspector:

Source Agent: Researcher
Target Agent: Writer

Mapping:
research_summary → draft_context.summary
evidence_table → draft_context.evidence
recommendations → draft_context.recommendations

Last Execution Version:
Run #4

Actual Payload:
{ ... }
Output format design

Use both:

Predefined templates
+
Advanced JSON Schema

For normal users:

Output type:
- Research Brief
- Strategy Memo
- Product Requirement
- Risk Register
- Executive Summary
- Table
- Custom JSON

For advanced users:

Edit JSON Schema

This avoids forcing users to write raw schema from scratch.

RAG design decision

Start with:

Postgres + pgvector

Reasons:

- already fits Django
- simpler permissions
- easier per-agent isolation
- cheaper
- easier traceability
- good enough for MVP

Later add Pinecone/Weaviate only if:

- document volume is very large
- latency becomes an issue
- semantic filtering needs become complex
- enterprise customers require managed vector infra
Approval modes

Per workspace:

Execution Mode:
1. Fully supervised
   - approval required before every agent handoff

2. Semi-supervised
   - approval required only for high-risk agents or external actions

3. Automatic read-only
   - runs all read-only/internal agents
   - pauses before external tools or publishing

Anthropic’s safety framework supports this: agents should retain human oversight before high-stakes decisions, and read-only permissions are a safer default before actions that modify systems.

API design
POST   /api/topics/
       workspace_type=custom_agent_chain

GET    /api/topics/{id}/agent-graph/
PUT    /api/topics/{id}/agent-graph/

POST   /api/topics/{id}/agents/
PATCH  /api/agents/{id}/
DELETE /api/agents/{id}/

POST   /api/topics/{id}/edges/
PATCH  /api/edges/{id}/
DELETE /api/edges/{id}/

POST   /api/topics/{id}/validate-chain/
POST   /api/topics/{id}/execute-chain/

GET    /api/topics/{id}/chain-versions/
GET    /api/chain-versions/{id}/trace/
GET    /api/chain-versions/{id}/graph-state/

POST   /api/agents/{id}/memory/upload/
GET    /api/agents/{id}/memory/
Tests
Backend tests
1. Can create Topic with workspace_type=custom_agent_chain.
2. Can create AgentDefinition under custom workspace.
3. AgentDefinition requires output_schema.
4. Can create AgentEdge between two agents.
5. Cannot create edge across different workspaces.
6. Graph validation fails if no entrypoint.
7. Graph validation fails if target input mapping is invalid.
8. Graph validation passes for Researcher → Writer → Reviewer.
9. Execution creates ChainExecutionVersion.
10. Execution snapshots graph.
11. Each agent run creates AgentRunTrace.
12. AgentRunTrace stores input_payload.
13. AgentRunTrace stores output_payload.
14. AgentRunTrace stores memory_context_used.
15. Editing agent after run does not change old graph_snapshot.
16. Edge inspector can reconstruct payload passed from one agent to another.
Frontend tests
1. User can create Custom Agent Chain Workspace.
2. User can add agent node.
3. User can edit agent instructions.
4. User can select output template.
5. User can upload memory source to agent.
6. User can connect two agents.
7. User can validate graph.
8. Invalid graph shows clear errors.
9. User can run graph.
10. Version dropdown appears after run.
11. Clicking node shows input/output trace.
12. Clicking edge shows mapped payload.
13. Previous execution version remains visible after graph edit.
Example workflow
Workspace:
Search Best Practices Research Chain

Agents:
1. Search Researcher
   Input: research_question
   Output: sources, evidence, findings

2. Product Synthesizer
   Input: findings
   Output: product_implications, metrics, risks

3. Document Writer
   Input: findings + implications
   Output: structured research document

4. Executive Reviewer
   Input: document
   Output: critique, missing evidence, recommendation
Suggested default templates
Researcher Agent
Role:
You are a research agent.

Instructions:
Find and extract evidence relevant to the research objective.
Do not write the final report.
Return structured findings with source references.

Output:
sources[]
evidence[]
findings[]
confidence_score
Writer Agent
Role:
You are a document writer.

Instructions:
Create a clear, structured document using only supplied evidence.
Do not invent references.
Flag missing evidence.

Output:
title
executive_summary
sections[]
references[]
open_questions[]
Reviewer Agent
Role:
You are an adversarial executive reviewer.

Instructions:
Assume the document may be incomplete or generic.
Identify missing evidence, weak claims, and unclear recommendations.
Do not rewrite the document unless asked.

Output:
overall_assessment
missing_evidence[]
weak_claims[]
recommendation
required_revisions[]
Final recommendation

Use:

Topic.workspace_type = custom_agent_chain
React Flow for graph editing
pgvector for per-agent RAG
JSON Schema + predefined templates for outputs
ChainExecutionVersion for versioning
AgentRunTrace for node-level traceability
AgentArtifact for outputs
Edge inspector for payload movement
Human approval modes for safety