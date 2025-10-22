-- ============================================================
-- Migration Script: Convert REAL to INTEGER for Financial Amounts
-- ============================================================
-- Description: Convert all financial amounts from REAL (decimal) to INTEGER (cents)
--              Example: 100.50 ج.م → 10050 قرش
-- Date: 2025-01-XX
-- Version: 1.0.0
-- ============================================================

-- ============================================================
-- STEP 1: CREATE BACKUP TABLES
-- ============================================================
-- Create backup tables for all tables that will be modified
-- This allows rollback if needed

BEGIN TRANSACTION;

-- Backup Products Table
CREATE TABLE IF NOT EXISTS products_backup AS SELECT * FROM products;

-- Backup Customers Table
CREATE TABLE IF NOT EXISTS customers_backup AS SELECT * FROM customers;

-- Backup Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers_backup AS SELECT * FROM suppliers;

-- Backup Sales Invoices Table
CREATE TABLE IF NOT EXISTS sales_invoices_backup AS SELECT * FROM sales_invoices;

-- Backup Sales Invoice Items Table
CREATE TABLE IF NOT EXISTS sales_invoice_items_backup AS SELECT * FROM sales_invoice_items;

-- Backup Purchase Invoices Table
CREATE TABLE IF NOT EXISTS purchase_invoices_backup AS SELECT * FROM purchase_invoices;

-- Backup Purchase Invoice Items Table
CREATE TABLE IF NOT EXISTS purchase_invoice_items_backup AS SELECT * FROM purchase_invoice_items;

-- Backup Receipts Table
CREATE TABLE IF NOT EXISTS receipts_backup AS SELECT * FROM receipts;

-- Backup Payments Table
CREATE TABLE IF NOT EXISTS payments_backup AS SELECT * FROM payments;

-- Backup Returns Table
CREATE TABLE IF NOT EXISTS returns_backup AS SELECT * FROM returns;

-- Backup Fixed Assets Table
CREATE TABLE IF NOT EXISTS fixed_assets_backup AS SELECT * FROM fixed_assets;

-- Backup Operating Expenses Table
CREATE TABLE IF NOT EXISTS operating_expenses_backup AS SELECT * FROM operating_expenses;

-- Backup Company Info Table
CREATE TABLE IF NOT EXISTS company_info_backup AS SELECT * FROM company_info;

-- Backup Delivery Note Items Table (for quantity fields that might be REAL)
CREATE TABLE IF NOT EXISTS delivery_note_items_backup AS SELECT * FROM delivery_note_items;

-- Backup Settlement Items Table
CREATE TABLE IF NOT EXISTS settlement_items_backup AS SELECT * FROM settlement_items;

-- Backup Inventory Adjustments Table
CREATE TABLE IF NOT EXISTS inventory_adjustments_backup AS SELECT * FROM inventory_adjustments;

COMMIT;

-- ============================================================
-- STEP 2: DROP ALL INDEXES
-- ============================================================
-- Drop indexes before table recreation to avoid conflicts

BEGIN TRANSACTION;

DROP INDEX IF EXISTS idx_products_category;
DROP INDEX IF EXISTS idx_products_status;
DROP INDEX IF EXISTS idx_sales_invoices_customer;
DROP INDEX IF EXISTS idx_sales_invoices_date;
DROP INDEX IF EXISTS idx_sales_invoices_delivery_note;
DROP INDEX IF EXISTS idx_sales_invoices_date_customer;
DROP INDEX IF EXISTS idx_sales_invoice_items_invoice;
DROP INDEX IF EXISTS idx_sales_invoice_items_invoice_product;
DROP INDEX IF EXISTS idx_sales_invoice_items_product;
DROP INDEX IF EXISTS idx_sales_invoice_items_product_date;
DROP INDEX IF EXISTS idx_purchase_invoices_supplier;
DROP INDEX IF EXISTS idx_purchase_invoices_date;
DROP INDEX IF EXISTS idx_purchase_invoice_items_invoice;
DROP INDEX IF EXISTS idx_purchase_invoice_items_product;
DROP INDEX IF EXISTS idx_purchase_invoice_items_invoice_product;
DROP INDEX IF EXISTS idx_receipts_customer;
DROP INDEX IF EXISTS idx_receipts_date;
DROP INDEX IF EXISTS idx_payments_supplier;
DROP INDEX IF EXISTS idx_payments_date;
DROP INDEX IF EXISTS idx_fixed_assets_category;
DROP INDEX IF EXISTS idx_fixed_assets_status;
DROP INDEX IF EXISTS idx_operating_expenses_date;
DROP INDEX IF EXISTS idx_operating_expenses_category;
DROP INDEX IF EXISTS idx_delivery_notes_status;
DROP INDEX IF EXISTS idx_delivery_notes_date;
DROP INDEX IF EXISTS idx_delivery_note_items_delivery_note;
DROP INDEX IF EXISTS idx_delivery_settlements_delivery_note;
DROP INDEX IF EXISTS idx_delivery_settlements_status;
DROP INDEX IF EXISTS idx_settlement_items_settlement;

