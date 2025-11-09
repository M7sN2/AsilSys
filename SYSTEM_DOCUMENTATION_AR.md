# توثيق شامل لنظام إدارة المخزون والمحاسبة - شركة أسيل

## نظرة عامة على النظام

نظام سطح مكتب مبني باستخدام **Electron** و **SQLite (better-sqlite3)** لإدارة المخزون والمحاسبة. يستخدم النظام قاعدة بيانات SQLite واحدة (`asel-database.db`) لتخزين جميع البيانات.

---

## بنية قاعدة البيانات

### الجداول الأساسية

#### 1. **products** - المنتجات
- **الحقول:** id, code, name, category, smallestUnit, largestUnit, conversionFactor, smallestPrice, largestPrice, stock, openingStock, notes, status, lastSaleDate, createdAt, updatedAt
- **الاستخدام:** إدارة المنتجات والمخزون

#### 2. **categories** - الأصناف
- **الحقول:** id, name, createdAt
- **الاستخدام:** تصنيف المنتجات

#### 3. **customers** - العملاء
- **الحقول:** id, code, name, phone, address, firstTransactionDate, openingBalance, balance, status, lastTransactionDate, createdAt, updatedAt
- **الاستخدام:** إدارة بيانات العملاء وأرصدتهم

#### 4. **suppliers** - الموردين
- **الحقول:** id, code, name, phone, address, firstTransactionDate, openingBalance, balance, status, lastTransactionDate, createdAt, updatedAt
- **الاستخدام:** إدارة بيانات الموردين وأرصدتهم

#### 5. **sales_invoices** - فواتير المبيعات
- **الحقول:** id, invoiceNumber, customerId, date, dueDate, status, subtotal, taxRate, taxAmount, shipping, discount, total, paid, remaining, paymentMethod, notes, createdAt, updatedAt
- **الاستخدام:** تخزين فواتير المبيعات

#### 6. **sales_invoice_items** - عناصر فواتير المبيعات
- **الحقول:** id, invoiceId, productId, productName, unit, quantity, price, total
- **الاستخدام:** تفاصيل المنتجات في كل فاتورة مبيعات

#### 7. **purchase_invoices** - فواتير المشتريات
- **الحقول:** id, invoiceNumber, supplierId, date, subtotal, taxRate, taxAmount, shipping, discount, total, paid, remaining, paymentMethod, notes, createdAt, updatedAt
- **الاستخدام:** تخزين فواتير المشتريات

#### 8. **purchase_invoice_items** - عناصر فواتير المشتريات
- **الحقول:** id, invoiceId, productId, productName, unit, quantity, price, total
- **الاستخدام:** تفاصيل المنتجات في كل فاتورة مشتريات

#### 9. **receipts** - سندات القبض
- **الحقول:** id, receiptNumber, customerId, date, amount, paymentMethod, notes, createdAt, updatedAt
- **الاستخدام:** سندات استلام دفعات من العملاء

#### 10. **payments** - سندات الصرف
- **الحقول:** id, paymentNumber, supplierId, type, toName, date, amount, paymentMethod, notes, createdAt, updatedAt
- **الاستخدام:** سندات دفع للموردين أو مصروفات تشغيلية

#### 11. **inventory_adjustments** - تعديلات المخزون
- **الحقول:** id, adjustmentNumber, productId, date, type, quantity, reason, notes, createdAt
- **الاستخدام:** تسجيل عمليات تعديل المخزون (زيادة/نقصان/تحديد)

#### 12. **users** - المستخدمين
- **الحقول:** id, username, password, email, type, status, permissions, createdAt, updatedAt, lastLogin
- **الاستخدام:** إدارة المستخدمين والصلاحيات

#### 13. **fixed_assets** - الأصول الثابتة
- **الحقول:** id, code, name, category, purchaseDate, purchasePrice, currentValue, depreciationRate, location, department, status, description, supplierId, warrantyExpiryDate, notes, createdAt, updatedAt
- **الاستخدام:** إدارة الأصول الثابتة للشركة

#### 14. **settings** - الإعدادات العامة
- **الحقول:** key, value, updatedAt
- **الاستخدام:** تخزين إعدادات النظام

#### 15. **company_settings** - إعدادات الشركة
- **الحقول:** id, name, address, phone, mobile, email, commercialRegister, taxNumber, foundationDate, createdAt, updatedAt
- **الاستخدام:** معلومات الشركة للطباعة

