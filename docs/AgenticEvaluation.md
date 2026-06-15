Right now you have:

Prompt Library
=
How an agent thinks

But you also need:

Evaluation Library
=
How an agent is judged

These should be completely separate.

Most AI systems make the mistake of using the same prompt to generate and evaluate.

That creates:

Agent
evaluates
its own work

which leads to inflated quality scores.

Instead:

Agent produces work
↓
Independent Evaluators assess work
↓
Scores stored
↓
Trend analysis
↓
Agent improvements measured

This becomes one of the core competitive advantages of StrategyPad.

Architecture

Create a new subsystem:

Evaluation Library

Equivalent to Prompt Library.

Prompt Library
Prompt Packs

Evaluation Library
Evaluation Packs
High-Level Model
Agent
   ↓
Output

Evaluators
   ↓

Quality Score
Relevance Score
Evidence Score
Executive Score
Safety Score
etc

Stored in:
AgentEvaluationResult
Core Components
EvaluationTemplate
EvaluationPack
EvaluationAssignment
EvaluationRun
EvaluationMetric
EvaluationTrend
Data Model
EvaluationTemplate
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

    created_at = models.DateTimeField(auto_now_add=True)
EvaluationAssignment
class EvaluationAssignment(models.Model):
    agent = models.ForeignKey(
        AgentDefinition,
        on_delete=models.CASCADE,
    )

    evaluation_template = models.ForeignKey(
        EvaluationTemplate,
        on_delete=models.CASCADE,
    )

    enabled = models.BooleanField(default=True)

    sort_order = models.IntegerField(default=0)
EvaluationRun
class EvaluationRun(models.Model):
    agent_trace = models.ForeignKey(
        AgentRunTrace,
        on_delete=models.CASCADE,
    )

    evaluation_template = models.ForeignKey(
        EvaluationTemplate,
        on_delete=models.PROTECT,
    )

    result = models.JSONField()

    overall_score = models.FloatField()

    created_at = models.DateTimeField(auto_now_add=True)
Evaluation Packs

Just like Prompt Packs.

Research Evaluation Pack
Strategy Evaluation Pack
Executive Evaluation Pack
Product Evaluation Pack
Writing Evaluation Pack
Safety Evaluation Pack
Default Evaluation Library
Quality Evaluation

Category:

Quality

Purpose:

Is the work well structured and complete?

Metrics:

{
  "clarity": 10,
  "completeness": 10,
  "structure": 10,
  "accuracy": 10,
  "overall": 10
}

Prompt:

Evaluate:

1. Clarity
2. Completeness
3. Structure
4. Accuracy

Provide:
- score 1-10
- strengths
- weaknesses
- improvement suggestions
Evidence Quality

Category:

Evidence

Measures:

How well is the output supported?

Metrics:

{
  "source_count": 10,
  "source_quality": 10,
  "citation_coverage": 10,
  "evidence_strength": 10
}

Prompt:

Evaluate:

- number of sources
- source quality
- evidence support
- unsupported claims

Identify all claims lacking evidence.
Hallucination Risk

Category:

Safety

Metrics:

{
  "unsupported_claims": 10,
  "confidence_alignment": 10,
  "fact_support": 10
}

Prompt:

Identify:

- unsupported claims
- invented facts
- misleading certainty

Calculate hallucination risk score.
Product Evaluation

Category:

Product

Metrics:

{
  "customer_focus": 10,
  "business_value": 10,
  "kpi_quality": 10,
  "tradeoff_analysis": 10
}
Strategy Evaluation

Category:

Strategy

Metrics:

{
  "strategic_depth": 10,
  "options_quality": 10,
  "risk_analysis": 10,
  "decision_support": 10
}
Executive Readiness

Category:

Executive

Metrics:

{
  "decision_readiness": 10,
  "brevity": 10,
  "actionability": 10,
  "confidence": 10
}
Writing Quality

Category:

Writing

Metrics:

