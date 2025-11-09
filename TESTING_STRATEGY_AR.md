# استراتيجية الاختبار الاحترافية - نظام إدارة شركة أسيل

## نظرة عامة

هذا المستند يوضح استراتيجية الاختبار الاحترافية لنظام إدارة شركة أسيل. النظام مبني على Electron ويستخدم SQLite كقاعدة بيانات، ويحتوي على عدة وحدات: المشتريات، المبيعات، العملاء، الموردين، المنتجات، وغيرها.

---

## 1. أنواع الاختبارات المطلوبة

### أ) Unit Tests (اختبارات الوحدات)
**الهدف:** اختبار الدوال والوحدات بشكل منفصل

**أمثلة على ما يجب اختباره:**
- `formatArabicNumber()` - تحويل الأرقام للأرقام العربية
- `formatCurrency()` - تنسيق العملة
- `calculateTotals()` - حساب الإجماليات (subtotal, tax, shipping, discount, total, remaining)
- `generateInvoiceNumber()` - توليد أرقام الفواتير
- دوال قاعدة البيانات (insert, update, delete, get, getAll)
- دوال التحويل (conversion factors للمنتجات)
- دوال التحقق من صحة المدخلات

**الأولويات:**
1. ✅ دوال الحسابات (الأكثر أهمية - تؤثر على الدقة المالية)
2. ✅ دوال قاعدة البيانات
3. ✅ دوال التنسيق والعرض

---

### ب) Integration Tests (اختبارات التكامل)
**الهدف:** اختبار تفاعل المكونات المختلفة معاً

**أمثلة على ما يجب اختباره:**

#### تدفق فاتورة المشتريات:
1. إنشاء مورد جديد
2. إنشاء منتج جديد
3. إنشاء فاتورة مشتريات
4. التحقق من:
   - ✅ تحديث المخزون بشكل صحيح
   - ✅ تحديث رصيد المورد
   - ✅ حفظ الفاتورة في قاعدة البيانات
   - ✅ حفظ عناصر الفاتورة (invoice items)
   - ✅ صحة الحسابات (الإجمالي، المتبقي)

#### تدفق فاتورة المبيعات:
1. إنشاء عميل جديد
2. إنشاء منتج بمخزون كافٍ
3. إنشاء فاتورة مبيعات
4. التحقق من:
   - ✅ خصم المخزون بشكل صحيح
   - ✅ تحديث رصيد العميل
   - ✅ منع البيع عند عدم توفر المخزون
   - ✅ صحة الحسابات

#### تدفق إرجاع المنتج:
1. إنشاء فاتورة مبيعات
2. إرجاع منتج من الفاتورة
3. التحقق من:
   - ✅ إرجاع المخزون
   - ✅ تحديث رصيد العميل
   - ✅ تسجيل الإرجاع في قاعدة البيانات

#### تدفق التسويات (Settlements):
1. إنشاء إذن صرف
2. إنشاء تسوية
3. التحقق من:
   - ✅ ربط التسوية بإذن الصرف
   - ✅ حساب الفروقات بشكل صحيح

---

### ج) E2E Tests (اختبارات من البداية للنهاية)
**الهدف:** محاكاة سيناريوهات المستخدم الكاملة

**سيناريوهات المستخدم:**

#### السيناريو 1: عملية شراء كاملة
```
1. تسجيل الدخول
2. إنشاء مورد جديد
3. إنشاء منتج جديد
4. إنشاء فاتورة مشتريات
5. إضافة منتجات للفاتورة
6. حفظ الفاتورة
7. التحقق من:
   - عرض الفاتورة في القائمة
   - تحديث المخزون
   - تحديث رصيد المورد
   - إمكانية طباعة الفاتورة
```

