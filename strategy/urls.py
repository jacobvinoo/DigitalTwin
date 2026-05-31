from django.urls import path, include
from rest_framework.routers import DefaultRouter
from strategy.views import TopicViewSet, TaskViewSet, MemoryViewSet, DailyPlanViewSet, WorkflowRunViewSet, ActionRequestViewSet, ConversationViewSet

router = DefaultRouter()
router.register(r'topics', TopicViewSet, basename='topic')
router.register(r'tasks', TaskViewSet, basename='task')
router.register(r'memory', MemoryViewSet, basename='memory')
router.register(r'daily-plans', DailyPlanViewSet, basename='dailyplan')
router.register(r'workflows', WorkflowRunViewSet, basename='workflowrun')
router.register(r'actions', ActionRequestViewSet, basename='action')
router.register(r'conversations', ConversationViewSet, basename='conversation')

urlpatterns = [
    path('', include(router.urls)),
]