{
  "readability": 10,
  "flow": 10,
  "consistency": 10,
  "grammar": 10
}
Evaluation Packs
Research Pack
Quality Evaluation
Evidence Quality
Hallucination Risk
Product Pack
Quality Evaluation
Product Evaluation
Evidence Quality
Strategy Pack
Quality Evaluation
Strategy Evaluation
Evidence Quality
Executive Readiness
Executive Pack
Executive Readiness
Counter Argument Quality
Evidence Quality
Multi-Evaluator Pattern

Instead of:

1 evaluator

Use:

Quality Evaluator
Evidence Evaluator
Executive Evaluator
Safety Evaluator

Then aggregate.

overall_score = weighted_average(
    quality=0.25,
    evidence=0.30,
    executive=0.20,
    safety=0.25
)
Agent Improvement Framework

This is where it becomes powerful.

Every run stores:

AgentEvaluationHistory
class AgentEvaluationHistory(models.Model):
    agent = models.ForeignKey(
        AgentDefinition,
        on_delete=models.CASCADE,
    )

    execution_version = models.ForeignKey(
        ChainExecutionVersion,
        on_delete=models.CASCADE,
    )

    overall_score = models.FloatField()

    quality_score = models.FloatField()

    evidence_score = models.FloatField()

    executive_score = models.FloatField()

    hallucination_score = models.FloatField()

    created_at = models.DateTimeField(auto_now_add=True)
Agent Learning Metrics

Track:

Average Score
30-Day Trend
Improvement %
Best Score
Worst Score
Acceptance Rate
Revision Rate
Executive Approval Rate
Workflow Statistics UI

Every agent node should show:

Research Agent

Current Run:
92/100

Trend:
↑ +8%

Acceptance:
89%

Revision Rate:
11%

Average Evidence:
9.1

Average Executive:
8.7
Agent Node UI
+--------------------------------+
| Research Agent                 |
+--------------------------------+

Score
92

Trend
↑ 8%

Runs
245

Acceptance
89%

Revisions
11%

Node border colors:

90-100 Green
80-89 Blue
70-79 Orange
<70 Red
Workflow Analytics Dashboard

New tab:

Workflow Analytics
Agent Performance
Agent
Score
Trend
Runs

Research
92
↑8
245

Writer
87
↑4
245

Reviewer
91
↑2
245
Evaluation Heatmap
                Jan Feb Mar Apr

Quality         82  85  88  91

Evidence        78  80  85  89

Executive       70  75  82  88

Safety          95  96  96  97
Improvement Timeline
Research Agent

92
90
88
86
84
82
80

Shows whether prompt changes actually improved output.

Version-to-Version Comparison

User selects:

Run #14
Run #15

See:

Quality:
+5

Evidence:
+12

Executive:
+3

Hallucination:
-8
Prompt Effectiveness Dashboard

Because you already have:

PromptExecutionTrace

you can correlate:

Prompt Version
vs
Evaluation Score

Example:

Hallucination Avoidance

v1 → 82

v2 → 88

v3 → 93

Now you know which prompts improve results.

Executive Dashboard

For your use case as a PM and strategist:

Digital Twin Health

Overall Score
89

Quality
91

Evidence
87

Executive Readiness
88

Safety
95

Improvement
+6% last 30 days

Top Weakness:
Evidence coverage

Top Improvement:
Executive summaries
Most Important Additional Metric

Add:

Human Acceptance Rate

Track:

Output accepted without change
Output accepted with edits
Output rejected

This is often the strongest real-world measure of agent quality.

Research Agent

Accepted unchanged:
63%

Accepted with edits:
29%

Rejected:
8%

That becomes a far better signal than model-generated scores alone.

Final Recommendation

Add a parallel system:

Prompt Library
→ controls generation

Evaluation Library
→ controls judging

Prompt Packs
Evaluation Packs

Prompt Execution Trace
Evaluation Execution Trace

Agent Scores
Workflow Scores
Trend Analysis
Human Acceptance Metrics

Then surface the following directly on the workflow graph:

Node Score
Trend
Acceptance Rate
Revision Rate
Evidence Score
Executive Score
Hallucination Score

and provide a dedicated Workflow Analytics view that lets you measure whether agents, prompts, and workflows are actually improving over time rather than simply producing more output.