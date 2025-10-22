const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { app } = require('electron');
const passwordUtils = require('./password-utils');

class DatabaseManager {
    constructor() {
        try {
            // CRITICAL: Get userData path BEFORE any path modifications
            // Store it immediately to prevent cache path changes from affecting it
            const userDataPath = app.getPath('userData');
            const dbPath = path.join(userDataPath, 'asel-database.db');
            
            // Database path is stored for use in backup functions
            
            // Store dbPath as absolute path for use in backup functions
            // This ensures the path never changes even if app.getPath('userData') changes
            this.dbPath = path.resolve(dbPath);
            this.userDataPath = path.resolve(userDataPath);
            
            // Ensure directory exists with error handling
            if (!fs.existsSync(userDataPath)) {
                try {
                    fs.mkdirSync(userDataPath, { recursive: true });
                } catch (mkdirError) {
                    console.error('Error creating userData directory:', mkdirError);
                    // Try to continue anyway - might already exist
                }
            }
            
            // Verify directory is writable
            try {
                fs.accessSync(userDataPath, fs.constants.W_OK);
            } catch (accessError) {
                console.error('UserData directory is not writable:', accessError);
                throw new Error(`Cannot write to user data directory: ${userDataPath}. Please check permissions.`);
            }

            // Clean up stale WAL/SHM files before initialization
            // These files can cause issues if left from previous session
            this.cleanupStaleWALFiles(dbPath);
            
            // Initialize database with WAL mode for better performance
            // Use longer timeout to handle locked database
            // Note: We don't check for corruption on startup to avoid false positives
            // Corruption will be detected and handled when actual database operations fail
            try {
                this.db = new Database(dbPath, { timeout: 10000 });
            } catch (initError) {
                if (initError.message && initError.message.includes('locked')) {
                    console.error(`[Database] ❌ Database is locked and cannot be opened. Please close all applications using the database and try again.`);
                    throw new Error(`Database is locked. Please close all applications using the database and restart the application.`);
                }
                // If database is corrupted, we'll handle it when operations fail
                throw initError;
            }
            this.db.pragma('journal_mode = WAL'); // Write-Ahead Logging
            this.db.pragma('foreign_keys = ON'); // Enable foreign keys
            this.db.pragma('synchronous = FULL'); // Full sync mode for maximum data safety (slower but safer)
            this.db.pragma('busy_timeout = 10000'); // Wait up to 10 seconds if database is locked
            // Reduce autocheckpoint threshold to prevent WAL from growing too large
            // Lower value = more frequent checkpoints = less data loss risk
            this.db.pragma('wal_autocheckpoint = 500'); // Auto-checkpoint after 500 pages (reduces corruption risk)
            this.db.pragma('page_size = 4096'); // Standard page size for better compatibility
            this.db.pragma('cache_size = -64000'); // 64MB cache (negative = KB, positive = pages)
            // Note: WAL mode already provides better concurrency and safety
            // No need for EXCLUSIVE locking mode as it can cause issues with multiple readers
            // Note: We don't perform integrity checks on startup to avoid false positives
            // Corruption will be detected and handled when actual database operations fail
            
            // Verify database file was created at correct location
            const actualDbPath = path.resolve(this.db.name);
            const expectedDbPath = path.resolve(this.dbPath);
            
            if (actualDbPath.toLowerCase() !== expectedDbPath.toLowerCase()) {
                console.error(`[Database] ⚠️ WARNING: Database path mismatch!`);
                console.error(`[Database] Expected: ${expectedDbPath}`);
                console.error(`[Database] Actual: ${actualDbPath}`);
                
                // Force close and reopen with correct path
                try {
                    this.db.close();
                    this.db = new Database(this.dbPath);
                    this.db.pragma('journal_mode = WAL');
                    this.db.pragma('foreign_keys = ON');
                    // Database reopened with correct path
                } catch (reopenError) {
                    console.error(`[Database] ❌ Failed to reopen with correct path: ${reopenError.message}`);
                }
            }
            
            this.initializeDatabase();
            
            // Clean up old emergency backup files (older than 7 days, keep only last 3 of each type)
            // This prevents accumulation of old backup files and reduces disk usage
            try {
                this.cleanupOldCorruptedBackups(this.dbPath);
            } catch (cleanupError) {
                // Don't throw - cleanup failure shouldn't prevent app from starting
                console.warn(`[Database] Warning: Could not cleanup old emergency backups: ${cleanupError.message}`);
            }
            
            // Note: Automatic backup and health checks are disabled
            // User will handle backups manually or through the app's backup feature
            
        } catch (error) {
            const errorDetails = error instanceof Error 
                ? { message: error.message, stack: error.stack, code: error.code, errno: error.errno }
                : error;
            console.error('Error initializing database:', typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails, null, 2));
            // Try to get userData path with error handling
            try {
                const userDataPath = app.getPath('userData');
                console.error('UserData path:', userDataPath);
            } catch (pathError) {
                console.error('Error getting userData path:', pathError);
            }
            throw error; // Re-throw to let caller handle
        }
    }

    async ensureInitialized() {
        // Synchronous database is already initialized in constructor
        // But ensure migrations are run
        try {
            this.runStatusMigrations();
        } catch (error) {
            console.error('Error running status migrations:', error);
        }
        return Promise.resolve();
    }
    
    // Add notes column to suppliers table if it doesn't exist
    runStatusMigrations() {
        try {
            const suppliersTableCheck = this.db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='suppliers'`).get();
            if (suppliersTableCheck) {
                // Check if notes column exists
                const columns = this.db.prepare(`PRAGMA table_info(suppliers)`).all();
                const hasNotesColumn = columns.some(col => col.name === 'notes');
                if (!hasNotesColumn) {
                    console.log('[Migration] Adding notes column to suppliers table...');
                    this.db.exec(`ALTER TABLE suppliers ADD COLUMN notes TEXT`);
                    console.log('[Migration] Successfully added notes column to suppliers table');
                }
            }
        } catch (error) {
            if (error.message && (error.message.includes('duplicate column') || error.message.includes('already exists'))) {
                // Column already exists, ignore
            } else {
                console.error('[Migration] Error adding notes column to suppliers table:', error.message);
            }
        }
    }

    initializeDatabase() {
        try {
            // Products Table
            this.db.exec(`
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                smallestUnit TEXT NOT NULL,
                largestUnit TEXT NOT NULL,
                conversionFactor REAL NOT NULL DEFAULT 1,
                smallestPrice INTEGER NOT NULL DEFAULT 0,
                largestPrice INTEGER NOT NULL DEFAULT 0,
                stock REAL NOT NULL DEFAULT 0,
                openingStock REAL NOT NULL DEFAULT 0,
                notes TEXT,
                status TEXT NOT NULL DEFAULT 'active',
                lastSaleDate TEXT,
                createdBy TEXT,
                createdAt TEXT NOT NULL,
                updatedAt TEXT NOT NULL
            )
        `);

        // Categories Table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS categories (
                id TEXT PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                createdBy TEXT,
                createdAt TEXT NOT NULL
            )
        `);

        // Customers Table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS customers (
                id TEXT PRIMARY KEY,
                code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                phone TEXT,
                address TEXT,
                firstTransactionDate TEXT,
                openingBalance REAL DEFAULT 0,
                balance REAL NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'active',
                lastTransactionDate TEXT,
                notes TEXT,
                createdBy TEXT,
                createdAt TEXT NOT NULL,
                updatedAt TEXT NOT NULL
            )
        `);

        // Suppliers Table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS suppliers (
                id TEXT PRIMARY KEY,
                code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                phone TEXT,
                address TEXT,
                firstTransactionDate TEXT,
                openingBalance REAL NOT NULL DEFAULT 0,
                balance REAL NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'active',
                lastTransactionDate TEXT,
                notes TEXT,
                createdBy TEXT,
                createdAt TEXT NOT NULL,
                updatedAt TEXT NOT NULL
            )
        `);

        // Sales Invoices Table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS sales_invoices (
                id TEXT PRIMARY KEY,
                invoiceNumber TEXT UNIQUE NOT NULL,
                customerId TEXT NOT NULL,
                date TEXT NOT NULL,
                dueDate TEXT,
                invoiceType TEXT NOT NULL DEFAULT 'normal',
                subtotal REAL NOT NULL DEFAULT 0,
                taxRate REAL NOT NULL DEFAULT 0,
                taxAmount REAL NOT NULL DEFAULT 0,
                shipping REAL NOT NULL DEFAULT 0,
                discount REAL NOT NULL DEFAULT 0,
                total REAL NOT NULL DEFAULT 0,
                paid REAL NOT NULL DEFAULT 0,
                remaining REAL NOT NULL DEFAULT 0,
                paymentMethod TEXT,
                notes TEXT,
                createdBy TEXT,
                createdAt TEXT NOT NULL,
                updatedAt TEXT NOT NULL,
                FOREIGN KEY (customerId) REFERENCES customers(id)
            )
        `);

        // Sales Invoice Items Table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS sales_invoice_items (
                id TEXT PRIMARY KEY,
                invoiceId TEXT NOT NULL,
                productId TEXT NOT NULL,
                productName TEXT NOT NULL,
                unit TEXT NOT NULL,
                quantity REAL NOT NULL,
                price REAL NOT NULL,
                total REAL NOT NULL,
                FOREIGN KEY (invoiceId) REFERENCES sales_invoices(id) ON DELETE CASCADE,
                FOREIGN KEY (productId) REFERENCES products(id)
            )
        `);

        // Delivery Notes Table (أذون الصرف)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS delivery_notes (
                id TEXT PRIMARY KEY,
                deliveryNoteNumber TEXT UNIQUE NOT NULL,
                date TEXT NOT NULL,
                salesRepId TEXT,
                salesRepName TEXT,
                warehouseKeeperName TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'issued',
                totalProducts INTEGER NOT NULL DEFAULT 0,
                notes TEXT,
                createdBy TEXT,
                createdAt TEXT NOT NULL,
                updatedAt TEXT NOT NULL
            )
        `);

        // Delivery Note Items Table (عناصر إذن الصرف)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS delivery_note_items (
                id TEXT PRIMARY KEY,
                deliveryNoteId TEXT NOT NULL,
                productId TEXT NOT NULL,
                productName TEXT NOT NULL,
                productCode TEXT,
                quantity REAL NOT NULL,
                unit TEXT NOT NULL,
                unitName TEXT,
                reservedQuantity REAL NOT NULL DEFAULT 0,
                availableQuantity REAL NOT NULL,
                FOREIGN KEY (deliveryNoteId) REFERENCES delivery_notes(id) ON DELETE CASCADE,
                FOREIGN KEY (productId) REFERENCES products(id)
            )
        `);

        // Delivery Settlements Table (التسويات)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS delivery_settlements (
                id TEXT PRIMARY KEY,
                settlementNumber TEXT UNIQUE NOT NULL,
                deliveryNoteId TEXT NOT NULL,
                date TEXT NOT NULL,
                salesRepId TEXT,
                salesRepName TEXT,
                warehouseKeeperId TEXT,
                warehouseKeeperName TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                notes TEXT,
                createdBy TEXT,
                createdAt TEXT NOT NULL,
                updatedAt TEXT NOT NULL,
                FOREIGN KEY (deliveryNoteId) REFERENCES delivery_notes(id)
            )
        `);

        // Settlement Items Table (عناصر التسوية)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS settlement_items (
                id TEXT PRIMARY KEY,
                settlementId TEXT NOT NULL,
                productId TEXT NOT NULL,
                productName TEXT NOT NULL,
                productCode TEXT,
                issuedQuantity REAL NOT NULL,
                soldQuantity REAL NOT NULL,
                returnedQuantity REAL NOT NULL DEFAULT 0,
                rejectedQuantity REAL NOT NULL DEFAULT 0,
                difference REAL NOT NULL DEFAULT 0,
                unit TEXT NOT NULL,
                notes TEXT,
                FOREIGN KEY (settlementId) REFERENCES delivery_settlements(id) ON DELETE CASCADE,
                FOREIGN KEY (productId) REFERENCES products(id)
            )
        `);

        // Purchase Invoices Table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS purchase_invoices (
                id TEXT PRIMARY KEY,
                invoiceNumber TEXT UNIQUE NOT NULL,
                supplierId TEXT NOT NULL,
                date TEXT NOT NULL,
                dueDate TEXT,
                invoiceType TEXT NOT NULL DEFAULT 'normal',
                subtotal REAL NOT NULL DEFAULT 0,
                taxRate REAL NOT NULL DEFAULT 0,
                taxAmount REAL NOT NULL DEFAULT 0,
                shipping REAL NOT NULL DEFAULT 0,
                discount REAL NOT NULL DEFAULT 0,
                total REAL NOT NULL DEFAULT 0,
                paid REAL NOT NULL DEFAULT 0,
                remaining REAL NOT NULL DEFAULT 0,
                paymentMethod TEXT,
                notes TEXT,
                createdBy TEXT,
                createdAt TEXT NOT NULL,
                updatedAt TEXT NOT NULL,
                FOREIGN KEY (supplierId) REFERENCES suppliers(id)
            )
        `);

        // Purchase Invoice Items Table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS purchase_invoice_items (
                id TEXT PRIMARY KEY,
                invoiceId TEXT NOT NULL,
                productId TEXT NOT NULL,
                productName TEXT NOT NULL,
                category TEXT,
                unit TEXT NOT NULL,
                quantity REAL NOT NULL,
                price REAL NOT NULL,
                total REAL NOT NULL,
                FOREIGN KEY (invoiceId) REFERENCES purchase_invoices(id) ON DELETE CASCADE,
                FOREIGN KEY (productId) REFERENCES products(id)
            )
        `);
        
        // Add category column if it doesn't exist (for existing databases)
        try {
            this.db.exec(`ALTER TABLE purchase_invoice_items ADD COLUMN category TEXT`);
        } catch (e) {
            // Column already exists, ignore
        }

        // Receipts Table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS receipts (
                id TEXT PRIMARY KEY,
                receiptNumber TEXT UNIQUE NOT NULL,
                customerId TEXT NOT NULL,
                date TEXT NOT NULL,
                amount REAL NOT NULL,
                paymentMethod TEXT NOT NULL,
                notes TEXT,
                createdBy TEXT,
                createdAt TEXT NOT NULL,
                updatedAt TEXT NOT NULL,
                FOREIGN KEY (customerId) REFERENCES customers(id)
            )
        `);

        // Payments Table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS payments (
                id TEXT PRIMARY KEY,
                paymentNumber TEXT UNIQUE NOT NULL,
                supplierId TEXT,
                toName TEXT,
                date TEXT NOT NULL,
                amount REAL NOT NULL,
                paymentMethod TEXT NOT NULL,
                notes TEXT,
                createdBy TEXT,
                createdAt TEXT NOT NULL,
                updatedAt TEXT NOT NULL,
                FOREIGN KEY (supplierId) REFERENCES suppliers(id)
            )
        `);

        // Inventory Adjustments Table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS inventory_adjustments (
                id TEXT PRIMARY KEY,
                adjustmentNumber TEXT UNIQUE NOT NULL,
                productId TEXT NOT NULL,
                date TEXT NOT NULL,
                type TEXT NOT NULL,
                quantity REAL NOT NULL,
                reason TEXT,
                notes TEXT,
                createdBy TEXT,
                createdAt TEXT NOT NULL,
                FOREIGN KEY (productId) REFERENCES products(id)
            )
        `);

        // Returns Table (for returns from customers or to suppliers)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS returns (
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
                quantity REAL NOT NULL,
                unitPrice REAL NOT NULL,
                totalAmount REAL NOT NULL,
                returnReason TEXT NOT NULL,
                isDamaged TEXT NOT NULL DEFAULT 'false',
                restoredToStock TEXT NOT NULL DEFAULT 'false',
                restoreBalance TEXT NOT NULL DEFAULT 'false',
                notes TEXT,
                createdAt TEXT NOT NULL,
                updatedAt TEXT NOT NULL,
                userId TEXT,
                FOREIGN KEY (productId) REFERENCES products(id),
                FOREIGN KEY (invoiceId) REFERENCES sales_invoices(id),
                FOREIGN KEY (invoiceId) REFERENCES purchase_invoices(id)
                -- Note: entityId foreign key removed because it can reference either customers or suppliers
                -- We rely on application-level validation instead
            )
        `);

        // Users Table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                email TEXT,
                type TEXT NOT NULL DEFAULT 'sales',
                status TEXT NOT NULL DEFAULT 'active',
                permissions TEXT NOT NULL DEFAULT '[]',
                createdAt TEXT NOT NULL,
                updatedAt TEXT NOT NULL,
                lastLogin TEXT
            )
        `);
        
        // Migrations: Add missing columns to existing tables
        // SQLite doesn't support NOT NULL DEFAULT in ALTER TABLE, so we add nullable columns first
        
        // Users table migrations
        const usersMigrations = [
            { column: 'email', sql: `ALTER TABLE users ADD COLUMN email TEXT;` },
            { column: 'type', sql: `ALTER TABLE users ADD COLUMN type TEXT;` },
            { column: 'status', sql: `ALTER TABLE users ADD COLUMN status TEXT;` },
            { column: 'permissions', sql: `ALTER TABLE users ADD COLUMN permissions TEXT;` },
            { column: 'updatedAt', sql: `ALTER TABLE users ADD COLUMN updatedAt TEXT;` },
            { column: 'lastLogin', sql: `ALTER TABLE users ADD COLUMN lastLogin TEXT;` }
        ];

        // Returns table migrations
        const returnsMigrations = [
            { column: 'operationType', sql: `ALTER TABLE returns ADD COLUMN operationType TEXT;` },
            { column: 'returnType', sql: `ALTER TABLE returns ADD COLUMN returnType TEXT;` },
            { column: 'entityId', sql: `ALTER TABLE returns ADD COLUMN entityId TEXT;` },
            { column: 'entityType', sql: `ALTER TABLE returns ADD COLUMN entityType TEXT;` },
            { column: 'unitPrice', sql: `ALTER TABLE returns ADD COLUMN unitPrice REAL;` },
            { column: 'totalAmount', sql: `ALTER TABLE returns ADD COLUMN totalAmount REAL;` },
            { column: 'returnReason', sql: `ALTER TABLE returns ADD COLUMN returnReason TEXT;` },
            { column: 'isDamaged', sql: `ALTER TABLE returns ADD COLUMN isDamaged TEXT DEFAULT 'false';` },
            { column: 'restoredToStock', sql: `ALTER TABLE returns ADD COLUMN restoredToStock TEXT DEFAULT 'false';` },
            { column: 'updatedAt', sql: `ALTER TABLE returns ADD COLUMN updatedAt TEXT;` },
            { column: 'invoiceId', sql: `ALTER TABLE returns ADD COLUMN invoiceId TEXT;` },
            { column: 'invoiceType', sql: `ALTER TABLE returns ADD COLUMN invoiceType TEXT;` },
            { column: 'invoiceNumber', sql: `ALTER TABLE returns ADD COLUMN invoiceNumber TEXT;` },
            { column: 'userId', sql: `ALTER TABLE returns ADD COLUMN userId TEXT;` },
            { column: 'restoreBalance', sql: `ALTER TABLE returns ADD COLUMN restoreBalance TEXT DEFAULT 'false';` }
        ];

        // Inventory adjustments table migrations
        const inventoryAdjustmentsMigrations = [
            { column: 'userId', sql: `ALTER TABLE inventory_adjustments ADD COLUMN userId TEXT;` },
            { column: 'oldStock', sql: `ALTER TABLE inventory_adjustments ADD COLUMN oldStock REAL;` },
            { column: 'newStock', sql: `ALTER TABLE inventory_adjustments ADD COLUMN newStock REAL;` }
        ];
        
        usersMigrations.forEach(migration => {
            try {
                // Check if column exists by querying table info
                const tableInfo = this.db.prepare(`PRAGMA table_info(users)`).all();
                const columnExists = tableInfo.some(col => col.name === migration.column);
                
                if (!columnExists) {
                    // console.log(`Adding missing column to users: ${migration.column}`);
                    this.db.exec(migration.sql);
                    
                    // Set default values for existing rows
                    if (migration.column === 'type') {
                        this.db.exec(`UPDATE users SET type = 'sales' WHERE type IS NULL;`);
                    } else if (migration.column === 'status') {
                        this.db.exec(`UPDATE users SET status = 'active' WHERE status IS NULL;`);
                    } else if (migration.column === 'permissions') {
                        this.db.exec(`UPDATE users SET permissions = '[]' WHERE permissions IS NULL;`);
                    } else if (migration.column === 'updatedAt') {
                        this.db.exec(`UPDATE users SET updatedAt = datetime('now') WHERE updatedAt IS NULL OR updatedAt = '';`);
                    }
                }
            } catch (e) {
                // Column might already exist or other error
                if (e.message && (e.message.includes('duplicate column') || e.message.includes('already exists'))) {
                    // Column already exists, ignore
                } else {
                    console.warn(`Could not add ${migration.column} column to users table:`, e.message);
                }
            }
        });

        // Returns table migrations
        try {
            const returnsTableInfo = this.db.prepare(`PRAGMA table_info(returns)`).all();
            if (returnsTableInfo.length > 0) {
                // Check if old foreign key constraints exist (by checking foreign_keys)
                const foreignKeys = this.db.prepare(`PRAGMA foreign_key_list(returns)`).all();
                const hasEntityIdFK = foreignKeys.some(fk => fk.from === 'entityId');
                
                // If old foreign key constraints exist on entityId, recreate table without them
                if (hasEntityIdFK) {
                    console.log('Recreating returns table to remove entityId foreign key constraints...');
                    try {
                        // Create temporary table with correct structure (no entityId FK)
                        this.db.exec(`
                            CREATE TABLE IF NOT EXISTS returns_new (
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
                                quantity REAL NOT NULL,
                                unitPrice REAL NOT NULL,
                                totalAmount REAL NOT NULL,
                                returnReason TEXT NOT NULL,
                                isDamaged TEXT NOT NULL DEFAULT 'false',
                                restoredToStock TEXT NOT NULL DEFAULT 'false',
                                notes TEXT,
                                createdAt TEXT NOT NULL,
                                updatedAt TEXT NOT NULL,
                                userId TEXT,
                                FOREIGN KEY (productId) REFERENCES products(id),
                                FOREIGN KEY (invoiceId) REFERENCES sales_invoices(id),
                                FOREIGN KEY (invoiceId) REFERENCES purchase_invoices(id)
                            )
                        `);
                        
                        // Copy data from old table to new table
                        this.db.exec(`INSERT INTO returns_new SELECT * FROM returns;`);
                        
                        // Drop old table
                        this.db.exec(`DROP TABLE returns;`);
                        
                        // Rename new table
                        this.db.exec(`ALTER TABLE returns_new RENAME TO returns;`);
                        
                        console.log('[INFO] Returns table recreated successfully without entityId foreign keys');
                    } catch (error) {
                        console.error('Error recreating returns table:', error);
                        // If recreation fails, try to continue with column migrations
                    }
                }
                
                // Add missing columns
                returnsMigrations.forEach(migration => {
                    try {
                        const columnExists = returnsTableInfo.some(col => col.name === migration.column);
                        if (!columnExists) {
                            // console.log(`Adding missing column to returns: ${migration.column}`);
                            this.db.exec(migration.sql);
                        }
                    } catch (error) {
                        console.error(`Error adding column ${migration.column} to returns:`, error);
                    }
                });
            }
        } catch (error) {
            console.error('Error checking returns table:', error);
        }

        // Inventory adjustments table migrations
        try {
            const inventoryAdjustmentsTableInfo = this.db.prepare(`PRAGMA table_info(inventory_adjustments)`).all();
            if (inventoryAdjustmentsTableInfo.length > 0) {
                inventoryAdjustmentsMigrations.forEach(migration => {
                    try {
                        const columnExists = inventoryAdjustmentsTableInfo.some(col => col.name === migration.column);
                        if (!columnExists) {
                            // console.log(`Adding missing column to inventory_adjustments: ${migration.column}`);
                            this.db.exec(migration.sql);
                        }
                    } catch (error) {
                        console.error(`Error adding column ${migration.column} to inventory_adjustments:`, error);
                    }
                });
            }
        } catch (error) {
            console.error('Error checking inventory_adjustments table:', error);
        }
        
        // Add createdBy column to all tables (migration for existing databases)
        const tablesWithCreatedBy = [
            'products', 'categories', 'customers', 'suppliers', 'sales_invoices',
            'delivery_notes', 'delivery_settlements', 'purchase_invoices',
            'receipts', 'payments', 'inventory_adjustments', 'returns',
            'fixed_assets', 'operating_expenses'
        ];
        
        // Migrate createdBy column to existing tables
        tablesWithCreatedBy.forEach(tableName => {
            try {
                // Check if table exists first
                const tableCheck = this.db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(tableName);
                if (!tableCheck) {
                    return; // Skip migration, table will be created with column in CREATE TABLE
                }
                
                // Check if column exists
                const tableInfo = this.db.prepare(`PRAGMA table_info(${tableName})`).all();
                const columnExists = tableInfo.some(col => col.name === 'createdBy');
                
                if (!columnExists) {
                    this.db.exec(`ALTER TABLE ${tableName} ADD COLUMN createdBy TEXT;`);
                }
            } catch (error) {
                // Only log actual errors (not "already exists" errors)
                if (!error.message || (!error.message.includes('duplicate column') && !error.message.includes('already exists'))) {
                    console.warn(`[Migration] ⚠️ Could not add createdBy column to ${tableName}:`, error.message);
                }
            }
        });
        
        // Clean up temporary tables if they exist (from incomplete migrations)
        try {
            const tablesCheck = this.db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name IN ('customers_new', 'suppliers_new')`).all();
            for (const table of tablesCheck || []) {
                if (table.name === 'customers_new') {
                    this.db.exec(`DROP TABLE IF EXISTS customers_new`);
                } else if (table.name === 'suppliers_new') {
                    this.db.exec(`DROP TABLE IF EXISTS suppliers_new`);
                }
            }
        } catch (error) {
            // Silently ignore cleanup errors
        }
        
        // Customers table migrations
        const customersMigrations = [
            { column: 'notes', sql: `ALTER TABLE customers ADD COLUMN notes TEXT;` },
            { column: 'openingBalance', sql: `ALTER TABLE customers ADD COLUMN openingBalance INTEGER DEFAULT 0;` }
        ];
        
        customersMigrations.forEach(migration => {
            try {
                // Check if column exists by querying table info
                let columnExists = false;
                try {
                    const tableInfo = this.db.prepare(`PRAGMA table_info(customers)`).all();
                    columnExists = tableInfo.some(col => col.name === migration.column);
                } catch (pragmaError) {
                    console.warn(`[Migration] Could not check table info for customers:`, pragmaError.message);
                    // Try to add column anyway - if it exists, we'll catch the error
                }
                
                if (!columnExists) {
                    console.log(`[Migration] Adding missing column to customers: ${migration.column}`);
                    try {
                        this.db.exec(migration.sql);
                        console.log(`[Migration] ✅ Successfully added ${migration.column} column to customers table`);
                        
                        // If openingBalance was added, update existing customers to have 0 as default
                        if (migration.column === 'openingBalance') {
                            try {
                                const updateResult = this.db.prepare(`UPDATE customers SET openingBalance = 0 WHERE openingBalance IS NULL;`).run();
                                console.log(`[Migration] Updated ${updateResult.changes || 0} existing customers with default openingBalance = 0`);
                            } catch (updateError) {
                                console.warn(`[Migration] Could not update existing customers with openingBalance:`, updateError.message);
                            }
                        }
                    } catch (execError) {
                        // Column might already exist or other error
                        if (execError.message && (execError.message.includes('duplicate column') || execError.message.includes('already exists'))) {
                            // Column already exists, ignore - no need to log
                            // console.debug(`[Migration] Column ${migration.column} already exists (duplicate error)`);
                        } else {
                            throw execError; // Re-throw to be caught by outer catch
                        }
                    }
                } else {
                    // Column already exists, no need to log
                    // console.debug(`[Migration] Column ${migration.column} already exists in customers table`);
                }
            } catch (e) {
                // Column might already exist or other error
                if (e.message && (e.message.includes('duplicate column') || e.message.includes('already exists'))) {
                    // Column already exists, ignore - no need to log
                    // console.debug(`[Migration] Column ${migration.column} already exists (duplicate error)`);
                } else {
                    console.error(`[Migration] ❌ Could not add ${migration.column} column to customers table:`, e.message);
                    console.error(`[Migration] Error details:`, e);
                    // Don't throw - continue with other migrations
                }
            }
        });
        
        // Purchase invoices table migrations
        try {
            // Check if purchase_invoices table exists
            const purchaseInvoicesTableCheck = this.db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='purchase_invoices'`).get();
            if (purchaseInvoicesTableCheck) {
                const purchaseInvoicesMigrations = [
                    { column: 'dueDate', sql: `ALTER TABLE purchase_invoices ADD COLUMN dueDate TEXT;` },
                    { column: 'invoiceType', sql: `ALTER TABLE purchase_invoices ADD COLUMN invoiceType TEXT DEFAULT 'normal';` }
                ];
                
                purchaseInvoicesMigrations.forEach(migration => {
                    try {
                        // Check if column exists by querying table info
                        const tableInfo = this.db.prepare(`PRAGMA table_info(purchase_invoices)`).all();
                        const columnExists = tableInfo.some(col => col.name === migration.column);
                        
                        if (!columnExists) {
                            console.log(`Adding ${migration.column} column to purchase_invoices table...`);
                            this.db.exec(migration.sql);
                            // Set default value for existing rows
                            if (migration.column === 'invoiceType') {
                                this.db.exec(`UPDATE purchase_invoices SET invoiceType = 'normal' WHERE invoiceType IS NULL;`);
                            }
                            console.log(`Successfully added ${migration.column} column to purchase_invoices table`);
                        }
                    } catch (e) {
                        // Column might already exist or other error
                        if (e.message && (e.message.includes('duplicate column') || e.message.includes('already exists'))) {
                            // Column already exists, ignore
                        } else {
                            console.error(`Could not add ${migration.column} column to purchase_invoices table:`, e.message);
                        }
                    }
                });
                
                // Add oldBalance, oldBalancePlusTotal, and newBalance columns
                try {
                    const purchaseInvoicesTableInfo = this.db.prepare(`PRAGMA table_info(purchase_invoices)`).all();
                    const columnNames = purchaseInvoicesTableInfo.map(col => col.name);
                    
                    // Add oldBalance column
                    if (!columnNames.includes('oldBalance')) {
                        // console.log('Adding oldBalance column to purchase_invoices');
                        this.db.exec(`ALTER TABLE purchase_invoices ADD COLUMN oldBalance REAL;`);
                    }
                    
                    // Add oldBalancePlusTotal column (القديم + الإجمالي)
                    if (!columnNames.includes('oldBalancePlusTotal')) {
                        // console.log('Adding oldBalancePlusTotal column to purchase_invoices');
                        this.db.exec(`ALTER TABLE purchase_invoices ADD COLUMN oldBalancePlusTotal REAL;`);
                    }
                    
                    // Add newBalance column (الرصيد الجديد)
                    if (!columnNames.includes('newBalance')) {
                        // console.log('Adding newBalance column to purchase_invoices');
                        this.db.exec(`ALTER TABLE purchase_invoices ADD COLUMN newBalance REAL;`);
                    }
                    
                    // Add remainingWithOldBalance column (المتبقي من الفاتورة والرصيد القديم)
                    // هذه القيمة = oldBalance + remaining = newBalance (لكن نحفظها كعمود منفصل للوضوح)
                    if (!columnNames.includes('remainingWithOldBalance')) {
                        // console.log('Adding remainingWithOldBalance column to purchase_invoices');
                        this.db.exec(`ALTER TABLE purchase_invoices ADD COLUMN remainingWithOldBalance REAL;`);
                    }
                } catch (e) {
                    if (e.message && !e.message.includes('duplicate column') && !e.message.includes('already exists')) {
                        console.warn('Could not add oldBalance/oldBalancePlusTotal/newBalance/remainingWithOldBalance columns to purchase_invoices:', e.message);
                    }
                }
            }
        } catch (error) {
            console.error('Error checking purchase_invoices table for migrations:', error);
        }

        // Sales invoices table migrations - Add deliveryNoteId and deliveryNoteNumber
        try {
            const salesInvoicesTableInfo = this.db.prepare(`PRAGMA table_info(sales_invoices)`).all();
            const columnNames = salesInvoicesTableInfo.map(col => col.name);
            
            if (!columnNames.includes('deliveryNoteId')) {
                // console.log('Adding deliveryNoteId column to sales_invoices');
                this.db.exec(`ALTER TABLE sales_invoices ADD COLUMN deliveryNoteId TEXT;`);
            }
            
            if (!columnNames.includes('deliveryNoteNumber')) {
                // console.log('Adding deliveryNoteNumber column to sales_invoices');
                this.db.exec(`ALTER TABLE sales_invoices ADD COLUMN deliveryNoteNumber TEXT;`);
            }
            
            // Add oldBalance column to store the customer's old balance at the time of invoice creation (for delivered invoices)
            if (!columnNames.includes('oldBalance')) {
                // console.log('Adding oldBalance column to sales_invoices');
                this.db.exec(`ALTER TABLE sales_invoices ADD COLUMN oldBalance REAL;`);
            }
            
            // Add oldBalancePlusTotal column (القديم + الإجمالي)
            if (!columnNames.includes('oldBalancePlusTotal')) {
                // console.log('Adding oldBalancePlusTotal column to sales_invoices');
                this.db.exec(`ALTER TABLE sales_invoices ADD COLUMN oldBalancePlusTotal REAL;`);
            }
            
            // Add newBalance column (الرصيد الجديد)
            if (!columnNames.includes('newBalance')) {
                // console.log('Adding newBalance column to sales_invoices');
                this.db.exec(`ALTER TABLE sales_invoices ADD COLUMN newBalance REAL;`);
            }
            
            // Add remainingWithOldBalance column (المتبقي من الفاتورة والرصيد القديم)
            // هذه القيمة = oldBalance + remaining = newBalance (لكن نحفظها كعمود منفصل للوضوح)
            if (!columnNames.includes('remainingWithOldBalance')) {
                // console.log('Adding remainingWithOldBalance column to sales_invoices');
                this.db.exec(`ALTER TABLE sales_invoices ADD COLUMN remainingWithOldBalance REAL;`);
            }
            
            // Add invoiceType column
            if (!columnNames.includes('invoiceType')) {
                console.log('Adding invoiceType column to sales_invoices');
                this.db.exec(`ALTER TABLE sales_invoices ADD COLUMN invoiceType TEXT DEFAULT 'normal';`);
                this.db.exec(`UPDATE sales_invoices SET invoiceType = 'normal' WHERE invoiceType IS NULL;`);
            }
        } catch (e) {
            if (e.message && !e.message.includes('duplicate column') && !e.message.includes('already exists')) {
                console.warn('Could not add deliveryNoteId/deliveryNoteNumber/oldBalance/oldBalancePlusTotal/newBalance/remainingWithOldBalance/invoiceType columns to sales_invoices:', e.message);
            }
        }

        // Delivery note items table migrations - Add productCategory
        try {
            const deliveryNoteItemsTableInfo = this.db.prepare(`PRAGMA table_info(delivery_note_items)`).all();
            const deliveryNoteItemsColumnNames = deliveryNoteItemsTableInfo.map(col => col.name);
            
            if (!deliveryNoteItemsColumnNames.includes('productCategory')) {
                // console.log('Adding productCategory column to delivery_note_items');
                this.db.exec(`ALTER TABLE delivery_note_items ADD COLUMN productCategory TEXT DEFAULT '';`);
            }
        } catch (e) {
            if (e.message && !e.message.includes('duplicate column') && !e.message.includes('already exists')) {
                console.warn('Could not add productCategory column to delivery_note_items table:', e.message);
            }
        }

        // Delivery notes table migrations - Add warehouseKeeperName
        try {
            const deliveryNotesTableInfo = this.db.prepare(`PRAGMA table_info(delivery_notes)`).all();
            const columnNames = deliveryNotesTableInfo.map(col => col.name);
            
            if (!columnNames.includes('warehouseKeeperName')) {
                // console.log('Adding warehouseKeeperName column to delivery_notes');
                this.db.exec(`ALTER TABLE delivery_notes ADD COLUMN warehouseKeeperName TEXT;`);
                // Migrate existing data: if salesRepName exists, copy it to warehouseKeeperName
                this.db.exec(`UPDATE delivery_notes SET warehouseKeeperName = salesRepName WHERE warehouseKeeperName IS NULL AND salesRepName IS NOT NULL;`);
            }
        } catch (e) {
            if (e.message && !e.message.includes('duplicate column') && !e.message.includes('already exists')) {
                console.warn('Could not add warehouseKeeperName column to delivery_notes:', e.message);
            }
        }

        // Handle fullName column - either make it nullable or remove it
        try {
            const tableInfo = this.db.prepare(`PRAGMA table_info(users)`).all();
            const fullNameColumn = tableInfo.find(col => col.name === 'fullName');
            
            if (fullNameColumn) {
                // fullName exists - update existing rows to have fullName = username if fullName is NULL
                const usersWithNullFullName = this.db.prepare(`SELECT id, username FROM users WHERE fullName IS NULL OR fullName = ''`).all();
                if (usersWithNullFullName.length > 0) {
                    console.log(`Updating ${usersWithNullFullName.length} users with NULL fullName`);
                    const updateStmt = this.db.prepare(`UPDATE users SET fullName = ? WHERE id = ?`);
                    usersWithNullFullName.forEach(user => {
                        updateStmt.run(user.username || 'User', user.id);
                    });
                }
                
                // Note: SQLite doesn't support ALTER COLUMN, so we can't change NOT NULL constraint
                // We'll just ensure all rows have a fullName value
            }
        } catch (e) {
            console.warn('Could not handle fullName column:', e.message);
        }


        // Backup History Table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS backup_history (
                id TEXT PRIMARY KEY,
                backupPath TEXT NOT NULL,
                backupType TEXT NOT NULL,
                fileSize INTEGER NOT NULL,
                checksum TEXT,
                encrypted INTEGER DEFAULT 0,
                createdAt TEXT NOT NULL
            )
        `);
        
        // Add checksum and encrypted columns to backup_history if they don't exist (migration)
        try {
            const backupHistoryTableInfo = this.db.prepare(`PRAGMA table_info(backup_history)`).all();
            const backupHistoryColumnNames = backupHistoryTableInfo.map(col => col.name);
            
            if (!backupHistoryColumnNames.includes('checksum')) {
                this.db.exec(`ALTER TABLE backup_history ADD COLUMN checksum TEXT;`);
            }
            if (!backupHistoryColumnNames.includes('encrypted')) {
                this.db.exec(`ALTER TABLE backup_history ADD COLUMN encrypted INTEGER DEFAULT 0;`);
            }
        } catch (e) {
            if (e.message && !e.message.includes('duplicate column') && !e.message.includes('already exists')) {
                console.warn('Could not add columns to backup_history:', e.message);
            }
        }

        // Fixed Assets Table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS fixed_assets (
                id TEXT PRIMARY KEY,
                code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                purchaseDate TEXT NOT NULL,
                purchasePrice INTEGER NOT NULL DEFAULT 0,
                currentValue INTEGER NOT NULL DEFAULT 0,
                depreciationRate REAL NOT NULL DEFAULT 0,
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
                FOREIGN KEY (supplierId) REFERENCES suppliers(id)
            )
        `);

        // Operating Expenses Table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS operating_expenses (
                id TEXT PRIMARY KEY,
                expenseNumber TEXT,
                date TEXT NOT NULL,
                category TEXT NOT NULL,
                amount INTEGER NOT NULL DEFAULT 0,
                recipientName TEXT,
                description TEXT,
                createdBy TEXT,
                createdAt TEXT NOT NULL,
                updatedAt TEXT NOT NULL
            )
        `);

        // Add expenseNumber column if it doesn't exist (for existing databases)
        try {
            this.db.exec(`ALTER TABLE operating_expenses ADD COLUMN expenseNumber TEXT`);
        } catch (e) {
            // Column already exists, ignore
        }
        
        // Add recipientName column if it doesn't exist (for existing databases)
        try {
            this.db.exec(`ALTER TABLE operating_expenses ADD COLUMN recipientName TEXT`);
        } catch (e) {
            // Column already exists, ignore
        }

        // Company Info Table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS company_info (
                id TEXT PRIMARY KEY DEFAULT 'company_001',
                name TEXT NOT NULL DEFAULT 'شركة أسيل',
                address TEXT,
                taxId TEXT,
                commercialRegister TEXT,
                phone TEXT,
                mobile TEXT,
                email TEXT,
                taxRate REAL DEFAULT 0,
                commitmentText TEXT,
                warehouseKeeperName TEXT,
                warehouseKeeperPhone TEXT,
                createdAt TEXT NOT NULL,
                updatedAt TEXT NOT NULL
            )
        `);
        
        // Add new columns if they don't exist (for existing databases)
        try {
            this.db.exec(`ALTER TABLE company_info ADD COLUMN warehouseKeeperName TEXT`);
        } catch (e) {
            // Column already exists, ignore
        }
        try {
            this.db.exec(`ALTER TABLE company_info ADD COLUMN warehouseKeeperPhone TEXT`);
        } catch (e) {
            // Column already exists, ignore
        }

        // Add marketing contact columns if they don't exist (for existing databases)
        try {
            this.db.exec(`ALTER TABLE company_info ADD COLUMN marketingWhatsApp TEXT`);
        } catch (e) {
            // Column already exists, ignore
        }
        try {
            this.db.exec(`ALTER TABLE company_info ADD COLUMN marketingMobile TEXT`);
        } catch (e) {
            // Column already exists, ignore
        }
        try {
            this.db.exec(`ALTER TABLE company_info ADD COLUMN marketingWorkingHours TEXT`);
        } catch (e) {
            // Column already exists, ignore
        }

        // Initialize default company info if not exists
        try {
            const existingCompany = this.db.prepare('SELECT id FROM company_info WHERE id = ?').get('company_001');
            if (!existingCompany) {
                this.db.prepare(`
                    INSERT INTO company_info (id, name, taxRate, commitmentText, createdAt, updatedAt)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(
                    'company_001',
                    'شركة أسيل',
                    0,
                    'أقر بأنني قد استلمت البضاعة/الخدمة المبينة أعلاه بحالة جيدة وبمواصفات مطابقة، وأتعهد بالسداد وفق الشروط المذكورة.',
                    new Date().toISOString(),
                    new Date().toISOString()
                );
            }
        } catch (error) {
            console.warn('Could not initialize company info:', error.message);
        }
        
        // Add taxRate column to company_info if it doesn't exist (migration)
        try {
            const tableInfo = this.db.prepare(`PRAGMA table_info(company_info)`).all();
            const columnExists = tableInfo.some(col => col.name === 'taxRate');
            
            if (!columnExists) {
                // console.log('Adding taxRate column to company_info');
                this.db.exec(`ALTER TABLE company_info ADD COLUMN taxRate REAL DEFAULT 0;`);
                // Set default value for existing rows
                this.db.exec(`UPDATE company_info SET taxRate = 0 WHERE taxRate IS NULL;`);
            }
        } catch (e) {
            if (e.message && !e.message.includes('duplicate column') && !e.message.includes('already exists')) {
                console.warn('Could not add taxRate column to company_info:', e.message);
            }
        }

        // Add salesRepName, salesRepPhone, accountantName, accountantPhone columns to company_info if they don't exist (migration)
        try {
            const tableInfo = this.db.prepare(`PRAGMA table_info(company_info)`).all();
            const columnNames = tableInfo.map(col => col.name);
            
            // Add salesRepName column
            if (!columnNames.includes('salesRepName')) {
                // console.log('Adding salesRepName column to company_info');
                this.db.exec(`ALTER TABLE company_info ADD COLUMN salesRepName TEXT DEFAULT '';`);
            }
            
            // Add salesRepPhone column
            if (!columnNames.includes('salesRepPhone')) {
                // console.log('Adding salesRepPhone column to company_info');
                this.db.exec(`ALTER TABLE company_info ADD COLUMN salesRepPhone TEXT DEFAULT '';`);
            }
            
            // Add accountantName column
            if (!columnNames.includes('accountantName')) {
                // console.log('Adding accountantName column to company_info');
                this.db.exec(`ALTER TABLE company_info ADD COLUMN accountantName TEXT DEFAULT '';`);
            }
            
            // Add accountantPhone column
            if (!columnNames.includes('accountantPhone')) {
                // console.log('Adding accountantPhone column to company_info');
                this.db.exec(`ALTER TABLE company_info ADD COLUMN accountantPhone TEXT DEFAULT '';`);
            }
        } catch (e) {
            if (e.message && !e.message.includes('duplicate column') && !e.message.includes('already exists')) {
                console.warn('Could not add sales rep/accountant columns to company_info:', e.message);
            }
        }

        // Add managerName and managerMobile columns to company_info if they don't exist (migration)
        try {
            const tableInfo = this.db.prepare(`PRAGMA table_info(company_info)`).all();
            const columnNames = tableInfo.map(col => col.name);
            
            // Add managerName column
            if (!columnNames.includes('managerName')) {
                this.db.exec(`ALTER TABLE company_info ADD COLUMN managerName TEXT DEFAULT '';`);
            }
            
            // Add managerMobile column
            if (!columnNames.includes('managerMobile')) {
                this.db.exec(`ALTER TABLE company_info ADD COLUMN managerMobile TEXT DEFAULT '';`);
            }
        } catch (e) {
            if (e.message && !e.message.includes('duplicate column') && !e.message.includes('already exists')) {
                console.warn('Could not add manager columns to company_info:', e.message);
            }
        }

        // Initialize default system engineer user (BashMohndes) if not exists
        // This user is always created/updated if it doesn't exist or has wrong type
        try {
            // First check if user exists by username (regardless of type)
            const existingUser = this.db.prepare('SELECT id, type FROM users WHERE username = ?').get('BashMohndes');
            
            // Hash the default password
            const hashedPassword = passwordUtils.hashPasswordSync('BashMohndesadmin');
            
            if (existingUser) {
                // User exists - check if it's already system_engineer
                if (existingUser.type !== 'system_engineer') {
                    // Update existing user to system_engineer type
                    this.db.prepare(`
                        UPDATE users SET type = ?, password = ?, permissions = ?, status = ?, updatedAt = ? WHERE username = ?
                    `).run(
                        'system_engineer',
                        hashedPassword,
                        JSON.stringify(['*']),
                        'active',
                        new Date().toISOString(),
                        'BashMohndes'
                    );
                    // console.log('[INFO] Updated existing BashMohndes user to system_engineer type');
                } else {
                    // User already exists and is system_engineer - update password to new default
                    // Always update to new default password for security
                    this.db.prepare(`
                        UPDATE users SET password = ?, permissions = ?, status = ?, updatedAt = ? WHERE username = ? AND type = ?
                    `).run(
                        hashedPassword,
                        JSON.stringify(['*']),
                        'active',
                        new Date().toISOString(),
                        'BashMohndes',
                        'system_engineer'
                    );
                    // User already exists and credentials are ensured - no need to log
                }
            } else {
                // User doesn't exist - create it
                const systemEngineerId = 'system_engineer_' + Date.now().toString();
                this.db.prepare(`
                    INSERT INTO users (id, username, password, email, type, status, permissions, createdAt, updatedAt, lastLogin)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    systemEngineerId,
                    'BashMohndes',
                    hashedPassword,
                    '',
                    'system_engineer',
                    'active',
                    JSON.stringify(['*']), // All permissions
                    new Date().toISOString(),
                    new Date().toISOString(),
                    null
                );
                // console.log('[INFO] Default system engineer user (BashMohndes) created successfully');
            }
        } catch (error) {
            console.error('[ERROR] Error initializing default system engineer user:', error.message);
            // Format error details properly
            const errorDetails = error instanceof Error 
                ? { message: error.message, stack: error.stack, code: error.code, errno: error.errno }
                : error;
            console.error('Error details:', typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails, null, 2));
        }

        // Migration: Remove type column from payments table (SQLite doesn't support DROP COLUMN)
        try {
            const paymentsTableInfo = this.db.prepare(`PRAGMA table_info(payments)`).all();
            const hasTypeColumn = paymentsTableInfo.some(col => col.name === 'type');
            
            if (hasTypeColumn) {
                console.log('[Migration] Removing type column from payments table...');
                
                // Create new table without type column
                this.db.exec(`
                    CREATE TABLE IF NOT EXISTS payments_new (
                        id TEXT PRIMARY KEY,
                        paymentNumber TEXT UNIQUE NOT NULL,
                        supplierId TEXT,
                        toName TEXT,
                        date TEXT NOT NULL,
                        amount REAL NOT NULL,
                        paymentMethod TEXT NOT NULL,
                        notes TEXT,
                        createdBy TEXT,
                        createdAt TEXT NOT NULL,
                        updatedAt TEXT NOT NULL,
                        FOREIGN KEY (supplierId) REFERENCES suppliers(id)
                    )
                `);
                
                // Copy data from old table to new table (excluding type column)
                this.db.exec(`
                    INSERT INTO payments_new (id, paymentNumber, supplierId, toName, date, amount, paymentMethod, notes, createdBy, createdAt, updatedAt)
                    SELECT id, paymentNumber, supplierId, toName, date, amount, paymentMethod, notes, createdBy, createdAt, updatedAt
                    FROM payments
                `);
                
                // Drop old table
                this.db.exec(`DROP TABLE payments`);
                
                // Rename new table
                this.db.exec(`ALTER TABLE payments_new RENAME TO payments`);
                
                console.log('[Migration] Successfully removed type column from payments table');
            }
        } catch (e) {
            if (e.message && !e.message.includes('no such table') && !e.message.includes('does not exist')) {
                console.error('[Migration] Error removing type column from payments table:', e.message);
            }
        }
        
        // Payments table migrations - Add oldBalance and newBalance columns
        try {
            const paymentsTableInfo = this.db.prepare(`PRAGMA table_info(payments)`).all();
            const columnNames = paymentsTableInfo.map(col => col.name);
            
            // Add oldBalance column (الرصيد القديم)
            if (!columnNames.includes('oldBalance')) {
                // console.log('Adding oldBalance column to payments');
                this.db.exec(`ALTER TABLE payments ADD COLUMN oldBalance REAL;`);
            }
            
            // Add newBalance column (الرصيد الجديد)
            if (!columnNames.includes('newBalance')) {
                // console.log('Adding newBalance column to payments');
                this.db.exec(`ALTER TABLE payments ADD COLUMN newBalance REAL;`);
            }
        } catch (e) {
            if (e.message && !e.message.includes('duplicate column') && !e.message.includes('already exists')) {
                console.warn('Could not add oldBalance/newBalance columns to payments:', e.message);
            }
        }
        
        // Receipts table migrations - Add oldBalance and newBalance columns
        try {
            const receiptsTableInfo = this.db.prepare(`PRAGMA table_info(receipts)`).all();
            const columnNames = receiptsTableInfo.map(col => col.name);
            
            // Add oldBalance column (الرصيد القديم)
            if (!columnNames.includes('oldBalance')) {
                // console.log('Adding oldBalance column to receipts');
                this.db.exec(`ALTER TABLE receipts ADD COLUMN oldBalance REAL;`);
            }
            
            // Add newBalance column (الرصيد الجديد)
            if (!columnNames.includes('newBalance')) {
                // console.log('Adding newBalance column to receipts');
                this.db.exec(`ALTER TABLE receipts ADD COLUMN newBalance REAL;`);
            }
        } catch (e) {
            if (e.message && !e.message.includes('duplicate column') && !e.message.includes('already exists')) {
                console.warn('Could not add oldBalance/newBalance columns to receipts:', e.message);
            }
        }
        
        // Returns table migrations - Add oldBalance and newBalance columns
        try {
            const returnsTableInfo = this.db.prepare(`PRAGMA table_info(returns)`).all();
            const columnNames = returnsTableInfo.map(col => col.name);
            
            // Add oldBalance column (الرصيد القديم للعميل/المورد)
            if (!columnNames.includes('oldBalance')) {
                // console.log('Adding oldBalance column to returns');
                this.db.exec(`ALTER TABLE returns ADD COLUMN oldBalance REAL;`);
            }
            
            // Add newBalance column (الرصيد الجديد للعميل/المورد)
            if (!columnNames.includes('newBalance')) {
                // console.log('Adding newBalance column to returns');
                this.db.exec(`ALTER TABLE returns ADD COLUMN newBalance REAL;`);
            }
        } catch (e) {
            if (e.message && !e.message.includes('duplicate column') && !e.message.includes('already exists')) {
                console.warn('Could not add oldBalance/newBalance columns to returns:', e.message);
            }
        }
        
        // Inventory adjustments table migrations - Ensure oldStock and newStock columns exist
        try {
            const adjustmentsTableInfo = this.db.prepare(`PRAGMA table_info(inventory_adjustments)`).all();
            const columnNames = adjustmentsTableInfo.map(col => col.name);
            
            // Add oldStock column (المخزون القديم)
            if (!columnNames.includes('oldStock')) {
                // console.log('Adding oldStock column to inventory_adjustments');
                this.db.exec(`ALTER TABLE inventory_adjustments ADD COLUMN oldStock REAL;`);
            }
            
            // Add newStock column (المخزون الجديد)
            if (!columnNames.includes('newStock')) {
                // console.log('Adding newStock column to inventory_adjustments');
                this.db.exec(`ALTER TABLE inventory_adjustments ADD COLUMN newStock REAL;`);
            }
        } catch (e) {
            if (e.message && !e.message.includes('duplicate column') && !e.message.includes('already exists')) {
                console.warn('Could not add oldStock/newStock columns to inventory_adjustments:', e.message);
            }
        }

        // Create indexes for better performance
        this.db.exec(`
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
        `);
        
        // Ensure cash customer exists
        this.ensureCashCustomer();
        
        // Run status migrations to ensure status columns exist
        this.runStatusMigrations();
        } catch (error) {
            console.error('Error initializing database schema:', error);
            // Don't throw - let the app continue with partial initialization
            // The database might still be usable
        }
    }

    // Ensure cash customer exists (عميل نقدي)
    ensureCashCustomer() {
        try {
            const cashCustomerCode = 'CASH';
            const cashCustomerName = 'عميل نقدي';
            
            // Check if cash customer already exists
            const existing = this.db.prepare('SELECT id FROM customers WHERE code = ?').get(cashCustomerCode);
            
            if (!existing) {
                // Create cash customer
                const cashCustomer = {
                    id: 'cash_customer_' + Date.now().toString(),
                    code: cashCustomerCode,
                    name: cashCustomerName,
                    phone: '',
                    address: '',
                    balance: 0, // INTEGER (cents)
                    status: 'active',
                    notes: '',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                
                const keys = Object.keys(cashCustomer);
                const placeholders = keys.map(() => '?').join(', ');
                const values = keys.map(key => cashCustomer[key]);
                const sql = `INSERT INTO customers (${keys.join(', ')}) VALUES (${placeholders})`;
                const stmt = this.db.prepare(sql);
                stmt.run(...values);
                // Cash customer created successfully
            }
        } catch (error) {
            console.error('[Database] Error ensuring cash customer:', error);
        }
    }

    // Clean up stale WAL/SHM files that might cause false corruption detection
    cleanupStaleWALFiles(dbPath) {
        try {
            const walFile = dbPath + '-wal';
            const shmFile = dbPath + '-shm';
            const journalFile = dbPath + '-journal';
            
            // Check if database is currently in use by trying to open it
            let dbInUse = false;
            try {
                const testDb = new Database(dbPath, { readonly: true, timeout: 100 });
                testDb.close();
            } catch (testError) {
                // If we can't open it, it might be in use - don't delete WAL/SHM
                if (testError.message && testError.message.includes('locked')) {
                    dbInUse = true;
                }
            }
            
            // Only clean up WAL/SHM if database is not in use
            if (!dbInUse) {
                // Check WAL file age - if older than 1 minute and database is not locked, it's likely stale
                if (fs.existsSync(walFile)) {
                    try {
                        const walStats = fs.statSync(walFile);
                        const walAge = Date.now() - walStats.mtime.getTime();
                        // If WAL file is older than 1 minute, try to checkpoint
                        if (walAge > 60 * 1000) {
                            // Try to checkpoint first to merge WAL into main database
                            try {
                                const tempDb = new Database(dbPath, { readonly: true, timeout: 1000 });
                                tempDb.pragma('wal_checkpoint(TRUNCATE)');
                                tempDb.close();
                                
                                // After checkpoint, check if WAL file still exists and is large
                                if (fs.existsSync(walFile)) {
                                    const walStatsAfter = fs.statSync(walFile);
                                    // If WAL is still large after checkpoint and old, it might be stale
                                    if (walStatsAfter.size > 0 && walAge > 5 * 60 * 1000) {
                                        fs.unlinkSync(walFile);
                                        if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
                                            console.debug(`[Database] Removed stale WAL file: ${walFile}`);
                                        }
                                    }
                                }
                            } catch (checkpointError) {
                                // If checkpoint fails, WAL might be needed - don't delete
                            }
                        }
                    } catch (walError) {
                        // Ignore errors when checking WAL file
                    }
                }
                
                // Remove SHM file if it exists and WAL doesn't (SHM is only needed when WAL is active)
                if (fs.existsSync(shmFile) && !fs.existsSync(walFile)) {
                    try {
                        fs.unlinkSync(shmFile);
                        if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
                            console.debug(`[Database] Removed orphaned SHM file: ${shmFile}`);
                        }
                    } catch (shmError) {
                        // Ignore errors
                    }
                }
                
                // Remove journal file if it exists (should only exist in DELETE/TRUNCATE journal mode)
                if (fs.existsSync(journalFile)) {
                    try {
                        const journalStats = fs.statSync(journalFile);
                        const journalAge = Date.now() - journalStats.mtime.getTime();
                        // If journal file is older than 1 minute, it's likely stale
                        if (journalAge > 60 * 1000) {
                            fs.unlinkSync(journalFile);
                            if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
                                console.debug(`[Database] Removed stale journal file: ${journalFile}`);
                            }
                        }
                    } catch (journalError) {
                        // Ignore errors
                    }
                }
            }
        } catch (error) {
            // Don't throw - cleanup failure shouldn't prevent app from starting
            if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
                console.debug(`[Database] Error cleaning up stale WAL files: ${error.message}`);
            }
        }
    }

    // Clean up old corrupted database backup files
    // Keeps only the last 5 corrupted backups and deletes older ones
    cleanupOldCorruptedBackups(dbPath) {
        try {
            const dbDir = path.dirname(dbPath);
            const dbFileName = path.basename(dbPath);
            
            // Find all emergency backup files (corrupted, emergency, integrity_issue, pre_repair_backup, corrupted_last_resort)
            const files = fs.readdirSync(dbDir);
            const emergencyBackupPatterns = [
                dbFileName + '.corrupted.',
                dbFileName + '.corrupted_last_resort.',
                dbFileName + '.emergency.',
                dbFileName + '.integrity_issue.',
                dbFileName + '.pre_repair_backup.'
            ];
            
            const emergencyFiles = files
                .filter(file => emergencyBackupPatterns.some(pattern => file.startsWith(pattern)))
                .map(file => {
                    const filePath = path.join(dbDir, file);
                    try {
                        const stats = fs.statSync(filePath);
                        return {
                            name: file,
                            path: filePath,
                            mtime: stats.mtime,
                            size: stats.size
                        };
                    } catch (statError) {
                        return null;
                    }
                })
                .filter(file => file !== null)
                .sort((a, b) => b.mtime - a.mtime); // Sort by modification time (newest first)
            
            // Delete files older than 7 days
            const now = Date.now();
            const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
            let deletedCount = 0;
            let totalSizeFreed = 0;
            
            emergencyFiles.forEach(file => {
                const fileAge = now - file.mtime.getTime();
                if (fileAge > maxAge) {
                    try {
                        fs.unlinkSync(file.path);
                        deletedCount++;
                        totalSizeFreed += file.size;
                        if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
                            console.debug(`[Database] Deleted old emergency backup: ${file.name} (age: ${Math.round(fileAge / (24 * 60 * 60 * 1000))} days)`);
                        }
                    } catch (deleteError) {
                        console.warn(`[Database] Could not delete old emergency backup ${file.name}: ${deleteError.message}`);
                    }
                }
            });
            
            // Also keep only the last 3 files of each type (if less than 7 days old)
            const filesByType = {};
            emergencyFiles.forEach(file => {
                // Determine file type
                let fileType = 'unknown';
                if (file.name.includes('.corrupted_last_resort.')) fileType = 'corrupted_last_resort';
                else if (file.name.includes('.corrupted.')) fileType = 'corrupted';
                else if (file.name.includes('.emergency.')) fileType = 'emergency';
                else if (file.name.includes('.integrity_issue.')) fileType = 'integrity_issue';
                else if (file.name.includes('.pre_repair_backup.')) fileType = 'pre_repair_backup';
                
                if (!filesByType[fileType]) {
                    filesByType[fileType] = [];
                }
                filesByType[fileType].push(file);
            });
            
            // Keep only last 3 of each type
            Object.keys(filesByType).forEach(type => {
                const typeFiles = filesByType[type];
                if (typeFiles.length > 3) {
                    const filesToDelete = typeFiles.slice(3); // Keep first 3 (newest), delete the rest
                    filesToDelete.forEach(file => {
                        const fileAge = now - file.mtime.getTime();
                        // Only delete if less than 7 days old (older ones already deleted above)
                        if (fileAge <= maxAge) {
                            try {
                                fs.unlinkSync(file.path);
                                deletedCount++;
                                totalSizeFreed += file.size;
                                if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
                                    console.debug(`[Database] Deleted old ${type} backup: ${file.name}`);
                                }
                            } catch (deleteError) {
                                console.warn(`[Database] Could not delete old ${type} backup ${file.name}: ${deleteError.message}`);
                            }
                        }
                    });
                }
            });
            
            if (deletedCount > 0) {
                const sizeInMB = (totalSizeFreed / (1024 * 1024)).toFixed(2);
                if (deletedCount > 5 || totalSizeFreed > 10 * 1024 * 1024) {
                    console.log(`[Database] Cleaned up ${deletedCount} old emergency backup files, freed ${sizeInMB} MB`);
                } else if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
                    console.debug(`[Database] Cleaned up ${deletedCount} old emergency backup files, freed ${sizeInMB} MB`);
                }
            }
        } catch (error) {
            // Don't throw - cleanup failure shouldn't prevent app from starting
            console.warn(`[Database] Error cleaning up old emergency backups: ${error.message}`);
        }
    }

    // Find latest valid backup
    findLatestValidBackup() {
        try {
            // First, try to get backups from history if database is available
            let backups = [];
            if (this.db) {
                try {
                    backups = this.getBackupHistory(50);
                } catch (historyError) {
                    console.warn(`[Database] Could not get backup history from database: ${historyError.message}`);
                }
            }
            
            // If no backups from history, search for backup files directly
            if (backups.length === 0) {
                // Hide search message - only show if backup found
                
                // Search in backups directory
                const backupDir = path.join(this.userDataPath, 'backups');
                if (fs.existsSync(backupDir)) {
                    try {
                        const files = fs.readdirSync(backupDir);
                        // Sort by modification time (newest first)
                        const backupFiles = files
                            .filter(file => file.endsWith('.db'))
                            .map(file => ({
                                backupPath: path.join(backupDir, file),
                                createdAt: fs.statSync(path.join(backupDir, file)).mtime.toISOString()
                            }))
                            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                            .slice(0, 50); // Get last 50
                        
                        backups = backupFiles;
                    } catch (dirError) {
                        console.warn(`[Database] Could not read backup directory: ${dirError.message}`);
                    }
                }
                
                // Also search in userData directory for .db files (including corrupted backups)
                if (backups.length === 0) {
                    try {
                        const userDataFiles = fs.readdirSync(this.userDataPath);
                        const dbFiles = userDataFiles
                            .filter(file => file.endsWith('.db') && file !== 'asel-database.db')
                            .map(file => ({
                                backupPath: path.join(this.userDataPath, file),
                                createdAt: fs.statSync(path.join(this.userDataPath, file)).mtime.toISOString()
                            }))
                            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                            .slice(0, 20); // Get last 20
                        
                        backups = dbFiles;
                    } catch (dirError) {
                        console.warn(`[Database] Could not read userData directory: ${dirError.message}`);
                    }
                }
            }
            
            // Try each backup until we find a valid one
            for (const backup of backups) {
                const backupPath = backup.backupPath || backup;
                if (!backupPath || !fs.existsSync(backupPath)) {
                    continue;
                }
                
                // Check if backup file is readable and has size
                try {
                    const stats = fs.statSync(backupPath);
                    if (!stats.isFile() || stats.size === 0) {
                        continue;
                    }
                    
                    // Try to verify backup integrity
                    try {
                        const testDb = new Database(backupPath, { readonly: true, timeout: 5000 });
                        const integrityResult = testDb.pragma('integrity_check');
                        testDb.close();
                        
                        if (integrityResult === 'ok' || (Array.isArray(integrityResult) && integrityResult[0] === 'ok')) {
                            // Hide success message - only show errors
                            return backupPath;
                        }
                    } catch (integrityError) {
                        // Backup is corrupted, try next one
                        continue;
                    }
                } catch (fileError) {
                    // File error, try next backup
                    continue;
                }
            }
            
            // No valid backup found - only log if critical
            return null;
        } catch (error) {
            console.error(`[Database] Error finding latest valid backup: ${error.message}`);
            return null;
        }
    }

    // Wait for database to be unlocked (with timeout) - synchronous version
    waitForDatabaseUnlockSync(dbPath, maxWaitTime = 10000) {
        const startTime = Date.now();
        const checkInterval = 500; // Check every 500ms
        
        while (Date.now() - startTime < maxWaitTime) {
            try {
                // Try to open database with short timeout
                const testDb = new Database(dbPath, { timeout: 1000 });
                testDb.close();
                return true; // Database is unlocked
            } catch (error) {
                // Database is still locked, wait a bit
                if (Date.now() - startTime >= maxWaitTime) {
                    return false; // Timeout
                }
                // Use a simple blocking wait
                const waitUntil = Date.now() + checkInterval;
                while (Date.now() < waitUntil) {
                    // Busy wait
                }
            }
        }
        return false; // Timeout
    }

    // Repair corrupted database
    repairDatabase(dbPath, corruptionDetails = null) {
        try {
            // Log corruption details if available
            if (corruptionDetails) {
                // Format corruption details properly (handle both string and object)
                let detailsStr;
                if (typeof corruptionDetails === 'string') {
                    detailsStr = corruptionDetails;
                } else if (Array.isArray(corruptionDetails)) {
                    // Handle array - convert each element to string
                    detailsStr = corruptionDetails.map(item => 
                        typeof item === 'string' ? item : JSON.stringify(item)
                    ).join(', ');
                } else if (corruptionDetails && typeof corruptionDetails === 'object') {
                    // Handle object - safely stringify
                    try {
                        detailsStr = JSON.stringify(corruptionDetails, null, 2);
                    } catch (stringifyError) {
                        // If stringify fails (circular reference), use a safe representation
                        detailsStr = String(corruptionDetails);
                    }
                } else {
                    detailsStr = String(corruptionDetails);
                }
                console.log(`[Database] 🔧 Repairing database. Corruption details: ${detailsStr}`);
            }
            
            // Step 0: Check if database is locked before starting repair
            let testDb = null;
            try {
                testDb = new Database(dbPath, { readonly: true, timeout: 2000 });
                testDb.close();
            } catch (lockTestError) {
                if (lockTestError.message && lockTestError.message.includes('locked')) {
                    console.error(`[Database] ❌ Database is locked. Cannot proceed with repair.`);
                    throw new Error(`Database is locked and cannot be repaired. Please close all applications and restart.`);
                }
            }
            
            // Step 1: Create backup of corrupted database BEFORE any operations
            const corruptedBackupPath = dbPath + '.corrupted.' + Date.now();
            if (fs.existsSync(dbPath)) {
                try {
                    fs.copyFileSync(dbPath, corruptedBackupPath);
                    // Hide success message - only show errors
                } catch (copyError) {
                    // Only log if critical
                }
            }
            
            // Step 2: Close any existing connection gracefully
            if (this.db) {
                try {
                    this.db.close();
                    this.db = null;
                } catch (closeError) {
                    // Hide non-critical warnings
                }
            }
            
            // Step 3: Wait for database to be unlocked (if locked)
            const isUnlocked = this.waitForDatabaseUnlockSync(dbPath, 10000);
            if (!isUnlocked) {
                console.error(`[Database] ❌ Database is locked and cannot be repaired. Please close all applications and restart.`);
                throw new Error(`Database is locked and cannot be repaired. Please close all applications and restart.`);
            }
            
            // Step 4: Delete WAL and SHM files (they might be corrupted too)
            const walPath = dbPath + '-wal';
            const shmPath = dbPath + '-shm';
            try {
                if (fs.existsSync(walPath)) {
                    fs.unlinkSync(walPath);
                }
            } catch (e) {
                // Ignore - file might not exist or be locked
            }
            try {
                if (fs.existsSync(shmPath)) {
                    fs.unlinkSync(shmPath);
                }
            } catch (e) {
                // Ignore - file might not exist or be locked
            }
            
            // Step 5: Try to repair using VACUUM
            let repairSuccess = false;
            try {
                const repairDb = new Database(dbPath, { timeout: 10000 });
                // Switch to DELETE mode temporarily for repair
                repairDb.pragma('journal_mode = DELETE');
                // Run VACUUM to rebuild database
                repairDb.exec('VACUUM');
                repairDb.close();
                repairSuccess = true;
                
                // Verify repair was successful using improved logic
                const verifyDb = new Database(dbPath, { readonly: true });
                const integrityResult = verifyDb.pragma('integrity_check');
                verifyDb.close();
                
                // Check if repair was actually successful
                let isStillCorrupted = false;
                if (typeof integrityResult === 'string') {
                    const trimmed = integrityResult.trim();
                    isStillCorrupted = trimmed !== 'ok' && (
                        trimmed.toLowerCase().includes('error') ||
                        trimmed.toLowerCase().includes('corrupt') ||
                        trimmed.toLowerCase().includes('malformed') ||
                        (trimmed.length > 10 && trimmed.length < 200)
                    );
                } else if (Array.isArray(integrityResult)) {
                    const firstResult = Array.isArray(integrityResult[0]) ? integrityResult[0][0] : integrityResult[0];
                    if (typeof firstResult === 'string') {
                        const trimmed = firstResult.trim();
                        isStillCorrupted = trimmed !== 'ok' && (
                            trimmed.toLowerCase().includes('error') ||
                            trimmed.toLowerCase().includes('corrupt') ||
                            trimmed.toLowerCase().includes('malformed')
                        );
                    } else {
                        isStillCorrupted = firstResult !== 'ok';
                    }
                } else if (integrityResult && typeof integrityResult === 'object') {
                    const resultStr = JSON.stringify(integrityResult);
                    const hasOk = resultStr.includes('"ok"') || resultStr.includes('"ok":"ok"');
                    const hasError = resultStr.toLowerCase().includes('error') || 
                                   resultStr.toLowerCase().includes('corrupt') ||
                                   resultStr.toLowerCase().includes('malformed');
                    isStillCorrupted = !hasOk && hasError;
                }
                
                if (isStillCorrupted) {
                    repairSuccess = false;
                }
            } catch (vacuumError) {
                repairSuccess = false;
            }
            
            // Step 6: If VACUUM failed, try to restore from backup
            if (!repairSuccess) {
                const latestBackup = this.findLatestValidBackup();
                if (latestBackup) {
                    try {
                        this.restoreBackup(latestBackup);
                        // Only log success if critical
                        return; // Success - database restored
                    } catch (restoreError) {
                        console.error(`[Database] ❌ Failed to restore from backup: ${restoreError.message}`);
                        // Continue to last resort
                    }
                } else {
                    console.error(`[Database] ❌ No valid backup found. Database may be corrupted.`);
                    console.error(`[Database] ⚠️ Please check backup directory: ${path.join(this.userDataPath, 'backups')}`);
                    
                    // Try to create a backup of the corrupted database as last resort
                    try {
                        const lastResortBackup = dbPath + '.corrupted_last_resort.' + Date.now();
                        if (fs.existsSync(dbPath)) {
                            fs.copyFileSync(dbPath, lastResortBackup);
                            console.log(`[Database] ⚠️ Created last resort backup: ${lastResortBackup}`);
                            console.log(`[Database] ⚠️ You may be able to recover some data from this file manually.`);
                        }
                    } catch (backupError) {
                        console.error(`[Database] ❌ Could not create last resort backup: ${backupError.message}`);
                    }
                }
                
                // Step 7: Last resort - only recreate if no backup available
                console.error(`[Database] ⚠️ Database repair failed. Please close all applications and restart, or restore from backup manually.`);
                
                // Don't throw error - allow app to continue
                // The database might still be usable even if repair failed
                
                // Try to reopen the database connection if it was closed
                if (!this.db) {
                    try {
                        this.db = new Database(dbPath, { timeout: 10000 });
                        this.db.pragma('journal_mode = WAL');
                        this.db.pragma('foreign_keys = ON');
                    } catch (reopenError) {
                        console.error(`[Database] ❌ Could not reopen database: ${reopenError.message}`);
                        throw new Error(`Database is locked and cannot be accessed. Please close all applications using the database and restart.`);
                    }
                }
                
                // Don't throw - allow app to continue
                return;
            } else {
                // Step 8: Reopen database connection after successful repair
                this.db = new Database(dbPath);
                this.db.pragma('journal_mode = WAL');
                this.db.pragma('foreign_keys = ON');
                // Hide success message - repair completed silently
            }
        } catch (error) {
            console.error(`[Database] ❌ Error during database repair: ${error.message}`);
            throw error;
        }
    }

    // Create emergency backup before risky operations
    createEmergencyBackup() {
        try {
            if (!this.db || !fs.existsSync(this.dbPath)) {
                return null;
            }
            
            const emergencyBackupPath = this.dbPath + '.emergency.' + Date.now();
            try {
                // Perform checkpoint first to ensure all data is in main database
                this.checkpoint();
                
                // Copy database file
                fs.copyFileSync(this.dbPath, emergencyBackupPath);
                // Hide success message - only show errors
                return emergencyBackupPath;
            } catch (backupError) {
                console.error(`[Database] ❌ Failed to create emergency backup: ${backupError.message}`);
                return null;
            }
        } catch (error) {
            console.error('Error creating emergency backup:', error);
            return null;
        }
    }

    // Generic CRUD Operations
    insert(table, data) {
        try {
            // Hash password if inserting into users table and password is provided
            if (table === 'users' && data.password) {
                // Only hash if it's not already hashed (bcrypt hashes are 60 chars and start with $2)
                if (!passwordUtils.isHashed(data.password)) {
                    data = { ...data, password: passwordUtils.hashPasswordSync(data.password) };
                }
            }
            
            const keys = Object.keys(data);
            const placeholders = keys.map(() => '?').join(', ');
            const values = keys.map(key => {
                // Handle JSON objects/arrays
                if (typeof data[key] === 'object' && data[key] !== null && !(data[key] instanceof Date)) {
                    return JSON.stringify(data[key]);
                }
                return data[key];
            });
            const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
            
            // Use transaction for critical tables to prevent corruption
            const criticalTables = [
                'sales_invoices', 'sales_invoice_items', 'delivery_notes', 'delivery_note_items',
                'delivery_settlements', 'settlement_items', 'receipts', 'payments',
                'purchase_invoices', 'purchase_invoice_items', 'operating_expenses',
                'inventory_adjustments', 'returns', 'customers', 'suppliers', 'products'
            ];
            
            let result;
            if (criticalTables.includes(table)) {
                // Use transaction for critical operations
                const transaction = this.db.transaction((data) => {
                    const stmt = this.db.prepare(sql);
                    return stmt.run(...values);
                });
                result = transaction(data);
            } else {
                // For non-critical tables, use direct insert
                const stmt = this.db.prepare(sql);
                result = stmt.run(...values);
            }
            
            // Check if insert was successful
            if (result.changes === 0) {
                console.error(`[Database] ❌ Insert returned 0 changes for table ${table}!`);
            }
            
            // Perform checkpoint after important operations to ensure data is persisted
            // This reduces data loss risk in case of power failure
            const importantTables = [
                'sales_invoices', 'delivery_notes', 'delivery_settlements',
                'receipts', 'payments', 'purchase_invoices',
                'operating_expenses', 'inventory_adjustments', 'returns'
            ];
            if (importantTables.includes(table)) {
                // Create emergency backup before important operations (only if no recent backup)
                try {
                    const lastBackupDate = this.getLastBackupDate();
                    const now = new Date();
                    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
                    
                    // Only create emergency backup if last backup is older than 1 hour
                    if (!lastBackupDate || lastBackupDate < oneHourAgo) {
                        this.createEmergencyBackup();
                    }
                } catch (backupError) {
                    // Don't fail the insert if backup fails
                    console.warn(`[Database] Emergency backup before insert failed (non-critical): ${backupError.message}`);
                }
                
                // Perform checkpoint after important insert to ensure data is in main database
                // This is especially important to prevent data loss during power failure
                try {
                    this.checkpoint();
                } catch (checkpointError) {
                    // Don't fail the insert if checkpoint fails
                    console.warn(`[Database] Checkpoint after insert failed (non-critical): ${checkpointError.message}`);
                }
            }
            
            return result;
        } catch (error) {
            console.error(`[Database] Error inserting into ${table}:`, error);
            console.error(`[Database] Data:`, data);
            
            // Note: Automatic repair is disabled - user will handle repairs manually or through the app
            // Return error in a format that can be checked
            return { success: false, error: error.message };
        }
    }

    update(table, id, data) {
        try {
            // Hash password if updating users table and password is provided
            if (table === 'users' && data.password) {
                // Only hash if it's not already hashed (bcrypt hashes are 60 chars and start with $2)
                if (!passwordUtils.isHashed(data.password)) {
                    data = { ...data, password: passwordUtils.hashPasswordSync(data.password) };
                }
            }
            
            // Tables that don't have updatedAt column
            const tablesWithoutUpdatedAt = ['delivery_note_items', 'settlement_items', 'sales_invoice_items', 'purchase_invoice_items'];
            const hasUpdatedAt = !tablesWithoutUpdatedAt.includes(table);
            
            const keys = Object.keys(data);
            // Filter out updatedAt from data since we set it automatically (if table has it)
            const filteredKeys = keys.filter(key => key !== 'updatedAt');
            const setClause = filteredKeys.map(key => `${key} = ?`).join(', ');
            const filteredValues = filteredKeys.map(key => {
                // Handle JSON objects/arrays
                if (typeof data[key] === 'object' && data[key] !== null && !(data[key] instanceof Date)) {
                    return JSON.stringify(data[key]);
                }
                return data[key];
            });
            const values = [...filteredValues, id];
            
            // Only add updatedAt if table has it
            let sql;
            if (hasUpdatedAt) {
                sql = `UPDATE ${table} SET ${setClause}, updatedAt = datetime('now') WHERE id = ?`;
            } else {
                sql = `UPDATE ${table} SET ${setClause} WHERE id = ?`;
            }
            
            // Use transaction for critical tables to prevent corruption
            const criticalTables = [
                'sales_invoices', 'sales_invoice_items', 'delivery_notes', 'delivery_note_items',
                'delivery_settlements', 'settlement_items', 'receipts', 'payments',
                'purchase_invoices', 'purchase_invoice_items', 'operating_expenses',
                'inventory_adjustments', 'returns', 'customers', 'suppliers', 'products'
            ];
            
            let result;
            if (criticalTables.includes(table)) {
                // Use transaction for critical operations
                const transaction = this.db.transaction((data) => {
                    const stmt = this.db.prepare(sql);
                    return stmt.run(...values);
                });
                result = transaction(data);
            } else {
                // For non-critical tables, use direct update
                const stmt = this.db.prepare(sql);
                result = stmt.run(...values);
            }
            
            // Check if update was successful
            if (result.changes === 0) {
                console.warn(`[Database] ⚠️ Update returned 0 changes for ${table} id ${id}!`);
            }
            
            // Perform checkpoint after important operations to ensure data is persisted
            // This reduces data loss risk in case of power failure
            const importantTables = [
                'sales_invoices', 'delivery_notes', 'delivery_settlements',
                'receipts', 'payments', 'purchase_invoices',
                'operating_expenses', 'inventory_adjustments', 'returns',
                'customers', 'suppliers', 'products' // Also checkpoint customer/supplier/product updates
            ];
            if (importantTables.includes(table)) {
                // Perform checkpoint after important update to ensure data is in main database
                // This is especially important to prevent data loss during power failure
                try {
                    this.checkpoint();
                } catch (checkpointError) {
                    // Don't fail the update if checkpoint fails
                    console.warn(`[Database] Checkpoint after update failed (non-critical): ${checkpointError.message}`);
                }
            }
            
            return result;
        } catch (error) {
            console.error(`[Database] Error updating ${table} id ${id}:`, error);
            console.error(`[Database] Data:`, data);
            // Return error in a format that can be checked
            return { success: false, error: error.message };
        }
    }

    delete(table, id) {
        const sql = `DELETE FROM ${table} WHERE id = ?`;
        const stmt = this.db.prepare(sql);
        return stmt.run(id);
    }

    getById(table, id) {
        const sql = `SELECT * FROM ${table} WHERE id = ?`;
        const stmt = this.db.prepare(sql);
        return stmt.get(id);
    }

    getAll(table, where = '', params = []) {
        try {
            let sql = `SELECT * FROM ${table}`;
            if (where && where.trim() !== '') {
                sql += ` WHERE ${where}`;
            }
            const stmt = this.db.prepare(sql);
            let result;
            if (params && params.length > 0) {
                result = stmt.all(...params);
            } else {
                result = stmt.all();
            }
            // Ensure result is always an array
            return Array.isArray(result) ? result : (result ? [result] : []);
        } catch (error) {
            // If error is about missing column, try to get only existing columns
            if (error.message && error.message.includes('no such column')) {
                try {
                    // Get actual columns from table
                    const tableInfo = this.db.prepare(`PRAGMA table_info(${table})`).all();
                    const existingColumns = tableInfo.map(col => col.name);
                    const columns = existingColumns.join(', ');
                    
                    // If WHERE clause contains a column that doesn't exist, remove that condition
                    let whereClause = where;
                    if (where && where.trim() !== '') {
                        // Check if WHERE clause references non-existent columns
                        // Extract column names from WHERE clause (simple pattern matching)
                        const whereColumns = where.match(/\b(\w+)\s*[=<>!]/g) || [];
                        const invalidColumns = whereColumns
                            .map(match => match.replace(/\s*[=<>!].*$/, '').trim())
                            .filter(col => !existingColumns.includes(col));
                        
                        // If there are invalid columns in WHERE clause, skip the WHERE clause
                        if (invalidColumns.length > 0) {
                            console.warn(`[Database] WHERE clause for ${table} contains non-existent columns: ${invalidColumns.join(', ')}. Ignoring WHERE clause.`);
                            whereClause = '';
                        }
                    }
                    
                    let sql = `SELECT ${columns} FROM ${table}`;
                    if (whereClause && whereClause.trim() !== '') {
                        sql += ` WHERE ${whereClause}`;
                    }
                    const stmt = this.db.prepare(sql);
                    let result;
                    if (params && params.length > 0 && whereClause) {
                        result = stmt.all(...params);
                    } else {
                        result = stmt.all();
                    }
                    // Ensure result is always an array
                    return Array.isArray(result) ? result : (result ? [result] : []);
                } catch (retryError) {
                    console.error(`[Database] Error in getAll for ${table} (retry with column list):`, retryError);
                    return [];
                }
            }
            console.error(`[Database] Error in getAll for ${table}:`, error);
            return [];
        }
    }

    query(sql, params = []) {
        const stmt = this.db.prepare(sql);
        if (sql.trim().toUpperCase().startsWith('SELECT')) {
            return params.length > 0 ? stmt.all(...params) : stmt.all();
        } else {
            return params.length > 0 ? stmt.run(...params) : stmt.run();
        }
    }

    // Encryption/Decryption Functions for Backups
    getEncryptionKey() {
        // Generate a key from app name and userData path (consistent per installation)
        // This ensures the same key is used for encryption/decryption
        const userDataPath = app.getPath('userData');
        const keyMaterial = `asel-backup-encryption-${userDataPath}`;
        // Use PBKDF2 to derive a 32-byte key (AES-256 requires 32 bytes)
        const salt = 'asel-backup-salt-2025';
        return crypto.pbkdf2Sync(keyMaterial, salt, 100000, 32, 'sha256');
    }

    encryptBackupFile(inputPath, outputPath) {
        try {
            const key = this.getEncryptionKey();
            const iv = crypto.randomBytes(16); // Initialization Vector
            
            const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
            const input = fs.createReadStream(inputPath);
            const output = fs.createWriteStream(outputPath);
            
            // Write IV at the beginning of the encrypted file
            output.write(iv);
            
            input.pipe(cipher).pipe(output);
            
            return new Promise((resolve, reject) => {
                output.on('finish', () => {
                    resolve({ success: true, iv: iv.toString('hex') });
                });
                output.on('error', (error) => {
                    reject(error);
                });
            });
        } catch (error) {
            throw new Error(`Encryption failed: ${error.message}`);
        }
    }

    decryptBackupFile(inputPath, outputPath) {
        try {
            const key = this.getEncryptionKey();
            
            // Read IV from the beginning of the encrypted file
            const encryptedBuffer = fs.readFileSync(inputPath);
            const iv = encryptedBuffer.slice(0, 16);
            const encryptedData = encryptedBuffer.slice(16);
            
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
            const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
            
            fs.writeFileSync(outputPath, decrypted);
            
            return { success: true };
        } catch (error) {
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }


    // Backup Functions
    // Manual backup - saves WITHOUT encryption (plain SQLite database file)
    // This allows users to easily restore backups or open them with SQLite tools
    async createBackup(backupPath) {
        try {
            // Ensure backup directory exists with error handling
            const backupDir = path.dirname(backupPath);
            if (!fs.existsSync(backupDir)) {
                try {
                    fs.mkdirSync(backupDir, { recursive: true });
                } catch (mkdirError) {
                    console.error('Error creating backup directory:', mkdirError);
                    throw new Error(`Cannot create backup directory: ${backupDir}. Please check permissions.`);
                }
            }
            
            // Verify directory is writable
            try {
                fs.accessSync(backupDir, fs.constants.W_OK);
            } catch (accessError) {
                console.error('Backup directory is not writable:', accessError);
                throw new Error(`Cannot write to backup directory: ${backupDir}. Please check permissions.`);
            }

            // Checkpoint WAL to ensure all data is in main database file
            this.db.pragma('wal_checkpoint(FULL)');

            // Remove destination file if it exists
            if (fs.existsSync(backupPath)) {
                fs.unlinkSync(backupPath);
            }

            // Check available disk space before backup
            const dbStats = fs.statSync(this.dbPath);
            const estimatedBackupSize = dbStats.size * 1.2; // Add 20% buffer
            const backupDirStats = fs.statSync(backupDir);
            if (backupDirStats.size !== undefined) {
                // Try to get free space (works on some systems)
                try {
                    const freeSpace = require('os').freemem(); // This is RAM, not disk
                    // For disk space, we'll check after creation
                } catch (e) {
                    // Ignore if can't check
                }
            }

            // IMPORTANT: Create backup WITHOUT encryption (plain SQLite file)
            // Use VACUUM INTO to create a complete backup (SQLite 3.27+)
            // VACUUM INTO creates a backup with all data - NO ENCRYPTION
            // Escape single quotes and convert backslashes to forward slashes for SQLite
            const backupPathEscaped = backupPath.replace(/\\/g, '/').replace(/'/g, "''");
            this.db.exec(`VACUUM INTO '${backupPathEscaped}'`);
            
            // Verify backup file exists and has content
            if (!fs.existsSync(backupPath)) {
                throw new Error('Backup file was not created');
            }
            
            let fileSize = fs.statSync(backupPath).size;
            if (fileSize === 0) {
                throw new Error('Backup file is empty');
            }

            // Integrity Check: Verify backup database can be opened and is valid
            let testDb = null;
            try {
                testDb = new Database(backupPath, { readonly: true });
                const integrityResult = testDb.pragma('integrity_check');
                testDb.close();
                
                // integrity_check returns 'ok' if valid, or error messages if not
                if (integrityResult !== 'ok' && typeof integrityResult === 'string' && integrityResult.trim() !== 'ok') {
                    throw new Error(`Backup integrity check failed: ${integrityResult}`);
                }
            } catch (integrityError) {
                if (testDb && testDb.open) {
                    testDb.close();
                }
                // Delete invalid backup file
                if (fs.existsSync(backupPath)) {
                    fs.unlinkSync(backupPath);
                }
                throw new Error(`Backup integrity verification failed: ${integrityError.message}`);
            }

            // Calculate checksum for backup file
            fileSize = fs.statSync(backupPath).size;
            const fileBuffer = fs.readFileSync(backupPath);
            const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

            // Save backup history with checksum (NOT ENCRYPTED - plain SQLite file)
            this.insert('backup_history', {
                id: `backup_${Date.now()}`,
                backupPath: backupPath,
                backupType: 'manual',
                fileSize: fileSize,
                checksum: checksum,
                encrypted: 0, // Always 0 for manual backups - no encryption
                createdAt: new Date().toISOString()
            });

            return { success: true, fileSize: fileSize, checksum, encrypted: false };
        } catch (error) {
            console.error('Error creating backup:', error);
            // Fallback: try using copyFileSync
            try {
                if (fs.existsSync(this.dbPath)) {
                    // Checkpoint again
                    this.db.pragma('wal_checkpoint(FULL)');
                    // Copy the database file
                    fs.copyFileSync(this.dbPath, backupPath);
                    const fileSize = fs.statSync(backupPath).size;
                    if (fileSize > 0) {
                        // Integrity Check for fallback backup
                        let testDb = null;
                        try {
                            testDb = new Database(backupPath, { readonly: true });
                            const integrityResult = testDb.pragma('integrity_check');
                            testDb.close();
                            
                            if (integrityResult !== 'ok' && typeof integrityResult === 'string' && integrityResult.trim() !== 'ok') {
                                throw new Error(`Backup integrity check failed: ${integrityResult}`);
                            }
                        } catch (integrityError) {
                            if (testDb && testDb.open) {
                                testDb.close();
                            }
                            if (fs.existsSync(backupPath)) {
                                fs.unlinkSync(backupPath);
                            }
                            throw integrityError;
                        }

                        // Calculate checksum for backup file
                        const fileSize = fs.statSync(backupPath).size;
                        const fileBuffer = fs.readFileSync(backupPath);
                        const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

                        // Save backup history with checksum (NOT ENCRYPTED - plain SQLite file)
                        this.insert('backup_history', {
                            id: `backup_${Date.now()}`,
                            backupPath: backupPath,
                            backupType: 'manual',
                            fileSize: backupFileSize,
                            checksum: checksum,
                            encrypted: 0, // Always 0 for manual backups - no encryption
                            createdAt: new Date().toISOString()
                        });
                        return { success: true, fileSize: backupFileSize, checksum, encrypted: false };
                    }
                }
            } catch (fallbackError) {
                console.error('Fallback backup also failed:', fallbackError);
            }
            return { success: false, error: error.message };
        }
    }

    restoreBackup(backupPath) {
        let currentBackupPath = null;
        
        try {
            // Validate backup path
            if (!backupPath || typeof backupPath !== 'string') {
                throw new Error('Invalid backup path');
            }
            
            // Check if backup file exists
            if (!fs.existsSync(backupPath)) {
                throw new Error(`Backup file does not exist: ${backupPath}`);
            }

            // Verify backup file is a file, not a directory
            const backupStats = fs.statSync(backupPath);
            if (!backupStats.isFile()) {
                throw new Error('Backup path is not a file');
            }
            
            if (backupStats.size === 0) {
                throw new Error('Backup file is empty');
            }
            
            // Check if file is readable
            try {
                fs.accessSync(backupPath, fs.constants.R_OK);
            } catch (accessError) {
                throw new Error(`Backup file is not readable: ${accessError.message}`);
            }

            // Verify backup checksum if available in history
            let decryptedBackupPath = backupPath;
            
            try {
                const backupRecord = this.db.prepare('SELECT encrypted, checksum FROM backup_history WHERE backupPath = ?').get(backupPath);
                if (backupRecord && backupRecord.checksum) {
                    // Verify backup checksum if available
                    const fileBuffer = fs.readFileSync(backupPath);
                    const currentChecksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
                    if (currentChecksum !== backupRecord.checksum) {
                        throw new Error('Backup file checksum mismatch - file may be corrupted');
                    }
                }
            } catch (checksumError) {
                // If checksum check fails, log but continue (backup might not have checksum)
                console.warn('Checksum verification skipped:', checksumError.message);
            }

            // Integrity Check: Verify backup database before restore
            let testDb = null;
            try {
                testDb = new Database(decryptedBackupPath, { readonly: true });
                const integrityResult = testDb.pragma('integrity_check');
                testDb.close();
                
                if (integrityResult !== 'ok' && typeof integrityResult === 'string' && integrityResult.trim() !== 'ok') {
                    throw new Error(`Backup integrity check failed: ${integrityResult}`);
                }
            } catch (integrityError) {
                if (testDb && testDb.open) {
                    testDb.close();
                }
                throw new Error(`Backup integrity verification failed: ${integrityError.message}`);
            }

            // Check if backup is .db file or JSON
            const isDbFile = decryptedBackupPath.toLowerCase().endsWith('.db') || 
                           decryptedBackupPath.toLowerCase().endsWith('.sqlite') ||
                           decryptedBackupPath.toLowerCase().endsWith('.sqlite3');
            
            if (isDbFile) {
                // Verify userData directory is writable before proceeding
                const userDataPath = app.getPath('userData');
                try {
                    fs.accessSync(userDataPath, fs.constants.W_OK);
                } catch (accessError) {
                    throw new Error(`Cannot write to user data directory: ${accessError.message}`);
                }
                
                // Backup current database (just in case) - BEFORE closing
                currentBackupPath = this.dbPath + '.backup.' + Date.now();
                if (fs.existsSync(this.dbPath)) {
                    try {
                        fs.copyFileSync(this.dbPath, currentBackupPath);
                    } catch (copyError) {
                        console.warn('Warning: Could not create backup of current database:', copyError.message);
                        // Continue anyway - might not have permissions
                    }
                }
                
                // Close current database
                try {
                    this.db.close();
                } catch (closeError) {
                    console.warn('Warning: Error closing database:', closeError.message);
                }
                
                // Copy decrypted backup file to database location
                try {
                    fs.copyFileSync(decryptedBackupPath, this.dbPath);
                } catch (copyError) {
                    // Try to reopen database if copy failed
                    try {
                        this.db = new Database(this.dbPath);
                        this.db.pragma('journal_mode = WAL');
                        this.db.pragma('foreign_keys = ON');
                    } catch (reopenError) {
                        // Ignore
                    }
                    throw new Error(`Cannot copy backup file: ${copyError.message}`);
                }
                
                // Reopen database connection
                try {
                    this.db = new Database(this.dbPath);
                    this.db.pragma('journal_mode = WAL');
                    this.db.pragma('foreign_keys = ON');
                } catch (reopenError) {
                    throw new Error(`Cannot reopen database: ${reopenError.message}`);
                }
                
                // Verify Schema after restore
                try {
                    const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
                    const requiredTables = ['users', 'products', 'customers', 'suppliers', 'sales_invoices', 'purchase_invoices'];
                    const existingTables = tables.map(t => t.name);
                    const missingTables = requiredTables.filter(t => !existingTables.includes(t));
                    
                    if (missingTables.length > 0) {
                        throw new Error(`Schema verification failed: Missing tables: ${missingTables.join(', ')}`);
                    }
                } catch (schemaError) {
                    // Rollback: Restore original database
                    this.db.close();
                    if (fs.existsSync(currentBackupPath)) {
                        fs.copyFileSync(currentBackupPath, this.dbPath);
                    }
                    this.db = new Database(this.dbPath);
                    this.db.pragma('journal_mode = WAL');
                    this.db.pragma('foreign_keys = ON');
                    throw new Error(`Schema verification failed: ${schemaError.message}. Original database restored.`);
                }
                
                return { success: true };
            } else {
                // Handle JSON backup (for backward compatibility)
                const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
                
                // Begin transaction
                const transaction = this.db.transaction((tables) => {
                    // Clear existing data
                    Object.keys(tables).forEach(table => {
                        this.db.prepare(`DELETE FROM ${table}`).run();
                    });

                    // Restore data
                    Object.keys(tables).forEach(table => {
                        if (tables[table] && tables[table].length > 0) {
                            const keys = Object.keys(tables[table][0]);
                            const placeholders = keys.map(() => '?').join(', ');
                            const insertSql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
                            const insertStmt = this.db.prepare(insertSql);
                            
                            tables[table].forEach(row => {
                                const values = keys.map(key => row[key]);
                                insertStmt.run(...values);
                            });
                        }
                    });
                });

                transaction(backup.tables);
                return { success: true };
            }
        } catch (error) {
            // Rollback: If restore failed and we have a backup, restore it
            if (currentBackupPath && fs.existsSync(currentBackupPath)) {
                try {
                    if (this.db && this.db.open) {
                        this.db.close();
                    }
                    if (fs.existsSync(this.dbPath)) {
                        fs.unlinkSync(this.dbPath);
                    }
                    fs.copyFileSync(currentBackupPath, this.dbPath);
                    this.db = new Database(this.dbPath);
                    this.db.pragma('journal_mode = WAL');
                    this.db.pragma('foreign_keys = ON');
                    console.log('✅ Rollback successful: Original database restored');
                } catch (rollbackError) {
                    console.error('❌ Rollback failed:', rollbackError);
                }
            } else {
                // If database was closed, try to reopen it
                if (!this.db || !this.db.open) {
                    try {
                        this.db = new Database(this.dbPath);
                        this.db.pragma('journal_mode = WAL');
                        this.db.pragma('foreign_keys = ON');
                    } catch (reopenError) {
                        console.error('❌ Failed to reopen database:', reopenError);
                    }
                }
            }
            return { success: false, error: error.message };
        }
    }

    getBackupHistory(limit = 10) {
        try {
            let backups = [];
            
            // Get backups from database history
            if (this.db) {
                try {
                    const sql = `SELECT * FROM backup_history ORDER BY createdAt DESC LIMIT ?`;
                    const stmt = this.db.prepare(sql);
                    backups = stmt.all(limit);
                } catch (dbError) {
                    console.warn('[Database] Could not get backup history from database:', dbError.message);
                }
            }
            
            // Also scan for backup files on disk that might not be in history
            const discoveredBackups = this.scanBackupFilesOnDisk();
            
            // Merge discovered backups with database backups
            // Remove duplicates based on backupPath
            const backupMap = new Map();
            
            // Add database backups first
            backups.forEach(backup => {
                if (backup.backupPath) {
                    backupMap.set(backup.backupPath, backup);
                }
            });
            
            // Add discovered backups (only if not already in map)
            discoveredBackups.forEach(backup => {
                if (backup.backupPath && !backupMap.has(backup.backupPath)) {
                    backupMap.set(backup.backupPath, backup);
                }
            });
            
            // Convert back to array and sort by date (newest first)
            const allBackups = Array.from(backupMap.values());
            allBackups.sort((a, b) => {
                const dateA = new Date(a.createdAt || a.mtime || 0);
                const dateB = new Date(b.createdAt || b.mtime || 0);
                return dateB - dateA;
            });
            
            // Limit results
            return allBackups.slice(0, limit);
        } catch (error) {
            console.error('Error getting backup history:', error);
            return [];
        }
    }

    // Scan for backup files on disk
    scanBackupFilesOnDisk() {
        const discoveredBackups = [];
        
        try {
            // Scan backups directory
            const backupDir = path.join(this.userDataPath, 'backups');
            if (fs.existsSync(backupDir)) {
                try {
                    const files = fs.readdirSync(backupDir);
                    files.forEach(file => {
                        // Only include .db files (not .db-shm or .db-wal)
                        if (file.endsWith('.db') && !file.endsWith('.db-shm') && !file.endsWith('.db-wal')) {
                            const filePath = path.join(backupDir, file);
                            try {
                                const stats = fs.statSync(filePath);
                                if (stats.isFile() && stats.size > 0) {
                                    // Try to verify it's a valid database file
                                    try {
                                        const testDb = new Database(filePath, { readonly: true });
                                        testDb.close();
                                        
                                        discoveredBackups.push({
                                            id: `discovered_${Date.now()}_${file}`,
                                            backupPath: filePath,
                                            backupType: 'auto',
                                            fileSize: stats.size,
                                            createdAt: stats.mtime.toISOString(),
                                            mtime: stats.mtime.toISOString(),
                                            discovered: true
                                        });
                                    } catch (dbError) {
                                        // Not a valid database file, skip it
                                        console.warn(`[Database] Skipping invalid backup file: ${filePath}`);
                                    }
                                }
                            } catch (statError) {
                                console.warn(`[Database] Could not stat backup file ${filePath}: ${statError.message}`);
                            }
                        }
                    });
                } catch (readError) {
                    console.warn(`[Database] Could not read backup directory ${backupDir}: ${readError.message}`);
                }
            }
            
            // Also scan userDataPath for backup files (in case they're in the root)
            try {
                const files = fs.readdirSync(this.userDataPath);
                files.forEach(file => {
                    // Look for backup files (backup-*.db pattern)
                    if (file.startsWith('backup-') && file.endsWith('.db') && !file.endsWith('.db-shm') && !file.endsWith('.db-wal')) {
                        const filePath = path.join(this.userDataPath, file);
                        try {
                            const stats = fs.statSync(filePath);
                            if (stats.isFile() && stats.size > 0) {
                                // Check if already in discoveredBackups
                                const alreadyFound = discoveredBackups.some(b => b.backupPath === filePath);
                                if (!alreadyFound) {
                                    try {
                                        const testDb = new Database(filePath, { readonly: true });
                                        testDb.close();
                                        
                                        discoveredBackups.push({
                                            id: `discovered_${Date.now()}_${file}`,
                                            backupPath: filePath,
                                            backupType: 'manual',
                                            fileSize: stats.size,
                                            createdAt: stats.mtime.toISOString(),
                                            mtime: stats.mtime.toISOString(),
                                            discovered: true
                                        });
                                    } catch (dbError) {
                                        // Not a valid database file, skip it
                                        console.warn(`[Database] Skipping invalid backup file: ${filePath}`);
                                    }
                                }
                            }
                        } catch (statError) {
                            console.warn(`[Database] Could not stat backup file ${filePath}: ${statError.message}`);
                        }
                    }
                });
            } catch (readError) {
                console.warn(`[Database] Could not read userData directory for backups: ${readError.message}`);
            }
        } catch (error) {
            console.error('[Database] Error scanning for backup files:', error);
        }
        
        return discoveredBackups;
    }

    getLastBackupDate() {
        try {
            if (!this.db) {
                console.warn('[Database] Database not available for last backup date');
                return null;
            }
            const sql = `SELECT createdAt FROM backup_history ORDER BY createdAt DESC LIMIT 1`;
            const stmt = this.db.prepare(sql);
            const result = stmt.get();
            return result ? new Date(result.createdAt) : null;
        } catch (error) {
            console.error('Error getting last backup date:', error);
            return null;
        }
    }

    // Helper function to safely delete a file with retry logic
    async safeDeleteFile(filePath, maxRetries = 5) {
        if (!fs.existsSync(filePath)) {
            return true; // File doesn't exist, nothing to delete
        }
        
        let retries = maxRetries;
        while (retries > 0) {
            try {
                fs.unlinkSync(filePath);
                return true; // Successfully deleted
            } catch (unlinkError) {
                if ((unlinkError.code === 'EBUSY' || unlinkError.code === 'EPERM') && retries > 1) {
                    // File is busy or locked, wait and retry
                    retries--;
                    await new Promise(resolve => setTimeout(resolve, 100 * (maxRetries - retries))); // Exponential backoff
                } else if (unlinkError.code === 'EBUSY' || unlinkError.code === 'EPERM') {
                    // Last attempt failed, try to rename instead of delete
                    try {
                        const renamedPath = filePath + '.old.' + Date.now();
                        fs.renameSync(filePath, renamedPath);
                        // Only log in debug mode (development)
                        if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
                            console.debug(`[Database] Renamed locked file to: ${renamedPath}`);
                        }
                        // Schedule cleanup of old renamed files
                        this.cleanupOldRenamedFiles(path.dirname(filePath)).catch(err => {
                            console.warn(`[Database] Error cleaning up old renamed files: ${err.message}`);
                        });
                        return true;
                    } catch (renameError) {
                        throw new Error(`Cannot delete or rename file: ${filePath}. File may be in use by another process. Error: ${unlinkError.message}`);
                    }
                } else {
                    // Other error, throw immediately
                    throw unlinkError;
                }
            }
        }
        return false;
    }

    // Clean up old renamed files (.old.timestamp) older than specified days (default: 7 days)
    async cleanupOldRenamedFiles(directory, maxAgeDays = 7) {
        try {
            if (!fs.existsSync(directory)) {
                return { success: true, deletedCount: 0 };
            }

            const files = fs.readdirSync(directory);
            const now = Date.now();
            const maxAge = maxAgeDays * 24 * 60 * 60 * 1000; // Convert days to milliseconds
            let deletedCount = 0;
            let totalSizeFreed = 0;

            for (const file of files) {
                // Check if file matches the pattern: *.old.timestamp
                const oldFilePattern = /\.old\.\d+$/;
                if (oldFilePattern.test(file)) {
                    const filePath = path.join(directory, file);
                    try {
                        const stats = fs.statSync(filePath);
                        const fileAge = now - stats.mtime.getTime();
                        
                        // Delete if file is older than maxAge
                        if (fileAge > maxAge) {
                            try {
                                const fileSize = stats.size;
                                fs.unlinkSync(filePath);
                                deletedCount++;
                                totalSizeFreed += fileSize;
                                // Only log in debug mode (development)
                                if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
                                    console.debug(`[Database] Deleted old renamed file: ${file} (age: ${Math.round(fileAge / (24 * 60 * 60 * 1000))} days)`);
                                }
                            } catch (deleteError) {
                                // If still locked, try again later - don't fail
                                console.warn(`[Database] Could not delete old renamed file ${file}: ${deleteError.message}`);
                            }
                        }
                    } catch (statError) {
                        console.warn(`[Database] Could not stat old renamed file ${file}: ${statError.message}`);
                    }
                }
            }

            if (deletedCount > 0) {
                const sizeInMB = (totalSizeFreed / (1024 * 1024)).toFixed(2);
                // Only log if significant cleanup happened (more than 10 files or 100MB)
                if (deletedCount > 10 || totalSizeFreed > 100 * 1024 * 1024) {
                    console.log(`[Database] Cleaned up ${deletedCount} old renamed files, freed ${sizeInMB} MB`);
                } else if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
                    console.debug(`[Database] Cleaned up ${deletedCount} old renamed files, freed ${sizeInMB} MB`);
                }
            }

            return { success: true, deletedCount, sizeFreed: totalSizeFreed };
        } catch (error) {
            console.error('[Database] Error cleaning up old renamed files:', error);
            return { success: false, error: error.message, deletedCount: 0 };
        }
    }

    async createAutoBackup(backupPath) {
        try {
            // Ensure backup directory exists with error handling
            const backupDir = path.dirname(backupPath);
            if (!fs.existsSync(backupDir)) {
                try {
                    fs.mkdirSync(backupDir, { recursive: true });
                } catch (mkdirError) {
                    console.error('Error creating backup directory:', mkdirError);
                    throw new Error(`Cannot create backup directory: ${backupDir}. Please check permissions.`);
                }
            }
            
            // Verify directory is writable
            try {
                fs.accessSync(backupDir, fs.constants.W_OK);
            } catch (accessError) {
                console.error('Backup directory is not writable:', accessError);
                throw new Error(`Cannot write to backup directory: ${backupDir}. Please check permissions.`);
            }

            // Checkpoint WAL to ensure all data is in main database file
            this.db.pragma('wal_checkpoint(FULL)');

            // Remove destination file if it exists (with retry logic)
            await this.safeDeleteFile(backupPath);

            // Use VACUUM INTO to create a complete backup (SQLite 3.27+)
            // VACUUM INTO creates a backup with all data
            // Escape single quotes and convert backslashes to forward slashes for SQLite
            const backupPathEscaped = backupPath.replace(/\\/g, '/').replace(/'/g, "''");
            this.db.exec(`VACUUM INTO '${backupPathEscaped}'`);
            
            // Verify backup file exists and has content
            if (!fs.existsSync(backupPath)) {
                throw new Error('Backup file was not created');
            }
            
            let fileSize = fs.statSync(backupPath).size;
            if (fileSize === 0) {
                throw new Error('Backup file is empty');
            }

            // Integrity Check: Verify backup database can be opened and is valid
            let testDb = null;
            try {
                testDb = new Database(backupPath, { readonly: true });
                const integrityResult = testDb.pragma('integrity_check');
                testDb.close();
                
                // Handle different return types from integrity_check
                let isOk = false;
                if (typeof integrityResult === 'string') {
                    isOk = integrityResult.trim() === 'ok';
                } else if (Array.isArray(integrityResult)) {
                    const firstResult = integrityResult[0];
                    if (typeof firstResult === 'string') {
                        isOk = firstResult.trim() === 'ok';
                    } else if (firstResult && typeof firstResult === 'object' && firstResult.integrity_check) {
                        isOk = firstResult.integrity_check === 'ok';
                    } else {
                        isOk = firstResult === 'ok';
                    }
                } else if (integrityResult && typeof integrityResult === 'object') {
                    // Check if it's an object with 'ok' property
                    isOk = integrityResult.ok === 'ok' || integrityResult.integrity_check === 'ok' || JSON.stringify(integrityResult).includes('"ok"');
                }
                
                if (!isOk) {
                    throw new Error(`Backup integrity check failed: ${JSON.stringify(integrityResult)}`);
                }
            } catch (integrityError) {
                if (testDb && testDb.open) {
                    testDb.close();
                }
                // Try to delete invalid backup file
                try {
                    await this.safeDeleteFile(backupPath);
                } catch (deleteError) {
                    console.warn(`[Database] Could not delete invalid backup file: ${deleteError.message}`);
                }
                throw new Error(`Backup integrity verification failed: ${integrityError.message}`);
            }

            // Calculate checksum for backup file (re-read file size in case it changed)
            fileSize = fs.statSync(backupPath).size;
            const fileBuffer = fs.readFileSync(backupPath);
            const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

            // Save backup history with auto type, checksum (not encrypted)
            this.insert('backup_history', {
                id: `backup_${Date.now()}`,
                backupPath: backupPath,
                backupType: 'auto',
                fileSize: fileSize,
                checksum: checksum,
                encrypted: 0,
                createdAt: new Date().toISOString()
            });

            // Clean up old renamed files in the backup directory (non-blocking)
            this.cleanupOldRenamedFiles(backupDir, 7).catch(err => {
                console.warn(`[Database] Error cleaning up old renamed files: ${err.message}`);
            });

            return { success: true, fileSize: fileSize, checksum, encrypted: false };
        } catch (error) {
            console.error('Error creating auto backup:', error);
            // Fallback: try using copyFileSync
            try {
                if (fs.existsSync(this.dbPath)) {
                    // Checkpoint again
                    this.db.pragma('wal_checkpoint(FULL)');
                    // Copy the database file
                    fs.copyFileSync(this.dbPath, backupPath);
                    const fileSize = fs.statSync(backupPath).size;
                    if (fileSize > 0) {
                        // Integrity Check for fallback backup
                        let testDb = null;
                        try {
                            testDb = new Database(backupPath, { readonly: true });
                            const integrityResult = testDb.pragma('integrity_check');
                            testDb.close();
                            
                            if (integrityResult !== 'ok' && typeof integrityResult === 'string' && integrityResult.trim() !== 'ok') {
                                throw new Error(`Backup integrity check failed: ${integrityResult}`);
                            }
                        } catch (integrityError) {
                            if (testDb && testDb.open) {
                                testDb.close();
                            }
                            // Try to delete invalid backup file
                            try {
                                await this.safeDeleteFile(backupPath);
                            } catch (deleteError) {
                                console.warn(`[Database] Could not delete invalid fallback backup file: ${deleteError.message}`);
                            }
                            throw integrityError;
                        }

                        // Calculate checksum for backup file
                        const autoBackupFileSize = fs.statSync(backupPath).size;
                        const fileBuffer = fs.readFileSync(backupPath);
                        const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

                        // Save backup history with auto type, checksum (not encrypted)
                        this.insert('backup_history', {
                            id: `backup_${Date.now()}`,
                            backupPath: backupPath,
                            backupType: 'auto',
                            fileSize: autoBackupFileSize,
                            checksum: checksum,
                            encrypted: 0,
                            createdAt: new Date().toISOString()
                        });
                        return { success: true, fileSize: autoBackupFileSize, checksum, encrypted: false };
                    }
                }
            } catch (fallbackError) {
                console.error('Fallback auto backup also failed:', fallbackError);
            }
            return { success: false, error: error.message };
        }
    }

    deleteOldBackups(daysToKeep) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            const cutoffDateStr = cutoffDate.toISOString();

            // Get old backups
            const sql = `SELECT * FROM backup_history WHERE createdAt < ?`;
            const stmt = this.db.prepare(sql);
            const oldBackups = stmt.all(cutoffDateStr);

            // Delete old backup files and records
            let deletedCount = 0;
            oldBackups.forEach(backup => {
                try {
                    // Delete file if exists
                    if (backup.backupPath && fs.existsSync(backup.backupPath)) {
                        fs.unlinkSync(backup.backupPath);
                    }
                    // Delete record
                    this.delete('backup_history', backup.id);
                    deletedCount++;
                } catch (error) {
                    console.error(`Error deleting backup ${backup.id}:`, error);
                }
            });

            return { success: true, deletedCount };
        } catch (error) {
            console.error('Error deleting old backups:', error);
            return { success: false, error: error.message };
        }
    }

    deleteOldBackupsByCount(maxFiles, backupDir) {
        try {
            // Check if backup directory exists
            if (!fs.existsSync(backupDir)) {
                return { success: true, deletedCount: 0, message: 'Backup directory does not exist' };
            }

            // Read all backup files from backup directory
            const files = fs.readdirSync(backupDir)
                .filter(file => {
                    const filePath = path.join(backupDir, file);
                    const stat = fs.statSync(filePath);
                    return stat.isFile() && (
                        file.endsWith('.db') || 
                        file.endsWith('.sqlite') || 
                        file.endsWith('.sqlite3')
                    );
                })
                .map(file => {
                    const filePath = path.join(backupDir, file);
                    const stat = fs.statSync(filePath);
                    return {
                        name: file,
                        path: filePath,
                        mtime: stat.mtime, // Last modification time
                        size: stat.size
                    };
                })
                .sort((a, b) => a.mtime - b.mtime); // Sort by date (oldest first)

            // If number of files is within limit, no need to delete
            if (files.length <= maxFiles) {
                return { success: true, deletedCount: 0, message: `Total files: ${files.length}, within limit of ${maxFiles}` };
            }

            // Calculate how many files to delete
            const filesToDelete = files.length - maxFiles;
            const filesToRemove = files.slice(0, filesToDelete); // Get oldest files

            // Delete files and their records from backup_history
            let deletedCount = 0;
            filesToRemove.forEach(file => {
                try {
                    // Delete file
                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }

                    // Delete record from backup_history
                    // Find backup record by path
                    const backupRecords = this.db.prepare('SELECT * FROM backup_history WHERE backupPath = ?').all(file.path);
                    backupRecords.forEach(record => {
                        try {
                            this.delete('backup_history', record.id);
                        } catch (error) {
                            console.error(`Error deleting backup record ${record.id}:`, error);
                        }
                    });

                    deletedCount++;
                } catch (error) {
                    console.error(`Error deleting backup file ${file.path}:`, error);
                }
            });

            return { success: true, deletedCount, message: `Deleted ${deletedCount} old backup(s), kept ${maxFiles} most recent` };
        } catch (error) {
            console.error('Error deleting old backups by count:', error);
            return { success: false, error: error.message };
        }
    }

    deleteOldBackupsWhenExceeds(threshold, deleteCount, backupDir) {
        try {
            // Check if backup directory exists
            if (!fs.existsSync(backupDir)) {
                return { success: true, deletedCount: 0, message: 'Backup directory does not exist' };
            }

            // Read all backup files from backup directory
            const files = fs.readdirSync(backupDir)
                .filter(file => {
                    const filePath = path.join(backupDir, file);
                    const stat = fs.statSync(filePath);
                    return stat.isFile() && (
                        file.endsWith('.db') || 
                        file.endsWith('.sqlite') || 
                        file.endsWith('.sqlite3')
                    );
                })
                .map(file => {
                    const filePath = path.join(backupDir, file);
                    const stat = fs.statSync(filePath);
                    return {
                        name: file,
                        path: filePath,
                        mtime: stat.mtime, // Last modification time
                        size: stat.size
                    };
                })
                .sort((a, b) => a.mtime - b.mtime); // Sort by date (oldest first)

            // If number of files doesn't exceed threshold, no need to delete
            if (files.length <= threshold) {
                return { success: true, deletedCount: 0, message: `Total files: ${files.length}, below threshold of ${threshold}` };
            }

            // Delete oldest files (up to deleteCount files)
            const filesToRemove = files.slice(0, Math.min(deleteCount, files.length)); // Get oldest files

            // Delete files and their records from backup_history
            let deletedCount = 0;
            filesToRemove.forEach(file => {
                try {
                    // Delete file
                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }

                    // Delete record from backup_history
                    // Find backup record by path
                    const backupRecords = this.db.prepare('SELECT * FROM backup_history WHERE backupPath = ?').all(file.path);
                    backupRecords.forEach(record => {
                        try {
                            this.delete('backup_history', record.id);
                        } catch (error) {
                            console.error(`Error deleting backup record ${record.id}:`, error);
                        }
                    });

                    deletedCount++;
                } catch (error) {
                    console.error(`Error deleting backup file ${file.path}:`, error);
                }
            });

            const remainingFiles = files.length - deletedCount;
            return { success: true, deletedCount, message: `Deleted ${deletedCount} oldest backup(s), ${remainingFiles} files remaining` };
        } catch (error) {
            console.error('Error deleting old backups when exceeds threshold:', error);
            return { success: false, error: error.message };
        }
    }

    // Perform WAL checkpoint to merge WAL file into main database
    checkpoint() {
        try {
            if (this.db) {
                // First, ensure all pending writes are flushed
                this.db.pragma('synchronous = FULL');
                
                // FULL checkpoint: merges all WAL data into main database and truncates WAL
                // This ensures data is persisted and reduces corruption risk
                this.db.pragma('wal_checkpoint(FULL)');
                
                // Verify checkpoint was successful by checking WAL file size
                const walPath = this.dbPath + '-wal';
                if (fs.existsSync(walPath)) {
                    const walStats = fs.statSync(walPath);
                    // If WAL file is still large after checkpoint, there might be an issue
                    if (walStats.size > 5 * 1024 * 1024) { // More than 5MB
                        console.warn(`[Database] ⚠️ WAL file is still large after checkpoint: ${(walStats.size / 1024 / 1024).toFixed(2)} MB`);
                    }
                }
            }
        } catch (error) {
            console.error('Error performing WAL checkpoint:', error);
            // Don't throw - checkpoint failure shouldn't crash the app
        }
    }

    // Perform periodic health check on database
    performHealthCheck() {
        try {
            if (!this.db) {
                return;
            }
            
            // Quick integrity check (fast check)
            try {
                const quickCheck = this.db.pragma('quick_check');
                if (quickCheck !== 'ok' && (Array.isArray(quickCheck) && quickCheck[0] !== 'ok')) {
                    console.warn(`[Database] ⚠️ Quick health check detected potential issues: ${quickCheck}`);
                    // Schedule full integrity check
                    setTimeout(() => {
                        this.performFullHealthCheck();
                    }, 1000);
                }
            } catch (checkError) {
                console.warn(`[Database] ⚠️ Health check error: ${checkError.message}`);
            }
            
            // Check disk space
            try {
                const stats = fs.statSync(this.dbPath);
                const dbSize = stats.size;
                const dbDir = path.dirname(this.dbPath);
                const freeSpace = this.getFreeDiskSpace(dbDir);
                
                // Warn if less than 100MB free space
                if (freeSpace < 100 * 1024 * 1024) {
                    console.warn(`[Database] ⚠️ Low disk space: ${(freeSpace / 1024 / 1024).toFixed(2)} MB remaining`);
                }
            } catch (spaceError) {
                // Ignore - can't check disk space on all systems
            }
        } catch (error) {
            console.error('Error in health check:', error);
        }
    }
    
    // Perform full integrity check
    performFullHealthCheck() {
        try {
            if (!this.db) {
                return;
            }
            
            // Hide integrity check message - only show if failed
            const integrityResult = this.db.pragma('integrity_check');
            
            // Use improved logic to detect actual corruption
            let isCorrupted = false;
            if (typeof integrityResult === 'string') {
                const trimmed = integrityResult.trim();
                isCorrupted = trimmed !== 'ok' && (
                    trimmed.toLowerCase().includes('error') ||
                    trimmed.toLowerCase().includes('corrupt') ||
                    trimmed.toLowerCase().includes('malformed') ||
                    (trimmed.length > 10 && trimmed.length < 200)
                );
            } else if (Array.isArray(integrityResult)) {
                const firstResult = Array.isArray(integrityResult[0]) ? integrityResult[0][0] : integrityResult[0];
                if (typeof firstResult === 'string') {
                    const trimmed = firstResult.trim();
                    isCorrupted = trimmed !== 'ok' && (
                        trimmed.toLowerCase().includes('error') ||
                        trimmed.toLowerCase().includes('corrupt') ||
                        trimmed.toLowerCase().includes('malformed')
                    );
                } else {
                    isCorrupted = firstResult !== 'ok';
                }
            } else if (integrityResult && typeof integrityResult === 'object') {
                const resultStr = JSON.stringify(integrityResult);
                const hasOk = resultStr.includes('"ok"') || resultStr.includes('"ok":"ok"');
                const hasError = resultStr.toLowerCase().includes('error') || 
                               resultStr.toLowerCase().includes('corrupt') ||
                               resultStr.toLowerCase().includes('malformed');
                isCorrupted = !hasOk && hasError;
            }
            
            if (isCorrupted) {
                console.error(`[Database] ❌ Integrity check failed: ${JSON.stringify(integrityResult)}`);
                console.error(`[Database] ⚠️ Database corruption detected!`);
                // Note: Automatic repair is disabled - user will handle repairs manually or through the app
            }
            // Hide success message - only show errors
        } catch (error) {
            console.error('Error in full health check:', error);
        }
    }
    
    // Get free disk space (approximate)
    getFreeDiskSpace(dirPath) {
        try {
            const stats = fs.statSync(dirPath);
            // This is a simplified check - actual free space detection requires platform-specific code
            // For now, we'll just check if we can write to the directory
            return 1024 * 1024 * 1024; // Assume 1GB for now (conservative estimate)
        } catch (error) {
            return 0;
        }
    }
    
    // Safe close with multiple attempts
    close() {
        let attempts = 0;
        const maxAttempts = 3;
        
        const attemptClose = () => {
            try {
                // Note: Intervals were removed - no need to clear them
                
                if (this.db && this.db.open) {
                    // CRITICAL: Perform FULL checkpoint before closing to prevent corruption
                    // This ensures all WAL data is merged into main database
                    try {
                        // Set synchronous to FULL to ensure all writes are flushed
                        this.db.pragma('synchronous = FULL');
                        // Perform FULL checkpoint (truncates WAL and merges all data)
                        this.db.pragma('wal_checkpoint(FULL)');
                        // Wait a moment to ensure checkpoint completes
                        // This is critical to prevent corruption
                    } catch (checkpointError) {
                        console.error('[Database] ❌ CRITICAL: Checkpoint before close failed:', checkpointError.message);
                        // Try one more time with a simpler checkpoint
                        try {
                            this.db.pragma('wal_checkpoint(TRUNCATE)');
                        } catch (retryError) {
                            console.error('[Database] ❌ Retry checkpoint also failed:', retryError.message);
                        }
                    }
                    
                    // Close database connection
                    try {
                        this.db.close();
                    } catch (closeError) {
                        console.error('[Database] ❌ Error closing database:', closeError.message);
                    }
                    this.db = null;
                }
            } catch (error) {
                attempts++;
                if (attempts < maxAttempts) {
                    console.warn(`[Database] ⚠️ Close attempt ${attempts} failed, retrying...`);
                    // Wait a bit before retry
                    setTimeout(attemptClose, 500);
                } else {
                    console.error('[Database] ❌ Failed to close database after multiple attempts:', error);
                    // Force close as last resort
                    try {
                        if (this.db) {
                            this.db.close();
                            this.db = null;
                        }
                    } catch (forceCloseError) {
                        console.error('[Database] ❌ Force close also failed:', forceCloseError);
                    }
                }
            }
        };
        
        attemptClose();
    }

    // ============================================================
    // Migration: REAL to INTEGER for Financial Amounts
    // ============================================================
    
    /**
     * Run migration from REAL to INTEGER for financial amounts
     * @returns {Promise<{success: boolean, message: string, backupPath?: string}>}
     */
    async runRealToIntegerMigration() {
        try {
            const migrationModule = require('./migrations/run-migration-in-app');
            const result = await migrationModule.runMigration(this.dbPath);
            
            if (result.success) {
                return {
                    success: true,
                    message: `Migration completed successfully! Executed ${result.executed} statements. Backup saved to: ${result.backupPath}`,
                    backupPath: result.backupPath,
                    foreignKeyViolations: result.foreignKeyViolations
                };
            } else {
                return {
                    success: false,
                    message: `Migration failed: ${result.error || 'Unknown error'}`
                };
            }
        } catch (error) {
            return {
                success: false,
                message: `Migration error: ${error.message}`
            };
        }
    }

    /**
     * Rollback migration (restore REAL)
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async rollbackRealToIntegerMigration() {
        try {
            const migrationModule = require('./migrations/run-migration-in-app');
            const result = await migrationModule.runRollback(this.dbPath);
            
            if (result.success) {
                return {
                    success: true,
                    message: `Rollback completed successfully! Executed ${result.executed} statements.`
                };
            } else {
                return {
                    success: false,
                    message: `Rollback failed: ${result.error || 'Unknown error'}`
                };
            }
        } catch (error) {
            return {
                success: false,
                message: `Rollback error: ${error.message}`
            };
        }
    }

    /**
     * Test migration (verify data integrity)
     * @returns {Promise<{success: boolean, message: string, results?: object}>}
     */
    async testRealToIntegerMigration() {
        try {
            const migrationModule = require('./migrations/run-migration-in-app');
            const result = await migrationModule.runTests(this.dbPath);
            
            if (result.success) {
                return {
                    success: true,
                    message: 'Tests completed successfully!',
                    results: result
                };
            } else {
                return {
                    success: false,
                    message: `Tests failed: ${result.error || 'Unknown error'}`
                };
            }
        } catch (error) {
            return {
                success: false,
                message: `Test error: ${error.message}`
            };
        }
    }
}

module.exports = DatabaseManager;

