# Legal Document Demystifier - Cloud Run Deployment Script (Windows)
# Project ID: demystifier-ai

$PROJECT_ID = "demystifier-ai"
$SERVICE_NAME = "legal-backend"
$REGION = "asia-south1"  # Mumbai region for India users
$IMAGE_NAME = "gcr.io/$PROJECT_ID/$SERVICE_NAME"

Write-Host "Deploying Legal Document Demystifier to Google Cloud Run..." -ForegroundColor Green

# Step 1: Check authentication
Write-Host "Checking authentication..." -ForegroundColor Yellow
$activeAccount = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>$null
if (-not $activeAccount) {
    Write-Host "Please authenticate with Google Cloud:" -ForegroundColor Red
    gcloud auth login
}

# Step 2: Set project
Write-Host "Setting project to $PROJECT_ID..." -ForegroundColor Yellow
gcloud config set project $PROJECT_ID

# Step 3: Enable required APIs
Write-Host "Enabling required APIs..." -ForegroundColor Yellow
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Step 4: Build and push the container
Write-Host "Building and pushing container image..." -ForegroundColor Yellow
gcloud builds submit --tag $IMAGE_NAME .

# Step 5: Deploy to Cloud Run
Write-Host "Deploying to Cloud Run..." -ForegroundColor Yellow
gcloud run deploy $SERVICE_NAME `
  --image $IMAGE_NAME `
  --platform managed `
  --region $REGION `
  --allow-unauthenticated `
  --memory 2Gi `
  --cpu 1 `
  --timeout 300 `
  --max-instances 10 `
  --set-env-vars="PROJECT_ID=$PROJECT_ID" `
  --set-env-vars="REGION=$REGION"

# Step 6: Get the service URL
Write-Host "Deployment complete!" -ForegroundColor Green
$SERVICE_URL = gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)'
Write-Host "Your API is available at: $SERVICE_URL" -ForegroundColor Cyan
Write-Host "Health check: $SERVICE_URL/health" -ForegroundColor Cyan
Write-Host "API docs: $SERVICE_URL/docs" -ForegroundColor Cyan

# Step 7: Test the deployment
Write-Host "Testing the deployment..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$SERVICE_URL/health" -Method GET -UseBasicParsing
    Write-Host "Health check passed!" -ForegroundColor Green
} catch {
    Write-Host "Health check failed: $_" -ForegroundColor Red
}

Write-Host "Deployment successful! Your Legal Document Demystifier API is now live!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "   1. Update your frontend to use: $SERVICE_URL" -ForegroundColor White
Write-Host "   2. Test document upload: $SERVICE_URL/analyze-document" -ForegroundColor White
Write-Host "   3. Test text analysis: $SERVICE_URL/analyze-text" -ForegroundColor White