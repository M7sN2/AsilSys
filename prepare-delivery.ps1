# سكريبت تحضير النظام للتسليم للعميل
# هذا السكريبت يساعدك في تحضير جميع الملفات المطلوبة للتسليم

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  تحضير النظام للتسليم للعميل" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# التحقق من وجود ملف package.json
if (-not (Test-Path "package.json")) {
    Write-Host "❌ خطأ: ملف package.json غير موجود!" -ForegroundColor Red
    Write-Host "تأكد من أنك في المجلد الصحيح للمشروع." -ForegroundColor Yellow
    exit 1
}

# إنشاء مجلد للتسليم
$deliveryFolder = "delivery-$(Get-Date -Format 'yyyy-MM-dd')"
if (Test-Path $deliveryFolder) {
    Write-Host "⚠️  المجلد $deliveryFolder موجود بالفعل" -ForegroundColor Yellow
    $response = Read-Host "هل تريد حذفه وإنشاء مجلد جديد؟ (y/n)"
    if ($response -eq "y" -or $response -eq "Y") {
        Remove-Item -Path $deliveryFolder -Recurse -Force
        New-Item -ItemType Directory -Path $deliveryFolder | Out-Null
        Write-Host "✅ تم إنشاء مجلد جديد: $deliveryFolder" -ForegroundColor Green
    } else {
        Write-Host "❌ تم الإلغاء" -ForegroundColor Red
        exit 1
    }
} else {
    New-Item -ItemType Directory -Path $deliveryFolder | Out-Null
    Write-Host "✅ تم إنشاء مجلد التسليم: $deliveryFolder" -ForegroundColor Green
}

Write-Host ""
Write-Host "الخطوة 1: بناء المثبت..." -ForegroundColor Yellow
Write-Host ""

# بناء المثبت
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npm run build:installer

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ فشل بناء المثبت!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ تم بناء المثبت بنجاح!" -ForegroundColor Green
Write-Host ""

# البحث عن ملف المثبت
$installerFile = Get-ChildItem -Path "dist" -Filter "أسيل-Setup-*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $installerFile) {
    Write-Host "❌ لم يتم العثور على ملف المثبت في مجلد dist!" -ForegroundColor Red
    exit 1
}

Write-Host "📦 ملف المثبت: $($installerFile.Name)" -ForegroundColor Cyan
Write-Host "📁 الحجم: $([math]::Round($installerFile.Length / 1MB, 2)) MB" -ForegroundColor Cyan
Write-Host ""

# نسخ ملف المثبت
Write-Host "الخطوة 2: نسخ ملف المثبت..." -ForegroundColor Yellow
Copy-Item -Path $installerFile.FullName -Destination "$deliveryFolder\$($installerFile.Name)"
Write-Host "✅ تم نسخ ملف المثبت" -ForegroundColor Green
Write-Host ""

# نسخ دليل الاستخدام
Write-Host "الخطوة 3: نسخ دليل الاستخدام..." -ForegroundColor Yellow
if (Test-Path "دليل_استخدام_النظام_الشامل.pdf") {
    Copy-Item -Path "دليل_استخدام_النظام_الشامل.pdf" -Destination "$deliveryFolder\دليل_استخدام_النظام_الشامل.pdf"
    Write-Host "✅ تم نسخ دليل الاستخدام" -ForegroundColor Green
} else {
    Write-Host "⚠️  ملف دليل الاستخدام غير موجود" -ForegroundColor Yellow
}
Write-Host ""

# نسخ قائمة الفحص
Write-Host "الخطوة 4: نسخ قائمة الفحص..." -ForegroundColor Yellow
if (Test-Path "قائمة_الفحص_قبل_التسليم.md") {
    Copy-Item -Path "قائمة_الفحص_قبل_التسليم.md" -Destination "$deliveryFolder\قائمة_الفحص_قبل_التسليم.md"
    Write-Host "✅ تم نسخ قائمة الفحص" -ForegroundColor Green
} else {
    Write-Host "⚠️  ملف قائمة الفحص غير موجود" -ForegroundColor Yellow
}
Write-Host ""

# نسخ إيصال الاستلام
Write-Host "الخطوة 5: نسخ إيصال الاستلام..." -ForegroundColor Yellow
if (Test-Path "إيصال_استلام_النظام.md") {
    Copy-Item -Path "إيصال_استلام_النظام.md" -Destination "$deliveryFolder\إيصال_استلام_النظام.md"
    Write-Host "✅ تم نسخ إيصال الاستلام" -ForegroundColor Green
} else {
    Write-Host "⚠️  ملف إيصال الاستلام غير موجود" -ForegroundColor Yellow
}
Write-Host ""

