import json
import time
from typing import Type, Any
from pydantic import BaseModel, ValidationError

class AgentOutputValidationError(Exception):
    def __init__(self, message, telemetry=None):
        super().__init__(message)
        self.telemetry = telemetry

class AgentExecutionError(Exception):
    pass

class LLMResult:
    def __init__(self, data: Any, telemetry: dict, audit: dict):
        self.data = data
        self.telemetry = telemetry
        self.audit = audit

class LLMClient:
    def execute(self, prompt: str, prompt_version: str, schema_class: Type[BaseModel], model: str = "gpt-4o"):
        started = time.monotonic()
        telemetry = {
            "model": model,
            "prompt_version": prompt_version,
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
            "api_cost_usd": 0,
            "execution_time_ms": 0,
        }
        
        try:
            raw_text, usage = self._call_provider(prompt=prompt, model=model)
            telemetry.update({
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
                "total_tokens": usage.get("total_tokens", 0),
                "api_cost_usd": usage.get("api_cost_usd", 0),
            })
            
            parsed = json.loads(raw_text)
            validated = schema_class.model_validate(parsed)
            telemetry["execution_time_ms"] = int((time.monotonic() - started) * 1000)
            
            audit = {
                "raw_prompt": prompt,
                "raw_response": raw_text
            }
            
            return LLMResult(data=validated, telemetry=telemetry, audit=audit)
            
        except json.JSONDecodeError as exc:
            telemetry["execution_time_ms"] = int((time.monotonic() - started) * 1000)
            raise AgentOutputValidationError("LLM returned invalid JSON", telemetry=telemetry) from exc
        except ValidationError as exc:
            telemetry["execution_time_ms"] = int((time.monotonic() - started) * 1000)
            raise AgentOutputValidationError("LLM output failed schema validation", telemetry=telemetry) from exc
        except TimeoutError as exc:
            raise AgentExecutionError("LLM request timed out") from exc

    def _call_provider(self, prompt: str, model: str):
        raise NotImplementedError("Use FakeLLMClient for testing or implement real provider")

class FakeLLMClient(LLMClient):
    def __init__(self, response_json: str = "{}", simulate_timeout: bool = False):
        self.response_json = response_json
        self.simulate_timeout = simulate_timeout

    def _call_provider(self, prompt: str, model: str):
        if self.simulate_timeout:
            raise TimeoutError("Simulated timeout")
            
        usage = {
            "prompt_tokens": 10,
            "completion_tokens": 20,
            "total_tokens": 30,
            "api_cost_usd": 0.001
        }
        return self.response_json, usage
