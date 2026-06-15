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
        self.assertEqual(recommendation.status, "applied")
        
        # Verify that a PromptTemplate was created and assigned
        from strategy.models import AgentPromptAssignment
        assignments = AgentPromptAssignment.objects.filter(agent=self.agent, prompt_template__category="improvement_rule")
        self.assertEqual(assignments.count(), 1)
        self.assertEqual(assignments.first().prompt_template.prompt_body, "Always cite 3 sources.")

    def test_improvement_recommendation_reject(self):
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
        
        # Test reject endpoint
        response = client.post(f"/api/recommendations/{recommendation.id}/reject/")
        self.assertEqual(response.status_code, 200)
        
        recommendation.refresh_from_db()
        self.assertEqual(recommendation.status, "rejected")

    def test_run_post_agent_evaluation(self):
        # Create a trace and try running the shared engine directly
        version = ChainExecutionVersion.objects.create(
            topic=self.topic,
            version_number=1,
            status="completed",
            started_by=self.user
        )
        trace = AgentRunTrace.objects.create(
            execution_version=version,
            agent=self.agent,
            run_order=1,
            output_payload={"content": "Here is an output with no citations."}
        )
        
        from strategy.evaluation_engine import run_post_agent_evaluation
        # Ensure we have the assignment setup in setUp()
        evaluations = run_post_agent_evaluation(trace)
        
        self.assertIsInstance(evaluations, list)
        
        # Verify that an EvaluationRun was created
        self.assertTrue(EvaluationRun.objects.filter(agent_trace=trace).exists())
        
        # Verify that AgentEvaluationHistory was created
        self.assertTrue(AgentEvaluationHistory.objects.filter(agent=self.agent, execution_version=version).exists())
