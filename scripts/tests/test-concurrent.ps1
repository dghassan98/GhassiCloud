# Concurrent Load Test
param(
    [string]$BackendUrl = "https://ghassi.cloud",
    [int]$ParallelRequests = 50
)

Write-Host "`n=== Concurrent Load Test ===" -ForegroundColor Cyan

Write-Host "Running $ParallelRequests parallel requests...`n" -ForegroundColor Gray

$requestIds = 1..$ParallelRequests

Write-Host "Using background jobs for concurrency. " -ForegroundColor Yellow
$jobs = foreach ($id in $requestIds) {
    Start-Job -ArgumentList @($BackendUrl, $id) -ScriptBlock {
        param($BackendUrl, $RequestId)
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        try {
            Invoke-RestMethod -Uri "$BackendUrl/api/services" -ErrorAction Stop | Out-Null
            $stopwatch.Stop()
            [PSCustomObject]@{ Request = $RequestId; Time = $stopwatch.Elapsed.TotalMilliseconds; Success = $true }
        } catch {
            $stopwatch.Stop()
            [PSCustomObject]@{ Request = $RequestId; Time = $stopwatch.Elapsed.TotalMilliseconds; Success = $false }
        }
    }
}

$times = $jobs | Wait-Job | Receive-Job
$jobs | Remove-Job | Out-Null

$successful = $times | Where-Object Success
$failed = $times | Where-Object { -not $_.Success }

Write-Host "Results:" -ForegroundColor Yellow
Write-Host "  Success: $($successful.Count)/$ParallelRequests ($([math]::Round(($successful.Count/$ParallelRequests)*100, 1))%)" -ForegroundColor $(if($successful.Count -eq $ParallelRequests){"Green"}else{"Yellow"})
Write-Host "  Failed: $($failed.Count)" -ForegroundColor $(if($failed.Count -eq 0){"Green"}else{"Red"})

if ($successful.Count -gt 0) {
    $stats = $successful.Time | Measure-Object -Average -Maximum -Minimum
    Write-Host "`nTiming (successful requests):" -ForegroundColor Yellow
    Write-Host "  Average: $([math]::Round($stats.Average, 2)) ms" -ForegroundColor Green
    Write-Host "  Minimum: $([math]::Round($stats.Minimum, 2)) ms" -ForegroundColor Green
    Write-Host "  Maximum: $([math]::Round($stats.Maximum, 2)) ms" -ForegroundColor Green
    
    $throughput = $ParallelRequests / ($stats.Maximum / 1000)
    Write-Host "  Throughput: $([math]::Round($throughput, 1)) req/sec" -ForegroundColor Cyan
}
Write-Host ""
