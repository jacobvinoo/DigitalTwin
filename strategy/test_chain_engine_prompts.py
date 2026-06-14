import pytest
import json
from django.contrib.auth import get_user_model
from strategy.models import (
    Topic,
    AgentDefinition,
    ChainExecutionVersion,
    PromptTemplate,
    AgentPromptAssignment,
    AgentRunTrace,
    PromptExecutionTrace,
)
from strategy.chain_engine import AgentChainExecutor

User = get_user_model()

@pytest.fixture
def db_setup(db):
    user = User.objects.create_user(username="engineuser")
    topic = Topic.objects.create(title="Test Topic", owner=user)
    
    agent = AgentDefinition.objects.create(
        topic=topic,
        name="Test Agent",
        system_prompt="Base Agent Prompt.",
        model_name="gpt-4",
        is_entrypoint=True
    )
    
    chain_version = ChainExecutionVersion.objects.create(
        topic=topic,
        version_number=1,
        started_by=user,
        graph_snapshot={"nodes": []}
    )
    
    return {
        "user": user,
        "topic": topic,
        "agent": agent,
        "chain_version": chain_version
    }

@pytest.mark.django_db
class TestAgentChainExecutorPromptComposition:
    
    def test_prompt_composition(self, db_setup, mocker):
        # Setup Prompt Templates
        t1 = PromptTemplate.objects.create(name="Safety", prompt_body="Be safe.", version=2)
        t2 = PromptTemplate.objects.create(name="Research", prompt_body="Do research.", version=1)
        
        agent = db_setup['agent']
        AgentPromptAssignment.objects.create(agent=agent, prompt_template=t1, sort_order=1)
        AgentPromptAssignment.objects.create(agent=agent, prompt_template=t2, sort_order=2)
        
        # Mock the external LLM call to return a fixed payload
        class MockLLM:
            def complete_json(self, prompt, *args, **kwargs):
                self.last_prompt = prompt
                return {"status": "success"}
        
        mock_client = MockLLM()
        mocker.patch("strategy.chain_engine.get_llm_client", return_value=mock_client)
        
        executor = AgentChainExecutor()
        input_data = {"query": "Test"}
        
        # Execute the chain
        version = executor.execute(topic=db_setup['topic'], user=db_setup['user'], trigger_input=input_data)
        
        prompt_passed = mock_client.last_prompt
        
        # Verify the composition order:
        # 1. Be safe.
        # 2. Do research.
        # 3. Base Agent Prompt.
        assert "Be safe." in prompt_passed
        assert "Do research." in prompt_passed
        assert "Base Agent Prompt." in prompt_passed
        
        # Verify the PromptExecutionTrace records were created
        trace = AgentRunTrace.objects.get(execution_version=version, agent=agent)
        prompt_traces = PromptExecutionTrace.objects.filter(agent_trace=trace).order_by('execution_order')
        
        assert prompt_traces.count() == 2
        assert prompt_traces[0].prompt_template == t1
        assert prompt_traces[0].version_number == 2
        assert prompt_traces[0].prompt_snapshot == "Be safe."
        
        assert prompt_traces[1].prompt_template == t2
        assert prompt_traces[1].version_number == 1
        assert prompt_traces[1].prompt_snapshot == "Do research."
