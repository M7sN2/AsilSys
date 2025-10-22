# Code Changes Required After Migration

## نظرة عامة

بعد تنفيذ الترحيل من REAL إلى INTEGER للمبالغ المالية، يجب تحديث جميع الكود الذي يقرأ أو يكتب المبالغ المالية.

## الملفات التي تحتاج تحديث

### 1. **database.js**
- تحديث `CREATE TABLE` statements لاستخدام INTEGER بدلاً من REAL
- تحديث جميع العمليات التي تتعامل مع المبالغ المالية

### 2. **scripts/sales.js**
- جميع العمليات على `subtotal`, `taxAmount`, `shipping`, `discount`, `total`, `paid`, `remaining`
- جميع العمليات على `price` و `total` في `sales_invoice_items`
- تحديث دوال الحساب لاستخدام INTEGER

### 3. **scripts/purchases.js**
- جميع العمليات على `subtotal`, `taxAmount`, `shipping`, `discount`, `total`, `paid`, `remaining`
- جميع العمليات على `price` و `total` في `purchase_invoice_items`
- تحديث دوال الحساب لاستخدام INTEGER

### 4. **scripts/receipts.js**
- جميع العمليات على `amount`
- تحديث دوال الحساب لاستخدام INTEGER

### 5. **scripts/payments.js**
- جميع العمليات على `amount`
- تحديث دوال الحساب لاستخدام INTEGER

### 6. **scripts/expenses.js**
- جميع العمليات على `amount`
- تحديث دوال الحساب لاستخدام INTEGER

### 7. **scripts/products.js**
- جميع العمليات على `smallestPrice` و `largestPrice`
- تحديث دوال الحساب لاستخدام INTEGER

### 8. **scripts/customers.js**
- جميع العمليات على `openingBalance` و `balance`
- تحديث دوال الحساب لاستخدام INTEGER

### 9. **scripts/suppliers.js**
- جميع العمليات على `openingBalance` و `balance`
- تحديث دوال الحساب لاستخدام INTEGER

### 10. **scripts/action-logs.js**
- جميع العمليات على المبالغ المالية في التقارير
- تحديث دوال العرض لتحويل INTEGER إلى REAL للعرض

### 11. **scripts/returns.js** (إن وجد)
- جميع العمليات على `unitPrice` و `totalAmount`
- تحديث دوال الحساب لاستخدام INTEGER

### 12. **scripts/fixed-assets.js** (إن وجد)
- جميع العمليات على `purchasePrice` و `currentValue`
- تحديث دوال الحساب لاستخدام INTEGER

## نماذج التحديثات

### 1. عند القراءة من قاعدة البيانات

#### قبل (REAL):
```javascript
const invoice = db.prepare('SELECT total FROM sales_invoices WHERE id = ?').get(invoiceId);
const total = invoice.total; // 100.50
```

#### بعد (INTEGER):
```javascript
const invoice = db.prepare('SELECT total FROM sales_invoices WHERE id = ?').get(invoiceId);
const totalInCents = invoice.total; // 10050
const total = totalInCents / 100; // 100.50 (للعرض)
```

### 2. عند الكتابة في قاعدة البيانات

#### قبل (REAL):
```javascript
const total = 100.50;
db.prepare('INSERT INTO sales_invoices (total) VALUES (?)').run(total);
```

#### بعد (INTEGER):
```javascript
const total = 100.50;
const totalInCents = Math.round(total * 100); // 10050
db.prepare('INSERT INTO sales_invoices (total) VALUES (?)').run(totalInCents);
```

### 3. عند الحسابات

#### قبل (REAL):
```javascript
const subtotal = 100.00;
const taxRate = 0.14; // 14%
const taxAmount = subtotal * taxRate; // 14.00
const total = subtotal + taxAmount; // 114.00
```

#### بعد (INTEGER):
```javascript
const subtotalInCents = 10000; // 100.00
const taxRate = 0.14; // 14%
const taxAmountInCents = Math.round(subtotalInCents * taxRate); // 1400 (14.00)
const totalInCents = subtotalInCents + taxAmountInCents; // 11400 (114.00)
```

### 4. عند العرض في الواجهة

#### قبل (REAL):
```javascript
document.getElementById('total').textContent = formatCurrency(invoice.total);
// formatCurrency(100.50) → "100.50 ج.م"
```

#### بعد (INTEGER):
```javascript
const totalInEgp = invoice.total / 100; // تحويل من قروش إلى جنيه
document.getElementById('total').textContent = formatCurrency(totalInEgp);
// formatCurrency(100.50) → "100.50 ج.م"
```

### 5. عند الطباعة

#### قبل (REAL):
```javascript
const printContent = `
    <p>الإجمالي: ${formatCurrency(invoice.total)}</p>
