"""
AI Assistant Cloud Run App
Session-based OAuth for Google Docs integration with Gemini API
Uses the new google-genai SDK (pip install google-genai)
"""

import io
import os
import re
import tempfile
import time
from datetime import datetime
from typing import Dict, List, Tuple, Optional

from flask import Flask, jsonify, redirect, request, session, url_for
from google import genai
from google.genai import types
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

# Allow HTTP for local development (remove in production)
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

# Flask Configuration
app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

# OAuth Configuration
SCOPES = [
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/drive.readonly'
]

CLIENT_CONFIG = {
    'web': {
        'client_id': os.environ.get('GOOGLE_CLIENT_ID'),
        'client_secret': os.environ.get('GOOGLE_CLIENT_SECRET'),
        'auth_uri': 'https://accounts.google.com/o/oauth2/auth',
        'token_uri': 'https://oauth2.googleapis.com/token',
        'redirect_uris': [os.environ.get('REDIRECT_URI', 'http://localhost:8080/oauth2callback')]
    }
}

# Gemini Configuration
GEMINI_MODEL = 'gemini-1.5-pro-latest'
gemini_client = None  # Lazy-loaded

# Tab Names Configuration
TAB_NAMES = {
    'SYSTEM_PROMPT': 'System Prompt',
    'TASK': 'Task',
    'PARAMETERS': 'Parameters',
    'INPUT': 'Input',
    'UPLOADED_FILES': 'Uploaded Files',
    'OUTPUT': 'AI Output',
    'CONTEXT_HISTORY': 'Context History'
}


class GeminiClientManager:
    """Manages Gemini client initialization"""
    
    @staticmethod
    def get_client() -> genai.Client:
        """Get or create Gemini client (lazy initialization)"""
        global gemini_client
        if gemini_client is None:
            api_key = os.environ.get('GEMINI_API_KEY')
            if not api_key:
                raise ValueError("GEMINI_API_KEY environment variable is not set")
            gemini_client = genai.Client(api_key=api_key)
        return gemini_client


class OAuthHandler:
    """Handles OAuth flow operations"""
    
    @staticmethod
    def create_flow(state: Optional[str] = None) -> Flow:
        """Create OAuth flow instance"""
        return Flow.from_client_config(
            CLIENT_CONFIG,
            scopes=SCOPES,
            state=state,
            redirect_uri=CLIENT_CONFIG['web']['redirect_uris'][0]
        )
    
    @staticmethod
    def credentials_to_dict(credentials: Credentials) -> Dict:
        """Convert credentials to dictionary for session storage"""
        return {
            'token': credentials.token,
            'refresh_token': credentials.refresh_token,
            'token_uri': credentials.token_uri,
            'client_id': credentials.client_id,
            'client_secret': credentials.client_secret,
            'scopes': credentials.scopes
        }


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
            'gemini_model': GEMINI_MODEL
        }

        print(f"DEBUG: Processing {len(tabs)} document tabs")

        for tab in tabs:
            title = tab.get('tabProperties', {}).get('title', '')
            print(f"DEBUG: Tab title: '{title}'")

            content_elements = tab.get('documentTab', {}).get('body', {}).get('content', [])
            text = DocumentParser._extract_text(content_elements)

            if title == TAB_NAMES['SYSTEM_PROMPT']:
                print(f"DEBUG: Found System Prompt tab, length: {len(text)}")
                config['system_prompt'] = text
            elif title == TAB_NAMES['TASK']:
                print(f"DEBUG: Found Task tab, length: {len(text)}")
                config['task'] = text
            elif title == TAB_NAMES['PARAMETERS']:
                print(f"DEBUG: Found Parameters tab, length: {len(text)}")
                config['parameters'] = DocumentParser._parse_parameters(text)
                if 'GEMINI_MODEL' in config['parameters']:
                    config['gemini_model'] = config['parameters']['GEMINI_MODEL']
            elif title == TAB_NAMES['INPUT']:
                print(f"DEBUG: Found Input tab, length: {len(text)}")
                config['input'] = text
                config['input_files'] = DocumentParser._extract_file_urls(content_elements)
                print(f"DEBUG: Found {len(config['input_files'])} files in Input tab")
            elif title == TAB_NAMES['UPLOADED_FILES']:
                print(f"DEBUG: Found Uploaded Files tracking tab, length: {len(text)}")
                config['uploaded_files_tracking'] = text

        print(f"DEBUG: Configuration loaded - Task: {len(config['task'])} chars, "
              f"System Prompt: {len(config['system_prompt'])} chars, "
              f"Input files: {len(config['input_files'])}")
        return config

    @staticmethod
    def _extract_text(elements: List[Dict]) -> str:
        """Extract plain text from document elements"""
        text_parts = []
        for element in elements:
            if 'paragraph' in element:
                para = element['paragraph']
                for elem in para.get('elements', []):
                    if 'textRun' in elem:
                        text_parts.append(elem['textRun'].get('content', ''))
        return ''.join(text_parts).strip()

    @staticmethod
    def _extract_file_urls(elements: List[Dict]) -> List[str]:
        """Extract file URLs from document elements"""
        urls = []

        for element in elements:
            if 'paragraph' not in element:
                continue
                
            para = element['paragraph']
            para_elements = para.get('elements', [])

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
        """Parse key:value parameters from text"""
        params = {}
        for line in text.split('\n'):
            if ':' in line:
                key, value = line.split(':', 1)
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


