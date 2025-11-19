# Quick Start - 30-Day GitHub Upload

## 🎯 Choose Your Approach

### Option 1: Push All at Once (Fast)
Push all 30 commits immediately:

```powershell
# Step 1: Setup
.\setup-30day-commits.ps1

# Step 2: Create All Commits
.\execute-30day-commits.ps1

# Step 3: Push Everything
.\push-all-commits.ps1
```

### Option 2: Daily Push (One Commit Per Day) ⭐ RECOMMENDED
Push one commit per day over 30 days:

```powershell
# Step 1: Setup
.\setup-30day-commits.ps1

# Step 2: Create All Commits (LOCAL ONLY - no push)
.\execute-30day-commits-only.ps1

# Step 3: Push ONE commit per day (run this once per day for 30 days)
.\push-one-commit-today.ps1
```

**For daily push, see:** [DAILY-PUSH-GUIDE.md](DAILY-PUSH-GUIDE.md)

---

## 📖 Full Documentation

See [30DAY-GITHUB-GUIDE.md](30DAY-GITHUB-GUIDE.md) for detailed instructions.

---

## ⚠️ Prerequisites

- Git repository initialized
- Remote configured: `git remote add origin https://github.com/M7sN2/Asel-sys.git`
- PowerShell execution policy allows scripts (or use `-ExecutionPolicy Bypass`)

---

**Need help?** Check the troubleshooting section in the full guide.

