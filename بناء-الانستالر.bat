@echo off
chcp 65001 >nul
cls
echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║          بناء ملف التثبيت - نظام أسيل                   ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
echo اسم البرنامج على سطح المكتب: أسيل
echo.
echo.

echo [1/4] التحقق من التبعيات...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo ❌ خطأ في تثبيت التبعيات!
    pause
    exit /b 1
)
echo ✅ تم تثبيت التبعيات بنجاح
echo.

echo [2/4] إعادة بناء better-sqlite3...
call npm run rebuild
if %errorlevel% neq 0 (
    echo ⚠️  تحذير: فشل إعادة بناء better-sqlite3، سيتم المحاولة مرة أخرى أثناء البناء
) else (
    echo ✅ تم إعادة بناء better-sqlite3 بنجاح
)
echo.

echo [3/4] بناء ملف التثبيت...
echo هذا قد يستغرق بضع دقائق...
echo.
call npm run build:installer
if %errorlevel% neq 0 (
    echo.
    echo ❌ خطأ في بناء ملف التثبيت!
    pause
    exit /b 1
)
echo.

echo [4/4] ✅ اكتمل البناء بنجاح!
echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║          تم بناء ملف التثبيت بنجاح!                     ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
echo 📁 الموقع: dist\
echo 📦 اسم الملف: أسيل-Setup-[version].exe
echo.
echo 📌 ملاحظات:
echo    - اسم البرنامج على سطح المكتب: أسيل
echo    - يمكنك الآن توزيع هذا الملف للعملاء
echo    - الملف جاهز للتثبيت على أي جهاز Windows
echo.
pause

