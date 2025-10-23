const { contextBridge, ipcRenderer } = require('electron');

// Helper function to safely invoke IPC methods
function safeInvoke(method, ...args) {
  try {
    // Check if ipcRenderer is available
    if (!ipcRenderer || typeof ipcRenderer.invoke !== 'function') {
      console.error(`IPC renderer not available for method: ${method}`);
      return Promise.resolve({ success: false, error: 'IPC renderer not available' });
    }
    
    return ipcRenderer.invoke(method, ...args).catch(error => {
      console.error(`Error in IPC invoke ${method}:`, error);
      // Return error in consistent format
      return { success: false, error: error.message || String(error) };
    });
  } catch (error) {
    console.error(`Error calling IPC invoke ${method}:`, error);
    return Promise.resolve({ success: false, error: error.message || String(error) });
  }
}

// Helper function to safely send IPC messages
function safeSend(method, ...args) {
  try {
    ipcRenderer.send(method, ...args);
  } catch (error) {
    console.error(`Error in IPC send ${method}:`, error);
  }
}

try {
  contextBridge.exposeInMainWorld('electronAPI', {
    login: (username, password) => safeInvoke('login', username, password),
    onLoginSuccess: (callback) => {
      try {
        ipcRenderer.on('login-success', callback);
      } catch (error) {
        console.error('Error setting up login-success listener:', error);
      }
    },
    closeLogin: () => safeSend('close-login'),
    minimizeWindow: () => safeSend('minimize-window'),
    maximizeWindow: () => safeSend('maximize-window'),
    closeWindow: () => safeSend('close-window'),
    sendLoginSuccess: (userData) => safeSend('login-success', userData),
    
    // Database API
    dbInsert: (table, data) => safeInvoke('db-insert', table, data),
    dbUpdate: (table, id, data) => safeInvoke('db-update', table, id, data),
    dbDelete: (table, id) => safeInvoke('db-delete', table, id),
    dbGet: (table, id) => safeInvoke('db-get', table, id),
    dbGetAll: (table, where = '', params = []) => safeInvoke('db-get-all', table, where, params),
    dbQuery: (sql, params = []) => safeInvoke('db-query', sql, params),
    
    // Database Path API
    dbGetPath: () => safeInvoke('db-get-path'),
    dbOpenFolder: () => safeInvoke('db-open-folder'),
    
    // Backup API
    backupCreate: (backupType = 'manual') => safeInvoke('backup-create', backupType),
    backupRestore: (backupPath = null) => safeInvoke('backup-restore', backupPath),
    backupGetHistory: (limit = 10) => safeInvoke('backup-get-history', limit),
    backupGetPath: () => safeInvoke('backup-get-path'),
    backupSetAutoSettings: (settings) => safeInvoke('backup-set-auto-settings', settings),
    backupGetAutoSettings: () => safeInvoke('backup-get-auto-settings'),
    backupSelectPath: () => safeInvoke('backup-select-path'),
    backupDisableAuto: () => safeInvoke('backup-disable-auto'),
    
    // Migration API
    runMigration: () => safeInvoke('run-migration'),
    rollbackMigration: () => safeInvoke('rollback-migration'),
    testMigration: () => safeInvoke('test-migration'),
    
    // Save Invoice API
    saveInvoiceToFile: (invoiceContent, defaultFileName) => safeInvoke('save-invoice-to-file', invoiceContent, defaultFileName),
    
    // Print Invoice API
    openPrintWindow: (htmlContent, windowTitle) => safeInvoke('open-print-window', htmlContent, windowTitle),
    
    // Get Asset Path API
    getAssetPath: (assetName) => safeInvoke('get-asset-path', assetName),
    
    // Password Hashing API
    hashPassword: (password) => safeInvoke('hash-password', password),
    comparePassword: (password, hashedPassword) => safeInvoke('compare-password', password, hashedPassword)
  });
} catch (error) {
  console.error('Error exposing electronAPI:', error);
}

