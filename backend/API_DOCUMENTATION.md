# Backend API Documentation

## Active API File
**`api.py`** is the **ONLY active API file** for this project.

## File Status
- ✅ **api.py** - Active API (running on port 8080) - **COMPLETE IMPLEMENTATION**
- 📦 **main.py.backup** - Simplified version (for reference only, DO NOT RUN)

## Why Only One File?
Previously, both `api.py` and `main.py` had duplicate endpoints, causing:
- Maintenance issues (updating code in two places)
- Confusion about which file to run
- Inconsistent implementations

## Running the Backend
```powershell
# Navigate to backend folder
cd gen-ai\backend

# Activate virtual environment (if needed)
.\venv\Scripts\Activate.ps1

# Run the server
python api.py
```

## Available Endpoints in api.py

### Authentication
- `POST /register` - Register new user
- `POST /login` - Login user
- `GET /me` - Get current user info

### Document Management
- `POST /upload-pdf` - Upload PDF document (with/without auth)
- `GET /user-files` - Get user's uploaded files (auth required)
- `POST /upload-document` - Upload document and get URL
- `GET /proxy-gcs/{bucket_name}/{file_path:path}` - Proxy for GCS files

### Document Analysis
- `POST /analyze-document` - Analyze uploaded document
- `POST /analyze-text` - Analyze text directly
- `POST /explain-selection` - Explain selected text
- `POST /extract-pdf-text` - Extract text from PDF
- `POST /chat` - Chat with AI about documents

### Summarization
- `POST /summarize` - Summarize document text
- `POST /summarize-upload` - Upload and summarize document

### RAG/Search
- `POST /rag-search` - Search related documents
- `POST /rag-test` - Test RAG with common queries
- `POST /rag-test-custom` - Custom RAG test with specific queries
- `GET /rag-health` - Check RAG engine health

### System
- `GET /` - API info
- `GET /health` - Health check

## Configuration
Environment variables are set in `.env` file:
- `GOOGLE_CLOUD_PROJECT`
- `GOOGLE_CLOUD_LOCATION`
- `RAG_ENGINE_*` settings
- `PORT` (default: 8080)

## Dependencies
All dependencies are in `requirements.txt`. Install with:
```powershell
pip install -r requirements.txt
```

## Notes
- Demo users are auto-created on startup:
  - `demo@example.com` / `demo123`
  - `admin@clarityLegal.com` / `admin123`
- Uses local JSON file (`users_db.json`) for user storage
- GCS integration for file storage (fallback to data URLs if not configured)
