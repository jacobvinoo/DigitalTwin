import pytest
from django.contrib.auth import get_user_model
from strategy.models import (
    PromptTemplate,
    PromptTemplateVersion,
    PromptVersionMetrics,
    Topic,
    TaskLedgerEntry,
    EvaluationScorecard
)

User = get_user_model()

@pytest.mark.django_db
class TestPromptEvaluationModels:
    def test_metrics_creation(self):
        # Create Template and Version
        template = PromptTemplate.objects.create(name="Safety", prompt_body="Be safe", version=1)
        version = PromptTemplateVersion.objects.create(
            prompt_template=template,
            version_number=1,
            prompt_body="Be safe",
            changelog="Init"
        )

        # Create Metrics
        metrics = PromptVersionMetrics.objects.create(
            prompt_version=version,
            tasks_used_count=10,
            acceptance_rate=0.85,
            average_executive_score=8.5,
            average_user_score=9.0,
            failure_rate=0.05,
            hallucination_rate=0.02
        )

        assert metrics.prompt_version == version
        assert metrics.tasks_used_count == 10
        assert metrics.acceptance_rate == 0.85
        assert metrics.average_user_score == 9.0

    def test_evaluation_scorecard_new_fields(self):
        user = User.objects.create_user(username="testuser")
        topic = Topic.objects.create(title="Test Topic", owner=user)
        task = TaskLedgerEntry.objects.create(topic=topic, title="Test Task", task_type="test")

        scorecard = EvaluationScorecard.objects.create(
            task=task,
            relevance=10.0,
            user_score=8.0,
            hallucination_detected=True
        )

        assert scorecard.hallucination_detected is True
        assert scorecard.user_score == 8.0
        # Check overall score math which averages all valid fields
        assert scorecard.overall_score == 9.0
