import os
import httpx
import json
from typing import Dict, Any, List
from app.services.ai.base import AIService
from app.config import settings

class GeminiService(AIService):
    """
    Implementation of AIService using Gemini REST API.
    Utilizes HTTP POST calls to avoid SDK dependency installation issues and
    allows custom rate limits, logs, and timeouts handling.
    """

    def __init__(self):
        self.api_key = os.environ.get("GEMINI_API_KEY")
        # Fallback to key from settings if present
        if not self.api_key:
            self.api_key = getattr(settings, "GEMINI_API_KEY", None)
            
        self.model = "gemini-2.5-flash"
        self.api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"

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

    async def _call_gemini(self, prompt: str, enforce_json: bool = False, timeout: float = 30.0) -> str:
        """
        Sends an HTTP POST query to the Google Gemini API.
        """
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is not configured in current environment variables.")

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

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    self.api_url,
                    json=payload,
                    headers=headers,
                    params=params,
                    timeout=timeout
                )
                
                if response.status_code != 200:
                    error_detail = response.json() if response.status_code == 400 else response.text
                    raise RuntimeError(f"Gemini API returned error code {response.status_code}: {error_detail}")
                
                resp_json = response.json()
                text_response = resp_json["candidates"][0]["content"]["parts"][0]["text"]
                return text_response
            except httpx.TimeoutException:
                raise TimeoutError("Gemini API call timed out.")
            except Exception as e:
                # Catch parsing, network or HTTP errors
                raise RuntimeError(f"Error querying Gemini service: {str(e)}")

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
