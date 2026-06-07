import json
from django.db import models
from strategy.models import MemoryRecord, FeedbackRecord, ActionRequest

class AgentContextBuilder:
    def __init__(self, task, max_length=12000):
        self.task = task
        self.max_length = max_length

    def build(self):
        topic = self.task.topic
        outputs = self.task.outputs or {}
        
        # Query executed actions for the current task
        current_executed = ActionRequest.objects.filter(task=self.task, status="executed")
        executed_actions_data = [
            {
                "id": str(act.id),
                "action_type": act.action_type,
                "title": act.title,
                "instruction": act.instruction,
                "execution_result": act.execution_result,
                "result_document": act.execution_result.get("result_document") if isinstance(act.execution_result, dict) else None
            }
            for act in current_executed
        ]

        task_data = {
            "id": str(self.task.id),
            "title": self.task.title,
            "task_type": self.task.task_type,
            "risk_level": self.task.risk_level,
            "inputs": self.task.inputs,
            "executed_actions": executed_actions_data,
        }

        # Include previous draft if we are doing a revision/rerun
        if "agent_output" in outputs:
            task_data["previous_draft"] = outputs["agent_output"]

        # Include executive review feedback if revisions were requested
        if "executive_review" in outputs:
            review = outputs["executive_review"]
            task_data["executive_review_feedback"] = {
                "overall_assessment": review.get("overall_assessment"),
                "required_revisions": review.get("required_revisions"),
                "challenge_questions": review.get("challenge_questions"),
            }

        # Query all executed actions at the topic level
        executed_topic = ActionRequest.objects.filter(topic=topic, status="executed")
        executed_topic_actions_data = [
            {
                "id": str(act.id),
                "action_type": act.action_type,
                "title": act.title,
                "instruction": act.instruction,
                "execution_result": act.execution_result,
                "result_document": act.execution_result.get("result_document") if isinstance(act.execution_result, dict) else None
            }
            for act in executed_topic
        ]

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
                "executed_topic_actions": executed_topic_actions_data,
            },
            "task": task_data,
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
            related_executed = ActionRequest.objects.filter(task=related, status="executed")
            related_actions_data = [
                {
                    "id": str(act.id),
                    "action_type": act.action_type,
                    "title": act.title,
                    "instruction": act.instruction,
                    "execution_result": act.execution_result,
                    "result_document": act.execution_result.get("result_document") if isinstance(act.execution_result, dict) else None
                }
                for act in related_executed
            ]

            context_data["related_outputs"].append({
                "task_id": str(related.id),
                "title": related.title,
                "outputs": related.outputs,
                "evaluation": related.evaluation,
                "executed_actions": related_actions_data,
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
