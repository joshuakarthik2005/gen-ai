# RAG Snippet Filtering Setup Guide

## Overview

The RAG (Retrieval-Augmented Generation) search now supports **user-level** and **document-level** filtering to ensure users only see snippets from their own documents.

### ✅ What's Been Implemented

1. **Backend filtering with backward compatibility**
   - User-level filtering (all user's documents)
   - Document-level filtering (current document only)
   - Post-search fallback filtering (works even without schema changes)
   - Graceful error handling

2. **Frontend UI controls**
   - Search scope toggle (all my docs vs. current doc only)
   - Clear visual indicators for search scope

3. **Safety mechanisms**
   - All changes are backward compatible
   - Filtering works with or without Discovery Engine schema support
   - Multiple fallback layers prevent errors

---

## 🚀 Quick Start (Works Immediately)

**No configuration needed!** The system will work immediately with **post-search filtering**:
- Results from Discovery Engine are filtered by checking document URLs
- Only shows snippets from the current user's documents
- Safe and functional without any schema changes

---

## 📊 Optimal Setup (Recommended for Production)

For best performance, configure Discovery Engine to support metadata filtering at the search level.

### Step 1: Update Discovery Engine Schema

Add these fields to your Vertex AI Search datastore schema:

```json
{
  "user_id": {
    "type": "string",
    "filterable": true,
    "retrievable": true,
    "searchable": false
  },
  "user_email": {
    "type": "string",
    "filterable": true,
    "retrievable": true,
    "searchable": false
  },
  "document_id": {
    "type": "string",
    "filterable": true,
    "retrievable": true,
    "searchable": false
  }
}
```

### Step 2: Update Document Indexing

When indexing documents to Discovery Engine, include these metadata fields:

```python
# Example: When uploading to Discovery Engine
document_metadata = {
    "user_id": current_user.id,
    "user_email": current_user.email,
    "document_id": extract_doc_id(file_path),
    # ... other metadata
}
```

### Step 3: Set Environment Variables

Add these to your backend environment (`.env` or deployment config):

```bash
# Enable user-level filtering
RAG_FILTER_METADATA=user_id

# Enable document-level filtering (optional, defaults to "document_id")
RAG_FILTER_DOCUMENT_ID=document_id

# Discovery Engine configuration (if different from defaults)
RAG_ENGINE_PROJECT=your-project-id
RAG_ENGINE_LOCATION=global
RAG_ENGINE_ID=your-engine-id
```

### Step 4: Re-index Existing Documents (if applicable)

If you have existing documents without metadata, you'll need to re-index them:

```bash
# This depends on your indexing pipeline
# Example: Run a script to update metadata for all documents
python update_document_metadata.py
```

---

## 🔧 Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RAG_FILTER_METADATA` | `""` (disabled) | Field name for user filtering (`user_id` or `user_email`) |
| `RAG_FILTER_DOCUMENT_ID` | `document_id` | Field name for document filtering |
| `RAG_ENABLE_FALLBACK` | `true` | Enable fallback sample snippets when no results found |
| `RAG_ALLOW_MOCK` | `false` | Allow mock data when Discovery Engine unavailable |

### Backend API Parameters

The `/rag-search` endpoint now accepts:

```typescript
{
  "query": "selected text to search",
  "document_context": "https://...",  // Optional document URL
  "document_id": "uuid-or-filename",  // Optional specific document ID
  "scope": "user" | "document"        // Search scope (default: "user")
}
```

---

## 🧪 Testing the Implementation

### Test 1: Verify Post-Search Filtering Works

**No configuration needed** - this should work immediately:

1. Upload a document as User A
2. Upload a document as User B
3. Login as User A and select text
4. Verify snippets only show from User A's documents

**Expected behavior:** Even without Discovery Engine schema changes, results are filtered.

### Test 2: Verify Document-Specific Search

1. Open a document
2. Enable "Search current document only" toggle
3. Select text and trigger search
4. Verify snippets only come from that document

### Test 3: Verify Discovery Engine Filtering (After Schema Setup)

1. Set `RAG_FILTER_METADATA=user_id` in environment
2. Restart backend
3. Check backend logs for: `"Applied Discovery Engine filter: user_id: ANY(...)""`
4. Verify search is faster (filtering happens at Discovery Engine level)

---

## 📝 Migration Path

### Phase 1: Deploy Code (✅ Done)
- Backend supports filtering parameters
- Frontend sends scope and document_id
- Post-search filtering active as fallback
- **No breaking changes, safe to deploy immediately**

### Phase 2: Update Schema (Optional, for performance)
1. Add filterable fields to Discovery Engine schema
2. Update document indexing pipeline to include metadata
3. Re-index existing documents with user/document metadata
4. Set `RAG_FILTER_METADATA=user_id` environment variable

### Phase 3: Monitor & Optimize
1. Monitor backend logs for filter application
2. Check if post-search filtering is being used (indicates schema not ready)
3. Verify search performance improvements

---

## 🛡️ Safety Features

### Backward Compatibility
- ✅ Works without any environment variables
- ✅ Works without schema changes
- ✅ Gracefully handles missing metadata fields
- ✅ Falls back to post-search filtering automatically

### Error Handling
- ✅ Filter construction errors don't break search
- ✅ Discovery Engine filter errors fall back to unfiltered search + post-filter
- ✅ All exceptions are caught and logged
- ✅ Never returns empty results due to filtering errors

### Privacy Guarantees
- ✅ **Always filters by user**, even if Discovery Engine filter fails
- ✅ Post-search filtering ensures user isolation
- ✅ Document-scope filtering validates document ownership

---

## 🐛 Troubleshooting

### Issue: Snippets showing from other users

**Check:**
1. Is `RAG_FILTER_METADATA` set? Check backend logs.
2. Does Discovery Engine schema have filterable fields?
3. Are documents indexed with user metadata?

**Quick fix:** Post-search filtering should catch this. Check backend logs for:
```
Post-filtered snippets: X → Y (user-only)
```

### Issue: No snippets returned

**Check:**
1. Backend logs for filter errors
2. Document indexing - are documents actually indexed?
3. Try disabling filtering: unset `RAG_FILTER_METADATA`, restart

### Issue: Search is slow

**Diagnosis:** Likely using post-search filtering (not optimal)

**Fix:** Complete Discovery Engine schema setup (Phase 2 above)

---

## 📊 Performance Comparison

| Setup | Performance | Privacy | Deployment |
|-------|-------------|---------|------------|
| Post-search filtering only | ⚠️ Slower (filters all results) | ✅ Secure | ✅ Immediate |
| Discovery Engine filtering | ✅ Fast (filters at source) | ✅ Secure | ⚠️ Requires schema update |

---

## 🔗 Related Files

- **Backend:** `backend/api.py` (search_related_documents, rag_search_endpoint)
- **Frontend:** `frontend/app/components/SynapsePanel.tsx` (performRAGSearch)
- **Config:** Environment variables in `.env` or deployment config

---

## ✅ Deployment Checklist

- [ ] Backend code deployed
- [ ] Frontend code deployed
- [ ] Test post-search filtering works
- [ ] (Optional) Update Discovery Engine schema
- [ ] (Optional) Set `RAG_FILTER_METADATA` environment variable
- [ ] (Optional) Re-index documents with metadata
- [ ] Monitor backend logs for filter application
- [ ] Verify user privacy in production

---

**Status:** ✅ Safe to deploy immediately. Schema optimization can be done later without downtime.
