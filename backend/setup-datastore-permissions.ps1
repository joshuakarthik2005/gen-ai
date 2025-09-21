# Grant permissions to Discovery Engine service account after data store creation
# Run this after the data store is created and the service account appears

Write-Host "=== Granting Discovery Engine Permissions ===" -ForegroundColor Green

# The Discovery Engine service account is automatically created when you create a data store
$PROJECT_NUMBER = "144935064473"
$DISCOVERY_ENGINE_SA = "service-$PROJECT_NUMBER@gcp-sa-discoveryengine.iam.gserviceaccount.com"

Write-Host "Granting storage permissions to: $DISCOVERY_ENGINE_SA" -ForegroundColor Yellow

# Grant project-level storage permissions
Write-Host "`n1. Granting storage.admin role at project level..."
gcloud projects add-iam-policy-binding demystifier-ai --member="serviceAccount:$DISCOVERY_ENGINE_SA" --role="roles/storage.admin"

Write-Host "`n2. Granting storage.objectViewer role at project level..."
gcloud projects add-iam-policy-binding demystifier-ai --member="serviceAccount:$DISCOVERY_ENGINE_SA" --role="roles/storage.objectViewer"

# Grant bucket-level permissions
Write-Host "`n3. Granting storage.objectViewer at bucket level..."
gsutil iam ch serviceAccount:${DISCOVERY_ENGINE_SA}:objectViewer gs://demystifier-ai_cloudbuild

Write-Host "`n4. Verifying permissions..."
Write-Host "Project-level permissions:" -ForegroundColor Cyan
gcloud projects get-iam-policy demystifier-ai --flatten="bindings[].members" --format="table(bindings.role)" --filter="bindings.members:$DISCOVERY_ENGINE_SA"

Write-Host "`nBucket-level permissions:" -ForegroundColor Cyan
gsutil iam get gs://demystifier-ai_cloudbuild | findstr "$DISCOVERY_ENGINE_SA"

Write-Host "`n=== Permissions Setup Complete ===" -ForegroundColor Green
Write-Host "You can now proceed with document indexing in the data store." -ForegroundColor Yellow