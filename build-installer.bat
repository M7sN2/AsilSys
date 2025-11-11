@echo off
chcp 65001 >nul
echo ========================================
echo   بناء ملف التثبيت - نظام أسيل
echo ========================================
echo.

echo [1/4] التحقق من التبعيات...
call npm install
if %errorlevel% neq 0 (
    echo خطأ في تثبيت التبعيات!
    pause
    exit /b 1
)

echo.
echo [2/4] إعادة بناء better-sqlite3...
call npm run rebuild
if %errorlevel% neq 0 (
    echo تحذير: فشل إعادة بناء better-sqlite3، سيتم المحاولة مرة أخرى أثناء البناء
)

echo.
echo [3/4] بناء ملف التثبيت...
call npm run build:installer
if %errorlevel% neq 0 (
    echo خطأ في بناء ملف التثبيت!
    pause
    exit /b 1
)

echo.
echo [4/4] اكتمل البناء بنجاح!
echo.
echo ========================================
echo   تم بناء ملف التثبيت بنجاح!
echo ========================================
echo.
echo ملف التثبيت موجود في مجلد: dist\
echo اسم الملف: أسيل-Setup-1.0.0.exe
echo.
echo يمكنك الآن توزيع هذا الملف للعملاء
echo.
pause

