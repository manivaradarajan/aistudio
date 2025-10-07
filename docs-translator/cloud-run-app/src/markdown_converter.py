"""
Markdown to Google Docs formatting conversion
"""
from typing import Dict, List, Tuple
import mistune


class MarkdownConverter:
    """Converts markdown to Google Docs formatting requests"""

    def __init__(self):
        self.markdown_parser = mistune.create_markdown(renderer=None)

    def convert_to_docs_requests(self, markdown_text: str) -> Tuple[str, List[Dict]]:
        """
        Parse markdown and return plain text + formatting requests
        Returns: (plain_text, requests_list)
        """
        # Parse markdown into tokens
        tokens = self.markdown_parser(markdown_text)

        # Extract plain text and build formatting requests
        plain_text, requests = self._process_tokens(tokens)

        return plain_text, requests

    def _process_tokens(self, tokens: List, offset: int = 0) -> Tuple[str, List[Dict]]:
        """Process markdown tokens recursively"""
        text_parts = []
        requests = []
        current_offset = offset

        for token in tokens:
            token_type = token['type']

            if token_type == 'heading':
                text, token_requests = self._process_heading(token, current_offset)
            elif token_type == 'paragraph':
                text, token_requests = self._process_paragraph(token, current_offset)
            elif token_type == 'list':
                text, token_requests = self._process_list(token, current_offset)
            elif token_type == 'block_code':
                text, token_requests = self._process_code_block(token, current_offset)
            elif token_type == 'thematic_break':
                text = '\n' + '─' * 50 + '\n'
                token_requests = []
            else:
                # Fallback for unsupported types
                text = self._extract_text_from_token(token)
                token_requests = []

            text_parts.append(text)
            requests.extend(token_requests)
            current_offset += len(text)

        return ''.join(text_parts), requests

    def _process_heading(self, token: Dict, offset: int) -> Tuple[str, List[Dict]]:
        """Process heading token"""
        level = token.get('attrs', {}).get('level', 1)
        text, inline_requests = self._process_inline(token.get('children', []), offset)
        text = text + '\n'

        # Map markdown heading levels to Google Docs styles
        heading_styles = {
            1: 'HEADING_1',
            2: 'HEADING_2',
            3: 'HEADING_3',
            4: 'HEADING_4',
            5: 'HEADING_5',
            6: 'HEADING_6'
        }

        style = heading_styles.get(level, 'HEADING_1')

        requests = [{
            'updateParagraphStyle': {
                'range': {
                    'startIndex': offset,
                    'endIndex': offset + len(text)
                },
                'paragraphStyle': {
                    'namedStyleType': style
                },
                'fields': 'namedStyleType'
            }
        }]

        requests.extend(inline_requests)

        return text, requests

    def _process_paragraph(self, token: Dict, offset: int) -> Tuple[str, List[Dict]]:
        """Process paragraph token"""
        text, inline_requests = self._process_inline(token.get('children', []), offset)
        text = text + '\n\n'
        return text, inline_requests

    def _process_list(self, token: Dict, offset: int) -> Tuple[str, List[Dict]]:
        """Process list token"""
        ordered = token.get('attrs', {}).get('ordered', False)
        items = token.get('children', [])

        text_parts = []
        requests = []
        current_offset = offset

        for i, item in enumerate(items, 1):
            # Add list marker
            if ordered:
                marker = f"{i}. "
            else:
                marker = "• "

            # Process list item content
            item_text, item_requests = self._process_inline(
                item.get('children', []),
                current_offset + len(marker)
            )

            full_text = marker + item_text + '\n'
            text_parts.append(full_text)
            requests.extend(item_requests)
            current_offset += len(full_text)

        return ''.join(text_parts), requests

    def _process_code_block(self, token: Dict, offset: int) -> Tuple[str, List[Dict]]:
        """Process code block token"""
        code = token.get('raw', '')
        text = code + '\n'

        # Apply monospace font to code block
        requests = [{
            'updateTextStyle': {
                'range': {
                    'startIndex': offset,
                    'endIndex': offset + len(text)
                },
                'textStyle': {
                    'weightedFontFamily': {
                        'fontFamily': 'Courier New'
                    },
                    'fontSize': {
                        'magnitude': 10,
                        'unit': 'PT'
                    }
                },
                'fields': 'weightedFontFamily,fontSize'
            }
        }]

        return text, requests

    def _process_inline(self, children: List, offset: int) -> Tuple[str, List[Dict]]:
        """Process inline elements (bold, italic, code, links, etc.)"""
        text_parts = []
        requests = []
        current_offset = offset

        for child in children:
            child_type = child['type']

            if child_type == 'text':
                text = child.get('raw', '')
                text_parts.append(text)
                current_offset += len(text)

            elif child_type == 'strong':
                # Bold text
                inner_text, inner_requests = self._process_inline(
                    child.get('children', []),
                    current_offset
                )
                text_parts.append(inner_text)

                requests.append({
                    'updateTextStyle': {
                        'range': {
                            'startIndex': current_offset,
                            'endIndex': current_offset + len(inner_text)
                        },
                        'textStyle': {
                            'bold': True
                        },
                        'fields': 'bold'
                    }
                })
                requests.extend(inner_requests)
                current_offset += len(inner_text)

            elif child_type == 'emphasis':
                # Italic text
                inner_text, inner_requests = self._process_inline(
                    child.get('children', []),
                    current_offset
                )
                text_parts.append(inner_text)

                requests.append({
                    'updateTextStyle': {
                        'range': {
                            'startIndex': current_offset,
                            'endIndex': current_offset + len(inner_text)
                        },
                        'textStyle': {
                            'italic': True
                        },
                        'fields': 'italic'
                    }
                })
                requests.extend(inner_requests)
                current_offset += len(inner_text)

            elif child_type == 'codespan':
                # Inline code
                code_text = child.get('raw', '')
                text_parts.append(code_text)

                requests.append({
                    'updateTextStyle': {
                        'range': {
                            'startIndex': current_offset,
                            'endIndex': current_offset + len(code_text)
                        },
                        'textStyle': {
                            'weightedFontFamily': {
                                'fontFamily': 'Courier New'
                            }
                        },
                        'fields': 'weightedFontFamily'
                    }
                })
                current_offset += len(code_text)

            elif child_type == 'link':
                # Hyperlink
                link_url = child.get('attrs', {}).get('url', '')
                inner_text, inner_requests = self._process_inline(
                    child.get('children', []),
                    current_offset
                )
                text_parts.append(inner_text)

                requests.append({
                    'updateTextStyle': {
                        'range': {
                            'startIndex': current_offset,
                            'endIndex': current_offset + len(inner_text)
                        },
                        'textStyle': {
                            'link': {
                                'url': link_url
                            }
                        },
                        'fields': 'link'
                    }
                })
                requests.extend(inner_requests)
                current_offset += len(inner_text)

            elif child_type == 'linebreak':
                text_parts.append('\n')
                current_offset += 1

            else:
                # Fallback for other inline types
                text = self._extract_text_from_token(child)
                text_parts.append(text)
                current_offset += len(text)

        return ''.join(text_parts), requests

    def _extract_text_from_token(self, token: Dict) -> str:
        """Extract plain text from any token (fallback method)"""
        if isinstance(token, str):
            return token

        if 'raw' in token:
            return token['raw']

        if 'children' in token:
            return ''.join(self._extract_text_from_token(child)
                          for child in token['children'])

        return ''
