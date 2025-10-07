"""
Gemini API client management
"""
import os
from google import genai


class GeminiClientManager:
    """Manages Gemini client initialization"""

    _client = None  # Singleton instance

    @classmethod
    def get_client(cls) -> genai.Client:
        """Get or create Gemini client (lazy initialization)"""
        if cls._client is None:
            api_key = os.environ.get('GEMINI_API_KEY')
            if not api_key:
                raise ValueError("GEMINI_API_KEY environment variable is not set")
            cls._client = genai.Client(api_key=api_key)
        return cls._client
