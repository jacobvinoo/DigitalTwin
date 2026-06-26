import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE','strategypad_backend.settings')
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
user = User.objects.create_user('unique_user2','pwd123')
from strategy.models import Topic, AgentDefinition
topic = Topic.objects.create(title='t', workspace_type='strategy', owner=user)
from strategy.agent_serializers import AgentDefinitionSerializer
data = {"name":"Test Agent","system_prompt":"You are a test agent.","output_schema":{"type":"object"}}
ser = AgentDefinitionSerializer(data=data)
print('valid', ser.is_valid())
print('errors', ser.errors)
if ser.is_valid():
    ser.save(topic=topic)
    print('saved id', ser.instance.id)