#### 16. **backup_history** - تاريخ النسخ الاحتياطي
- **الحقول:** id, backupPath, backupType, fileSize, createdAt
- **الاستخدام:** تسجيل عمليات النسخ الاحتياطي

---

## الوحدات والعمليات

### 1. إدارة المنتجات (`scripts/products.js`)

#### الدوال والعمليات:

**`loadData()`**
- **قاعدة البيانات:** `products`, `categories`
- **العمليات:** جلب جميع المنتجات والأصناف

**`saveProducts()`**
- **قاعدة البيانات:** لا يوجد (يتم الحفظ في `handleFormSubmit`)
- **العمليات:** حفظ احتياطي في localStorage

**`generateProductCode()`**
- **قاعدة البيانات:** `products` (للتحقق من الكود)
- **العمليات:** إنشاء كود منتج تلقائي (PRD-00001)

**`handleFormSubmit()`**
- **قاعدة البيانات:** `products` (INSERT/UPDATE)
- **العمليات:** إضافة/تعديل منتج

**`deleteProduct()`**
- **قاعدة البيانات:** `products` (DELETE)
- **العمليات:** حذف منتج

**`checkInactiveProducts()`**
- **قاعدة البيانات:** `sales_invoice_items`, `sales_invoices`, `products` (UPDATE)
- **العمليات:** تحديث حالة المنتجات بناءً على تاريخ آخر بيع

**`addCategory()`**
- **قاعدة البيانات:** `categories` (INSERT)
- **العمليات:** إضافة صنف جديد

**`saveCategoryEdit()`**
- **قاعدة البيانات:** `categories` (UPDATE), `products` (UPDATE)
- **العمليات:** تعديل اسم الصنف وتحديثه في جميع المنتجات

**`deleteCategory()`**
- **قاعدة البيانات:** `categories` (DELETE)
- **العمليات:** حذف صنف (إذا لم يستخدم في منتجات)

---

### 2. إدارة المبيعات (`scripts/sales.js`)

#### الدوال والعمليات:

**`loadData()`**
- **قاعدة البيانات:** `sales_invoices`, `customers`, `products`, `sales_invoice_items`
- **العمليات:** جلب جميع الفواتير والعملاء والمنتجات

**`handleFormSubmit()`**
- **قاعدة البيانات:** 
  - `sales_invoices` (INSERT/UPDATE)
  - `sales_invoice_items` (INSERT/DELETE)
  - `products` (UPDATE - تحديث المخزون)
  - `customers` (UPDATE - تحديث الرصيد)
- **العمليات:** حفظ/تعديل فاتورة مبيعات، تحديث المخزون، تحديث رصيد العميل

**`recalculateCustomerBalance()`**
- **قاعدة البيانات:** `sales_invoices` (SELECT), `customers` (UPDATE)
- **العمليات:** إعادة حساب رصيد العميل من جميع الفواتير المسلمة

**`updateProductStockFromInvoice()`**
- **قاعدة البيانات:** `products` (UPDATE)
- **العمليات:** تقليل المخزون عند إنشاء فاتورة مبيعات

**`deleteInvoice()`**
- **قاعدة البيانات:** 
  - `sales_invoice_items` (DELETE)
  - `sales_invoices` (DELETE)
  - `products` (UPDATE - استعادة المخزون)
  - `customers` (UPDATE - إعادة حساب الرصيد)
- **العمليات:** حذف فاتورة واستعادة المخزون

**`viewInvoice()` / `printInvoiceById()`**
- **قاعدة البيانات:** `sales_invoices`, `sales_invoice_items`, `customers`
- **العمليات:** عرض/طباعة فاتورة

---

### 3. إدارة المشتريات (`scripts/purchases.js`)

#### الدوال والعمليات:

**`loadData()`**
- **قاعدة البيانات:** `purchase_invoices`, `suppliers`, `products`
- **العمليات:** جلب جميع فواتير المشتريات والموردين والمنتجات

**`handleFormSubmit()`**
- **قاعدة البيانات:** 
  - `purchase_invoices` (INSERT/UPDATE)
  - `purchase_invoice_items` (INSERT/DELETE)
  - `products` (UPDATE - زيادة المخزون)
  - `suppliers` (UPDATE - تحديث الرصيد)
- **العمليات:** حفظ/تعديل فاتورة مشتريات، زيادة المخزون، تحديث رصيد المورد

**`updateProductStockFromPurchase()`**
- **قاعدة البيانات:** `products` (UPDATE)
- **العمليات:** زيادة المخزون عند إنشاء فاتورة مشتريات

