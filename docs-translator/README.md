# AI Document Processor for Google Drive

A tool to automate tasks defined in a Google Doc on files stored in Google Drive, using the Google AI (Gemini) API. This repository contains implementations in both Google Apps Script and Python.

## How It Works

1.  A task is defined under a specific heading in a Google Doc.
2.  The script reads input files from a designated Google Drive folder.
3.  A prompt is constructed with the task and file contents.
4.  The prompt is sent to the Gemini API.
5.  The AI's response is written back to the Google Doc under an output heading.

---

## 🚀 Getting Started

### Prerequisites

- A Google Account
- A Google AI Studio API Key
- A Google Cloud Project (for the Python version) with the Docs and Drive APIs enabled.

### 📝 Google Apps Script Version

This version runs directly within your Google Doc.

**Setup:**
1.  Create your Google Doc and Google Drive folder as described in the setup guide.
2.  Open the Google Doc and go to `Extensions > Apps Script`.
3.  Copy the code from `google-apps-script/src/Code.gs` into the editor.
4.  In the Apps Script editor, go to **Project Settings** > **Script Properties** and add your `GEMINI_API_KEY`.
5.  Update the `DRIVE_FOLDER_ID` constant in the script.
6.  Save, reload the Doc, and run from the `AI Assistant` menu.

### 🐍 Python Version

This version runs from your local machine.

**Setup:**
1.  Clone this repository: `git clone <your-repo-url>`
2.  Navigate to the `python` directory: `cd your-ai-doc-processor/python`
3.  Install dependencies: `pip install -r requirements.txt`
4.  **Set up credentials:**
    - Follow Google's guide to create an `OAuth 2.0 Client ID` and download `credentials.json` into this directory.
5.  **Set up API Key:**
    - Rename `.env.example` to `.env`.
    - Open `.env` and add your keys:
      ```
      GEMINI_API_KEY="your-google-ai-key"
      DOCUMENT_ID="your-google-doc-id"
      DRIVE_FOLDER_ID="your-google-drive-folder-id"
      ```
6.  Run the script: `python src/main.py`
    - The first run will open a browser window for you to authorize the application.

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.