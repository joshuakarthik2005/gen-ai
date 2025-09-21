# Complete RAG Setup Script for Legal Document Demystifier
# This script handles: Data Store creation, PDF import, IAM setup, and Cloud Run deployment

param(
    [string]$ProjectId = "demystifier-ai",
    [string]$Region = "asia-south1", 
    [string]$Location = "global",
    [string]$DataStoreId = "isolated-legal-pdfs",
    [string]$DisplayName = "Isolated Legal Documents for RAG",
    [string]$EngineId = "synapseragengine_1758347548138",
    [string]$GcsUri = "gs://demystifier-ai_cloudbuild/documents/",
    [string]$Bucket = "demystifier-ai_cloudbuild"
)

Write-Host "🚀 Starting complete RAG setup for Legal Document Demystifier..." -ForegroundColor Green
Write-Host "Project: $ProjectId" -ForegroundColor Yellow
Write-Host "Data Store: $DataStoreId" -ForegroundColor Yellow
Write-Host "GCS Source: $GcsUri" -ForegroundColor Yellow

# Set the current project
Write-Host "`n📋 Setting gcloud project..." -ForegroundColor Cyan
gcloud config set project $ProjectId

# Enable required APIs
Write-Host "`n🔌 Enabling required APIs..." -ForegroundColor Cyan
gcloud services enable discoveryengine.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable run.googleapis.com

# Get project number for service agent
Write-Host "`n🔍 Getting project details..." -ForegroundColor Cyan
$ProjectNumber = gcloud projects describe $ProjectId --format="value(projectNumber)"
$DeServiceAgent = "service-$ProjectNumber@gcp-sa-discoveryengine.iam.gserviceaccount.com"
Write-Host "Discovery Engine Service Agent: $DeServiceAgent" -ForegroundColor Yellow

# Grant Discovery Engine service agent read access to bucket
Write-Host "`n🔐 Granting Discovery Engine service agent read access to bucket..." -ForegroundColor Cyan
gsutil iam ch serviceAccount:$DeServiceAgent`:roles/storage.objectViewer gs://$Bucket

# Create the Data Store
Write-Host "`n📁 Creating Discovery Engine Data Store..." -ForegroundColor Cyan
$dataStoreResult = gcloud discovery-engine data-stores create $DataStoreId `
    --display-name="$DisplayName" `
    --location=$Location `
    --industry-vertical="GENERIC" `
    --solution-types="SOLUTION_TYPE_SEARCH" `
    --content-config="CONTENT_REQUIRED" `
    2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Data Store created successfully!" -ForegroundColor Green
} elseif ($dataStoreResult -like "*already exists*") {
    Write-Host "ℹ️  Data Store already exists, continuing..." -ForegroundColor Yellow
} else {
    Write-Host "❌ Failed to create Data Store: $dataStoreResult" -ForegroundColor Red
    exit 1
}

# Start the document import job
Write-Host "`n📚 Starting document import from GCS..." -ForegroundColor Cyan
$importOperation = gcloud discovery-engine documents import `
    --data-store=$DataStoreId `
    --location=$Location `
    --source-data-paths=$GcsUri `
    --data-format="CONTENT" `
    --import-method="INLINE" `
    --format="value(name)"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Document import job started!" -ForegroundColor Green
    Write-Host "Operation: $importOperation" -ForegroundColor Yellow
    Write-Host "Monitor with: gcloud discovery-engine operations describe $importOperation --location=$Location" -ForegroundColor Yellow
} else {
    Write-Host "❌ Failed to start document import" -ForegroundColor Red
    exit 1
}

# Get Cloud Run service account
Write-Host "`n🏃 Setting up Cloud Run IAM..." -ForegroundColor Cyan
$CloudRunSA = gcloud run services describe legal-backend --region=$Region --format="value(spec.template.spec.serviceAccountName)" 2>$null

if ([string]::IsNullOrEmpty($CloudRunSA)) {
    Write-Host "⚠️  Cloud Run service 'legal-backend' not found. Will use default compute SA." -ForegroundColor Yellow
    $CloudRunSA = "$ProjectNumber-compute@developer.gserviceaccount.com"
}

Write-Host "Cloud Run Service Account: $CloudRunSA" -ForegroundColor Yellow

