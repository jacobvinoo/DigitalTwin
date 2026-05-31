import pytest
from pydantic import BaseModel
from strategy.agents.client import (
    LLMClient,
    FakeLLMClient,
    AgentOutputValidationError,
    AgentExecutionError,
)

class DummySchema(BaseModel):
    message: str
    count: int

def test_valid_mocked_json_returns_schema():
    client = FakeLLMClient(response_json='{"message": "hello", "count": 1}')
    result = client.execute(
        prompt="Test",
        prompt_version="v1",
        schema_class=DummySchema
    )
    assert result.data.message == "hello"
    assert result.data.count == 1
    assert result.telemetry["model"] == "gpt-4o"
    assert result.telemetry["prompt_version"] == "v1"
    assert result.telemetry["prompt_tokens"] > 0
    assert result.telemetry["completion_tokens"] > 0
    assert result.telemetry["total_tokens"] > 0
    assert result.telemetry["api_cost_usd"] >= 0
    assert result.telemetry["execution_time_ms"] >= 0

def test_invalid_json_raises_validation_error():
    client = FakeLLMClient(response_json='{invalid json')
    with pytest.raises(AgentOutputValidationError) as exc:
        client.execute(
            prompt="Test",
            prompt_version="v1",
            schema_class=DummySchema
        )
    assert "JSON" in str(exc.value)
    
def test_schema_invalid_json_raises_validation_error():
    client = FakeLLMClient(response_json='{"message": "hello", "count": "not a number"}')
    with pytest.raises(AgentOutputValidationError) as exc:
        client.execute(
            prompt="Test",
            prompt_version="v1",
            schema_class=DummySchema
        )
    assert "Schema" in str(exc.value) or "validation" in str(exc.value).lower()

def test_timeout_raises_execution_error():
    client = FakeLLMClient(simulate_timeout=True)
    with pytest.raises(AgentExecutionError):
        client.execute(
            prompt="Test",
            prompt_version="v1",
            schema_class=DummySchema
        )

def test_telemetry_returned_on_validation_failure():
    client = FakeLLMClient(response_json='{"message": "hello"}')
    try:
        client.execute(
            prompt="Test",
            prompt_version="v1",
            schema_class=DummySchema
        )
    except AgentOutputValidationError as e:
        assert e.telemetry is not None
        assert e.telemetry["total_tokens"] > 0

def test_raw_data_stored_in_audit_field():
    client = FakeLLMClient(response_json='{"message": "hello", "count": 1}')
    result = client.execute(
        prompt="Test",
        prompt_version="v1",
        schema_class=DummySchema
    )
    assert result.audit["raw_prompt"] == "Test"
    assert "hello" in result.audit["raw_response"]
