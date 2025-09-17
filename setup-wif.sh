#!/bin/bash

# Setup Workload Identity Federation for GitHub Actions
# Run this script to create the necessary WIF configuration

set -e

PROJECT_ID="demystifier-ai"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
POOL_ID="github-pool"
PROVIDER_ID="github-provider"
SERVICE_ACCOUNT_NAME="github-actions-deployer"
REPO="joshuakarthik2005/gen-ai"

echo "Setting up Workload Identity Federation for project: $PROJECT_ID"
echo "Project Number: $PROJECT_NUMBER"

# Enable required APIs
echo "Enabling required APIs..."
gcloud services enable iamcredentials.googleapis.com --project=$PROJECT_ID
gcloud services enable cloudresourcemanager.googleapis.com --project=$PROJECT_ID
gcloud services enable iam.googleapis.com --project=$PROJECT_ID

# Create service account if it doesn't exist
echo "Creating service account..."
gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
    --project=$PROJECT_ID \
    --display-name="GitHub Actions Deployer" \
    --description="Service account for GitHub Actions CI/CD" || echo "Service account may already exist"

# Grant necessary roles to the service account
echo "Granting roles to service account..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/run.developer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/artifactregistry.admin"

# Create Workload Identity Pool
echo "Creating Workload Identity Pool..."
gcloud iam workload-identity-pools create $POOL_ID \
    --project=$PROJECT_ID \
    --location="global" \
    --display-name="GitHub Pool" \
    --description="Pool for GitHub Actions" || echo "Pool may already exist"

# Create Workload Identity Provider
echo "Creating Workload Identity Provider..."
gcloud iam workload-identity-pools providers create-oidc $PROVIDER_ID \
    --project=$PROJECT_ID \
    --location="global" \
    --workload-identity-pool=$POOL_ID \
    --display-name="GitHub Provider" \
    --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
    --issuer-uri="https://token.actions.githubusercontent.com" || echo "Provider may already exist"

# Allow the GitHub repository to impersonate the service account
echo "Setting up impersonation..."
gcloud iam service-accounts add-iam-policy-binding \
    "${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --project=$PROJECT_ID \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${REPO}"

echo ""
echo "=== GITHUB SECRETS TO SET ==="
echo "GCP_PROJECT_ID: $PROJECT_ID"
echo "GCP_SERVICE_ACCOUNT: ${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
echo "GCP_WIF_PROVIDER: projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}"
echo ""
echo "Please set these values in your GitHub repository secrets!"