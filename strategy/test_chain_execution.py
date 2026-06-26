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
        def execute(self, prompt, prompt_version, schema_dict=None, schema_class=None, model="gpt-4o"):
            class MockRes:
                def __init__(self, data):
                    self.data = data
                    self.telemetry = {}
            if "Agent 1" in prompt:
                return MockRes({"out": "step1_data"})
            return MockRes({"final": "step2_data"})

    def mock_get_llm():
        return MockLLM()

    monkeypatch.setattr("strategy.chain_engine.get_llm_client", mock_get_llm)

    executor = AgentChainExecutor()
    version, sorted_ids = executor.create_execution_version(topic=topic, user=user, trigger_input={"start": "go"})
    executor.execute_existing_version(version.id, sorted_ids, trigger_input={"start": "go"})
    version.refresh_from_db()

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
    assert t2.mapped_input_payload == {"in": "step1_data"}
    assert t2.output_payload == {"final": "step2_data"}

def test_executor_search_agent(topic, user, monkeypatch, settings):
    # Enable web search and force DuckDuckGo so it doesn't try real HTTP or fail
    settings.WEB_SEARCH_ENABLED = True
    settings.WEB_SEARCH_PROVIDER = 'duckduckgo'
    
    a1 = AgentDefinition.objects.create(
        topic=topic, name="Research Agent", is_entrypoint=True,
        system_prompt="Agent 1", output_schema={"type": "object"}
    )
    
    class MockLLM:
        def execute(self, prompt, prompt_version, schema_dict=None, schema_class=None, model="gpt-4o"):
            class MockRes:
                def __init__(self, data):
                    self.data = data
                    self.telemetry = {}
            return MockRes({"out": "search_data"})

    monkeypatch.setattr("strategy.chain_engine.get_llm_client", lambda: MockLLM())
    
    # Mock DuckDuckGo so we don't hit rate limits in testing
    class MockSearchAdapter:
        def search(self, query: str, domains: list[str] = None):
            return [{"title": "Mock Title", "url": "http://mock", "snippet": "Mock content", "publisher": "mock", "retrieved_at": "now"}]
            
    monkeypatch.setattr("strategy.utils.web_search.DuckDuckGoSearchAdapter.search", MockSearchAdapter.search)

    executor = AgentChainExecutor()
    version, sorted_ids = executor.create_execution_version(topic=topic, user=user, trigger_input={"query": "research info"})
    executor.execute_existing_version(version.id, sorted_ids, trigger_input={"query": "research info"})
    version.refresh_from_db()
    assert version.status == "completed"
    
    trace = AgentRunTrace.objects.get(execution_version=version, agent=a1)
    assert trace.status == "completed"
    assert "markdown_content" in trace.output_payload

def test_chain_version_trace_api_schema(api_client, user, topic):
    from strategy.models import AgentDefinition, ChainExecutionVersion, AgentRunTrace
    api_client.force_authenticate(user=user)
    
    a1 = AgentDefinition.objects.create(topic=topic, name="A1", system_prompt="s", output_schema={})
    v = ChainExecutionVersion.objects.create(topic=topic, started_by=user, status="completed", version_number=1)
    
    t = AgentRunTrace.objects.create(
        agent=a1, execution_version=v, run_order=1, status="completed",
        input_payload={"test": "input"}, output_payload={"test": "output"}
    )
    
    response = api_client.get(f'/api/chain-versions/{v.id}/trace/')
    assert response.status_code == 200
    assert isinstance(response.data, list)
    assert len(response.data) == 1
    
    trace_obj = response.data[0]
    expected_trace_keys = {
        "id", "agent_id", "agent_name", "run_order", "status", 
        "input_payload", "mapped_input_payload", "output_payload", 
        "validation_result", "prompt_snapshot", "prompt_traces", 
        "evaluations", "started_at", "completed_at", "active_experiments"
    }
    assert set(trace_obj.keys()) == expected_trace_keys, f"Trace API payload drifted: {set(trace_obj.keys())}"