class FileUploader:
    """Handles file upload operations to Gemini"""
    
    @staticmethod
    def extract_drive_file_id(url: str) -> Optional[str]:
        """Extract Google Drive file ID from URL"""
        if 'drive.google.com' not in url:
            return None
            
        # Try /file/d/ pattern
        match = re.search(r'/file/d/([a-zA-Z0-9_-]+)', url)
        if not match:
            # Try ?id= pattern
            match = re.search(r'[?&]id=([a-zA-Z0-9_-]+)', url)
        
        return match.group(1) if match else None

    @staticmethod
    def upload_files(file_urls: List[str], already_uploaded: Dict[str, str], 
                    drive_service) -> Tuple[List, List[Dict]]:
        """Download Google Drive files and upload to Gemini"""
        gemini_files = []
        new_uploads = []
        client = GeminiClientManager.get_client()

        for url in file_urls:
            print(f"DEBUG: Processing file URL: {url}")

            file_id = FileUploader.extract_drive_file_id(url)
            if not file_id:
                raise Exception(f"Could not extract file ID from URL: {url}")

            print(f"DEBUG: Extracted Drive file ID: {file_id}")

            # Check if already uploaded
            if file_id in already_uploaded:
                gemini_uri = already_uploaded[file_id]
                print(f"DEBUG: File already uploaded, using existing: {gemini_uri}")
                try:
                    gemini_file = client.files.get(name=gemini_uri)
                    gemini_files.append(gemini_file)
                    continue
                except Exception as e:
                    print(f"DEBUG: Error retrieving existing file {gemini_uri}, "
                          f"will re-upload: {str(e)}")

            # Download and upload new file
            try:
                gemini_file, upload_info = FileUploader._process_new_file(
                    file_id, drive_service, client
                )
                gemini_files.append(gemini_file)
                new_uploads.append(upload_info)
            except Exception as e:
                print(f"ERROR: Error uploading file {file_id}: {str(e)}")
                import traceback
                print(traceback.format_exc())
                raise

        return gemini_files, new_uploads

    @staticmethod
    def _process_new_file(file_id: str, drive_service, client) -> Tuple:
        """Download from Drive and upload to Gemini"""
        # Get file metadata
        file_metadata = drive_service.files().get(
            fileId=file_id,
            fields='name,mimeType'
        ).execute()
        
        file_name = file_metadata.get('name', f'file_{file_id}')
        print(f"DEBUG: File name: {file_name}, MIME type: {file_metadata.get('mimeType', '')}")

        # Download file from Drive to memory
        request_obj = drive_service.files().get_media(fileId=file_id)
        file_content = io.BytesIO()
        downloader = MediaIoBaseDownload(file_content, request_obj)
        
        done = False
        while not done:
            status, done = downloader.next_chunk()
        
        file_content.seek(0)
        print(f"DEBUG: Downloaded file to memory, uploading to Gemini: {file_name}")
        
        # Write to temp file for upload (Gemini SDK requires file path)
        with tempfile.NamedTemporaryFile(delete=False, suffix=f'_{file_name}') as temp_file:
            temp_file.write(file_content.read())
            temp_path = temp_file.name
        
        try:
            # Upload to Gemini
            print(f"DEBUG: Uploading to Gemini from temp file: {temp_path}")
            gemini_file = client.files.upload(file=temp_path)
            
            # Wait for file to be processed
            print(f"DEBUG: Waiting for Gemini to process file...")
            while gemini_file.state == 'PROCESSING':
                print(f"DEBUG: File state: {gemini_file.state}")
                time.sleep(2)
                gemini_file = client.files.get(name=gemini_file.name)
            
            if gemini_file.state == 'FAILED':
                raise Exception(f"Gemini file processing failed: {gemini_file.state}")
            
            print(f"DEBUG: Successfully uploaded to Gemini: {gemini_file.name} "
                  f"(state: {gemini_file.state})")

            upload_info = {
                'drive_id': file_id,
                'gemini_uri': gemini_file.name,
                'display_name': gemini_file.display_name
            }

            return gemini_file, upload_info
            
        finally:
            # Clean up temp file
            try:
                os.unlink(temp_path)
                print(f"DEBUG: Cleaned up temp file")
            except Exception as e:
                print(f"WARNING: Could not delete temp file: {e}")


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
    def write_output(docs_service, doc_id: str, content: str, doc: Dict) -> None:
        """Write results to AI Output tab"""
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
        output_text = f"\n\n{'='*50}\n{timestamp}\n{'='*50}\n{content}\n"

        end_index = DocumentWriter._get_tab_end_index(doc, tab_id)
        if end_index is None:
            print("ERROR: Failed to get end index for output tab")
            return

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
        print(f"DEBUG: Successfully wrote {len(content)} characters to output tab")

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


