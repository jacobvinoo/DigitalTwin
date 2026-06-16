from django.urls import path, include
from rest_framework.routers import DefaultRouter
from strategy.views import (
    TopicViewSet, TaskViewSet, MemoryViewSet, DailyPlanViewSet, WorkflowRunViewSet, ActionRequestViewSet, ConversationViewSet,
    PromptTemplateViewSet, AgentPromptAssignmentViewSet, PromptPackViewSet, PromptVersionMetricsViewSet,
    EvaluationTemplateViewSet, EvaluationPackViewSet, EvaluationAssignmentViewSet, EvaluationRunViewSet, AgentEvaluationHistoryViewSet,
    ManualSourceViewSet, AgentImprovementRecommendationViewSet,
    AgentImprovementExperimentViewSet, HumanOutputReviewViewSet, ChainExecutionVersionViewSet
)
from strategy.agent_views import AgentDefinitionViewSet, AgentEdgeViewSet, create_topic_agent, create_topic_edge, get_agent_graph

router = DefaultRouter()
router.register(r'topics', TopicViewSet, basename='topic')
router.register(r'tasks', TaskViewSet, basename='task')
router.register(r'memory', MemoryViewSet, basename='memory')
router.register(r'daily-plans', DailyPlanViewSet, basename='dailyplan')
router.register(r'workflows', WorkflowRunViewSet, basename='workflowrun')
router.register(r'actions', ActionRequestViewSet, basename='action')
router.register(r'conversations', ConversationViewSet, basename='conversation')
router.register(r'agents', AgentDefinitionViewSet, basename='agent')
router.register(r'edges', AgentEdgeViewSet, basename='edge')
router.register(r'prompt-templates', PromptTemplateViewSet, basename='prompttemplate')
router.register(r'agent-prompt-assignments', AgentPromptAssignmentViewSet, basename='agentpromptassignment')
router.register(r'prompt-packs', PromptPackViewSet)
router.register(r'prompt-metrics', PromptVersionMetricsViewSet)

# Evaluation Library Routes
router.register(r'evaluation-templates', EvaluationTemplateViewSet)
router.register(r'evaluation-packs', EvaluationPackViewSet)
router.register(r'evaluation-assignments', EvaluationAssignmentViewSet)
router.register(r'evaluation-runs', EvaluationRunViewSet)
router.register(r'evaluation-history', AgentEvaluationHistoryViewSet)
router.register(r'recommendations', AgentImprovementRecommendationViewSet, basename='recommendation')
router.register(r'experiments', AgentImprovementExperimentViewSet, basename='experiment')
router.register(r'human-reviews', HumanOutputReviewViewSet, basename='humanreview')
router.register(r'manual-sources', ManualSourceViewSet, basename='manualsource')
router.register(r'chain-versions', ChainExecutionVersionViewSet, basename='chainversion')

urlpatterns = [
    path('', include(router.urls)),
    path('topics/<int:topic_id>/agents/', create_topic_agent, name='create-topic-agent'),
    path('topics/<int:topic_id>/edges/', create_topic_edge, name='create-topic-edge'),
    path('topics/<int:topic_id>/agent-graph/', get_agent_graph, name='get-agent-graph'),
]
