from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from strategy.models import Topic, AgentDefinition, AgentEdge, ChainExecutionVersion, AgentRunTrace, AgentArtifact
from unittest.mock import patch, MagicMock
from django.utils import timezone

User = get_user_model()

class AgentAPITests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="password")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        
        self.topic = Topic.objects.create(title="Test Topic", owner=self.user)
        
        # Create a simple valid graph (1 -> 2)
        self.agent1 = AgentDefinition.objects.create(
            topic=self.topic,
            name="Agent 1",
            system_prompt="You are Agent 1",
            is_entrypoint=True,
            output_schema={"type": "object", "properties": {"agent1_out": {"type": "string"}}}
        )
        self.agent2 = AgentDefinition.objects.create(
            topic=self.topic,
            name="Agent 2",
            system_prompt="You are Agent 2",
            is_entrypoint=False,
            output_schema={"type": "object", "properties": {"agent2_out": {"type": "string"}}}
        )
        
        self.edge = AgentEdge.objects.create(
            topic=self.topic,
            source_agent=self.agent1,
            target_agent=self.agent2,
            data_mapping={"agent1_out": "input_from_1"}
        )

    @patch('threading.Thread')
    @patch('strategy.chain_engine.get_llm_client')
    def test_run_chain_creates_execution_version_and_traces(self, mock_get_llm_client, mock_thread):
        # 1. Run Chain creates ChainExecutionVersion
        # 2. Run Chain creates AgentRunTrace for each node
        # 4. Successful node creates AgentArtifact
        mock_llm = MagicMock()
        
        def mock_execute(*args, **kwargs):
            return type('MockLLMResult', (), {
                'data': {'markdown_content': 'Mock content', 'agent1_out': 'val1', 'agent2_out': 'val2'},
                'telemetry': {'tokens': 100}
            })()
            
        mock_llm.execute.side_effect = mock_execute
        mock_get_llm_client.return_value = mock_llm
        
        # Make the thread run synchronously
        def fake_start():
            mock_thread.call_args[1]['target'](*mock_thread.call_args[1].get('args', ()))
        mock_thread.return_value.start.side_effect = fake_start

        response = self.client.post(f"/api/topics/{self.topic.id}/execute-chain/", {"trigger_input": {"start": "true"}}, format='json')
        self.assertEqual(response.status_code, 200)
        
        # Ensure ID is returned
        version_id = response.data.get("execution_version_id")
        self.assertIsNotNone(version_id)
        
        version = ChainExecutionVersion.objects.get(id=version_id)
        self.assertIsNotNone(version)
        
        # Ensure traces were created
        traces = AgentRunTrace.objects.filter(execution_version=version).order_by('run_order')
        self.assertEqual(traces.count(), 2)
        self.assertEqual(traces[0].agent, self.agent1)
        self.assertEqual(traces[1].agent, self.agent2)
        
        # Both completed
        self.assertEqual(traces[0].status, "completed")
        self.assertEqual(traces[1].status, "completed")
        
        # Ensure Artifacts were created
        artifacts = AgentArtifact.objects.filter(execution_version=version)
        self.assertEqual(artifacts.count(), 2)

        # Verify that llm.execute was called with prompt_version
        self.assertTrue(mock_llm.execute.called)
        for call in mock_llm.execute.call_args_list:
            self.assertEqual(call.kwargs.get("prompt_version"), "chain_execution_v1")

    @patch('threading.Thread')
    @patch('strategy.chain_engine.get_llm_client')
    def test_run_chain_handles_failed_node(self, mock_get_llm_client, mock_thread):
        # 3. Failed node still creates visible AgentRunTrace
        # 5. Trace endpoint returns failed traces with error details
        mock_llm = MagicMock()
        mock_llm.execute.side_effect = Exception("LLM crash simulated")
        mock_get_llm_client.return_value = mock_llm
        
        def fake_start():
            mock_thread.call_args[1]['target'](*mock_thread.call_args[1].get('args', ()))
        mock_thread.return_value.start.side_effect = fake_start

        response = self.client.post(f"/api/topics/{self.topic.id}/execute-chain/", {"trigger_input": {"start": "true"}}, format='json')
        self.assertEqual(response.status_code, 200)
        version_id = response.data.get("execution_version_id")
        
        traces = AgentRunTrace.objects.filter(execution_version_id=version_id)
        self.assertEqual(traces.count(), 1)
        failed_trace = traces.first()
        self.assertEqual(failed_trace.status, "failed")
        self.assertEqual(failed_trace.agent, self.agent1) # Failed on first node
        self.assertEqual(failed_trace.validation_result.get("error"), "LLM crash simulated")
        
        # Test trace endpoint returns the error details
        trace_resp = self.client.get(f"/api/chain-versions/{version_id}/trace/")
        self.assertEqual(trace_resp.status_code, 200)
        trace_data = trace_resp.data
        
        # Find the agent1 node in trace_data
        agent1_trace = next((n for n in trace_data if n["agent_id"] == self.agent1.id), None)
        self.assertIsNotNone(agent1_trace)
        self.assertEqual(agent1_trace["status"], "failed")
        self.assertEqual(agent1_trace["validation_result"]["error"], "LLM crash simulated")
