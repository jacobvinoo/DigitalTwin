import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'strategypad_backend.settings')
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
# use existing user (api_user) created via fixtures; get first user
user = User.objects.first()
from rest_framework.test import APIClient
from strategy.models import Topic, EvaluationTemplate
client = APIClient()
client.force_authenticate(user=user)
# get a topic for the user
topic = Topic.objects.filter(owner=user).first()
if not topic:
    topic = Topic.objects.create(title='Test Topic', workspace_type='strategy', owner=user)
# create evaluation template
EvaluationTemplate.objects.create(name='Quality Check', evaluation_prompt='Is it good?', category='quality')
response = client.post(f'/api/topics/{topic.id}/agents/', {
    'name': 'Test Agent',
    'system_prompt': 'You are a test agent.',
    'output_schema': {'type':'object'}
}, format='json')
print('Status code:', response.status_code)
print('Data:', response.data)
