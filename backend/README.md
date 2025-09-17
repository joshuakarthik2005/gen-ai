# Legal Document Demystifier

An AI-powered tool that simplifies complex legal documents using Google's Gemini model via Vertex AI.

## Features

- **Core Script**: Analyze legal text directly using a Python script
- **REST API**: FastAPI-based web service for document analysis
- **File Upload**: Support for uploading and analyzing legal documents
- **Text Analysis**: Direct text input for quick analysis

## Project Structure

```
gen-ai/
├── demystifier.py              # Core analysis script
├── api.py                      # FastAPI application
├── test_client.py              # Test client for API
├── sample_employment_agreement.txt  # Sample legal document
├── SETUP.md                    # Google Cloud setup instructions
└── README.md                   # This file
```

## Setup Instructions

### 1. Google Cloud Configuration

Before running the application, you need to set up Google Cloud authentication:

1. **Create a Google Cloud Project** (if you don't have one)
2. **Enable the Vertex AI API**
3. **Set up authentication** (choose one option):

#### Option A: Service Account Key (Recommended for development)
```powershell
# Download your service account key JSON file
set GOOGLE_APPLICATION_CREDENTIALS=path\to\your\service-account-key.json
```

#### Option B: Application Default Credentials
```powershell
# Install Google Cloud CLI and authenticate
gcloud auth application-default login
```

### 2. Environment Variables

Set these environment variables:

```powershell
# Your Google Cloud Project ID
set GOOGLE_CLOUD_PROJECT=your-actual-project-id

# The region for Vertex AI (optional, defaults to us-central1)
set GOOGLE_CLOUD_LOCATION=us-central1
```

### 3. Python Environment

The Python environment is already configured with these packages:
- `google-cloud-aiplatform`
- `fastapi`
- `uvicorn`
- `python-multipart`
- `requests`

## Usage

### Option 1: Core Script

Run the standalone script to test the core functionality:

```powershell
& "C:/Users/joshua karthik/.virtualenvs/joshua_karthik-lU-HnvAt/Scripts/python.exe" demystifier.py
```

### Option 2: FastAPI Application

1. **Start the API server:**
```powershell
& "C:/Users/joshua karthik/.virtualenvs/joshua_karthik-lU-HnvAt/Scripts/python.exe" api.py
```

2. **Access the API:**
- API Documentation: http://127.0.0.1:8000/docs
- Health Check: http://127.0.0.1:8000/health
- Root Info: http://127.0.0.1:8000/

3. **Test the API:**
```powershell
& "C:/Users/joshua karthik/.virtualenvs/joshua_karthik-lU-HnvAt/Scripts/python.exe" test_client.py
```

## API Endpoints

### POST /analyze-document
Upload a legal document file for analysis.

**Example using curl:**
```bash
curl -X POST "http://127.0.0.1:8000/analyze-document" \
     -F "file=@sample_employment_agreement.txt"
```

### POST /analyze-text
Analyze legal text directly.

**Example using curl:**
```bash
curl -X POST "http://127.0.0.1:8000/analyze-text" \
     -H "Content-Type: application/json" \
     -d '{"text": "Your legal text here..."}'
```

### GET /health
Check API health status.

## Sample Output

The AI provides:
1. **One-paragraph summary** in simple, clear English
2. **3 most important clauses** with explanations of risks or obligations

Example analysis of an employment agreement might include:
- Summary of the employment relationship
- Key clauses about non-compete agreements
- Termination conditions and notice requirements
- Confidentiality obligations

## Troubleshooting

### Authentication Errors
- Verify your `GOOGLE_APPLICATION_CREDENTIALS` path
- Ensure the service account has Vertex AI permissions
- Check that billing is enabled on your Google Cloud Project

### API Errors
- Confirm Vertex AI API is enabled in your project
- Verify your project ID is correct
- Check that the region supports Gemini models

### File Upload Issues
- Ensure files are in supported formats (currently text files work best)
- Check file size limits (currently limited to ~10KB)

## Development Notes

- The application uses `gemini-pro` model from Vertex AI
- Text is currently limited to 10,000 characters to manage API costs
- Error handling includes proper HTTP status codes and logging
- The API supports CORS for web frontend integration

## Next Steps

1. Add support for PDF and Word document parsing
2. Implement user authentication and rate limiting
3. Add support for different analysis types (contract review, compliance check, etc.)
4. Create a web frontend for easier document upload
5. Add document storage and history features

## Security Considerations

- Never commit your Google Cloud credentials to version control
- Use environment variables for sensitive configuration
- Consider implementing API rate limiting for production use
- Validate and sanitize all file uploads