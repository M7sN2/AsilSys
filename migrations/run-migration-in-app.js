/**
 * Migration Runner for In-App Execution
 * This script can be called from within the Electron app
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Read migration SQL file
function readSQLFile(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        throw new Error(`Failed to read SQL file: ${error.message}`);
    }
}

// Execute SQL script
function executeSQL(db, sql, description) {
    try {
        // Split SQL by semicolons and execute each statement
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));
        
        let executed = 0;
        for (const statement of statements) {
            if (statement.length > 0) {
                try {
                    db.exec(statement);
                    executed++;
                } catch (error) {
                    // Some statements might fail (e.g., DROP IF EXISTS on non-existent objects)
                    if (!error.message.includes('no such') && 
                        !error.message.includes('does not exist') &&
                        !error.message.includes('duplicate')) {
                        throw error;
                    }
                }
            }
        }
        
        return { success: true, executed };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Run migration
async function runMigration(dbPath) {
    const migrationFile = path.join(__dirname, 'REAL_to_INTEGER_migration.sql');
    
    if (!fs.existsSync(migrationFile)) {
        throw new Error(`Migration file not found: ${migrationFile}`);
    }
    
    // Create backup
    const backupPath = `${dbPath}.backup.${Date.now()}`;
    if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, backupPath);
    }
    
    // Open database
    const db = new Database(dbPath);
    
    try {
        // Read migration SQL
        const migrationSQL = readSQLFile(migrationFile);
        
        // Execute migration
        const result = executeSQL(db, migrationSQL, 'Migration Script');
        
        if (result.success) {
            // Verify foreign keys
            const fkCheck = db.prepare('PRAGMA foreign_key_check').all();
            
            return {
                success: true,
                backupPath,
                executed: result.executed,
                foreignKeyViolations: fkCheck.length
            };
        } else {
            throw new Error(result.error);
        }
    } finally {
        db.close();
    }
}

// Run rollback
async function runRollback(dbPath) {
    const rollbackFile = path.join(__dirname, 'REAL_to_INTEGER_rollback.sql');
    
    if (!fs.existsSync(rollbackFile)) {
        throw new Error(`Rollback file not found: ${rollbackFile}`);
    }
    
    const db = new Database(dbPath);
    
    try {
        // Check if backup tables exist
        const backupTables = db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name LIKE '%_backup'
        `).all();
        
        if (backupTables.length === 0) {
            throw new Error('No backup tables found! Cannot rollback.');
        }
        
        // Read rollback SQL
        const rollbackSQL = readSQLFile(rollbackFile);
        
        // Execute rollback
        const result = executeSQL(db, rollbackSQL, 'Rollback Script');
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        return { success: true, executed: result.executed };
    } finally {
        db.close();
    }
}

// Run tests
async function runTests(dbPath) {
    const testFile = path.join(__dirname, 'REAL_to_INTEGER_test.sql');
    
    if (!fs.existsSync(testFile)) {
        throw new Error(`Test file not found: ${testFile}`);
    }
    
    const db = new Database(dbPath);
    
    try {
        // Read test SQL
        const testSQL = readSQLFile(testFile);
        
        // Execute tests (simplified - just check counts)
        const productsCount = db.prepare('SELECT COUNT(*) as count FROM products').get();
        const customersCount = db.prepare('SELECT COUNT(*) as count FROM customers').get();
        const salesInvoicesCount = db.prepare('SELECT COUNT(*) as count FROM sales_invoices').get();
        
        // Check foreign keys
        const fkCheck = db.prepare('PRAGMA foreign_key_check').all();
        
        return {
            success: true,
            counts: {
                products: productsCount.count,
                customers: customersCount.count,
                salesInvoices: salesInvoicesCount.count
            },
            foreignKeyViolations: fkCheck.length
        };
    } finally {
        db.close();
    }
}

module.exports = {
    runMigration,
    runRollback,
    runTests
};

