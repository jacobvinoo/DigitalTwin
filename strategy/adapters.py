from typing import Dict, Any
from abc import ABC, abstractmethod
import uuid
from django.conf import settings
from strategy.models import TaskLedgerEntry, Topic

class ActionExecutorAdapter(ABC):
    @abstractmethod
    def execute(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        pass

class FakeEmailAdapter(ActionExecutorAdapter):
    def execute(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        if not payload.get("recipients"):
            raise ValueError("Email recipients required")
            
        return {
            "provider": "fake_email",
            "status": "sent_simulated",
            "recipients": payload["recipients"],
            "message_id": f"fake-{uuid.uuid4()}",
            "payload_recorded": payload
        }

class FakeDocumentAdapter(ActionExecutorAdapter):
    def execute(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        doc_id = str(uuid.uuid4())
        return {
            "status": "success",
            "provider": "FakeDocumentAdapter",
            "document_uri": f"fake-doc-id-{doc_id}"
        }

class FakeTaskAdapter(ActionExecutorAdapter):
    def execute(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        topic_id = payload.get("topic_id")
        title = payload.get("title", "New Task")
        task_type = payload.get("task_type", "follow_up")
        
        topic = Topic.objects.get(id=topic_id)
        task = TaskLedgerEntry.objects.create(
            topic=topic,
            title=title,
            task_type=task_type
        )
        
        return {
            "status": "success",
            "provider": "FakeTaskAdapter",
            "created_task_id": task.id
        }

class RealEmailAdapter(ActionExecutorAdapter):
    def __init__(self, provider=None, dry_run=False):
        self.provider = provider
        self.dry_run = dry_run
        self.enabled = getattr(settings, 'FEATURE_EMAIL_SEND_ENABLED', False)

    def execute(self, payload: Dict[str, Any], action_request=None) -> Dict[str, Any]:
        if action_request and action_request.approval_required:
            if action_request.status != "approved":
                raise ValueError("ActionRequest must be approved before execution")

        if not self.enabled and not self.dry_run:
            raise Exception("Email sending is not enabled.")

        if self.dry_run:
            return {"status": "dry_run"}

        try:
            message_id = self.provider.send_email(
                payload.get("recipients", []),
                payload.get("subject", ""),
                payload.get("body", "")
            )
            return {
                "status": "sent",
                "message_id": message_id,
                "logged_recipients": payload.get("recipients", [])
            }
        except Exception as e:
            if action_request:
                action_request.status = "failed"
                action_request.save()
            raise e
