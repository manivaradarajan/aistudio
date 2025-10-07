"""
Prompt construction for Gemini API
"""
from typing import Dict


class PromptBuilder:
    """Handles prompt construction for Gemini"""

    @staticmethod
    def build(config: Dict) -> str:
        """Build the prompt for Gemini (without context history, which is handled via chat API)"""
        parts = []

        if config['task']:
            parts.append(f"Task: {config['task']}")

        if config['input']:
            parts.append(f"Input:\n{config['input']}")

        return '\n\n'.join(parts)
