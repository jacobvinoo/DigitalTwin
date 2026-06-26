import pytest
from django.urls import reverse
from rest_framework import status
from strategy.models import Topic, AgentDefinition, AgentEdge

pytestmark = pytest.mark.django_db

@pytest.fixture
def api_client():
    from rest_framework.test import APIClient
    return APIClient()

@pytest.fixture
def user():
    from django.contrib.auth import get_user_model
    User = get_user_model()
    return User.objects.create_user(username="api_user", password="password")

@pytest.fixture
def topic(user):
    return Topic.objects.create(
        title="Custom Topic",
        workspace_type="custom_agent_chain",
        owner=user,
        status="active"
    )

def test_create_topic_with_custom_workspace_type(api_client, user):
    api_client.force_authenticate(user=user)
    response = api_client.post('/api/topics/', {
        "title": "New Chain Workspace",
        "workspace_type": "custom_agent_chain"
    }, format="json")
    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["workspace_type"] == "custom_agent_chain"

def test_agent_definition_crud(api_client, user, topic):
    api_client.force_authenticate(user=user)
    
    # Create an EvaluationTemplate to verify it gets auto-assigned
    EvaluationTemplate.objects.create(name="Quality Check", evaluation_prompt="Is it good?", category="quality")

    # Create agent
    response = api_client.post(f'/api/topics/{topic.id}/agents/', {
        "name": "Test Agent",
        "system_prompt": "You are a test agent.",
        "output_schema": {"type": "object"}
    }, format="json")
    assert response.status_code == status.HTTP_201_CREATED
    agent_id = response.data["id"]
    
    # Assert evaluators were auto-assigned
    agent = AgentDefinition.objects.get(id=agent_id)
    eval_assignments = EvaluationAssignment.objects.filter(agent=agent, enabled=True)
    assert eval_assignments.count() > 0
    assert eval_assignments.first().evaluation_template.name == "Quality Check"

    # Update an agent
    response = api_client.patch(f'/api/agents/{agent_id}/', {
        "instructions": "New instructions"
    }, format="json")
    assert response.status_code == status.HTTP_200_OK
    
    expected_agent_model_keys = {
        "id", "name", "role", "system_prompt", "instructions",
        "output_schema", "input_schema", "is_entrypoint", "is_terminal", "position_x", "position_y",
        "created_at", "updated_at", "metrics", "model_name", "temperature", "topic", "description", "rag_collection_id", "memory_scope"
    }
    assert set(response.data.keys()) == expected_agent_model_keys
    assert response.data["instructions"] == "New instructions"

    # Delete agent
    response = api_client.delete(f'/api/agents/{agent_id}/')
    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert not AgentDefinition.objects.filter(id=agent_id).exists()

def test_agent_edge_crud(api_client, user, topic):
    api_client.force_authenticate(user=user)
    a1 = AgentDefinition.objects.create(topic=topic, name="A1", system_prompt="s", output_schema={})
    a2 = AgentDefinition.objects.create(topic=topic, name="A2", system_prompt="s", output_schema={})

    # Create edge
    response = api_client.post(f'/api/topics/{topic.id}/edges/', {
        "source_agent": a1.id,
        "target_agent": a2.id,
        "data_mapping": {"field": "field"}
    }, format="json")
    assert response.status_code == status.HTTP_201_CREATED
    edge_id = response.data["id"]

    # Update edge
    response = api_client.patch(f'/api/edges/{edge_id}/', {
        "label": "My Edge"
    }, format="json")
    assert response.status_code == status.HTTP_200_OK
    
    expected_edge_model_keys = {"id", "source_agent", "target_agent", "data_mapping", "label", "condition", "requires_approval", "topic", "created_at"}
    assert set(response.data.keys()) == expected_edge_model_keys
    assert response.data["label"] == "My Edge"

    # Delete edge
    response = api_client.delete(f'/api/edges/{edge_id}/')
    assert response.status_code == status.HTTP_204_NO_CONTENT

