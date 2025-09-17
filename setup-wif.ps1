# Setup Workload Identity Federation for GitHub Actions
# Run this script to create the necessary WIF configuration

$PROJECT_ID = "demystifier-ai"
$POOL_ID = "github-pool"
$PROVIDER_ID = "github-provider"
$SERVICE_ACCOUNT_NAME = "github-actions-deployer"
$REPO = "joshuakarthik2005/gen-ai"

Write-Host "Setting up Workload Identity Federation for project: $PROJECT_ID"

# Get project number
$PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format="value(projectNumber)"
Write-Host "Project Number: $PROJECT_NUMBER"

# Enable required APIs
Write-Host "Enabling required APIs..."
gcloud services enable iamcredentials.googleapis.com --project=$PROJECT_ID
gcloud services enable cloudresourcemanager.googleapis.com --project=$PROJECT_ID
gcloud services enable iam.googleapis.com --project=$PROJECT_ID

# Create service account if it doesn't exist
Write-Host "Creating service account..."
gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME --project=$PROJECT_ID --display-name="GitHub Actions Deployer" --description="Service account for GitHub Actions CI/CD"
if ($LASTEXITCODE -ne 0) { Write-Host "Service account may already exist" }

# Grant necessary roles to the service account
Write-Host "Granting roles to service account..."
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" --role="roles/run.developer"
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" --role="roles/storage.admin"
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" --role="roles/artifactregistry.admin"

# Create Workload Identity Pool
Write-Host "Creating Workload Identity Pool..."
gcloud iam workload-identity-pools create $POOL_ID --project=$PROJECT_ID --location="global" --display-name="GitHub Pool" --description="Pool for GitHub Actions"
if ($LASTEXITCODE -ne 0) { Write-Host "Pool may already exist" }

# Create Workload Identity Provider
Write-Host "Creating Workload Identity Provider..."
gcloud iam workload-identity-pools providers create-oidc $PROVIDER_ID --project=$PROJECT_ID --location="global" --workload-identity-pool=$POOL_ID --display-name="GitHub Provider" --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" --issuer-uri="https://token.actions.githubusercontent.com"
if ($LASTEXITCODE -ne 0) { Write-Host "Provider may already exist" }

# Allow the GitHub repository to impersonate the service account
Write-Host "Setting up impersonation..."
gcloud iam service-accounts add-iam-policy-binding "${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" --project=$PROJECT_ID --role="roles/iam.workloadIdentityUser" --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${REPO}"

Write-Host ""
Write-Host "=== GITHUB SECRETS TO SET ===" -ForegroundColor Green
Write-Host "GCP_PROJECT_ID: $PROJECT_ID" -ForegroundColor Yellow
Write-Host "GCP_SERVICE_ACCOUNT: ${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" -ForegroundColor Yellow
Write-Host "GCP_WIF_PROVIDER: projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}" -ForegroundColor Yellow
Write-Host ""
Write-Host "Please set these values in your GitHub repository secrets!" -ForegroundColor Green