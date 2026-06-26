from typing import List, Dict, Any
from pydantic import BaseModel, Field

# We use the existing LLMClient to execute the classification
from strategy.agents.client import LLMClient

class RelevanceResponse(BaseModel):
    is_relevant: bool
    rejection_reason: str = Field(default="", description="If not relevant, explain why.")

class ExtractedTrend(BaseModel):
    snippet: str
    trend_signal: str
    future_relevance: str
    impact_area: str
    confidence_score: float

class TrendExtractionResponse(BaseModel):
    trends: List[ExtractedTrend]

class SourceRelevanceClassifier:
    def __init__(self, objective_text: str):
        self.objective_text = objective_text
        self.llm = LLMClient()
        
    def filter_sources(self, sources: List[Dict[str, Any]]) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Returns (accepted_sources, rejected_sources)
        """
        accepted = []
        rejected = []
        
        system_prompt = f"""You are a Source Relevance Filter.
Your goal is to decide if a search result snippet is highly relevant to the following research objective.
Reject generic SEO spam, broad AI definitions, or hallucinations unless explicitly requested.

RESEARCH OBJECTIVE:
{self.objective_text}
"""
        for src in sources:
            user_prompt = f"Title: {src.get('title')}\nURL: {src.get('url')}\nSnippet: {src.get('snippet')}\nPublisher: {src.get('publisher')}\n\nIs this relevant to the objective?"
            
            try:
                res = self.llm.execute(
                    prompt=f"{system_prompt}\n\n{user_prompt}",
                    prompt_version="1.0",
                    schema_class=RelevanceResponse,
                    model="gpt-4o-mini"
                )
                
                # Handle dictionary response or BaseModel response depending on LLM wrapper
                data = res.data if hasattr(res, 'data') else res
                if isinstance(data, dict):
                    is_relevant = data.get("is_relevant", False)
                    reason = data.get("rejection_reason", "")
                else:
                    is_relevant = data.is_relevant
                    reason = data.rejection_reason
                
                if is_relevant:
                    accepted.append(src)
                else:
                    src["rejection_reason"] = reason
                    rejected.append(src)
            except Exception as e:
                # If LLM fails, we err on the side of rejecting to be safe, or we could accept. Let's reject.
                src["rejection_reason"] = f"LLM Error: {str(e)}"
                rejected.append(src)
                
        return accepted, rejected


class SnippetExtractor:
    def __init__(self):
        self.llm = LLMClient()
        
    def extract_trends(self, source: Dict[str, Any], objective_text: str) -> List[ExtractedTrend]:
        system_prompt = f"""You are a Trend Snippet Extractor.
Extract precise, specific trend signals from the source text related to the research objective.
Do not invent anything. If there are no clear future trends or signals, return an empty list.

RESEARCH OBJECTIVE:
{self.objective_text if hasattr(self, 'objective_text') else objective_text}
"""
        user_prompt = f"Source Title: {source.get('title')}\nSnippet: {source.get('snippet')}\nExtract trends."
        
        try:
            res = self.llm.execute(
                prompt=f"{system_prompt}\n\n{user_prompt}",
                prompt_version="1.0",
                schema_class=TrendExtractionResponse,
                model="gpt-4o-mini"
            )
            
            data = res.data if hasattr(res, 'data') else res
            if isinstance(data, dict):
                trends_data = data.get("trends", [])
                return [ExtractedTrend(**t) for t in trends_data]
            else:
                return data.trends
        except Exception:
            return []
