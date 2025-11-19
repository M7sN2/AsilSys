# نظام إدارة المخزون والمحاسبة - شركة أسيل

<div dir="rtl">

## 📋 نظرة عامة

نظام إدارة شامل للمخزون والمحاسبة مبني كتطبيق سطح مكتب باستخدام **Electron** و **SQLite**. يوفر النظام إدارة كاملة للمنتجات، المبيعات، المشتريات، العملاء، الموردين، التقارير المالية، والأصول الثابتة.

**الإصدار الحالي:** 1.0.6

---

## ✨ الميزات الرئيسية

### 📦 إدارة المنتجات
- إضافة/تعديل/حذف المنتجات
- إدارة الأصناف (Categories)
- تتبع المخزون الحالي
- إدارة وحدات القياس (صغيرة/كبيرة) ومعامل التحويل
- إدارة أسعار البيع (صغيرة/كبيرة)
- تنبيهات المخزون المنخفض

### 💰 إدارة المبيعات
- إنشاء فواتير مبيعات متعددة العناصر
- حساب الضرائب والخصومات والشحن تلقائياً
- تحديث المخزون تلقائياً عند البيع
- تحديث رصيد العميل تلقائياً
- طباعة الفواتير (نسخة الشركة ونسخة العميل)
- حفظ الفواتير كملفات PDF
- ربط الفواتير بأذون الصرف

### 🛒 إدارة المشتريات
- إنشاء فواتير مشتريات متعددة العناصر
- تحديث المخزون تلقائياً عند الشراء
- تحديث رصيد المورد تلقائياً
- طباعة وحفظ فواتير المشتريات

### 👥 إدارة العملاء
- إضافة/تعديل/حذف العملاء
- تتبع أرصدة العملاء تلقائياً
- سجل حركات العملاء الكامل
- إدارة سندات القبض
- تنبيهات العملاء ذوي الرصيد المرتفع

### 🏢 إدارة الموردين
- إضافة/تعديل/حذف الموردين
- تتبع أرصدة الموردين تلقائياً
- سجل حركات الموردين الكامل
- إدارة سندات الصرف

### 📊 إدارة المخزون
- تعديل المخزون يدوياً (زيادة/نقصان/تحديد)
- تسجيل أسباب التعديل
- سجل تعديلات المخزون الكامل
- تنبيهات المخزون المنخفض/النافذ

### 📈 التقارير المالية
- تقارير المبيعات (يومية/شهرية/سنوية)
- تقارير المشتريات
- تقارير الأرباح والخسائر
- تقارير أرصدة العملاء والموردين
- تقارير المخزون
- تقارير المصروفات
- رسوم بيانية وتحليلات

### 💳 إدارة المدفوعات
- سندات القبض من العملاء
- سندات الصرف للموردين
- إدارة المصروفات
- سجل كامل لجميع المعاملات المالية

### 🏗️ إدارة الأصول الثابتة
- تسجيل الأصول الثابتة
- حساب الاستهلاك
- تتبع قيمة الأصول

### 📋 أذون الصرف والتسوية
- إنشاء أذون صرف
- ربط أذون الصرف بفواتير المبيعات
- إدارة التسويات

### 👤 إدارة المستخدمين والصلاحيات
- نظام مستخدمين متقدم
- صلاحيات دقيقة لكل صفحة
- سجل كامل لجميع العمليات (Action Logs)
- حماية كاملة للبيانات

### 💾 النسخ الاحتياطي والاستعادة
- نسخ احتياطي تلقائي ويدوي
- استعادة البيانات بسهولة
- إدارة تاريخ النسخ الاحتياطي

---

## 🛠️ التقنيات المستخدمة

- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **Backend:** Node.js (Electron Main Process)
- **Database:** SQLite (better-sqlite3)
- **Framework:** Electron 28.0.0
- **Security:** bcryptjs للتشفير
- **Architecture:** Monolithic Desktop Application

---

## 📦 متطلبات النظام

### للتشغيل (للمستخدم النهائي)
- ✅ نظام التشغيل: Windows 7 أو أحدث
- ✅ البنية: 64-bit (x64)
- ✅ الذاكرة: 2 GB RAM كحد أدنى (4 GB موصى به)
- ✅ مساحة القرص: 500 MB

### للتطوير
- ✅ Node.js 16 أو أحدث
- ✅ npm أو yarn
- ✅ Git (اختياري)

---

## 🚀 التثبيت والتشغيل

### للمستخدم النهائي

