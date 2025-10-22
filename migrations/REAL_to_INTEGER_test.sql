-- ============================================================
-- Test Script: Verify REAL to INTEGER Migration
-- ============================================================
-- Description: Test script to verify data integrity after migration
-- Date: 2025-01-XX
-- Version: 1.0.0
-- ============================================================

-- ============================================================
-- TEST 1: Count Records - Verify no data loss
-- ============================================================

SELECT 'TEST 1: Record Counts' as test_name;

-- Products
SELECT 
    'products' as table_name,
    (SELECT COUNT(*) FROM products_backup) as backup_count,
    (SELECT COUNT(*) FROM products) as current_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM products_backup) = (SELECT COUNT(*) FROM products) 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status;

-- Customers
SELECT 
    'customers' as table_name,
    (SELECT COUNT(*) FROM customers_backup) as backup_count,
    (SELECT COUNT(*) FROM customers) as current_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM customers_backup) = (SELECT COUNT(*) FROM customers) 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status;

-- Suppliers
SELECT 
    'suppliers' as table_name,
    (SELECT COUNT(*) FROM suppliers_backup) as backup_count,
    (SELECT COUNT(*) FROM suppliers) as current_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM suppliers_backup) = (SELECT COUNT(*) FROM suppliers) 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status;

-- Sales Invoices
SELECT 
    'sales_invoices' as table_name,
    (SELECT COUNT(*) FROM sales_invoices_backup) as backup_count,
    (SELECT COUNT(*) FROM sales_invoices) as current_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM sales_invoices_backup) = (SELECT COUNT(*) FROM sales_invoices) 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status;

-- Sales Invoice Items
SELECT 
    'sales_invoice_items' as table_name,
    (SELECT COUNT(*) FROM sales_invoice_items_backup) as backup_count,
    (SELECT COUNT(*) FROM sales_invoice_items) as current_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM sales_invoice_items_backup) = (SELECT COUNT(*) FROM sales_invoice_items) 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status;

-- Purchase Invoices
SELECT 
    'purchase_invoices' as table_name,
    (SELECT COUNT(*) FROM purchase_invoices_backup) as backup_count,
    (SELECT COUNT(*) FROM purchase_invoices) as current_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM purchase_invoices_backup) = (SELECT COUNT(*) FROM purchase_invoices) 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status;

-- Purchase Invoice Items
SELECT 
    'purchase_invoice_items' as table_name,
    (SELECT COUNT(*) FROM purchase_invoice_items_backup) as backup_count,
    (SELECT COUNT(*) FROM purchase_invoice_items) as current_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM purchase_invoice_items_backup) = (SELECT COUNT(*) FROM purchase_invoice_items) 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status;

-- Receipts
SELECT 
    'receipts' as table_name,
    (SELECT COUNT(*) FROM receipts_backup) as backup_count,
    (SELECT COUNT(*) FROM receipts) as current_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM receipts_backup) = (SELECT COUNT(*) FROM receipts) 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status;

-- Payments
SELECT 
    'payments' as table_name,
    (SELECT COUNT(*) FROM payments_backup) as backup_count,
    (SELECT COUNT(*) FROM payments) as current_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM payments_backup) = (SELECT COUNT(*) FROM payments) 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status;

-- Returns
SELECT 
    'returns' as table_name,
    (SELECT COUNT(*) FROM returns_backup) as backup_count,
    (SELECT COUNT(*) FROM returns) as current_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM returns_backup) = (SELECT COUNT(*) FROM returns) 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status;

-- Fixed Assets
SELECT 
    'fixed_assets' as table_name,
    (SELECT COUNT(*) FROM fixed_assets_backup) as backup_count,
    (SELECT COUNT(*) FROM fixed_assets) as current_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM fixed_assets_backup) = (SELECT COUNT(*) FROM fixed_assets) 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status;

-- Operating Expenses
SELECT 
    'operating_expenses' as table_name,
    (SELECT COUNT(*) FROM operating_expenses_backup) as backup_count,
    (SELECT COUNT(*) FROM operating_expenses) as current_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM operating_expenses_backup) = (SELECT COUNT(*) FROM operating_expenses) 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status;

-- ============================================================
-- TEST 2: Financial Amount Conversion Accuracy
-- ============================================================

SELECT 'TEST 2: Financial Amount Conversion' as test_name;

