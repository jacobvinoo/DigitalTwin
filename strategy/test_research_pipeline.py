import pytest
from django.contrib.auth import get_user_model
from strategy.models import (
    Topic, TaskLedgerEntry, ResearchBrief, SourceRecord, 
    EvidenceQuote, ResearchFinding, ResearchDocument, WorkflowRun
)
from strategy.workflows import run_agent_for_single_task

User = get_user_model()

@pytest.fixture
def user(db):
    return User.objects.create(username="test_researcher")

@pytest.fixture
def topic(db, user):
    return Topic.objects.create(title="Test Topic", owner=user)

@pytest.fixture
def research_task(db, topic):
    return TaskLedgerEntry.objects.create(
        topic=topic,
        title="Find the best practices for Search",
        task_type="competitive_research",
        status="proposed",
        risk_level="medium"
    )

@pytest.mark.django_db
class TestResearchPipeline:
    
    @pytest.fixture(autouse=True)
    def mock_llm(self, monkeypatch):
        class MockResult:
            def __init__(self, data):
                self.data = data
                self.audit = {"raw_prompt": "", "raw_response": ""}
                self.telemetry = {"model": "mock"}

        class MockClient:
            def execute(self, **kwargs):
                from strategy.agents.schemas import ResearchOutput, ExecutiveReviewOutput
                if kwargs.get("schema_class") == ResearchOutput:
                    return MockResult(
                        ResearchOutput(
                            task_title="Find the best practices for Search",
                            summary="Summary",
                            current_state="Current state",
                            key_findings=["Key finding"],
                            methodology_note="Methodology note",
                            sources=["Source"],
                            confidence_level="High",
                            limitations="Limitations",
                            search_experience_principles=["Principle"],
                            relevance_and_ranking_factors=["Factor"],
                            semantic_search_considerations=["Consideration"],
                            search_strategy="Strategy",
                            synthesis="Synthesis",
                            evidence_table=["Evidence"],
                            gaps_and_future_directions="Gaps"
                        )
                    )
                elif kwargs.get("schema_class") == ExecutiveReviewOutput:
                    return MockResult(
                        ExecutiveReviewOutput(
                            reviewed_task_title="Test Task",
                            overall_assessment="Needs more sources",
                            strongest_points=[],
                            weakest_points=["Lack of evidence"],
                            missing_evidence=["Missing specific case studies"],
                            challenge_questions=[],
                            executive_readiness_score=8,
                            recommendation="approve",
                            required_revisions=[]
                        )
                    )
                from strategy.agents.schemas import EvaluationOutput
                if kwargs.get("schema_class") == EvaluationOutput:
                    return MockResult(
                        EvaluationOutput(
                            relevance=8,
                            quality=8,
                            evidence_strength=8,
                            actionability=8,
                            executive_readiness=8,
                            style_alignment=8,
                            local_context=8,
                            novelty=8,
                            overall_score=8.0,
                            evaluator_notes="Good"
                        )
                    )
                class GenericMockData:
                    def model_dump(self):
                        return {}
                return MockResult(GenericMockData())

        def mock_get_llm_client(*args, **kwargs):
            return MockClient()

        monkeypatch.setattr("strategy.workflows.get_llm_client", mock_get_llm_client)

    def test_creating_research_task_creates_research_brief(self, research_task):
        assert ResearchBrief.objects.filter(task=research_task).exists()
        brief = ResearchBrief.objects.get(task=research_task)
        assert brief.status == "draft"

    def test_research_brief_contains_at_least_5_questions(self, research_task):
        brief = ResearchBrief.objects.get(task=research_task)
        assert len(brief.research_questions) >= 5

    def test_source_record_can_be_attached_to_task(self, topic, research_task):
        source = SourceRecord.objects.create(
            topic=topic,
            task=research_task,
            title="Search Best Practices 2026",
            url="http://example.com/search",
            publisher="Tech Insights",
            source_type="article"
        )
        assert source.id is not None
        assert research_task.sourcerecord_set.count() == 1

    def test_evidence_quote_must_link_to_source_record(self, topic, research_task):
        source = SourceRecord.objects.create(
            topic=topic,
            task=research_task,
            title="Search Best Practices 2026",
            source_type="article"
        )
        evidence = EvidenceQuote.objects.create(
            source=source,
            task=research_task,
            quote="Semantic search improves conversion by 15%.",
            interpretation="Use semantic search",
            relevance="High"
        )
        assert evidence.source == source

    def test_research_finding_must_link_to_evidence(self, topic, research_task):
        source = SourceRecord.objects.create(
            topic=topic,
            task=research_task,
            title="Search Best Practices 2026",
            source_type="article"
        )
        evidence = EvidenceQuote.objects.create(
            source=source,
            task=research_task,
            quote="Semantic search improves conversion by 15%.",
            interpretation="Use semantic search",
            relevance="High"
        )
        finding = ResearchFinding.objects.create(
            task=research_task,
            finding="Semantic search is critical for e-commerce.",
            implication="We must implement vector search."
        )
        finding.evidence.add(evidence)
        assert finding.evidence.count() == 1

    def test_research_document_contains_required_sections(self, research_task):
        # We will run the agent logic for this task
        run_agent_for_single_task(research_task)
        
        assert ResearchDocument.objects.filter(task=research_task).exists()
        doc = ResearchDocument.objects.get(task=research_task)
        
        md = doc.markdown.lower()
        assert "summary" in md
        assert "current state" in md
        assert "key findings" in md
        assert "methodology note" in md
        assert "sources" in md
        assert "confidence" in md
        assert "limitations" in md
        
        # Domain specific (search)
        assert "search experience principles" in md
        assert "relevance and ranking factors" in md
        assert "semantic search considerations" in md

    def test_literature_review_document_contains_required_sections(self, topic):
        # Create a literature review task
        lit_task = TaskLedgerEntry.objects.create(
            topic=topic,
            title="Literature Review on Vector Databases",
            task_type="competitive_research",
            status="proposed",
            risk_level="medium"
        )
        run_agent_for_single_task(lit_task)
        
        doc = ResearchDocument.objects.get(task=lit_task)
        md = doc.markdown.lower()
        
        assert "literature review:" in md
        assert "search strategy" in md
        assert "synthesis" in md
        assert "evidence table" in md
        assert "gaps and future directions" in md

    def test_non_search_tasks_do_not_get_search_headings(self, topic):
        # Create a non-search task
        pricing_task = TaskLedgerEntry.objects.create(
            topic=topic,
            title="Determine Pricing Strategy",
            task_type="competitive_research",
            status="proposed",
            risk_level="medium"
        )
        run_agent_for_single_task(pricing_task)
        
        doc = ResearchDocument.objects.get(task=pricing_task)
        md = doc.markdown.lower()
        
        # We just verify it does NOT have search headers, 
        # since the global mock doesn't return pricing-specific headers.
        assert "search experience principles" not in md

    def test_task_is_marked_completed_when_document_created(self, research_task):
        run_agent_for_single_task(research_task)
        research_task.refresh_from_db()
        assert research_task.status == "completed"

    def test_executive_review_revise_does_not_block_document_creation(self, research_task, monkeypatch):
        # Mock the LLM to return "revise" in executive review
        from strategy.workflows import ExecutiveReviewOutput
        
        class MockResult:
            def __init__(self, data):
                self.data = data
                self.audit = {"raw_prompt": "", "raw_response": ""}
                self.telemetry = {"model": "mock"}

        class MockClient:
            def execute(self, **kwargs):
                if kwargs.get("schema_class") == ExecutiveReviewOutput:
                    return MockResult(
                        ExecutiveReviewOutput(
                            reviewed_task_title="Test Task",
                            overall_assessment="Needs more sources",
                            strongest_points=[],
                            weakest_points=["Lack of evidence"],
                            missing_evidence=["Missing specific case studies"],
                            challenge_questions=[],
                            executive_readiness_score=4,
                            recommendation="revise",
                            required_revisions=[]
                        )
                    )
                from strategy.agents.schemas import ResearchOutput
                if kwargs.get("schema_class") == ResearchOutput:
                    return MockResult(
                        ResearchOutput(
                            task_title="Test Task", summary="S", current_state="C", key_findings=["K"],
                            methodology_note="M", sources=["S"], confidence_level="H", limitations="L",
                            search_experience_principles=[], relevance_and_ranking_factors=[],
                            semantic_search_considerations=[], search_strategy="", synthesis="",
                            evidence_table=[], gaps_and_future_directions=""
                        )
                    )
                class GenericMockData:
                    def model_dump(self):
                        return {}
                return MockResult(GenericMockData())

        def mock_get_llm_client(*args, **kwargs):
            return MockClient()

        monkeypatch.setattr("strategy.workflows.get_llm_client", mock_get_llm_client)

        run_agent_for_single_task(research_task)
        
        # Document should still be created
        assert ResearchDocument.objects.filter(task=research_task).exists()
        research_task.refresh_from_db()
        # Even if reviewer says revise, we expect the document to exist.
        # It's up to the workflow whether status is "completed" or something else ("blocked")
        print(research_task.telemetry)
        assert research_task.status == "blocked"

    def test_revision_requests_added_to_document_as_review_notes(self, research_task, monkeypatch):
        from strategy.workflows import ExecutiveReviewOutput
        
        class MockResult:
            def __init__(self, data):
                self.data = data
                self.audit = {"raw_prompt": "", "raw_response": ""}
                self.telemetry = {"model": "mock"}

        class MockClient:
            def execute(self, **kwargs):
                if kwargs.get("schema_class") == ExecutiveReviewOutput:
                    return MockResult(
                        ExecutiveReviewOutput(
                            reviewed_task_title="Test Task",
                            overall_assessment="Needs more sources on semantic search",
                            strongest_points=[],
                            weakest_points=["Lack of evidence"],
                            missing_evidence=["Missing specific case studies"],
                            challenge_questions=[],
                            executive_readiness_score=4,
                            recommendation="revise",
                            required_revisions=["Add semantic search sources"]
                        )
                    )
                from strategy.agents.schemas import ResearchOutput
                if kwargs.get("schema_class") == ResearchOutput:
                    return MockResult(
                        ResearchOutput(
                            task_title="Test Task", summary="S", current_state="C", key_findings=["K"],
                            methodology_note="M", sources=["S"], confidence_level="H", limitations="L",
                            search_experience_principles=[], relevance_and_ranking_factors=[],
                            semantic_search_considerations=[], search_strategy="", synthesis="",
                            evidence_table=[], gaps_and_future_directions=""
                        )
                    )
                class GenericMockData:
                    def model_dump(self):
                        return {}
                return MockResult(GenericMockData())

        def mock_get_llm_client(*args, **kwargs):
            return MockClient()

        monkeypatch.setattr("strategy.workflows.get_llm_client", mock_get_llm_client)

        run_agent_for_single_task(research_task)
        
        doc = ResearchDocument.objects.get(task=research_task)
        assert "review notes" in doc.markdown.lower()
        assert "needs more sources on semantic search" in doc.markdown.lower()
