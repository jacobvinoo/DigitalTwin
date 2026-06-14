import pytest
from django.contrib.auth import get_user_model
from strategy.models import (
    Topic,
    AgentDefinition,
    ChainExecutionVersion,
    AgentRunTrace,
    PromptTemplate,
    PromptTemplateVersion,
    AgentPromptAssignment,
    PromptExecutionTrace,
)

User = get_user_model()

@pytest.fixture
def test_user(db):
    return User.objects.create_user(username="testuser", password="password")

@pytest.fixture
def agent_definition(db, test_user):
    topic = Topic.objects.create(title="Test Topic", owner=test_user)
    return AgentDefinition.objects.create(
        topic=topic,
        name="Test Agent",
        role="Researcher",
        model_name="gpt-4"
    )

@pytest.fixture
def agent_trace(db, agent_definition, test_user):
    chain_version = ChainExecutionVersion.objects.create(
        topic=agent_definition.topic,
        version_number=1,
        started_by=test_user,
        graph_snapshot={"nodes": []}
    )
    return AgentRunTrace.objects.create(
        execution_version=chain_version,
        agent=agent_definition,
        run_order=1,
        status="completed",
        input_payload={"test": "data"},
        output_payload={"test": "output"}
    )

@pytest.mark.django_db
class TestPromptLibraryModels:

    def test_prompt_template_creation(self, test_user):
        template = PromptTemplate.objects.create(
            name="Hallucination Avoidance",
            category="safety",
            description="Prevents making up facts",
            prompt_body="Do not hallucinate.",
            created_by=test_user
        )
        assert template.name == "Hallucination Avoidance"
        assert template.version == 1
        assert not template.is_system_prompt

    def test_prompt_template_versioning(self, test_user):
        template = PromptTemplate.objects.create(
            name="Web Research",
            category="research",
            prompt_body="Search the web.",
        )
        version = PromptTemplateVersion.objects.create(
            prompt_template=template,
            version_number=1,
            prompt_body="Search the web.",
            changelog="Initial version"
        )
        assert version.prompt_template == template
        assert version.version_number == 1

    def test_agent_prompt_assignment(self, agent_definition):
        template = PromptTemplate.objects.create(
            name="Safety Base",
            category="safety",
            prompt_body="Be safe."
        )
        assignment = AgentPromptAssignment.objects.create(
            agent=agent_definition,
            prompt_template=template,
            sort_order=10
        )
        assert assignment.agent == agent_definition
        assert assignment.prompt_template == template
        assert assignment.enabled is True
        assert assignment.required is True
        assert agent_definition.prompt_assignments.count() == 1

    def test_prompt_execution_trace(self, agent_trace):
        template = PromptTemplate.objects.create(
            name="Safety Base",
            category="safety",
            prompt_body="Be safe."
        )
        trace = PromptExecutionTrace.objects.create(
            agent_trace=agent_trace,
            prompt_template=template,
            version_number=2,
            prompt_snapshot="Be safe, always.",
            execution_order=1
        )
        assert trace.agent_trace == agent_trace
        assert trace.prompt_template == template
        assert trace.version_number == 2
        assert trace.prompt_snapshot == "Be safe, always."
