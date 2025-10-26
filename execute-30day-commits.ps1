# Execute 30-Day Gradual Commits
# This script makes commits with backdated timestamps over 30 days

param(
    [int]$StartDay = 1,
    [switch]$DryRun = $false,
    [switch]$Push = $false
)

$ProjectPath = $PSScriptRoot
Set-Location $ProjectPath

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Execute 30-Day Gradual Commits" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if git repository exists
if (-not (Test-Path ".git")) {
    Write-Host "Error: Not a git repository! Initializing..." -ForegroundColor Yellow
    git init
    git branch -M main
}

# Check if remote exists
$remoteUrl = git remote get-url origin 2>$null
if (-not $remoteUrl) {
    Write-Host "Warning: No remote repository configured" -ForegroundColor Yellow
    Write-Host "Please add remote: git remote add origin https://github.com/M7sN2/Asel-sys.git" -ForegroundColor Yellow
}

# Load commit plan
$planFile = ".30day-commit-plan.json"
if (-not (Test-Path $planFile)) {
    Write-Host "Error: Commit plan not found!" -ForegroundColor Red
    Write-Host "Please run 'setup-30day-commits.ps1' first" -ForegroundColor Yellow
    exit 1
}

$plan = Get-Content $planFile -Raw | ConvertFrom-Json

# Load progress
$progressFile = ".30day-commit-progress.txt"
$currentDay = $StartDay
$lastCommitDate = ""

if (Test-Path $progressFile) {
    $progress = Get-Content $progressFile -Raw
    if ($progress -match "CurrentDay:\s*(\d+)") {
        $currentDay = [int]$matches[1]
    }
    if ($progress -match "LastCommitDate:\s*([^\r\n]+)") {
        $lastCommitDate = $matches[1].Trim()
    }
}

# Calculate start date (30 days ago from today)
$startDate = (Get-Date).AddDays(-30)
$baseDate = $startDate

Write-Host "Starting from Day $currentDay of 30" -ForegroundColor Cyan
Write-Host "Base date: $($baseDate.ToString('yyyy-MM-dd'))" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "DRY RUN MODE - No commits will be made" -ForegroundColor Yellow
    Write-Host ""
}

# Process each day
for ($day = $currentDay; $day -le 30; $day++) {
    $dayPlan = $plan | Where-Object { $_.Day -eq $day } | Select-Object -First 1
    
    if (-not $dayPlan) {
        Write-Host "Day $day : No plan found, skipping..." -ForegroundColor Yellow
        continue
    }
    
    # Calculate commit date (backdated)
    $commitDate = $baseDate.AddDays($day - 1)
    $commitDateStr = $commitDate.ToString("yyyy-MM-dd HH:mm:ss")
    
    Write-Host "----------------------------------------" -ForegroundColor Cyan
    Write-Host "Day $day of 30 - $($dayPlan.Title)" -ForegroundColor Cyan
    Write-Host "Commit date: $commitDateStr" -ForegroundColor Gray
    Write-Host "Files: $($dayPlan.Files.Count)" -ForegroundColor Gray
    Write-Host ""
    
    # Filter files that exist and are not already committed
    $filesToCommit = @()
    foreach ($file in $dayPlan.Files) {
        if (Test-Path $file) {
            # Check if file is already committed and unchanged
            $gitStatus = git status --porcelain $file 2>&1
            if ($gitStatus -match "^\?\?|^\s*[AM]|^\s*D") {
                $filesToCommit += $file
            }
        }
    }
    
    if ($filesToCommit.Count -eq 0) {
        Write-Host "  No files to commit (all already committed or don't exist)" -ForegroundColor Yellow
        Write-Host ""
        continue
    }
    
    Write-Host "  Files to commit:" -ForegroundColor Yellow
    foreach ($file in $filesToCommit) {
        Write-Host "    + $file" -ForegroundColor Green
    }
    Write-Host ""
    
    if ($DryRun) {
        Write-Host "  [DRY RUN] Would commit with message: $($dayPlan.Message)" -ForegroundColor Gray
        Write-Host ""
        continue
    }
    
    # Stage files
    foreach ($file in $filesToCommit) {
        git add $file 2>&1 | Out-Null
    }
    
    # Check if there are staged changes
    $stagedChanges = git diff --cached --name-only 2>&1
    if ($stagedChanges.Count -eq 0) {
        Write-Host "  No staged changes, skipping commit" -ForegroundColor Yellow
        Write-Host ""
        continue
    }
    
    # Set commit date environment variables
    $env:GIT_AUTHOR_DATE = $commitDateStr
    $env:GIT_COMMITTER_DATE = $commitDateStr
    
    # Create commit
    Write-Host "  Creating commit..." -ForegroundColor Yellow
    $commitOutput = git commit -m $dayPlan.Message 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Commit created successfully" -ForegroundColor Green
        
        # Update progress
        $progressContent = @"
CurrentDay: $($day + 1)
LastCommitDate: $commitDateStr
LastCommitDay: $day
TotalDays: 30
"@
        Set-Content -Path $progressFile -Value $progressContent -Encoding UTF8
        
        # Push if requested
        if ($Push -and $remoteUrl) {
            Write-Host "  Pushing to remote..." -ForegroundColor Yellow
            $pushOutput = git push origin main 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  ✓ Pushed successfully" -ForegroundColor Green
            } else {
                Write-Host "  ✗ Push failed: $pushOutput" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "  ✗ Commit failed: $commitOutput" -ForegroundColor Red
    }
    
    Write-Host ""
    
    # Small delay to avoid rate limiting
    Start-Sleep -Milliseconds 500
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Completed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Show summary
$totalCommits = (git log --oneline | Measure-Object -Line).Lines
Write-Host "Total commits: $totalCommits" -ForegroundColor Cyan

if (-not $Push) {
    Write-Host ""
    Write-Host "To push all commits to GitHub, run:" -ForegroundColor Yellow
    Write-Host "  git push origin main" -ForegroundColor White
    Write-Host ""
    Write-Host "Or use the -Push flag:" -ForegroundColor Yellow
    Write-Host "  .\execute-30day-commits.ps1 -Push" -ForegroundColor White
}

