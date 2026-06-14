import pytest
from django.contrib.auth import get_user_model
from strategy.models import (
    EvaluationTemplate,
    EvaluationPack,
    EvaluationAssignment,
    EvaluationRun,
    AgentEvaluationHistory,
    AgentDefinition,
    ChainExecutionVersion,
    AgentRunTrace,
    Topic
)

User = get_user_model()

@pytest.mark.django_db
class TestEvaluationModels:
    def setup_method(self):
        self.user = User.objects.create_user(username="evaluser")
        self.topic = Topic.objects.create(title="Eval Topic", owner=self.user)
        self.agent = AgentDefinition.objects.create(name="Eval Agent", role="Tester", topic=self.topic)
        self.chain = ChainExecutionVersion.objects.create(topic=self.topic, version_number=1, started_by=self.user)
        self.trace = AgentRunTrace.objects.create(execution_version=self.chain, agent=self.agent, run_order=1, status="completed")

    def test_evaluation_template_creation(self):
        template = EvaluationTemplate.objects.create(
            name="Quality Checks",
            category="quality",
            description="Checks quality",
            evaluation_prompt="Score 1-10",
            version=1,
            scoring_schema={"clarity": 10, "accuracy": 10}
        )
        assert template.name == "Quality Checks"
        assert template.category == "quality"
        assert template.scoring_schema["clarity"] == 10

    def test_evaluation_pack_creation(self):
        template = EvaluationTemplate.objects.create(name="T1", category="quality", description="D", evaluation_prompt="P")
        pack = EvaluationPack.objects.create(key="pack.quality", name="Quality Pack")
        pack.templates.add(template)
        
        assert pack.templates.count() == 1
        assert pack.templates.first().name == "T1"

    def test_evaluation_assignment(self):
        template = EvaluationTemplate.objects.create(name="T1", category="quality", description="D", evaluation_prompt="P")
        assignment = EvaluationAssignment.objects.create(
            agent=self.agent,
            evaluation_template=template,
            enabled=True,
            sort_order=1
        )
        assert assignment.agent == self.agent
        assert assignment.evaluation_template == template
        assert assignment.enabled is True

    def test_evaluation_run(self):
        template = EvaluationTemplate.objects.create(name="T1", category="quality", description="D", evaluation_prompt="P")
        run = EvaluationRun.objects.create(
            agent_trace=self.trace,
            evaluation_template=template,
            result={"clarity": 8, "accuracy": 9},
            overall_score=8.5
        )
        assert run.agent_trace == self.trace
        assert run.overall_score == 8.5
        assert run.result["clarity"] == 8

    def test_agent_evaluation_history(self):
        history = AgentEvaluationHistory.objects.create(
            agent=self.agent,
            execution_version=self.chain,
            overall_score=9.0,
            quality_score=8.5,
            evidence_score=9.5,
            executive_score=8.0,
            hallucination_score=10.0
        )
        assert history.agent == self.agent
        assert history.execution_version == self.chain
        assert history.overall_score == 9.0