#### السيناريو 2: عملية بيع كاملة
```
1. تسجيل الدخول
2. إنشاء عميل جديد
3. إنشاء فاتورة مبيعات
4. إضافة منتجات (التحقق من توفر المخزون)
5. حفظ الفاتورة
6. إنشاء إيصال استلام
7. التحقق من:
   - تحديث المخزون
   - تحديث رصيد العميل
   - إمكانية طباعة الفاتورة والإيصال
```

#### السيناريو 3: إدارة المخزون
```
1. عرض المنتجات
2. إجراء تعديل على المخزون
3. التحقق من:
   - تسجيل التعديل
   - تحديث المخزون
   - حفظ سجل التعديل
```

#### السيناريو 4: إدارة المدفوعات
```
1. عرض فواتير الموردين
2. إنشاء دفعة لمورد
3. التحقق من:
   - تحديث رصيد المورد
   - تسجيل الدفعة
   - إمكانية طباعة إيصال الدفعة
```

---

### د) UI Tests (اختبارات الواجهة)
**الهدف:** التحقق من صحة عرض البيانات والتفاعلات

**ما يجب اختباره:**
- ✅ عرض الفواتير بشكل صحيح
- ✅ فتح وإغلاق النوافذ المنبثقة (Modals)
- ✅ التصفح (Pagination) - الانتقال بين الصفحات
- ✅ البحث والفلترة
- ✅ التحقق من صحة تنسيق الأرقام العربية
- ✅ التحقق من صحة عرض التواريخ
- ✅ التحقق من صحة عرض العملة
- ✅ التحقق من صحة عرض الأرصدة

---

## 2. الأدوات المناسبة

### للـ Unit & Integration Tests:
- **Jest** (موصى به) - سهل الاستخدام، دعم ممتاز لـ JavaScript
- **Mocha + Chai** - بديل قوي
- **Electron Test Utils** - للاختبار داخل بيئة Electron

### للـ E2E Tests:
- **Spectron** (مخصص لـ Electron) - لكنه متوقف عن التطوير
- **Playwright** (موصى به) - حديث وقوي
- **Cypress** - بديل جيد

### للـ Database Tests:
- **SQLite in-memory** - للاختبارات السريعة
- **Mock للـ Electron APIs** - لعزل الاختبارات

### للـ Code Coverage:
- **Istanbul/NYC** - مع Jest
- **c8** - بديل حديث

---

## 3. هيكل الاختبارات المقترح

```
tests/
├── unit/
│   ├── utils/
│   │   ├── formatArabicNumber.test.js
│   │   ├── formatCurrency.test.js
│   │   └── dateUtils.test.js
│   ├── database/
│   │   ├── databaseManager.test.js
│   │   ├── insert.test.js
│   │   ├── update.test.js
│   │   ├── delete.test.js
│   │   └── query.test.js
│   ├── calculations/
│   │   ├── calculateTotals.test.js
│   │   ├── calculateBalance.test.js
│   │   └── calculateStock.test.js
│   └── validators/
│       ├── inputValidation.test.js
│       └── businessRules.test.js
├── integration/
│   ├── purchase-flow.test.js
│   ├── sales-flow.test.js
│   ├── inventory-updates.test.js
│   ├── balance-updates.test.js
│   └── stock-management.test.js
├── e2e/
│   ├── purchase-invoice.test.js
│   ├── sales-invoice.test.js
│   ├── user-workflow.test.js
│   └── payment-workflow.test.js
├── fixtures/
│   ├── sample-data.js
│   ├── mock-database.js
│   └── test-invoices.js
└── helpers/
    ├── test-helpers.js
    ├── mock-electron.js
    └── database-setup.js
```

---

## 4. أمثلة سيناريوهات اختبار مفصلة

### سيناريو 1: فاتورة مشتريات كاملة

