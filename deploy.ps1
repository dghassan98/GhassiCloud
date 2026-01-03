#!/usr/bin/env pwsh
# GhassiCloud Deployment Script
# Run this to pull latest changes and rebuild Docker containers

Write-Host "🔄 Pulling latest changes from Git..." -ForegroundColor Cyan
git pull

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Git pull failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n🛑 Stopping containers..." -ForegroundColor Yellow
docker-compose down

Write-Host "`n🔨 Building containers (no cache)..." -ForegroundColor Cyan
docker-compose build --no-cache

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n🚀 Starting containers..." -ForegroundColor Green
docker-compose up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Deployment complete!" -ForegroundColor Green
    Write-Host "📊 Container status:" -ForegroundColor Cyan
    docker-compose ps
} else {
    Write-Host "❌ Failed to start containers!" -ForegroundColor Red
    exit 1
}