1. **تحميل المثبت:**
   - قم بتحميل ملف `أسيل-Setup-1.0.6.exe` من مجلد `dist`

2. **تشغيل المثبت:**
   - قم بتشغيل ملف المثبت
   - إذا ظهر تحذير من Windows:
     - انقر على "More info" (مزيد من المعلومات)
     - انقر على "Run anyway" (تشغيل على أي حال)
     - (هذا التحذير طبيعي لأن التطبيق غير موقّع رقمياً)

3. **اتباع خطوات المثبت:**
   - اختر مجلد التثبيت (افتراضي: `C:\Program Files\أسيل`)
   - انقر على "Install" (تثبيت)
   - انتظر حتى يكتمل التثبيت

4. **بعد اكتمال التثبيت:**
   - سيتم تشغيل التطبيق تلقائياً
   - سيتم إنشاء اختصار على سطح المكتب
   - سيتم إنشاء اختصار في قائمة ابدأ

### للمطورين

1. **استنساخ المستودع:**
   ```bash
   git clone <repository-url>
   cd asel-sys
   ```

2. **تثبيت المتطلبات:**
   ```bash
   npm install
   ```

3. **إعادة بناء better-sqlite3 (مطلوب):**
   ```bash
   npm run rebuild
   ```

4. **تشغيل التطبيق في وضع التطوير:**
   ```bash
   npm start
   ```
   أو
   ```bash
   npm run dev
   ```

5. **بناء المثبت:**
   ```bash
   npm run dist
   ```
   أو بدون توقيع:
   ```bash
   npm run dist:skip-sign
   ```

---

## 🔐 بيانات الدخول الافتراضية

### حساب المدير (Admin)
- **اسم المستخدم:** `admin`
- **كلمة المرور:** `admin`

### حساب المستخدم العادي
- **اسم المستخدم:** `user`
- **كلمة المرور:** `1234`

> ⚠️ **تحذير:** يرجى تغيير كلمات المرور الافتراضية فوراً بعد التثبيت لأول مرة!

---

## 📁 بنية المشروع

```
asel-sys/
├── main.js                    # العملية الرئيسية لـ Electron + IPC Handlers
├── database.js                # إدارة قاعدة البيانات (SQLite)
├── preload.js                 # Bridge بين Renderer و Main Process
├── package.json               # إعدادات المشروع والتبعيات
├── index.html                 # الصفحة الرئيسية (Dashboard)
├── login.html                 # صفحة تسجيل الدخول
│
├── scripts/                   # ملفات JavaScript
│   ├── login.js              # منطق تسجيل الدخول
│   ├── dashboard.js          # لوحة التحكم
│   ├── products.js           # إدارة المنتجات
│   ├── sales.js              # إدارة المبيعات
│   ├── purchases.js          # إدارة المشتريات
│   ├── customers.js          # إدارة العملاء
│   ├── suppliers.js          # إدارة الموردين
│   ├── receipts.js           # سندات القبض
│   ├── payments.js           # سندات الصرف
│   ├── inventory.js          # إدارة المخزون
│   ├── assets.js             # الأصول الثابتة
│   ├── reports.js            # التقارير
│   ├── users.js              # إدارة المستخدمين
│   ├── expenses.js           # المصروفات
│   ├── delivery-notes.js     # أذون الصرف
│   ├── settlements.js        # التسويات
│   ├── action-logs.js        # سجل العمليات
│   ├── permissions.js        # إدارة الصلاحيات
│   ├── sidebar.js            # القائمة الجانبية
│   └── header.js             # شريط الأدوات العلوي
│
├── styles/                    # ملفات CSS
│   ├── main.css              # التنسيقات الرئيسية
│   ├── login.css             # تنسيقات تسجيل الدخول
│   ├── dashboard.css         # تنسيقات لوحة التحكم
│   └── ...                   # تنسيقات أخرى للصفحات
│
├── assets/                    # الملفات الثابتة
│   ├── icon-asel.ico         # أيقونة التطبيق
│   └── ...                   # صور وأيقونات أخرى
│
├── migrations/                # ملفات الهجرة لقاعدة البيانات
│   ├── *.sql                 # ملفات SQL للهجرة
│   └── *.js                  # سكريبتات الهجرة
│
├── tests/                     # الاختبارات
│   ├── unit/                 # اختبارات الوحدة
│   ├── integration/          # اختبارات التكامل
│   └── helpers/              # مساعدات الاختبار
│
└── dist/                      # ملفات البناء
    └── أسيل-Setup-*.exe      # المثبت النهائي
```

