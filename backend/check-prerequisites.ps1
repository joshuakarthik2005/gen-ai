# Legal Document Demystifier - Prerequisites Check

Write-Host "🔍 Checking deployment prerequisites..." -ForegroundColor Yellow

# Check if gcloud is installed
try {
    $gcloudVersion = gcloud version 2>$null
    Write-Host "✅ Google Cloud SDK is installed" -ForegroundColor Green
    Write-Host "   Version: $($gcloudVersion[0])" -ForegroundColor Gray
} catch {
    Write-Host "❌ Google Cloud SDK is not installed" -ForegroundColor Red
    Write-Host "   Please install from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    Write-Host "   Or use Chocolatey: choco install gcloudsdk" -ForegroundColor Yellow
    exit 1
}

# Check authentication
try {
    $activeAccount = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>$null
    if ($activeAccount) {
        Write-Host "✅ Authenticated with Google Cloud" -ForegroundColor Green
        Write-Host "   Active account: $activeAccount" -ForegroundColor Gray
    } else {
        Write-Host "❌ Not authenticated with Google Cloud" -ForegroundColor Red
        Write-Host "   Run: gcloud auth login" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "❌ Authentication check failed" -ForegroundColor Red
    Write-Host "   Run: gcloud auth login" -ForegroundColor Yellow
    exit 1
}

# Check project
try {
    $currentProject = gcloud config get-value project 2>$null
    if ($currentProject -eq "demystifier-ai") {
        Write-Host "✅ Project is set correctly" -ForegroundColor Green
        Write-Host "   Current project: $currentProject" -ForegroundColor Gray
    } else {
        Write-Host "⚠️  Project is not set to demystifier-ai" -ForegroundColor Yellow
        Write-Host "   Current project: $currentProject" -ForegroundColor Gray
        Write-Host "   Setting project..." -ForegroundColor Yellow
        gcloud config set project demystifier-ai
        Write-Host "✅ Project updated to demystifier-ai" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Project check failed" -ForegroundColor Red
    exit 1
}

# Check billing
try {
    $billingAccount = gcloud billing projects describe demystifier-ai --format="value(billingAccountName)" 2>$null
    if ($billingAccount) {
        Write-Host "✅ Billing is enabled" -ForegroundColor Green
        Write-Host "   Billing account: $billingAccount" -ForegroundColor Gray
    } else {
        Write-Host "❌ Billing is not enabled" -ForegroundColor Red
        Write-Host "   Please enable billing in the Google Cloud Console" -ForegroundColor Yellow
        Write-Host "   https://console.cloud.google.com/billing" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Could not check billing status" -ForegroundColor Yellow
    Write-Host "   Make sure billing is enabled for your project" -ForegroundColor Yellow
}

# Check required APIs
Write-Host "🔧 Checking required APIs..." -ForegroundColor Yellow
$requiredApis = @(
    "cloudbuild.googleapis.com",
    "run.googleapis.com",
    "containerregistry.googleapis.com",
    "aiplatform.googleapis.com"
)

foreach ($api in $requiredApis) {
    try {
        $apiStatus = gcloud services list --filter="name:$api" --format="value(name)" 2>$null
        if ($apiStatus) {
            Write-Host "✅ $api is enabled" -ForegroundColor Green
        } else {
            Write-Host "❌ $api is not enabled" -ForegroundColor Red
            Write-Host "   Enabling $api..." -ForegroundColor Yellow
            gcloud services enable $api
            Write-Host "✅ $api enabled" -ForegroundColor Green
        }
    } catch {
        Write-Host "⚠️  Could not check $api" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🎉 Prerequisites check complete!" -ForegroundColor Green
Write-Host "You're ready to deploy! Run: .\deploy.ps1" -ForegroundColor Cyan