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
    
    # Create agent
    response = api_client.post(f'/api/topics/{topic.id}/agents/', {
        "name": "Test Agent",
        "system_prompt": "You are a test agent.",
        "output_schema": {"type": "object"}
    }, format="json")
    assert response.status_code == status.HTTP_201_CREATED
    agent_id = response.data["id"]

    # Update agent
    response = api_client.patch(f'/api/agents/{agent_id}/', {
        "instructions": "New instructions"
    }, format="json")
    assert response.status_code == status.HTTP_200_OK
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
    assert "nodes" in response.data
    assert "edges" in response.data
    assert len(response.data["nodes"]) == 2
    assert len(response.data["edges"]) == 1

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
    assert trace["agent_name"] == "Mock Agent"
    assert trace["input_payload"]["query"] == "Do this specific task."

    # Check that Prompts were included in trace
    assert len(trace["prompt_traces"]) == 2
    
    # Verify LLM Execute Calls
    assert mock_execute.call_count == 2
    
    # The second call should be the evaluator call.
    # We assert that schema_class is passed as EvaluationResultSchema
    from strategy.agent_views import EvaluationResultSchema
    eval_call_kwargs = mock_execute.call_args_list[1].kwargs
    assert eval_call_kwargs.get("schema_class") == EvaluationResultSchema
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
