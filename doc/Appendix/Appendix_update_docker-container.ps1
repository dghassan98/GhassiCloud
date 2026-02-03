Add-Type -AssemblyName System.Windows.Forms

# Welcome message
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Docker Compose Updater Script" -ForegroundColor Green
Write-Host "   Select a directory to update" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan

# Create a Folder Browser Dialog
$folderBrowser = New-Object System.Windows.Forms.FolderBrowserDialog
$folderBrowser.Description = "Select the directory containing docker-compose.yml"
$folderBrowser.ShowNewFolderButton = $false

# Show the dialog and get the selected folder
if ($folderBrowser.ShowDialog() -eq "OK") {
    $TargetDirectory = $folderBrowser.SelectedPath
} else {
    Write-Host "`nNo directory selected. Exiting..." -ForegroundColor Red
    exit 1
}

# Check if the directory contains a docker-compose.yml file
if (-Not (Test-Path "$TargetDirectory\docker-compose.yml")) {
    Write-Host "`nError: No docker-compose.yml found in '$TargetDirectory'." -ForegroundColor Red
    exit 1
}

Write-Host "`nSelected Directory: $TargetDirectory" -ForegroundColor Cyan
Write-Host "Starting update process..." -ForegroundColor Green

# Change to the target directory
Push-Location $TargetDirectory

# Run Docker commands
Write-Host "`nStopping existing containers..." -ForegroundColor Yellow
docker-compose stop

Write-Host "Pulling latest images..." -ForegroundColor Yellow
docker-compose pull

Write-Host "Restarting containers in detached mode..." -ForegroundColor Yellow
docker-compose up -d

# Return to the original directory
Pop-Location

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "   Update complete for $TargetDirectory" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
