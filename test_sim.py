import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'strategypad_backend.settings')
django.setup()
from strategy.agents.client import LLMClient
from strategy.agent_views import SimulatedSearchResponse
llm = LLMClient()
sim_prompt = "You are a web search engine API. Generate 8 highly realistic search results for the query: 'online grocery'."
sim_res = llm.execute(prompt=sim_prompt, prompt_version="1.0", schema_class=SimulatedSearchResponse, model="gpt-4o-mini")
print(len(sim_res.data.results) if not isinstance(sim_res.data, dict) else len(sim_res.data.get('results', [])))
