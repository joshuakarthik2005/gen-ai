#!/usr/bin/env python3
"""
Script to reindex documents in Discovery Engine with proper metadata.
This will help ensure RAG search returns only relevant, current documents.
"""

import os
from google.cloud import storage
from google.cloud import discoveryengine_v1 as discoveryengine
from google.api_core import exceptions
import json

# Configuration
PROJECT_ID = "demystifier-ai"
LOCATION = "global"
# DATA_STORE_ID will be auto-discovered; fallback can be provided via env RAG_DATA_STORE_ID
DATA_STORE_ID = os.getenv("RAG_DATA_STORE_ID", "")
BUCKET_NAME = "demystifier-ai_cloudbuild"


def discover_data_store_id(project_id: str, location: str) -> str:
    """Discover a valid Discovery Engine data store ID.

    Returns the single data store if only one exists, otherwise prompts the user to select.
    """
    try:
        ds_client = discoveryengine.DataStoreServiceClient()
        parent = f"projects/{project_id}/locations/{location}/collections/default_collection"
        data_stores = list(ds_client.list_data_stores(parent=parent))

        if not data_stores:
            print("❌ No Discovery Engine data stores found in this project/location.")
            print("Create one in the console: https://console.cloud.google.com/gen-app-builder/engines")
            return ""

        if len(data_stores) == 1:
            ds_name = data_stores[0].name
            ds_id = ds_name.split("/")[-1]
            print(f"🔎 Auto-discovered data store: {ds_id}")
            return ds_id

        print("🔎 Multiple data stores found:")
        for idx, ds in enumerate(data_stores, start=1):
            ds_id = ds.name.split("/")[-1]
            display = ds.display_name if hasattr(ds, "display_name") else ds_id
            print(f"  {idx}. {display} (id: {ds_id})")
        sel = input("Select data store number to use: ")
        try:
            i = int(sel) - 1
            ds_name = data_stores[i].name
            return ds_name.split("/")[-1]
        except Exception:
            print("❌ Invalid selection")
            return ""
    except Exception as e:
        print(f"❌ Failed to list data stores: {e}")
        print("Try using the console to find the Data Store ID, then set RAG_DATA_STORE_ID env var.")
        return ""

def list_user_documents():
    """List all documents in GCS under documents/users/"""
    storage_client = storage.Client(project=PROJECT_ID)
    bucket = storage_client.bucket(BUCKET_NAME)
    
    documents = []
    # List all PDFs in the users folder
    blobs = bucket.list_blobs(prefix="documents/users/")
    
    for blob in blobs:
        if blob.name.endswith('.pdf'):
            # Extract metadata
            blob.reload()  # Refresh to get metadata
            metadata = blob.metadata or {}
            
            doc_info = {
                'gcs_uri': f"gs://{BUCKET_NAME}/{blob.name}",
                'name': blob.name,
                'user_id': metadata.get('user_id', 'unknown'),
                'user_email': metadata.get('user_email', 'unknown'),
                'original_filename': metadata.get('original_filename', blob.name.split('/')[-1]),
                'upload_timestamp': metadata.get('upload_timestamp', str(blob.time_created)),
            }
            # Extract document_id from path (the UUID filename without extension)
            parts = blob.name.split('/')
            if len(parts) >= 4:
                doc_info['document_id'] = parts[-1].replace('.pdf', '')
            
            documents.append(doc_info)
            print(f"Found: {doc_info['original_filename']} (User: {doc_info['user_email']})")
    
    return documents


def purge_all_documents(data_store_id: str):
    """Purge all documents from Discovery Engine data store."""
    print(f"\n🗑️  Purging all documents from data store: {data_store_id}")
    
    try:
        client = discoveryengine.DocumentServiceClient()
        
        # The full resource name
        parent = f"projects/{PROJECT_ID}/locations/{LOCATION}/collections/default_collection/dataStores/{data_store_id}/branches/default_branch"
        
        # Purge request
        request = discoveryengine.PurgeDocumentsRequest(
            parent=parent,
            filter="*",  # Purge all documents
            force=True
        )
        
        operation = client.purge_documents(request=request)
        print("⏳ Purge operation started...")
        response = operation.result(timeout=300)  # Wait up to 5 minutes
        print(f"✅ Purge completed: {response.purge_count} documents removed")
        return True
        
    except Exception as e:
        print(f"❌ Purge failed: {e}")
        print("Note: You may need to purge manually via Google Cloud Console")
        print(f"Go to: https://console.cloud.google.com/gen-app-builder/data-stores/{DATA_STORE_ID}")
        return False


