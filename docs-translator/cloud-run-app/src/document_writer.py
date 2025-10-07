"""
Google Docs writing operations (non-streaming and streaming)
"""
from datetime import datetime
from typing import Dict, List, Optional

from .config import TAB_NAMES
from .markdown_converter import MarkdownConverter


class DocumentWriter:
    """Handles writing to Google Docs"""

    @staticmethod
    def update_uploaded_files_tab(docs_service, doc_id: str, new_uploads: List[Dict],
                                  doc: Dict) -> None:
        """Append new upload tracking info to Uploaded Files tab"""
        if not new_uploads:
            print("DEBUG: No new uploads to track")
            return

        tab_id = DocumentWriter._find_tab_id(doc, TAB_NAMES['UPLOADED_FILES'])
        if not tab_id:
            print(f"DEBUG: No '{TAB_NAMES['UPLOADED_FILES']}' tab found")
            return

        tracking_lines = [
            f"{upload['drive_id']} | {upload['gemini_uri']} | {upload['display_name']}\n"
            for upload in new_uploads
        ]
        tracking_text = ''.join(tracking_lines)

        end_index = DocumentWriter._get_tab_end_index(doc, tab_id)
        if end_index is None:
            return

        requests = [{
            'insertText': {
                'location': {
                    'tabId': tab_id,
                    'index': end_index - 1
                },
                'text': tracking_text
            }
        }]

        print(f"DEBUG: Writing {len(new_uploads)} tracking entries to Uploaded Files tab")
        docs_service.documents().batchUpdate(
            documentId=doc_id,
            body={'requests': requests}
        ).execute()
        print(f"DEBUG: Successfully updated tracking")

    @staticmethod
    def append_to_context_history(docs_service, doc_id: str, user_input: str,
                                  ai_response: str, doc: Dict) -> None:
        """Append user input and AI response to Context History tab"""
        tab_id = DocumentWriter._find_tab_id(doc, TAB_NAMES['CONTEXT_HISTORY'])
        if not tab_id:
            print(f"DEBUG: No '{TAB_NAMES['CONTEXT_HISTORY']}' tab found")
            return

        end_index = DocumentWriter._get_tab_end_index(doc, tab_id)
        if end_index is None:
            return

        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        separator = '-' * 50

        context_entry = f"\n{separator}\n[{timestamp}]\nUser: {user_input}\n\nAssistant: {ai_response}\n{separator}\n"

        requests = [{
            'insertText': {
                'location': {
                    'tabId': tab_id,
                    'index': end_index - 1
                },
                'text': context_entry
            }
        }]

        print(f"DEBUG: Appending to Context History ({len(context_entry)} chars)")
        docs_service.documents().batchUpdate(
            documentId=doc_id,
            body={'requests': requests}
        ).execute()
        print(f"DEBUG: Successfully appended to Context History")

    @staticmethod
    def write_output(docs_service, doc_id: str, content: str, doc: Dict,
                    output_markdown: bool = False) -> None:
        """Write results to AI Output tab with optional markdown formatting"""
        tab_id = DocumentWriter._find_tab_id(doc, TAB_NAMES['OUTPUT'])

        if tab_id is None:
            print(f"WARNING: No '{TAB_NAMES['OUTPUT']}' tab found, writing to first tab")
            tabs = doc.get('tabs', [])
            if tabs:
                tab_id = tabs[0].get('tabProperties', {}).get('tabId')

        if not tab_id:
            print("ERROR: Failed to write output to document")
            return

        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        separator = '='*50
        header = f"\n\n{separator}\n{timestamp}\n{separator}\n"

        end_index = DocumentWriter._get_tab_end_index(doc, tab_id)
        if end_index is None:
            print("ERROR: Failed to get end index for output tab")
            return

        # Calculate starting position for content
        content_start_index = end_index - 1 + len(header)

        if output_markdown:
            # Write as plain markdown (no conversion)
            output_text = header + content + '\n'
            requests = [{
                'insertText': {
                    'location': {
                        'tabId': tab_id,
                        'index': end_index - 1
                    },
                    'text': output_text
                }
            }]
            print(f"DEBUG: Writing {len(content)} characters as markdown to output tab")
        else:
            # Convert markdown to Google Docs formatting
            try:
                    converter = MarkdownConverter()
                    plain_text, formatting_requests = converter.convert_to_docs_requests(content)

                    # First insert header + plain text
                    output_text = header + plain_text + '\n'
                    requests = [{
                        'insertText': {
                            'location': {
                                'tabId': tab_id,
                                'index': end_index - 1
                            },
                            'text': output_text
                        }
                    }]

                    # Adjust formatting request indices to account for header and tabId
                    for fmt_request in formatting_requests:
                        # Add tabId to all ranges
                        if 'updateTextStyle' in fmt_request:
                            fmt_request['updateTextStyle']['range']['tabId'] = tab_id
                            fmt_request['updateTextStyle']['range']['startIndex'] += content_start_index
                            fmt_request['updateTextStyle']['range']['endIndex'] += content_start_index
                        elif 'updateParagraphStyle' in fmt_request:
                            fmt_request['updateParagraphStyle']['range']['tabId'] = tab_id
                            fmt_request['updateParagraphStyle']['range']['startIndex'] += content_start_index
                            fmt_request['updateParagraphStyle']['range']['endIndex'] += content_start_index

                    # Add formatting requests
                    requests.extend(formatting_requests)

                    print(f"DEBUG: Writing {len(plain_text)} characters with "
                          f"{len(formatting_requests)} formatting requests to output tab")

            except Exception as e:
                print(f"WARNING: Markdown conversion failed: {str(e)}, writing as plain text")
                import traceback
                print(traceback.format_exc())
                output_text = header + content + '\n'
                requests = [{
                    'insertText': {
                        'location': {
                            'tabId': tab_id,
                            'index': end_index - 1
                        },
                        'text': output_text
                    }
                }]

        docs_service.documents().batchUpdate(
            documentId=doc_id,
            body={'requests': requests}
        ).execute()
        print(f"DEBUG: Successfully wrote output to tab")

    @staticmethod
    def _find_tab_id(doc: Dict, tab_name: str) -> Optional[str]:
        """Find tab ID by name"""
        tabs = doc.get('tabs', [])
        for tab in tabs:
            if tab.get('tabProperties', {}).get('title') == tab_name:
                tab_id = tab.get('tabProperties', {}).get('tabId')
                print(f"DEBUG: Found '{tab_name}' tab with ID: {tab_id}")
                return tab_id
        return None

    @staticmethod
    def _get_tab_end_index(doc: Dict, tab_id: str) -> Optional[int]:
        """Get end index for a specific tab"""
        tabs = doc.get('tabs', [])
        for tab in tabs:
            if tab.get('tabProperties', {}).get('tabId') == tab_id:
                body = tab.get('documentTab', {}).get('body', {})
                content_list = body.get('content', [])
                if content_list:
                    return content_list[-1].get('endIndex', 1)
        return None


