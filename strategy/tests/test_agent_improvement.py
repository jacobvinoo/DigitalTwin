from django.test import TestCase
from django.contrib.auth.models import User
from strategy.models import (
    Topic, AgentDefinition, EvaluationTemplate, EvaluationAssignment,
    ChainExecutionVersion, AgentRunTrace, EvaluationRun, AgentEvaluationHistory,
    AgentImprovementRecommendation
)

class AgentImprovementLoopTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="password")
        self.topic = Topic.objects.create(
            title="Test Topic",
            description="Test Description",
            owner=self.user,
            workspace_type="custom_agent_chain"
        )
        self.agent = AgentDefinition.objects.create(
            topic=self.topic,
            name="Test Agent",
            role="Analyst",
            system_prompt="Initial prompt."
        )
        self.eval_template = EvaluationTemplate.objects.create(
            name="Quality Evaluator",
            evaluation_prompt="Grade from 1 to 10."
        )
        self.assignment = EvaluationAssignment.objects.create(
            agent=self.agent,
            evaluation_template=self.eval_template,
            enabled=True
        )

    def test_improvement_recommendation_accept(self):
        # Setup trace
        version = ChainExecutionVersion.objects.create(
            topic=self.topic,
            version_number=1,
            status="completed",
            started_by=self.user
        )
        trace = AgentRunTrace.objects.create(
            execution_version=version,
            agent=self.agent,
            run_order=1
        )
        
        # Manually create a recommendation as if the run() view had done it
        recommendation = AgentImprovementRecommendation.objects.create(
            agent=self.agent,
            execution_version=version,
            agent_trace=trace,
            issue_type="Quality Evaluator",
            source_evaluation="{'score': 5}",
            problem="Too generic.",
            recommended_change="Always cite 3 sources.",
            target_area="prompt",
            status="proposed"
        )
        
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=self.user)
        
        # Test accept endpoint
        response = client.post(f"/api/recommendations/{recommendation.id}/accept/")
        self.assertEqual(response.status_code, 200)
        
        recommendation.refresh_from_db()
        self.assertEqual(recommendation.status, "accepted")
        
        self.agent.refresh_from_db()
        self.assertIn("Always cite 3 sources.", self.agent.system_prompt)
