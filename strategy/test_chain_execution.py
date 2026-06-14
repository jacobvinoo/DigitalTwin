import pytest
from strategy.models import Topic, AgentDefinition, AgentEdge, ChainExecutionVersion, AgentRunTrace
from strategy.chain_engine import AgentChainExecutor

pytestmark = pytest.mark.django_db

@pytest.fixture
def user():
    from django.contrib.auth import get_user_model
    User = get_user_model()
    return User.objects.create_user(username="executor", password="pw")

@pytest.fixture
def topic(user):
    return Topic.objects.create(
        title="Execution Topic",
        workspace_type="custom_agent_chain",
        owner=user,
        status="active"
    )

def test_executor_linear_chain(topic, user, monkeypatch):
    a1 = AgentDefinition.objects.create(
        topic=topic, name="A1", is_entrypoint=True,
        system_prompt="Agent 1", output_schema={"type": "object"}
    )
    a2 = AgentDefinition.objects.create(
        topic=topic, name="A2", is_entrypoint=False,
        system_prompt="Agent 2", output_schema={"type": "object"}
    )
    AgentEdge.objects.create(topic=topic, source_agent=a1, target_agent=a2, data_mapping={"out": "in"})

    class MockLLM:
        def complete_json(self, prompt, output_schema, model):
            if "Agent 1" in prompt:
                return {"out": "step1_data"}
            return {"final": "step2_data"}

    def mock_get_llm():
        return MockLLM()

    monkeypatch.setattr("strategy.chain_engine.get_llm_client", mock_get_llm)

    executor = AgentChainExecutor()
    version = executor.execute(topic=topic, user=user, trigger_input={"start": "go"})

    assert version.status == "completed"
    assert version.started_by == user
    assert version.graph_snapshot != {}
    
    traces = AgentRunTrace.objects.filter(execution_version=version).order_by('run_order')
    assert traces.count() == 2
    
    t1 = traces[0]
    assert t1.agent == a1
    assert t1.status == "completed"
    assert t1.input_payload == {"start": "go"}
    assert t1.output_payload == {"out": "step1_data"}
    
    t2 = traces[1]
    assert t2.agent == a2
    assert t2.status == "completed"
    assert t2.input_payload == {"in": "step1_data"}
    assert t2.output_payload == {"final": "step2_data"}
