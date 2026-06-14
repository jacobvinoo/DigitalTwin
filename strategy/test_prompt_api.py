import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from strategy.models import PromptTemplate, AgentDefinition, Topic

User = get_user_model()

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def user(db):
    return User.objects.create_user(username='apiuser', password='password')

@pytest.fixture
def authenticated_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client

@pytest.fixture
def agent(db, user):
    topic = Topic.objects.create(title="Test Topic", owner=user)
    return AgentDefinition.objects.create(
        topic=topic,
        name="Test Agent",
        role="Researcher",
        model_name="gpt-4"
    )

@pytest.mark.django_db
class TestPromptTemplateAPI:
    def test_list_prompt_templates(self, authenticated_client):
        PromptTemplate.objects.create(name="Template 1", category="safety", prompt_body="Body 1")
        PromptTemplate.objects.create(name="Template 2", category="research", prompt_body="Body 2")
        
        response = authenticated_client.get('/api/prompt-templates/')
        assert response.status_code == 200
        assert len(response.data) == 2
        # ordered by -id
        assert response.data[0]['name'] == "Template 2"
        assert response.data[1]['name'] == "Template 1"

    def test_create_prompt_template_generates_version(self, authenticated_client):
        payload = {
            "name": "New Template",
            "category": "writing",
            "description": "Writes good code",
            "prompt_body": "Be a good coder"
        }
        response = authenticated_client.post('/api/prompt-templates/', payload, format='json')
        assert response.status_code == 201
        
        template_id = response.data['id']
        template = PromptTemplate.objects.get(id=template_id)
        assert template.name == "New Template"
        assert template.version == 1
        
        # Verify a PromptTemplateVersion was automatically created
        versions = template.prompttemplateversion_set.all()
        assert len(versions) == 1
        assert versions[0].prompt_body == "Be a good coder"
        assert versions[0].version_number == 1

    def test_update_prompt_template_increments_version(self, authenticated_client):
        # Create via API to trigger perform_create and initial version
        create_payload = {
            "name": "Template",
            "category": "safety",
            "prompt_body": "V1"
        }
        create_resp = authenticated_client.post('/api/prompt-templates/', create_payload, format='json')
        template_id = create_resp.data['id']
        
        payload = {
            "name": "Template",
            "category": "safety",
            "prompt_body": "V2"
        }
        response = authenticated_client.put(f'/api/prompt-templates/{template_id}/', payload, format='json')
        assert response.status_code == 200
        assert response.data['version'] == 2
        
        template = PromptTemplate.objects.get(id=template_id)
        assert template.version == 2
        assert template.prompttemplateversion_set.count() == 2

@pytest.mark.django_db
class TestAgentPromptAssignmentAPI:
    def test_create_agent_assignment(self, authenticated_client, agent):
        template = PromptTemplate.objects.create(name="Template", category="safety", prompt_body="V1")
        
        payload = {
            "agent": agent.id,
            "prompt_template": template.id,
            "sort_order": 1
        }
        response = authenticated_client.post('/api/agent-prompt-assignments/', payload, format='json')
        assert response.status_code == 201
        
        assert agent.prompt_assignments.count() == 1
        assert agent.prompt_assignments.first().prompt_template == template
