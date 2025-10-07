"""
Google Docs document parsing
"""
from typing import Dict, List

from .config import GEMINI_MODEL, TAB_NAMES


class DocumentParser:
    """Handles Google Docs parsing operations"""

    @staticmethod
    def parse_tabs(doc: Dict) -> Dict:
        """Extract content from document tabs"""
        tabs = doc.get('tabs', [])
        config = {
            'system_prompt': '',
            'task': '',
            'parameters': {},
            'input': '',
            'input_files': [],
            'uploaded_files_tracking': '',
            'context_history': '',
            'use_context': False,
            'gemini_model': GEMINI_MODEL,
            'output_markdown': True,
            'streaming_output': False,
        }

        print(f"DEBUG: Processing {len(tabs)} document tabs")

        for tab in tabs:
            title = tab.get('tabProperties', {}).get('title', '')
            print(f"DEBUG: Tab title: '{title}'")

            content_elements = tab.get('documentTab', {}).get('body', {}).get('content', [])

            if title == TAB_NAMES['SYSTEM_PROMPT']:
                text = DocumentParser._extract_text(content_elements)
                print(f"DEBUG: Found System Prompt tab, length: {len(text)}")
                config['system_prompt'] = text
            elif title == TAB_NAMES['TASK']:
                text = DocumentParser._extract_text(content_elements)
                print(f"DEBUG: Found Task tab, length: {len(text)}")
                config['task'] = text
            elif title == TAB_NAMES['PARAMETERS']:
                text = DocumentParser._extract_text(content_elements, skip_comments=True)
                print(f"DEBUG: Found Parameters tab, length: {len(text)}")
                config['parameters'] = DocumentParser._parse_parameters(text)
                if 'GEMINI_MODEL' in config['parameters']:
                    config['gemini_model'] = config['parameters']['GEMINI_MODEL']
                if 'OUTPUT_MARKDOWN' in config['parameters']:
                    val = config['parameters']['OUTPUT_MARKDOWN'].lower()
                    config['output_markdown'] = val in ('true', 'yes', '1')
                    print(f"DEBUG: OUTPUT_MARKDOWN set to: {config['output_markdown']}")
                if 'STREAMING_OUTPUT' in config['parameters']:
                    val = config['parameters']['STREAMING_OUTPUT'].lower()
                    config['streaming_output'] = val in ('true', 'yes', '1')
                    print(f"DEBUG: STREAMING_OUTPUT set to: {config['streaming_output']}")
                if 'USE_CONTEXT' in config['parameters']:
                    val = config['parameters']['USE_CONTEXT'].lower()
                    config['use_context'] = val in ('true', 'yes', '1')
                    print(f"DEBUG: USE_CONTEXT set to: {config['use_context']}")
            elif title == TAB_NAMES['INPUT']:
                text = DocumentParser._extract_text(content_elements, skip_comments=True)
                print(f"DEBUG: Found Input tab, length: {len(text)}")
                config['input'] = text
                config['input_files'] = DocumentParser._extract_file_urls(content_elements)
                print(f"DEBUG: Found {len(config['input_files'])} files in Input tab")
            elif title == TAB_NAMES['UPLOADED_FILES']:
                text = DocumentParser._extract_text(content_elements)
                print(f"DEBUG: Found Uploaded Files tracking tab, length: {len(text)}")
                config['uploaded_files_tracking'] = text
            elif title == TAB_NAMES['CONTEXT_HISTORY']:
                text = DocumentParser._extract_text(content_elements)
                print(f"DEBUG: Found Context History tab, length: {len(text)}")
                config['context_history'] = text

        print(f"DEBUG: Configuration loaded - Task: {len(config['task'])} chars, "
              f"System Prompt: {len(config['system_prompt'])} chars, "
              f"Input files: {len(config['input_files'])}, "
              f"Context History: {len(config['context_history'])} chars, "
              f"Use Context: {config['use_context']}, "
              f"Output Markdown: {config['output_markdown']}")
        return config

    @staticmethod
    def _extract_text(elements: List[Dict], skip_comments: bool = False) -> str:
        """Extract plain text from document elements, optionally skipping comment lines"""
        text_parts = []
        for element in elements:
            if 'paragraph' in element:
                para = element['paragraph']
                for elem in para.get('elements', []):
                    if 'textRun' in elem:
                        text_parts.append(elem['textRun'].get('content', ''))

        full_text = ''.join(text_parts)

        if skip_comments:
            # Filter out lines starting with '#' and empty lines
            lines = full_text.split('\n')
            filtered_lines = []
            for line in lines:
                stripped = line.strip()
                if stripped.startswith('#'):
                    print(f"DEBUG: Skipping comment line: {line[:50]}...")
                    continue
                if stripped:  # Only include non-empty lines
                    filtered_lines.append(line)
            return '\n'.join(filtered_lines).strip()

        return full_text.strip()

    @staticmethod
    def _extract_file_urls(elements: List[Dict]) -> List[str]:
        """Extract file URLs from document elements, skipping comment lines"""
        urls = []

        for element in elements:
            if 'paragraph' not in element:
                continue

            para = element['paragraph']
            para_elements = para.get('elements', [])

            # First, extract all text from this paragraph to check if it's a comment
            paragraph_text_parts = []
            for elem in para_elements:
                if 'textRun' in elem:
                    paragraph_text_parts.append(elem['textRun'].get('content', ''))

            paragraph_text = ''.join(paragraph_text_parts).strip()

            # Skip this entire paragraph if it starts with '#'
            if paragraph_text.startswith('#'):
                print(f"DEBUG: Skipping file URL in comment paragraph: {paragraph_text[:50]}...")
                continue

            # Now extract URLs from this non-comment paragraph
            for elem in para_elements:
                if 'textRun' in elem:
                    text_run = elem['textRun']
                    content = text_run.get('content', '')

                    # Check for linked URL
                    text_style = text_run.get('textStyle', {})
                    link = text_style.get('link', {})
                    url = link.get('url', '')

                    if url:
                        urls.append(url)
                        print(f"DEBUG: Found linked URL: {url}")
                    elif 'drive.google.com' in content or content.startswith('http'):
                        urls.append(content.strip())
                        print(f"DEBUG: Found plain text URL: {content.strip()}")

                if 'inlineObjectElement' in elem:
                    print(f"DEBUG: Found embedded file (inlineObjectElement)")

        return urls

    @staticmethod
    def _parse_parameters(text: str) -> Dict[str, str]:
        """Parse key:value parameters from text, skipping lines starting with '#'"""
        params = {}
        for line in text.split('\n'):
            stripped_line = line.strip()
            # Skip comment lines and empty lines
            if not stripped_line or stripped_line.startswith('#'):
                if stripped_line.startswith('#'):
                    print(f"DEBUG: Skipping comment parameter: {stripped_line[:50]}...")
                continue
            if ':' in stripped_line:
                key, value = stripped_line.split(':', 1)
                params[key.strip()] = value.strip()
        return params

    @staticmethod
    def parse_uploaded_tracking(tracking_text: str) -> Dict[str, str]:
        """Parse the Uploaded Files tab to get already-uploaded Gemini file URIs"""
        tracking = {}
        for line in tracking_text.strip().split('\n'):
            if '|' in line:
                parts = line.split('|')
                if len(parts) >= 2:
                    drive_id = parts[0].strip()
                    gemini_uri = parts[1].strip()
                    tracking[drive_id] = gemini_uri
                    print(f"DEBUG: Found tracked file: {drive_id} -> {gemini_uri}")
        return tracking

    @staticmethod
    def parse_context_history(context_text: str) -> List[Dict]:
        """
        Parse Context History tab into structured chat history format.
        Expected format in tab:
        --------------------------------------------------
        [timestamp]
        User: message

        Assistant: response
        --------------------------------------------------

        Returns list of dicts with 'role' and 'parts' keys for Gemini chat API
        """
        history = []
        if not context_text or not context_text.strip():
            return history

        # Split by separator lines
        entries = context_text.split('--------------------------------------------------')

        for entry in entries:
            entry = entry.strip()
            if not entry:
                continue

            # Look for User: and Assistant: patterns
            lines = entry.split('\n')
            user_content = []
            assistant_content = []
            current_role = None
            current_content = []

            for line in lines:
                line = line.strip()
                if not line or line.startswith('['):  # Skip timestamps
                    continue

                if line.startswith('User:'):
                    if current_role == 'model' and current_content:
                        assistant_content.append('\n'.join(current_content))
                    current_role = 'user'
                    current_content = [line[5:].strip()]
                elif line.startswith('Assistant:'):
                    if current_role == 'user' and current_content:
                        user_content.append('\n'.join(current_content))
                    current_role = 'model'
                    current_content = [line[10:].strip()]
                elif current_role:
                    current_content.append(line)

            # Add final content
            if current_role == 'user' and current_content:
                user_content.append('\n'.join(current_content))
            elif current_role == 'model' and current_content:
                assistant_content.append('\n'.join(current_content))

            # Build history entries
            for user_msg in user_content:
                if user_msg.strip():
                    history.append({
                        'role': 'user',
                        'parts': [{'text': user_msg.strip()}]
                    })

            for assistant_msg in assistant_content:
                if assistant_msg.strip():
                    history.append({
                        'role': 'model',
                        'parts': [{'text': assistant_msg.strip()}]
                    })

        print(f"DEBUG: Parsed {len(history)} context history entries")
        return history
