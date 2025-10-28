# Test script for deployed backend
# Wait for CI/CD to complete, then test authentication

$BACKEND_URL = "https://legal-backend-144935064473.asia-south1.run.app"

Write-Host "Testing deployed backend at: $BACKEND_URL" -ForegroundColor Cyan
Write-Host ""

# Test health endpoint
Write-Host "1. Testing health endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BACKEND_URL/" -Method Get
    Write-Host "   ✅ Backend is running!" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Backend unreachable: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "2. Testing login with demo user..." -ForegroundColor Yellow

$loginBody = @{
    email = "demo@example.com"
    password = "demo123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$BACKEND_URL/login" -Method Post -Body $loginBody -ContentType "application/json"
    Write-Host "   ✅ Login successful!" -ForegroundColor Green
    Write-Host "   User: $($loginResponse.user.email)" -ForegroundColor Green
    Write-Host "   Token: $($loginResponse.access_token.Substring(0, 20))..." -ForegroundColor Green
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errorMessage = $_.ErrorDetails.Message
    Write-Host "   ❌ Login failed with status $statusCode" -ForegroundColor Red
    Write-Host "   Error: $errorMessage" -ForegroundColor Red
    
    if ($statusCode -eq 401) {
        Write-Host ""
        Write-Host "   ⚠️  This might be the bcrypt issue. Wait for CI/CD to complete!" -ForegroundColor Yellow
        Write-Host "   Check deployment: https://github.com/joshuakarthik2005/gen-ai/actions" -ForegroundColor Yellow
    }
    exit 1
}

Write-Host ""
Write-Host "3. Testing registration..." -ForegroundColor Yellow

$registerBody = @{
    email = "test_$(Get-Date -Format 'yyyyMMddHHmmss')@example.com"
    password = "test123"
    full_name = "Test User"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri "$BACKEND_URL/register" -Method Post -Body $registerBody -ContentType "application/json"
    Write-Host "   ✅ Registration successful!" -ForegroundColor Green
    Write-Host "   User ID: $($registerResponse.user.id)" -ForegroundColor Green
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errorMessage = $_.ErrorDetails.Message
    Write-Host "   ❌ Registration failed with status $statusCode" -ForegroundColor Red
    Write-Host "   Error: $errorMessage" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ All tests passed!" -ForegroundColor Green
Write-Host "Backend is ready to use!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
