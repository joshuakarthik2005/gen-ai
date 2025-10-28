# Deploy Frontend to Cloud Run
# This script deploys the Next.js frontend to Google Cloud Run

Write-Host "Deploying Frontend to Cloud Run..." -ForegroundColor Cyan

# Configuration
$PROJECT_ID = "demystifier-ai"
$SERVICE_NAME = "legal-frontend"
$REGION = "us-east1"
$BACKEND_URL = "https://legal-backend-144935064473.asia-south1.run.app"

# Set the project
Write-Host "Setting GCP project to $PROJECT_ID..." -ForegroundColor Yellow
gcloud config set project $PROJECT_ID

# Build and deploy
Write-Host "Building and deploying frontend..." -ForegroundColor Yellow
gcloud run deploy $SERVICE_NAME `
  --source . `
  --platform managed `
  --region $REGION `
  --allow-unauthenticated `
  --set-env-vars "NEXT_PUBLIC_API_URL=$BACKEND_URL" `
  --memory 512Mi `
  --cpu 1 `
  --timeout 300 `
  --max-instances 10

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✓ Deployment successful!" -ForegroundColor Green
    Write-Host "Frontend URL: https://legal-frontend-uawpzg4rzq-el.a.run.app" -ForegroundColor Cyan
} else {
    Write-Host "`n✗ Deployment failed!" -ForegroundColor Red
    exit 1
}