# Grant Discovery Engine Viewer role to Cloud Run service account
Write-Host "`n🔐 Granting Discovery Engine Viewer role to Cloud Run service account..." -ForegroundColor Cyan
gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$CloudRunSA" `
    --role="roles/discoveryengine.viewer"

# Deploy/update Cloud Run with environment variables
Write-Host "`n🚀 Deploying Cloud Run with RAG configuration..." -ForegroundColor Cyan
$deployResult = gcloud run deploy legal-backend `
    --source . `
    --region $Region `
    --allow-unauthenticated `
    --set-env-vars RAG_ENABLE_FALLBACK=true `
    --set-env-vars RAG_ENGINE_PROJECT=$ProjectId `
    --set-env-vars RAG_ENGINE_LOCATION=$Location `
    --set-env-vars RAG_ENGINE_ID=$EngineId `
    --format="value(status.url)"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Cloud Run deployment successful!" -ForegroundColor Green
    $ServiceUrl = $deployResult.Trim()
    Write-Host "Service URL: $ServiceUrl" -ForegroundColor Yellow
    
    # Test the endpoints
    Write-Host "`n🧪 Testing RAG health endpoint..." -ForegroundColor Cyan
    Start-Sleep -Seconds 5  # Give service time to start
    
    try {
        $healthResponse = Invoke-RestMethod -Uri "$ServiceUrl/rag-health" -Method GET -TimeoutSec 30
        Write-Host "✅ RAG Health Check successful!" -ForegroundColor Green
        Write-Host ($healthResponse | ConvertTo-Json -Depth 3) -ForegroundColor Gray
    } catch {
        Write-Host "⚠️  RAG Health Check failed (service may still be starting): $_" -ForegroundColor Yellow
    }
    
    Write-Host "`n🧪 Testing RAG search endpoint..." -ForegroundColor Cyan
    try {
        $searchBody = @{
            query = "John Landlord"
            document_context = ""
        } | ConvertTo-Json
        
        $searchResponse = Invoke-RestMethod -Uri "$ServiceUrl/rag-search" -Method POST -Body $searchBody -ContentType "application/json" -TimeoutSec 30
        Write-Host "✅ RAG Search Test successful!" -ForegroundColor Green
        Write-Host "Query sanitized to: $($searchResponse.search_query)" -ForegroundColor Gray
        Write-Host "Results found: $($searchResponse.total_results)" -ForegroundColor Gray
        if ($searchResponse.note) {
            Write-Host "Note: $($searchResponse.note)" -ForegroundColor Gray
        }
    } catch {
        Write-Host "⚠️  RAG Search Test failed: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Cloud Run deployment failed" -ForegroundColor Red
    exit 1
}

# Summary and next steps
Write-Host "`n📋 SETUP SUMMARY" -ForegroundColor Green
Write-Host "=================" -ForegroundColor Green
Write-Host "✅ Data Store: $DataStoreId created in $Location" -ForegroundColor White
Write-Host "✅ Import Job: Started from $GcsUri" -ForegroundColor White
Write-Host "✅ IAM: Discovery Engine roles granted" -ForegroundColor White
Write-Host "✅ Cloud Run: Deployed with RAG fallback enabled" -ForegroundColor White
Write-Host "🌐 Service URL: $ServiceUrl" -ForegroundColor White

Write-Host "`n📋 NEXT STEPS" -ForegroundColor Cyan
Write-Host "=============" -ForegroundColor Cyan
Write-Host "1. Monitor import progress:" -ForegroundColor White
Write-Host "   gcloud discovery-engine operations describe $importOperation --location=$Location" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Once import completes, test your frontend:" -ForegroundColor White
Write-Host "   - Select text in a PDF" -ForegroundColor Gray
Write-Host "   - Should see real snippets from Discovery Engine" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Disable fallback after confirming real results:" -ForegroundColor White
Write-Host "   gcloud run services update legal-backend --region=$Region --set-env-vars RAG_ENABLE_FALLBACK=false" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Validate with endpoints:" -ForegroundColor White
Write-Host "   GET  $ServiceUrl/rag-health" -ForegroundColor Gray
Write-Host "   POST $ServiceUrl/rag-search" -ForegroundColor Gray
Write-Host "   POST $ServiceUrl/rag-test" -ForegroundColor Gray

Write-Host "`n🎉 RAG setup complete! Happy searching!" -ForegroundColor Green