def import_documents(documents, data_store_id: str):
    """Import documents to Discovery Engine with metadata."""
    print(f"\n📤 Importing {len(documents)} documents to Discovery Engine...")
    
    try:
        client = discoveryengine.DocumentServiceClient()
        
        parent = f"projects/{PROJECT_ID}/locations/{LOCATION}/collections/default_collection/dataStores/{data_store_id}/branches/default_branch"
        
        # Prepare documents in the format Discovery Engine expects
        import_docs = []
        for doc in documents:
            # Create structured data with metadata
            struct_data = {
                "title": doc['original_filename'],
                "uri": doc['gcs_uri'],
                "user_id": doc['user_id'],
                "user_email": doc['user_email'],
                "document_id": doc.get('document_id', ''),
                "upload_timestamp": doc['upload_timestamp']
            }
            
            # Build the document proto; different client versions may use different fields
            discovery_doc = discoveryengine.Document(
                id=doc.get('document_id', doc['name'].replace('/', '_')),
                struct_data=struct_data,
                content=discoveryengine.Document.Content(
                    uri=doc['gcs_uri'],
                    mime_type="application/pdf"
                )
            )
            import_docs.append(discovery_doc)
        
        # Import in batches of 10
        batch_size = 10
        for i in range(0, len(import_docs), batch_size):
            batch = import_docs[i:i+batch_size]
            
            request = discoveryengine.ImportDocumentsRequest(
                parent=parent,
                inline_source=discoveryengine.ImportDocumentsRequest.InlineSource(
                    documents=batch
                ),
                reconciliation_mode=discoveryengine.ImportDocumentsRequest.ReconciliationMode.INCREMENTAL
            )
            
            print(f"⏳ Importing batch {i//batch_size + 1}...")
            operation = client.import_documents(request=request)
            response = operation.result(timeout=600)  # Wait up to 10 minutes
            print(f"✅ Batch {i//batch_size + 1} imported")
        
        print(f"\n✅ Successfully imported {len(documents)} documents!")
        return True
        
    except Exception as e:
        print(f"❌ Import failed: {e}")
        print("\nAlternative: Use GCS import method")
        print(f"1. Go to: https://console.cloud.google.com/gen-app-builder/data-stores/{DATA_STORE_ID}")
        print(f"2. Click 'Import' > 'Cloud Storage'")
        print(f"3. Use path: gs://{BUCKET_NAME}/documents/users/**")
        return False


def main():
    print("=" * 60)
    print("🔄 Discovery Engine Document Reindexing")
    print("=" * 60)
    
    # Step 1: List current documents in GCS
    print("\n📋 Step 1: Scanning GCS for user documents...")
    documents = list_user_documents()
    
    if not documents:
        print("❌ No documents found in GCS under documents/users/")
        print("Please upload documents first via the UI")
        return
    
    print(f"\n✅ Found {len(documents)} documents to index")
    
    # Step 1.5: Discover data store to work with
    global DATA_STORE_ID
    if not DATA_STORE_ID:
        DATA_STORE_ID = discover_data_store_id(PROJECT_ID, LOCATION)
    if not DATA_STORE_ID:
        print("❌ Could not determine Data Store ID. Aborting.")
        return

    # Step 2: Purge old documents
    print("\n🗑️  Step 2: Purging old documents from Discovery Engine...")
    user_confirm = input("⚠️  This will delete ALL documents from Discovery Engine. Continue? (yes/no): ")
    if user_confirm.lower() != 'yes':
        print("❌ Cancelled by user")
        return
    
    purge_success = purge_all_documents(DATA_STORE_ID)
    if not purge_success:
        print("\n⚠️  Purge may have failed. You can manually purge via Cloud Console")
        user_continue = input("Continue with import anyway? (yes/no): ")
        if user_continue.lower() != 'yes':
            return
    
    # Step 3: Import documents with metadata
    print("\n📤 Step 3: Importing documents with metadata...")
    import_success = import_documents(documents, DATA_STORE_ID)
    
    if import_success:
        print("\n" + "=" * 60)
        print("✅ REINDEXING COMPLETE!")
        print("=" * 60)
        print("\n📝 Next steps:")
        print("1. Wait 2-5 minutes for indexing to complete")
        print("2. Test RAG search in the UI")
        print("3. Verify snippets only show from your current documents")
    else:
        print("\n⚠️  Import had issues. Please try manual import via Cloud Console")


if __name__ == "__main__":
    main()
