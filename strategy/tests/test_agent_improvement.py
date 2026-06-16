from django.test import TestCase
from django.contrib.auth.models import User
from strategy.models import (
    Topic, AgentDefinition, EvaluationTemplate, EvaluationAssignment,
    ChainExecutionVersion, AgentRunTrace, EvaluationRun, AgentEvaluationHistory,
    AgentImprovementRecommendation
)
from unittest.mock import patch

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
        from strategy.models import AgentPromptAssignment, AgentImprovementExperiment
        assignments = AgentPromptAssignment.objects.filter(agent=self.agent, prompt_template__category="improvement_rule")
        self.assertEqual(assignments.count(), 1)
        self.assertEqual(assignments.first().prompt_template.prompt_body, "Always cite 3 sources.")
        
        # Verify an experiment was created
        experiments = AgentImprovementExperiment.objects.filter(agent=self.agent)
        self.assertEqual(experiments.count(), 1)
        self.assertEqual(experiments.first().status, "monitoring")

    def test_improvement_recommendation_rollback(self):
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
        
        from strategy.models import PromptTemplate, AgentPromptAssignment
        
        # Create a shared issue_type
        issue_type = "Quality Evaluator"
        template_name = f"Improvement Rule: {issue_type}"
        
        # Create a dummy assignment that SHOULD NOT be disabled
        other_template = PromptTemplate.objects.create(
            name=template_name,
            category="improvement_rule",
            prompt_body="Some other old rule",
            created_by=self.user
        )
        other_assignment = AgentPromptAssignment.objects.create(
            agent=self.agent,
            prompt_template=other_template,
            enabled=True,
            required=True
        )
        
        # Create the applied assignment
        applied_template = PromptTemplate.objects.create(
            name=template_name,
            category="improvement_rule",
            prompt_body="Always cite 3 sources.",
            created_by=self.user
        )
        applied_assignment = AgentPromptAssignment.objects.create(
            agent=self.agent,
            prompt_template=applied_template,
            enabled=True,
            required=True
        )
        
        recommendation = AgentImprovementRecommendation.objects.create(
            agent=self.agent,
            execution_version=version,
            agent_trace=trace,
            issue_type=issue_type,
            source_evaluation="{'score': 5}",
            problem="Too generic.",
            recommended_change="Always cite 3 sources.",
            target_area="prompt",
            status="applied",
            applied_assignment=applied_assignment
        )
        
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=self.user)
        
        # Test rollback endpoint
        response = client.post(f"/api/recommendations/{recommendation.id}/rollback/")
        self.assertEqual(response.status_code, 200)
        
        recommendation.refresh_from_db()
        self.assertEqual(recommendation.status, "rolled_back")
        
        other_assignment.refresh_from_db()
        applied_assignment.refresh_from_db()
        
        # Only the precise assignment should be disabled
        self.assertTrue(other_assignment.enabled)
        self.assertFalse(applied_assignment.enabled)

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
        
    def test_dashboard_stats_api(self):
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
        
        # 1 Pending Recommendation
        AgentImprovementRecommendation.objects.create(
            agent=self.agent,
            execution_version=version,
            agent_trace=trace,
            issue_type="Quality Evaluator",
            problem="Too generic.",
            recommended_change="Always cite 3 sources.",
            target_area="prompt",
            status="proposed",
            recurring_count=2
        )
        
        # 1 Applied Recommendation
        applied_rec = AgentImprovementRecommendation.objects.create(
            agent=self.agent,
            execution_version=version,
            agent_trace=trace,
            issue_type="Quality Evaluator",
            problem="Another issue.",
            recommended_change="Fix it.",
            target_area="prompt",
            status="applied",
            recurring_count=3
        )
        
        # 1 Monitoring Experiment
        from strategy.models import AgentImprovementExperiment
        AgentImprovementExperiment.objects.create(
            recommendation=applied_rec,
            agent=self.agent,
            baseline_score=4.0,
            status="monitoring",
            runs_observed=1
        )
        
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=self.user)
        
        # Call the dashboard stats endpoint
        response = client.get("/api/experiments/dashboard_stats/")
        self.assertEqual(response.status_code, 200)
        data = response.data
        
        self.assertEqual(data["pending_recommendations"], 1)
        self.assertEqual(data["applied_recommendations"], 1)
        self.assertEqual(data["experiments_monitoring"], 1)
        
        # Check aggregations for recurring weaknesses
        weaknesses = data["top_recurring_weaknesses"]
        self.assertEqual(len(weaknesses), 1)
        self.assertEqual(weaknesses[0]["issue"], "Quality Evaluator")
        self.assertEqual(weaknesses[0]["count"], 2) # It groups by issue type
        
        # Check pending list
        pending_list = data["pending_recommendations_list"]
        self.assertEqual(len(pending_list), 1)
        self.assertEqual(pending_list[0]["issue_type"], "Quality Evaluator")

    @patch('strategy.evaluation_engine.get_llm_client')
    def test_human_review_veto_logic(self, mock_get_llm_client):
        from strategy.models import AgentImprovementExperiment, HumanOutputReview
        from unittest.mock import MagicMock
        
        mock_llm = MagicMock()
        mock_llm.execute.return_value = type('MockLLMResult', (), {'data': {'score': 9.0, 'feedback': 'Good'}, 'telemetry': {}, 'audit': {}})()
        mock_get_llm_client.return_value = mock_llm
        
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
            problem="Too generic.",
            recommended_change="Always cite 3 sources.",
            target_area="prompt",
            status="applied"
        )
        
        experiment = AgentImprovementExperiment.objects.create(
            recommendation=recommendation,
            agent=self.agent,
            baseline_score=4.0,
            status="monitoring",
            runs_observed=4
        )
        
        # Next run gets a great auto score, but terrible human score
        # Handled by mock_llm_execute
        
        HumanOutputReview.objects.create(
            agent_trace=trace,
            reviewer=self.user,
            status="rejected",
            score=3 # < 5
        )
        
        from strategy.evaluation_engine import run_post_agent_evaluation
        # Trigger the evaluation engine loop
        run_post_agent_evaluation(trace)
        
        experiment.refresh_from_db()
        self.assertEqual(experiment.status, "failed")
        self.assertEqual(experiment.failure_reason, "Human review veto")

    @patch('strategy.evaluation_engine.get_llm_client')
    def test_human_review_weighting_logic(self, mock_get_llm_client):
        from strategy.models import AgentImprovementExperiment, HumanOutputReview
        from unittest.mock import MagicMock
        
        mock_llm = MagicMock()
        mock_llm.execute.return_value = type('MockLLMResult', (), {'data': {'score': 6.0, 'feedback': 'Okay'}, 'telemetry': {}, 'audit': {}})()
        mock_get_llm_client.return_value = mock_llm
        
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
            status="applied"
        )
        
        experiment = AgentImprovementExperiment.objects.create(
            recommendation=recommendation,
            agent=self.agent,
            baseline_score=4.0,
            status="monitoring",
            runs_observed=4 # Need 5 to lock in
        )
        
        # New run gets okay auto score, good human score
        # Handled by mock_llm_execute
        
        HumanOutputReview.objects.create(
            agent_trace=trace,
            reviewer=self.user,
            status="accepted_with_edits",
            score=8 # >= 5, so weighting applies: 6.0*0.6 + 8.0*0.4 = 3.6 + 3.2 = 6.8
        )
        
        from strategy.evaluation_engine import run_post_agent_evaluation
        run_post_agent_evaluation(trace)
        
        experiment.refresh_from_db()
        self.assertEqual(experiment.post_change_score, 6.8)
        self.assertEqual(experiment.delta, 2.8) # 6.8 - 4.0
        self.assertEqual(experiment.status, "successful")
        
    def test_trace_attributes_specific_experiment(self):
        from strategy.models import AgentImprovementExperiment
        from strategy.agent_views import AgentDefinitionViewSet
        from rest_framework.test import APIRequestFactory
        from rest_framework.request import Request
        
        # Setup active experiment
        version1 = ChainExecutionVersion.objects.create(
            topic=self.topic,
            version_number=1,
            status="completed",
            started_by=self.user
        )
        trace1 = AgentRunTrace.objects.create(
            execution_version=version1,
            agent=self.agent,
            run_order=1
        )
        recommendation = AgentImprovementRecommendation.objects.create(
            agent=self.agent,
            execution_version=version1,
            agent_trace=trace1,
            issue_type="Quality Evaluator",
            status="applied"
        )
        experiment = AgentImprovementExperiment.objects.create(
            recommendation=recommendation,
            agent=self.agent,
            baseline_score=4.0,
            status="monitoring"
        )
        
        # Run agent
        factory = APIRequestFactory()
        request = factory.post('/api/agents/{self.agent.id}/run/', {"instruction": "Test instruction"})
        request.user = self.user
        view = AgentDefinitionViewSet.as_view({'post': 'run'})
        
        response = view(request, pk=self.agent.id)
        self.assertEqual(response.status_code, 200)
        
        # Assert trace has active experiment
        new_trace = AgentRunTrace.objects.filter(agent=self.agent).order_by('-id').first()
        self.assertTrue(new_trace.active_experiments.filter(id=experiment.id).exists())

    def test_consolidation_sets_creator_and_is_triggered(self):
        from strategy.models import AgentImprovementRecommendation, PromptTemplate, AgentPromptAssignment
        from unittest.mock import patch
        
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
        
        # Create 9 existing active assignments
        for i in range(9):
            template = PromptTemplate.objects.create(
                name=f"Improvement Rule: Issue {i}",
                category="improvement_rule",
                prompt_body=f"Rule {i}",
                created_by=self.user
            )
            AgentPromptAssignment.objects.create(
                agent=self.agent,
                prompt_template=template,
                enabled=True,
                required=True
            )
            
        recommendation = AgentImprovementRecommendation.objects.create(
            agent=self.agent,
            execution_version=version,
            agent_trace=trace,
            issue_type="Trigger Issue",
            status="proposed"
        )
        
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=self.user)
        
        with patch('strategy.tasks.consolidate_agent_prompts_task.delay') as mock_delay:
            # Test accept endpoint
            response = client.post(f"/api/recommendations/{recommendation.id}/accept/")
            self.assertEqual(response.status_code, 200)
            
            # Since this is the 10th assignment, consolidation should be triggered
            mock_delay.assert_called_once_with(self.agent.id, self.user.id)
            
        # Test the actual function behavior for created_by
        from strategy.prompt_consolidation import consolidate_agent_prompts
        with patch('strategy.prompt_consolidation.get_llm_client') as mock_llm_client:
            class MockResponse:
                class MockData:
                    def __init__(self):
                        self.consolidated_rules = "Consolidated rule string"
                data = MockData()
            mock_llm_client.return_value.execute.return_value = MockResponse()
            
            consolidate_agent_prompts(self.agent, user=self.user)
            
            # The new consolidated template should have created_by = self.user
            new_template = PromptTemplate.objects.filter(
                name__startswith="Consolidated Improvement Rules",
                category="improvement_rule"
            ).first()
            self.assertIsNotNone(new_template)
            self.assertEqual(new_template.created_by, self.user)

    def test_evaluate_agent_run(self):
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

    @patch('strategy.evaluation_engine.get_llm_client')
    def test_evaluator_schema_failure_creates_system_event(self, mock_get_llm_client):
        from strategy.models import SystemExecutionEvent, AgentImprovementRecommendation
        version = ChainExecutionVersion.objects.create(topic=self.topic, version_number=1, status="completed", started_by=self.user)
        trace = AgentRunTrace.objects.create(execution_version=version, agent=self.agent, run_order=1)
        
        mock_llm = mock_get_llm_client.return_value
        mock_llm.execute.side_effect = ValueError("Output schema missing configured score_field 'quality_score'")
        
        from strategy.evaluation_engine import run_post_agent_evaluation
        run_post_agent_evaluation(trace)
        
        # Verify no recommendations created
        self.assertFalse(AgentImprovementRecommendation.objects.exists())
        
        # Verify a SystemExecutionEvent was created
        event = SystemExecutionEvent.objects.filter(agent_trace=trace, event_type="schema_error").first()
        self.assertIsNotNone(event)
        self.assertIn("score_field", event.message.lower())

    @patch('strategy.evaluation_engine.get_llm_client')
    def test_rate_limit_creates_system_event(self, mock_get_llm_client):
        from strategy.models import SystemExecutionEvent, AgentImprovementRecommendation
        version = ChainExecutionVersion.objects.create(topic=self.topic, version_number=1, status="completed", started_by=self.user)
        trace = AgentRunTrace.objects.create(execution_version=version, agent=self.agent, run_order=1)
        
        mock_llm = mock_get_llm_client.return_value
        mock_llm.execute.side_effect = Exception("429 Too Many Requests: Rate limit exceeded")
        
        from strategy.evaluation_engine import run_post_agent_evaluation
        run_post_agent_evaluation(trace)
        
        # Verify no recommendations created
        self.assertFalse(AgentImprovementRecommendation.objects.exists())
        
        # Verify a SystemExecutionEvent was created
        event = SystemExecutionEvent.objects.filter(agent_trace=trace, event_type="rate_limit").first()
        self.assertIsNotNone(event)
        self.assertIn("429", event.message.lower())

    @patch('strategy.evaluation_engine.get_llm_client')
    def test_duplicate_recommendations_are_merged(self, mock_get_llm_client):
        from strategy.models import AgentImprovementRecommendation
        
        # Run 1
        version1 = ChainExecutionVersion.objects.create(topic=self.topic, version_number=1, status="completed", started_by=self.user)
        trace1 = AgentRunTrace.objects.create(execution_version=version1, agent=self.agent, run_order=1)
        
        mock_llm = mock_get_llm_client.return_value
        class MockResponse:
            data = {"score": 4, "feedback": "Needs evidence."}
        mock_llm.execute.return_value = MockResponse()
        
        from strategy.evaluation_engine import run_post_agent_evaluation
        run_post_agent_evaluation(trace1)
        
        # Should have 1 recommendation
        self.assertEqual(AgentImprovementRecommendation.objects.count(), 1)
        rec1 = AgentImprovementRecommendation.objects.first()
        self.assertEqual(rec1.recurring_count, 1)
        
        # Run 2 with same evaluator fail
        version2 = ChainExecutionVersion.objects.create(topic=self.topic, version_number=2, status="completed", started_by=self.user)
        trace2 = AgentRunTrace.objects.create(execution_version=version2, agent=self.agent, run_order=1)
        run_post_agent_evaluation(trace2)
        
        # Should still have 1 recommendation but count is 2
        self.assertEqual(AgentImprovementRecommendation.objects.count(), 1)
        rec2 = AgentImprovementRecommendation.objects.first()
        self.assertEqual(rec2.recurring_count, 2)

    def test_prompt_consolidation(self):
        from strategy.prompt_consolidation import consolidate_agent_prompts
        from strategy.models import AgentPromptAssignment, PromptTemplate
        
        # Add 10 dummy assignments
        for i in range(10):
            pt = PromptTemplate.objects.create(
                name=f"Improvement Rule: Rule {i}",
                category="improvement_rule",
                prompt_body=f"Rule {i} body",
                version=1
            )
            AgentPromptAssignment.objects.create(
                agent=self.agent,
                prompt_template=pt,
                sort_order=800,
                enabled=True
            )
            
        # We cannot test the real LLM output easily without mocking,
        # but we can check if it recognizes it has >= 10 rules.
        from unittest.mock import patch
        with patch("strategy.chain_engine.get_llm_client") as mock_get_llm:
            class MockResponse:
                class MockData:
                    consolidated_rules = "Consolidated mock rule."
                data = MockData()
            
            mock_llm = mock_get_llm.return_value
            mock_llm.execute.return_value = MockResponse()
            
            result = consolidate_agent_prompts(self.agent)
            
            self.assertEqual(result["status"], "success")
            self.assertEqual(AgentPromptAssignment.objects.filter(agent=self.agent, enabled=True).count(), 1)
            self.assertEqual(AgentPromptAssignment.objects.filter(agent=self.agent, enabled=False).count(), 10)
