"""
Configuration settings for the application
"""
import os

# Allow HTTP for local development (remove in production)
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

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
GEMINI_MODEL = 'gemini-2.5-flash'

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

# Flask Configuration
SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
