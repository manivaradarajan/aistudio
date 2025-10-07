"""
File upload handling for Google Drive to Gemini
"""
import io
import os
import re
import tempfile
import time
from typing import Dict, List, Optional, Tuple

from googleapiclient.http import MediaIoBaseDownload

from .gemini_client import GeminiClientManager


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
