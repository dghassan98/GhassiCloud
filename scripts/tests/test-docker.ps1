# Docker Container Performance Test (LOCALHOST ONLY)
param([int]$DurationSeconds = 10)

Write-Host "`n=== Docker Container Performance ===" -ForegroundColor Cyan
Write-Host "Monitoring containers for $DurationSeconds seconds...`n" -ForegroundColor Gray

# Check if containers are running
try {
    $containers = docker ps --filter "name=ghassicloud" --format "{{.Names}}" 2>$null
    if (-not $containers) {
        Write-Host "No GhassiCloud containers running`n" -ForegroundColor Red
        exit 1
    }
    Write-Host "Found containers: $($containers -join ', ')`n" -ForegroundColor Green
} catch {
    Write-Host "Docker not available or containers not running`n" -ForegroundColor Red
    exit 1
}

# Collect stats
Write-Host "Collecting statistics..." -ForegroundColor Yellow
$stats = @()
1..$DurationSeconds | ForEach-Object {
    Start-Sleep -Seconds 1
    Write-Host "." -NoNewline -ForegroundColor Gray
    $output = docker stats --no-stream --format "{{.Container}},{{.CPUPerc}},{{.MemUsage}},{{.MemPerc}},{{.NetIO}},{{.BlockIO}}" ghassicloud-backend ghassicloud 2>$null
    if ($output) {
        $stats += $output
    }
}

Write-Host "`n`nResults:" -ForegroundColor Yellow
Write-Host "────────────────────────────────────────────────────────" -ForegroundColor Gray
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}" ghassicloud-backend ghassicloud 2>$null
Write-Host "────────────────────────────────────────────────────────" -ForegroundColor Gray

# Save to file
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$stats | Out-File "docker-stats-$timestamp.txt"
Write-Host "`nStats saved to: docker-stats-$timestamp.txt" -ForegroundColor Green
Write-Host ""