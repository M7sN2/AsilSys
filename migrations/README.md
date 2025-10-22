# Migration Guide: REAL to INTEGER for Financial Amounts

## نظرة عامة

هذا السكريبت يقوم بترحيل قاعدة البيانات من استخدام `REAL` (أرقام عشرية) للمبالغ المالية إلى `INTEGER` (أرقام صحيحة) مخزنة بالقروش.

### مثال على التحويل:
- **قبل**: `100.50` ج.م (REAL)
- **بعد**: `10050` قرش (INTEGER)

## الجداول والأعمدة المتأثرة

### 1. **products** (المنتجات)
- `smallestPrice`: REAL → INTEGER
- `largestPrice`: REAL → INTEGER
- **ملاحظة**: `stock`, `openingStock`, `conversionFactor` تبقى REAL (كميات ونسب، ليست مبالغ مالية)

### 2. **customers** (العملاء)
- `openingBalance`: REAL → INTEGER
- `balance`: REAL → INTEGER

### 3. **suppliers** (الموردين)
- `openingBalance`: REAL → INTEGER
- `balance`: REAL → INTEGER

### 4. **sales_invoices** (فواتير المبيعات)
- `subtotal`: REAL → INTEGER
- `taxAmount`: REAL → INTEGER
- `shipping`: REAL → INTEGER
- `discount`: REAL → INTEGER
- `total`: REAL → INTEGER
- `paid`: REAL → INTEGER
- `remaining`: REAL → INTEGER
- **ملاحظة**: `taxRate` تبقى REAL (نسبة مئوية، ليست مبلغ)

### 5. **sales_invoice_items** (عناصر فواتير المبيعات)
- `price`: REAL → INTEGER
- `total`: REAL → INTEGER
- **ملاحظة**: `quantity` تبقى REAL (كمية، ليست مبلغ)

### 6. **purchase_invoices** (فواتير المشتريات)
- `subtotal`: REAL → INTEGER
- `taxAmount`: REAL → INTEGER
- `shipping`: REAL → INTEGER
- `discount`: REAL → INTEGER
- `total`: REAL → INTEGER
- `paid`: REAL → INTEGER
- `remaining`: REAL → INTEGER
- **ملاحظة**: `taxRate` تبقى REAL (نسبة مئوية)

### 7. **purchase_invoice_items** (عناصر فواتير المشتريات)
- `price`: REAL → INTEGER
- `total`: REAL → INTEGER
- **ملاحظة**: `quantity` تبقى REAL

### 8. **receipts** (سندات القبض)
- `amount`: REAL → INTEGER

### 9. **payments** (سندات الصرف)
- `amount`: REAL → INTEGER

### 10. **returns** (المرتجعات)
- `unitPrice`: REAL → INTEGER
- `totalAmount`: REAL → INTEGER
- **ملاحظة**: `quantity` تبقى REAL

### 11. **fixed_assets** (الأصول الثابتة)
- `purchasePrice`: REAL → INTEGER
- `currentValue`: REAL → INTEGER
- **ملاحظة**: `depreciationRate` تبقى REAL (نسبة مئوية)

### 12. **operating_expenses** (المصاريف التشغيلية)
- `amount`: REAL → INTEGER

### 13. **company_info** (معلومات الشركة)
- **ملاحظة**: `taxRate` تبقى REAL (نسبة مئوية)

## خطوات التنفيذ

### ⚠️ **تحذير مهم**: 
**يجب أخذ نسخة احتياطية كاملة من قاعدة البيانات قبل تنفيذ الترحيل!**

### الخطوة 1: أخذ نسخة احتياطية

```bash
# نسخ ملف قاعدة البيانات
cp asel-database.db asel-database.db.backup.$(date +%Y%m%d_%H%M%S)
```

أو استخدام أداة النسخ الاحتياطي المدمجة في التطبيق.

### الخطوة 2: تنفيذ الترحيل

```bash
# استخدام sqlite3 command line tool
sqlite3 asel-database.db < migrations/REAL_to_INTEGER_migration.sql
```

أو من داخل التطبيق:
```javascript
const fs = require('fs');
const migrationSQL = fs.readFileSync('migrations/REAL_to_INTEGER_migration.sql', 'utf8');
db.exec(migrationSQL);
```

### الخطوة 3: اختبار الترحيل