---

## 🎯 الاستخدام

### 1. تسجيل الدخول
- قم بتشغيل التطبيق
- أدخل اسم المستخدم وكلمة المرور
- انقر على "تسجيل الدخول"

### 2. إدارة المنتجات
- من القائمة الجانبية، اختر "المنتجات"
- انقر على "إضافة منتج جديد" لإضافة منتج
- يمكنك تعديل أو حذف المنتجات من القائمة

### 3. إنشاء فاتورة مبيعات
- من القائمة الجانبية، اختر "المبيعات"
- انقر على "فاتورة مبيعات جديدة"
- اختر العميل
- أضف المنتجات والكميات
- احفظ الفاتورة

### 4. عرض التقارير
- من القائمة الجانبية، اختر "التقارير"
- اختر نوع التقرير المطلوب
- حدد الفترة الزمنية
- انقر على "عرض التقرير"

---

## 🔧 الأوامر المتاحة

```bash
# تشغيل التطبيق
npm start

# تشغيل في وضع التطوير
npm run dev

# إعادة بناء better-sqlite3
npm run rebuild

# بناء المثبت
npm run dist

# بناء المثبت بدون توقيع
npm run dist:skip-sign

# تشغيل الاختبارات
npm test

# تشغيل اختبارات الوحدة
npm run test:unit

# تشغيل اختبارات التكامل
npm run test:integration

# تشغيل الاختبارات مع التغطية
npm run test:coverage
```

---

## 🐛 حل المشاكل الشائعة

### التطبيق لا يعمل بعد التثبيت
- ✅ تأكد من تثبيت Visual C++ Redistributable
- ✅ تحقق من أن Windows محدث
- ✅ أعد تشغيل التطبيق كمسؤول (Run as Administrator)

### التطبيق بطيء
- ✅ هذا طبيعي على أجهزة ضعيفة
- ✅ تأكد من أن النظام يلبي المتطلبات الدنيا
- ✅ أغلق التطبيقات الأخرى لتحرير الذاكرة

### خطأ في قاعدة البيانات
- ✅ تأكد من أن المستخدم لديه صلاحيات الكتابة
- ✅ أعد تشغيل التطبيق كمسؤول
- ✅ تحقق من مساحة القرص المتاحة

### مشكلة في better-sqlite3
- ✅ قم بتشغيل `npm run rebuild`
- ✅ تأكد من تثبيت Python و Visual Studio Build Tools

---

## 📝 الترخيص

MIT License

---

## 👨‍💻 المطور

**المهندس محمد محسن**

---

## 📞 الدعم الفني

للمساعدة والدعم الفني، يرجى التواصل مع المطور.

---

## 📚 الوثائق الإضافية

- [SYSTEM_DOCUMENTATION_AR.md](SYSTEM_DOCUMENTATION_AR.md) - وثائق النظام بالعربية
- [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md) - تصميم النظام
- [DATABASE_ERD.md](DATABASE_ERD.md) - مخطط قاعدة البيانات
- [CHANGELOG.md](CHANGELOG.md) - سجل التغييرات
- [TESTING_STRATEGY_AR.md](TESTING_STRATEGY_AR.md) - استراتيجية الاختبار

---

## 🔄 الإصدارات

### الإصدار 1.0.6 (الحالي)
- إصلاحات وتحسينات عامة

### الإصدار 1.0.4
- إصلاح منطق كمية المرتجع في سجل الحركات
- تحسينات في عرض أنواع الحركات

### الإصدار 1.0.2
- إصلاح مشكلة إغلاق التطبيق بعد تسجيل الدخول
- إصلاح مشكلة ظهور نافذتين معاً
- تحسين معالجة الأخطاء

---

## ⚠️ ملاحظات مهمة

- ⚠️ التطبيق لا يحتاج للإنترنت للعمل
- ⚠️ جميع البيانات محفوظة محلياً على جهازك
- ⚠️ لا تقم بحذف مجلد التطبيق يدوياً (استخدم إلغاء التثبيت)
- ⚠️ قم بعمل نسخ احتياطي دوري للبيانات
- ⚠️ غير كلمات المرور الافتراضية فوراً

---

## 🎉 شكراً لاستخدامك نظام أسيل!

© 2025 نظام أسيل - جميع الحقوق محفوظة

</div>

---

<div dir="ltr">

# Inventory & Accounting Management System - Asel Company

## 📋 Overview

A comprehensive inventory and accounting management system built as a desktop application using **Electron** and **SQLite**. The system provides complete management for products, sales, purchases, customers, suppliers, financial reports, and fixed assets.

