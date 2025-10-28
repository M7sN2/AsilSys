# سكريبت إعداد المهمة المجدولة للرفع اليومي
# هذا السكريبت يقوم بإنشاء مهمة مجدولة في Windows لتشغيل الرفع اليومي

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  إعداد المهمة المجدولة للرفع اليومي" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# الحصول على مسار المشروع
$ProjectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$ScriptPath = Join-Path $ProjectPath "daily-git-push.ps1"

# التحقق من وجود السكريبت
if (-not (Test-Path $ScriptPath)) {
    Write-Host "❌ خطأ: ملف daily-git-push.ps1 غير موجود!" -ForegroundColor Red
    exit 1
}

# اسم المهمة المجدولة
$TaskName = "DailyGitHubPush-AselSys"

# التحقق من وجود المهمة
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Host "⚠️  المهمة المجدولة موجودة بالفعل" -ForegroundColor Yellow
    $response = Read-Host "هل تريد حذفها وإنشاء مهمة جديدة؟ (y/n)"
    if ($response -eq "y" -or $response -eq "Y") {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "✅ تم حذف المهمة القديمة" -ForegroundColor Green
    } else {
        Write-Host "❌ تم الإلغاء" -ForegroundColor Red
        exit 1
    }
}

# الحصول على معلومات GitHub Repository
Write-Host ""
Write-Host "📋 إعدادات GitHub Repository:" -ForegroundColor Yellow
$repoUrl = Read-Host "أدخل رابط GitHub Repository (مثال: https://github.com/username/asel-sys.git)"

if (-not $repoUrl) {
    Write-Host "❌ يجب إدخال رابط GitHub Repository!" -ForegroundColor Red
    exit 1
}

# إنشاء المهمة المجدولة
Write-Host ""
Write-Host "🔧 إنشاء المهمة المجدولة..." -ForegroundColor Yellow

# إنشاء Action
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
    -Argument "-ExecutionPolicy Bypass -File `"$ScriptPath`" -GitHubRepo `"$repoUrl`"" `
    -WorkingDirectory $ProjectPath

# إنشاء Trigger (كل يوم في الساعة 9:00 صباحًا)
$trigger = New-ScheduledTaskTrigger -Daily -At "9:00AM"

# إنشاء Settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -WakeToRun

# إنشاء Principal (تشغيل كالمستخدم الحالي)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive

# تسجيل المهمة
try {
    Register-ScheduledTask -TaskName $TaskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal `
        -Description "رفع يومي تلقائي على GitHub لمدة 30 يوم - نظام أسيل" | Out-Null
    
    Write-Host "✅ تم إنشاء المهمة المجدولة بنجاح!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 معلومات المهمة:" -ForegroundColor Cyan
    Write-Host "   - الاسم: $TaskName" -ForegroundColor White
    Write-Host "   - الوقت: كل يوم في الساعة 9:00 صباحًا" -ForegroundColor White
    Write-Host "   - المدة: 30 يوم" -ForegroundColor White
    Write-Host "   - GitHub Repository: $repoUrl" -ForegroundColor White
    Write-Host ""
    Write-Host "💡 ملاحظات:" -ForegroundColor Yellow
    Write-Host "   - يمكنك تغيير وقت التشغيل من Task Scheduler" -ForegroundColor Gray
    Write-Host "   - يمكنك تشغيل المهمة يدويًا من Task Scheduler" -ForegroundColor Gray
    Write-Host "   - يمكنك اختبار السكريبت الآن بتشغيل: .\daily-git-push.ps1" -ForegroundColor Gray
    Write-Host ""
    
    # سؤال عن تشغيل السكريبت الآن
    $testNow = Read-Host "هل تريد تشغيل السكريبت الآن للاختبار؟ (y/n)"
    if ($testNow -eq "y" -or $testNow -eq "Y") {
        Write-Host ""
        Write-Host "🧪 تشغيل السكريبت للاختبار..." -ForegroundColor Yellow
        & $ScriptPath -GitHubRepo $repoUrl
    }
    
} catch {
    Write-Host "❌ فشل إنشاء المهمة المجدولة!" -ForegroundColor Red
    Write-Host "الخطأ: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 حاول تشغيل PowerShell كمسؤول (Run as Administrator)" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ اكتمل الإعداد!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