```bash
sqlite3 asel-database.db < migrations/REAL_to_INTEGER_test.sql
```

راجع النتائج وتأكد من أن جميع الاختبارات تعرض `PASS`.

### الخطوة 4: تحديث الكود

بعد الترحيل، يجب تحديث جميع الكود الذي يقرأ أو يكتب المبالغ المالية:

#### قبل (REAL):
```javascript
const price = 100.50; // ج.م
await db.prepare('INSERT INTO products (price) VALUES (?)').run(price);
```

#### بعد (INTEGER):
```javascript
const price = 10050; // قرش (100.50 * 100)
await db.prepare('INSERT INTO products (price) VALUES (?)').run(price);
```

#### عند القراءة للعرض:
```javascript
const priceInCents = row.price; // 10050
const priceInEgp = priceInCents / 100; // 100.50 ج.م
```

## التراجع عن الترحيل (Rollback)

إذا واجهت مشاكل بعد الترحيل، يمكنك التراجع:

```bash
sqlite3 asel-database.db < migrations/REAL_to_INTEGER_rollback.sql
```

**ملاحظة**: سكريبت Rollback يعيد البيانات من الجداول الاحتياطية (`*_backup`). تأكد من وجود هذه الجداول قبل التنفيذ.

## الأعمدة التي لم تتغير

الأعمدة التالية تبقى `REAL` لأنها ليست مبالغ مالية:

- `conversionFactor` (نسبة تحويل)
- `stock`, `openingStock` (كميات)
- `quantity` (كميات)
- `taxRate` (نسبة مئوية)
- `depreciationRate` (نسبة مئوية)

## الفهارس (Indexes)

جميع الفهارس الـ 29 تم إعادة إنشائها بعد الترحيل:
- فهارس المنتجات
- فهارس الفواتير (مبيعات ومشتريات)
- فهارس السندات (قبض وصرف)
- فهارس الأصول الثابتة
- فهارس المصاريف التشغيلية
- فهارس أذون الصرف والتسويات

## العلاقات (Foreign Keys)

جميع العلاقات بين الجداول تم الحفاظ عليها:
- `sales_invoices.customerId` → `customers.id`
- `purchase_invoices.supplierId` → `suppliers.id`
- `sales_invoice_items.invoiceId` → `sales_invoices.id`
- `sales_invoice_items.productId` → `products.id`
- وغيرها...

## الاختبارات

سكريبت الاختبار (`REAL_to_INTEGER_test.sql`) يتحقق من:

1. ✅ **عدد السجلات**: التأكد من عدم فقدان أي بيانات
2. ✅ **دقة التحويل**: التأكد من أن القيم محولة بشكل صحيح (مع هامش خطأ 0.01)
3. ✅ **سلامة Foreign Keys**: التأكد من أن العلاقات تعمل بشكل صحيح
4. ✅ **عينات البيانات**: عرض أول 10 سجلات من كل جدول للمراجعة
5. ✅ **القيم NULL**: التأكد من عدم وجود قيم NULL في الحقول المالية الحرجة

## ملاحظات مهمة

1. **الدقة**: التحويل يستخدم `ROUND()` لضمان الدقة. القيم مثل `100.499` تصبح `10050` وليس `10049`.

2. **القيم NULL**: يتم التعامل مع القيم NULL بشكل صحيح (تبقى NULL).

3. **القيم السالبة**: القيم السالبة (مثل الأرصدة المدينة) يتم تحويلها بشكل صحيح.

4. **الأداء**: استخدام INTEGER بدلاً من REAL يحسن الأداء قليلاً ويقلل حجم قاعدة البيانات.

5. **التوافق**: بعد الترحيل، يجب تحديث جميع الكود الذي يتعامل مع المبالغ المالية.

## الدعم

إذا واجهت أي مشاكل:
1. راجع نتائج الاختبارات
2. تحقق من وجود الجداول الاحتياطية
3. استخدم سكريبت Rollback للتراجع
4. راجع ملفات السجلات (logs) للأخطاء

## تاريخ الترحيل

- **التاريخ**: 2025-01-XX
- **الإصدار**: 1.0.0
- **الحالة**: جاهز للتنفيذ

---

**⚠️ تحذير نهائي**: تأكد من أخذ نسخة احتياطية قبل التنفيذ!