COMMIT;

-- ============================================================
-- STEP 3: RECREATE TABLES WITH INTEGER FOR FINANCIAL AMOUNTS
-- ============================================================

BEGIN TRANSACTION;

-- ============================================================
-- Products Table
-- ============================================================
CREATE TABLE products_new (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    smallestUnit TEXT NOT NULL,
    largestUnit TEXT NOT NULL,
    conversionFactor REAL NOT NULL DEFAULT 1,  -- Keep REAL (not financial)
    smallestPrice INTEGER NOT NULL DEFAULT 0,    -- Changed: REAL → INTEGER
    largestPrice INTEGER NOT NULL DEFAULT 0,     -- Changed: REAL → INTEGER
    stock REAL NOT NULL DEFAULT 0,              -- Keep REAL (quantity, not financial)
    openingStock REAL NOT NULL DEFAULT 0,       -- Keep REAL (quantity, not financial)
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    lastSaleDate TEXT,
    createdBy TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
);

-- Migrate data: Convert prices from REAL to INTEGER (multiply by 100)
INSERT INTO products_new 
SELECT 
    id,
    code,
    name,
    category,
    smallestUnit,
    largestUnit,
    conversionFactor,
    CAST(ROUND(smallestPrice * 100) AS INTEGER) as smallestPrice,
    CAST(ROUND(largestPrice * 100) AS INTEGER) as largestPrice,
    stock,
    openingStock,
    notes,
    status,
    lastSaleDate,
    createdBy,
    createdAt,
    updatedAt
FROM products;

-- ============================================================
-- Customers Table
-- ============================================================
CREATE TABLE customers_new (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    firstTransactionDate TEXT,
    openingBalance INTEGER NOT NULL DEFAULT 0,  -- Changed: REAL → INTEGER
    balance INTEGER NOT NULL DEFAULT 0,         -- Changed: REAL → INTEGER
    status TEXT NOT NULL DEFAULT 'active',
    lastTransactionDate TEXT,
    notes TEXT,
    createdBy TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
);

-- Migrate data: Convert balances from REAL to INTEGER
INSERT INTO customers_new 
SELECT 
    id,
    code,
    name,
    phone,
    address,
    firstTransactionDate,
    CAST(ROUND(openingBalance * 100) AS INTEGER) as openingBalance,
    CAST(ROUND(balance * 100) AS INTEGER) as balance,
    status,
    lastTransactionDate,
    notes,
    createdBy,
    createdAt,
    updatedAt
FROM customers;

-- ============================================================
-- Suppliers Table
-- ============================================================
CREATE TABLE suppliers_new (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    firstTransactionDate TEXT,
    openingBalance INTEGER NOT NULL DEFAULT 0,  -- Changed: REAL → INTEGER
    balance INTEGER NOT NULL DEFAULT 0,         -- Changed: REAL → INTEGER
    status TEXT NOT NULL DEFAULT 'active',
    lastTransactionDate TEXT,
    createdBy TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
);

-- Migrate data: Convert balances from REAL to INTEGER
INSERT INTO suppliers_new 
SELECT 
    id,
    code,
    name,
    phone,
    address,
    firstTransactionDate,
    CAST(ROUND(openingBalance * 100) AS INTEGER) as openingBalance,
    CAST(ROUND(balance * 100) AS INTEGER) as balance,
    status,
    lastTransactionDate,
    createdBy,
    createdAt,
    updatedAt
FROM suppliers;