`;
```

#### بعد (INTEGER):
```javascript
const totalInEgp = invoice.total / 100;
const printContent = `
    <p>الإجمالي: ${formatCurrency(totalInEgp)}</p>
`;
```

## دوال مساعدة مقترحة

### إنشاء ملف `utils/currency.js`:

```javascript
/**
 * Convert EGP (Egyptian Pounds) to cents
 * @param {number} egp - Amount in EGP
 * @returns {number} Amount in cents
 */
function egpToCents(egp) {
    return Math.round(egp * 100);
}

/**
 * Convert cents to EGP (Egyptian Pounds)
 * @param {number} cents - Amount in cents
 * @returns {number} Amount in EGP
 */
function centsToEgp(cents) {
    return cents / 100;
}

/**
 * Format currency for display
 * @param {number} amount - Amount in EGP (not cents!)
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('ar-EG', {
        style: 'currency',
        currency: 'EGP',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

/**
 * Format currency from cents
 * @param {number} cents - Amount in cents
 * @returns {string} Formatted currency string
 */
function formatCurrencyFromCents(cents) {
    return formatCurrency(centsToEgp(cents));
}

module.exports = {
    egpToCents,
    centsToEgp,
    formatCurrency,
    formatCurrencyFromCents
};
```

## قائمة فحص (Checklist)

### قبل الترحيل:
- [ ] أخذ نسخة احتياطية كاملة
- [ ] إغلاق التطبيق
- [ ] تنفيذ migration.sql
- [ ] تشغيل test.sql والتحقق من النتائج

### بعد الترحيل:
- [ ] تحديث `database.js` (CREATE TABLE statements)
- [ ] تحديث `scripts/sales.js`
- [ ] تحديث `scripts/purchases.js`
- [ ] تحديث `scripts/receipts.js`
- [ ] تحديث `scripts/payments.js`
- [ ] تحديث `scripts/expenses.js`
- [ ] تحديث `scripts/products.js`
- [ ] تحديث `scripts/customers.js`
- [ ] تحديث `scripts/suppliers.js`
- [ ] تحديث `scripts/action-logs.js`
- [ ] إنشاء `utils/currency.js` (الدوال المساعدة)
- [ ] اختبار جميع الوظائف:
  - [ ] إنشاء فاتورة مبيعات
  - [ ] إنشاء فاتورة مشتريات
  - [ ] إنشاء سند قبض
  - [ ] إنشاء سند صرف
  - [ ] إنشاء مصروف تشغيلي
  - [ ] عرض التقارير
  - [ ] طباعة الفواتير
  - [ ] حساب الأرصدة
- [ ] اختبار لمدة أسبوع على الأقل
- [ ] بعد التأكد، تشغيل cleanup.sql

## ملاحظات مهمة

1. **الدقة**: استخدم `Math.round()` عند التحويل من EGP إلى cents لتجنب أخطاء التقريب.

2. **NULL Values**: تأكد من التعامل مع القيم NULL بشكل صحيح:
   ```javascript
   const amount = row.amount ? row.amount / 100 : 0;
   ```

3. **القيم السالبة**: القيم السالبة (مثل الأرصدة المدينة) تعمل بشكل صحيح مع INTEGER.

4. **الأداء**: استخدام INTEGER يحسن الأداء قليلاً، لكن الفرق غير ملحوظ في معظم الحالات.

5. **التوافق**: بعد الترحيل، لن يعمل الكود القديم. يجب تحديث جميع الملفات قبل تشغيل التطبيق.

## أمثلة على الأخطاء الشائعة

### ❌ خطأ: استخدام REAL مباشرة
```javascript
const total = invoice.total; // 10050 (cents)
formatCurrency(total); // ❌ سيعرض "10,050.00 ج.م" بدلاً من "100.50 ج.م"
```

### ✅ صحيح: تحويل إلى EGP أولاً
```javascript
const total = invoice.total / 100; // 100.50 (EGP)
formatCurrency(total); // ✅ سيعرض "100.50 ج.م"
```

### ❌ خطأ: حفظ REAL مباشرة
```javascript
const total = 100.50;
db.prepare('INSERT INTO invoices (total) VALUES (?)').run(total); // ❌
```

### ✅ صحيح: تحويل إلى cents أولاً
```javascript
const total = Math.round(100.50 * 100); // 10050
db.prepare('INSERT INTO invoices (total) VALUES (?)').run(total); // ✅
```

## الدعم

إذا واجهت مشاكل:
1. راجع هذا الملف
2. راجع `migrations/README.md`
3. راجع نتائج الاختبارات
4. تحقق من أن جميع الملفات محدثة

---

**تاريخ التحديث**: 2025-01-XX

