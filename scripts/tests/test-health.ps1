# Health Check Performance Test
param(
    [string]$BackendUrl = "https://ghassi.cloud",
    [int]$Count = 100
)

Write-Host "`n=== Health Check Test ===" -ForegroundColor Cyan

Write-Host "Running $Count requests...`n" -ForegroundColor Gray

$times = 1..$Count | ForEach-Object {
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        Invoke-RestMethod -Uri "$BackendUrl/api/health" -ErrorAction Stop | Out-Null
        $stopwatch.Stop()
        $stopwatch.Elapsed.TotalMilliseconds
    } catch {
        $stopwatch.Stop()
        -1
    }
} | Where-Object { $_ -gt 0 }

$stats = $times | Measure-Object -Average -Maximum -Minimum
Write-Host "Results:" -ForegroundColor Yellow
Write-Host "  Average: $([math]::Round($stats.Average, 2)) ms" -ForegroundColor Green
Write-Host "  Minimum: $([math]::Round($stats.Minimum, 2)) ms" -ForegroundColor Green
Write-Host "  Maximum: $([math]::Round($stats.Maximum, 2)) ms" -ForegroundColor Green
Write-Host "  Total Requests: $($stats.Count)`n" -ForegroundColor Gray