import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'strategypad_backend.settings')
django.setup()

from strategy.agents.client import LLMClient
from pydantic import BaseModel, Field

class TaskDef(BaseModel):
    title: str
    task_type: str = Field(description="Must be one of: competitive_research, metrics_definition, implementation_plan, risk_analysis, product_strategy, roadmap, execution_tracking")
    workstream_type: str = Field(description="Must be one of: competitive_analysis, market_metrics, implementation_plan, risk_analysis, product_strategy, roadmap, execution_tracking")
    risk_level: str = Field(description="low, medium, or high")
    approval_required: bool

class TaskGenerationOutput(BaseModel):
    tasks: list[TaskDef]

prompt = """
You are an expert strategic planner. The user wants to create a 5 year strategy for Woolworths New Zealand.
Create a list of 8 specific tasks to accomplish this. They must align with the topic.
"""
result = LLMClient().execute(
    prompt=prompt,
    prompt_version="v1.0.0",
    schema_class=TaskGenerationOutput,
    model="gpt-4o"
)
print("Tasks generated:")
for t in result.data.tasks:
    print(f"- {t.title} ({t.task_type} -> {t.workstream_type})")