**Current Version:** 1.0.6

---

## ✨ Key Features

### 📦 Product Management
- Add/Edit/Delete products
- Category management
- Real-time inventory tracking
- Unit of measurement management (small/large) with conversion factors
- Price management (small/large units)
- Low stock alerts

### 💰 Sales Management
- Create multi-item sales invoices
- Automatic tax, discount, and shipping calculations
- Automatic inventory updates on sale
- Automatic customer balance updates
- Invoice printing (company copy and customer copy)
- Save invoices as PDF files
- Link invoices to delivery notes

### 🛒 Purchase Management
- Create multi-item purchase invoices
- Automatic inventory updates on purchase
- Automatic supplier balance updates
- Print and save purchase invoices

### 👥 Customer Management
- Add/Edit/Delete customers
- Automatic customer balance tracking
- Complete customer transaction history
- Receipt management
- High balance customer alerts

### 🏢 Supplier Management
- Add/Edit/Delete suppliers
- Automatic supplier balance tracking
- Complete supplier transaction history
- Payment voucher management

### 📊 Inventory Management
- Manual inventory adjustments (increase/decrease/set)
- Adjustment reason logging
- Complete inventory adjustment history
- Low/out of stock alerts

### 📈 Financial Reports
- Sales reports (daily/monthly/yearly)
- Purchase reports
- Profit & Loss reports
- Customer and supplier balance reports
- Inventory reports
- Expense reports
- Charts and analytics

### 💳 Payment Management
- Customer receipts
- Supplier payments
- Expense management
- Complete transaction history

### 🏗️ Fixed Assets Management
- Fixed asset registration
- Depreciation calculation
- Asset value tracking

### 📋 Delivery Notes & Settlements
- Create delivery notes
- Link delivery notes to sales invoices
- Settlement management

### 👤 User & Permission Management
- Advanced user system
- Granular permissions per page
- Complete operation logs (Action Logs)
- Full data protection

### 💾 Backup & Restore
- Automatic and manual backups
- Easy data restoration
- Backup history management

---

## 🛠️ Technologies Used

- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **Backend:** Node.js (Electron Main Process)
- **Database:** SQLite (better-sqlite3)
- **Framework:** Electron 28.0.0
- **Security:** bcryptjs for encryption
- **Architecture:** Monolithic Desktop Application

---

## 📦 System Requirements

### For End Users
- ✅ OS: Windows 7 or later
- ✅ Architecture: 64-bit (x64)
- ✅ Memory: 2 GB RAM minimum (4 GB recommended)
- ✅ Disk Space: 500 MB

### For Development
- ✅ Node.js 16 or later
- ✅ npm or yarn
- ✅ Git (optional)

---

## 🚀 Installation & Running

### For End Users

1. **Download Installer:**
   - Download `أسيل-Setup-1.0.6.exe` from the `dist` folder

2. **Run Installer:**
   - Run the installer file
   - If Windows shows a warning:
     - Click "More info"
     - Click "Run anyway"
     - (This is normal as the app is not digitally signed)

3. **Follow Installer Steps:**
   - Choose installation directory (default: `C:\Program Files\أسيل`)
   - Click "Install"
   - Wait for installation to complete

4. **After Installation:**
   - The app will launch automatically
   - Desktop shortcut will be created
   - Start menu shortcut will be created

### For Developers

