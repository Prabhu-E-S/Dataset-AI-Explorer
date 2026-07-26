from abc import ABC, abstractmethod
from typing import Dict, Any, List

class AIService(ABC):
    """
    Abstract Base Class for AI Services to interact with different LLMs.
    Ensures easy integration of other providers (e.g. OpenAI, Groq) in the future.
    """

    @abstractmethod
    async def generate_summary(self, filename: str, filesize: int, rows: int, columns: int, datatypes: dict, sample_rows: list) -> str:
        """
        Generate a concise overview of the dataset.
        """
        pass

    @abstractmethod
    async def determine_intent(self, query: str, columns_metadata: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyze a user query and dataset schemas to identify intent, safe Pandas code, and chart configurations.
        """
        pass

    @abstractmethod
    async def explain_results(self, query: str, execution_result: str) -> str:
        """
        Use LLM reasoning to translate raw calculation outputs (from Pandas executor) into natural explanations.
        """
        pass
