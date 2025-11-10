# سكريبت لإنشاء installer - يحتاج صلاحيات مسؤول
# يجب تشغيل PowerShell كمسؤول

Write-Host "جاري إنشاء installer للتطبيق..." -ForegroundColor Green

# تعيين متغير البيئة لإلغاء Code Signing
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"

# تشغيل electron-builder
npx electron-builder --win nsis --config.win.forceCodeSigning=false

Write-Host "تم إنشاء installer بنجاح!" -ForegroundColor Green
Write-Host "الموقع: dist\" -ForegroundColor Cyan

