#!/usr/bin/env pwsh
# GhassiCloud Deployment Script
# Run this to pull latest changes and rebuild Docker containers

Write-Host ""
Write-Host "Pulling latest changes from Git..." -ForegroundColor Cyan
git pull

if ($LASTEXITCODE -ne 0) {
    Write-Host "Git pull failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Stopping containers..." -ForegroundColor Yellow
docker-compose down

Write-Host ""
Write-Host "Building containers (no cache)..." -ForegroundColor Cyan
docker-compose build --no-cache

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Starting containers..." -ForegroundColor Green
docker-compose up -d

Write-Host ""
Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "Container status:" -ForegroundColor Cyan
docker-compose ps
