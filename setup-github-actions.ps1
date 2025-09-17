# GitHub Actions Setup Helper Script for Legal Document Demystifier
# This script helps you set up the GCP_SA_KEY GitHub secret

Write-Host "=== GitHub Actions Setup Helper ===" -ForegroundColor Green
Write-Host "This script will help you set up GitHub Actions for automatic deployment." -ForegroundColor White
Write-Host ""

# Check if service account key exists
$ServiceKeyPath = "backend\service-account-key.json"

if (-not (Test-Path $ServiceKeyPath)) {
    Write-Host "❌ Error: Service account key not found at $ServiceKeyPath" -ForegroundColor Red
    Write-Host "Please ensure the service account key file exists in the backend directory." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Found service account key file" -ForegroundColor Green
Write-Host ""

Write-Host "=== Instructions to Set Up GitHub Secret ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Copy the service account key content:" -ForegroundColor Cyan
Write-Host "   The key content will be displayed below. Copy it entirely." -ForegroundColor White
Write-Host ""
Write-Host "2. Go to your GitHub repository:" -ForegroundColor Cyan
Write-Host "   https://github.com/joshuakarthik2005/gen-ai" -ForegroundColor Blue
Write-Host ""
Write-Host "3. Navigate to Settings > Secrets and variables > Actions" -ForegroundColor Cyan
Write-Host ""
Write-Host "4. Click 'New repository secret'" -ForegroundColor Cyan
Write-Host ""
Write-Host "5. Create a secret with:" -ForegroundColor Cyan
Write-Host "   - Name: GCP_SA_KEY" -ForegroundColor White
Write-Host "   - Secret: (paste the content below)" -ForegroundColor White
Write-Host ""
Write-Host "6. Save the secret" -ForegroundColor Cyan
Write-Host ""
Write-Host "=== SERVICE ACCOUNT KEY CONTENT ===" -ForegroundColor Yellow
Write-Host "Copy everything between the lines below:" -ForegroundColor White
Write-Host "----------------------------------------" -ForegroundColor DarkGray
Get-Content $ServiceKeyPath | Write-Host
Write-Host "----------------------------------------" -ForegroundColor DarkGray
Write-Host ""
Write-Host "✅ After setting up the GitHub secret, commit and push your changes." -ForegroundColor Green
Write-Host "✅ GitHub Actions will automatically deploy your backend to Cloud Run!" -ForegroundColor Green

# Also copy to clipboard for convenience
try {
    Get-Content $ServiceKeyPath | Set-Clipboard
    Write-Host ""
    Write-Host "🎉 Service account key has been copied to your clipboard!" -ForegroundColor Magenta
} catch {
    Write-Host ""
    Write-Host "ℹ️ Manual copy required - clipboard not available" -ForegroundColor Yellow
}