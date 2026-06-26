import json
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from strategy.models import AgentDefinition, Topic, WebpageArtifact
from django.contrib.auth import get_user_model

User = get_user_model()

class VisualWebpageBuilderAgentTest(APITestCase):
    def setUp(self):
        # create user and authenticate
        self.user = User.objects.create_user(username='testuser', password='testpass')
        self.client.login(username='testuser', password='testpass')
        # create a topic owned by user
        self.topic = Topic.objects.create(name='Test Topic', owner=self.user)
        # create an agent definition
        self.agent = AgentDefinition.objects.create(
            name='Trend Dashboard Builder',
            purpose='Create an interactive webpage from structured trend intelligence outputs.',
            allowed_inputs=json.dumps(["timeline_matrix", "trend_details", "trend_clusters", "monitoring_indicators", "source_records"]),
            output_artifact_type='webpage',
            requires_code_generation=True,
            requires_human_review=True,
            topic=self.topic,
            agent_type='visual_webpage_builder',
            system_prompt='You are a visual webpage builder.'
        )

    def test_visual_webpage_builder_endpoint(self):
        url = reverse('agent-visual_webpage_builder', args=[self.agent.id])
        payload = {
            "title": "Trend Dashboard",
            "timeline_matrix": {},
            "trend_details": {},
            "trend_clusters": {},
            "monitoring_indicators": {},
            "source_records": []
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        # Verify required fields
        expected_keys = ["id", "title", "artifact_type", "framework", "component_name", "code", "rendered_preview_url", "validation_result", "created_at", "updated_at"]
        for key in expected_keys:
            self.assertIn(key, data)
        self.assertEqual(data["title"], payload["title"])
        self.assertEqual(data["artifact_type"], "webpage")
        self.assertEqual(data["framework"], "html")
        self.assertTrue(data["code"].startswith("<html>"))
