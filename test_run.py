import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'strategypad_backend.settings')
django.setup()
from strategy.models import AgentDefinition
from strategy.agent_views import AgentDefinitionViewSet
from django.test import RequestFactory
from django.contrib.auth import get_user_model

User = get_user_model()
user = User.objects.first()
agent = AgentDefinition.objects.filter(name__icontains='Web Researcher').first()
if not agent:
    agent = AgentDefinition.objects.first()

factory = RequestFactory()
request = factory.post('/api/agents/1/run/')
request.user = user

view = AgentDefinitionViewSet.as_view({'post': 'run'})
response = view(request, pk=agent.id)

print("EVALS:", response.data['trace']['evaluations'])
print("NUM SOURCES:", len(response.data['trace']['output_payload'].get('sources', [])))
