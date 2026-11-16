Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   Starting Toolsy4U Universal Converter Studio...        " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$backendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; python run.py" -PassThru
Write-Host "[OK] Backend FastAPI server starting at http://127.0.0.1:8000" -ForegroundColor Green

Start-Sleep -Seconds 2

$frontendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev" -PassThru
Write-Host "[OK] Frontend Next.js app starting at http://localhost:3000" -ForegroundColor Green

Write-Host "`nOpening http://localhost:3000 in your default browser..." -ForegroundColor Yellow
Start-Process "http://localhost:3000"

Write-Host "`nToolsy4U is running! Press Ctrl+C in the respective windows to stop." -ForegroundColor White
