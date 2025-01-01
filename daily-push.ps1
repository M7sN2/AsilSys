# Daily push script - Push one commit per day following the 30-day plan
# This script should be run once per day to push the next commit

param(
    [switch]$Force = $false
)

$ErrorActionPreference = "Stop"

$progressFile = ".30day-commit-progress.txt"
$planFile = "30day-commit-plan.json"

# Check if files exist
if (-not (Test-Path $progressFile)) {
    Write-Error "Progress file not found. Run setup-30day-commits.ps1 first."
    exit 1
}

if (-not (Test-Path $planFile)) {
    Write-Error "Commit plan file not found: $planFile"
    exit 1
}

$currentDay = [int](Get-Content $progressFile)
$plan = Get-Content $planFile | ConvertFrom-Json

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Daily Push - Day $($currentDay + 1)" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

if ($currentDay -ge 30) {
    Write-Host "All commits have been pushed!" -ForegroundColor Green
    Write-Host "Total commits: 30" -ForegroundColor Green
    exit 0
}

# Check if we're on the right branch
$currentBranch = git rev-parse --abbrev-ref HEAD
if ($currentBranch -ne "main") {
    Write-Host "Warning: Not on main branch. Current branch: $currentBranch" -ForegroundColor Yellow
    if (-not $Force) {
        $response = Read-Host "Continue anyway? (y/n)"
        if ($response -ne "y") {
            exit 0
        }
    }
}

# Check if there are commits to push
$localCommits = git rev-list origin/main..HEAD 2>&1
if ($LASTEXITCODE -ne 0) {
    # Remote might not exist yet, check if we have any commits
    $commitCount = (git rev-list --count HEAD 2>&1)
    if ($commitCount -eq "0") {
        Write-Host "No commits found. Run setup-30day-commits.ps1 first." -ForegroundColor Yellow
        exit 1
    }
    Write-Host "Remote branch not found. Will push initial commit." -ForegroundColor Yellow
} else {
    $commitCount = ($localCommits -split "`n" | Where-Object { $_ }).Count
    if ($commitCount -eq 0) {
        Write-Host "No new commits to push." -ForegroundColor Yellow
        Write-Host "Current progress: Day $currentDay / 30" -ForegroundColor Gray
        exit 0
    }
}

# Get the next commit to push
$nextDay = $currentDay + 1
$dayPlan = $plan.plan | Where-Object { $_.day -eq $nextDay }

if (-not $dayPlan) {
    Write-Host "No plan found for day $nextDay" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Next commit to push:" -ForegroundColor Yellow
Write-Host "  Day: $nextDay" -ForegroundColor White
Write-Host "  Title: $($dayPlan.title)" -ForegroundColor White
Write-Host "  Type: $($dayPlan.type)" -ForegroundColor White
Write-Host ""

# Show commit log
Write-Host "Recent commits:" -ForegroundColor Cyan
git log --oneline -5 --decorate

Write-Host ""
if (-not $Force) {
    $response = Read-Host "Push this commit to GitHub? (y/n)"
    if ($response -ne "y") {
        Write-Host "Cancelled." -ForegroundColor Yellow
        exit 0
    }
}

# Push to remote
Write-Host ""
Write-Host "Pushing to origin/main..." -ForegroundColor Yellow
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ Successfully pushed!" -ForegroundColor Green
    Write-Host "Progress: Day $nextDay / 30 completed" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next push: Run this script again tomorrow" -ForegroundColor Cyan
    Write-Host "Or use: .\daily-push.ps1" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "✗ Push failed. Please check your git configuration and network connection." -ForegroundColor Red
    exit 1
}

