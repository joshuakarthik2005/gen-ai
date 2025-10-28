# Discovery Engine Reindexing Guide

## The Problem
Your Discovery Engine contains old documents that no longer exist in your workspace. This causes:
- RAG search returning results from deleted documents
- Results from wrong users' documents
- "Search current document only" not working properly

## The Solution: Manual Reindexing via Cloud Console

### Step 1: Find Your Data Store

1. Go to: https://console.cloud.google.com/gen-app-builder/engines?project=demystifier-ai
2. You should see your search engine (likely named `synapseragengine` or similar)
3. Click on it

### Step 2: Purge Old Documents

1. In the engine page, click on "**Data**" tab
2. Click on your data store
3. Click "**Documents**" 
4. Click "**Purge documents**" or find the delete option
5. Confirm to delete all documents

**Alternative**: If you can't find purge option:
- Click on individual documents and delete them
- Or create a new data store and update your backend code to use it

### Step 3: Import Current Documents

After purging:

1. Click "**Import**"
2. Select "**Cloud Storage**"
3. Choose import method: **"Metadata and content separately"**
4. Enter GCS URI:
   ```
   gs://demystifier-ai_cloudbuild/documents/users/**/*.pdf
   ```

5. **IMPORTANT**: Configure metadata mapping:
   - Click "Add metadata field"
   - Add these fields from your GCS blob metadata:
     - `user_id` → string, filterable
     - `user_email` → string, filterable  
     - `document_id` → string, filterable
     - `original_filename` → string
     - `upload_timestamp` → string

6. Click "**Import**"

7. Wait 2-5 minutes for indexing

### Step 4: Update Backend Environment Variables

After reindexing, update your backend:

Create/update `backend/.env`:
```bash
# Enable metadata filtering
RAG_FILTER_METADATA=user_id

# Enable post-filter as fallback
RAG_ENABLE_POSTFILTER=true

# Strict user isolation
RAG_STRICT_USER_ISOLATION=true
```

Redeploy backend:
```bash
cd backend
gcloud run deploy legal-backend --source . --region asia-south1 --allow-unauthenticated --set-env-vars="RAG_FILTER_METADATA=user_id,RAG_ENABLE_POSTFILTER=true"
```

### Step 5: Test

1. Refresh your frontend
2. Select text from a document
3. Click "Explain this"
4. Verify snippets only show from YOUR documents
5. Enable "Search current document only" toggle
6. Verify snippets only show from CURRENT document

---

## Quick Alternative: Delete Old Files from GCS

If the above is too complex, you can clean up GCS first:

```bash
# List all documents
gsutil ls -r gs://demystifier-ai_cloudbuild/documents/users/

# Delete specific user's old files (if needed)
# gsutil rm -r gs://demystifier-ai_cloudbuild/documents/users/USER_ID_HERE/

# Then let Discovery Engine auto-sync (may take time)
```

---

## Documents Found in Your GCS

Your GCS has **55 documents** from multiple users:
- `demo@example.com` - 13 documents
- `joshuakarthik2005@gmail.com` - 9 documents  
- `josh_123@gmail.com` - 5 documents
- `josh_1234@gmail.com` - 5 documents
- And many more...

**Recommendation**: 
- If you're testing, delete old test documents from other users
- Keep only the documents you actually need
- This will make reindexing faster and search more accurate

---

## Need Help?

If you're stuck:
1. Share a screenshot of your Discovery Engine console
2. Or let me know and I'll help troubleshoot further
