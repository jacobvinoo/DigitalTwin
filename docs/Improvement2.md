Verified against the suggested improvement-loop design.

Verdict

Partially implemented, but not complete.

The code now has:

AgentImprovementRecommendation
recommendation UI in WorkflowAnalytics
accept endpoint
evaluation history model
evaluation runs created in AgentDefinitionViewSet.run()

But the improvement loop is still not properly wired into the real chain executor.

Main gaps
AgentChainExecutor does not run evaluations

strategy/chain_engine.py creates AgentRunTrace, but does not create:

EvaluationRun
AgentEvaluationHistory
AgentImprovementRecommendation

So full chain runs do not improve automatically.

Improvement only works in the manual agent run API

The logic exists in:

AgentDefinitionViewSet.run()

but not in the workflow chain execution path.

Accepting an improvement mutates agent.system_prompt directly

Current behaviour:

agent.system_prompt += "\n\nImprovement Rule: ..."

This works, but is risky. Better:

Accepted recommendation
→ create PromptTemplate or PromptAssignment
→ version it
→ next run uses it
Accepted recommendation status is wrong

The endpoint sets:

status = accepted

but does not distinguish:

accepted
vs
applied

If the prompt is already changed, status should become applied, or you need two steps.

Analytics still has mock fields

In workflow_analytics:

"acceptance": 100, # mock
"revisions": 0, # mock

So UI statistics are not fully real.

Evaluation configuration still has a bad rule

quality_score still requires:

100 unique sources for high score

That will distort behaviour. Source count belongs in evidence scoring, not quality scoring.

Permission filtering is weak

AgentImprovementRecommendationViewSet uses:

queryset = AgentImprovementRecommendation.objects.all()

It should filter by:

agent__topic__owner=request.user
Immediate fix

Move evaluation/improvement into a shared service:

run_post_agent_evaluation(agent_trace)

and call it from both:

AgentDefinitionViewSet.run()
AgentChainExecutor.execute()
Required repair prompt
Refactor the evaluation and improvement loop into a shared service.

Create:
strategy/evaluation_engine.py

Function:
run_post_agent_evaluation(agent_trace)

It must:
1. Load enabled EvaluationAssignment records for agent_trace.agent.
2. Run each EvaluationTemplate.
3. Create EvaluationRun.
4. Calculate aggregate quality_score, evidence_score, executive_score, hallucination_score.
5. Create AgentEvaluationHistory.
6. Generate AgentImprovementRecommendation for weak scores.
7. Return evaluation summary.

Call this function from:
- AgentDefinitionViewSet.run()
- AgentChainExecutor.execute() after each successful AgentRunTrace

Fix:
- AgentImprovementRecommendationViewSet queryset ownership filtering
- accepted/applied status handling
- remove mock analytics values
- remove 100-source requirement from quality_score

So: the improvement loop exists as a feature stub, but it is not yet reliable across workflow execution.