import pytest
from strategy.models import (
    PromptTemplate,
    PromptTemplateVersion,
    PromptVersionMetrics,
    PromptExecutionTrace,
    AgentRunTrace,
    AgentDefinition,
    ChainExecutionVersion,
    Topic
)
from strategy.prompt_metrics import calculate_prompt_metrics
from django.contrib.auth import get_user_model

User = get_user_model()

@pytest.mark.django_db
class TestPromptMetricsService:
    def test_calculate_prompt_metrics_no_usage(self):
        template = PromptTemplate.objects.create(name="T1", prompt_body="B1", version=1)
        version = PromptTemplateVersion.objects.create(
            prompt_template=template, version_number=1, prompt_body="B1"
        )
        
        metrics = calculate_prompt_metrics(version.id)
        assert metrics.tasks_used_count == 0
        assert metrics.acceptance_rate == 0.0

    def test_calculate_prompt_metrics_with_usage(self):
        user = User.objects.create_user(username="testuser")
        topic = Topic.objects.create(title="Test", owner=user)
        template = PromptTemplate.objects.create(name="T2", prompt_body="B2", version=1)
        version = PromptTemplateVersion.objects.create(
            prompt_template=template, version_number=1, prompt_body="B2"
        )
        agent = AgentDefinition.objects.create(name="Agent", role="Role", topic=topic)
        chain = ChainExecutionVersion.objects.create(topic=topic, version_number=1, started_by=user)

        # Create Traces
        for status in ["completed", "completed", "failed", "completed"]:
            trace = AgentRunTrace.objects.create(
                execution_version=chain, agent=agent, run_order=1, status=status
            )
            PromptExecutionTrace.objects.create(
                agent_trace=trace,
                prompt_template=template,
                version_number=1,
                prompt_snapshot="B2",
                execution_order=1
            )
        
        metrics = calculate_prompt_metrics(version.id)
        
        assert metrics.tasks_used_count == 4
        # 1 failed out of 4 -> 25% failure rate
        assert metrics.failure_rate == 25.0
        # 3 completed out of 4 -> 75% acceptance rate
        assert metrics.acceptance_rate == 75.0
