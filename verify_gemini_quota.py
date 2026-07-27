import sys
import os
import asyncio
import json
import httpx
from unittest.mock import AsyncMock, patch

# Ensure app can be imported
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))

from app.services.ai.gemini_service import (
    GeminiService,
    InvalidApiKeyError,
    QuotaExceededError,
    DailyQuotaExhaustedError,
    RateLimitExceededError,
    BillingRequiredError,
    UnsupportedModelError,
    NetworkUnavailableError,
    GeminiError
)

# Test 1: Verify default model and candidate routing
def test_candidates():
    service = GeminiService()
    assert service.model == "gemini-2.5-flash-lite", f"Expected default gemini-2.5-flash-lite, got {service.model}"
    print("Test 1 Passed: Default model is gemini-2.5-flash-lite.")

# Test 2: Mock HTTP 429 with RetryInfo and verify exponential backoff retries
async def test_retry_backoff_and_fallbacks():
    service = GeminiService()
    service.api_key = "mock_key"
    
    mock_responses = [
        # First candidate (gemini-2.5-flash-lite) gets 429 (Resource Exhausted) twice, then fails with 429 daily quota
        httpx.Response(429, content=json_error("Quota exceeded", "RATE_LIMIT_EXCEEDED", "1s")),
        httpx.Response(429, content=json_error("Quota exceeded", "RATE_LIMIT_EXCEEDED", "1s")),
        httpx.Response(429, content=json_error("Daily quota exceeded", "DAILY_LIMIT_EXCEEDED")),
        
        # Second candidate (gemini-2.5-flash) succeeds
        httpx.Response(200, json={
            "candidates": [{"content": {"parts": [{"text": "Mock success response!"}]}}]
        })
    ]
    
    call_index = 0
    
    async def mock_post(*args, **kwargs):
        nonlocal call_index
        resp = mock_responses[call_index]
        call_index += 1
        return resp

    # Stub asyncio.sleep so the test runs instantly
    with patch("asyncio.sleep", AsyncMock()) as mock_sleep:
        with patch.object(httpx.AsyncClient, "post", mock_post):
            res = await service._call_gemini("Hello test prompt")
            assert res == "Mock success response!"
            print("Test 2 Passed: Successfully backed off, retried, and fell back to gemini-2.5-flash.")
            # Sleep should have been called twice (once for first 429, once for second 429)
            assert mock_sleep.call_count == 2
            print(f"asyncio.sleep call count: {mock_sleep.call_count}")

# Test 3: Verify custom exception propagation for billing and keys
async def test_api_key_and_billing_exceptions():
    service = GeminiService()
    service.api_key = "mock_key"

    # API key invalid error 400
    with patch.object(httpx.AsyncClient, "post", AsyncMock(return_value=httpx.Response(400, content=json_error("API key not valid", "API_KEY_INVALID")))):
        try:
            await service._call_gemini("Hello")
            assert False, "Should raise InvalidApiKeyError"
        except InvalidApiKeyError:
            print("Test 3a Passed: Detected invalid API Key.")

    # Billing required error 403
    with patch.object(httpx.AsyncClient, "post", AsyncMock(return_value=httpx.Response(403, content=json_error("enable billing", "BILLING_REQUIRED")))):
        try:
            await service._call_gemini("Hello")
            assert False, "Should raise BillingRequiredError"
        except BillingRequiredError:
            print("Test 3b Passed: Detected Billing Required.")

def json_error(message, reason, retry_delay=None):
    detail = {
        "@type": "type.googleapis.com/google.rpc.ErrorInfo",
        "reason": reason
    }
    details = [detail]
    if retry_delay:
        details.append({
            "@type": "type.googleapis.com/google.rpc.RetryInfo",
            "retryDelay": retry_delay
        })
        
    return json.dumps({
        "error": {
            "code": 429,
            "message": message,
            "status": "RESOURCE_EXHAUSTED",
            "details": details
        }
    })

if __name__ == "__main__":
    test_candidates()
    asyncio.run(test_retry_backoff_and_fallbacks())
    asyncio.run(test_api_key_and_billing_exceptions())
    print("\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!")