```javascript
describe('Purchase Invoice Flow', () => {
  test('should create purchase invoice and update stock', async () => {
    // 1. إنشاء مورد
    const supplier = await createSupplier({
      name: 'مورد تجريبي',
      code: 'SUP001'
    });
    
    // 2. إنشاء منتج
    const product = await createProduct({
      name: 'منتج تجريبي',
      code: 'PROD001',
      stock: 100
    });
    
    // 3. إنشاء فاتورة مشتريات
    const invoice = await createPurchaseInvoice({
      supplierId: supplier.id,
      products: [{
        productId: product.id,
        quantity: 50,
        price: 10
      }],
      shipping: 20,
      discount: 10,
      paid: 500
    });
    
    // 4. التحقق من النتائج
    expect(invoice.total).toBe(510); // (50 * 10) + 20 - 10
    expect(invoice.remaining).toBe(10); // 510 - 500
    
    // 5. التحقق من تحديث المخزون
    const updatedProduct = await getProduct(product.id);
    expect(updatedProduct.stock).toBe(150); // 100 + 50
    
    // 6. التحقق من تحديث رصيد المورد
    const updatedSupplier = await getSupplier(supplier.id);
    expect(updatedSupplier.balance).toBe(10); // المتبقي من الفاتورة
  });
});
```

### سيناريو 2: فاتورة مبيعات مع التحقق من المخزون

```javascript
describe('Sales Invoice Flow', () => {
  test('should prevent sale when stock is insufficient', async () => {
    // 1. إنشاء منتج بمخزون محدود
    const product = await createProduct({
      name: 'منتج محدود',
      code: 'PROD002',
      stock: 10
    });
    
    // 2. محاولة بيع كمية أكبر من المخزون
    const result = await createSalesInvoice({
      customerId: customer.id,
      products: [{
        productId: product.id,
        quantity: 20, // أكثر من المخزون المتاح
        price: 15
      }]
    });
    
    // 3. التحقق من رفض العملية
    expect(result.success).toBe(false);
    expect(result.error).toContain('المخزون غير كاف');
  });
  
  test('should deduct stock on successful sale', async () => {
    // 1. إنشاء منتج
    const product = await createProduct({
      stock: 100
    });
    
    // 2. إنشاء فاتورة مبيعات
    await createSalesInvoice({
      products: [{
        productId: product.id,
        quantity: 30,
        price: 20
      }]
    });
    
    // 3. التحقق من خصم المخزون
    const updatedProduct = await getProduct(product.id);
    expect(updatedProduct.stock).toBe(70); // 100 - 30
  });
});
```

### سيناريو 3: إرجاع منتج

```javascript
describe('Product Return Flow', () => {
  test('should restore stock on return', async () => {
    // 1. إنشاء فاتورة مبيعات
    const invoice = await createSalesInvoice({
      products: [{
        productId: product.id,
        quantity: 20,
        price: 15
      }]
    });
    
    const initialStock = product.stock - 20;
    
    // 2. إرجاع منتج
    await returnProduct({
      invoiceId: invoice.id,
      productId: product.id,
      quantity: 5,
      reason: 'عيب في الصنف'
    });
    
    // 3. التحقق من إرجاع المخزون
    const updatedProduct = await getProduct(product.id);
    expect(updatedProduct.stock).toBe(initialStock + 5);
  });
});
```

---

## 5. Test Coverage (التغطية)

### الأهداف:
- **الحد الأدنى:** 70% تغطية
- **الهدف المثالي:** 80%+ تغطية
- **الوظائف الحرجة:** 100% تغطية (الحسابات المالية، قاعدة البيانات)

### الأولويات:
1. ✅ **دوال الحسابات** - 100% تغطية (الأكثر أهمية)
   - `calculateTotals()`
   - `calculateBalance()`
   - `calculateStock()`
   - `recalculateSupplierBalance()`
   - `recalculateCustomerBalance()`

2. ✅ **دوال قاعدة البيانات** - 90%+ تغطية
   - `insert()`
   - `update()`
   - `delete()`
   - `getById()`
   - `getAll()`

3. ✅ **دوال التنسيق** - 80%+ تغطية
   - `formatArabicNumber()`
   - `formatCurrency()`
   - `generateInvoiceNumber()`