**`recalculateSupplierBalance()`**
- **قاعدة البيانات:** `purchase_invoices` (SELECT), `suppliers` (UPDATE)
- **العمليات:** إعادة حساب رصيد المورد من جميع فواتير المشتريات

---

### 4. إدارة العملاء (`scripts/customers.js`)

#### الدوال والعمليات:

**`loadData()`**
- **قاعدة البيانات:** `customers`, `sales_invoices`
- **العمليات:** جلب جميع العملاء والفواتير

**`handleFormSubmit()`**
- **قاعدة البيانات:** `customers` (INSERT/UPDATE)
- **العمليات:** إضافة/تعديل عميل

**`deleteCustomer()`**
- **قاعدة البيانات:** `customers` (DELETE)
- **العمليات:** حذف عميل

**`recalculateCustomerBalanceFromInvoices()`**
- **قاعدة البيانات:** `sales_invoices` (SELECT), `customers` (UPDATE)
- **العمليات:** إعادة حساب رصيد العميل من جميع الفواتير المسلمة

**`checkInactiveCustomers()`**
- **قاعدة البيانات:** `sales_invoices` (SELECT), `customers` (UPDATE)
- **العمليات:** تحديث حالة العميل بناءً على آخر تعامل

---

### 5. إدارة الموردين (`scripts/suppliers.js`)

#### الدوال والعمليات:

**`loadData()`**
- **قاعدة البيانات:** `suppliers`, `purchase_invoices`
- **العمليات:** جلب جميع الموردين وفواتير المشتريات

**`handleFormSubmit()`**
- **قاعدة البيانات:** `suppliers` (INSERT/UPDATE)
- **العمليات:** إضافة/تعديل مورد

**`deleteSupplier()`**
- **قاعدة البيانات:** `suppliers` (DELETE)
- **العمليات:** حذف مورد

**`recalculateSupplierBalanceFromInvoices()`**
- **قاعدة البيانات:** `purchase_invoices` (SELECT), `suppliers` (UPDATE)
- **العمليات:** إعادة حساب رصيد المورد من جميع فواتير المشتريات

**`checkInactiveSuppliers()`**
- **قاعدة البيانات:** `purchase_invoices` (SELECT), `suppliers` (UPDATE)
- **العمليات:** تحديث حالة المورد بناءً على آخر تعامل

---

### 6. سندات القبض (`scripts/receipts.js`)

#### الدوال والعمليات:

**`loadData()`**
- **قاعدة البيانات:** لا يوجد (يستخدم localStorage فقط)
- **العمليات:** جلب سندات القبض من localStorage

**`handleFormSubmit()`**
- **قاعدة البيانات:** لا يوجد (يستخدم localStorage فقط)
- **العمليات:** حفظ سند قبض وتحديث رصيد العميل في localStorage

**`updateCustomerBalance()`**
- **قاعدة البيانات:** لا يوجد (يستخدم localStorage فقط)
- **العمليات:** تحديث رصيد العميل (يقلل الدين)

---

### 7. سندات الصرف (`scripts/payments.js`)

#### الدوال والعمليات:

**`loadData()`**
- **قاعدة البيانات:** لا يوجد (يستخدم localStorage فقط)
- **العمليات:** جلب سندات الصرف من localStorage

**`handleFormSubmit()`**
- **قاعدة البيانات:** لا يوجد (يستخدم localStorage فقط)
- **العمليات:** حفظ سند صرف وتحديث رصيد المورد في localStorage

**`updateSupplierBalance()`**
- **قاعدة البيانات:** لا يوجد (يستخدم localStorage فقط)
- **العمليات:** تحديث رصيد المورد (يزيد الدين)

---

### 8. إدارة المخزون (`scripts/inventory.js`)

#### الدوال والعمليات:

**`loadData()`**
- **قاعدة البيانات:** لا يوجد (يستخدم localStorage فقط)
- **العمليات:** جلب عمليات الجرد من localStorage

**`handleFormSubmit()`**
- **قاعدة البيانات:** 
  - `products` (UPDATE - تحديث المخزون)
  - `inventory_adjustments` (INSERT/UPDATE)
- **العمليات:** إضافة/تعديل عملية جرد وتحديث المخزون

**`deleteInventoryOperation()`**
- **قاعدة البيانات:** 
  - `products` (UPDATE - استعادة المخزون القديم)
  - `inventory_adjustments` (DELETE)
- **العمليات:** حذف عملية جرد واستعادة المخزون

