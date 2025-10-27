# Push all commits to GitHub
# This script pushes all local commits to the remote repository

$ProjectPath = $PSScriptRoot
Set-Location $ProjectPath

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Push All Commits to GitHub" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if git repository exists
if (-not (Test-Path ".git")) {
    Write-Host "Error: Not a git repository!" -ForegroundColor Red
    exit 1
}

# Check if remote exists
$remoteUrl = git remote get-url origin 2>$null
if (-not $remoteUrl) {
    Write-Host "Error: No remote repository configured!" -ForegroundColor Red
    Write-Host "Please add remote: git remote add origin https://github.com/M7sN2/Asel-sys.git" -ForegroundColor Yellow
    exit 1
}

Write-Host "Remote: $remoteUrl" -ForegroundColor Cyan
Write-Host ""

# Check current branch
$currentBranch = git branch --show-current
Write-Host "Current branch: $currentBranch" -ForegroundColor Cyan
Write-Host ""

# Check if there are commits to push
$commitsAhead = git rev-list --count origin/$currentBranch..HEAD 2>&1
if ($LASTEXITCODE -ne 0) {
    # Branch might not exist on remote yet
    Write-Host "Branch '$currentBranch' doesn't exist on remote yet" -ForegroundColor Yellow
    Write-Host "Pushing with upstream..." -ForegroundColor Yellow
    Write-Host ""
    
    git push -u origin $currentBranch 2>&1 | ForEach-Object {
        Write-Host $_ -ForegroundColor $(if ($LASTEXITCODE -eq 0) { "Green" } else { "Red" })
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✓ Successfully pushed to GitHub!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "✗ Push failed!" -ForegroundColor Red
        exit 1
    }
} else {
    if ($commitsAhead -eq 0) {
        Write-Host "No commits to push. Everything is up to date." -ForegroundColor Yellow
        exit 0
    }
    
    Write-Host "Commits to push: $commitsAhead" -ForegroundColor Cyan
    Write-Host ""
    
    # Show commit log
    Write-Host "Recent commits:" -ForegroundColor Cyan
    git log --oneline -10 origin/$currentBranch..HEAD 2>&1 | ForEach-Object {
        Write-Host "  $_" -ForegroundColor Gray
    }
    Write-Host ""
    
    # Ask for confirmation
    $confirmation = Read-Host "Push these commits to GitHub? (y/n)"
    if ($confirmation -ne "y" -and $confirmation -ne "Y") {
        Write-Host "Cancelled." -ForegroundColor Yellow
        exit 0
    }
    
    Write-Host ""
    Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
    
    # Push commits
    git push origin $currentBranch 2>&1 | ForEach-Object {
        Write-Host $_ -ForegroundColor $(if ($LASTEXITCODE -eq 0) { "Green" } else { "Red" })
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✓ Successfully pushed $commitsAhead commit(s) to GitHub!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "✗ Push failed!" -ForegroundColor Red
        Write-Host ""
        Write-Host "If you see conflicts, you may need to:" -ForegroundColor Yellow
        Write-Host "  1. Pull first: git pull origin $currentBranch" -ForegroundColor White
        Write-Host "  2. Resolve any conflicts" -ForegroundColor White
        Write-Host "  3. Push again: git push origin $currentBranch" -ForegroundColor White
        exit 1
    }
}

Write-Host ""
Write-Host "Repository URL: https://github.com/M7sN2/Asel-sys" -ForegroundColor Cyan