4. ✅ **دوال التحقق** - 80%+ تغطية
   - التحقق من صحة المدخلات
   - التحقق من القواعد التجارية

---

## 6. Test Data Management (إدارة بيانات الاختبار)

### المبادئ:
1. **استخدام Test Fixtures** - بيانات اختبار قابلة لإعادة الاستخدام
2. **تنظيف البيانات** - حذف البيانات بعد كل اختبار
3. **قاعدة بيانات منفصلة** - استخدام قاعدة بيانات خاصة بالاختبارات
4. **Mocking** - محاكاة الاعتماديات الخارجية

### مثال على Test Fixtures:

```javascript
// fixtures/sample-data.js
export const testSupplier = {
  id: 'test-supplier-001',
  code: 'SUP001',
  name: 'مورد تجريبي',
  phone: '01234567890',
  address: 'عنوان تجريبي',
  openingBalance: 0,
  balance: 0
};

export const testProduct = {
  id: 'test-product-001',
  code: 'PROD001',
  name: 'منتج تجريبي',
  category: 'فئة تجريبية',
  smallestUnit: 'قطعة',
  largestUnit: 'كرتون',
  conversionFactor: 12,
  smallestPrice: 10,
  largestPrice: 100,
  stock: 100,
  openingStock: 100
};

export const testCustomer = {
  id: 'test-customer-001',
  code: 'CUST001',
  name: 'عميل تجريبي',
  phone: '01234567890',
  address: 'عنوان تجريبي',
  openingBalance: 0,
  balance: 0
};
```

### مثال على Database Setup:

```javascript
// helpers/database-setup.js
export async function setupTestDatabase() {
  // إنشاء قاعدة بيانات في الذاكرة
  const db = new Database(':memory:');
  
  // تهيئة الجداول
  await initializeTables(db);
  
  return db;
}

export async function cleanupTestDatabase(db) {
  // حذف جميع البيانات
  await db.exec('DELETE FROM purchase_invoices');
  await db.exec('DELETE FROM sales_invoices');
  await db.exec('DELETE FROM products');
  await db.exec('DELETE FROM suppliers');
  await db.exec('DELETE FROM customers');
  
  // إغلاق الاتصال
  db.close();
}
```

---

## 7. Continuous Integration (CI)

### الإعداد المقترح:

#### GitHub Actions مثال:

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: windows-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm install
    
    - name: Run unit tests
      run: npm run test:unit
    
    - name: Run integration tests
      run: npm run test:integration
    
    - name: Generate coverage report
      run: npm run test:coverage
    
    - name: Upload coverage
      uses: codecov/codecov-action@v2
