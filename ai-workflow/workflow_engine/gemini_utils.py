import os
import logging
import time
from typing import Any, List

import google.generativeai as genai
from google.api_core import exceptions
from dotenv import load_dotenv

from .ui import Spinner

def get_gemini_api_key() -> str:
    """
    Retrieves the Gemini API key from environment variables.
    
    Loads variables from a .env file if present.

    Returns:
        The Gemini API key.

    Raises:
        ValueError: If the GEMINI_API_KEY is not found.
    """
    load_dotenv()
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not found in environment or .env file.")
    return api_key

def _call_gemini_api(model: genai.GenerativeModel, prompt_parts: List[Any], spinner_message: str) -> str:
    """
    Calls the Gemini API with a given prompt, handling retries on resource exhaustion.

    Args:
        model: The initialized GenerativeModel instance.
        prompt_parts: A list of parts to be sent to the model's generate_content method.
        spinner_message: The message to display while waiting for the API call.

    Returns:
        The text response from the API.

    Raises:
        Exception: For any unexpected errors during the API call.
    """
    logging.info(f"Calling Gemini API with model: {model.model_name}")
    spinner = Spinner(spinner_message)
    spinner.start()
    try:
        while True:
            try:
                response = model.generate_content(prompt_parts)
                return response.text
            except exceptions.ResourceExhausted as e:
                spinner.stop()
                delay = getattr(e, 'retry_delay', 30)
                logging.warning(f"Gemini API quota exceeded. Retrying in {delay} seconds... Error: {e}")
                time.sleep(delay)
                spinner.start()
            except Exception as e:
                logging.error(f"An unexpected error occurred during Gemini API call: {e}", exc_info=True)
                raise
    finally:
        spinner.stop()
