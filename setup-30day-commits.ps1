# PowerShell script to set up and execute 30-day gradual commit plan
param(
    [string]$StartDate = "2025-01-01",
    [switch]$DryRun = $false,
    [switch]$Push = $false
)

$ErrorActionPreference = "Stop"

$planFile = "30day-commit-plan.json"
if (-not (Test-Path $planFile)) {
    Write-Error "Commit plan file not found: $planFile"
    exit 1
}

$plan = Get-Content $planFile | ConvertFrom-Json
$progressFile = ".30day-commit-progress.txt"

if (-not (Test-Path $progressFile)) {
    "0" | Out-File $progressFile -Encoding UTF8
}

$currentDay = [int](Get-Content $progressFile)

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "30-Day Gradual Commit Setup" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Current Progress: Day $currentDay / 30" -ForegroundColor Yellow
Write-Host "Start Date: $StartDate" -ForegroundColor Yellow
Write-Host "Dry Run: $DryRun" -ForegroundColor Yellow
Write-Host "Auto Push: $Push" -ForegroundColor Yellow
Write-Host ""

$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "Warning: You have uncommitted changes:" -ForegroundColor Yellow
    Write-Host $gitStatus
    Write-Host ""
    $response = Read-Host "Do you want to continue? (y/n)"
    if ($response -ne "y") {
        exit 0
    }
}

function New-BackdatedCommit {
    param(
        [string]$Message,
        [string]$Date,
        [string[]]$Files,
        [string]$Type,
        [bool]$IsDryRun = $false
    )
    
    $commitDate = Get-Date $Date
    $env:GIT_AUTHOR_DATE = $commitDate.ToString("yyyy-MM-dd HH:mm:ss")
    $env:GIT_COMMITTER_DATE = $commitDate.ToString("yyyy-MM-dd HH:mm:ss")
    
    Write-Host "Creating commit: $Message" -ForegroundColor Green
    Write-Host "  Date: $Date" -ForegroundColor Gray
    Write-Host "  Files: $($Files.Count)" -ForegroundColor Gray
    
    if ($IsDryRun) {
        Write-Host "  [DRY RUN] Would commit files: $($Files -join ', ')" -ForegroundColor Cyan
        return $true
    }
    
    $stagedFiles = @()
    foreach ($file in $Files) {
        if (Test-Path $file -PathType Container) {
            $dirFiles = Get-ChildItem -Path $file -Recurse -File | Where-Object { 
                $_.FullName -notmatch "node_modules|dist|\.git" 
            }
            foreach ($dirFile in $dirFiles) {
                $relativePath = $dirFile.FullName.Replace((Get-Location).Path + "\", "").Replace("\", "/")
                if (Test-Path $relativePath) {
                    git add $relativePath 2>&1 | Out-Null
                    $stagedFiles += $relativePath
                }
            }
        }
        if ((Test-Path $file) -and -not (Test-Path $file -PathType Container)) {
            git add $file 2>&1 | Out-Null
            $stagedFiles += $file
        }
    }
    
    if ($stagedFiles.Count -eq 0) {
        Write-Host "  Warning: No files to commit" -ForegroundColor Yellow
        return $false
    }
    
    $commitMessage = $Type + ": " + $Message
    git commit -m $commitMessage 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Commit created successfully" -ForegroundColor Green
        return $true
    }
    Write-Host "  ✗ Failed to create commit" -ForegroundColor Red
    return $false
}

$startDateObj = Get-Date $StartDate
$successCount = 0
$skipCount = 0

foreach ($dayPlan in $plan.plan) {
    $dayNumber = $dayPlan.day
    
    if ($dayNumber -le $currentDay) {
        Write-Host "Skipping Day $dayNumber (already completed)" -ForegroundColor Gray
        $skipCount++
        continue
    }
    
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Cyan
    $dayTitle = "Day " + $dayNumber + ": " + $dayPlan.title
    Write-Host $dayTitle -ForegroundColor Cyan
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "Type: $($dayPlan.type)" -ForegroundColor Gray
    Write-Host "Description: $($dayPlan.description)" -ForegroundColor Gray
    
    $commitDate = $startDateObj.AddDays($dayNumber - 1)
    $dateString = $commitDate.ToString("yyyy-MM-dd")
    
    $result = New-BackdatedCommit -Message $dayPlan.title -Date "$dateString 10:00:00" -Files $dayPlan.files -Type $dayPlan.type -IsDryRun $DryRun
    
    if ($result) {
        $successCount++
        
        if (-not $DryRun) {
            "$dayNumber" | Out-File $progressFile -Encoding UTF8
        }
        
        if ($Push -and -not $DryRun) {
            Write-Host "Pushing to remote..." -ForegroundColor Yellow
            git push origin main 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  ✓ Pushed successfully" -ForegroundColor Green
            }
            if ($LASTEXITCODE -ne 0) {
                Write-Host "  ✗ Push failed" -ForegroundColor Red
            }
        }
        
        Write-Host ""
        Write-Host "Progress: $dayNumber / 30 completed" -ForegroundColor Green
        
        $shouldAsk = (-not $Push) -and (-not $DryRun)
        if ($shouldAsk) {
            $response = Read-Host "Push this commit now? (y/n/skip remaining)"
            if ($response -eq "y") {
                git push origin main
            }
            if ($response -eq "skip remaining") {
                Write-Host "Skipping remaining commits. Use daily-push.ps1 to push daily." -ForegroundColor Yellow
                break
            }
        }
    }
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Completed: $successCount commits" -ForegroundColor Green
Write-Host "Skipped: $skipCount commits" -ForegroundColor Yellow
Write-Host "Remaining: $($plan.plan.Count - $currentDay - $successCount) commits" -ForegroundColor Gray

if (-not $DryRun) {
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Review commits: git log --oneline -30" -ForegroundColor White
    Write-Host "2. Push remaining commits daily using: .\daily-push.ps1" -ForegroundColor White
    Write-Host "3. Or push all at once: git push origin main" -ForegroundColor White
}
