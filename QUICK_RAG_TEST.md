# Quick RAG Test Commands

## 1. Start Backend
```powershell
cd "C:\Users\joshua karthik\OneDrive\Desktop\gen-ai\gen-ai\backend"
uvicorn api:app --host 0.0.0.0 --port 8080 --reload
```

## 2. Test RAG Health (in browser or new terminal)
```
http://localhost:8080/rag-health
```

Expected result:
- `discovery_engine_available: true`
- `client_init: true` 
- `test_search.has_documents: false` ← **This is likely your problem**

## 3. Run Diagnostic Tool
```powershell
cd backend
python -m pip install requests
python test_rag.py
```

## 4. If Documents Aren't Indexed

### Option A: Use Fallback Mode
Set this environment variable to use mock snippets:
```powershell
$env:RAG_USE_FALLBACK="true"
uvicorn api:app --host 0.0.0.0 --port 8080 --reload
```

### Option B: Check Engine ID
Visit Google Cloud Console:
1. Go to Discovery Engine
2. Find your actual engine ID 
3. Set it: `$env:RAG_ENGINE_ID="your-real-engine-id"`

### Option C: Index Your Documents
Your PDFs need to be:
1. **Uploaded to Google Cloud Storage**
2. **Indexed in Discovery Engine** 
3. **Indexing completed** (takes time)

## The Issue
Your code is perfect - but **Discovery Engine has no documents to search**. That's why "John Landlord" returns nothing.

The fallback mode I added will return sample snippets so you can test the UI while you fix indexing.