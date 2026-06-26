from django.test import TestCase, override_settings
from strategy.utils.web_search import get_search_adapter, TavilySearchAdapter
from strategy.utils.source_classifier import SourceRelevanceClassifier, SnippetExtractor
from unittest.mock import patch, MagicMock

class WebSearchPipelineTests(TestCase):
    @override_settings(WEB_SEARCH_ENABLED=False)
    def test_search_adapter_fails_when_disabled(self):
        with self.assertRaises(RuntimeError) as context:
            get_search_adapter()
        self.assertIn("WEB_SEARCH_ENABLED is False", str(context.exception))

    @override_settings(WEB_SEARCH_ENABLED=True, WEB_SEARCH_PROVIDER='tavily')
    def test_search_adapter_initializes_when_enabled(self):
        adapter = get_search_adapter()
        self.assertIsInstance(adapter, TavilySearchAdapter)

    @patch('strategy.utils.source_classifier.LLMClient')
    def test_relevance_classifier_accepts_good_source(self, mock_llm_client):
        # Setup mock
        mock_llm = MagicMock()
        class MockRelevanceResponse:
            is_relevant = True
            rejection_reason = ""
        mock_llm.execute.return_value = type('MockResponse', (), {'data': MockRelevanceResponse()})()
        mock_llm_client.return_value = mock_llm

        classifier = SourceRelevanceClassifier(objective_text="Find trends in online grocery search personalization")
        sources = [{
            "title": "The State of Grocery Retail 2025",
            "url": "https://www.mckinsey.com/grocery-trends",
            "snippet": "Retailers are investing in AI-driven personalization and product discovery...",
            "publisher": "mckinsey.com"
        }]

        accepted, rejected = classifier.filter_sources(sources)
        self.assertEqual(len(accepted), 1)
        self.assertEqual(len(rejected), 0)

    @patch('strategy.utils.source_classifier.LLMClient')
    def test_relevance_classifier_rejects_hallucination(self, mock_llm_client):
        # Setup mock
        mock_llm = MagicMock()
        class MockRelevanceResponse:
            is_relevant = False
            rejection_reason = "Generic AI hallucination, not related to grocery search."
        mock_llm.execute.return_value = type('MockResponse', (), {'data': MockRelevanceResponse()})()
        mock_llm_client.return_value = mock_llm

        classifier = SourceRelevanceClassifier(objective_text="online grocery supermarket search future trends")
        sources = [{
            "title": "What is AI?",
            "url": "https://example.com/ai",
            "snippet": "AI can hallucinate and say things that aren't true.",
            "publisher": "example.com"
        }]

        accepted, rejected = classifier.filter_sources(sources)
        self.assertEqual(len(accepted), 0)
        self.assertEqual(len(rejected), 1)
        self.assertEqual(rejected[0]["rejection_reason"], "Generic AI hallucination, not related to grocery search.")

    @patch('strategy.utils.source_classifier.LLMClient')
    def test_snippet_extractor_extracts_trends(self, mock_llm_client):
        mock_llm = MagicMock()
        class MockExtractedTrend:
            snippet = "Retailers investing heavily"
            trend_signal = "AI personalization"
            future_relevance = "2026-2030"
            impact_area = "search_relevance"
            confidence_score = 0.9
            def dict(self):
                return {
                    "snippet": self.snippet, "trend_signal": self.trend_signal,
                    "future_relevance": self.future_relevance, "impact_area": self.impact_area,
                    "confidence_score": self.confidence_score
                }
        
        class MockTrendResponse:
            trends = [MockExtractedTrend()]
            
        mock_llm.execute.return_value = type('MockResponse', (), {'data': MockTrendResponse()})()
        mock_llm_client.return_value = mock_llm

        extractor = SnippetExtractor()
        source = {
            "title": "Test Title",
            "snippet": "Test snippet with trends",
        }
        
        trends = extractor.extract_trends(source, objective_text="Grocery Search")
        self.assertEqual(len(trends), 1)
        self.assertEqual(trends[0].trend_signal, "AI personalization")
