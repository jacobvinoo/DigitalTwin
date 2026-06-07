import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from strategy.models import (
    Topic, Objective, Workstream, TaskLedgerEntry, MemoryRecord, FeedbackRecord
)
from strategy.agents.context import AgentContextBuilder

User = get_user_model()

class AgentContextBuilderTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="password")
        self.other_user = User.objects.create_user(username="other", password="password")
        
        self.topic = Topic.objects.create(
            title="Search for Supermarket",
            description="Improve search",
            strategic_context="Algolia implementation",
            owner=self.user,
            status="active"
        )
        self.objective = Objective.objects.create(
            topic=self.topic, title="Fast latency", priority="high"
        )
        self.workstream = Workstream.objects.create(
            topic=self.topic, title="Search Implementation", type="implementation_plan"
        )
        
        self.task = TaskLedgerEntry.objects.create(
            topic=self.topic,
            objective=self.objective,
            workstream=self.workstream,
            title="Create indexing script",
            task_type="scripting",
            risk_level="low",
            status="in_progress",
            inputs={"dataset": "products.csv"},
        )
        
        self.related_task = TaskLedgerEntry.objects.create(
            topic=self.topic,
            title="Setup Algolia cluster",
            task_type="infrastructure",
            status="completed",
            outputs={"summary": "Cluster ready"},
            evaluation={"critique": "Good setup", "score": 9}
        )
        
        FeedbackRecord.objects.create(
            topic=self.topic,
            task=self.task,
            raw_feedback="Make sure to include synonyms",
            feedback_type="quality",
            sentiment="neutral"
        )
        
        self.approved_memory = MemoryRecord.objects.create(
            topic=self.topic,
            memory_type="project_context",
            content="Use NZ timezone",
            approved_for_reuse=True
        )
        self.unapproved_memory = MemoryRecord.objects.create(
            topic=self.topic,
            memory_type="project_context",
            content="Ignore unapproved rule",
            approved_for_reuse=False
        )
        
        # Another user's topic and memory
        self.other_topic = Topic.objects.create(title="Other Topic", owner=self.other_user)
        self.other_memory = MemoryRecord.objects.create(
            topic=self.other_topic, content="Secret", memory_type="project_context", approved_for_reuse=True
        )

    def test_builder_includes_topic_objective(self):
        context = AgentContextBuilder(self.task).build()
        self.assertIn("Fast latency", context["text"])

    def test_builder_includes_workstream(self):
        context = AgentContextBuilder(self.task).build()
        self.assertIn("Search Implementation", context["text"])

    def test_builder_includes_approved_memory(self):
        context = AgentContextBuilder(self.task).build()
        self.assertIn("Use NZ timezone", context["text"])

    def test_builder_excludes_unapproved_memory(self):
        context = AgentContextBuilder(self.task).build()
        self.assertNotIn("Ignore unapproved rule", context["text"])

    def test_builder_includes_task_feedback(self):
        context = AgentContextBuilder(self.task).build()
        self.assertIn("Make sure to include synonyms", context["text"])

    def test_builder_includes_completed_related_task_outputs(self):
        context = AgentContextBuilder(self.task).build()
        self.assertIn("Cluster ready", context["text"])
        self.assertIn("Good setup", context["text"])

    def test_builder_returns_compact_context_under_configured_character_limit(self):
        context = AgentContextBuilder(self.task, max_length=1000).build()
        self.assertLessEqual(len(context["text"]), 1000)

    def test_builder_returns_source_refs_list(self):
        context = AgentContextBuilder(self.task).build()
        self.assertIsInstance(context["source_refs"], list)
        self.assertIn(f"memory_{self.approved_memory.id}", context["source_refs"])
        self.assertIn(f"task_{self.related_task.id}", context["source_refs"])

    def test_context_does_not_include_another_users_topic_or_memory(self):
        context = AgentContextBuilder(self.task).build()
        self.assertNotIn("Other Topic", context["text"])
        self.assertNotIn("Secret", context["text"])

    def test_builder_includes_previous_draft_and_reviewer_comments(self):
        self.task.outputs = {
            "agent_output": {"draft": "My first draft"},
            "executive_review": {
                "overall_assessment": "Too generic",
                "required_revisions": ["Add user research data"],
                "challenge_questions": ["What is our backup?"]
            }
        }
        self.task.save()
        context = AgentContextBuilder(self.task).build()
        self.assertIn("My first draft", context["text"])
        self.assertIn("Too generic", context["text"])
        self.assertIn("Add user research data", context["text"])
        self.assertIn("What is our backup?", context["text"])
