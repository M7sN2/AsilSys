# 30-Day Gradual Push Guide

This guide explains how to upload your repository to GitHub gradually over 30 days, following software engineering best practices.

## Overview

The repository is organized into 30 logical commits that represent a realistic development timeline. Each commit represents one day of development work, following conventional commit messages and best practices.

## Quick Start

### Step 1: Initial Setup

1. **Review the commit plan:**
   ```powershell
   # View the 30-day plan
   Get-Content 30day-commit-plan.json | ConvertFrom-Json | Format-Table
   ```

2. **Dry run to see what will happen:**
   ```powershell
   .\setup-30day-commits.ps1 -DryRun
   ```

3. **Create all commits (without pushing):**
   ```powershell
   .\setup-30day-commits.ps1
   ```

### Step 2: Daily Pushes

After creating all commits, push one per day:

```powershell
# Run this script once per day
.\daily-push.ps1
```

The script will:
- Check your current progress
- Show you the next commit to push
- Push it to GitHub
- Update your progress

## Commit Plan Structure

The 30-day plan is organized into logical development phases:

### Days 1-3: Project Setup
- Day 1: Initial project configuration
- Day 2: Electron main process setup
- Day 3: Database layer implementation

### Days 4-6: Core Infrastructure
- Day 4: Base styles and UI framework
- Day 5: Authentication system
- Day 6: Dashboard and navigation

### Days 7-9: User Management
- Day 7: User management system
- Day 8: Permissions and access control
- Day 9: Action logging

### Days 10-12: Core Entities
- Day 10: Product management
- Day 11: Customer management
- Day 12: Supplier management

### Days 13-15: Sales & Purchases
- Day 13: Sales invoice system
- Day 14: Invoice printing and PDF
- Day 15: Purchase management

### Days 16-18: Inventory & Payments
- Day 16: Inventory management
- Day 17: Receipt management
- Day 18: Payment vouchers

### Days 19-22: Additional Features
- Day 19: Expense management
- Day 20: Fixed assets
- Day 21: Delivery notes
- Day 22: Settlements

### Days 23-26: Reports & Utilities
- Day 23: Sales reports
- Day 24: Financial reports
- Day 25: Backup system
- Day 26: Settings

### Days 27-30: Polish & Documentation
- Day 27: Utility features
- Day 28: Tests
- Day 29: Build configuration
- Day 30: Documentation

## Manual Process

If you prefer to push manually:

### Day 1 (First Push)
```powershell
# Create and push first commit
git add package.json package-lock.json .gitignore
git commit -m "chore: initial project setup and configuration" --date="2025-01-01 10:00:00"
git push origin main
```

### Subsequent Days
```powershell
# Each day, push the next commit
git log --oneline  # Find the commit for today
git push origin main  # Push one commit
```

## Advanced Usage

### Custom Start Date

```powershell
# Start from a different date
.\setup-30day-commits.ps1 -StartDate "2025-02-01"
```

### Auto-Push All Commits

```powershell
# Create all commits and push immediately (not recommended for gradual push)
.\setup-30day-commits.ps1 -Push
```

### Check Progress

```powershell
# View current progress
Get-Content .30day-commit-progress.txt

# View commit history
git log --oneline --graph --all
```

### Reset Progress

If you need to start over:

```powershell
# Reset progress file
"0" | Out-File .30day-commit-progress.txt -Encoding UTF8

# Or reset git history (WARNING: This will delete commits)
git reset --hard origin/main
```

## Best Practices

1. **One commit per day**: Follow the gradual approach for a realistic timeline
2. **Review before pushing**: Always review commits before pushing
3. **Consistent timing**: Push at roughly the same time each day
4. **Commit messages**: Follow conventional commit format (feat, fix, docs, etc.)
5. **Test before pushing**: Ensure each commit works before pushing

## Troubleshooting

### "No commits to push"
- Check if commits were created: `git log --oneline`
- Verify remote is set: `git remote -v`
- Check progress: `Get-Content .30day-commit-progress.txt`

### "Remote branch not found"
- First push might need: `git push -u origin main`
- Verify remote URL: `git remote get-url origin`

### "Files not found"
- Some files might not exist yet in your working directory
- The script will skip missing files and continue

### Reset and Start Over
```powershell
# Remove progress tracking
Remove-Item .30day-commit-progress.txt -ErrorAction SilentlyContinue

# Reset to before commits (if needed)
git reset --hard HEAD~30  # Adjust number as needed
```

## Commit Message Format

All commits follow conventional commit format:

- `chore:` - Project setup, configuration
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation
- `style:` - Code style, formatting
- `test:` - Tests
- `refactor:` - Code refactoring

## Progress Tracking

Progress is tracked in `.30day-commit-progress.txt`:
- Contains the last completed day number (0-30)
- Automatically updated after each commit
- Can be manually edited if needed

## GitHub Repository

Repository URL: `https://github.com/M7sN2/AsilSys.git`

Verify remote:
```powershell
git remote -v
```

Update remote if needed:
```powershell
git remote set-url origin https://github.com/M7sN2/AsilSys.git
```

## Support

If you encounter issues:
1. Check git status: `git status`
2. Check git log: `git log --oneline -10`
3. Verify remote: `git remote -v`
4. Review the commit plan: `Get-Content 30day-commit-plan.json`

## Notes

- Commits are created with backdated timestamps to simulate gradual development
- Each commit represents one logical feature or component
- The plan follows software engineering best practices
- You can customize the plan by editing `30day-commit-plan.json`

