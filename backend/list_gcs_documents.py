#!/usr/bin/env python3
"""
Clean up old documents from GCS to prepare for reindexing.
This will list all documents and let you choose which users to keep.
"""

from google.cloud import storage
import os

PROJECT_ID = "demystifier-ai"
BUCKET_NAME = "demystifier-ai_cloudbuild"

def list_documents_by_user():
    """List all documents grouped by user."""
    storage_client = storage.Client(project=PROJECT_ID)
    bucket = storage_client.bucket(BUCKET_NAME)
    
    users = {}
    blobs = bucket.list_blobs(prefix="documents/users/")
    
    for blob in blobs:
        if blob.name.endswith('.pdf'):
            blob.reload()
            metadata = blob.metadata or {}
            user_email = metadata.get('user_email', 'unknown')
            
            if user_email not in users:
                users[user_email] = []
            
            users[user_email].append({
                'name': blob.name,
                'filename': metadata.get('original_filename', blob.name.split('/')[-1]),
                'size': blob.size,
                'created': blob.time_created
            })
    
    return users


def main():
    print("=" * 60)
    print("📋 GCS Document Cleanup Tool")
    print("=" * 60)
    
    print("\n⏳ Scanning GCS...")
    users = list_documents_by_user()
    
    if not users:
        print("❌ No documents found")
        return
    
    print(f"\n✅ Found documents from {len(users)} users:\n")
    
    for user_email, docs in sorted(users.items()):
        total_size = sum(doc['size'] for doc in docs)
        print(f"  📧 {user_email}")
        print(f"     Documents: {len(docs)}")
        print(f"     Total size: {total_size / 1024 / 1024:.2f} MB")
        print(f"     Files: {', '.join([doc['filename'][:30] for doc in docs[:3]])}")
        if len(docs) > 3:
            print(f"            ... and {len(docs) - 3} more")
        print()
    
    print("\n" + "=" * 60)
    print("📝 Documents are currently stored in GCS")
    print("=" * 60)
    print("\nTo clean up:")
    print("1. Go to: https://console.cloud.google.com/storage/browser/demystifier-ai_cloudbuild/documents/users")
    print("2. Delete folders for users you don't need")
    print("3. Keep only current user's documents")
    print("\nOR use command line:")
    print("  gsutil rm -r gs://demystifier-ai_cloudbuild/documents/users/USER_FOLDER_HERE/")
    print("\nAfter cleanup, reindex Discovery Engine with remaining documents")


if __name__ == "__main__":
    main()