def test_get_agent_graph(api_client, user, topic):
    api_client.force_authenticate(user=user)
    a1 = AgentDefinition.objects.create(topic=topic, name="A1", system_prompt="s", output_schema={})
    a2 = AgentDefinition.objects.create(topic=topic, name="A2", system_prompt="s", output_schema={})
    AgentEdge.objects.create(topic=topic, source_agent=a1, target_agent=a2)

    response = api_client.get(f'/api/topics/{topic.id}/agent-graph/')
    assert response.status_code == status.HTTP_200_OK
    
    expected_graph_keys = {"nodes", "edges"}
    assert set(response.data.keys()) == expected_graph_keys
    
    assert len(response.data["nodes"]) == 2
    assert len(response.data["edges"]) == 1
    
    # Assert Node Schema matches UI expectations
    expected_node_keys = {
        "id", "name", "role", "system_prompt", "instructions",
        "output_schema", "input_schema", "is_entrypoint", "is_terminal", "position_x", "position_y",
        "created_at", "updated_at", "metrics", "model_name", "temperature", "topic", "description", "rag_collection_id", "memory_scope"
    }
    node = response.data["nodes"][0]
    assert set(node.keys()) == expected_node_keys

    # Assert Edge Schema matches UI expectations
    expected_edge_keys = {"id", "source_agent", "target_agent", "data_mapping", "label", "condition", "requires_approval", "topic", "created_at"}
    edge = response.data["edges"][0]
    assert set(edge.keys()) == expected_edge_keys

from unittest.mock import patch
from strategy.models import PromptTemplate, AgentPromptAssignment, EvaluationTemplate, EvaluationAssignment

@patch('strategy.agents.client.LLMClient.execute')
def test_agent_run_real_llm_execution(mock_execute, api_client, user, topic):
    api_client.force_authenticate(user=user)
    
    # 1. Setup Data
    agent = AgentDefinition.objects.create(
        topic=topic, 
        name="Mock Agent", 
        system_prompt="You are a system.", 
        instructions="Do this specific task.",
        output_schema={}
    )
    
    # Assign a Prompt
    pt = PromptTemplate.objects.create(name="Helper Prompt", prompt_body="Help out.", version=1)
    AgentPromptAssignment.objects.create(agent=agent, prompt_template=pt, sort_order=1, enabled=True)
    
    # Assign an Evaluator
    et = EvaluationTemplate.objects.create(name="Quality Check", evaluation_prompt="Is it good?")
    EvaluationAssignment.objects.create(agent=agent, evaluation_template=et, sort_order=1, enabled=True)
    
    # 2. Mock LLM Returns
    # First call is the main generation, second call is the evaluation
    mock_execute.side_effect = [
        # Main Agent Generation Return
        type('LLMResult', (), {'data': {'markdown_content': 'Mocked LLM generated data', 'sources': []}, 'telemetry': {'execution_time_ms': 500}, 'audit': {}})(),
        # Evaluator Return
        type('LLMResult', (), {'data': {'score': 9, 'feedback': 'Good'}, 'telemetry': {'execution_time_ms': 200}, 'audit': {}})()
    ]
    
    # 3. Call the API
    response = api_client.post(f'/api/agents/{agent.id}/run/')
    
    # 4. Verify
    assert response.status_code == status.HTTP_200_OK
    assert response.data["status"] == "completed"
    trace = response.data["trace"]
    
    # Assert Trace format matches expected UI format
    expected_keys = {
        "id", "agent_id", "agent_name", "run_order", "status", 
        "input_payload", "mapped_input_payload", "output_payload", 
        "validation_result", "prompt_snapshot", "prompt_traces", 
        "evaluations", "started_at", "completed_at", "execution_time_ms"
    }
    assert set(trace.keys()) == expected_keys, f"Trace keys {set(trace.keys())} do not match expected."
    
    assert trace["agent_name"] == "Mock Agent"
    assert trace["input_payload"]["query"] == "Do this specific task."
    assert trace["status"] == "completed"

    # Check that Prompts were included in trace
    assert len(trace["prompt_traces"]) == 3
    
    # Verify LLM Execute Calls
    assert mock_execute.call_count == 2
    
    # The second call should be the evaluator call.
    # We assert that schema_class is passed as EvaluationResultSchema
    eval_call_kwargs = mock_execute.call_args_list[1].kwargs
    assert eval_call_kwargs.get("schema_class").__name__ == "EvaluationResultSchema"
    assert "Rubric/Instructions:\nIs it good?" in eval_call_kwargs.get("prompt")
    assert trace["prompt_traces"][0]["template_name"] == "Helper Prompt"
    assert trace["prompt_traces"][1]["template_name"] == "System Instructions"
    
    # Check that output matches mock LLM
    assert trace["output_payload"]["markdown_content"] == "Mocked LLM generated data"
    
    # Check evaluations
    assert len(trace["evaluations"]) == 1
    assert trace["evaluations"][0]["evaluator"] == "Quality Check"
    assert trace["evaluations"][0]["score"] == 9
    
    # Check that LLMClient was called exactly twice
    assert mock_execute.call_count == 2

