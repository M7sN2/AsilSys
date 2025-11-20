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



© 2025 Asel System - All rights reserved

</div>