-- Products: smallestPrice and largestPrice
SELECT 
    'products.smallestPrice' as column_name,
    COUNT(*) as total_rows,
    SUM(CASE 
        WHEN ABS(b.smallestPrice - (p.smallestPrice / 100.0)) > 0.01 
        THEN 1 
        ELSE 0 
    END) as differences,
    CASE 
        WHEN SUM(CASE WHEN ABS(b.smallestPrice - (p.smallestPrice / 100.0)) > 0.01 THEN 1 ELSE 0 END) = 0 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status
FROM products_backup b
JOIN products p ON b.id = p.id;

SELECT 
    'products.largestPrice' as column_name,
    COUNT(*) as total_rows,
    SUM(CASE 
        WHEN ABS(b.largestPrice - (p.largestPrice / 100.0)) > 0.01 
        THEN 1 
        ELSE 0 
    END) as differences,
    CASE 
        WHEN SUM(CASE WHEN ABS(b.largestPrice - (p.largestPrice / 100.0)) > 0.01 THEN 1 ELSE 0 END) = 0 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status
FROM products_backup b
JOIN products p ON b.id = p.id;

-- Customers: openingBalance and balance
SELECT 
    'customers.openingBalance' as column_name,
    COUNT(*) as total_rows,
    SUM(CASE 
        WHEN ABS(b.openingBalance - (c.openingBalance / 100.0)) > 0.01 
        THEN 1 
        ELSE 0 
    END) as differences,
    CASE 
        WHEN SUM(CASE WHEN ABS(b.openingBalance - (c.openingBalance / 100.0)) > 0.01 THEN 1 ELSE 0 END) = 0 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status
FROM customers_backup b
JOIN customers c ON b.id = c.id;

SELECT 
    'customers.balance' as column_name,
    COUNT(*) as total_rows,
    SUM(CASE 
        WHEN ABS(b.balance - (c.balance / 100.0)) > 0.01 
        THEN 1 
        ELSE 0 
    END) as differences,
    CASE 
        WHEN SUM(CASE WHEN ABS(b.balance - (c.balance / 100.0)) > 0.01 THEN 1 ELSE 0 END) = 0 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status
FROM customers_backup b
JOIN customers c ON b.id = c.id;

-- Suppliers: openingBalance and balance
SELECT 
    'suppliers.openingBalance' as column_name,
    COUNT(*) as total_rows,
    SUM(CASE 
        WHEN ABS(b.openingBalance - (s.openingBalance / 100.0)) > 0.01 
        THEN 1 
        ELSE 0 
    END) as differences,
    CASE 
        WHEN SUM(CASE WHEN ABS(b.openingBalance - (s.openingBalance / 100.0)) > 0.01 THEN 1 ELSE 0 END) = 0 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status
FROM suppliers_backup b
JOIN suppliers s ON b.id = s.id;

SELECT 
    'suppliers.balance' as column_name,
    COUNT(*) as total_rows,
    SUM(CASE 
        WHEN ABS(b.balance - (s.balance / 100.0)) > 0.01 
        THEN 1 
        ELSE 0 
    END) as differences,
    CASE 
        WHEN SUM(CASE WHEN ABS(b.balance - (s.balance / 100.0)) > 0.01 THEN 1 ELSE 0 END) = 0 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status
FROM suppliers_backup b
JOIN suppliers s ON b.id = s.id;

-- Sales Invoices: all financial fields
SELECT 
    'sales_invoices.subtotal' as column_name,
    COUNT(*) as total_rows,
    SUM(CASE 
        WHEN ABS(b.subtotal - (si.subtotal / 100.0)) > 0.01 
        THEN 1 
        ELSE 0 
    END) as differences,
    CASE 
        WHEN SUM(CASE WHEN ABS(b.subtotal - (si.subtotal / 100.0)) > 0.01 THEN 1 ELSE 0 END) = 0 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status
FROM sales_invoices_backup b
JOIN sales_invoices si ON b.id = si.id;

SELECT 
    'sales_invoices.total' as column_name,
    COUNT(*) as total_rows,
    SUM(CASE 
        WHEN ABS(b.total - (si.total / 100.0)) > 0.01 
        THEN 1 
        ELSE 0 
    END) as differences,
    CASE 
        WHEN SUM(CASE WHEN ABS(b.total - (si.total / 100.0)) > 0.01 THEN 1 ELSE 0 END) = 0 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status