# نسخ دليل التسليم
Write-Host "الخطوة 6: نسخ دليل التسليم..." -ForegroundColor Yellow
if (Test-Path "دليل_تسليم_العميل.md") {
    Copy-Item -Path "دليل_تسليم_العميل.md" -Destination "$deliveryFolder\دليل_تسليم_العميل.md"
    Write-Host "✅ تم نسخ دليل التسليم" -ForegroundColor Green
} else {
    Write-Host "⚠️  ملف دليل التسليم غير موجود" -ForegroundColor Yellow
}
Write-Host ""

# إنشاء ملف README للتسليم
Write-Host "الخطوة 7: إنشاء ملف README..." -ForegroundColor Yellow
$readmeContent = @"
# حزمة تسليم نظام إدارة شركة أسيل

**تاريخ التحضير:** $(Get-Date -Format 'yyyy-MM-dd HH:mm')

---

## محتويات الحزمة

1. **$($installerFile.Name)** - ملف التثبيت
2. **دليل_استخدام_النظام_الشامل.pdf** - دليل الاستخدام الكامل
3. **قائمة_الفحص_قبل_التسليم.md** - قائمة الفحص قبل التسليم
4. **إيصال_استلام_النظام.md** - إيصال الاستلام
5. **دليل_تسليم_العميل.md** - دليل التسليم الكامل

---

## خطوات التسليم

1. افتح ملف **دليل_تسليم_العميل.md** واتبع الخطوات
2. استخدم **قائمة_الفحص_قبل_التسليم.md** للتأكد من إكمال جميع المتطلبات
3. املأ **إيصال_استلام_النظام.md** واحصل على توقيع العميل

---

## معلومات مهمة

- **اسم النظام:** نظام إدارة شركة أسيل
- **الإصدار:** 1.0.0
- **نوع النظام:** Windows Desktop Application
- **متطلبات النظام:** Windows 10 أو أحدث

---

## ملاحظات

- تأكد من عمل نسخة احتياطية أولية بعد التثبيت
- سجل بيانات الدخول في مكان آمن
- احصل على توقيع العميل على إيصال الاستلام

---

**تم التحضير بواسطة:** $env:USERNAME
"@

$readmeContent | Out-File -FilePath "$deliveryFolder\README.txt" -Encoding UTF8
Write-Host "✅ تم إنشاء ملف README" -ForegroundColor Green
Write-Host ""

# عرض ملخص
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ✅ تم تحضير الحزمة بنجاح!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📁 مجلد التسليم: $deliveryFolder" -ForegroundColor Cyan
Write-Host ""
Write-Host "المحتويات:" -ForegroundColor Yellow
Get-ChildItem -Path $deliveryFolder | ForEach-Object {
    $size = if ($_.PSIsContainer) { "DIR" } else { "$([math]::Round($_.Length / 1KB, 2)) KB" }
    Write-Host "  - $($_.Name) ($size)" -ForegroundColor White
}
Write-Host ""
Write-Host "✅ جاهز للتسليم!" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  📦 الملفات المطلوبة للعميل" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "الملف الوحيد الذي تحتاج نقله للعميل:" -ForegroundColor Yellow
Write-Host "  ✅ $($installerFile.Name)" -ForegroundColor Green
Write-Host ""
Write-Host "📍 الموقع:" -ForegroundColor Yellow
Write-Host "  $deliveryFolder\$($installerFile.Name)" -ForegroundColor White
Write-Host ""
Write-Host "📊 الحجم:" -ForegroundColor Yellow
Write-Host "  $([math]::Round($installerFile.Length / 1MB, 2)) MB" -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "الخطوة التالية:" -ForegroundColor Yellow
Write-Host "1. افتح مجلد $deliveryFolder" -ForegroundColor White
Write-Host "2. انسخ ملف $($installerFile.Name) إلى USB أو أي وسيلة نقل" -ForegroundColor White
Write-Host "3. على جهاز العميل: اضغط كليك يمين → Run as Administrator" -ForegroundColor White
Write-Host "4. اتبع خطوات التثبيت" -ForegroundColor White
Write-Host ""
Write-Host "💡 ملاحظة:" -ForegroundColor Yellow
Write-Host "  المثبت يحتوي على كل شيء! لا تحتاج أي ملفات أخرى." -ForegroundColor White
Write-Host ""

# فتح مجلد التسليم
$response = Read-Host "هل تريد فتح مجلد التسليم الآن؟ (y/n)"
if ($response -eq "y" -or $response -eq "Y") {
    Start-Process explorer.exe -ArgumentList $deliveryFolder
}

