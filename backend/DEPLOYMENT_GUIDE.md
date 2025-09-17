# Legal Document Demystifier - Cloud Run Deployment Guide

## Prerequisites

### 1. Install Google Cloud SDK

Download and install from: https://cloud.google.com/sdk/docs/install

**For Windows:**
1. Download the installer: https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe
2. Run the installer
3. Follow the setup wizard
4. Restart your terminal/PowerShell

**Alternative - Using Chocolatey:**
```powershell
# Install Chocolatey first (if not installed)
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install Google Cloud SDK
choco install gcloudsdk
```

### 2. Authenticate with Google Cloud

After installing gcloud, authenticate:

```powershell
# Login to Google Cloud
gcloud auth login

# Set your project
gcloud config set project demystifier-ai

# Verify authentication
gcloud auth list
```

## Deployment Steps

### Method 1: Automatic Deployment (Recommended)

1. **Navigate to backend directory:**
   ```powershell
   cd "c:\Users\joshua karthik\OneDrive\Desktop\gen-ai\backend"
   ```

2. **Run the deployment script:**
   ```powershell
   # Make sure you're in the backend directory
   .\deploy.ps1
   ```

### Method 2: Manual Deployment

1. **Enable required APIs:**
   ```powershell
   gcloud services enable cloudbuild.googleapis.com
   gcloud services enable run.googleapis.com
   gcloud services enable containerregistry.googleapis.com
   ```

2. **Build and push the container:**
   ```powershell
   cd "c:\Users\joshua karthik\OneDrive\Desktop\gen-ai\backend"
   gcloud builds submit --tag gcr.io/demystifier-ai/legal-backend
   ```

3. **Deploy to Cloud Run:**
   ```powershell
   gcloud run deploy legal-backend `
     --image gcr.io/demystifier-ai/legal-backend `
     --platform managed `
     --region asia-south1 `
     --allow-unauthenticated `
     --memory 2Gi `
     --cpu 1 `
     --timeout 300 `
     --max-instances 10
   ```

4. **Get your service URL:**
   ```powershell
   gcloud run services describe legal-backend --region=asia-south1 --format='value(status.url)'
   ```

## Important Notes

### Authentication for Cloud Run

Your Cloud Run service will automatically use the default service account for Vertex AI authentication. However, you need to ensure the service account has the necessary permissions:

```powershell
# Grant Vertex AI User role to the compute service account
gcloud projects add-iam-policy-binding demystifier-ai --member="serviceAccount:123456789-compute@developer.gserviceaccount.com" --role="roles/aiplatform.user"

# Grant ML Developer role
gcloud projects add-iam-policy-binding demystifier-ai --member="serviceAccount:123456789-compute@developer.gserviceaccount.com" --role="roles/ml.developer"
```

**To find your compute service account:**
```powershell
gcloud iam service-accounts list
```

### Environment Variables

The deployment script automatically sets these environment variables:
- `PROJECT_ID=demystifier-ai`
- `REGION=asia-south1`

### Expected Output

After successful deployment, you'll get a URL like:
```
https://legal-backend-abc123-as.a.run.app
```

### Testing Your Deployment

1. **Health Check:**
   ```powershell
   curl https://your-service-url/health
   ```

2. **API Documentation:**
   Visit: `https://your-service-url/docs`

3. **Test Text Analysis:**
   ```powershell
   curl -X POST "https://your-service-url/analyze-text" -H "Content-Type: application/json" -d '{"text": "This is a sample legal contract..."}'
   ```

## Troubleshooting

### Common Issues:

1. **Permission Denied:** Ensure billing is enabled on your project
2. **API Not Enabled:** Run the enable services commands
3. **Authentication Issues:** Check that your service account has proper roles
4. **Build Timeouts:** Increase build timeout if needed

### Monitoring

View logs:
```powershell
gcloud logs tail --follow --resource-type cloud_run_revision --resource-name legal-backend
```

View service details:
```powershell
gcloud run services describe legal-backend --region=asia-south1
```

## Security Considerations

1. **Never commit service account keys** to the repository
2. **Use IAM roles** instead of service account keys for Cloud Run
3. **Enable Cloud Armor** for DDoS protection in production
4. **Implement rate limiting** for the API endpoints

## Next Steps

After deployment:
1. Update your frontend to use the Cloud Run URL
2. Set up custom domain (optional)
3. Configure monitoring and alerting
4. Set up CI/CD pipeline for automatic deployments