---

### 9. إدارة المستخدمين (`scripts/users.js`)

#### الدوال والعمليات:

**`loadUsers()`**
- **قاعدة البيانات:** `users` (SELECT)
- **العمليات:** جلب جميع المستخدمين

**`handleUserFormSubmit()`**
- **قاعدة البيانات:** `users` (INSERT/UPDATE)
- **العمليات:** إضافة/تعديل مستخدم

**`deleteUser()`**
- **قاعدة البيانات:** `users` (DELETE)
- **العمليات:** حذف مستخدم

---

### 10. الأصول الثابتة (`scripts/assets.js`)

#### الدوال والعمليات:

**`loadData()`**
- **قاعدة البيانات:** `fixed_assets`, `suppliers`
- **العمليات:** جلب جميع الأصول الثابتة والموردين

**`handleFormSubmit()`**
- **قاعدة البيانات:** `fixed_assets` (INSERT/UPDATE)
- **العمليات:** إضافة/تعديل أصل ثابت

**`deleteAsset()`**
- **قاعدة البيانات:** `fixed_assets` (DELETE)
- **العمليات:** حذف أصل ثابت

---

### 11. التقارير (`scripts/reports.js`)

#### الدوال والعمليات:

**`loadData()`**
- **قاعدة البيانات:** لا يوجد (يستخدم localStorage فقط)
- **العمليات:** جلب البيانات من localStorage

**`generateOperationalReport()`**
- **قاعدة البيانات:** لا يوجد (يستخدم localStorage)
- **العمليات:** إنشاء تقرير المصاريف التشغيلية

**`generatePaymentsReport()`**
- **قاعدة البيانات:** لا يوجد (يستخدم localStorage)
- **العمليات:** إنشاء تقرير سندات الصرف

**`generateCustomerStatement()`**
- **قاعدة البيانات:** لا يوجد (يستخدم localStorage)
- **العمليات:** إنشاء كشف حساب عميل

**`generateSupplierStatement()`**
- **قاعدة البيانات:** لا يوجد (يستخدم localStorage)
- **العمليات:** إنشاء كشف حساب مورد

---

### 12. تسجيل الدخول (`scripts/login.js`)

#### الدوال والعمليات:

**`simulateLogin()`**
- **قاعدة البيانات:** `users` (SELECT/INSERT/UPDATE)
- **العمليات:** التحقق من بيانات المستخدم، إنشاء مستخدم admin افتراضي، تحديث آخر تسجيل دخول

---

### 13. لوحة التحكم (`scripts/dashboard.js`)

#### الدوال والعمليات:

**`loadStatistics()`**
- **قاعدة البيانات:** `products`, `categories`, `customers`, `suppliers`, `sales_invoices`, `purchase_invoices`
- **العمليات:** حساب الإحصائيات العامة (عدد المنتجات، العملاء، الموردين، إجمالي المبيعات، إلخ)

---

## واجهة قاعدة البيانات (IPC Handlers)

### في `main.js`:

**`db-insert`** → `database.js: insert()`
- **الاستخدام:** إدراج سجل جديد في أي جدول

**`db-update`** → `database.js: update()`
- **الاستخدام:** تحديث سجل موجود في أي جدول

**`db-delete`** → `database.js: delete()`
- **الاستخدام:** حذف سجل من أي جدول

**`db-get`** → `database.js: getById()`
- **الاستخدام:** جلب سجل واحد بالمعرف

**`db-get-all`** → `database.js: getAll()`
- **الاستخدام:** جلب جميع السجلات من جدول مع شرط اختياري

**`db-query`** → `database.js: query()`
- **الاستخدام:** تنفيذ استعلام SQL مخصص

---

## وظائف النسخ الاحتياطي

### في `database.js`:

**`createBackup()`**
- **قاعدة البيانات:** جميع الجداول
- **العمليات:** إنشاء نسخة احتياطية كاملة من قاعدة البيانات
- **الحفظ:** `backup_history` (INSERT)

**`restoreBackup()`**
- **قاعدة البيانات:** جميع الجداول
- **العمليات:** استعادة قاعدة البيانات من نسخة احتياطية

**`getBackupHistory()`**
- **قاعدة البيانات:** `backup_history` (SELECT)
- **العمليات:** جلب تاريخ النسخ الاحتياطي

---

## ملخص العمليات الرئيسية

