"""
Gemini API client management
"""
import os
from google import genai


def configure_gemini():
    """Configures the Gemini client with the API key."""
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set")
    genai.configure(api_key=api_key)