-- ============================================================
-- Sales Invoices Table
-- ============================================================
CREATE TABLE sales_invoices_new (
    id TEXT PRIMARY KEY,
    invoiceNumber TEXT UNIQUE NOT NULL,
    customerId TEXT NOT NULL,
    date TEXT NOT NULL,
    dueDate TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    subtotal INTEGER NOT NULL DEFAULT 0,       -- Changed: REAL → INTEGER
    taxRate REAL NOT NULL DEFAULT 0,            -- Keep REAL (percentage, not amount)
    taxAmount INTEGER NOT NULL DEFAULT 0,        -- Changed: REAL → INTEGER
    shipping INTEGER NOT NULL DEFAULT 0,        -- Changed: REAL → INTEGER
    discount INTEGER NOT NULL DEFAULT 0,         -- Changed: REAL → INTEGER
    total INTEGER NOT NULL DEFAULT 0,           -- Changed: REAL → INTEGER
    paid INTEGER NOT NULL DEFAULT 0,            -- Changed: REAL → INTEGER
    remaining INTEGER NOT NULL DEFAULT 0,       -- Changed: REAL → INTEGER
    paymentMethod TEXT,
    notes TEXT,
    createdBy TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deliveryNoteId TEXT,
    deliveryNoteNumber TEXT,
    FOREIGN KEY (customerId) REFERENCES customers_new(id)
);

-- Migrate data: Convert all financial amounts from REAL to INTEGER
INSERT INTO sales_invoices_new 
SELECT 
    id,
    invoiceNumber,
    customerId,
    date,
    dueDate,
    status,
    CAST(ROUND(subtotal * 100) AS INTEGER) as subtotal,
    taxRate,
    CAST(ROUND(taxAmount * 100) AS INTEGER) as taxAmount,
    CAST(ROUND(shipping * 100) AS INTEGER) as shipping,
    CAST(ROUND(discount * 100) AS INTEGER) as discount,
    CAST(ROUND(total * 100) AS INTEGER) as total,
    CAST(ROUND(paid * 100) AS INTEGER) as paid,
    CAST(ROUND(remaining * 100) AS INTEGER) as remaining,
    paymentMethod,
    notes,
    createdBy,
    createdAt,
    updatedAt,
    deliveryNoteId,
    deliveryNoteNumber
FROM sales_invoices;

-- ============================================================
-- Sales Invoice Items Table
-- ============================================================
CREATE TABLE sales_invoice_items_new (
    id TEXT PRIMARY KEY,
    invoiceId TEXT NOT NULL,
    productId TEXT NOT NULL,
    productName TEXT NOT NULL,
    unit TEXT NOT NULL,
    quantity REAL NOT NULL,                     -- Keep REAL (quantity, not financial)
    price INTEGER NOT NULL,                      -- Changed: REAL → INTEGER
    total INTEGER NOT NULL,                      -- Changed: REAL → INTEGER
    FOREIGN KEY (invoiceId) REFERENCES sales_invoices_new(id) ON DELETE CASCADE,
    FOREIGN KEY (productId) REFERENCES products_new(id)
);

-- Migrate data: Convert price and total from REAL to INTEGER
INSERT INTO sales_invoice_items_new 
SELECT 
    id,
    invoiceId,
    productId,
    productName,
    unit,
    quantity,
    CAST(ROUND(price * 100) AS INTEGER) as price,
    CAST(ROUND(total * 100) AS INTEGER) as total
FROM sales_invoice_items;

-- ============================================================
-- Purchase Invoices Table
-- ============================================================
CREATE TABLE purchase_invoices_new (
    id TEXT PRIMARY KEY,
    invoiceNumber TEXT UNIQUE NOT NULL,
    supplierId TEXT NOT NULL,
    date TEXT NOT NULL,
    dueDate TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    subtotal INTEGER NOT NULL DEFAULT 0,        -- Changed: REAL → INTEGER
    taxRate REAL NOT NULL DEFAULT 0,             -- Keep REAL (percentage, not amount)
    taxAmount INTEGER NOT NULL DEFAULT 0,        -- Changed: REAL → INTEGER
    shipping INTEGER NOT NULL DEFAULT 0,         -- Changed: REAL → INTEGER
    discount INTEGER NOT NULL DEFAULT 0,         -- Changed: REAL → INTEGER
    total INTEGER NOT NULL DEFAULT 0,            -- Changed: REAL → INTEGER
    paid INTEGER NOT NULL DEFAULT 0,             -- Changed: REAL → INTEGER
    remaining INTEGER NOT NULL DEFAULT 0,        -- Changed: REAL → INTEGER
    paymentMethod TEXT,
    notes TEXT,
    createdBy TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (supplierId) REFERENCES suppliers_new(id)
);