### 1. **إدارة المنتجات**
- **الجداول المستخدمة:** `products`, `categories`, `sales_invoice_items`, `sales_invoices`
- **العمليات:** إضافة/تعديل/حذف منتجات، إدارة الأصناف، تحديث المخزون تلقائياً

### 2. **عملية البيع**
- **الجداول المستخدمة:** `sales_invoices`, `sales_invoice_items`, `products`, `customers`
- **العمليات:** إنشاء فاتورة مبيعات، تقليل المخزون، تحديث رصيد العميل

### 3. **عملية الشراء**
- **الجداول المستخدمة:** `purchase_invoices`, `purchase_invoice_items`, `products`, `suppliers`
- **العمليات:** إنشاء فاتورة مشتريات، زيادة المخزون، تحديث رصيد المورد

### 4. **إدارة المخزون**
- **الجداول المستخدمة:** `inventory_adjustments`, `products`
- **العمليات:** تعديل المخزون يدوياً (زيادة/نقصان/تحديد)، تسجيل أسباب التعديل

### 5. **إدارة العملاء**
- **الجداول المستخدمة:** `customers`, `sales_invoices`
- **العمليات:** إضافة/تعديل/حذف عملاء، حساب الرصيد تلقائياً من الفواتير

### 6. **إدارة الموردين**
- **الجداول المستخدمة:** `suppliers`, `purchase_invoices`
- **العمليات:** إضافة/تعديل/حذف موردين، حساب الرصيد تلقائياً من الفواتير

### 7. **المدفوعات والمقبوضات**
- **الجداول المستخدمة:** `receipts`, `payments` (حالياً في localStorage)
- **العمليات:** تسجيل سندات قبض/صرف، تحديث الأرصدة

### 8. **الأصول الثابتة**
- **الجداول المستخدمة:** `fixed_assets`, `suppliers`
- **العمليات:** إدارة الأصول الثابتة، حساب الاستهلاك

### 9. **التقارير**
- **الجداول المستخدمة:** جميع الجداول (حالياً من localStorage)
- **العمليات:** إنشاء تقارير مبيعات، مشتريات، أرصدة، مصروفات

### 10. **إدارة المستخدمين**
- **الجداول المستخدمة:** `users`
- **العمليات:** إضافة/تعديل/حذف مستخدمين، إدارة الصلاحيات

---

## بنية الملفات الرئيسية

```
asel-sys/
├── main.js                    # العملية الرئيسية لـ Electron + IPC Handlers
├── database.js                # إدارة قاعدة البيانات (SQLite)
├── preload.js                 # Bridge بين Renderer و Main Process
├── index.html                 # الصفحة الرئيسية
├── login.html                 # صفحة تسجيل الدخول
├── scripts/
│   ├── products.js            # إدارة المنتجات
│   ├── sales.js               # إدارة المبيعات
│   ├── purchases.js            # إدارة المشتريات
│   ├── customers.js            # إدارة العملاء
│   ├── suppliers.js            # إدارة الموردين
│   ├── receipts.js             # سندات القبض
│   ├── payments.js             # سندات الصرف
│   ├── inventory.js            # إدارة المخزون
│   ├── users.js                # إدارة المستخدمين
│   ├── assets.js               # الأصول الثابتة
│   ├── reports.js              # التقارير
│   ├── dashboard.js            # لوحة التحكم
│   └── login.js                # تسجيل الدخول
└── styles/                    # ملفات CSS
```

---

## ملاحظات مهمة

1. **نظام قاعدة البيانات:** SQLite (better-sqlite3) - قاعدة بيانات واحدة لجميع البيانات
2. **النسخ الاحتياطي:** يتم حفظ نسخ احتياطية في مجلد المستخدم
3. **الصلاحيات:** نظام صلاحيات متقدم للمستخدمين
4. **المخزون:** يتم تحديثه تلقائياً عند المبيعات والمشتريات
5. **الأرصدة:** يتم حسابها تلقائياً من الفواتير
6. **التقارير:** حالياً تستخدم localStorage، لكن يمكن تحويلها لاستخدام قاعدة البيانات

---

## ميزات النظام

✅ إدارة كاملة للمنتجات والمخزون  
✅ فواتير مبيعات ومشتريات  
✅ إدارة العملاء والموردين  
✅ حساب الأرصدة تلقائياً  
✅ سندات قبض وصرف  
✅ تعديلات المخزون  
✅ الأصول الثابتة  
✅ التقارير والإحصائيات  
✅ النسخ الاحتياطي  
✅ نظام صلاحيات المستخدمين  
✅ واجهة عربية كاملة  

