# Deployment Guide

## Current Deployment URLs

- **Backend**: https://legal-backend-144935064473.asia-south1.run.app
- **Frontend**: https://legal-frontend-uawpzg4rzq-el.a.run.app

## Quick Deployment

### Backend Deployment (to Cloud Run)

```powershell
# Navigate to backend folder
cd gen-ai\backend

# Deploy using the existing deployment script
.\deploy.ps1

# Or manually with gcloud:
gcloud run deploy legal-backend `
  --source . `
  --platform managed `
  --region asia-south1 `
  --allow-unauthenticated `
  --set-env-vars "GOOGLE_CLOUD_PROJECT=demystifier-ai,GOOGLE_CLOUD_LOCATION=asia-south1,RAG_ENGINE_PROJECT=demystifier-ai,RAG_ENGINE_LOCATION=global,RAG_ENGINE_ID=synapseragengine_1758347548138"
```

### Frontend Deployment (to Cloud Run)

```powershell
# Navigate to frontend folder
cd gen-ai\frontend

# Build the Next.js app
npm run build

# Deploy to Cloud Run
gcloud run deploy legal-frontend `
  --source . `
  --platform managed `
  --region us-east1 `
  --allow-unauthenticated `
  --set-env-vars "NEXT_PUBLIC_API_URL=https://legal-backend-144935064473.asia-south1.run.app"
```

## Environment Configuration

### Backend (.env)
Already configured in `backend/.env`:
- `GOOGLE_CLOUD_PROJECT=demystifier-ai`
- `GOOGLE_CLOUD_LOCATION=asia-south1`
- `RAG_ENGINE_PROJECT=demystifier-ai`
- `RAG_ENGINE_LOCATION=global`
- `RAG_ENGINE_ID=synapseragengine_1758347548138`

### Frontend (.env.production)
Created in `frontend/.env.production`:
- `NEXT_PUBLIC_API_URL=https://legal-backend-144935064473.asia-south1.run.app`

## Testing Deployed Backend

Test the deployed backend:
```powershell
# Health check
curl https://legal-backend-144935064473.asia-south1.run.app/health

# Login
curl -X POST https://legal-backend-144935064473.asia-south1.run.app/login `
  -H "Content-Type: application/json" `
  -d '{"email":"demo@example.com","password":"demo123"}'
```

## Local Development vs Production

### Local Development
- Backend: `http://localhost:8000` (run `api.py`)
- Frontend: `http://localhost:3000` (run `npm run dev`)
- Use `.env.local` with localhost URLs

### Production
- Backend: `https://legal-backend-144935064473.asia-south1.run.app`
- Frontend: `https://legal-frontend-uawpzg4rzq-el.a.run.app`
- Use `.env.production` with deployed URLs

## Switch Between Local and Deployed

### To use deployed backend locally:
```powershell
# In frontend/.env.local, set:
NEXT_PUBLIC_API_URL=https://legal-backend-144935064473.asia-south1.run.app

# Restart frontend
npm run dev
```

### To use local backend:
```powershell
# In frontend/.env.local, set:
NEXT_PUBLIC_API_URL=http://localhost:8000

# Start backend
cd backend
venv\Scripts\python.exe api.py

# Restart frontend
npm run dev
```

## Deployment Checklist

### Before Deploying Backend:
- ✅ bcrypt version fixed to 4.0.1
- ✅ Demo users initialized on startup
- ✅ All endpoints working locally
- ✅ Environment variables configured
- ✅ Service account key in place (if needed)

### Before Deploying Frontend:
- ✅ `.env.production` created with deployed backend URL
- ✅ `npm run build` succeeds locally
- ✅ All API calls use `process.env.NEXT_PUBLIC_API_URL`
- ✅ No hardcoded localhost URLs

### After Deployment:
- ✅ Test health endpoint
- ✅ Test login with demo credentials
- ✅ Test file upload
- ✅ Test RAG search
- ✅ Check CORS settings

## Troubleshooting

### Backend Issues:
- Check Cloud Run logs: `gcloud run logs read legal-backend --region asia-south1`
- Verify environment variables in Cloud Run console
- Ensure service account has necessary permissions

### Frontend Issues:
- Check if API URL is correct in browser console
- Verify CORS is enabled on backend
- Check Cloud Run logs for frontend

### CORS Issues:
Backend `api.py` already has CORS configured:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Redeployment

To redeploy with latest changes:

```powershell
# Backend
cd gen-ai\backend
gcloud run deploy legal-backend --source . --region asia-south1

# Frontend
cd gen-ai\frontend
gcloud run deploy legal-frontend --source . --region us-east1
```

## Monitoring

- Backend logs: https://console.cloud.google.com/run/detail/asia-south1/legal-backend/logs
- Frontend logs: https://console.cloud.google.com/run/detail/us-east1/legal-frontend/logs
- Backend metrics: Check Cloud Run console for request count, latency, etc.
