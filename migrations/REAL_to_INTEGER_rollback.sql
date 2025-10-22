-- ============================================================
-- Rollback Script: Restore REAL Financial Amounts
-- ============================================================
-- Description: Restore all financial amounts from INTEGER (cents) back to REAL (decimal)
--              Example: 10050 قرش → 100.50 ج.م
-- Date: 2025-01-XX
-- Version: 1.0.0
-- ============================================================
-- WARNING: This script will restore data from backup tables
-- Make sure backup tables exist before running this script
-- ============================================================

BEGIN TRANSACTION;

-- ============================================================
-- STEP 1: DROP ALL INDEXES
-- ============================================================

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

-- ============================================================
-- STEP 2: RESTORE TABLES FROM BACKUP
-- ============================================================

-- Drop current tables
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

-- Restore from backup
CREATE TABLE products AS SELECT * FROM products_backup;
CREATE TABLE customers AS SELECT * FROM customers_backup;
CREATE TABLE suppliers AS SELECT * FROM suppliers_backup;
CREATE TABLE sales_invoices AS SELECT * FROM sales_invoices_backup;
CREATE TABLE sales_invoice_items AS SELECT * FROM sales_invoice_items_backup;
CREATE TABLE purchase_invoices AS SELECT * FROM purchase_invoices_backup;
CREATE TABLE purchase_invoice_items AS SELECT * FROM purchase_invoice_items_backup;
CREATE TABLE receipts AS SELECT * FROM receipts_backup;
CREATE TABLE payments AS SELECT * FROM payments_backup;
CREATE TABLE returns AS SELECT * FROM returns_backup;
CREATE TABLE fixed_assets AS SELECT * FROM fixed_assets_backup;
CREATE TABLE operating_expenses AS SELECT * FROM operating_expenses_backup;
CREATE TABLE company_info AS SELECT * FROM company_info_backup;

-- ============================================================
-- STEP 3: RECREATE ALL INDEXES
-- ============================================================

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
-- STEP 4: VERIFY FOREIGN KEYS
-- ============================================================

PRAGMA foreign_keys = ON;
PRAGMA foreign_key_check;

-- ============================================================
-- Rollback Complete!
-- ============================================================
-- All tables have been restored from backup
-- Financial amounts are back to REAL (decimal) format
-- ============================================================

