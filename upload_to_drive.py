import os
import mimetypes
import argparse
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

# Scopes required to upload files (drive.file scope is recommended for security)
SCOPES = ['https://www.googleapis.com/auth/drive.file']

def get_credentials():
    """Retrieves or refreshes OAuth2 credentials for the script."""
    creds = None
    
    # The file token.json stores the user's access and refresh tokens
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
        
    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("Refreshing access token...")
            creds.refresh(Request())
        else:
            if os.path.exists('credentials.json'):
                print("Initializing authorization flow with credentials.json...")
                flow = InstalledAppFlow.from_client_secrets_file(
                    'credentials.json', SCOPES)
                creds = flow.run_local_server(port=0)
            else:
                # Fallback to Application Default Credentials
                import google.auth
                print("credentials.json not found. Attempting Application Default Credentials (ADC)...")
                creds, _ = google.auth.default(scopes=SCOPES)
                
        # Save credentials for future executions
        if hasattr(creds, 'to_json'):
            with open('token.json', 'w') as token:
                token.write(creds.to_json())
                
    return creds

def upload_file(file_path, drive_name=None, folder_id=None, mime_type=None):
    """Uploads a local file to Google Drive.
    
    Args:
        file_path (str): Local path to the file.
        drive_name (str): Custom file name on Google Drive (optional).
        folder_id (str): Google Drive folder ID to upload into (optional).
        mime_type (str): Custom MIME type of the file (optional).
    """
    if not os.path.exists(file_path):
        print(f"Error: Local file '{file_path}' does not exist.")
        return None

    # Default to local file base name
    if not drive_name:
        drive_name = os.path.basename(file_path)

    # Detect MIME type if not specified
    if not mime_type:
        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type:
            mime_type = 'application/octet-stream'

    print(f"Connecting to Google Drive API...")
    creds = get_credentials()
    
    try:
        service = build('drive', 'v3', credentials=creds)

        # File metadata setup
        file_metadata = {'name': drive_name}
        if folder_id:
            file_metadata['parents'] = [folder_id]

        # Media body generator
        media = MediaFileUpload(file_path, mimetype=mime_type, resumable=True)

        print(f"Uploading '{file_path}' as '{drive_name}'...")
        file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id, name, webViewLink'
        ).execute()

        print("\n🎉 Upload Successful!")
        print(f"File Name: {file.get('name')}")
        print(f"File ID:   {file.get('id')}")
        print(f"View Link: {file.get('webViewLink')}")
        return file.get('id')

    except HttpError as error:
        print(f"An error occurred during upload: {error}")
        return None
    except Exception as e:
        print(f"Unexpected error: {e}")
        return None

if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description="Upload a local file to Google Drive using the Drive API v3."
    )
    parser.add_argument('file_path', help="Path to the local file to upload.")
    parser.add_argument(
        '--name', 
        help="Custom target name of the file on Google Drive (defaults to local filename)."
    )
    parser.add_argument(
        '--folder', 
        help="Target parent folder ID in Google Drive (optional)."
    )
    parser.add_argument(
        '--mime', 
        help="MIME type of the file (optional, guessed automatically if omitted)."
    )

    args = parser.parse_args()
    upload_file(
        args.file_path, 
        drive_name=args.name, 
        folder_id=args.folder, 
        mime_type=args.mime
    )
