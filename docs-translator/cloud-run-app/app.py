"""
AI Assistant Cloud Run App
Session-based OAuth for Google Docs integration with Gemini API
"""
import os
from flask import Flask, jsonify, redirect, request, session, url_for
from google import genai
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from src.config import SECRET_KEY, GEMINI_MODEL
from src.auth import OAuthHandler
from src.document_parser import DocumentParser
from src.document_writer import DocumentWriter, StreamingDocumentWriter
from src.file_uploader import FileUploader
from src.gemini_client import configure_gemini
from src.prompt_builder import PromptBuilder


# Flask Configuration
app = Flask(__name__)
app.secret_key = SECRET_KEY

# Configure Gemini at startup
configure_gemini()


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
        content_parts = [prompt_text] + gemini_files

        model_name = config.get('gemini_model', GEMINI_MODEL)
        streaming_enabled = config.get('streaming_output', True)
        system_prompt = config.get('system_prompt')
        use_chat_api = config.get('use_context', False)

        print(f"DEBUG: Sending to Gemini: {len(content_parts)} items "
              f"({len(gemini_files)} files), model: {model_name}, "
              f"streaming: {streaming_enabled}, chat: {use_chat_api}")

        # Initialize the model
        model = genai.GenerativeModel(model_name, system_instruction=system_prompt)

        # Handle chat vs. single-turn
        if use_chat_api:
            chat_history = DocumentParser.parse_context_history(
                config.get('context_history', '')
            )
            print(f"DEBUG: Using chat API with {len(chat_history)} history entries")
            chat = model.start_chat(history=chat_history)
            response = chat.send_message(content_parts, stream=streaming_enabled)

            if streaming_enabled:
                print("DEBUG: Using chat API with streaming")
                result_text, total_length = StreamingDocumentWriter.write_streaming(
                    docs_service, doc_id, doc, response,
                    output_markdown=config.get('output_markdown', False)
                )
                print(f"DEBUG: Chat streaming complete. Total length: {total_length} chars")
            else:
                print("DEBUG: Using chat API without streaming")
                # Handle potential empty response
                try:
                    result_text = response.text
                except ValueError:
                    result_text = "" # Or handle error appropriately
                total_length = len(result_text)
                print(f"DEBUG: Chat output ({total_length} chars)")

                DocumentWriter.write_output(
                    docs_service, doc_id, result_text, doc,
                    output_markdown=config.get('output_markdown', False)
                )

            # Append to context history
            DocumentWriter.append_to_context_history(
                docs_service, doc_id, prompt_text, result_text, doc
            )

            return jsonify({
                'status': 'success',
                'doc_id': doc_id,
                'result_length': total_length,
                'output_format': 'markdown' if config.get('output_markdown') else 'formatted',
                'streaming': streaming_enabled,
                'chat_mode': True
            })
        else:
            # Single-turn generation
            response = model.generate_content(content_parts, stream=streaming_enabled)

            if streaming_enabled:
                print("DEBUG: Using streaming output (no chat)")
                result_text, total_length = StreamingDocumentWriter.write_streaming(
                    docs_service, doc_id, doc, response,
                    output_markdown=config.get('output_markdown', False)
                )
                print(f"DEBUG: Streaming write complete. Total length: {total_length} chars")
            else:
                print("DEBUG: Using non-streaming output (no chat)")
                try:
                    result_text = response.text
                except ValueError:
                    result_text = ""
                total_length = len(result_text)
                print(f"DEBUG: Gemini output ({total_length} chars)")

                DocumentWriter.write_output(
                    docs_service, doc_id, result_text, doc,
                    output_markdown=config.get('output_markdown', False)
                )

            return jsonify({
                'status': 'success',
                'doc_id': doc_id,
                'result_length': total_length,
                'output_format': 'markdown' if config.get('output_markdown') else 'formatted',
                'streaming': streaming_enabled,
                'chat_mode': False
            })

    except Exception as e:
        import traceback
        print(f"ERROR: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=True)
