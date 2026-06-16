import json
import time
import logging
from typing import Type, Any
from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)

class AgentOutputValidationError(Exception):
    def __init__(self, message, telemetry=None, audit=None, errors=None):
        super().__init__(message)
        self.telemetry = telemetry
        self.audit = audit
        self.errors = errors

class AgentExecutionError(Exception):
    pass

class LLMResult:
    def __init__(self, data: Any, telemetry: dict, audit: dict):
        self.data = data
        self.telemetry = telemetry
        self.audit = audit

class LLMClient:
    def execute(self, prompt: str, prompt_version: str, schema_class: Type[BaseModel] = None, schema_dict: dict = None, model: str = "gpt-4o"):
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
        
        logger.info("Executing LLM Request: model=%s, prompt_version=%s\nPrompt:\n%s", model, prompt_version, prompt)
        
        raw_text = ""
        try:
            raw_text, usage = self._call_provider(prompt=prompt, model=model, schema_class=schema_class, schema_dict=schema_dict)
            telemetry.update({
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
                "total_tokens": usage.get("total_tokens", 0),
                "api_cost_usd": usage.get("api_cost_usd", 0),
            })
            
            parsed = json.loads(raw_text)
            
            if schema_class:
                validated = schema_class.model_validate(parsed)
            else:
                validated = parsed
                
            telemetry["execution_time_ms"] = int((time.monotonic() - started) * 1000)
            
            logger.info("LLM Response received successfully in %dms. Tokens: %d (Cost: $%s)\nResponse:\n%s", 
                        telemetry["execution_time_ms"], telemetry["total_tokens"], telemetry["api_cost_usd"], raw_text)
            
            audit = {
                "raw_prompt": prompt,
                "raw_response": raw_text
            }
            
            return LLMResult(data=validated, telemetry=telemetry, audit=audit)
            
        except json.JSONDecodeError as exc:
            telemetry["execution_time_ms"] = int((time.monotonic() - started) * 1000)
            audit = {"raw_prompt": prompt, "raw_response": raw_text}
            logger.error("LLM Response JSON decode failed in %dms. Raw response:\n%s", telemetry["execution_time_ms"], raw_text)
            raise AgentOutputValidationError("LLM returned invalid JSON", telemetry=telemetry, audit=audit, errors=str(exc)) from exc
        except ValidationError as exc:
            telemetry["execution_time_ms"] = int((time.monotonic() - started) * 1000)
            audit = {"raw_prompt": prompt, "raw_response": raw_text}
            logger.error("LLM Response validation failed in %dms. Errors: %s. Raw response:\n%s", 
                         telemetry["execution_time_ms"], str(exc.errors()), raw_text)
            raise AgentOutputValidationError("LLM output failed schema validation", telemetry=telemetry, audit=audit, errors=exc.errors()) from exc
        except TimeoutError as exc:
            logger.error("LLM request timed out.")
            raise AgentExecutionError("LLM request timed out") from exc
        except Exception as exc:
            logger.error("LLM execution error: %s", str(exc), exc_info=True)
            raise

    def _call_provider(self, prompt: str, model: str, schema_class=None, schema_dict=None):
        import os
        import requests
        
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is not set")
            
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": "You are a helpful strategy and product management assistant. You MUST respond with a raw JSON object matching the requested schema. Do not output markdown code blocks (e.g. ```json) in your response."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.2
        }
        
        if schema_class or schema_dict:
            if schema_class:
                raw_schema = schema_class.model_json_schema()
                schema_name = schema_class.__name__
            else:
                raw_schema = schema_dict
                schema_name = "DynamicSchema"
                
            if not isinstance(raw_schema, dict):
                raise ValueError("Provided schema must be a valid JSON schema dictionary.")
            if raw_schema.get("type") != "object":
                raise ValueError(f"Invalid schema for response_format '{schema_name}': The root schema must have 'type': 'object'.")
            if "properties" not in raw_schema:
                raise ValueError(f"Invalid schema for response_format '{schema_name}': The root schema must define 'properties'.")
            
            def make_strict_schema(schema: Any) -> Any:
                if isinstance(schema, dict):
                    # OpenAI structured outputs require additionalProperties=False
                    if schema.get("type") == "object":
                        schema["additionalProperties"] = False
                        if "properties" in schema:
                            schema["required"] = list(schema["properties"].keys())
                    for k, v in schema.items():
                        schema[k] = make_strict_schema(v)
                elif isinstance(schema, list):
                    return [make_strict_schema(item) for item in schema]
                return schema
                
            json_schema = make_strict_schema(raw_schema)
            payload["response_format"] = {
                "type": "json_schema",
                "json_schema": {
                    "name": schema_name,
                    "schema": json_schema,
                    "strict": True
                }
            }
        else:
            payload["response_format"] = {"type": "json_object"}
        
        max_retries = 5
        base_delay = 2
        
        for attempt in range(max_retries):
            response = requests.post(url, headers=headers, json=payload, timeout=60)
            
            if response.status_code == 429:
                if attempt < max_retries - 1:
                    sleep_time = base_delay * (2 ** attempt)
                    logger.warning(f"OpenAI API rate limit hit. Retrying in {sleep_time}s... (Attempt {attempt+1}/{max_retries})")
                    time.sleep(sleep_time)
                    continue
                else:
                    raise RuntimeError(f"OpenAI API rate limit exceeded after {max_retries} attempts: {response.text}")
            elif response.status_code != 200:
                raise RuntimeError(f"OpenAI API request failed: {response.status_code} - {response.text}")
            
            break # Success, exit retry loop
            
        res_json = response.json()
        raw_text = res_json["choices"][0]["message"]["content"]
        
        # Clean up any markdown code block wrappers if they exist
        raw_text = raw_text.strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        elif raw_text.startswith("```"):
            raw_text = raw_text[3:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
        raw_text = raw_text.strip()
        
        usage_data = res_json.get("usage", {})
        prompt_tokens = usage_data.get("prompt_tokens", 0)
        completion_tokens = usage_data.get("completion_tokens", 0)
        api_cost = (prompt_tokens * 0.000005) + (completion_tokens * 0.000015)
        
        usage = {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": usage_data.get("total_tokens", 0),
            "api_cost_usd": api_cost
        }
        
        return raw_text, usage

class FakeLLMClient(LLMClient):
    def __init__(self, response_json: str = "{}", simulate_timeout: bool = False):
        self.response_json = response_json
        self.simulate_timeout = simulate_timeout

    def _call_provider(self, prompt: str, model: str, schema_class=None, schema_dict=None):
        if self.simulate_timeout:
            raise TimeoutError("Simulated timeout")
            
        usage = {
            "prompt_tokens": 10,
            "completion_tokens": 20,
            "total_tokens": 30,
            "api_cost_usd": 0.001
        }
        return self.response_json, usage
