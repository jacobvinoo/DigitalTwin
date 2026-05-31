import pytest
from django.contrib.auth import get_user_model
from strategy.models import Topic, Objective, Workstream, TaskLedgerEntry

pytestmark = pytest.mark.django_db

@pytest.fixture
def owner():
    User = get_user_model()
    return User.objects.create_user(username="pm_alice", password="password")

def test_create_strategy_topic_service(owner):
    try:
        from strategy.services import create_strategy_topic
    except ImportError:
        pytest.fail("FAIL: create_strategy_topic service does not exist")
        
    topic = create_strategy_topic(owner)
    
    # 1. create_strategy_topic() creates one topic.
    assert Topic.objects.count() == 1
    assert topic.title == "Search for Supermarket"
    assert topic.owner == owner
    
    # 2. Objective is correct
    objectives = Objective.objects.filter(topic=topic)
    assert objectives.count() == 1
    assert "Improve supermarket search relevance" in objectives.first().title
    
    # 3. It creates all seven workstreams.
    workstreams = Workstream.objects.filter(topic=topic)
    assert workstreams.count() == 7
    workstream_types = [w.type for w in workstreams]
    expected_types = [
        "competitive_analysis",
        "market_metrics",
        "implementation_plan",
        "risk_analysis",
        "product_strategy",
        "roadmap",
        "execution_tracking"
    ]
    for wt in expected_types:
        assert wt in workstream_types
    
    # 4. It creates at least eight proposed task ledger entries.
    tasks = TaskLedgerEntry.objects.filter(topic=topic)
    assert tasks.count() >= 8
    
    # 5. High-risk tasks require approval
    risk_task = tasks.get(title__icontains="Identify product, technical, adoption, and data risks")
    assert risk_task.risk_level == "high"
    assert risk_task.approval_required is True
    
    # 6. Low-risk research tasks do not require approval
    research_task = tasks.get(title__icontains="Analyse current supermarket search experience")
    assert research_task.risk_level == "low"
    assert research_task.approval_required is False
    
    # 7. Each task includes default JSON fields
    for task in tasks:
        assert isinstance(task.execution_lineage, dict)
        assert isinstance(task.governance, dict)
        assert isinstance(task.inputs, dict)
        assert isinstance(task.telemetry, dict)
        assert isinstance(task.outputs, dict)
        assert isinstance(task.evaluation, dict)
        assert isinstance(task.next_actions, list)
        
    # 8. Tasks are linked to the correct workstream.
    assert research_task.workstream.type == "competitive_analysis"
    assert risk_task.workstream.type == "risk_analysis"
