import pytest
from django.contrib.auth import get_user_model
from strategy.models import (
    Topic, 
    AgentDefinition, 
    AgentEdge, 
    AgentMemoryCollection, 
    AgentMemoryChunk,
    ChainExecutionVersion,
    AgentRunTrace,
    AgentArtifact
)

pytestmark = pytest.mark.django_db

@pytest.fixture
def user():
    User = get_user_model()
    return User.objects.create_user(username="agent_tester", password="password")

@pytest.fixture
def topic(user):
    return Topic.objects.create(
        title="Custom Workflow Topic",
        workspace_type="custom_agent_chain",
        owner=user,
        status="active"
    )

def test_topic_workspace_type(topic):
    assert topic.workspace_type == "custom_agent_chain"

def test_agent_definition_creation(topic):
    agent = AgentDefinition.objects.create(
        topic=topic,
        name="Researcher",
        role="Search Researcher",
        description="Finds search patterns",
        system_prompt="You are a researcher...",
        output_schema={"type": "object"}
    )
    assert agent.id is not None
    assert agent.topic == topic
    assert agent.memory_scope == "agent_only"
    assert agent.model_name == "default"

def test_agent_edge_creation(topic):
    agent1 = AgentDefinition.objects.create(
        topic=topic, name="A1", system_prompt="Sys", output_schema={}
    )
    agent2 = AgentDefinition.objects.create(
        topic=topic, name="A2", system_prompt="Sys", output_schema={}
    )
    edge = AgentEdge.objects.create(
        topic=topic,
        source_agent=agent1,
        target_agent=agent2,
        data_mapping={"a": "b"}
    )
    assert edge.id is not None
    assert edge.source_agent == agent1
    assert edge.target_agent == agent2

def test_agent_memory_creation(topic):
    agent = AgentDefinition.objects.create(
        topic=topic, name="A1", system_prompt="Sys", output_schema={}
    )
    collection = AgentMemoryCollection.objects.create(
        topic=topic,
        agent=agent,
        name="Docs",
        collection_key="xyz-123"
    )
    assert collection.id is not None

    chunk = AgentMemoryChunk.objects.create(
        collection=collection,
        source_title="file.pdf",
        chunk_text="Some text",
        embedding=[0.0] * 1536
    )
    assert chunk.id is not None
    assert len(chunk.embedding) == 1536

def test_chain_execution_trace(topic, user):
    agent = AgentDefinition.objects.create(
        topic=topic, name="A1", system_prompt="Sys", output_schema={}
    )
    version = ChainExecutionVersion.objects.create(
        topic=topic,
        version_number=1,
        started_by=user
    )
    assert version.id is not None

    trace = AgentRunTrace.objects.create(
        execution_version=version,
        agent=agent,
        run_order=1,
        status="pending"
    )
    assert trace.id is not None

    artifact = AgentArtifact.objects.create(
        execution_version=version,
        agent_trace=trace,
        artifact_type="markdown",
        title="Result"
    )
    assert artifact.id is not None
