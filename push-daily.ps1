# Push One Commit Per Day
# This script pushes one commit per day to simulate daily work

$ProjectPath = $PSScriptRoot
Set-Location $ProjectPath

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Daily Push - One Commit Per Day" -ForegroundColor Cyan
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
    exit 1
}

# Load progress
$progressFile = ".daily-push-status.txt"
$lastPushDate = ""
$lastPushCommit = ""

if (Test-Path $progressFile) {
    $progress = Get-Content $progressFile -Raw
    if ($progress -match "LastPushDate:\s*([^\r\n]+)") {
        $lastPushDate = $matches[1].Trim()
    }
    if ($progress -match "LastPushCommit:\s*([^\r\n]+)") {
        $lastPushCommit = $matches[1].Trim()
    }
}

# Check if already pushed today
$today = Get-Date -Format "yyyy-MM-dd"
if ($lastPushDate -eq $today) {
    Write-Host "Already pushed today ($today). Skipping..." -ForegroundColor Yellow
    Write-Host "Next push will be tomorrow." -ForegroundColor Gray
    exit 0
}

# Get commits that haven't been pushed yet
$currentBranch = git branch --show-current
$commitsAhead = git rev-list --count origin/$currentBranch..HEAD 2>&1

if ($LASTEXITCODE -ne 0) {
    # Branch doesn't exist on remote, push all
    Write-Host "Branch doesn't exist on remote. Pushing all commits..." -ForegroundColor Yellow
    git push -u origin $currentBranch
    if ($LASTEXITCODE -eq 0) {
        $progressContent = @"
LastPushDate: $today
LastPushCommit: $(git rev-parse HEAD)
"@
        Set-Content -Path $progressFile -Value $progressContent -Encoding UTF8
        Write-Host "✓ Pushed successfully!" -ForegroundColor Green
    }
    exit $LASTEXITCODE
}

if ($commitsAhead -eq 0) {
    Write-Host "No commits to push. All commits are already on remote." -ForegroundColor Yellow
    exit 0
}

# Get the oldest unpushed commit
$unpushedCommits = git rev-list origin/$currentBranch..HEAD 2>&1
$oldestCommit = ($unpushedCommits | Select-Object -Last 1).Trim()

if (-not $oldestCommit) {
    Write-Host "No commits to push." -ForegroundColor Yellow
    exit 0
}

# Show what we're about to push
$commitMessage = git log -1 --format="%s" $oldestCommit
$commitDate = git log -1 --format="%ad" --date=short $oldestCommit

Write-Host "Today: $today" -ForegroundColor Cyan
Write-Host "Commits ahead: $commitsAhead" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pushing commit:" -ForegroundColor Yellow
Write-Host "  Date: $commitDate" -ForegroundColor Gray
Write-Host "  Message: $commitMessage" -ForegroundColor Gray
Write-Host ""

# Push only up to this commit (one commit)
# We'll push all commits up to and including the oldest unpushed one
Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
git push origin $currentBranch 2>&1 | ForEach-Object {
    Write-Host $_ -ForegroundColor $(if ($LASTEXITCODE -eq 0) { "Green" } else { "Red" })
}

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ Successfully pushed!" -ForegroundColor Green
    
    # Update progress
    $progressContent = @"
LastPushDate: $today
LastPushCommit: $(git rev-parse HEAD)
"@
    Set-Content -Path $progressFile -Value $progressContent -Encoding UTF8
    
    Write-Host ""
    Write-Host "Next push will be tomorrow." -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "✗ Push failed!" -ForegroundColor Red
    exit 1
}

