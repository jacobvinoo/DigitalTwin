import pytest
from strategy.models import Topic, AgentDefinition, AgentEdge
from strategy.chain_engine import AgentChainValidator

pytestmark = pytest.mark.django_db

@pytest.fixture
def user():
    from django.contrib.auth import get_user_model
    User = get_user_model()
    return User.objects.create_user(username="validator", password="pw")

@pytest.fixture
def topic(user):
    return Topic.objects.create(
        title="Validation Topic",
        workspace_type="custom_agent_chain",
        owner=user,
        status="active"
    )

def test_validate_empty_graph(topic):
    validator = AgentChainValidator(topic)
    is_valid, errors = validator.validate()
    assert not is_valid
    assert "Graph must contain at least one agent" in errors

def test_validate_missing_entrypoint(topic):
    # Two nodes, no entrypoint
    AgentDefinition.objects.create(topic=topic, name="A", is_entrypoint=False)
    AgentDefinition.objects.create(topic=topic, name="B", is_entrypoint=False)
    
    validator = AgentChainValidator(topic)
    is_valid, errors = validator.validate()
    assert not is_valid
    assert "Graph must have exactly one entrypoint agent" in errors

def test_validate_cycle_detection(topic):
    a1 = AgentDefinition.objects.create(topic=topic, name="A1", is_entrypoint=True)
    a2 = AgentDefinition.objects.create(topic=topic, name="A2", is_entrypoint=False)
    a3 = AgentDefinition.objects.create(topic=topic, name="A3", is_entrypoint=False)

    AgentEdge.objects.create(topic=topic, source_agent=a1, target_agent=a2)
    AgentEdge.objects.create(topic=topic, source_agent=a2, target_agent=a3)
    AgentEdge.objects.create(topic=topic, source_agent=a3, target_agent=a1) # Cycle

    validator = AgentChainValidator(topic)
    is_valid, errors = validator.validate()
    assert not is_valid
    assert "Graph contains a cycle" in errors

def test_validate_schema_mismatch(topic):
    # A1 outputs {"type": "object", "properties": {"findings": {"type": "string"}}}
    a1 = AgentDefinition.objects.create(
        topic=topic, name="A1", is_entrypoint=True,
        output_schema={"type": "object", "properties": {"findings": {"type": "string"}}}
    )
    # A2 requires input "research_data"
    a2 = AgentDefinition.objects.create(
        topic=topic, name="A2", is_entrypoint=False,
        input_schema={"type": "object", "properties": {"research_data": {"type": "string"}}, "required": ["research_data"]}
    )

    # Missing mapping for required field
    AgentEdge.objects.create(topic=topic, source_agent=a1, target_agent=a2, data_mapping={"findings": "some_other_field"})

    validator = AgentChainValidator(topic)
    is_valid, errors = validator.validate()
    assert not is_valid
    assert any("Missing required mapped input" in err for err in errors)

def test_validate_success(topic):
    a1 = AgentDefinition.objects.create(
        topic=topic, name="A1", is_entrypoint=True,
        output_schema={"type": "object", "properties": {"findings": {"type": "string"}}}
    )
    a2 = AgentDefinition.objects.create(
        topic=topic, name="A2", is_entrypoint=False,
        input_schema={"type": "object", "properties": {"research_data": {"type": "string"}}, "required": ["research_data"]}
    )

    AgentEdge.objects.create(topic=topic, source_agent=a1, target_agent=a2, data_mapping={"findings": "research_data"})

    validator = AgentChainValidator(topic)
    is_valid, errors = validator.validate()
    assert is_valid
    assert not errors
