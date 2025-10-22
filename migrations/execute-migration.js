/**
 * Execute Migration from Main Process
 * This script can be called from Electron main process
 */

const { app } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

async function executeMigration() {
    try {
        // Get database path
        const userDataPath = app.getPath('userData');
        const dbPath = path.join(userDataPath, 'asel-database.db');
        
        if (!fs.existsSync(dbPath)) {
            return {
                success: false,
                message: 'Database file not found. Please start the application first to create the database.'
            };
        }
        
        // Create backup
        const backupPath = `${dbPath}.backup.${Date.now()}`;
        fs.copyFileSync(dbPath, backupPath);
        
        // Read migration SQL
        const migrationFile = path.join(__dirname, 'REAL_to_INTEGER_migration.sql');
        const migrationSQL = fs.readFileSync(migrationFile, 'utf8');
        
        // Open database
        const db = new Database(dbPath);
        
        try {
            // Execute migration
            const statements = migrationSQL
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
                        if (!error.message.includes('no such') && 
                            !error.message.includes('does not exist') &&
                            !error.message.includes('duplicate')) {
                            throw error;
                        }
                    }
                }
            }
            
            // Verify foreign keys
            const fkCheck = db.prepare('PRAGMA foreign_key_check').all();
            
            return {
                success: true,
                message: `Migration completed successfully! Executed ${executed} statements.`,
                backupPath,
                foreignKeyViolations: fkCheck.length
            };
        } finally {
            db.close();
        }
    } catch (error) {
        return {
            success: false,
            message: `Migration failed: ${error.message}`
        };
    }
}

// If called directly (for testing)
if (require.main === module) {
    // Mock app for testing
    const mockApp = {
        getPath: (name) => {
            if (name === 'userData') {
                return path.join(__dirname, '..');
            }
            return '';
        }
    };
    
    // This won't work without Electron, but shows the structure
    console.log('This script should be called from Electron main process');
}

module.exports = { executeMigration };

