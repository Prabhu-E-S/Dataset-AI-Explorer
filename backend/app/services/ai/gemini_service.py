import os
import httpx
import json
import asyncio
from typing import Dict, Any, List
from app.services.ai.base import AIService
from app.config import settings

class GeminiError(Exception):
    """Base exception for Gemini service issues"""
    pass

class InvalidApiKeyError(GeminiError):
    """Raised when the Gemini API key is invalid or unauthorized"""
    pass

class QuotaExceededError(GeminiError):
    """Raised when the Gemini API quota is fully exhausted"""
    pass

class DailyQuotaExhaustedError(GeminiError):
    """Raised when the daily Gemini request limit is hit"""
    pass

class RateLimitExceededError(GeminiError):
    """Raised when a request is rate-limited (HTTP 429)"""
    pass

class BillingRequiredError(GeminiError):
    """Raised when the Gemini model requires billing to be enabled"""
    pass

class UnsupportedModelError(GeminiError):
    """Raised when a model is not supported or not found"""
    pass

class NetworkUnavailableError(GeminiError):
    """Raised when the network is unreachable"""
    pass

class SdkVersionMismatchError(GeminiError):
    """Raised when the installed google-generativeai SDK is outdated or incompatible"""
    pass

class GeminiService(AIService):
    """
    Implementation of AIService using Gemini REST API.
    Utilizes HTTP POST calls to avoid SDK dependency installation issues and
    allows custom rate limits, logs, and timeouts handling.
    """

    _cached_valid_models: List[str] = None
    _selected_model: str = None

    def __init__(self):
        self.api_key = os.environ.get("GEMINI_API_KEY")
        # Fallback to key from settings if present
        if not self.api_key:
            self.api_key = getattr(settings, "GEMINI_API_KEY", None)
            
        self.configured_model = getattr(settings, "GEMINI_MODEL", "")

    def _load_template(self, template_name: str) -> str:
        """
        Helper to load prompt templates dynamically from app/prompts/
        """
        app_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        path = os.path.join(app_dir, "prompts", template_name)
        if not os.path.exists(path):
            raise FileNotFoundError(f"Prompt template {template_name} not found at {path}")
        with open(path, "r", encoding="utf-8") as f:
            return f.read()

    @classmethod
    def verify_sdk_version(cls):
        """
        Verifies if the installed google-generativeai version is compatible.
        Raises SdkVersionMismatchError if outdated.
        """
        try:
            import google.generativeai as genai
            version_str = getattr(genai, "__version__", "0.0.0")
            version_parts = [int(p) for p in version_str.split(".") if p.isdigit()]
            # require at least 0.3.0
            if version_parts and version_parts[0] == 0:
                if len(version_parts) > 1 and version_parts[1] < 3:
                    raise SdkVersionMismatchError(f"SDK version mismatch: google-generativeai version {version_str} is outdated (requires >= 0.3.0).")
        except ImportError:
            # REST execution is fallback if not installed, but if library is missing, we don't block
            pass

    @classmethod
    async def discover_models(cls, api_key: str) -> List[str]:
        """
        Queries Google Gemini ListModels API to get all available models.
        """
        if not api_key:
            return []
            
        url = "https://generativelanguage.googleapis.com/v1beta/models"
        params = {"key": api_key}
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params, timeout=10.0)
                
                # Check for Invalid API Key immediately
                if response.status_code in (400, 403):
                    low_text = response.text.lower()
                    if "api key" in low_text or "api_key_invalid" in low_text or "not valid" in low_text:
                        raise InvalidApiKeyError("Invalid API Key. Please configure a valid GEMINI_API_KEY in your environment.")
                        
                if response.status_code == 200:
                    data = response.json()
                    models_list = data.get("models", [])
                    
                    valid_models = []
                    for m in models_list:
                        name = m.get("name", "")
                        methods = m.get("supportedGenerationMethods", [])
                        if "generateContent" in methods:
                            clean_name = name.replace("models/", "")
                            valid_models.append(clean_name)
                    return valid_models
        except GeminiError:
            raise
        except Exception as e:
            print(f"[GeminiService] Model discovery request failed: {e}")
            
        return []

    @classmethod
    def select_best_model(cls, models: List[str], configured_model: str = None) -> str:
        """
        Selects the best model from the available options.
        1. Flash (latest version first)
        2. Flash-Lite (latest version first)
        3. Pro (latest version first)
        """
        if configured_model:
            c_name = configured_model.strip().replace("models/", "")
            if c_name in models:
                return c_name

        # Exclude deprecated models from sorting
        deprecated_patterns = [
            "gemini-1.0", "gemini-1.0-pro", "gemini-pro",
            "bison", "deprecated", "gemini-2.5-flash-001",
            "gemini-1.5-flash-001", "gemini-1.5-pro-001"
        ]
        
        selectable = []
        for m in models:
            if any(pat in m.lower() for pat in deprecated_patterns):
                continue
            selectable.append(m)
            
        if not selectable:
            # Fallback to standard resilient flash if all got filtered
            return models[0] if models else "gemini-2.5-flash-lite"

        def parse_sort_key(name: str):
            import re
            clean_name = name.lower()
            
            # Category index (lower = higher priority)
            if "flash-lite" in clean_name:
                category = 2
            elif "flash" in clean_name:
                category = 1
            elif "pro" in clean_name:
                category = 3
            else:
                category = 99
                
            # Version match
            version_match = re.search(r"gemini-(\d+\.?\d*)", clean_name)
            version = float(version_match.group(1)) if version_match else 0.0
            
            return (category, -version)

        selectable.sort(key=parse_sort_key)
        return selectable[0]

    @classmethod
    async def initialize_service(cls):
        """
        Startup model discovery mechanism.
        Queries ListModels API, filters, selects the best model, caches the choice,
        and logs the outcome to the console.
        """
        # SDK verification check
        try:
            cls.verify_sdk_version()
        except SdkVersionMismatchError as e:
            print(f"[GeminiService] SDK Warning: {e}")
            raise

        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            api_key = getattr(settings, "GEMINI_API_KEY", None)

        if not api_key:
            print("[GeminiService] GEMINI_API_KEY is missing. Dynamic model discovery skipped.")
            cls._cached_valid_models = ["gemini-2.5-flash-lite", "gemini-2.5-flash"]
            cls._selected_model = "gemini-2.5-flash-lite"
            return

        try:
            models = await cls.discover_models(api_key)
            if models:
                cls._cached_valid_models = models
                configured_model = getattr(settings, "GEMINI_MODEL", "")
                cls._selected_model = cls.select_best_model(models, configured_model)
                
                print("\nDetected Gemini models:")
                for m in cls._cached_valid_models:
                    # Append checkmark log indicator
                    print(f"✓ {m}")
                print(f"\nSelected:\n{cls._selected_model}\n")
            else:
                print("[GeminiService] ListModels API returned empty. Reverting to default backups.")
                cls._cached_valid_models = ["gemini-2.5-flash-lite", "gemini-2.5-flash"]
                cls._selected_model = getattr(settings, "GEMINI_MODEL", "") or "gemini-2.5-flash-lite"
        except InvalidApiKeyError as e:
            print(f"[GeminiService] Key failure: {e}")
            cls._cached_valid_models = ["gemini-2.5-flash-lite", "gemini-2.5-flash"]
            cls._selected_model = "gemini-2.5-flash-lite"
            raise
        except Exception as e:
            print(f"[GeminiService] Discovery initialization error: {e}")
            cls._cached_valid_models = ["gemini-2.5-flash-lite", "gemini-2.5-flash"]
            cls._selected_model = "gemini-2.5-flash-lite"

    async def _call_gemini(self, prompt: str, enforce_json: bool = False, timeout: float = 30.0) -> str:
        """
        Sends an HTTP POST query to the Google Gemini API.
        Automatically attempts fallback models if key or model is unsupported/not found.
        """
        if not self.api_key:
            raise InvalidApiKeyError("Invalid API Key. Please configure a valid GEMINI_API_KEY in your environment.")

        headers = {
            "Content-Type": "application/json"
        }
        
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": prompt
                        }
                    ]
                }
            ]
        }

        if enforce_json:
            payload["generationConfig"] = {
                "responseMimeType": "application/json"
            }

        params = {
            "key": self.api_key
        }

        # Lazy initialize if not already done
        if self.__class__._selected_model is None:
            await self.__class__.initialize_service()

        primary_model = self.__class__._selected_model or "gemini-2.5-flash-lite"
        
        # Build fallback candidates list dynamically
        candidates = [primary_model]
        
        # Add discovered active models (excluding primary)
        cached_list = self.__class__._cached_valid_models or []
        for m in cached_list:
            if m not in candidates:
                candidates.append(m)

        # Fallback defaults in case list is somehow empty
        for backup in ["gemini-2.5-flash-lite", "gemini-2.5-flash"]:
            if backup not in candidates:
                candidates.append(backup)

        last_error = None
        max_retries = 3

        for model in candidates:
            api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            
            success = False
            response_text = None

            for attempt in range(max_retries):
                try:
                    async with httpx.AsyncClient() as client:
                        response = await client.post(
                            api_url,
                            json=payload,
                            headers=headers,
                            params=params,
                            timeout=timeout
                        )
                    
                    # 1. Success case
                    if response.status_code == 200:
                        resp_json = response.json()
                        response_text = resp_json["candidates"][0]["content"]["parts"][0]["text"]
                        success = True
                        break
                    
                    # 2. HTTP 429 Rate / Quota Limit case
                    elif response.status_code == 429:
                        resp_text = response.text
                        is_daily = "daily" in resp_text.lower()
                        is_quota = "quota" in resp_text.lower()
                        
                        # Inspect RetryInfo
                        retry_delay = float(2 ** (attempt + 1))  # Default exponential backoff: 2s, 4s, 8s
                        try:
                            err_json = response.json()
                            details = err_json.get("error", {}).get("details", [])
                            for detail in details:
                                if detail.get("@type") == "type.googleapis.com/google.rpc.RetryInfo":
                                    delay_str = detail.get("retryDelay", "")
                                    if delay_str.endswith("s"):
                                        retry_delay = float(delay_str[:-1])
                        except Exception:
                            pass
                            
                        # If daily quota limit is reached, fail immediately to prevent looping
                        if is_quota and is_daily:
                            last_error = DailyQuotaExhaustedError("Daily quota exhausted. Please try again tomorrow or upgrade your plan.")
                            print(f"[GeminiService] Model '{model}' hit daily quota limit. Skipping retries.")
                            break
                        
                        # Resource exhausted / rate limited
                        if is_quota:
                            last_error = QuotaExceededError("Quota exceeded. Please check your rate limits or enable billing.")
                        else:
                            last_error = RateLimitExceededError("Rate limited. Please slow down your requests.")
                            
                        print(f"[GeminiService] Model '{model}' rate limited (HTTP 429). Attempt {attempt + 1}/{max_retries}. Sleeping {retry_delay}s...")
                        await asyncio.sleep(retry_delay)
                        continue
                        
                    # 3. HTTP 400, 403, 404, 500 cases
                    else:
                        resp_text = response.text
                        low_text = resp_text.lower()
                        
                        # Validate specific client configuration issues immediately
                        if response.status_code in (400, 403):
                            if "api key" in low_text or "api_key_invalid" in low_text or "not valid" in low_text:
                                raise InvalidApiKeyError("Invalid API Key. Please configure a valid GEMINI_API_KEY in your environment.")
                            if "billing" in low_text:
                                raise BillingRequiredError("Billing required. Please check model requirements or enable billing on the Google Cloud project.")
                            if "not enabled" in low_text or "not allowed" in low_text or "has not been used" in low_text:
                                raise GeminiError(f"Gemini API has not been enabled in the Google Cloud project: {resp_text}")
                            if "not found" in low_text or "unsupported" in low_text or "invalid model" in low_text:
                                last_error = UnsupportedModelError(f"Unsupported model '{model}': {resp_text}")
                                break
                                
                        if response.status_code == 404:
                            last_error = UnsupportedModelError(f"Model '{model}' not found: {resp_text}")
                            break
                            
                        last_error = RuntimeError(f"Gemini API returned error code {response.status_code}: {resp_text}")
                        break
                        
                except httpx.ConnectError as e:
                    raise NetworkUnavailableError("Network unavailable. Please check your internet connection.") from e
                except httpx.TimeoutException as e:
                    raise TimeoutError("Gemini API call timed out.") from e
                except GeminiError:
                    # Bubble up known custom exceptions immediately
                    raise
                except Exception as e:
                    last_error = e
                    break
            
            if success:
                return response_text
            
            # If rate limit wasn't resolved after max_retries, or if model load failed, log and try next model
            print(f"[GeminiService] Candidate '{model}' failed (Last error: {last_error}). Moving to next candidate...")
            
        # If we exhausted all candidate models
        if last_error:
            if isinstance(last_error, GeminiError):
                raise last_error
            # Map exception string details
            err_str = str(last_error).lower()
            if "quota" in err_str:
                if "daily" in err_str:
                    raise DailyQuotaExhaustedError("Daily quota exhausted. Please try again tomorrow or upgrade your plan.")
                raise QuotaExceededError("Quota exceeded. Please check your rate limits or enable billing.")
            if "limit" in err_str or "rate" in err_str:
                raise RateLimitExceededError("Rate limited. Please slow down your requests.")
            if "api key" in err_str or "api_key_invalid" in err_str or "not valid" in err_str:
                raise InvalidApiKeyError("Invalid API Key. Please configure a valid GEMINI_API_KEY in your environment.")
            if "billing" in err_str:
                raise BillingRequiredError("Billing required. Please check model requirements or enable billing on the Google Cloud project.")
            if "network" in err_str or "connect" in err_str:
                raise NetworkUnavailableError("Network unavailable. Please check your internet connection.")
                
            raise GeminiError(f"All Gemini candidate models failed. Last error: {str(last_error)}")

        raise GeminiError("Gemini service is currently unavailable. Please try again later.")

    async def generate_summary(self, filename: str, filesize: int, rows: int, columns: int, datatypes: dict, sample_rows: list) -> str:
        """
        Generates a dataset summary by merging metadata metrics into summary.txt prompt.
        """
        template = self._load_template("summary.txt")
        filesize_mb = filesize / (1024 * 1024)
        
        datatypes_str = "\n".join([f"- {col}: {dtype}" for col, dtype in datatypes.items()])
        sample_str = json.dumps(sample_rows, indent=2)

        prompt = template.format(
            filename=filename,
            filesize_mb=filesize_mb,
            rows=rows,
            columns=columns,
            datatypes=datatypes_str,
            sample_data=sample_str
        )

        return await self._call_gemini(prompt)

    async def determine_intent(self, query: str, columns_metadata: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Categorizes query and outputs safe pandas code using intent.txt template.
        """
        template = self._load_template("intent.txt")
        
        columns_summary = []
        for col in columns_metadata:
            columns_summary.append({
                "name": col["name"],
                "data_type": col["data_type"],
                "missing_count": col.get("missing_count", 0),
                "uniques": col.get("uniques", 0),
                "sample_values": col.get("sample_values", [])
            })
            
        columns_str = json.dumps(columns_summary, indent=2)

        prompt = template.format(
            column_metadata=columns_str,
            user_query=query
        )

        raw_json_str = await self._call_gemini(prompt, enforce_json=True)
        try:
            return json.loads(raw_json_str)
        except json.JSONDecodeError:
            # Fallback if structure parsing fails
            return {
                "intent": "general",
                "explanation": "Failed to parse structured intent response. Providing general feedback.",
                "pandas_code": "",
                "chart_config": None
            }

    async def explain_results(self, query: str, execution_result: str) -> str:
        """
        Converts pandas results into readable descriptive answers.
        """
        # We can reuse insight.txt prompt or design a custom explanation query
        try:
            template = self._load_template("insight.txt")
        except FileNotFoundError:
            template = "Question: {user_query}\nPandas Results:\n{execution_output}\nWrite standard response."
            
        prompt = template.format(
            filename="Active Dataset",
            rows="NA",
            columns="NA",
            column_info="Provided below",
            execution_output=execution_result,
            user_query=query
        )

        return await self._call_gemini(prompt)

    async def call_ai(self, system_prompt: str, user_prompt: str) -> str:
        """
        Sends general custom prompt instructions to Gemini.
        """
        prompt = f"{system_prompt}\n{user_prompt}"
        return await self._call_gemini(prompt)
