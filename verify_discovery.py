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
    SdkVersionMismatchError,
    GeminiError
)

# Test 1: Verify version validator
def test_sdk_version_check():
    # Mock local generativeai library structure
    class OutdatedGenAI:
        __version__ = "0.2.1"
    
    with patch.dict(sys.modules, {"google.generativeai": OutdatedGenAI}):
        try:
            GeminiService.verify_sdk_version()
            assert False, "Should raise SdkVersionMismatchError"
        except SdkVersionMismatchError as e:
            print(f"Test 1 Passed: Outdated SDK correctly detected: {e}")

# Test 2: Verify custom priority ranking
def test_model_ranking():
    models = [
        "gemini-1.0-pro",            # Deprecated
        "gemini-1.5-flash-001",      # Deprecated version
        "gemini-1.5-flash",          # Category 1 (Flash) v1.5
        "gemini-2.5-flash",          # Category 1 (Flash) v2.5
        "gemini-2.5-flash-lite",     # Category 2 (Flash-Lite) v2.5
        "gemini-2.5-pro",            # Category 3 (Pro) v2.5
        "chat-bison-001",            # Deprecated
    ]
    
    # 1. Automatic sorting (default) -> should prioritize gemini-2.5-flash
    best_discovered = GeminiService.select_best_model(models)
    assert best_discovered == "gemini-2.5-flash", f"Expected gemini-2.5-flash, got {best_discovered}"
    print(f"Test 2a Passed: Selected automatic best model: {best_discovered}")

    # 2. Configured override -> should select gemini-2.5-pro
    best_config_pro = GeminiService.select_best_model(models, configured_model="gemini-2.5-pro")
    assert best_config_pro == "gemini-2.5-pro", f"Expected gemini-2.5-pro, got {best_config_pro}"
    print(f"Test 2b Passed: Dynamic model config override honored: {best_config_pro}")

    # 3. Configured override not valid/unavailable -> should fallback to gemini-2.5-flash
    fallback_best = GeminiService.select_best_model(models, configured_model="gemini-invalid-pro")
    assert fallback_best == "gemini-2.5-flash", f"Expected gemini-2.5-flash fallback, got {fallback_best}"
    print(f"Test 2c Passed: Fallback to best discovered on invalid override config: {fallback_best}")

# Test 3: Verify dynamic REST ListModels lookup
async def test_dynamic_rest_discovery():
    service = GeminiService()
    service.api_key = "mock_key"
    
    mock_models_response = {
        "models": [
            {
                "name": "models/gemini-2.5-flash",
                "supportedGenerationMethods": ["generateContent", "countTokens"]
            },
            {
                "name": "models/gemini-2.5-flash-lite",
                "supportedGenerationMethods": ["generateContent"]
            },
            {
                "name": "models/gemini-2.5-pro",
                "supportedGenerationMethods": ["generateContent"]
            },
            {  # missing content generation
                "name": "models/gemini-embedding-001",
                "supportedGenerationMethods": ["embedContent"]
            }
        ]
    }
    
    async def mock_get(*args, **kwargs):
        return httpx.Response(200, json=mock_models_response)

    with patch.object(httpx.AsyncClient, "get", mock_get):
        discovered = await service.discover_models("mock_api_key")
        assert "gemini-2.5-flash" in discovered
        assert "gemini-2.5-flash-lite" in discovered
        assert "gemini-2.5-pro" in discovered
        assert "gemini-embedding-001" not in discovered
        print("Test 3 Passed: Successfully queried and filtered ListModels API output.")

if __name__ == "__main__":
    test_sdk_version_check()
    test_model_ranking()
    asyncio.run(test_dynamic_rest_discovery())
    print("\nALL VERIFICATION DISCOVERY TESTS COMPLETED SUCCESSFULLY!")