@patch('threading.Thread.start')
def test_execute_chain_endpoint_success(mock_thread_start, api_client, user, topic):
    api_client.force_authenticate(user=user)
    
    # Needs valid graph, meaning exactly one entrypoint
    AgentDefinition.objects.create(topic=topic, name="A1", system_prompt="s", output_schema={}, is_entrypoint=True)
    
    # We mock the thread's target function execution to ensure it works
    # We just want to test that the endpoint returns 200 and spawns the thread
    def side_effect(*args, **kwargs):
        # execute the thread target synchronously in the test
        kwargs = mock_thread_start.call_args[1] if mock_thread_start.call_args else {}
        pass # We don't actually run it to avoid DB thread issues in tests
    mock_thread_start.side_effect = side_effect
    
    response = api_client.post(f'/api/topics/{topic.id}/execute-chain/', {
        "trigger_input": {"trigger": "manual"}
    }, format="json")
    
    assert response.status_code == status.HTTP_200_OK
    assert response.data["status"] == "started"
    mock_thread_start.assert_called_once()

def test_execute_chain_endpoint_invalid_graph(api_client, user, topic):
    api_client.force_authenticate(user=user)
    
    # Empty graph, should fail validation (no entrypoint)
    response = api_client.post(f'/api/topics/{topic.id}/execute-chain/', {
        "trigger_input": {"trigger": "manual"}
    }, format="json")
    
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "Invalid graph" in response.data["error"]

@patch('strategy.agents.client.LLMClient.execute')
@patch('strategy.utils.web_search.get_search_adapter')
@patch('strategy.utils.source_classifier.SourceRelevanceClassifier.filter_sources')
@patch('strategy.utils.source_classifier.SnippetExtractor.extract_trends')
def test_agent_run_needs_search_execution(mock_extract, mock_filter, mock_get_adapter, mock_execute, api_client, user, topic):
    api_client.force_authenticate(user=user)
    
    agent = AgentDefinition.objects.create(
        topic=topic, 
        name="Research Agent", 
        system_prompt="You are a system.", 
        instructions="Perform a deep web search",
        output_schema={}
    )
    
    # Mock LLM returns for Query Generation and Evaluation
    mock_execute.side_effect = [
        type('LLMResult', (), {'data': {'queries': ['test query']}, 'telemetry': {'execution_time_ms': 500}, 'audit': {}})(),
        type('LLMResult', (), {'data': {'score': 9, 'feedback': 'Good', 'metric_scores': {}}, 'telemetry': {'execution_time_ms': 200}, 'audit': {}})()
    ]
    
    # Mock search adapter
    class DummyAdapter:
        def search(self, query):
            return [{"title": "Test Source", "url": "http://test.com", "snippet": "Summary snippet"}]
    mock_get_adapter.return_value = DummyAdapter()
    
    # Mock classifier and extractor
    mock_filter.return_value = ([{"title": "Test Source", "url": "http://test.com", "snippet": "Summary snippet"}], [])
    mock_extract.return_value = [type('Trend', (), {'model_dump': lambda: {'trend_signal': 'Trend!'}})()]
    
    response = api_client.post(f'/api/agents/{agent.id}/run/')
    
    assert response.status_code == status.HTTP_200_OK
    trace = response.data["trace"]
    
    # Check that sources were correctly processed
    assert len(trace["output_payload"]["sources_collected"]) == 1
    
    # Assert markdown document synthesis correctly formatted the data instead of JSON dumping it
    markdown = trace["output_payload"]["markdown_content"]
    assert "# Research Evidence Catalogue" in markdown
    assert "### 1. Test Source" in markdown
    
    # Assert objective is NOT in the document
    assert "Objective:" not in markdown
    
    # Assert objective IS in the prompt_traces
    assert any(pt["template_name"] == "User Objective" and "Perform a deep web search" in pt["content"] for pt in trace["prompt_traces"])

@patch('strategy.agents.client.LLMClient.execute')
def test_agent_run_no_search_execution(mock_execute, api_client, user, topic):
    api_client.force_authenticate(user=user)
    
    agent = AgentDefinition.objects.create(
        topic=topic, 
        name="Standard Agent", 
        system_prompt="You are a system.", 
        instructions="Just do a normal task.",
        output_schema={}
    )
    
    # Mock LLM generation and Evaluation
    mock_execute.side_effect = [
        type('LLMResult', (), {'data': {'markdown_content': 'Normal content', 'sources': []}, 'telemetry': {'execution_time_ms': 500}, 'audit': {}})(),
        type('LLMResult', (), {'data': {'score': 9, 'feedback': 'Good', 'metric_scores': {}}, 'telemetry': {'execution_time_ms': 200}, 'audit': {}})()
    ]
    
    response = api_client.post(f'/api/agents/{agent.id}/run/')
    
    assert response.status_code == status.HTTP_200_OK
    trace = response.data["trace"]
    
    # Check that output_payload falls back properly without throwing UnboundLocalError
    assert trace["output_payload"]["markdown_content"] == "Normal content"
