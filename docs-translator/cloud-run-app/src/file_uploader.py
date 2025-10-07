"""
File upload handling for Google Drive to Gemini and arbitrary URL processing
"""
import io
import os
import re
import tempfile
import time
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse

from googleapiclient.http import MediaIoBaseDownload
import requests

from .gemini_client import GeminiClientManager
from .webpage_extractor import WebpageExtractor


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
    def is_webpage_url(url: str) -> bool:
        """Check if URL is a webpage (not a Google Drive file or downloadable file)"""
        parsed = urlparse(url)

        # Check if it's a Google Drive URL
        if 'drive.google.com' in parsed.netloc:
            return False

        # Check if URL ends with common file extensions
        path = parsed.path.lower()
        file_extensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
                          '.txt', '.csv', '.zip', '.rar', '.mp4', '.mp3', '.png',
                          '.jpg', '.jpeg', '.gif', '.svg']
        if any(path.endswith(ext) for ext in file_extensions):
            return False

        # Default to treating as webpage
        return True

    @staticmethod
    def upload_files(file_urls: List[str], already_uploaded: Dict[str, str],
                    drive_service) -> Tuple[List, List[Dict]]:
        """
        Process URLs - handle Google Drive files, downloadable files, and webpages.

        Returns:
            Tuple of (gemini_files, new_uploads) where:
            - gemini_files: List of uploaded file objects
            - new_uploads: List of upload info dicts for tracking
        """
        gemini_files = []
        new_uploads = []
        client = GeminiClientManager.get_client()

        print(f"DEBUG: already_uploaded dict contains {len(already_uploaded)} entries:")
        for key, value in already_uploaded.items():
            print(f"  - '{key}' -> '{value}'")

        for url in file_urls:
            print(f"DEBUG: Processing URL: {url}")

            # Check if it's a Google Drive URL
            file_id = FileUploader.extract_drive_file_id(url)

            if file_id:
                # Handle Google Drive file
                print(f"DEBUG: Detected Google Drive URL, file ID: {file_id}")

                # Check if already uploaded
                if file_id in already_uploaded:
                    gemini_uri = already_uploaded[file_id]
                    print(f"DEBUG: Drive file already uploaded, using existing: {gemini_uri}")
                    try:
                        gemini_file = client.files.get(name=gemini_uri)
                        gemini_files.append(gemini_file)
                        # Don't add to new_uploads since it's already tracked
                        continue
                    except Exception as e:
                        print(f"DEBUG: Error retrieving existing file {gemini_uri}, "
                              f"will re-upload: {str(e)}")

                # Download and upload new file from Drive
                try:
                    gemini_file, upload_info = FileUploader._process_new_file(
                        file_id, drive_service, client
                    )
                    gemini_files.append(gemini_file)
                    new_uploads.append(upload_info)
                except Exception as e:
                    print(f"ERROR: Error uploading Drive file {file_id}: {str(e)}")
                    import traceback
                    print(traceback.format_exc())
                    raise

            elif FileUploader.is_webpage_url(url):
                # Handle webpage URL
                print(f"DEBUG: Detected webpage URL, extracting content")
                print(f"DEBUG: Checking if '{url}' is in already_uploaded: {url in already_uploaded}")
                if url in already_uploaded:
                    print(f"DEBUG: URL found in tracking, should reuse existing upload")
                else:
                    print(f"DEBUG: URL NOT found in tracking, will process as new")
                try:
                    gemini_file, upload_info = FileUploader._process_webpage(
                        url, already_uploaded, client
                    )
                    gemini_files.append(gemini_file)
                    # Only add to new_uploads if this is actually a new upload
                    if upload_info is not None:
                        new_uploads.append(upload_info)
                except Exception as e:
                    print(f"ERROR: Error processing webpage {url}: {str(e)}")
                    import traceback
                    print(traceback.format_exc())
                    raise

            else:
                # Handle downloadable file URL
                print(f"DEBUG: Detected downloadable file URL")
                try:
                    gemini_file, upload_info = FileUploader._process_downloadable_file(
                        url, already_uploaded, client
                    )
                    gemini_files.append(gemini_file)
                    # Only add to new_uploads if this is actually a new upload
                    if upload_info is not None:
                        new_uploads.append(upload_info)
                except Exception as e:
                    print(f"ERROR: Error downloading file {url}: {str(e)}")
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

    @staticmethod
    def _process_webpage(url: str, already_uploaded: Dict[str, str], client) -> Tuple:
        """
        Extract webpage content as Markdown and upload to Gemini.

        Args:
            url: The webpage URL
            already_uploaded: Dict of already uploaded URLs
            client: Gemini client

        Returns:
            Tuple of (gemini_file, upload_info or None)
            upload_info is None when reusing an existing upload
        """
        # Create a URL-based identifier for tracking
        url_hash = str(hash(url))

        # Check if already uploaded
        if url in already_uploaded:
            gemini_uri = already_uploaded[url]
            print(f"DEBUG: Webpage already uploaded, using existing: {gemini_uri}")
            try:
                gemini_file = client.files.get(name=gemini_uri)
                # Return None as upload_info to indicate this is not a new upload
                return gemini_file, None
            except Exception as e:
                print(f"DEBUG: Error retrieving existing webpage {gemini_uri}, "
                      f"will re-fetch: {str(e)}")

        # Extract webpage content as Markdown
        print(f"DEBUG: Extracting content from webpage: {url}")
        markdown_content = WebpageExtractor.get_webpage_content(url)

        # Create a temp file with the markdown content
        parsed_url = urlparse(url)
        filename = f"webpage_{parsed_url.netloc.replace('.', '_')}.md"

        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.md', encoding='utf-8') as temp_file:
            temp_file.write(markdown_content)
            temp_path = temp_file.name

        try:
            # Upload to Gemini
            print(f"DEBUG: Uploading webpage content to Gemini: {filename}")
            gemini_file = client.files.upload(file=temp_path, config={'display_name': filename})

            # Wait for file to be processed
            print(f"DEBUG: Waiting for Gemini to process file...")
            while gemini_file.state == 'PROCESSING':
                print(f"DEBUG: File state: {gemini_file.state}")
                time.sleep(2)
                gemini_file = client.files.get(name=gemini_file.name)

            if gemini_file.state == 'FAILED':
                raise Exception(f"Gemini file processing failed: {gemini_file.state}")

            print(f"DEBUG: Successfully uploaded webpage to Gemini: {gemini_file.name} "
                  f"(state: {gemini_file.state})")

            upload_info = {
                'drive_id': url,
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

    @staticmethod
    def _process_downloadable_file(url: str, already_uploaded: Dict[str, str], client) -> Tuple:
        """
        Download a file from arbitrary URL and upload to Gemini.

        Args:
            url: The file URL
            already_uploaded: Dict of already uploaded URLs
            client: Gemini client

        Returns:
            Tuple of (gemini_file, upload_info or None)
            upload_info is None when reusing an existing upload
        """
        # Check if already uploaded
        if url in already_uploaded:
            gemini_uri = already_uploaded[url]
            print(f"DEBUG: File already uploaded, using existing: {gemini_uri}")
            try:
                gemini_file = client.files.get(name=gemini_uri)
                # Return None as upload_info to indicate this is not a new upload
                return gemini_file, None
            except Exception as e:
                print(f"DEBUG: Error retrieving existing file {gemini_uri}, "
                      f"will re-download: {str(e)}")

        # Extract filename from URL
        parsed_url = urlparse(url)
        filename = os.path.basename(parsed_url.path)
        if not filename:
            filename = 'downloaded_file'

        # Download file
        print(f"DEBUG: Downloading file from URL: {url}")
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                         '(KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

        response = requests.get(url, headers=headers, timeout=60)
        response.raise_for_status()

        # Write to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=f'_{filename}') as temp_file:
            temp_file.write(response.content)
            temp_path = temp_file.name

        try:
            # Upload to Gemini
            print(f"DEBUG: Uploading downloaded file to Gemini: {filename}")
            gemini_file = client.files.upload(file=temp_path)

            # Wait for file to be processed
            print(f"DEBUG: Waiting for Gemini to process file...")
            while gemini_file.state == 'PROCESSING':
                print(f"DEBUG: File state: {gemini_file.state}")
                time.sleep(2)
                gemini_file = client.files.get(name=gemini_file.name)

            if gemini_file.state == 'FAILED':
                raise Exception(f"Gemini file processing failed: {gemini_file.state}")

            print(f"DEBUG: Successfully uploaded file to Gemini: {gemini_file.name} "
                  f"(state: {gemini_file.state})")

            upload_info = {
                'drive_id': url,
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