```

### متى يتم تشغيل الاختبارات:
- ✅ عند كل Push للكود
- ✅ عند فتح Pull Request
- ✅ قبل الـ Build
- ✅ قبل النشر (Deployment)

---

## 8. اختبارات الأداء (Performance Tests)

### ما يجب اختباره:

#### سرعة تحميل البيانات:
```javascript
test('should load invoices quickly', async () => {
  const startTime = Date.now();
  const invoices = await loadInvoices();
  const loadTime = Date.now() - startTime;
  
  expect(loadTime).toBeLessThan(1000); // أقل من ثانية
  expect(invoices.length).toBeGreaterThan(0);
});
```

#### سرعة حفظ الفواتير:
```javascript
test('should save invoice quickly', async () => {
  const startTime = Date.now();
  await saveInvoice(testInvoice);
  const saveTime = Date.now() - startTime;
  
  expect(saveTime).toBeLessThan(500); // أقل من نصف ثانية
});
```

#### سرعة البحث والفلترة:
```javascript
test('should filter invoices quickly', async () => {
  const startTime = Date.now();
  const filtered = await filterInvoices({ supplierId: 'SUP001' });
  const filterTime = Date.now() - startTime;
  
  expect(filterTime).toBeLessThan(200); // أقل من 200ms
});
```

### أهداف الأداء:
- تحميل البيانات: < 1 ثانية
- حفظ الفواتير: < 500ms
- البحث والفلترة: < 200ms
- الطباعة: < 2 ثانية

---

## 9. اختبارات الأمان (Security Tests)

### ما يجب اختباره:

#### تشفير كلمات المرور:
```javascript
test('should hash passwords', async () => {
  const password = 'test123';
  const hashed = await hashPassword(password);
  
  expect(hashed).not.toBe(password);
  expect(hashed).toMatch(/^\$2[aby]\$/); // bcrypt format
});
```

#### التحقق من الصلاحيات:
```javascript
test('should enforce permissions', async () => {
  const user = await createUser({
    type: 'sales',
    permissions: ['view_invoices']
  });
  
  // محاولة الوصول لوظيفة غير مصرح بها
  const result = await deleteInvoice(invoiceId, user);
  
  expect(result.success).toBe(false);
  expect(result.error).toContain('غير مصرح');
});
```

#### التحقق من صحة المدخلات:
```javascript
test('should prevent SQL injection', async () => {
  const maliciousInput = "'; DROP TABLE products; --";
  
  const result = await searchProducts(maliciousInput);
  
  // يجب أن يعامل كبحث عادي، وليس تنفيذ SQL
  expect(result).not.toThrow();
});
```

---

## 10. اختبارات التوافق (Compatibility Tests)

### ما يجب اختباره:

#### أنظمة التشغيل:
- ✅ Windows 10
- ✅ Windows 11
- ✅ (اختياري) Linux
- ✅ (اختياري) macOS

#### إصدارات Electron:
- ✅ الإصدار الحالي
- ✅ الإصدار السابق (للتوافق العكسي)

#### أحجام الشاشات:
- ✅ 1920x1080 (Full HD)
- ✅ 1366x768 (HD)
- ✅ 2560x1440 (2K)
- ✅ 3840x2160 (4K)

---

## 11. خطة التنفيذ المقترحة

### المرحلة 1: إعداد البنية التحتية (أسبوع 1)
- [ ] تثبيت Jest أو Mocha
- [ ] إعداد ملفات التكوين (jest.config.js)
- [ ] إنشاء هيكل المجلدات
- [ ] إعداد قاعدة بيانات الاختبار
- [ ] إنشاء Test Helpers

### المرحلة 2: Unit Tests (أسبوع 2-3)
- [ ] اختبار الدوال المساعدة (formatArabicNumber, formatCurrency)
- [ ] اختبار دوال الحسابات (calculateTotals, calculateBalance)
- [ ] اختبار دوال قاعدة البيانات (insert, update, delete, get)
- [ ] اختبار دوال التحقق من صحة المدخلات

### المرحلة 3: Integration Tests (أسبوع 4-5)
- [ ] اختبار تدفق فاتورة المشتريات
- [ ] اختبار تدفق فاتورة المبيعات
- [ ] اختبار تحديثات المخزون
- [ ] اختبار تحديثات الأرصدة
- [ ] اختبار إرجاع المنتجات

### المرحلة 4: E2E Tests (أسبوع 6-7)
- [ ] إعداد Playwright أو Spectron
- [ ] اختبار سيناريوهات المستخدم الكاملة
- [ ] اختبار التفاعلات المعقدة
- [ ] اختبار الطباعة

### المرحلة 5: التحسين والصيانة (أسبوع 8+)
- [ ] تحسين سرعة الاختبارات
- [ ] زيادة التغطية إلى 80%+
- [ ] إضافة CI/CD
- [ ] توثيق الاختبارات
- [ ] إعداد تقارير التغطية

---

## 12. نصائح إضافية

### أفضل الممارسات:

1. **ابدأ بالوظائف الحرجة أولاً**
   - دوال الحسابات المالية
   - دوال قاعدة البيانات
   - دوال تحديث المخزون

2. **استخدم أسماء واضحة للاختبارات**
   ```javascript
   // ❌ سيء
   test('test1', () => { ... });
   
   // ✅ جيد
   test('should calculate total correctly with discount', () => { ... });
   ```

3. **اكتب اختبارات قابلة للقراءة**
   ```javascript
   // ✅ جيد - واضح ومفهوم
   test('should update stock when purchase invoice is created', async () => {
     const initialStock = 100;
     const purchaseQuantity = 50;
     
     await createPurchaseInvoice({ quantity: purchaseQuantity });
     
     const updatedProduct = await getProduct(productId);
     expect(updatedProduct.stock).toBe(initialStock + purchaseQuantity);
   });
   ```

4. **استخدم Arrange-Act-Assert pattern**
   ```javascript
   test('should calculate invoice total', () => {
     // Arrange (الإعداد)
     const subtotal = 1000;
     const shipping = 50;
     const discount = 20;
     
     // Act (التنفيذ)
     const total = calculateTotal(subtotal, shipping, discount);
     
     // Assert (التحقق)
     expect(total).toBe(1030);
   });
   ```

5. **راجع الاختبارات بانتظام**
   - تأكد من أن الاختبارات تعكس المتطلبات الحالية
   - احذف الاختبارات القديمة غير المستخدمة
   - حدث الاختبارات عند تغيير الكود

6. **استخدم Mocking للاعتماديات الخارجية**
   ```javascript
   // Mock للـ Electron API
   jest.mock('electron', () => ({
     ipcRenderer: {
       invoke: jest.fn()
     }
   }));
   ```

7. **اختبار الأخطاء أيضاً**
   ```javascript
   test('should handle invalid input gracefully', () => {
     expect(() => calculateTotal(null, 0, 0)).toThrow();
     expect(() => calculateTotal(-100, 0, 0)).toThrow();
   });
   ```

8. **استخدم Test Coverage Reports**
   - راجع التقارير بانتظام
   - ركز على المناطق غير المغطاة
   - اهدف لتحسين التغطية تدريجياً

---

## 13. أمثلة على ملفات التكوين

### jest.config.js
```javascript
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js'],
  collectCoverageFrom: [
    'scripts/**/*.js',
    'database.js',
    'main.js',
    '!**/node_modules/**',
    '!**/dist/**'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    },
    './scripts/purchases.js': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
};
```

### package.json scripts
```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:e2e": "jest tests/e2e",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  }
}
```

---

## 14. Checklist للاختبارات

### قبل كل Commit:
- [ ] جميع الاختبارات تمر بنجاح
- [ ] لا توجد أخطاء في الكود
- [ ] التغطية لا تقل عن الحد الأدنى

### قبل كل Release:
- [ ] جميع الاختبارات تمر بنجاح
- [ ] التغطية 80%+
- [ ] اختبارات E2E تمر بنجاح
- [ ] اختبارات الأداء ضمن الأهداف
- [ ] اختبارات الأمان تمر بنجاح
- [ ] اختبارات التوافق على أنظمة مختلفة

---

## 15. المراجع والمصادر

### أدوات:
- [Jest Documentation](https://jestjs.io/)
- [Playwright Documentation](https://playwright.dev/)
- [Electron Testing Guide](https://www.electronjs.org/docs/latest/tutorial/automated-testing)

### أفضل الممارسات:
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Test-Driven Development](https://en.wikipedia.org/wiki/Test-driven_development)

---

## الخلاصة

هذه الاستراتيجية توفر إطار عمل شامل لاختبار نظام إدارة شركة أسيل بشكل احترافي. ابدأ بالتنفيذ تدريجياً، وركز على الوظائف الحرجة أولاً، ثم قم بتوسيع التغطية تدريجياً.

**تذكر:** الاختبارات الجيدة هي استثمار في جودة الكود وصيانته على المدى الطويل.

---

**تاريخ الإنشاء:** 2024  
**آخر تحديث:** 2024  
**الإصدار:** 1.0