-- Migrate data: Convert all financial amounts from REAL to INTEGER
INSERT INTO purchase_invoices_new 
SELECT 
    id,
    invoiceNumber,
    supplierId,
    date,
    dueDate,
    status,
    CAST(ROUND(subtotal * 100) AS INTEGER) as subtotal,
    taxRate,
    CAST(ROUND(taxAmount * 100) AS INTEGER) as taxAmount,
    CAST(ROUND(shipping * 100) AS INTEGER) as shipping,
    CAST(ROUND(discount * 100) AS INTEGER) as discount,
    CAST(ROUND(total * 100) AS INTEGER) as total,
    CAST(ROUND(paid * 100) AS INTEGER) as paid,
    CAST(ROUND(remaining * 100) AS INTEGER) as remaining,
    paymentMethod,
    notes,
    createdBy,
    createdAt,
    updatedAt
FROM purchase_invoices;

-- ============================================================
-- Purchase Invoice Items Table
-- ============================================================
CREATE TABLE purchase_invoice_items_new (
    id TEXT PRIMARY KEY,
    invoiceId TEXT NOT NULL,
    productId TEXT NOT NULL,
    productName TEXT NOT NULL,
    category TEXT,
    unit TEXT NOT NULL,
    quantity REAL NOT NULL,                     -- Keep REAL (quantity, not financial)
    price INTEGER NOT NULL,                      -- Changed: REAL → INTEGER
    total INTEGER NOT NULL,                      -- Changed: REAL → INTEGER
    FOREIGN KEY (invoiceId) REFERENCES purchase_invoices_new(id) ON DELETE CASCADE,
    FOREIGN KEY (productId) REFERENCES products_new(id)
);

-- Migrate data: Convert price and total from REAL to INTEGER
INSERT INTO purchase_invoice_items_new 
SELECT 
    id,
    invoiceId,
    productId,
    productName,
    category,
    unit,
    quantity,
    CAST(ROUND(price * 100) AS INTEGER) as price,
    CAST(ROUND(total * 100) AS INTEGER) as total
FROM purchase_invoice_items;

-- ============================================================
-- Receipts Table
-- ============================================================
CREATE TABLE receipts_new (
    id TEXT PRIMARY KEY,
    receiptNumber TEXT UNIQUE NOT NULL,
    customerId TEXT NOT NULL,
    date TEXT NOT NULL,
    amount INTEGER NOT NULL,                     -- Changed: REAL → INTEGER
    paymentMethod TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    createdBy TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (customerId) REFERENCES customers_new(id)
);

-- Migrate data: Convert amount from REAL to INTEGER
INSERT INTO receipts_new 
SELECT 
    id,
    receiptNumber,
    customerId,
    date,
    CAST(ROUND(amount * 100) AS INTEGER) as amount,
    paymentMethod,
    status,
    notes,
    createdBy,
    createdAt,
    updatedAt
FROM receipts;

-- ============================================================
-- Payments Table
-- ============================================================
CREATE TABLE payments_new (
    id TEXT PRIMARY KEY,
    paymentNumber TEXT UNIQUE NOT NULL,
    supplierId TEXT,
    type TEXT NOT NULL,
    toName TEXT,
    date TEXT NOT NULL,
    amount INTEGER NOT NULL,                      -- Changed: REAL → INTEGER
    paymentMethod TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    createdBy TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (supplierId) REFERENCES suppliers_new(id)
);

-- Migrate data: Convert amount from REAL to INTEGER
INSERT INTO payments_new 
SELECT 
    id,
    paymentNumber,
    supplierId,
    type,
    toName,
    date,
    CAST(ROUND(amount * 100) AS INTEGER) as amount,
    paymentMethod,
    status,
    notes,
    createdBy,
    createdAt,
    updatedAt
FROM payments;

