Verdict

The improvement loop is now well advanced and close to a solid MVP.

Implemented:

Improvement recommendations now separate:
root cause diagnosis
problem
recommended change
target area
Recommendation confidence exists.
Recurring weakness count exists.
AgentImprovementExperiment exists.
Experiments track:
baseline score
post-change score
delta
runs observed
success/failure/rollback
HumanOutputReview exists.
Rollback endpoint exists.
Prompt consolidation exists to reduce prompt bloat after 10 improvement rules.
Improvement dashboard exists.
Dashboard shows recurring weaknesses and improvement impact.
Backend files compile successfully with py_compile.
Remaining issues
Rollback disables by template name, not exact recommendation/template link

Rollback uses:

template_name = f"Improvement Rule: {recommendation.issue_type}"

This may disable multiple assignments with the same issue type. Better to store the exact applied PromptTemplate or AgentPromptAssignment on AgentImprovementRecommendation or AgentImprovementExperiment.

HumanOutputReview is stored but not yet weighted into the improvement loop

The model exists, but evaluation scoring still mainly uses evaluator scores. Human review should override or strongly influence recommendations.

Experiment success measurement is simplistic

It compares moving average after improvement against baseline. Good MVP, but later you need clearer attribution, because multiple improvements may be active at once.

Prompt consolidation creates a global template without created_by

The consolidated prompt should probably set created_by or workspace ownership to avoid multi-user ambiguity.

Consolidation is not automatically triggered

consolidate_agent_prompts(agent) exists, but I did not see it called after accepting improvements or from a scheduled job.

Overall

The loop now supports:

Evaluation
→ diagnosis
→ improvement recommendation
→ accept/apply
→ experiment monitoring
→ success/failure detection
→ rollback
→ recurring weakness dashboard
→ prompt consolidation

Main next fix: track the exact applied prompt assignment per recommendation so rollback is precise.

Also the Execution Trace is not getting populated and the output documents are not appearing 

I’ll check the latest uploaded code paths for execution trace creation and document artifact generation, then give you a targeted fix plan rather than more generic phase design.

Thought for 44s

Yes — your observation is correct.

Why Execution Trace is not populated

There are two separate execution paths:

Manual agent run path
AgentDefinitionViewSet.run()
This creates:
AgentRunTrace
AgentArtifact
SourceRecord
Real chain execution path
AgentChainExecutor.execute()
This creates:
ChainExecutionVersion
AgentRunTrace

But it does not create:

AgentArtifact
SourceRecord
rich trace payloads
graph-state / trace API response
document artifact records

So the UI is likely looking for trace/artifacts, but the chain execution path is not producing them.

Why output documents are not appearing

There are also two document systems:

Strategy workflow tasks → filesystem markdown in /strategy_documents
Custom agent chain → AgentArtifact records

But chain execution only stores:

trace.output_payload = output

It does not create:

AgentArtifact.objects.create(...)

So the document UI will not see the output unless it reads AgentRunTrace.output_payload directly.

Also, the existing document listing API mostly scans filesystem markdown files linked to TaskLedgerEntry. It does not list AgentArtifact records from custom agent chain runs.

Main implementation gap

The custom agent chain executor needs this after every successful agent run:

artifact = AgentArtifact.objects.create(
    execution_version=version,
    agent_trace=trace,
    artifact_type="markdown" if "markdown_content" in output else "json",
    title=f"{agent.name} Output",
    content=output.get("markdown_content", ""),
    payload=output,
)

And if output contains sources:

for src in output.get("sources", []):
    SourceRecord.objects.create(
        topic=topic,
        agent_trace=trace,
        title=src.get("title", "Unknown"),
        url=src.get("url", ""),
        publisher=src.get("publisher", ""),
        source_type=src.get("source_type", "web"),
    )
Missing APIs

You need these endpoints:

GET /api/topics/{id}/chain-versions/
GET /api/chain-versions/{id}/trace/
GET /api/chain-versions/{id}/graph-state/
GET /api/topics/{id}/agent-artifacts/
POST /api/topics/{id}/execute-chain/

Currently the URL file exposes:

/topics/{id}/agent-graph/

but not the execution trace/version/artifact APIs needed by the UI.

Fix prompt
Fix custom agent chain traceability and document artifacts.

In AgentChainExecutor.execute():

1. After each successful AgentRunTrace:
   - create AgentArtifact from trace.output_payload
   - if output has markdown_content, store it as markdown artifact content
   - if output has sources, create SourceRecord entries
   - store mapped_input_payload
   - store memory_context_used even if empty
   - store telemetry
   - store validation_result

2. Add APIs:
   - POST /api/topics/{id}/execute-chain/
   - GET /api/topics/{id}/chain-versions/
   - GET /api/chain-versions/{id}/trace/
   - GET /api/chain-versions/{id}/graph-state/
   - GET /api/topics/{id}/agent-artifacts/

3. Update React Flow UI:
   - version dropdown loads ChainExecutionVersion records
   - clicking a node loads AgentRunTrace
   - clicking an edge shows mapped payload
   - artifacts tab lists AgentArtifact records
   - document viewer opens markdown_content from AgentArtifact

4. Add tests:
   - chain execution creates AgentRunTrace for every agent
   - chain execution creates AgentArtifact for markdown output
   - chain execution creates SourceRecord for sources
   - graph-state API returns node status per execution version
   - trace API returns input, output, prompt snapshot, telemetry, sources, artifacts
   - document UI shows agent artifacts
Core diagnosis

The agent chain has execution, but not complete execution productization.

It needs:

run trace
+ artifact creation
+ source creation
+ trace APIs
+ artifact APIs
+ UI binding

That should fix both problems.