# إصلاح مشكلة better-sqlite3 في ملف التثبيت

## المشكلة:
```
Error: Cannot find module 'better-sqlite3'
```

## الحل:

### 1. إعادة بناء better-sqlite3:
```bash
npm run rebuild
```

### 2. تنظيف مجلد dist:
```bash
rmdir /s /q dist
```
أو
```bash
Remove-Item -Recurse -Force dist
```

### 3. بناء ملف التثبيت مرة أخرى:
```bash
npm run build:installer
```

---

## التحقق من الإعدادات:

### ✅ في package.json يجب أن يكون:
1. `better-sqlite3` في `dependencies` (ليس devDependencies)
2. `asarUnpack` يحتوي على `node_modules/better-sqlite3/**/*`
3. `files` لا يستثني `node_modules/better-sqlite3`

### ✅ بعد البناء، تحقق من:
1. ملف `dist/win-unpacked/resources/app.asar.unpacked/node_modules/better-sqlite3` موجود
2. ملف `.node` موجود في `better-sqlite3/build/Release/`

---

## إذا استمرت المشكلة:

### الحل البديل - استخدام extraResources:
إذا لم يعمل asarUnpack، يمكن استخدام extraResources:

```json
"extraResources": [
  {
    "from": "node_modules/better-sqlite3",
    "to": "node_modules/better-sqlite3",
    "filter": ["**/*"]
  }
]
```

ثم تعديل `database.js` لاستخدام المسار الصحيح.

---

## ملاحظات:
- better-sqlite3 هو وحدة أصلية (native module) ويجب بناؤها لـ Electron
- electron-builder يقوم بذلك تلقائياً عبر @electron/rebuild
- الملفات الأصلية (.node) يجب أن تكون خارج asar