1. **Clone Repository:**
   ```bash
   git clone <repository-url>
   cd asel-sys
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Rebuild better-sqlite3 (Required):**
   ```bash
   npm run rebuild
   ```

4. **Run in Development Mode:**
   ```bash
   npm start
   ```
   or
   ```bash
   npm run dev
   ```

5. **Build Installer:**
   ```bash
   npm run dist
   ```
   or without signing:
   ```bash
   npm run dist:skip-sign
   ```

---

## 🔐 Default Login Credentials

### Admin Account
- **Username:** `admin`
- **Password:** `admin`

### Regular User Account
- **Username:** `user`
- **Password:** `1234`

> ⚠️ **Warning:** Please change default passwords immediately after first installation!

---

## 📁 Project Structure

```
asel-sys/
├── main.js                    # Electron main process + IPC handlers
├── database.js                # Database management (SQLite)
├── preload.js                 # Bridge between Renderer and Main process
├── package.json               # Project settings and dependencies
├── index.html                 # Main page (Dashboard)
├── login.html                 # Login page
│
├── scripts/                   # JavaScript files
│   ├── login.js              # Login logic
│   ├── dashboard.js          # Dashboard
│   ├── products.js           # Product management
│   ├── sales.js              # Sales management
│   ├── purchases.js          # Purchase management
│   ├── customers.js          # Customer management
│   ├── suppliers.js          # Supplier management
│   ├── receipts.js           # Receipts
│   ├── payments.js           # Payments
│   ├── inventory.js          # Inventory management
│   ├── assets.js             # Fixed assets
│   ├── reports.js            # Reports
│   ├── users.js              # User management
│   ├── expenses.js           # Expenses
│   ├── delivery-notes.js     # Delivery notes
│   ├── settlements.js        # Settlements
│   ├── action-logs.js        # Operation logs
│   ├── permissions.js        # Permission management
│   ├── sidebar.js            # Sidebar
│   └── header.js             # Top toolbar
│
├── styles/                    # CSS files
│   ├── main.css              # Main styles
│   ├── login.css             # Login styles
│   ├── dashboard.css         # Dashboard styles
│   └── ...                   # Other page styles
│
├── assets/                    # Static files
│   ├── icon-asel.ico         # App icon
│   └── ...                   # Other images and icons
│
├── migrations/                # Database migration files
│   ├── *.sql                 # SQL migration files
│   └── *.js                  # Migration scripts
│
├── tests/                     # Tests
│   ├── unit/                 # Unit tests
│   ├── integration/          # Integration tests
│   └── helpers/              # Test helpers
│
└── dist/                      # Build files
    └── أسيل-Setup-*.exe      # Final installer
```

---

## 🎯 Usage

### 1. Login
- Launch the application
- Enter username and password
- Click "تسجيل الدخول" (Login)

### 2. Manage Products
- From the sidebar, select "المنتجات" (Products)
- Click "إضافة منتج جديد" (Add New Product) to add a product
- You can edit or delete products from the list

### 3. Create Sales Invoice
- From the sidebar, select "المبيعات" (Sales)
- Click "فاتورة مبيعات جديدة" (New Sales Invoice)
- Select customer
- Add products and quantities
- Save invoice

### 4. View Reports
- From the sidebar, select "التقارير" (Reports)
- Select the desired report type
- Set time period
- Click "عرض التقرير" (View Report)

---

## 🔧 Available Commands

```bash
# Run application
npm start

# Run in development mode
npm run dev

# Rebuild better-sqlite3
npm run rebuild

# Build installer
npm run dist

# Build installer without signing
npm run dist:skip-sign

# Run tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run tests with coverage
npm run test:coverage
```

---

## 🐛 Troubleshooting

### Application doesn't work after installation
- ✅ Make sure Visual C++ Redistributable is installed
- ✅ Check that Windows is updated
- ✅ Restart the application as Administrator

### Application is slow
- ✅ This is normal on weak devices
- ✅ Make sure the system meets minimum requirements
- ✅ Close other applications to free memory

### Database error
- ✅ Make sure the user has write permissions
- ✅ Restart the application as Administrator
- ✅ Check available disk space

### better-sqlite3 issue
- ✅ Run `npm run rebuild`
- ✅ Make sure Python and Visual Studio Build Tools are installed

---

## 📝 License

MIT License

---

## 👨‍💻 Developer

**Engineer Mohamed Mohsen**

---

## 📞 Technical Support

For help and technical support, please contact the developer.

---

## 📚 Additional Documentation

- [SYSTEM_DOCUMENTATION_AR.md](SYSTEM_DOCUMENTATION_AR.md) - System documentation in Arabic
- [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md) - System design
- [DATABASE_ERD.md](DATABASE_ERD.md) - Database ERD
- [CHANGELOG.md](CHANGELOG.md) - Changelog
- [TESTING_STRATEGY_AR.md](TESTING_STRATEGY_AR.md) - Testing strategy

---

## 🔄 Versions

### Version 1.0.6 (Current)
- General fixes and improvements

### Version 1.0.4
- Fixed return quantity logic in transaction log
- Improvements in transaction type display

### Version 1.0.2
- Fixed application closing after login
- Fixed issue with two windows appearing together
- Improved error handling

---

## ⚠️ Important Notes

- ⚠️ Application does not require internet to work
- ⚠️ All data is stored locally on your device
- ⚠️ Do not delete the application folder manually (use uninstall)
- ⚠️ Perform regular data backups
- ⚠️ Change default passwords immediately

---

## 🎉 Thank you for using Asel System!

© 2025 Asel System - All rights reserved

</div>
