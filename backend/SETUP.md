# Google Cloud Configuration for Legal Document Demystifier

## Setup Instructions

### 1. Google Cloud Project Setup
1. Create a Google Cloud Project (if you don't have one)
2. Enable the Vertex AI API
3. Set up authentication (one of the following options):

#### Option A: Service Account Key (Recommended for development)
1. Go to the Google Cloud Console
2. Navigate to IAM & Admin > Service Accounts
3. Create a new service account or use an existing one
4. Download the JSON key file
5. Set the environment variable:
   ```
   set GOOGLE_APPLICATION_CREDENTIALS=path\to\your\service-account-key.json
   ```

#### Option B: Application Default Credentials
1. Install Google Cloud CLI
2. Run: `gcloud auth application-default login`

### 2. Environment Variables
Set these environment variables before running the script:

```powershell
# Your Google Cloud Project ID
set GOOGLE_CLOUD_PROJECT=your-project-id

# The region where you want to run Vertex AI (for India users, use asia-southeast1)
set GOOGLE_CLOUD_LOCATION=asia-southeast1
```

### 3. Required APIs
Make sure these APIs are enabled in your Google Cloud Project:
- Vertex AI API
- AI Platform API

### 4. Billing
Ensure your Google Cloud Project has billing enabled as Vertex AI is a paid service.

## Testing the Setup
Run the demystifier script to test your configuration:
```powershell
"C:/Users/joshua karthik/.virtualenvs/joshua_karthik-lU-HnvAt/Scripts/python.exe" demystifier.py
```

## Troubleshooting
- If you get authentication errors, verify your GOOGLE_APPLICATION_CREDENTIALS path
- If you get API errors, ensure Vertex AI API is enabled
- If you get billing errors, verify billing is enabled on your project