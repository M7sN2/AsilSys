-- ============================================================
-- Cleanup Script: Remove Backup Tables After Successful Migration
-- ============================================================
-- Description: Remove backup tables after verifying migration success
--              Run this ONLY after confirming migration is successful
-- Date: 2025-01-XX
-- Version: 1.0.0
-- ============================================================
-- ⚠️ WARNING: This script permanently deletes backup tables!
-- Only run this after:
-- 1. Migration completed successfully
-- 2. All tests passed
-- 3. Application tested and working correctly
-- 4. At least 1 week of production use without issues
-- ============================================================

BEGIN TRANSACTION;

-- Drop all backup tables
DROP TABLE IF EXISTS products_backup;
DROP TABLE IF EXISTS customers_backup;
DROP TABLE IF EXISTS suppliers_backup;
DROP TABLE IF EXISTS sales_invoices_backup;
DROP TABLE IF EXISTS sales_invoice_items_backup;
DROP TABLE IF EXISTS purchase_invoices_backup;
DROP TABLE IF EXISTS purchase_invoice_items_backup;
DROP TABLE IF EXISTS receipts_backup;
DROP TABLE IF EXISTS payments_backup;
DROP TABLE IF EXISTS returns_backup;
DROP TABLE IF EXISTS fixed_assets_backup;
DROP TABLE IF EXISTS operating_expenses_backup;
DROP TABLE IF EXISTS company_info_backup;
DROP TABLE IF EXISTS delivery_note_items_backup;
DROP TABLE IF EXISTS settlement_items_backup;
DROP TABLE IF EXISTS inventory_adjustments_backup;

COMMIT;

-- ============================================================
-- Cleanup Complete!
-- ============================================================
-- All backup tables have been removed
-- Database is now using INTEGER for all financial amounts
-- ============================================================

