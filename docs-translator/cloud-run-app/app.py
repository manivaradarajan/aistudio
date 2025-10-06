"""
AI Assistant Cloud Run App
Session-based OAuth for Google Docs integration with Gemini API
"""

import os
import json
from flask import Flask, request, jsonify, session, redirect, url_for
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
import google.generativeai as genai

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
        'redirect_uris': [os.environ.get('REDIRECT_URI', 'http://localhost:5000/oauth2callback')]
    }
}

# Gemini Configuration
genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))

GEMINI_MODEL = 'gemini-1.5-pro-latest'

TAB_NAMES = {
    'SYSTEM_PROMPT': 'System Prompt',
    'TASK': 'Task',
    'PARAMETERS': 'Parameters',
    'INPUT': 'Input',
    'UPLOADED_FILES': 'Uploaded Files',
    'OUTPUT': 'AI Output',
    'CONTEXT_HISTORY': 'Context History'
}


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
    flow = Flow.from_client_config(
        CLIENT_CONFIG,
        scopes=SCOPES,
        redirect_uri=CLIENT_CONFIG['web']['redirect_uris'][0]
    )

    authorization_url, state = flow.authorization_url(
        access_type='online',  # Session-only, no refresh token
        include_granted_scopes='true'
    )

    session['state'] = state
    return redirect(authorization_url)


@app.route('/oauth2callback')
def oauth2callback():
    """OAuth callback handler"""
    state = session.get('state')

    flow = Flow.from_client_config(
        CLIENT_CONFIG,
        scopes=SCOPES,
        state=state,
        redirect_uri=CLIENT_CONFIG['web']['redirect_uris'][0]
    )

    flow.fetch_token(authorization_response=request.url)

    credentials = flow.credentials
    session['credentials'] = {
        'token': credentials.token,
        'refresh_token': credentials.refresh_token,
        'token_uri': credentials.token_uri,
        'client_id': credentials.client_id,
        'client_secret': credentials.client_secret,
        'scopes': credentials.scopes
    }

    # Redirect to the doc_id if stored
    doc_id = session.get('pending_doc_id')
    if doc_id:
        return redirect(url_for('process_task', doc_id=doc_id))

    return jsonify({'status': 'authorized', 'message': 'You can now process tasks'})


@app.route('/process/<doc_id>', methods=['POST'])
def process_task(doc_id):
    """Main endpoint: Read doc, call Gemini, write results"""

    # Check authentication
    if 'credentials' not in session:
        session['pending_doc_id'] = doc_id
        return jsonify({
            'error': 'Not authenticated',
            'auth_url': url_for('auth', _external=True)
        }), 401

    try:
        # Build credentials from session
        credentials = Credentials(**session['credentials'])

        # Read document
        docs_service = build('docs', 'v1', credentials=credentials)
        doc = docs_service.documents().get(documentId=doc_id).execute()

        # Parse tabs
        config = parse_document_tabs(doc)

        if not config['system_prompt'] and not config['task']:
            return jsonify({'error': 'Provide at least a System Prompt or Task'}), 400

        # Build prompt
        prompt_text = build_prompt(config)

        # Call Gemini
        model = genai.GenerativeModel(config.get('gemini_model', GEMINI_MODEL))
        response = model.generate_content(prompt_text)
        result_text = response.text

        # Write output back to doc
        write_output_to_doc(docs_service, doc_id, result_text, doc)

        return jsonify({
            'status': 'success',
            'doc_id': doc_id,
            'result_length': len(result_text)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


def parse_document_tabs(doc):
    """Extract content from document tabs"""
    tabs = doc.get('tabs', [])
    config = {
        'system_prompt': '',
        'task': '',
        'parameters': {},
        'input': '',
        'gemini_model': GEMINI_MODEL
    }

    for tab in tabs:
        title = tab.get('tabProperties', {}).get('title', '')

        # Get text content from tab
        content_elements = tab.get('documentTab', {}).get('body', {}).get('content', [])
        text = extract_text_from_elements(content_elements)

        if title == TAB_NAMES['SYSTEM_PROMPT']:
            config['system_prompt'] = text
        elif title == TAB_NAMES['TASK']:
            config['task'] = text
        elif title == TAB_NAMES['PARAMETERS']:
            config['parameters'] = parse_parameters(text)
            if 'GEMINI_MODEL' in config['parameters']:
                config['gemini_model'] = config['parameters']['GEMINI_MODEL']
        elif title == TAB_NAMES['INPUT']:
            config['input'] = text

    return config


def extract_text_from_elements(elements):
    """Extract plain text from document elements"""
    text = []
    for element in elements:
        if 'paragraph' in element:
            para = element['paragraph']
            for elem in para.get('elements', []):
                if 'textRun' in elem:
                    text.append(elem['textRun'].get('content', ''))
    return ''.join(text).strip()


def parse_parameters(text):
    """Parse key:value parameters from text"""
    params = {}
    for line in text.split('\n'):
        if ':' in line:
            key, value = line.split(':', 1)
            params[key.strip()] = value.strip()
    return params


def build_prompt(config):
    """Build the prompt for Gemini"""
    parts = []

    if config['system_prompt']:
        parts.append(f"System Prompt: {config['system_prompt']}")

    if config['task']:
        parts.append(f"Task: {config['task']}")

    if config['input']:
        parts.append(f"Input:\n{config['input']}")

    return '\n\n'.join(parts)


def write_output_to_doc(docs_service, doc_id, content, doc):
    """Write results to AI Output tab"""
    from datetime import datetime

    # Find or create AI Output tab
    tabs = doc.get('tabs', [])
    output_tab_id = None

    for tab in tabs:
        if tab.get('tabProperties', {}).get('title') == TAB_NAMES['OUTPUT']:
            output_tab_id = tab.get('tabProperties', {}).get('tabId')
            break

    # If no output tab exists, create one
    if output_tab_id is None:
        requests = [{
            'createNamedRange': {
                'name': 'output_tab_placeholder',
                'range': {
                    'startIndex': 1,
                    'endIndex': 2
                }
            }
        }]
        # For now, we'll append to the main doc
        # TODO: Handle tab creation properly
        output_tab_id = None

    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    output_text = f"\n\n{'='*50}\n{timestamp}\n{'='*50}\n{content}\n"

    # Append to document
    requests = [{
        'insertText': {
            'location': {
                'index': 1
            },
            'text': output_text
        }
    }]

    docs_service.documents().batchUpdate(
        documentId=doc_id,
        body={'requests': requests}
    ).execute()


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
