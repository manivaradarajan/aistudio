# AI Assistant Cloud Run App

Session-based OAuth app that reads Google Docs, processes with Gemini, and writes results back.

## Local Testing

### 1. Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Copy environment variables
cp .env.example .env

# Edit .env with your credentials
```

### 2. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable APIs:
   - Google Docs API
   - Google Drive API
4. Create OAuth 2.0 credentials:
   - Credentials → Create Credentials → OAuth client ID
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:8080/oauth2callback`
5. Copy Client ID and Client Secret to `.env`

### 3. Get Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create API key
3. Add to `.env`

### 4. Generate Secret Key

```bash
python -c "import secrets; print(secrets.token_hex(32))"
# Add output to .env as SECRET_KEY
```

### 5. Run Locally

```bash
python app.py
```

Visit http://localhost:8080

### 6. Test the Flow

1. Go to http://localhost:8080/auth to authenticate
2. Create a test Google Doc with tabs:
   - "Task" tab with content: "Summarize this"
   - "Input" tab with content: "Your input text here"
3. Call the API:

```bash
curl -X POST http://localhost:8080/process/YOUR_DOC_ID
```

## Deploy to Cloud Run

### 1. Setup gcloud

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### 2. Update OAuth Redirect URI

After first deployment, you'll get a Cloud Run URL. Update:
1. Google Cloud Console → OAuth credentials → Add redirect URI:
   `https://YOUR-APP-URL/oauth2callback`
2. Update REDIRECT_URI in Cloud Run environment variables

### 3. Deploy

```bash
# Set environment variables
gcloud run deploy ai-assistant \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars SECRET_KEY=your-secret-key \
  --set-env-vars GOOGLE_CLIENT_ID=your-client-id \
  --set-env-vars GOOGLE_CLIENT_SECRET=your-client-secret \
  --set-env-vars GEMINI_API_KEY=your-gemini-key \
  --set-env-vars REDIRECT_URI=https://YOUR-APP-URL/oauth2callback \
  --timeout 600 \
  --memory 512Mi
```

### 4. Update Apps Script

In your Google Apps Script, update the endpoint URL to call your Cloud Run URL instead of processing locally.

## Cost Estimate

- **Cloud Run**: Free tier covers ~2M requests/month
- **For 100 AI tasks/month**: ~$0-2
- **Gemini API**: Separate billing

## Security Notes

- Session-only authentication (credentials cleared on browser close)
- No persistent storage of tokens
- Can revoke access anytime from Google Account settings
- Use HTTPS in production (Cloud Run provides this automatically)
