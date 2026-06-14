One of the biggest problems with most agent systems is that prompts become embedded inside agents:

Research Agent
 └── 400-line prompt

Writer Agent
 └── 300-line prompt

Reviewer Agent
 └── 250-line prompt

After a few months nobody knows:

which prompts are being used
which prompts are effective
which prompts are causing hallucinations
which prompts changed output quality

The better architecture is:

Agent
  =
Role
+
Instructions
+
Prompt Templates
+
Tools
+
Memory
+
Output Schema

This makes prompts reusable, versioned, testable and composable.

Recommended Architecture

Create a new subsystem:

Prompt Library

that behaves similarly to:

Code Libraries

or

Workflow Components
Core Concept

Instead of:

Research Agent Prompt

You build:

Hallucination Avoidance
Web Research
Citation Enforcement
Fact Validation
Executive Summary
Risk Analysis
Source Recording
Counter Argument
Evidence Extraction

Then an agent can be configured like:

Research Agent

Templates:
✓ Hallucination Avoidance
✓ Web Research
✓ Source Recording
✓ Evidence Extraction

Role Prompt:
Research Grocery Search Best Practices

Output:
ResearchFindingSchema
Data Model
PromptTemplate
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
AgentPromptAssignment
class AgentPromptAssignment(models.Model):
    agent = models.ForeignKey(
        AgentDefinition,
        on_delete=models.CASCADE,
        related_name="prompt_assignments",
    )

    prompt_template = models.ForeignKey(
        PromptTemplate,
        on_delete=models.CASCADE,
    )

    sort_order = models.IntegerField(default=0)

    enabled = models.BooleanField(default=True)

    required = models.BooleanField(default=True)
Prompt Composition Engine

At runtime:

Agent
+
Prompt Template 1
+
Prompt Template 2
+
Prompt Template 3
+
Agent Instructions
+
Task Context
+
Output Schema

becomes:

Final Prompt
Example Library
1 Hallucination Avoidance

Category:

Safety

Prompt:

You must only state information supported by:
1. User supplied information
2. Retrieved memory
3. Retrieved sources

Do not invent facts.

If evidence is insufficient:

Return:
UNKNOWN

For every major claim include:
- evidence source
- confidence score

Never present assumptions as facts.
2 Source Recording

Category:

Research

Prompt:

Every source used must be recorded.

For each source include:
- title
- publisher
- url
- retrieval timestamp

Create source references for future traceability.

Do not discard sources that influenced conclusions.
3 Web Research

Category:

Research

Prompt:

Search broadly before concluding.

Look for:
- primary sources
- official documentation
- industry benchmarks
- academic sources

Avoid relying on a single source.

Record all retrieved sources.
4 Evidence Extraction

Prompt:

Extract evidence before generating findings.

For each finding provide:
- supporting evidence
- source reference
- confidence level

Separate evidence from interpretation.
5 Counter Argument

Prompt:

For each recommendation:

Generate:
1. Supporting argument
2. Counter argument

Identify assumptions.

Highlight weak evidence.
6 Executive Summary

Prompt:

Summarize findings for an executive audience.

Focus on:
- decisions
- business impact
- risks
- opportunities

Avoid implementation detail unless critical.
7 Product Thinking

Useful for your Search PM workflows.

Prompt:

Translate findings into:

- customer impact
- business impact
- operational impact
- implementation complexity

Identify trade-offs.
8 Search Domain Prompt

Prompt:

When analysing search:

Consider:

- relevance
- recall
- precision
- semantic search
- query understanding
- ranking
- promoted placement
- customer intent
- search conversion
- zero result rate
- search abandonment

Reference grocery retail where relevant.
Visual UI

Agent Editor

+--------------------------------------+
| Research Agent                       |
+--------------------------------------+

Role:
Research Search Best Practices

Templates

☑ Hallucination Avoidance
☑ Web Research
☑ Source Recording
☑ Evidence Extraction
☑ Counter Argument

Output:
ResearchFindingSchema
Prompt Pipeline View

Users should see:

Prompt Composition

1. Hallucination Avoidance v3
2. Web Research v2
3. Source Recording v1
4. Evidence Extraction v2
5. Agent Instructions
6. Output Schema

Clicking shows the actual prompt.

Versioning

Critical feature.

class PromptTemplateVersion(models.Model):
    prompt_template = models.ForeignKey(
        PromptTemplate,
        on_delete=models.CASCADE,
    )

    version_number = models.IntegerField()

    prompt_body = models.TextField()

    changelog = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

When an execution runs:

AgentRunTrace.prompt_template_snapshot

stores:

{
  "hallucination_avoidance": "v3",
  "web_research": "v2",
  "source_recording": "v1"
}

so future runs remain traceable.

Prompt Testing Framework

This becomes extremely powerful.

For each template:

Run Prompt Test

Example:

Hallucination Avoidance

Input:
What is the market share of XYZ startup?

Expected:
Should not invent market share.
Should return UNKNOWN.
Prompt Evaluation

Track:

Template
Version
Tasks Used
Acceptance Rate
Executive Score
User Score
Failure Rate
Hallucination Rate

Example:

Hallucination Avoidance v3

Used:
324 executions

Acceptance:
92%

Hallucination incidents:
1.2%

Average executive score:
8.7
Advanced Feature: Prompt Packs

Instead of assigning templates one-by-one:

Research Pack

Contains:
✓ Hallucination Avoidance
✓ Web Research
✓ Source Recording
✓ Evidence Extraction

Then users simply select:

Prompt Pack:
Research Pack

Useful packs:

Research Pack
Product Pack
Strategy Pack
Executive Pack
Reviewer Pack
Writer Pack
Risk Pack
Biosecurity Pack
Search Pack
Recommended Default Library for StrategyPad

Start with:

Safety
Hallucination Avoidance
Fact Validation
Source Recording
Research
Web Research
Evidence Extraction
Source Ranking
Product
Product Thinking
KPI Analysis
Customer Impact
Strategy
Strategic Options
Scenario Planning
Risk Analysis
Executive
Executive Summary
Decision Framing
Counter Arguments
Writing
Structured Document Writer
Citation Formatting
Recommendation Formatting
Review
Adversarial Review
Missing Evidence Review
Executive Readiness Review
Most Important Addition

Add a new traceability object:

class PromptExecutionTrace(models.Model):
    agent_trace = models.ForeignKey(
        AgentRunTrace,
        on_delete=models.CASCADE,
    )

    prompt_template = models.ForeignKey(
        PromptTemplate,
        on_delete=models.PROTECT,
    )

    version_number = models.IntegerField()

    prompt_snapshot = models.TextField()

    execution_order = models.IntegerField()

This allows you to answer:

Why did this agent produce this output?
Which prompt contributed?
Which version was used?

That level of traceability will become one of the strongest features of the entire platform.