# Quick Test Script for Obligation Timeline Feature
# Run this to start both servers

Write-Host ' Starting Obligation Timeline Test...' -ForegroundColor Cyan
Write-Host ''

# Check if backend is already running
$backendRunning = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue

if ($backendRunning) {
    Write-Host ' Backend already running on port 8000' -ForegroundColor Green
} else {
    Write-Host ' Starting backend server...' -ForegroundColor Yellow
    Write-Host 'Opening new terminal for backend...'
    Start-Process powershell -ArgumentList '-NoExit', '-Command', 'cd backend; python api.py'
    Start-Sleep -Seconds 3
}

# Check if frontend is already running
$frontendRunning = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue

if ($frontendRunning) {
    Write-Host ' Frontend already running on port 3000' -ForegroundColor Green
} else {
    Write-Host ' Starting frontend server...' -ForegroundColor Yellow
    Write-Host 'Opening new terminal for frontend...'
    Start-Process powershell -ArgumentList '-NoExit', '-Command', 'cd frontend; npm run dev'
    Start-Sleep -Seconds 5
}

Write-Host ''
Write-Host ' Servers starting...' -ForegroundColor Green
Write-Host ''
Write-Host 'Test Instructions:' -ForegroundColor Cyan
Write-Host '1. Open browser: http://localhost:3000' -ForegroundColor White
Write-Host '2. Login (demo@example.com / demo123)' -ForegroundColor White
Write-Host '3. Upload a document (use backend/sample_employment_agreement.txt)' -ForegroundColor White
Write-Host '4. Click the Timeline button () after analysis' -ForegroundColor White
Write-Host '5. Test filtering, details, and export features' -ForegroundColor White
Write-Host ''
Write-Host 'Opening browser in 5 seconds...' -ForegroundColor Yellow
Start-Sleep -Seconds 5
Start-Process 'http://localhost:3000'

Write-Host ''
Write-Host ' Full test guide: TEST_OBLIGATION_TIMELINE.md' -ForegroundColor Cyan
