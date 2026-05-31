import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from strategy.models import Topic, TaskLedgerEntry, MemoryRecord
from strategy.agents.prompts import (
    build_product_manager_prompt,
    build_strategy_manager_prompt,
    build_executive_reviewer_prompt,
    build_evaluation_prompt,
)

User = get_user_model()

class AgentPromptTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="password")
        self.topic = Topic.objects.create(title="Topic 1", owner=self.user)
        self.task = TaskLedgerEntry.objects.create(
            topic=self.topic,
            title="Task 1",
            task_type="analysis",
            inputs={"dataset": "123"}
        )
        self.approved_memory = MemoryRecord.objects.create(
            topic=self.topic, content="Approved Rule", approved_for_reuse=True, memory_type="project_context"
        )
        self.unapproved_memory = MemoryRecord.objects.create(
            topic=self.topic, content="Secret Unapproved Rule", approved_for_reuse=False, memory_type="project_context"
        )

    def test_product_manager_prompt_contents(self):
        prompt, version = build_product_manager_prompt(self.task)
        
        self.assertIn("role", prompt.lower())
        self.assertIn("task", prompt.lower())
        self.assertIn("Topic 1", prompt) # topic context
        self.assertIn("json only", prompt.lower())
        self.assertIn("do not invent sources", prompt.lower())
        self.assertIn("evidence", prompt.lower())
        self.assertTrue(version.startswith("v"))

    def test_strategy_manager_prompt_contents(self):
        prompt, version = build_strategy_manager_prompt(self.task)
        
        self.assertIn("role", prompt.lower())
        self.assertIn("strategic question", prompt.lower())
        self.assertIn("market", prompt.lower())
        self.assertIn("options", prompt.lower())
        self.assertIn("decision-needed", prompt.lower())
        self.assertIn("json only", prompt.lower())
        self.assertTrue(version.startswith("v"))

    def test_executive_reviewer_prompt_contents(self):
        prompt, version = build_executive_reviewer_prompt(self.task)
        
        self.assertIn("adversarial", prompt.lower())
        self.assertIn("flawed", prompt.lower())
        self.assertIn("missing evidence", prompt.lower())
        self.assertIn("generic thinking", prompt.lower())
        self.assertIn("executive readiness", prompt.lower())
        self.assertIn("json only", prompt.lower())

    def test_evaluation_prompt_contents(self):
        prompt, version = build_evaluation_prompt(self.task)
        
        self.assertIn("scoring rubric", prompt.lower())
        self.assertIn("dimensions", prompt.lower())
        self.assertIn("average", prompt.lower())
        self.assertIn("json only", prompt.lower())

    def test_prompt_excludes_unapproved_memory(self):
        prompt, version = build_product_manager_prompt(self.task)
        self.assertIn("Approved Rule", prompt)
        self.assertNotIn("Secret Unapproved Rule", prompt)

    def test_prompt_length_below_max(self):
        prompt, version = build_product_manager_prompt(self.task)
        self.assertLessEqual(len(prompt), 20000)
