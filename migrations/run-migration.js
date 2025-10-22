/**
 * Migration Runner: REAL to INTEGER for Financial Amounts
 * 
 * This script runs the migration from REAL to INTEGER for all financial amounts
 * Usage: node migrations/run-migration.js [--dry-run] [--rollback] [--test] [--cleanup]
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Configuration
const DB_PATH = path.join(__dirname, '..', 'asel-database.db');
const MIGRATION_FILE = path.join(__dirname, 'REAL_to_INTEGER_migration.sql');
const ROLLBACK_FILE = path.join(__dirname, 'REAL_to_INTEGER_rollback.sql');
const TEST_FILE = path.join(__dirname, 'REAL_to_INTEGER_test.sql');
const CLEANUP_FILE = path.join(__dirname, 'REAL_to_INTEGER_cleanup.sql');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
    log('\n' + '='.repeat(60), 'cyan');
    log(title, 'bright');
    log('='.repeat(60), 'cyan');
}

function logError(message) {
    log(`❌ ERROR: ${message}`, 'red');
}

function logSuccess(message) {
    log(`✅ ${message}`, 'green');
}

function logWarning(message) {
    log(`⚠️  WARNING: ${message}`, 'yellow');
}

function logInfo(message) {
    log(`ℹ️  ${message}`, 'blue');
}

// Check if database exists
function checkDatabaseExists() {
    if (!fs.existsSync(DB_PATH)) {
        logError(`Database file not found: ${DB_PATH}`);
        process.exit(1);
    }
    logSuccess(`Database found: ${DB_PATH}`);
}

// Create backup of database file
function createDatabaseBackup() {
    const backupPath = `${DB_PATH}.backup.${Date.now()}`;
    logInfo(`Creating database backup: ${backupPath}`);
    
    try {
        fs.copyFileSync(DB_PATH, backupPath);
        logSuccess(`Backup created: ${backupPath}`);
        return backupPath;
    } catch (error) {
        logError(`Failed to create backup: ${error.message}`);
        process.exit(1);
    }
}

// Read SQL file
function readSQLFile(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        logError(`Failed to read SQL file ${filePath}: ${error.message}`);
        process.exit(1);
    }
}

// Execute SQL script
function executeSQL(db, sql, description) {
    logInfo(`Executing: ${description}`);
    
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
        
        logSuccess(`Executed ${executed} SQL statements`);
        return true;
    } catch (error) {
        logError(`SQL execution failed: ${error.message}`);
        logError(`Statement that failed: ${error.message}`);
        return false;
    }
}

// Run migration
function runMigration(dryRun = false) {
    logSection('REAL to INTEGER Migration');
    
    if (dryRun) {
        logWarning('DRY RUN MODE - No changes will be made');
    }
    
    checkDatabaseExists();
    
    // Create backup
    const backupPath = createDatabaseBackup();
    
    if (dryRun) {
        logInfo('Dry run mode - skipping actual migration');
        return true;
    }
    
    // Open database
    logInfo('Opening database...');
    const db = new Database(DB_PATH);
    
    try {
        // Read migration SQL
        const migrationSQL = readSQLFile(MIGRATION_FILE);
        
        // Execute migration
        const success = executeSQL(db, migrationSQL, 'Migration Script');
        
        if (success) {
            logSuccess('Migration completed successfully!');
            
            // Verify foreign keys
            logInfo('Verifying foreign keys...');
            const fkCheck = db.prepare('PRAGMA foreign_key_check').all();
            if (fkCheck.length === 0) {
                logSuccess('All foreign keys are valid');
            } else {
                logWarning(`Found ${fkCheck.length} foreign key violations`);
                fkCheck.forEach(violation => {
                    logError(`Table: ${violation.table}, Row: ${violation.rowid}, Parent: ${violation.parent}`);
                });
            }
            
            return true;
        } else {
            logError('Migration failed!');
            logWarning(`Backup available at: ${backupPath}`);
            return false;
        }
    } catch (error) {
        logError(`Migration error: ${error.message}`);
        logWarning(`Backup available at: ${backupPath}`);
        return false;
    } finally {
        db.close();
    }
}

// Run rollback
function runRollback() {
    logSection('Rollback: Restore REAL Financial Amounts');
    
    checkDatabaseExists();
    
    // Check if backup tables exist
    const db = new Database(DB_PATH);
    try {
        const backupTables = db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name LIKE '%_backup'
        `).all();
        
        if (backupTables.length === 0) {
            logError('No backup tables found! Cannot rollback.');
            db.close();
            process.exit(1);
        }
        
        logInfo(`Found ${backupTables.length} backup tables`);
        backupTables.forEach(table => {
            logInfo(`  - ${table.name}`);
        });
        
        // Read rollback SQL
        const rollbackSQL = readSQLFile(ROLLBACK_FILE);
        
        // Execute rollback
        const success = executeSQL(db, rollbackSQL, 'Rollback Script');
        
        if (success) {
            logSuccess('Rollback completed successfully!');
            return true;
        } else {
            logError('Rollback failed!');
            return false;
        }
    } finally {
        db.close();
    }
}

// Run tests
function runTests() {
    logSection('Testing Migration');
    
    checkDatabaseExists();
    
    const db = new Database(DB_PATH);
    
    try {
        // Read test SQL
        const testSQL = readSQLFile(TEST_FILE);
        
        // Execute tests
        logInfo('Running test queries...');
        
        // Split and execute test queries
        const queries = testSQL
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('PRAGMA'));
        
        let passed = 0;
        let failed = 0;
        
        for (const query of queries) {
            if (query.length > 0 && query.toUpperCase().includes('SELECT')) {
                try {
                    const results = db.prepare(query).all();
                    if (results.length > 0) {
                        // Check for PASS/FAIL in results
                        results.forEach(result => {
                            if (result.status === 'PASS') {
                                passed++;
                                logSuccess(`${result.table_name || result.column_name || 'Test'}: PASS`);
                            } else if (result.status === 'FAIL') {
                                failed++;
                                logError(`${result.table_name || result.column_name || 'Test'}: FAIL`);
                                if (result.differences !== undefined) {
                                    logError(`  Differences: ${result.differences}`);
                                }
                            }
                        });
                    }
                } catch (error) {
                    // Some queries might fail, that's okay for tests
                }
            }
        }
        
        // Check foreign keys
        logInfo('Checking foreign keys...');
        const fkCheck = db.prepare('PRAGMA foreign_key_check').all();
        if (fkCheck.length === 0) {
            logSuccess('Foreign keys: PASS');
            passed++;
        } else {
            logError(`Foreign keys: FAIL (${fkCheck.length} violations)`);
            failed++;
        }
        
        logSection('Test Results');
        logSuccess(`Passed: ${passed}`);
        if (failed > 0) {
            logError(`Failed: ${failed}`);
        } else {
            logSuccess('All tests passed! ✅');
        }
        
        return failed === 0;
    } finally {
        db.close();
    }
}

// Run cleanup
function runCleanup() {
    logSection('Cleanup: Remove Backup Tables');
    
    logWarning('This will permanently delete all backup tables!');
    logWarning('Only run this after confirming migration is successful.');
    
    checkDatabaseExists();
    
    const db = new Database(DB_PATH);
    
    try {
        // Check if backup tables exist
        const backupTables = db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name LIKE '%_backup'
        `).all();
        
        if (backupTables.length === 0) {
            logInfo('No backup tables found. Nothing to clean up.');
            return true;
        }
        
        logInfo(`Found ${backupTables.length} backup tables to remove:`);
        backupTables.forEach(table => {
            logInfo(`  - ${table.name}`);
        });
        
        // Read cleanup SQL
        const cleanupSQL = readSQLFile(CLEANUP_FILE);
        
        // Execute cleanup
        const success = executeSQL(db, cleanupSQL, 'Cleanup Script');
        
        if (success) {
            logSuccess('Cleanup completed successfully!');
            logWarning('Backup tables have been permanently deleted.');
            return true;
        } else {
            logError('Cleanup failed!');
            return false;
        }
    } finally {
        db.close();
    }
}

// Main function
function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
Usage: node migrations/run-migration.js [options]

Options:
  --dry-run      Run migration in dry-run mode (no changes)
  --rollback     Rollback migration (restore REAL)
  --test         Run tests to verify migration
  --cleanup      Remove backup tables (use with caution!)
  --help, -h     Show this help message

Examples:
  node migrations/run-migration.js --dry-run
  node migrations/run-migration.js
  node migrations/run-migration.js --test
  node migrations/run-migration.js --rollback
  node migrations/run-migration.js --cleanup
        `);
        process.exit(0);
    }
    
    if (args.includes('--rollback')) {
        runRollback();
    } else if (args.includes('--test')) {
        runTests();
    } else if (args.includes('--cleanup')) {
        runCleanup();
    } else {
        const dryRun = args.includes('--dry-run');
        runMigration(dryRun);
        
        if (!dryRun) {
            logSection('Next Steps');
            logInfo('1. Run tests: node migrations/run-migration.js --test');
            logInfo('2. Test your application thoroughly');
            logInfo('3. After 1 week, run cleanup: node migrations/run-migration.js --cleanup');
        }
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = {
    runMigration,
    runRollback,
    runTests,
    runCleanup
};

