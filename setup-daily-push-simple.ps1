# Simple script to setup daily GitHub push
# Run this as Administrator

$ProjectPath = "C:\Users\Mohamed\Desktop\asel-sys"
$ScriptPath = "$ProjectPath\daily-gradual-push.ps1"
$TaskName = "DailyGitHubPush-AselSys"
$GitHubRepo = "https://github.com/Mh5en/Asseel-sys.git"

# Check if task exists
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Host "Task exists. Removing old task..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Create Action
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
    -Argument "-ExecutionPolicy Bypass -File `"$ScriptPath`"" `
    -WorkingDirectory $ProjectPath

# Create Trigger (Daily at 9:00 AM)
$trigger = New-ScheduledTaskTrigger -Daily -At "9:00AM"

# Create Settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -WakeToRun

# Create Principal
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive

# Register Task
try {
    Register-ScheduledTask -TaskName $TaskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal `
        -Description "Daily auto push to GitHub for 30 days - Asel System" | Out-Null
    
    Write-Host "Task created successfully!" -ForegroundColor Green
    Write-Host "Task Name: $TaskName" -ForegroundColor Cyan
    Write-Host "Schedule: Daily at 9:00 AM" -ForegroundColor Cyan
    Write-Host "Duration: 30 days" -ForegroundColor Cyan
    Write-Host "Repository: $GitHubRepo" -ForegroundColor Cyan
    
} catch {
    Write-Host "Error creating task: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Please run PowerShell as Administrator" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Setup completed!" -ForegroundColor Green

