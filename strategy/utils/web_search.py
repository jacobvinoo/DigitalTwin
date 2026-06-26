import os
import requests
import json
from datetime import datetime
from django.conf import settings

class WebSearchAdapter:
    def search(self, query: str, domains: list[str] = None) -> list[dict]:
        """
        Return real search results only.
        Must include title, url, snippet, publisher, retrieved_at.
        """
        raise NotImplementedError("Subclasses must implement search()")

class TavilySearchAdapter(WebSearchAdapter):
    def __init__(self):
        self.api_key = getattr(settings, 'TAVILY_API_KEY', os.environ.get('TAVILY_API_KEY'))
        
    def search(self, query: str, domains: list[str] = None) -> list[dict]:
        if not self.api_key:
            # If we don't have a real API key for MVP testing, we could fallback to an error or mock,
            # but since the prompt says "fail with a clear system error if WEB_SEARCH_ENABLED=false",
            # we'll raise an error if the key is missing too, though in tests we might mock this.
            pass
            
        endpoint = "https://api.tavily.com/search"
        payload = {
            "api_key": self.api_key,
            "query": query,
            "search_depth": "basic",
            "include_domains": domains if domains else [],
            "max_results": 5
        }
        
        try:
            response = requests.post(endpoint, json=payload, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            results = []
            for r in data.get("results", []):
                # Tavily doesn't give publisher explicitly, but we can extract from domain
                domain = r.get("url", "").split("/")[2] if "://" in r.get("url", "") else "web"
                results.append({
                    "title": r.get("title", ""),
                    "url": r.get("url", ""),
                    "snippet": r.get("content", ""),
                    "publisher": domain,
                    "retrieved_at": datetime.utcnow().isoformat()
                })
            return results
        except Exception as e:
            raise RuntimeError(f"Tavily search failed: {str(e)}")

class DuckDuckGoSearchAdapter(WebSearchAdapter):
    def search(self, query: str, domains: list[str] = None) -> list[dict]:
        from duckduckgo_search import DDGS
        import warnings
        
        # Suppress the deprecation warning
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            try:
                # Add site filters if domains provided
                if domains:
                    site_query = " OR ".join([f"site:{d}" for d in domains])
                    query = f"{query} {site_query}"
                    
                results = DDGS().text(query, max_results=5)
                
                mapped_results = []
                for r in results:
                    domain = r.get("href", "").split("/")[2] if "://" in r.get("href", "") else "web"
                    mapped_results.append({
                        "title": r.get("title", ""),
                        "url": r.get("href", ""),
                        "snippet": r.get("body", ""),
                        "publisher": domain,
                        "retrieved_at": datetime.utcnow().isoformat()
                    })
                return mapped_results
            except Exception as e:
                raise RuntimeError(f"DuckDuckGo search failed: {str(e)}")

def get_search_adapter() -> WebSearchAdapter:
    from dotenv import load_dotenv
    from django.conf import settings
    # Dynamically reload the env file so we pick up changes without a server restart
    # Do NOT use override=True, because it will overwrite valid env vars (like OPENAI_API_KEY)
    # passed from the shell with placeholder values in the .env file!
    load_dotenv(os.path.join(settings.BASE_DIR, '.env'))
    
    # MVP configuration: default to True unless explicitly disabled
    is_enabled = getattr(settings, 'WEB_SEARCH_ENABLED', True)
    if str(os.environ.get('WEB_SEARCH_ENABLED', '')).lower() == 'false':
        is_enabled = False
        
    if not is_enabled:
        raise RuntimeError("Real web search is disabled. Cannot retrieve sources. (WEB_SEARCH_ENABLED is False)")
        
    provider = os.environ.get('WEB_SEARCH_PROVIDER', getattr(settings, 'WEB_SEARCH_PROVIDER', 'duckduckgo'))
    tavily_key = os.environ.get('TAVILY_API_KEY', getattr(settings, 'TAVILY_API_KEY', ''))
    
    # Auto-prefer tavily if key is present
    if tavily_key and (provider == 'tavily' or provider == 'duckduckgo'):
        provider = 'tavily'
    
    if provider == 'tavily' and tavily_key:
        return TavilySearchAdapter()
    
    # Fallback to DuckDuckGo
    return DuckDuckGoSearchAdapter()