class StreamingDocumentWriter:
    """Writes to Google Docs as content streams in from Gemini"""

    @staticmethod
    def write_streaming(docs_service, doc_id: str, doc: Dict,
                       response_stream, output_markdown: bool = False) -> tuple:
        """
        Write content to doc as it streams from Gemini
        Returns: (total_text, character_count)
        """

        tab_id = DocumentWriter._find_tab_id(doc, TAB_NAMES['OUTPUT'])
        if not tab_id:
            print("ERROR: No output tab found")
            tabs = doc.get('tabs', [])
            if tabs:
                tab_id = tabs[0].get('tabProperties', {}).get('tabId')

        if not tab_id:
            print("ERROR: Failed to find any tab for output")
            return 0

        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        separator = '='*50
        header = f"\n\n{separator}\n{timestamp}\n{separator}\n"
        status_message = "⏳ Waiting for response from Gemini...\n\n"

        end_index = DocumentWriter._get_tab_end_index(doc, tab_id)
        if end_index is None:
            print("ERROR: Failed to get end index")
            return 0

        # Write header and status message
        requests = [{
            'insertText': {
                'location': {
                    'tabId': tab_id,
                    'index': end_index - 1
                },
                'text': header + status_message
            }
        }]
        docs_service.documents().batchUpdate(
            documentId=doc_id,
            body={'requests': requests}
        ).execute()

        print(f"DEBUG: Header and status written, waiting for first chunk")

        current_index = end_index - 1 + len(header) + len(status_message)
        content_start_index = current_index  # Track where content begins for formatting
        status_written = True
        accumulated_text = ""
        total_text = ""
        chunk_count = 0
        batch_write_count = 0

        # Batch size: balance between responsiveness and API quota
        # 500 chars = roughly 1-2 sentences, reasonable for progressive updates
        BATCH_SIZE = 500

        try:
            for chunk in response_stream:
                if chunk.text:
                    # On first chunk, delete the status message
                    if status_written:
                        delete_status_request = {
                            'deleteContentRange': {
                                'range': {
                                    'tabId': tab_id,
                                    'startIndex': end_index - 1 + len(header),
                                    'endIndex': end_index - 1 + len(header) + len(status_message)
                                }
                            }
                        }
                        docs_service.documents().batchUpdate(
                            documentId=doc_id,
                            body={'requests': [delete_status_request]}
                        ).execute()
                        current_index = end_index - 1 + len(header)
                        content_start_index = current_index
                        status_written = False
                        print(f"DEBUG: First chunk received, status message removed")

                    accumulated_text += chunk.text
                    total_text += chunk.text
                    chunk_count += 1

                    # Write in batches
                    if len(accumulated_text) >= BATCH_SIZE:
                        requests = [{
                            'insertText': {
                                'location': {
                                    'tabId': tab_id,
                                    'index': current_index
                                },
                                'text': accumulated_text
                            }
                        }]

                        docs_service.documents().batchUpdate(
                            documentId=doc_id,
                            body={'requests': requests}
                        ).execute()

                        batch_write_count += 1
                        current_index += len(accumulated_text)
                        print(f"DEBUG: Wrote batch #{batch_write_count}, {len(accumulated_text)} chars, "
                              f"total: {len(total_text)} chars")
                        accumulated_text = ""

            # Write any remaining text
            if accumulated_text:
                requests = [{
                    'insertText': {
                        'location': {
                            'tabId': tab_id,
                            'index': current_index
                        },
                        'text': accumulated_text
                    }
                }]
                docs_service.documents().batchUpdate(
                    documentId=doc_id,
                    body={'requests': requests}
                ).execute()

                current_index += len(accumulated_text)
                print(f"DEBUG: Wrote final batch, {len(accumulated_text)} chars")

            # Add final newline
            requests = [{
                'insertText': {
                    'location': {
                        'tabId': tab_id,
                        'index': current_index
                    },
                    'text': '\n'
                }
            }]
            docs_service.documents().batchUpdate(
                documentId=doc_id,
                body={'requests': requests}
            ).execute()

            print(f"DEBUG: Progressive streaming complete. Total: {len(total_text)} chars "
                  f"from {chunk_count} API chunks, written in {batch_write_count} batches to doc")

            return (total_text, len(total_text))

        except Exception as e:
            print(f"ERROR during streaming write: {str(e)}")
            import traceback
            print(traceback.format_exc())

            # Try to write error message to doc
            try:
                error_msg = f"\n\n[ERROR: Streaming interrupted - {str(e)}]\n"
                requests = [{
                    'insertText': {
                        'location': {
                            'tabId': tab_id,
                            'index': current_index
                        },
                        'text': error_msg
                    }
                }]
                docs_service.documents().batchUpdate(
                    documentId=doc_id,
                    body={'requests': requests}
                ).execute()
            except:
                pass

            return (total_text, len(total_text))