FROM sales_invoices_backup b
JOIN sales_invoices si ON b.id = si.id;

SELECT 
    'sales_invoices.paid' as column_name,
    COUNT(*) as total_rows,
    SUM(CASE 
        WHEN ABS(b.paid - (si.paid / 100.0)) > 0.01 
        THEN 1 
        ELSE 0 
    END) as differences,
    CASE 
        WHEN SUM(CASE WHEN ABS(b.paid - (si.paid / 100.0)) > 0.01 THEN 1 ELSE 0 END) = 0 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status
FROM sales_invoices_backup b
JOIN sales_invoices si ON b.id = si.id;

SELECT 
    'sales_invoices.remaining' as column_name,
    COUNT(*) as total_rows,
    SUM(CASE 
        WHEN ABS(b.remaining - (si.remaining / 100.0)) > 0.01 
        THEN 1 
        ELSE 0 
    END) as differences,
    CASE 
        WHEN SUM(CASE WHEN ABS(b.remaining - (si.remaining / 100.0)) > 0.01 THEN 1 ELSE 0 END) = 0 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status
FROM sales_invoices_backup b
JOIN sales_invoices si ON b.id = si.id;

-- Sales Invoice Items: price and total
SELECT 
    'sales_invoice_items.price' as column_name,
    COUNT(*) as total_rows,
    SUM(CASE 
        WHEN ABS(b.price - (sii.price / 100.0)) > 0.01 
        THEN 1 
        ELSE 0 
    END) as differences,
    CASE 
        WHEN SUM(CASE WHEN ABS(b.price - (sii.price / 100.0)) > 0.01 THEN 1 ELSE 0 END) = 0 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status
FROM sales_invoice_items_backup b
JOIN sales_invoice_items sii ON b.id = sii.id;

SELECT 
    'sales_invoice_items.total' as column_name,
    COUNT(*) as total_rows,
    SUM(CASE 
        WHEN ABS(b.total - (sii.total / 100.0)) > 0.01 
        THEN 1 
        ELSE 0 
    END) as differences,
    CASE 
        WHEN SUM(CASE WHEN ABS(b.total - (sii.total / 100.0)) > 0.01 THEN 1 ELSE 0 END) = 0 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status
FROM sales_invoice_items_backup b
JOIN sales_invoice_items sii ON b.id = sii.id;

-- Purchase Invoices: all financial fields
SELECT 
    'purchase_invoices.total' as column_name,
    COUNT(*) as total_rows,
    SUM(CASE 
        WHEN ABS(b.total - (pi.total / 100.0)) > 0.01 
        THEN 1 
        ELSE 0 
    END) as differences,
    CASE 
        WHEN SUM(CASE WHEN ABS(b.total - (pi.total / 100.0)) > 0.01 THEN 1 ELSE 0 END) = 0 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status
FROM purchase_invoices_backup b
JOIN purchase_invoices pi ON b.id = pi.id;

-- Purchase Invoice Items: price and total
SELECT 
    'purchase_invoice_items.price' as column_name,
    COUNT(*) as total_rows,
    SUM(CASE 
        WHEN ABS(b.price - (pii.price / 100.0)) > 0.01 
        THEN 1 
        ELSE 0 
    END) as differences,
    CASE 
        WHEN SUM(CASE WHEN ABS(b.price - (pii.price / 100.0)) > 0.01 THEN 1 ELSE 0 END) = 0 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status
FROM purchase_invoice_items_backup b
JOIN purchase_invoice_items pii ON b.id = pii.id;

-- Receipts: amount
SELECT 
    'receipts.amount' as column_name,
    COUNT(*) as total_rows,
    SUM(CASE 
        WHEN ABS(b.amount - (r.amount / 100.0)) > 0.01 
        THEN 1 
        ELSE 0 
    END) as differences,
    CASE 
        WHEN SUM(CASE WHEN ABS(b.amount - (r.amount / 100.0)) > 0.01 THEN 1 ELSE 0 END) = 0 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status
FROM receipts_backup b
JOIN receipts r ON b.id = r.id;

-- Payments: amount
SELECT 
    'payments.amount' as column_name,
    COUNT(*) as total_rows,
    SUM(CASE 
        WHEN ABS(b.amount - (p.amount / 100.0)) > 0.01 
        THEN 1 
        ELSE 0 
    END) as differences,
    CASE 
        WHEN SUM(CASE WHEN ABS(b.amount - (p.amount / 100.0)) > 0.01 THEN 1 ELSE 0 END) = 0 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status
