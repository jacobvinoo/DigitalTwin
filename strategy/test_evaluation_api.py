import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from strategy.models import (
    EvaluationTemplate,
    EvaluationPack,
    EvaluationAssignment,
    AgentDefinition,
    Topic
)

User = get_user_model()

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def user():
    return User.objects.create_user(username="testuser", password="password")

@pytest.fixture
def auth_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client

@pytest.fixture
def evaluation_template():
    return EvaluationTemplate.objects.create(
        name="Test Eval Template",
        category="quality",
        description="test desc",
        evaluation_prompt="Test prompt",
        scoring_schema={"quality": 10}
    )

@pytest.fixture
def topic(user):
    return Topic.objects.create(title="API Topic", owner=user)

@pytest.fixture
def agent(topic):
    return AgentDefinition.objects.create(name="API Agent", role="Tester", topic=topic)

@pytest.mark.django_db
class TestEvaluationAPI:
    def test_list_evaluation_templates(self, auth_client, evaluation_template):
        response = auth_client.get('/api/evaluation-templates/')
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['name'] == "Test Eval Template"

    def test_create_evaluation_template(self, auth_client):
        data = {
            "name": "New Template",
            "category": "safety",
            "description": "desc",
            "evaluation_prompt": "prompt",
            "scoring_schema": {"safety": 10}
        }
        response = auth_client.post('/api/evaluation-templates/', data, format='json')
        assert response.status_code == 201
        assert EvaluationTemplate.objects.count() == 1
        assert response.data['name'] == "New Template"

    def test_evaluation_pack_api(self, auth_client, evaluation_template):
        pack = EvaluationPack.objects.create(key="pack.test", name="Test Pack")
        pack.templates.add(evaluation_template)
        
        response = auth_client.get('/api/evaluation-packs/')
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['name'] == "Test Pack"
        assert len(response.data[0]['templates']) == 1

    def test_evaluation_assignment_api(self, auth_client, agent, evaluation_template):
        assign = EvaluationAssignment.objects.create(
            agent=agent,
            evaluation_template=evaluation_template,
            enabled=True
        )
        response = auth_client.get('/api/evaluation-assignments/')
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['agent'] == agent.id
        assert response.data[0]['evaluation_template'] == evaluation_template.id

    def test_create_evaluation_assignment(self, auth_client, agent, evaluation_template):
        data = {
            "agent": agent.id,
            "evaluation_template": evaluation_template.id,
            "enabled": True,
            "sort_order": 1
        }
        response = auth_client.post('/api/evaluation-assignments/', data, format='json')
        assert response.status_code == 201
        assert EvaluationAssignment.objects.count() == 1
