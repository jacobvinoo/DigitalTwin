from celery import shared_task
from strategy.models import AgentDefinition
from django.contrib.auth import get_user_model

@shared_task
def consolidate_agent_prompts_task(agent_id, user_id=None):
    from strategy.prompt_consolidation import consolidate_agent_prompts
    
    try:
        agent = AgentDefinition.objects.get(id=agent_id)
        user = None
        if user_id:
            User = get_user_model()
            user = User.objects.get(id=user_id)
            
        consolidate_agent_prompts(agent, user=user)
    except Exception as e:
        # In a real app we'd log this properly
        print(f"Consolidation task failed: {e}")
