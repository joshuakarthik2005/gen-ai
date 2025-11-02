# 🔑 Configuration Guide - All Required Keys

This document lists ALL API keys and environment variables needed to run the Legal Document Demystifier application.

---

## ✅ Keys You Have

### 1. Adobe PDF Embed API Key
- **Key**: `42dca80537eb431cad94af71101d769d`
- **Status**: ✅ Already configured
- **Location**: `frontend/.env.local`
- **Variable**: `NEXT_PUBLIC_ADOBE_CLIENT_ID`
- **Purpose**: Displays PDFs in the browser with interactive features
- **How to verify**: Check Adobe Console → Document Services → Credentials

---

## 🔍 Keys You Need

### 2. Google Cloud Project ID
- **Current Value**: `demystifier-ai`
- **Required**: ✅ Yes
- **Where to find**: [Google Cloud Console](https://console.cloud.google.com) → Project dropdown
- **Purpose**: Identifies your Google Cloud project

### 3. Google Cloud Service Account
- **Required**: ✅ Yes
- **How to get**:
  1. Go to [Google Cloud Console](https://console.cloud.google.com)
  2. Navigate to: IAM & Admin → Service Accounts
  3. Find service account: `144935064473-compute@developer.gserviceaccount.com`
  4. Download JSON key file
  5. Set environment variable: `GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json`

- **Required Roles**:
  - ✅ Vertex AI User
  - ✅ Storage Admin (or Storage Object Admin)
  - ✅ Discovery Engine Editor

### 4. JWT Secret Key
- **Current**: `your-secret-key-change-in-production`
- **Status**: ⚠️ MUST CHANGE FOR PRODUCTION
- **Generate new key**:
  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(32))"
  ```
- **Purpose**: Signs authentication tokens
- **Security**: Keep this secret!

### 5. Google Cloud Storage Bucket
- **Current**: `demystifier-ai_cloudbuild`
- **Status**: ✅ Already configured
- **Purpose**: Stores user data and uploaded documents
- **Verify**: [GCS Console](https://console.cloud.google.com/storage)

### 6. Vertex AI (Gemini) Configuration
- **Status**: ✅ Configured via Google Cloud authentication
- **Model**: `gemini-1.5-flash-002`
- **No additional keys needed** - uses service account
- **Verify**:
  ```bash
  gcloud auth application-default login
  ```

### 7. Discovery Engine (RAG) Configuration
- **Project**: `demystifier-ai`
- **Location**: `global`
- **Engine ID**: `synapseragengine_1758347548138`
- **Serving Config**: `default_config`
- **Status**: ✅ Already configured
- **Purpose**: Powers RAG search across documents
- **Verify**: [Discovery Engine Console](https://console.cloud.google.com/gen-app-builder)

---

## 📋 Configuration Checklist

### Frontend Configuration (`frontend/.env.local`)
```bash
# ✅ Configured
NEXT_PUBLIC_ADOBE_CLIENT_ID=42dca80537eb431cad94af71101d769d

# ✅ Already set
NEXT_PUBLIC_API_URL=https://legal-backend-144935064473.asia-south1.run.app

# Optional (for demo)
NEXT_PUBLIC_DEMO_EMAIL=demo@example.com
NEXT_PUBLIC_DEMO_PASSWORD=demo123
```

### Backend Configuration (`backend/.env`)
```bash
# Google Cloud
GOOGLE_CLOUD_PROJECT=demystifier-ai
PORT=8080

# Authentication - ⚠️ CHANGE THIS
JWT_SECRET_KEY=your-secret-key-change-in-production

# Google Cloud Storage
USERS_BUCKET=demystifier-ai_cloudbuild
USERS_PREFIX=users

# RAG Engine
RAG_ENGINE_PROJECT=demystifier-ai
RAG_ENGINE_LOCATION=global
RAG_ENGINE_ID=synapseragengine_1758347548138
RAG_SERVING_CONFIG_NAME=default_config

# Optional
RAG_ENABLE_FALLBACK=true
RAG_ALLOW_MOCK=false
STRICT_USER_ISOLATION=true
```

### System Environment (for local development)
```bash
# Google Cloud Authentication
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

---

## 🚀 Quick Setup Steps

### 1. Frontend Setup
```powershell
cd frontend

# Copy example to actual env file
Copy-Item .env.example .env.local

# Edit .env.local and verify Adobe key is set
# ✅ Already done: NEXT_PUBLIC_ADOBE_CLIENT_ID=42dca80537eb431cad94af71101d769d
```

### 2. Backend Setup
```powershell
cd backend

# Copy example to actual env file
Copy-Item .env.example .env

# Edit .env and update JWT_SECRET_KEY
# Generate new key:
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 3. Google Cloud Authentication (Local Development)
```powershell
# Option 1: Use gcloud CLI (recommended)
gcloud auth application-default login
gcloud config set project demystifier-ai

# Option 2: Use service account key file
# Download key from: https://console.cloud.google.com/iam-admin/serviceaccounts
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\service-account-key.json"
```

### 4. Verify Configuration
```powershell
# Backend
cd backend
python -c "import os; print('Project:', os.getenv('GOOGLE_CLOUD_PROJECT', 'NOT SET'))"

# Frontend
cd frontend
npm run dev
# Check browser console for Adobe key confirmation
```

---

## 🔐 Adobe PDF Embed Setup

### What You Have
- **Client ID**: `42dca80537eb431cad94af71101d769d`
- **Status**: ✅ Active

### Additional Adobe Configuration Required

1. **Add Allowed Domains** to Adobe Console:
   - Go to: [Adobe Developer Console](https://developer.adobe.com/console)
   - Select your project
   - Add these domains:
     - `http://localhost:3000` (for local dev)
     - `https://your-production-domain.com` (for production)
     - `https://legal-frontend-144935064473.asia-south1.run.app` (if using Cloud Run)

2. **Verify API Access**:
   - Ensure "PDF Embed API" is enabled in your Adobe project
   - Check usage limits (free tier: 50,000 document transactions/year)

---

## 🔧 Optional Keys (Not Currently Required)

### For Future Enhancements

**Email Notifications (if adding reminder feature)**:
- SendGrid API Key
- AWS SES credentials
- Gmail OAuth credentials

**SMS Notifications**:
- Twilio Account SID & Auth Token
- AWS SNS credentials

**Calendar Integration (bidirectional)**:
- Google Calendar API credentials
- Microsoft Graph API credentials

**Analytics**:
- Google Analytics ID
- Mixpanel token

---

## 🐛 Troubleshooting

### Adobe PDF not loading
**Check**:
1. Adobe key is in `.env.local`: `NEXT_PUBLIC_ADOBE_CLIENT_ID=42dca80537eb431cad94af71101d769d`
2. Domain is whitelisted in Adobe Console
3. Browser console for errors

**Fix**:
```powershell
# Restart Next.js dev server
cd frontend
npm run dev
```

### Backend authentication errors
**Check**:
1. Google Cloud credentials are set
2. Service account has correct roles
3. JWT_SECRET_KEY is set in `.env`

**Fix**:
```powershell
gcloud auth application-default login
gcloud config set project demystifier-ai
```

### RAG search not working
**Check**:
1. Discovery Engine ID is correct
2. Service account has Discovery Engine Editor role
3. RAG engine is deployed

**Verify**:
```powershell
cd backend
python test_rag.py
```

---

## 📊 Key Summary Table

| Key/Config | Status | Required | Location |
|-----------|--------|----------|----------|
| Adobe PDF Embed | ✅ Set | Yes | `frontend/.env.local` |
| Google Cloud Project | ✅ Set | Yes | Backend env |
| Service Account | ⚠️ Verify | Yes | System env |
| JWT Secret | ⚠️ Change | Yes | `backend/.env` |
| GCS Bucket | ✅ Set | Yes | Backend env |
| Vertex AI | ✅ Ready | Yes | Via service account |
| Discovery Engine | ✅ Set | Yes | Backend env |
| Backend URL | ✅ Set | Yes | Frontend env |

**Legend**:
- ✅ Already configured and working
- ⚠️ Needs attention (change default value or verify)
- ❌ Missing (needs to be set)

---

## 🎯 Priority Actions

### Immediate (Before Testing)
1. ✅ Adobe key is set (DONE)
2. ⚠️ Generate new JWT secret key
3. ⚠️ Verify Google Cloud authentication

### Before Production Deployment
1. ⚠️ Change JWT_SECRET_KEY to production value
2. ⚠️ Add production domain to Adobe Console
3. ✅ Verify all service account permissions
4. ✅ Test all features end-to-end

---

## 📞 Getting More Keys

### Adobe PDF Embed API
- URL: https://developer.adobe.com/console
- Free tier: 50,000 transactions/year
- You already have: `42dca80537eb431cad94af71101d769d`

### Google Cloud
- Console: https://console.cloud.google.com
- Project: `demystifier-ai`
- Service Account: Available in IAM section

### Need Help?
- Adobe Support: https://developer.adobe.com/support
- Google Cloud Support: https://cloud.google.com/support
- Documentation: Check README.md files

---

**Last Updated**: November 2, 2025  
**Status**: Adobe key configured ✅, Other keys ready ✅
