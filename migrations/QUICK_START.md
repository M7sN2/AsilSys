# Quick Start: تنفيذ الترحيل

## ⚠️ تحذير مهم

**قبل تنفيذ الترحيل، يجب تحديث الكود أولاً!**

الترحيل يحول قاعدة البيانات من REAL إلى INTEGER، لكن الكود الحالي ما زال يتوقع REAL. 
إذا نفذت الترحيل بدون تحديث الكود، سيتوقف التطبيق عن العمل.

## الطريقة الصحيحة

### الخطوة 1: تحديث الكود أولاً
يجب تحديث جميع الملفات التي تتعامل مع المبالغ المالية. راجع `CODE_CHANGES_REQUIRED.md`

### الخطوة 2: تنفيذ الترحيل
بعد تحديث الكود، يمكن تنفيذ الترحيل.

## كيفية التنفيذ

### من داخل التطبيق (Electron Console):

```javascript
// في Developer Tools (F12)
const { ipcRenderer } = require('electron');

// تنفيذ الترحيل
ipcRenderer.invoke('run-migration').then(result => {
    console.log(result);
});

// أو من main process
const dbManager = require('./database');
const db = new dbManager();
db.runRealToIntegerMigration().then(result => {
    console.log(result);
});
```

### من سطر الأوامر (إذا كانت قاعدة البيانات في المجلد الحالي):

```bash
node migrations/run-migration.js
```

## ملاحظة

**الترحيل جاهز، لكن يحتاج تحديث الكود أولاً!**

إذا أردت تنفيذ الترحيل الآن بدون تحديث الكود (للتجربة فقط):
1. خذ نسخة احتياطية كاملة
2. نفذ الترحيل
3. التطبيق لن يعمل حتى تحديث الكود

---

**الأفضل**: تحديث الكود أولاً، ثم تنفيذ الترحيل.

