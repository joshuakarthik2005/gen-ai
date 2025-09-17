# Google Cloud API Setup Script
# Run these commands in Google Cloud Shell or with gcloud CLI installed

# 1. Enable required APIs
gcloud services enable aiplatform.googleapis.com
gcloud services enable ml.googleapis.com
gcloud services enable compute.googleapis.com

# 2. Check if Vertex AI is available in your region
gcloud ai models list --region=us-central1

# 3. Alternative: Try different regions
# For India users, these regions might work better:
gcloud ai models list --region=asia-south1
gcloud ai models list --region=asia-southeast1
gcloud ai models list --region=us-east1

# 4. Check your project's billing status
gcloud billing projects describe demystifier-ai

# 5. Verify your service account has the right permissions
gcloud projects add-iam-policy-binding demystifier-ai \
    --member="serviceAccount:backend-service-account@demystifier-ai.iam.gserviceaccount.com" \
    --role="roles/aiplatform.user"

gcloud projects add-iam-policy-binding demystifier-ai \
    --member="serviceAccount:backend-service-account@demystifier-ai.iam.gserviceaccount.com" \
    --role="roles/ml.developer"