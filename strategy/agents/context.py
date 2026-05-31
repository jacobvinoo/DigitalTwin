import json
from django.db import models
from strategy.models import MemoryRecord, FeedbackRecord

class AgentContextBuilder:
    def __init__(self, task, max_length=12000):
        self.task = task
        self.max_length = max_length

    def build(self):
        topic = self.task.topic

        context_data = {
            "topic": {
                "id": str(topic.id),
                "title": topic.title,
                "description": topic.description,
                "strategic_context": topic.strategic_context,
                "objectives": [
                    {"title": obj.title, "priority": obj.priority}
                    for obj in topic.objectives.all()
                ],
            },
            "task": {
                "id": str(self.task.id),
                "title": self.task.title,
                "task_type": self.task.task_type,
                "risk_level": self.task.risk_level,
                "inputs": self.task.inputs,
            },
            "workstream": {
                "title": self.task.workstream.title if self.task.workstream else None,
                "type": self.task.workstream.type if self.task.workstream else None,
            },
            "approved_memory": [],
            "feedback": [],
            "related_outputs": [],
            "context_truncated": False,
        }

        source_refs = []

        memories = MemoryRecord.objects.filter(
            approved_for_reuse=True
        ).filter(
            models.Q(topic=topic) | models.Q(topic__isnull=True)
        )

        for memory in memories:
            context_data["approved_memory"].append({
                "id": str(memory.id),
                "type": memory.memory_type,
                "content": memory.content,
            })
            source_refs.append(f"memory_{memory.id}")

        feedback = FeedbackRecord.objects.filter(task=self.task)
        for item in feedback:
            context_data["feedback"].append({
                "id": str(item.id),
                "raw_feedback": item.raw_feedback,
                "feedback_type": item.feedback_type,
            })
            source_refs.append(f"feedback_{item.id}")

        related_tasks = topic.tasks.filter(status="completed").exclude(id=self.task.id)[:5]
        for related in related_tasks:
            context_data["related_outputs"].append({
                "task_id": str(related.id),
                "title": related.title,
                "outputs": related.outputs,
                "evaluation": related.evaluation,
            })
            source_refs.append(f"task_{related.id}")

        serialized = json.dumps(context_data)
        if len(serialized) > self.max_length:
            context_data["context_truncated"] = True
            context_data["related_outputs"] = context_data["related_outputs"][:2]
            serialized = json.dumps(context_data)
            
        if len(serialized) > self.max_length:
            serialized = serialized[:self.max_length]

        return {
            "text": serialized,
            "source_refs": source_refs
        }
