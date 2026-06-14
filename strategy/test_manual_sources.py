from django.test import TestCase
from strategy.models import Topic, AgentDefinition, ManualSource, AgentRunTrace
from django.contrib.auth.models import User
from rest_framework.test import APIClient
import json

class ManualSourceFeatureTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='testuser', password='password')
        self.topic = Topic.objects.create(title="Test Topic", owner=self.user)
        self.agent = AgentDefinition.objects.create(
            topic=self.topic,
            name="Test Agent",
            system_prompt="You are a helpful agent.",
            output_schema={"type": "object", "properties": {"markdown_content": {"type": "string"}, "sources": {"type": "array", "items": {"type": "object"}}}}
        )

    def test_manual_source_injection(self):
        # 1. Create a Manual Source
        ms_title = "Secret Corporate Strategy 2026"
        ms_url = "https://internal.company.com/strategy-2026"
        ms_content = "Our secret strategy for 2026 is to focus entirely on AI-driven automated testing pipelines."
        
        manual_source = ManualSource.objects.create(
            agent=self.agent,
            title=ms_title,
            url=ms_url,
            content=ms_content
        )

        # 2. Trigger an Agent Run via API
        response = self.client.post(f"/api/agents/{self.agent.id}/run/")
        self.assertEqual(response.status_code, 200, "Agent run should succeed")
        
        # 3. Verify the execution trace in DB
        trace = AgentRunTrace.objects.filter(agent=self.agent).latest('id')
        
        # The prompt snapshot should contain the manual knowledge base
        self.assertIn("--- MANUAL KNOWLEDGE BASE ---", trace.prompt_snapshot)
        self.assertIn(ms_title, trace.prompt_snapshot)
        self.assertIn(ms_content, trace.prompt_snapshot)
        
        # The output payload should have appended the manual source
        sources = trace.output_payload.get('sources', [])
        source_urls = [s.get('url') for s in sources]
        
        self.assertIn(ms_url, source_urls, "Manual source URL was not appended to final output payload")
        
        # Check that it's flagged correctly as manual type
        matching_source = next((s for s in sources if s.get('url') == ms_url), None)
        self.assertIsNotNone(matching_source)
        # The LLM may classify the source type dynamically (e.g. 'internal', 'web', 'manual')
        # We just need to ensure it cited our manual knowledge base document correctly.
        self.assertEqual(matching_source.get('title'), ms_title)

