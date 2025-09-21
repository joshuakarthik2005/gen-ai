# Verification script for Vertex AI Data Store creation
# Run this after creating the data store via console

Write-Host "=== Verifying Vertex AI Data Store Setup ===" -ForegroundColor Green

# 1. Check if Discovery Engine service account was created
Write-Host "`n1. Checking Discovery Engine service account..." -ForegroundColor Yellow
gcloud iam service-accounts list --filter="email~discoveryengine" --format="table(displayName,email)"

# 2. Verify the data store was created
Write-Host "`n2. Listing Discovery Engine data stores..." -ForegroundColor Yellow
gcloud alpha discovery-engine data-stores list --location=global --format="table(displayName,name)"

# 3. Test RAG health endpoint
Write-Host "`n3. Testing RAG health endpoint..." -ForegroundColor Yellow
$response = Invoke-WebRequest -Uri "https://legal-backend-144935064473.asia-south1.run.app/rag-health" -Method GET
Write-Host "Status: $($response.StatusCode)"
Write-Host "Response: $($response.Content)"

# 4. Test a simple RAG search
Write-Host "`n4. Testing RAG search..." -ForegroundColor Yellow
$body = @{ query = "landlord tenant" } | ConvertTo-Json
try {
    $response = Invoke-WebRequest -Uri "https://legal-backend-144935064473.asia-south1.run.app/rag-search" -Method POST -Body $body -ContentType "application/json"
    Write-Host "Status: $($response.StatusCode)"
    $content = $response.Content | ConvertFrom-Json
    Write-Host "Found $($content.Count) snippets"
    if ($content.Count -gt 0) {
        Write-Host "First snippet: $($content[0].text.Substring(0, [Math]::Min(100, $content[0].text.Length)))..."
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Verification Complete ===" -ForegroundColor Green