class PromptBuilder:
    """Handles prompt construction for Gemini"""
    
    @staticmethod
    def build(config: Dict) -> str:
        """Build the prompt for Gemini"""
        parts = []

        if config['system_prompt']:
            parts.append(f"System Prompt: {config['system_prompt']}")

        if config['task']:
            parts.append(f"Task: {config['task']}")

        if config['input']:
            parts.append(f"Input:\n{config['input']}")

        return '\n\n'.join(parts)


# Flask Routes

@app.route('/')
def index():
    """Health check endpoint"""
    return jsonify({
        'status': 'AI Assistant Cloud Run',
        'authenticated': 'credentials' in session
    })


@app.route('/auth')
def auth():
    """Initiate OAuth flow"""
    flow = OAuthHandler.create_flow()
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='false',
        prompt='consent'
    )

    session['state'] = state
    return redirect(authorization_url)


@app.route('/oauth2callback')
def oauth2callback():
    """OAuth callback handler"""
    state = session.get('state')
    flow = OAuthHandler.create_flow(state=state)
    flow.fetch_token(authorization_response=request.url)

    session['credentials'] = OAuthHandler.credentials_to_dict(flow.credentials)

    doc_id = session.get('pending_doc_id')
    if doc_id:
        return redirect(url_for('process_task', doc_id=doc_id))

    return jsonify({'status': 'authorized', 'message': 'You can now process tasks'})


@app.route('/process/<doc_id>', methods=['POST'])
def process_task(doc_id: str):
    """Main endpoint: Read doc, call Gemini, write results"""

    if 'credentials' not in session:
        session['pending_doc_id'] = doc_id
        return jsonify({
            'error': 'Not authenticated',
            'auth_url': url_for('auth', _external=True)
        }), 401

    try:
        credentials = Credentials(**session['credentials'])
        docs_service = build('docs', 'v1', credentials=credentials)
        drive_service = build('drive', 'v3', credentials=credentials)

        # Fetch document with tabs
        request_obj = docs_service.documents().get(documentId=doc_id)
        request_obj.uri = request_obj.uri + '&includeTabsContent=true'
        doc = request_obj.execute()

        print(f"DEBUG: Document title: {doc.get('title')}")

        # Parse configuration
        config = DocumentParser.parse_tabs(doc)

        if not config['system_prompt'] and not config['task']:
            return jsonify({'error': 'Provide at least a System Prompt or Task'}), 400

        prompt_text = PromptBuilder.build(config)

        # Handle file uploads
        already_uploaded = DocumentParser.parse_uploaded_tracking(
            config.get('uploaded_files_tracking', '')
        )

        gemini_files = []
        new_uploads = []
        if config.get('input_files'):
            try:
                gemini_files, new_uploads = FileUploader.upload_files(
                    config['input_files'],
                    already_uploaded,
                    drive_service
                )
                # Update tracking immediately after successful upload
                if new_uploads:
                    DocumentWriter.update_uploaded_files_tab(
                        docs_service, doc_id, new_uploads, doc
                    )
            except Exception as e:
                print(f"ERROR: File upload failed: {str(e)}")
                import traceback
                print(traceback.format_exc())
                return jsonify({'error': f'File upload failed: {str(e)}'}), 500

        # Build content list (prompt + files)
        content_parts = [prompt_text]
        for gfile in gemini_files:
            content_parts.append(
                types.Part.from_uri(file_uri=gfile.uri, mime_type=gfile.mime_type)
            )

        print(f"DEBUG: Sending to Gemini: {len(content_parts)} items "
              f"(1 text prompt + {len(gemini_files)} files)")

        # Call Gemini API
        client = GeminiClientManager.get_client()
        response = client.models.generate_content(
            model=config.get('gemini_model', GEMINI_MODEL),
            contents=content_parts
        )
        result_text = response.text

        print(f"DEBUG: Gemini output ({len(result_text)} chars)")

        # Write results to document
        DocumentWriter.write_output(docs_service, doc_id, result_text, doc)

        return jsonify({
            'status': 'success',
            'doc_id': doc_id,
            'result_length': len(result_text)
        })

    except Exception as e:
        import traceback
        print(f"ERROR: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=True)