-- ============================================================
-- Returns Table
-- ============================================================
CREATE TABLE returns_new (
    id TEXT PRIMARY KEY,
    returnNumber TEXT UNIQUE NOT NULL,
    productId TEXT NOT NULL,
    date TEXT NOT NULL,
    operationType TEXT NOT NULL,
    returnType TEXT NOT NULL,
    entityId TEXT,
    entityType TEXT,
    invoiceId TEXT,
    invoiceType TEXT,
    invoiceNumber TEXT,
    quantity REAL NOT NULL,                      -- Keep REAL (quantity, not financial)
    unitPrice INTEGER NOT NULL,                  -- Changed: REAL → INTEGER
    totalAmount INTEGER NOT NULL,                 -- Changed: REAL → INTEGER
    returnReason TEXT NOT NULL,
    isDamaged TEXT NOT NULL DEFAULT 'false',
    restoredToStock TEXT NOT NULL DEFAULT 'false',
    restoreBalance TEXT NOT NULL DEFAULT 'false',
    notes TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    userId TEXT,
    FOREIGN KEY (productId) REFERENCES products_new(id)
);

-- Migrate data: Convert unitPrice and totalAmount from REAL to INTEGER
INSERT INTO returns_new 
SELECT 
    id,
    returnNumber,
    productId,
    date,
    operationType,
    returnType,
    entityId,
    entityType,
    invoiceId,
    invoiceType,
    invoiceNumber,
    quantity,
    CAST(ROUND(unitPrice * 100) AS INTEGER) as unitPrice,
    CAST(ROUND(totalAmount * 100) AS INTEGER) as totalAmount,
    returnReason,
    isDamaged,
    restoredToStock,
    restoreBalance,
    notes,
    createdAt,
    updatedAt,
    userId
FROM returns;

-- ============================================================
-- Fixed Assets Table
-- ============================================================
CREATE TABLE fixed_assets_new (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    purchaseDate TEXT NOT NULL,
    purchasePrice INTEGER NOT NULL DEFAULT 0,     -- Changed: REAL → INTEGER
    currentValue INTEGER NOT NULL DEFAULT 0,      -- Changed: REAL → INTEGER
    depreciationRate REAL NOT NULL DEFAULT 0,    -- Keep REAL (percentage, not amount)
    location TEXT,
    department TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    description TEXT,
    supplierId TEXT,
    warrantyExpiryDate TEXT,
    notes TEXT,
    createdBy TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (supplierId) REFERENCES suppliers_new(id)
);

-- Migrate data: Convert purchasePrice and currentValue from REAL to INTEGER
INSERT INTO fixed_assets_new 
SELECT 
    id,
    code,
    name,
    category,
    purchaseDate,
    CAST(ROUND(purchasePrice * 100) AS INTEGER) as purchasePrice,
    CAST(ROUND(currentValue * 100) AS INTEGER) as currentValue,
    depreciationRate,
    location,
    department,
    status,
    description,
    supplierId,
    warrantyExpiryDate,
    notes,
    createdBy,
    createdAt,
    updatedAt
FROM fixed_assets;

-- ============================================================
-- Operating Expenses Table
-- ============================================================
CREATE TABLE operating_expenses_new (
    id TEXT PRIMARY KEY,
    expenseNumber TEXT,
    date TEXT NOT NULL,
    category TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,            -- Changed: REAL → INTEGER
    recipientName TEXT,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    createdBy TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
);

-- Migrate data: Convert amount from REAL to INTEGER
INSERT INTO operating_expenses_new 
SELECT 
    id,
    expenseNumber,
    date,
    category,
    CAST(ROUND(amount * 100) AS INTEGER) as amount,
    recipientName,
    description,
    status,
    createdBy,
    createdAt,
    updatedAt
FROM operating_expenses;

-- ============================================================
-- Company Info Table
-- ============================================================
CREATE TABLE company_info_new (
    id TEXT PRIMARY KEY DEFAULT 'company_001',
    name TEXT NOT NULL DEFAULT 'شركة أسيل',
    address TEXT,
    taxId TEXT,
    commercialRegister TEXT,
    phone TEXT,
    mobile TEXT,
    email TEXT,
    taxRate REAL DEFAULT 0,                      -- Keep REAL (percentage, not amount)
    commitmentText TEXT,
    warehouseKeeperName TEXT,
    warehouseKeeperPhone TEXT,
    salesRepName TEXT,
    salesRepPhone TEXT,
    accountantName TEXT,
    accountantPhone TEXT,
    managerName TEXT,
    managerMobile TEXT,
    marketingWhatsApp TEXT,
    marketingMobile TEXT,
    marketingWorkingHours TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
);

