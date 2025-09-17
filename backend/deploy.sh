#!/bin/bash

# Legal Document Demystifier - Cloud Run Deployment Script
# Project ID: demystifier-ai

set -e

PROJECT_ID="demystifier-ai"
SERVICE_NAME="legal-backend"
REGION="asia-south1"  # Mumbai region for India users
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "🚀 Deploying Legal Document Demystifier to Google Cloud Run..."

# Step 1: Authenticate (if not already done)
echo "📝 Checking authentication..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "Please authenticate with Google Cloud:"
    gcloud auth login
fi

# Step 2: Set project
echo "📋 Setting project to ${PROJECT_ID}..."
gcloud config set project ${PROJECT_ID}

# Step 3: Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Step 4: Build and push the container
echo "🏗️  Building and pushing container image..."
gcloud builds submit --tag ${IMAGE_NAME} .

# Step 5: Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10 \
  --set-env-vars="PROJECT_ID=${PROJECT_ID}" \
  --set-env-vars="REGION=${REGION}"

# Step 6: Get the service URL
echo "✅ Deployment complete!"
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region=${REGION} --format='value(status.url)')
echo "🌐 Your API is available at: ${SERVICE_URL}"
echo "🔍 Health check: ${SERVICE_URL}/health"
echo "📚 API docs: ${SERVICE_URL}/docs"

# Step 7: Test the deployment
echo "🧪 Testing the deployment..."
curl -f "${SERVICE_URL}/health" || echo "❌ Health check failed"

echo "🎉 Deployment successful! Your Legal Document Demystifier API is now live!"
echo ""
echo "💡 Next steps:"
echo "   1. Update your frontend to use: ${SERVICE_URL}"
echo "   2. Test document upload: ${SERVICE_URL}/analyze-document"
echo "   3. Test text analysis: ${SERVICE_URL}/analyze-text"