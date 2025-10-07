"""
OAuth authentication handling
"""
from typing import Dict, Optional
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow

from .config import CLIENT_CONFIG, SCOPES


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
