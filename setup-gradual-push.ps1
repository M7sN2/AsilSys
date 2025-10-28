# Setup script for gradual file push over 30 days
# This script prepares the repository to push files gradually

$ProjectPath = "C:\Users\Mohamed\Desktop\asel-sys"
Set-Location $ProjectPath

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup Gradual File Push (30 Days)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get all tracked files
Write-Host "Getting all files..." -ForegroundColor Yellow
$allFiles = git ls-files | Where-Object { $_ -notmatch "\.daily-push-progress\.txt|daily-commits-log\.md" }

$totalFiles = $allFiles.Count
Write-Host "Total files: $totalFiles" -ForegroundColor Green

# Calculate files per day
$filesPerDay = [math]::Ceiling($totalFiles / 30)
Write-Host "Files per day: $filesPerDay" -ForegroundColor Green
Write-Host ""

# Create file distribution plan
$planFile = ".file-distribution-plan.txt"
$planContent = @"
# File Distribution Plan - 30 Days
# Total Files: $totalFiles
# Files Per Day: $filesPerDay
# Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

"@

$dayNumber = 1
$fileIndex = 0

while ($fileIndex -lt $totalFiles) {
    $dayFiles = $allFiles[$fileIndex..([math]::Min($fileIndex + $filesPerDay - 1, $totalFiles - 1))]
    $dayFilesList = $dayFiles -join "`n"
    
    $planContent += @"
## Day $dayNumber
Files: $($dayFiles.Count)
$dayFilesList

"@
    
    $fileIndex += $filesPerDay
    $dayNumber++
}

Set-Content -Path $planFile -Value $planContent -Encoding UTF8
Write-Host "File distribution plan created: $planFile" -ForegroundColor Green

# Reset progress
$progressFile = ".daily-push-progress.txt"
$progressContent = @"
LastPushDate: 
LastPushTime: 
DayNumber: 0
TotalDays: 30
FilesPushed: 0
TotalFiles: $totalFiles
"@
Set-Content -Path $progressFile -Value $progressContent -Encoding UTF8

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup completed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Delete all files from GitHub repository (keep it empty)" -ForegroundColor White
Write-Host "2. Run the daily-gradual-push.ps1 script each day" -ForegroundColor White
Write-Host "3. Files will be added gradually over 30 days" -ForegroundColor White