-- Migrate data: taxRate stays REAL (it's a percentage)
INSERT INTO company_info_new 
SELECT 
    id,
    name,
    address,
    taxId,
    commercialRegister,
    phone,
    mobile,
    email,
    taxRate,
    commitmentText,
    warehouseKeeperName,
    warehouseKeeperPhone,
    salesRepName,
    salesRepPhone,
    accountantName,
    accountantPhone,
    managerName,
    managerMobile,
    marketingWhatsApp,
    marketingMobile,
    marketingWorkingHours,
    createdAt,
    updatedAt
FROM company_info;

COMMIT;

-- ============================================================
-- STEP 4: DROP OLD TABLES AND RENAME NEW TABLES
-- ============================================================

BEGIN TRANSACTION;

-- Drop old tables
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS sales_invoices;
DROP TABLE IF EXISTS sales_invoice_items;
DROP TABLE IF EXISTS purchase_invoices;
DROP TABLE IF EXISTS purchase_invoice_items;
DROP TABLE IF EXISTS receipts;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS returns;
DROP TABLE IF EXISTS fixed_assets;
DROP TABLE IF EXISTS operating_expenses;
DROP TABLE IF EXISTS company_info;

-- Rename new tables
ALTER TABLE products_new RENAME TO products;
ALTER TABLE customers_new RENAME TO customers;
ALTER TABLE suppliers_new RENAME TO suppliers;
ALTER TABLE sales_invoices_new RENAME TO sales_invoices;
ALTER TABLE sales_invoice_items_new RENAME TO sales_invoice_items;
ALTER TABLE purchase_invoices_new RENAME TO purchase_invoices;
ALTER TABLE purchase_invoice_items_new RENAME TO purchase_invoice_items;
ALTER TABLE receipts_new RENAME TO receipts;
ALTER TABLE payments_new RENAME TO payments;
ALTER TABLE returns_new RENAME TO returns;
ALTER TABLE fixed_assets_new RENAME TO fixed_assets;
ALTER TABLE operating_expenses_new RENAME TO operating_expenses;
ALTER TABLE company_info_new RENAME TO company_info;

COMMIT;

-- ============================================================
-- STEP 5: RECREATE ALL INDEXES
-- ============================================================

BEGIN TRANSACTION;

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer ON sales_invoices(customerId);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_date ON sales_invoices(date);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_delivery_note ON sales_invoices(deliveryNoteId);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_date_customer ON sales_invoices(date DESC, customerId);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_items_invoice ON sales_invoice_items(invoiceId);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_items_invoice_product ON sales_invoice_items(invoiceId, productId);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_items_product ON sales_invoice_items(productId);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_items_product_date ON sales_invoice_items(productId, invoiceId);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_supplier ON purchase_invoices(supplierId);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_date ON purchase_invoices(date);
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_items_invoice ON purchase_invoice_items(invoiceId);
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_items_product ON purchase_invoice_items(productId);
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_items_invoice_product ON purchase_invoice_items(invoiceId, productId);
CREATE INDEX IF NOT EXISTS idx_receipts_customer ON receipts(customerId);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(date);
CREATE INDEX IF NOT EXISTS idx_payments_supplier ON payments(supplierId);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_category ON fixed_assets(category);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_status ON fixed_assets(status);
CREATE INDEX IF NOT EXISTS idx_operating_expenses_date ON operating_expenses(date);
CREATE INDEX IF NOT EXISTS idx_operating_expenses_category ON operating_expenses(category);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_status ON delivery_notes(status);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_date ON delivery_notes(date);
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_delivery_note ON delivery_note_items(deliveryNoteId);
CREATE INDEX IF NOT EXISTS idx_delivery_settlements_delivery_note ON delivery_settlements(deliveryNoteId);
CREATE INDEX IF NOT EXISTS idx_delivery_settlements_status ON delivery_settlements(status);
CREATE INDEX IF NOT EXISTS idx_settlement_items_settlement ON settlement_items(settlementId);

COMMIT;

-- ============================================================
-- STEP 6: VERIFY FOREIGN KEYS
-- ============================================================

PRAGMA foreign_keys = ON;
PRAGMA foreign_key_check;

-- ============================================================
-- Migration Complete!
-- ============================================================
-- All financial amounts have been converted from REAL to INTEGER
-- Values are stored in cents (multiply by 100)
-- Example: 100.50 ج.م is now stored as 10050
-- ============================================================