FROM payments_backup b
JOIN payments p ON b.id = p.id;

-- Returns: unitPrice and totalAmount
SELECT 
    'returns.unitPrice' as column_name,
    COUNT(*) as total_rows,
    SUM(CASE 
        WHEN ABS(b.unitPrice - (ret.unitPrice / 100.0)) > 0.01 
        THEN 1 
        ELSE 0 
    END) as differences,
    CASE 
        WHEN SUM(CASE WHEN ABS(b.unitPrice - (ret.unitPrice / 100.0)) > 0.01 THEN 1 ELSE 0 END) = 0 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status
FROM returns_backup b
JOIN returns ret ON b.id = ret.id;

-- Fixed Assets: purchasePrice and currentValue
SELECT 
    'fixed_assets.purchasePrice' as column_name,
    COUNT(*) as total_rows,
    SUM(CASE 
        WHEN ABS(b.purchasePrice - (fa.purchasePrice / 100.0)) > 0.01 
        THEN 1 
        ELSE 0 
    END) as differences,
    CASE 
        WHEN SUM(CASE WHEN ABS(b.purchasePrice - (fa.purchasePrice / 100.0)) > 0.01 THEN 1 ELSE 0 END) = 0 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status
FROM fixed_assets_backup b
JOIN fixed_assets fa ON b.id = fa.id;

-- Operating Expenses: amount
SELECT 
    'operating_expenses.amount' as column_name,
    COUNT(*) as total_rows,
    SUM(CASE 
        WHEN ABS(b.amount - (oe.amount / 100.0)) > 0.01 
        THEN 1 
        ELSE 0 
    END) as differences,
    CASE 
        WHEN SUM(CASE WHEN ABS(b.amount - (oe.amount / 100.0)) > 0.01 THEN 1 ELSE 0 END) = 0 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status
FROM operating_expenses_backup b
JOIN operating_expenses oe ON b.id = oe.id;

-- ============================================================
-- TEST 3: Foreign Key Integrity
-- ============================================================

SELECT 'TEST 3: Foreign Key Integrity' as test_name;

PRAGMA foreign_keys = ON;
PRAGMA foreign_key_check;

-- ============================================================
-- TEST 4: Sample Data Verification (First 10 rows of each table)
-- ============================================================

SELECT 'TEST 4: Sample Data Verification' as test_name;

-- Products sample
SELECT 
    'products' as table_name,
    b.id,
    b.smallestPrice as backup_smallestPrice,
    p.smallestPrice as current_smallestPrice,
    p.smallestPrice / 100.0 as current_smallestPrice_display,
    ABS(b.smallestPrice - (p.smallestPrice / 100.0)) as difference
FROM products_backup b
JOIN products p ON b.id = p.id
LIMIT 10;

-- Customers sample
SELECT 
    'customers' as table_name,
    b.id,
    b.balance as backup_balance,
    c.balance as current_balance,
    c.balance / 100.0 as current_balance_display,
    ABS(b.balance - (c.balance / 100.0)) as difference
FROM customers_backup b
JOIN customers c ON b.id = c.id
LIMIT 10;

-- Sales Invoices sample
SELECT 
    'sales_invoices' as table_name,
    b.id,
    b.total as backup_total,
    si.total as current_total,
    si.total / 100.0 as current_total_display,
    ABS(b.total - (si.total / 100.0)) as difference
FROM sales_invoices_backup b
JOIN sales_invoices si ON b.id = si.id
LIMIT 10;

-- ============================================================
-- TEST 5: Check for NULL values in critical financial fields
-- ============================================================

SELECT 'TEST 5: NULL Value Check' as test_name;

SELECT 
    'products.smallestPrice' as column_name,
    COUNT(*) as null_count,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END as status
FROM products
WHERE smallestPrice IS NULL;

SELECT 
    'customers.balance' as column_name,
    COUNT(*) as null_count,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END as status
FROM customers
WHERE balance IS NULL;

SELECT 
    'sales_invoices.total' as column_name,
    COUNT(*) as null_count,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END as status
FROM sales_invoices
WHERE total IS NULL;

-- ============================================================
-- Test Complete!
-- ============================================================
-- Review all test results above
-- All tests should show 'PASS' status
-- ============================================================

