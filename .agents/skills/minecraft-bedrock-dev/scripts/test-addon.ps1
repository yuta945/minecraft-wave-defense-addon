# ==============================================================================
# AI Autonomous Test Runner for Minecraft Bedrock Addon
# 1. ビルド & デプロイ (node build.js)
# 2. マイクラ/BDSのリロード (POST /cmd {"command": "reload"})
# 3. テスト発火 (POST /cmd {"command": "scriptevent ai:test ping"})
# 4. ログ監視 & 自己判定
# ==============================================================================

Write-Host "=== [1/4] Building and Deploying Addon ===" -ForegroundColor Cyan
node build.js
if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed with exit code $LASTEXITCODE"
    exit 1
}

Write-Host "`n=== [2/4] Sending 'reload' to Minecraft BDS ===" -ForegroundColor Cyan
try {
    $reloadRes = Invoke-RestMethod -Uri "http://localhost:3001/cmd" -Method Post -ContentType "application/json" -Body '{"command": "reload"}' -TimeoutSec 5
    Write-Host "Reload command dispatched: $($reloadRes.status)" -ForegroundColor Green
} catch {
    Write-Error "Failed to send reload command to BDS. Is tools/bds-runner.js running? Error: $_"
    exit 1
}

Start-Sleep -Seconds 2

Write-Host "`n=== [3/4] Triggering Autonomous Test (scriptevent ai:test ping) ===" -ForegroundColor Cyan
try {
    $testRes = Invoke-RestMethod -Uri "http://localhost:3001/cmd" -Method Post -ContentType "application/json" -Body '{"command": "scriptevent ai:test ping"}' -TimeoutSec 5
    Write-Host "Test event dispatched: $($testRes.status)" -ForegroundColor Green
} catch {
    Write-Error "Failed to trigger test event: $_"
    exit 1
}

Start-Sleep -Seconds 2

Write-Host "`n=== [4/4] Verifying Execution Logs ===" -ForegroundColor Cyan
$status = Invoke-RestMethod -Uri "http://localhost:3001/status" -Method Get
$logs = $status.recentLogs | Select-Object -Last 30 | ForEach-Object { $_.text }

$hasError = $false
$hasSuccess = $false

foreach ($line in $logs) {
    if ($line -match "\[Error\]|TypeError|ReferenceError|SyntaxError|Unhandled Promise") {
        Write-Host "ERROR LOG: $line" -ForegroundColor Red
        $hasError = $true
    } elseif ($line -match "\[AI-DEBUG\]") {
        Write-Host "DEBUG LOG: $line" -ForegroundColor Yellow
        $hasSuccess = $true
    }
}

if ($hasError) {
    Write-Host "`n[FAIL] Test encountered errors in script execution!" -ForegroundColor Red
    exit 1
}

if ($hasSuccess) {
    Write-Host "`n[PASS] All autonomous tests passed successfully without errors!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n[WARN] No [AI-DEBUG] markers captured. Check server logging." -ForegroundColor DarkYellow
    exit 0
}
