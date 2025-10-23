/*
 * © 2025 All Rights Reserved.
 * Developed by Eng. Mohamed Mohsen
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 */
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const DatabaseManager = require('./database');
const passwordUtils = require('./password-utils');

// Suppress cache-related errors and DevTools errors (these are harmless and don't affect functionality)
if (process.platform === 'win32') {
  const originalConsoleError = console.error;
  console.error = function(...args) {
    const message = args.join(' ');
    // Filter out cache-related errors that are common on Windows
    // These errors occur due to permission issues with cache directories
    // Match patterns like: [PID:THREAD/TIMESTAMP:ERROR:cache_util_win.cc(20)] Unable to move the cache: Access is denied. (0x5)
    if (message.includes('cache_util_win.cc') || 
        message.includes('Unable to move the cache') ||
        message.includes('Unable to create cache') ||
        message.includes('Gpu Cache Creation failed') ||
        message.includes('disk_cache.cc') ||
        message.includes('gpu_disk_cache.cc') ||
        (message.includes('Access is denied') && (message.includes('cache') || message.includes('(0x5)'))) ||
        // Match ERROR: prefix with cache/gpu/disk_cache errors
        (message.match(/ERROR:.*cache/i) || 
         message.match(/ERROR:.*gpu.*cache/i) ||
         message.match(/ERROR:.*disk_cache/i) ||
         (message.includes('ERROR:') && (message.includes('cache') || message.includes('gpu') || message.includes('disk_cache'))))) {
      return; // Don't log these harmless cache errors
    }
    
    // Filter out GPU-related errors (harmless GPU process errors)
    if (message.includes('GPU process exited unexpectedly') ||
        message.includes('gpu_process_host.cc') ||
        message.includes('gpu_service_impl.cc') ||
        message.includes('gpu_channel_manager.cc') ||
        message.includes('Failed to create GLES3 context') ||
        message.includes('fallback to GLES2') ||
        message.includes('ContextResult::kFatalFailure') ||
        message.includes('Failed to create shared context') ||
        message.includes('for virtualization') ||
        message.includes('Exiting GPU process because some drivers') ||
        message.includes('GPU process will restart shortly') ||
        message.includes('exit_code=34') ||
        // Filter SharedImageManager/Skia errors (harmless graphics rendering errors)
        message.includes('SharedImageManager') ||
        message.includes('shared_image_manager.cc') ||
        message.includes('shared_image_manager') ||
        message.includes('ProduceSkia') ||
        message.includes('non-existent mailbox') ||
        message.includes('Trying to Produce') ||
        // Match the exact error format: [PID:THREAD/TIMESTAMP:ERROR:shared_image_manager.cc(220)]
        message.match(/\[\d+:\d+\/\d+\.\d+:ERROR:shared_image_manager\.cc/) ||
        (message.includes('ERROR:') && message.includes('shared_image_manager'))) {
      return; // Don't log these harmless GPU/graphics errors
    }
    
    // Filter out DevTools fetch errors (harmless DevTools internal errors)
    if (message.includes('devtools://devtools') ||
        message.includes('devtools/bundled') ||
        (message.includes('Failed to fetch') && (message.includes('devtools') || message.includes('devtools://')))) {
      return; // Don't log these harmless DevTools errors
    }
    originalConsoleError.apply(console, args);
  };
  
  // Also filter stderr output (Electron logs cache errors directly to stderr)
  // This is where the cache_util_win.cc errors are printed
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = function(chunk, encoding, fd) {
    if (chunk) {
      const message = chunk.toString();
      
      // Filter cache-related errors (the main issue)
      // Match patterns like: [PID:THREAD/TIMESTAMP:ERROR:cache_util_win.cc(20)] Unable to move the cache: Access is denied. (0x5)
      if (message.includes('cache_util_win.cc') || 
          message.includes('Unable to move the cache') ||
          message.includes('Unable to create cache') ||
          message.includes('Gpu Cache Creation failed') ||
          message.includes('disk_cache.cc') ||
          message.includes('gpu_disk_cache.cc') ||
          (message.includes('Access is denied') && (message.includes('cache') || message.includes('(0x5)'))) ||
          // Match ERROR: prefix with cache/gpu/disk_cache errors
          (message.match(/ERROR:.*cache/i) || 
           message.match(/ERROR:.*gpu.*cache/i) ||
           message.match(/ERROR:.*disk_cache/i) ||
           (message.includes('ERROR:') && (message.includes('cache') || message.includes('gpu') || message.includes('disk_cache'))))) {
        return true; // Suppress these errors (return true indicates the write was handled)
      }
      
      // Filter GPU-related errors (including GLES3/GLES2 context errors)
      // Match the exact format: [PID:THREAD/TIMESTAMP:ERROR:gpu_channel_manager.cc...]
      if (message.includes('GPU process exited unexpectedly') ||
          message.includes('gpu_process_host.cc') ||
          message.includes('gpu_service_impl.cc') ||
          message.includes('gpu_channel_manager.cc') ||
          message.includes('Failed to create GLES3 context') ||
          message.includes('fallback to GLES2') ||
          message.includes('ContextResult::kFatalFailure') ||
          message.includes('Failed to create shared context') ||
          message.includes('for virtualization') ||
          message.includes('Exiting GPU process because some drivers') ||
          message.includes('GPU process will restart shortly') ||
          message.includes('exit_code=34') ||
          // Match the exact error format with process ID pattern: [PID:THREAD/TIMESTAMP:ERROR:gpu_channel_manager.cc
          message.match(/\[\d+:\d+\/\d+\.\d+:ERROR:gpu_channel_manager\.cc/) ||
          (message.includes('ERROR:') && message.includes('gpu_channel_manager')) ||
          // Filter SharedImageManager/Skia errors (harmless graphics rendering errors)
          message.includes('SharedImageManager') ||
          message.includes('shared_image_manager.cc') ||
          message.includes('shared_image_manager') ||
          message.includes('ProduceSkia') ||
          message.includes('non-existent mailbox') ||
          message.includes('Trying to Produce') ||
          // Match the exact error format: [PID:THREAD/TIMESTAMP:ERROR:shared_image_manager.cc(220)]
          message.match(/\[\d+:\d+\/\d+\.\d+:ERROR:shared_image_manager\.cc/) ||
          (message.includes('ERROR:') && message.includes('shared_image_manager'))) {
        return true; // Suppress these harmless GPU/graphics errors
      }
      
      // Filter DevTools errors - check for various patterns
      if ((message.includes('ERROR:CONSOLE') || message.includes('ERROR')) && (
          message.includes('devtools://devtools') ||
          message.includes('devtools/bundled') ||
          message.includes('devtools/bundled/panels') ||
          (message.includes('Failed to fetch') && (message.includes('devtools') || message.includes('devtools://') || message.includes('bundled')))
      )) {
        return true; // Suppress these harmless errors
      }
      
      // Also check for direct devtools patterns
      if (message.includes('devtools://devtools') ||
          message.includes('devtools/bundled') ||
          message.includes('devtools/bundled/panels') ||
          (message.includes('Failed to fetch') && (message.includes('devtools') || message.includes('devtools://') || message.includes('bundled')))) {
        return true; // Suppress these harmless errors
      }
    }
    return originalStderrWrite.apply(process.stderr, arguments);
  };
  
  // Also filter stdout for cache errors (some versions log to stdout)
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = function(chunk, encoding, fd) {
    if (chunk) {
      const message = chunk.toString();
      
      // Filter cache-related errors from stdout as well
      // Match patterns like: [PID:THREAD/TIMESTAMP:ERROR:cache_util_win.cc(20)] Unable to move the cache: Access is denied. (0x5)
      if (message.includes('cache_util_win.cc') || 
          message.includes('Unable to move the cache') ||
          message.includes('Unable to create cache') ||
          message.includes('Gpu Cache Creation failed') ||
          message.includes('disk_cache.cc') ||
          message.includes('gpu_disk_cache.cc') ||
          (message.includes('Access is denied') && (message.includes('cache') || message.includes('(0x5)'))) ||
          // Match ERROR: prefix with cache/gpu/disk_cache errors
          (message.match(/ERROR:.*cache/i) || 
           message.match(/ERROR:.*gpu.*cache/i) ||
           message.match(/ERROR:.*disk_cache/i) ||
           (message.includes('ERROR:') && (message.includes('cache') || message.includes('gpu') || message.includes('disk_cache'))))) {
        return true; // Suppress these errors
      }
      
      // Filter GPU-related errors (including GLES3/GLES2 context errors)
      // Match the exact format: [PID:THREAD/TIMESTAMP:ERROR:gpu_channel_manager.cc...]
      if (message.includes('GPU process exited unexpectedly') ||
          message.includes('gpu_process_host.cc') ||
          message.includes('gpu_service_impl.cc') ||
          message.includes('gpu_channel_manager.cc') ||
          message.includes('Failed to create GLES3 context') ||
          message.includes('fallback to GLES2') ||
          message.includes('ContextResult::kFatalFailure') ||
          message.includes('Failed to create shared context') ||
          message.includes('for virtualization') ||
          message.includes('Exiting GPU process because some drivers') ||
          message.includes('GPU process will restart shortly') ||
          message.includes('exit_code=34') ||
          // Match the exact error format with process ID pattern: [PID:THREAD/TIMESTAMP:ERROR:gpu_channel_manager.cc
          message.match(/\[\d+:\d+\/\d+\.\d+:ERROR:gpu_channel_manager\.cc/) ||
          (message.includes('ERROR:') && message.includes('gpu_channel_manager'))) {
        return true; // Suppress these harmless GPU errors
      }
      
      // Filter DevTools errors
      if ((message.includes('ERROR:CONSOLE') || message.includes('ERROR')) && (
          message.includes('devtools://devtools') ||
          message.includes('devtools/bundled') ||
          message.includes('devtools/bundled/panels') ||
          (message.includes('Failed to fetch') && (message.includes('devtools') || message.includes('devtools://') || message.includes('bundled')))
      )) {
        return true; // Suppress these harmless errors
      }
      
      if (message.includes('devtools://devtools') ||
          message.includes('devtools/bundled') ||
          message.includes('devtools/bundled/panels') ||
          (message.includes('Failed to fetch') && (message.includes('devtools') || message.includes('devtools://') || message.includes('bundled')))) {
        return true; // Suppress these harmless errors
      }
    }
    return originalStdoutWrite.apply(process.stdout, arguments);
  };
}

let mainWindow;
let loginWindow;
let db;

// Log errors to file
function logErrorToFile(error, context = '') {
  try {
    const userDataPath = app.getPath('userData');
    // Ensure directory exists
    if (!fs.existsSync(userDataPath)) {
      try {
        fs.mkdirSync(userDataPath, { recursive: true });
      } catch (mkdirError) {
        console.error('Failed to create userData directory for logging:', mkdirError);
        return; // Can't log if we can't create directory
      }
    }
    
    const logPath = path.join(userDataPath, 'error.log');
    const timestamp = new Date().toISOString();
    const errorMessage = `[${timestamp}] ${context}\n${error.message}\n${error.stack}\n\n`;
    
    // Try to append to log file
    try {
      fs.appendFileSync(logPath, errorMessage, 'utf8');
      console.error(`Error logged to: ${logPath}`);
    } catch (writeError) {
      // If append fails, try to write (file might be locked)
      try {
        fs.writeFileSync(logPath, errorMessage, 'utf8');
      } catch (writeError2) {
        console.error('Failed to write error log:', writeError2);
      }
    }
  } catch (logError) {
    console.error('Failed to log error to file:', logError);
  }
}

function createLoginWindow() {
  // Don't create login window if it already exists
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.show();
    loginWindow.focus();
    return;
  }
  
  // Don't create login window if main window is visible (user is already logged in)
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
    return;
  }
  
  // Get correct paths for packaged and development modes
  const appPath = app.isPackaged ? app.getAppPath() : __dirname;
  const preloadPath = path.join(appPath, 'preload.js');
  const iconPath = path.join(appPath, 'assets', 'icon-asel.ico');
  
  loginWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: true,
    titleBarStyle: 'default',
    resizable: true,
    maximizable: true,
    minimizable: true,
    closable: true,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      focusable: true,
      partition: 'persist:main',
      devTools: true // Enable DevTools
    },
    icon: iconPath,
    show: false
  });
  
  loginWindow.maximize(); //maximize login screen

  // Filter out DevTools console errors and GPU errors (harmless internal errors)
  loginWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (message && (
      message.includes('devtools://devtools') ||
      message.includes('devtools/bundled') ||
      message.includes('devtools/bundled/panels') ||
      (message.includes('Failed to fetch') && (message.includes('devtools') || message.includes('devtools://') || message.includes('bundled'))) ||
      message.includes('gpu_channel_manager.cc') ||
      message.includes('Failed to create GLES3 context') ||
      message.includes('fallback to GLES2') ||
      message.includes('ContextResult::kFatalFailure') ||
      message.includes('Failed to create shared context') ||
      message.includes('for virtualization')
    )) {
      event.preventDefault(); // Prevent logging
      return; // Don't log these harmless errors
    }
  });
  
  // Filter out DevTools failed load errors
  loginWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (validatedURL && (
      validatedURL.includes('devtools://devtools') ||
      validatedURL.includes('devtools/bundled') ||
      validatedURL.includes('devtools/bundled/panels')
    )) {
      event.preventDefault(); // Prevent error from being logged
      return;
    }
  });

  // Get the correct path for HTML files
  // In packaged mode, app.getAppPath() returns the path to app.asar
  // We need to use path.join with app.getAppPath() to get the correct path
  const loginPath = path.join(appPath, 'login.html');
  
  // Try multiple path strategies to ensure file loads
  const tryLoadFile = async (filePath, fallbackPath) => {
    try {
      await loginWindow.loadFile(filePath);
      return true;
    } catch (error) {
      console.error(`Error loading ${filePath}:`, error.message);
      if (fallbackPath) {
        try {
          await loginWindow.loadFile(fallbackPath);
          return true;
        } catch (fallbackError) {
          console.error(`Fallback also failed for ${fallbackPath}:`, fallbackError.message);
          // Try with just filename
          try {
            await loginWindow.loadFile('login.html');
            return true;
          } catch (finalError) {
            console.error('All load attempts failed:', finalError.message);
            return false;
          }
        }
      }
      return false;
    }
  };
  
  tryLoadFile(loginPath, 'login.html').catch((error) => {
    console.error('Failed to load login page after all attempts:', error);
  });
  
  loginWindow.once('ready-to-show', () => {
    loginWindow.show();
  });

  loginWindow.on('closed', () => {
    loginWindow = null;
  });

  // Handle window errors
  loginWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame && !validatedURL.includes('devtools')) {
      console.error('Failed to load login page:', errorCode, errorDescription, validatedURL);
      // Try to reload the page
      if (loginWindow && !loginWindow.isDestroyed()) {
        try {
          const appPath = app.isPackaged ? app.getAppPath() : __dirname;
          const loginPath = path.join(appPath, 'login.html');
          setTimeout(() => {
            loginWindow.loadFile(loginPath).catch(() => {
              loginWindow.loadFile('login.html').catch(() => {
                console.error('Failed to reload login after error');
              });
            });
          }, 1000);
        } catch (reloadError) {
          console.error('Error reloading login after failed load:', reloadError);
        }
      }
    }
  });
  
  // Handle console errors from renderer
  loginWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (level === 3) { // Error level
      console.error('Login renderer error:', message, 'at', sourceId, 'line', line);
    }
  });
}

function createMainWindow() {
  // Don't create main window if it already exists and is visible
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
    // Hide window focus messages - only show errors
    mainWindow.focus();
    return;
  }
  
  // If main window exists but is hidden, just show it
  if (mainWindow && !mainWindow.isDestroyed()) {
    // Hide window show messages - only show errors
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  
  // DON'T close login window here - it will be closed after main window is shown
  // Closing it here causes the app to quit if it's the only window
  
  // Get correct paths for packaged and development modes
  const appPath = app.isPackaged ? app.getAppPath() : __dirname;
  const preloadPath = path.join(appPath, 'preload.js');
  const iconPath = path.join(appPath, 'assets', 'icon-asel.ico');
  
  // Hide window creation messages - only show errors
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: true,
    title: 'نظام إدارة شركة أسيل',
    titleBarStyle: 'default',
    resizable: true,
    maximizable: true,
    minimizable: true,
    closable: true,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      focusable: true,
      partition: 'persist:main',
      devTools: true, // Enable DevTools
      // Offline mode settings - ensure no network access
      webSecurity: false, // Allow local file access only
      allowRunningInsecureContent: false,
      experimentalFeatures: false
    },
    icon: iconPath,
    show: false // Don't show until ready
  });
  mainWindow.maximize(); //added to maximize screens
  mainWindow.setTitle("نظام إدارة شركة أسيل");

  // Filter out DevTools console errors and GPU errors (harmless internal errors)
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (message && (
      message.includes('devtools://devtools') ||
      message.includes('devtools/bundled') ||
      message.includes('devtools/bundled/panels') ||
      (message.includes('Failed to fetch') && (message.includes('devtools') || message.includes('devtools://') || message.includes('bundled'))) ||
      message.includes('gpu_channel_manager.cc') ||
      message.includes('Failed to create GLES3 context') ||
      message.includes('fallback to GLES2') ||
      message.includes('ContextResult::kFatalFailure') ||
      message.includes('Failed to create shared context') ||
      message.includes('for virtualization')
    )) {
      event.preventDefault(); // Prevent logging
      return; // Don't log these harmless errors
    }
  });
  
  // Filter out DevTools failed load errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (validatedURL && (
      validatedURL.includes('devtools://devtools') ||
      validatedURL.includes('devtools/bundled') ||
      validatedURL.includes('devtools/bundled/panels')
    )) {
      event.preventDefault(); // Prevent error from being logged
      return;
    }
  });

  // Get the correct path for HTML files
  // In packaged mode, app.getAppPath() returns the path to app.asar
  // We need to use path.join with app.getAppPath() to get the correct path
  const indexPath = path.join(appPath, 'index.html');
  
  // Try multiple path strategies to ensure file loads
  const tryLoadFile = async (filePath, fallbackPath) => {
    try {
      await mainWindow.loadFile(filePath);
      return true;
    } catch (error) {
      console.error(`Error loading ${filePath}:`, error.message);
      if (fallbackPath) {
        try {
          await mainWindow.loadFile(fallbackPath);
          return true;
        } catch (fallbackError) {
          console.error(`Fallback also failed for ${fallbackPath}:`, fallbackError.message);
          // Try with just filename
          try {
            await mainWindow.loadFile('index.html');
            return true;
          } catch (finalError) {
            console.error('All load attempts failed:', finalError.message);
            return false;
          }
        }
      }
      return false;
    }
  };
  
  tryLoadFile(indexPath, 'index.html').catch((error) => {
    console.error('Failed to load index page after all attempts:', error);
  });
  
  // Block all external network requests - ensure offline mode
  mainWindow.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url;
    // Allow only local file:// URLs and app resources
    if (url.startsWith('file://') || 
        url.startsWith('http://localhost') || 
        url.startsWith('http://127.0.0.1') ||
        url.includes('asar') ||
        url.startsWith('chrome://') ||
        url.startsWith('devtools://')) {
      callback({});
    } else {
      // Block all external URLs
      console.warn('Blocked external network request:', url);
      callback({ cancel: true });
    }
  });
  
  mainWindow.once('ready-to-show', () => {
    // Hide window ready messages - only show errors
    
    // Show main window FIRST to prevent app from closing
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      // Hide window shown messages - only show errors
    }
    
    // Close login window AFTER main window is shown (with a small delay)
    // This ensures main window is visible before login window closes
    setTimeout(() => {
      if (loginWindow && !loginWindow.isDestroyed()) {
        // Hide window close messages - only show errors
        loginWindow.hide();
        loginWindow.close();
        loginWindow = null;
      }
    }, 200);
  });

  // Handle renderer process crashes - prevent app from closing
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('Renderer process crashed:', details);
    // Log to file
    try {
      const error = new Error(`Renderer process crashed: ${JSON.stringify(details)}`);
      logErrorToFile(error, 'Renderer Process Crash');
    } catch (logError) {
      console.error('Failed to log crash:', logError);
    }
    // Try to reload the window instead of closing
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        const appPath = app.isPackaged ? app.getAppPath() : __dirname;
        const indexPath = path.join(appPath, 'index.html');
        mainWindow.loadFile(indexPath).catch(() => {
          mainWindow.loadFile('index.html').catch(() => {
            console.error('Failed to reload after crash');
          });
        });
      } catch (reloadError) {
        console.error('Error reloading after crash:', reloadError);
      }
    }
  });

  // Handle unresponsive renderer
  mainWindow.webContents.on('unresponsive', () => {
    console.warn('Renderer process became unresponsive');
  });

  // Handle responsive renderer
  mainWindow.webContents.on('responsive', () => {
    // Renderer process became responsive again
  });

  // Handle window errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame && !validatedURL.includes('devtools')) {
      console.error('Failed to load main page:', errorCode, errorDescription, validatedURL);
      // Try to reload the page
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          const appPath = app.isPackaged ? app.getAppPath() : __dirname;
          const indexPath = path.join(appPath, 'index.html');
          setTimeout(() => {
            mainWindow.loadFile(indexPath).catch(() => {
              mainWindow.loadFile('index.html').catch(() => {
                console.error('Failed to reload after error');
              });
            });
          }, 1000);
        } catch (reloadError) {
          console.error('Error reloading after failed load:', reloadError);
        }
      }
    }
  });
  
  // Handle console errors from renderer
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (level === 3) { // Error level
      console.error('Renderer error:', message, 'at', sourceId, 'line', line);
      // Log to file
      try {
        const error = new Error(message);
        error.stack = `at ${sourceId}:${line}`;
        logErrorToFile(error, 'Renderer Console Error');
      } catch (logError) {
        console.error('Failed to log renderer error:', logError);
      }
    }
  });

  // Ensure focus is maintained after IPC operations
  mainWindow.webContents.on('did-finish-load', () => {
    // Add global error handler to prevent crashes
    mainWindow.webContents.executeJavaScript(`
      (function() {
        // Global error handler to prevent crashes
        window.addEventListener('error', function(event) {
          console.error('Global error:', event.error);
          event.preventDefault();
          return true;
        });
        
        window.addEventListener('unhandledrejection', function(event) {
          console.error('Unhandled promise rejection:', event.reason);
          event.preventDefault();
          return true;
        });
        
        // Fix focus issues after form submissions and modal operations
        document.addEventListener('click', function(e) {
          try {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
              setTimeout(() => {
                if (document.activeElement !== e.target) {
                  e.target.focus();
                }
              }, 10);
            }
          } catch (err) {
            console.error('Error in click handler:', err);
          }
        }, true);
        
        // Fix focus issues when clicking on input fields
        document.addEventListener('mousedown', function(e) {
          try {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
              setTimeout(() => {
                if (document.activeElement !== e.target && !e.target.disabled && !e.target.readOnly) {
                  e.target.focus();
                }
              }, 10);
            }
          } catch (err) {
            console.error('Error in mousedown handler:', err);
          }
        }, true);
        
        // Ensure window has focus after modal operations
        document.addEventListener('DOMContentLoaded', function() {
          try {
            window.focus();
          } catch (err) {
            console.error('Error focusing window:', err);
          }
        });
      })();
    `).catch(err => console.error('Error executing focus handlers:', err));
    
    // Override alert separately
    mainWindow.webContents.executeJavaScript(`
      (function() {
        try {
          const originalAlert = window.alert;
          window.alert = function(message) {
            try {
              const result = originalAlert.call(window, message);
              setTimeout(() => {
                try {
                  window.focus();
                  const modal = document.querySelector('.modal.active, [class*="modal"].active, #invoiceModal.active, #customerModal.active, #supplierModal.active, #productModal.active, #adjustmentModal.active, #returnModal.active');
                  if (modal) {
                    const firstInput = modal.querySelector('input:not([type="hidden"]):not([readonly]), select, textarea');
                    if (firstInput && !firstInput.disabled && !firstInput.readOnly) {
                      setTimeout(() => firstInput.focus(), 50);
                    }
                  }
                } catch (err) {
                  console.error('Error in alert focus handler:', err);
                }
              }, 100);
              return result;
            } catch (err) {
              console.error('Error in alert override:', err);
              return originalAlert.call(window, message);
            }
          };
        } catch (err) {
          console.error('Error setting up alert override:', err);
        }
      })();
    `).catch(err => console.error('Error overriding alert:', err));
    
    // Override confirm separately
    mainWindow.webContents.executeJavaScript(`
      (function() {
        try {
          const originalConfirm = window.confirm;
          window.confirm = function(message) {
            try {
              const result = originalConfirm.call(window, message);
              setTimeout(() => {
                try {
                  window.focus();
                  const modal = document.querySelector('.modal.active, [class*="modal"].active, #invoiceModal.active, #customerModal.active, #supplierModal.active, #productModal.active, #adjustmentModal.active, #returnModal.active');
                  if (modal) {
                    const firstInput = modal.querySelector('input:not([type="hidden"]):not([readonly]), select, textarea');
                    if (firstInput && !firstInput.disabled && !firstInput.readOnly) {
                      setTimeout(() => firstInput.focus(), 50);
                    }
                  }
                } catch (err) {
                  console.error('Error in confirm focus handler:', err);
                }
              }, 100);
              return result;
            } catch (err) {
              console.error('Error in confirm override:', err);
              return originalConfirm.call(window, message);
            }
          };
        } catch (err) {
          console.error('Error setting up confirm override:', err);
        }
      })();
    `).catch(err => console.error('Error overriding confirm:', err));
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.on('login-success', async (event, userData) => {
  try {
    // Hide login success message - only show errors
    
    // IMPORTANT: Create/show main window FIRST before closing login window
    // This prevents the app from closing when login window closes
    // Check if main window already exists and is not destroyed
    if (mainWindow && !mainWindow.isDestroyed()) {
      // If main window exists, just reload it to index.html and show it
      // Hide window reload messages - only show errors
      const appPath = app.isPackaged ? app.getAppPath() : __dirname;
      const indexPath = path.join(appPath, 'index.html');
      
      try {
        await mainWindow.loadFile(indexPath);
      } catch (error) {
        // Fallback to relative path
        try {
          await mainWindow.loadFile('index.html');
        } catch (fallbackError) {
          console.error('Both loadFile attempts failed:', error, fallbackError);
        }
      }
      
      // Show and focus main window FIRST
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
      }
      
      // NOW close login window after main window is shown
      // Small delay to ensure main window is visible first
      setTimeout(() => {
        if (loginWindow && !loginWindow.isDestroyed()) {
          // Hide window close messages - only show errors
          loginWindow.hide();
          loginWindow.close();
          loginWindow = null;
        }
      }, 100);
    } else {
      // If no main window exists, create a new one FIRST
      // Hide window creation messages - only show errors
      
      // Create main window first (this will prevent app from closing)
      createMainWindow();
      
      // Wait a bit for main window to be created
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // NOW close login window after main window is created
      setTimeout(() => {
        if (loginWindow && !loginWindow.isDestroyed()) {
          // Hide window close messages - only show errors
          loginWindow.hide();
          loginWindow.close();
          loginWindow = null;
        }
      }, 100);
    }
  } catch (error) {
    console.error('Error in login-success handler:', error);
    // Try to create main window as fallback
    try {
      // Create main window first (to prevent app from closing)
      if (!mainWindow || mainWindow.isDestroyed()) {
        createMainWindow();
      }
      
      // Wait a bit for main window to be created
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Now close login window
      if (loginWindow && !loginWindow.isDestroyed()) {
        loginWindow.hide();
        loginWindow.close();
        loginWindow = null;
      }
    } catch (createError) {
      console.error('Error creating main window:', createError);
      // Don't close login window if main window creation failed
    }
  }
});

ipcMain.on('close-login', () => {
  try {
    if (loginWindow && !loginWindow.isDestroyed()) {
      loginWindow.close();
    }
  } catch (error) {
    console.error('Error in close-login handler:', error);
  }
});

ipcMain.on('minimize-window', (event) => {
  try {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && !window.isDestroyed()) {
      window.minimize();
    }
  } catch (error) {
    console.error('Error in minimize-window handler:', error);
  }
});

ipcMain.on('maximize-window', (event) => {
  try {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && !window.isDestroyed()) {
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
    }
  } catch (error) {
    console.error('Error in maximize-window handler:', error);
  }
});

ipcMain.on('close-window', (event) => {
  try {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && !window.isDestroyed()) {
      window.close();
    }
  } catch (error) {
    console.error('Error in close-window handler:', error);
  }
});

// Helper function to get current user from renderer
function getCurrentUserFromRenderer(event) {
  try {
    // Try to get user info from the renderer process
    // We'll pass it from the renderer, but if not provided, try to get from session
    const webContents = event.sender;
    if (webContents && webContents.getURL) {
      // User info should be passed in data, but we can't access localStorage from main process
      // So we'll rely on the renderer to pass createdBy in the data
      return null; // Will be handled by renderer passing createdBy in data
    }
  } catch (error) {
    // Ignore
  }
  return null;
}

// Database IPC Handlers
ipcMain.handle('db-insert', async (event, table, data) => {
  try {
    if (!db) {
      // Try to initialize database if not initialized
      try {
        db = new DatabaseManager();
      } catch (initError) {
        console.error('Error initializing database in db-insert:', initError);
        return { success: false, error: `Database not initialized: ${initError.message}` };
      }
    }
    await db.ensureInitialized();
    
    // If createdBy is not provided in data, try to get it from the renderer
    // The renderer should pass createdBy in the data object
    // If not provided, we'll leave it null (for backward compatibility)
    const result = db.insert(table, data);
    // Check if result has success property (error case)
    if (result && result.success === false) {
      return result;
    }
    // Check if result has changes or lastInsertRowid (SQLite success indicators)
    // better-sqlite3 returns {changes: number, lastInsertRowid: number} on success
    if (result && (result.changes !== undefined || result.lastInsertRowid !== undefined)) {
      return { success: true, ...result };
    }
    // If no changes and no error, something went wrong
    if (result && result.changes === 0) {
      console.error(`[db-insert] WARNING: Insert returned 0 changes for table ${table}`);
      return { success: false, error: `Failed to insert into ${table}: No rows affected` };
    }
    // Unknown result format
    console.error(`[db-insert] Unknown result format for table ${table}:`, result);
    return { success: false, error: `Unknown result format from database insert` };
  } catch (error) {
    console.error('Error in db-insert:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-update', async (event, table, id, data) => {
  try {
    if (!db) {
      try {
        db = new DatabaseManager();
      } catch (initError) {
        console.error('Error initializing database in db-update:', initError);
        return { success: false, error: `Database not initialized: ${initError.message}` };
      }
    }
    await db.ensureInitialized();
    const result = db.update(table, id, data);
    // Check if result has success property (error case)
    if (result && result.success === false) {
      return result;
    }
    // Check if result has changes (SQLite success indicator)
    // better-sqlite3 returns {changes: number} on success
    if (result && result.changes !== undefined) {
      // Even if changes is 0, it might be valid (e.g., updating with same values)
      // But log a warning if changes is 0
      if (result.changes === 0) {
        console.warn(`[db-update] WARNING: Update returned 0 changes for table ${table} id ${id}`);
      }
      return { success: true, ...result };
    }
    // Unknown result format
    console.error(`[db-update] Unknown result format for table ${table} id ${id}:`, result);
    return { success: false, error: `Unknown result format from database update` };
  } catch (error) {
    console.error('Error in db-update:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-delete', async (event, table, id) => {
  try {
    if (!db) {
      try {
        db = new DatabaseManager();
      } catch (initError) {
        console.error('Error initializing database in db-delete:', initError);
        return { success: false, error: `Database not initialized: ${initError.message}` };
      }
    }
    await db.ensureInitialized();
    return db.delete(table, id);
  } catch (error) {
    console.error('Error in db-delete:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-get', async (event, table, id) => {
  try {
    if (!db) {
      try {
        db = new DatabaseManager();
      } catch (initError) {
        console.error('Error initializing database in db-get:', initError);
        return null;
      }
    }
    await db.ensureInitialized();
    return db.getById(table, id);
  } catch (error) {
    console.error('Error in db-get:', error);
    return null;
  }
});

ipcMain.handle('db-get-all', async (event, table, where = '', params = []) => {
  try {
    if (!db) {
      try {
        db = new DatabaseManager();
      } catch (initError) {
        console.error('Error initializing database in db-get-all:', initError);
        return [];
      }
    }
    await db.ensureInitialized();
    const result = db.getAll(table, where, params);
    return result || [];
  } catch (error) {
    console.error(`Error in db-get-all for table ${table}:`, error);
    return [];
  }
});

ipcMain.handle('db-query', async (event, sql, params = []) => {
  try {
    if (!db) {
      try {
        db = new DatabaseManager();
      } catch (initError) {
        console.error('Error initializing database in db-query:', initError);
        return { success: false, error: `Database not initialized: ${initError.message}` };
      }
    }
    await db.ensureInitialized();
    const result = db.query(sql, params);
    // If it's a SELECT query, return the data directly
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      return result || [];
    }
    // For other queries, return success status
    return { success: true, result };
  } catch (error) {
    // Don't log duplicate column errors - they're expected during migration
    if (error.message && error.message.includes('duplicate column')) {
      // Silently ignore duplicate column errors - they're expected
      return { success: true, result: 'Column already exists' };
    }
    console.error('Error in db-query:', error);
    return { success: false, error: error.message };
  }
});

// Password Hashing IPC Handlers
ipcMain.handle('hash-password', async (event, password) => {
  try {
    const hashedPassword = await passwordUtils.hashPassword(password);
    return { success: true, hashedPassword };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('compare-password', async (event, password, hashedPassword) => {
  try {
    const isMatch = await passwordUtils.comparePassword(password, hashedPassword);
    return { success: true, isMatch };
  } catch (error) {
    return { success: false, error: error.message };
  }
});


ipcMain.handle('db-get-path', () => {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'asel-database.db');
  return dbPath;
});

// Migration IPC Handlers
ipcMain.handle('run-migration', async () => {
  try {
    await db.ensureInitialized();
    const result = await db.runRealToIntegerMigration();
    return result;
  } catch (error) {
    return {
      success: false,
      message: `Migration error: ${error.message}`
    };
  }
});

ipcMain.handle('rollback-migration', async () => {
  try {
    await db.ensureInitialized();
    const result = await db.rollbackRealToIntegerMigration();
    return result;
  } catch (error) {
    return {
      success: false,
      message: `Rollback error: ${error.message}`
    };
  }
});

ipcMain.handle('test-migration', async () => {
  try {
    await db.ensureInitialized();
    const result = await db.testRealToIntegerMigration();
    return result;
  } catch (error) {
    return {
      success: false,
      message: `Test error: ${error.message}`
    };
  }
});

// Backup IPC Handlers
ipcMain.handle('backup-create', async (event, backupType = 'manual') => {
  try {
    await db.ensureInitialized();
    
    // Ask user to choose backup location
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'اختر مكان حفظ النسخة الاحتياطية',
      defaultPath: `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.db`,
      filters: [
        { name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      buttonLabel: 'حفظ'
    });

    if (result.canceled) {
      return { success: false, cancelled: true };
    }

    const backupPath = result.filePath;
    const backupResult = await db.createBackup(backupPath);
    
    if (backupResult.success) {
      // Update backup type in history
      const history = db.getBackupHistory(1);
      if (history.length > 0) {
        db.query('UPDATE backup_history SET backupType = ? WHERE id = ?', [backupType, history[0].id]);
      }
      
      return { success: true, backupPath, fileSize: backupResult.fileSize };
    } else {
      return { success: false, error: backupResult.error };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('backup-restore', async (event, backupPath = null) => {
  try {
    await db.ensureInitialized();
    
    // If backup path is provided, use it directly
    if (backupPath && typeof backupPath === 'string' && fs.existsSync(backupPath)) {
      // Validate backup file
      const fileStats = fs.statSync(backupPath);
      if (!fileStats.isFile()) {
        return { success: false, error: 'المسار المحدد ليس ملف' };
      }
      if (fileStats.size === 0) {
        return { success: false, error: 'الملف فارغ' };
      }
      
      const restoreResult = db.restoreBackup(backupPath);
      
      if (!restoreResult.success) {
        console.error('❌ Restore failed:', restoreResult.error);
      }
      
      return restoreResult;
    }
    
    // Otherwise, show file dialog
    // Use db.userDataPath instead of app.getPath('userData') to avoid cache path issues
    await db.ensureInitialized();
    const userDataPath = db.userDataPath || app.getPath('userData');
    const backupDir = path.join(userDataPath, 'backups');
    const defaultPath = fs.existsSync(backupDir) ? backupDir : userDataPath;
    
    console.log('[Backup Restore] Opening file dialog at:', defaultPath);
    console.log('[Backup Restore] UserDataPath:', userDataPath);
    console.log('[Backup Restore] Backup directory exists:', fs.existsSync(backupDir));
    if (fs.existsSync(backupDir)) {
      try {
        const files = fs.readdirSync(backupDir);
        console.log('[Backup Restore] Files in backup directory:', files);
      } catch (err) {
        console.error('[Backup Restore] Error reading backup directory:', err);
      }
    }
    
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'اختر ملف النسخ الاحتياطي',
      defaultPath: defaultPath,
      filters: [
        { name: 'All Files', extensions: ['*'] },
        { name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] },
        { name: 'Encrypted Backups', extensions: ['encrypted'] },
        { name: 'JSON Files', extensions: ['json'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled) {
      return { success: false, cancelled: true };
    }

    const selectedBackupPath = result.filePaths[0];
    
    // Check if file exists
    if (!fs.existsSync(selectedBackupPath)) {
      return { success: false, error: 'الملف المحدد غير موجود' };
    }
    
    const fileStats = fs.statSync(selectedBackupPath);
    
    if (!fileStats.isFile()) {
      return { success: false, error: 'المسار المحدد ليس ملف' };
    }
    
    if (fileStats.size === 0) {
      return { success: false, error: 'الملف فارغ' };
    }
    
    const restoreResult = db.restoreBackup(selectedBackupPath);
    
    if (!restoreResult.success) {
      console.error('❌ Restore failed:', restoreResult.error);
    }
    
    return restoreResult;
  } catch (error) {
    console.error('Error in backup-restore:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('backup-get-history', async (event, limit = 10) => {
  try {
    await db.ensureInitialized();
    return db.getBackupHistory(limit);
  } catch (error) {
    return [];
  }
});

ipcMain.handle('backup-get-path', () => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'backups');
});

ipcMain.handle('backup-set-auto-settings', async (event, settings) => {
  try {
    // Save settings to file
    const userDataPath = app.getPath('userData');
    
    // Ensure userData directory exists
    if (!fs.existsSync(userDataPath)) {
      try {
        fs.mkdirSync(userDataPath, { recursive: true });
      } catch (mkdirError) {
        return { success: false, error: `Cannot create user data directory: ${mkdirError.message}` };
      }
    }
    
    const settingsPath = path.join(userDataPath, 'auto-backup-settings.json');
    
    // Ensure backup directory exists with error handling
    if (settings.path) {
      if (!fs.existsSync(settings.path)) {
        try {
          fs.mkdirSync(settings.path, { recursive: true });
        } catch (mkdirError) {
          return { success: false, error: `Cannot create backup directory: ${mkdirError.message}` };
        }
      }
      
      // Verify directory is writable
      try {
        fs.accessSync(settings.path, fs.constants.W_OK);
      } catch (accessError) {
        return { success: false, error: `Backup directory is not writable: ${accessError.message}` };
      }
    }
    
    // Write settings file with error handling
    try {
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    } catch (writeError) {
      return { success: false, error: `Cannot write settings file: ${writeError.message}` };
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('backup-get-auto-settings', async (event) => {
  try {
    const userDataPath = app.getPath('userData');
    const settingsPath = path.join(userDataPath, 'auto-backup-settings.json');
    
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      return { success: true, settings };
    } else {
      return { success: true, settings: { enabled: false, path: '', interval: 'daily' } };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('backup-select-path', async (event) => {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) {
      // If main window is not available, try to get any window
      const allWindows = BrowserWindow.getAllWindows();
      if (allWindows.length > 0) {
        mainWindow = allWindows[0];
      } else {
        return { success: false, error: 'No window available' };
      }
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'اختر مجلد حفظ النسخ الاحتياطية',
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled) {
      return { success: false, cancelled: true };
    }

    if (result.filePaths && result.filePaths.length > 0) {
      return { success: true, path: result.filePaths[0] };
    } else {
      return { success: false, error: 'No path selected' };
    }
  } catch (error) {
    console.error('Error in backup-select-path:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('backup-disable-auto', async (event) => {
  try {
    // Disable auto backup
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-open-folder', () => {
  const userDataPath = app.getPath('userData');
  const { shell } = require('electron');
  shell.openPath(userDataPath);
  return userDataPath;
});

// Save Invoice to File (as PDF)
ipcMain.handle('save-invoice-to-file', async (event, invoiceContent, defaultFileName) => {
  let pdfWindow = null;
  
  try {
    // Show save dialog first - make it appear immediately
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'حفظ الفاتورة',
      defaultPath: defaultFileName ? defaultFileName.replace('.html', '.pdf') : 'invoice.pdf',
      filters: [
        { name: 'PDF Files', extensions: ['pdf'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['showOverwriteConfirmation']
    });

    if (result.canceled) {
      return { success: false, cancelled: true };
    }

    const filePath = result.filePath;
    
    // Create a hidden window to render the HTML content (A4 size)
    pdfWindow = new BrowserWindow({
      show: false,
      width: 1200,
      height: 1600, // A4 portrait approximate height
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    
    // Load HTML content directly using data URI - much faster
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(invoiceContent)}`;
    
    // Wait for content to load - use dom-ready for faster response
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for page to load'));
      }, 10000);
      
      let resolved = false;
      
      const finish = () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        setTimeout(resolve, 1000); // Wait 1 second for rendering to ensure CSS is applied
      };
      
      // Use dom-ready for faster response
      pdfWindow.webContents.once('dom-ready', finish);
      
      pdfWindow.webContents.once('did-finish-load', finish);
      
      pdfWindow.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        reject(new Error(`Failed to load: ${errorDescription}`));
      });
      
      pdfWindow.loadURL(dataUrl);
    });
    
    // Generate PDF
    
    const pdfData = await pdfWindow.webContents.printToPDF({
      printBackground: true,
      margin: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0
      },
      pageSize: 'A4'
    });
    
    // Write PDF to file
    
    fs.writeFileSync(filePath, pdfData);
    
    
    // Close the hidden window
    if (pdfWindow && !pdfWindow.isDestroyed()) {
      pdfWindow.close();
    }
    pdfWindow = null;
    
    return { success: true, filePath };
  } catch (error) {
    console.error('Error saving invoice to PDF:', error);
    
    // Close window if it exists
    if (pdfWindow && !pdfWindow.isDestroyed()) {
      pdfWindow.close();
    }
    
    return { success: false, error: error.message };
  }
});

// Print Invoice (without opening new tab)
ipcMain.handle('open-print-window', async (event, htmlContent, windowTitle) => {
  let printWindow = null;
  
  try {
    // Create a hidden window to render the HTML content
    printWindow = new BrowserWindow({
      show: false,  // Hidden window - no tab will appear
      width: 1200,
      height: 1600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    
    // Load HTML content directly using data URI
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
    
    // Wait for content to load
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for page to load'));
      }, 10000);
      
      let resolved = false;
      
      const finish = () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        setTimeout(resolve, 500); // Wait 500ms for rendering
      };
      
      printWindow.webContents.once('dom-ready', finish);
      printWindow.webContents.once('did-finish-load', finish);
      
      printWindow.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        reject(new Error(`Failed to load: ${errorDescription}`));
      });
      
      printWindow.loadURL(dataUrl);
    });
    
    // Handle window close to prevent errors
    const closeWindowSafely = () => {
      if (printWindow && !printWindow.isDestroyed()) {
        try {
          printWindow.removeAllListeners();
          printWindow.close();
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
      printWindow = null;
    };
    
    // Listen for window close events
    printWindow.on('closed', () => {
      printWindow = null;
    });
    
    // Open print dialog directly - this won't create a new tab
    // Note: print() is asynchronous and opens the print dialog
    // The window will be closed after user interacts with print dialog
    printWindow.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
      // Only log as error if it's not a user cancellation
      if (!success && failureReason) {
        const reason = String(failureReason).toLowerCase();
        // "Print job canceled" is normal - user cancelled the print dialog
        if (reason.includes('cancel') || reason.includes('cancelled')) {
          // User cancelled - this is normal, don't log as error
          // Silently handle cancellation
        } else {
          // Real error occurred
          console.error('Print failed:', failureReason);
        }
      }
      
      // Close the hidden window after printing dialog is closed
      // Use a longer timeout to allow user to interact with print dialog
      setTimeout(() => {
        closeWindowSafely();
      }, 1500);
    });
    
    // Return immediately - print dialog will open asynchronously
    return { success: true };
  } catch (error) {
    console.error('Error in open-print-window:', error);
    
    // Close window if it exists
    if (printWindow && !printWindow.isDestroyed()) {
      try {
        printWindow.removeAllListeners();
        printWindow.close();
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
    printWindow = null;
    
    return { success: false, error: error.message };
  }
});

// Get Asset Path
ipcMain.handle('get-asset-path', async (event, assetName) => {
  try {
    if (!assetName || typeof assetName !== 'string') {
      return { success: false, error: 'Invalid asset name' };
    }
    
    // Get correct path for packaged and development modes
    const appPath = app.isPackaged ? app.getAppPath() : __dirname;
    
    // Try multiple possible paths
    const possiblePaths = [
      path.join(appPath, 'assets', assetName),
      path.join(__dirname, 'assets', assetName),
      path.join(process.resourcesPath || appPath, 'assets', assetName),
      path.join(path.dirname(appPath), 'assets', assetName)
    ];
    
    let assetPath = null;
    for (const possiblePath of possiblePaths) {
      try {
        if (fs.existsSync(possiblePath)) {
          // Verify it's a file, not a directory
          const stats = fs.statSync(possiblePath);
          if (stats.isFile()) {
            assetPath = possiblePath;
            break;
          }
        }
      } catch (pathError) {
        // Continue to next path
        continue;
      }
    }
    
    if (!assetPath) {
      console.error(`Asset file not found: ${assetName}. Tried paths:`, possiblePaths);
      return { success: false, error: `Asset file not found: ${assetName}` };
    }
    
    // Convert to file:// URL for use in HTML (Windows needs proper format)
    let fileUrl;
    if (process.platform === 'win32') {
      // Windows: file:///C:/path/to/file
      fileUrl = `file:///${assetPath.replace(/\\/g, '/')}`;
    } else {
      // Unix/Mac: file:///path/to/file
      fileUrl = `file://${assetPath}`;
    }
    return { success: true, path: fileUrl };
  } catch (error) {
    console.error('Error getting asset path:', error);
    return { success: false, error: error.message };
  }
});

// Migration function to move data from localStorage to SQLite
function migrateFromLocalStorage() {
  // This will be called once to migrate existing localStorage data
  // For now, it's a placeholder. The actual migration will be done through the renderer process
  // after checking if data exists in localStorage but not in SQLite
}

// Handle uncaught exceptions - don't crash the app
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  logErrorToFile(error, 'Uncaught Exception');
  // Log error but don't show dialog that might cause issues
  // The app will continue running
  // Try to recover by reloading main window if it exists
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      const appPath = app.isPackaged ? app.getAppPath() : __dirname;
      const indexPath = path.join(appPath, 'index.html');
      mainWindow.loadFile(indexPath).catch(() => {
        mainWindow.loadFile('index.html').catch(() => {
          console.error('Failed to reload after uncaught exception');
        });
      });
    } catch (reloadError) {
      console.error('Error reloading after uncaught exception:', reloadError);
    }
  }
});

// Handle unhandled promise rejections - don't crash the app
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Log error to file
  try {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logErrorToFile(error, 'Unhandled Rejection');
  } catch (logError) {
    console.error('Failed to log rejection:', logError);
  }
  // Log error but don't show dialog that might cause issues
  // The app will continue running
});

// Configure command line switches to prevent cache errors on Windows
// These must be set BEFORE app.whenReady()
if (process.platform === 'win32') {
  // Configure GPU to prevent GPU cache errors and context creation errors
  // Use ANGLE instead of disabling GPU completely for better performance
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('disable-gpu-process-crash-limit');
  app.commandLine.appendSwitch('disable-software-rasterizer');
  
  // Disable cache-related features that cause permission errors
  // Force offline mode - disable all network features
  app.commandLine.appendSwitch('disable-background-networking');
  app.commandLine.appendSwitch('disable-background-timer-throttling');
  app.commandLine.appendSwitch('disable-features', 'NetworkService,NetworkServiceInProcess');
  app.commandLine.appendSwitch('disable-web-security'); // Only for local files
  app.commandLine.appendSwitch('allow-file-access-from-files');
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
  app.commandLine.appendSwitch('disable-breakpad');
  app.commandLine.appendSwitch('disable-client-side-phishing-detection');
  app.commandLine.appendSwitch('disable-component-update');
  app.commandLine.appendSwitch('disable-default-apps');
  app.commandLine.appendSwitch('disable-domain-reliability');
  app.commandLine.appendSwitch('disable-features', 'TranslateUI,BlinkGenPropertyTrees');
  app.commandLine.appendSwitch('disable-ipc-flooding-protection');
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.commandLine.appendSwitch('disable-sync');
  app.commandLine.appendSwitch('disable-translate');
  app.commandLine.appendSwitch('metrics-recording-only');
  app.commandLine.appendSwitch('no-first-run');
  app.commandLine.appendSwitch('safebrowsing-disable-auto-update');
  app.commandLine.appendSwitch('enable-automation');
  app.commandLine.appendSwitch('password-store=basic');
  app.commandLine.appendSwitch('use-mock-keychain');
  
  // Suppress DevTools errors in console
  app.commandLine.appendSwitch('disable-dev-shm-usage');
  app.commandLine.appendSwitch('disable-web-security');
  
  // Fix GPU context creation errors
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('ignore-gpu-blacklist');
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('use-gl=angle'); // Use ANGLE for better Windows compatibility
  
  // Set log level to suppress warnings (only show critical errors)
  // Level 2 = ERROR only (suppress WARNING, INFO, VERBOSE)
  app.commandLine.appendSwitch('log-level', '2');
}

app.whenReady().then(async () => {
  try {
    // Set application name for dialogs and popups
    app.setName('نظام إدارة شركة أسيل');
    
    // CRITICAL: Prevent multiple instances from running simultaneously
    // This prevents database locking issues
    const gotTheLock = app.requestSingleInstanceLock();
    
    if (!gotTheLock) {
      console.log('Another instance is already running. Exiting...');
      app.exit(0);
      return;
    }
    
    // Handle when another instance tries to start
    app.on('second-instance', () => {
      // Focus the existing window instead of opening a new one
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });
    
    // CRITICAL: Initialize Database FIRST, before setting cache path
    // This ensures database uses the correct userData path
    // Store userData path BEFORE any modifications
    const userDataPathBeforeCache = app.getPath('userData');
    const expectedDbPath = path.join(userDataPathBeforeCache, 'asel-database.db');
    
    try {
      db = new DatabaseManager();
      
      // Verify database is using correct path
      if (path.resolve(db.dbPath).toLowerCase() !== path.resolve(expectedDbPath).toLowerCase()) {
        console.error('[Main] ⚠️ WARNING: Database path mismatch after initialization!');
        console.error('[Main] Expected:', expectedDbPath);
        console.error('[Main] Actual:', db.dbPath);
      }
    } catch (dbError) {
      console.error('Error initializing database:', dbError);
      // Try to show user-friendly error
      console.error('UserData path:', userDataPathBeforeCache);
      console.error('Database path:', expectedDbPath);
      // Don't show dialog here - let the app continue and show error when needed
    }
    
    // Configure cache directory AFTER database initialization
    // This helps avoid "Access is denied" errors when Electron tries to create cache
    if (process.platform === 'win32') {
      try {
        const userDataPath = app.getPath('userData');
        const cachePath = path.join(userDataPath, 'cache');
        
        // Ensure cache directory exists and is writable
        if (!fs.existsSync(cachePath)) {
          fs.mkdirSync(cachePath, { recursive: true });
        }
        
        // Verify cache directory is writable
        try {
          fs.accessSync(cachePath, fs.constants.W_OK);
          // Set cache directory to userData to avoid permission issues
          // NOTE: This should NOT affect database path since database is already initialized
          app.setPath('cache', cachePath);
          // Cache directory set
        } catch (accessError) {
          // If cache directory is not writable, try temp directory
          try {
            const os = require('os');
            const tempCachePath = path.join(os.tmpdir(), 'electron-cache-' + app.getName().replace(/\s+/g, '-'));
            if (!fs.existsSync(tempCachePath)) {
              fs.mkdirSync(tempCachePath, { recursive: true });
            }
            app.setPath('cache', tempCachePath);
            // Cache directory set to temp
          } catch (tempError) {
            // If we can't set cache directory, continue anyway
            // The errors will be suppressed in the error handlers
            console.warn('Could not configure cache directory:', tempError.message);
          }
        }
      } catch (cacheError) {
        // If we can't set cache directory, continue anyway
        // The errors will be suppressed in the error handlers
        console.warn('Could not configure cache directory:', cacheError.message);
      }
    }

    // Run migration from localStorage to SQLite if needed
    try {
      migrateFromLocalStorage();
    } catch (migrationError) {
      console.error('Error in migration:', migrationError);
      // Continue anyway
    }

    // Auto-run migration if database exists and uses REAL format
    try {
      if (db && fs.existsSync(db.dbPath)) {
        await db.ensureInitialized();
        // Check if migration is needed
        const tableInfo = db.db.prepare('PRAGMA table_info(products)').all();
        if (tableInfo.length > 0) {
          const smallestPriceColumn = tableInfo.find(col => col.name === 'smallestPrice');
          // SQLite stores type as string, check if it's REAL
          if (smallestPriceColumn && (smallestPriceColumn.type === 'REAL' || smallestPriceColumn.type === 2)) {
            console.log('[Migration] ⚠️ Database uses REAL format. Auto-running migration...');
            const migrationResult = await db.runRealToIntegerMigration();
            if (migrationResult.success) {
              console.log('[Migration] ✅ Migration completed successfully!');
              console.log('[Migration] Backup saved to:', migrationResult.backupPath);
            } else {
              console.error('[Migration] ❌ Migration failed:', migrationResult.message);
            }
          }
        }
      }
    } catch (migrationError) {
      console.error('[Migration] Error checking/running migration:', migrationError.message);
      // Don't block app startup if migration check fails
    }
    
    createLoginWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createLoginWindow();
      }
    });
  } catch (error) {
    console.error('Error in app.whenReady:', error);
    console.error('Error stack:', error.stack);
    // Don't show dialog that might cause issues, just log
  }
}).catch((error) => {
  console.error('Error in app.whenReady promise:', error);
  console.error('Error stack:', error.stack);
  // Don't show dialog that might cause issues, just log
});

// Track if backup is in progress
let isBackupInProgress = false;

// Check and create auto backup before quitting
app.on('before-quit', async (event) => {
  // Prevent default quit behavior until backup is complete
  event.preventDefault();
  
  try {
    if (isBackupInProgress) {
      // If backup is already in progress, allow quit
      app.exit(0);
      return;
    }

    if (!db) {
      app.exit(0);
      return;
    }

    await db.ensureInitialized();
    
    // Get auto backup settings
    const userDataPath = app.getPath('userData');
    const settingsPath = path.join(userDataPath, 'auto-backup-settings.json');
    
    let settings = {};
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }

    // Check if auto backup is enabled
    if (!settings.enabled) {
      app.exit(0);
      return;
    }

    // Create backup directory if it doesn't exist
    const backupDir = settings.path || path.join(userDataPath, 'backups');
    if (!fs.existsSync(backupDir)) {
      try {
        fs.mkdirSync(backupDir, { recursive: true });
      } catch (mkdirError) {
        console.error('Error creating backup directory:', mkdirError);
        // Continue anyway - might fail silently if backup not needed
      }
    }
    
    // Verify backup directory is writable
    try {
      if (fs.existsSync(backupDir)) {
        fs.accessSync(backupDir, fs.constants.W_OK);
      }
    } catch (accessError) {
      console.error('Backup directory is not writable:', accessError);
      // Continue anyway - might still work
    }

    // Get backup interval from settings (default: daily)
    const interval = settings.interval || 'daily';

    // Create backup file name with date based on interval
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let backupFileName;
    
    if (interval === 'weekly') {
      // Weekly: use year-week format (YYYY-WW)
      const year = today.getFullYear();
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      const days = Math.floor((today - startOfYear) / (24 * 60 * 60 * 1000));
      const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
      backupFileName = `backup-${year}-W${weekNumber.toString().padStart(2, '0')}.db`;
    } else if (interval === 'monthly') {
      // Monthly: use year-month format (YYYY-MM)
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      backupFileName = `backup-${year}-${month}.db`;
    } else {
      // Daily: use date format (YYYY-MM-DD)
      const dateStr = today.toISOString().split('T')[0];
      backupFileName = `backup-${dateStr}.db`;
    }
    
    const backupPath = path.join(backupDir, backupFileName);

    // Check if backup file actually exists (not just in database)
    const backupFileExists = fs.existsSync(backupPath) && fs.statSync(backupPath).size > 0;

    // Check last backup date from database
    const lastBackupDate = db.getLastBackupDate();

    // Check if we need to create backup based on interval
    let needsBackup = false;
    if (!backupFileExists) {
      // Backup file doesn't exist, create one
      needsBackup = true;
    } else if (!lastBackupDate) {
      // No backup record in database, but file exists - create new one anyway
      needsBackup = true;
    } else {
      const lastBackup = new Date(lastBackupDate);
      lastBackup.setHours(0, 0, 0, 0);
      
      // Calculate days difference
      const daysDiff = Math.floor((today - lastBackup) / (1000 * 60 * 60 * 24));
      
      // Check based on interval
      if (interval === 'daily') {
        // Daily: create backup if last backup is older than today
        needsBackup = daysDiff >= 1;
      } else if (interval === 'weekly') {
        // Weekly: create backup if last backup is 7 days or older
        needsBackup = daysDiff >= 7;
      } else if (interval === 'monthly') {
        // Monthly: create backup if last backup is 30 days or older
        needsBackup = daysDiff >= 30;
      } else {
        // Default to daily
        needsBackup = daysDiff >= 1;
      }
    }

    if (needsBackup && settings.path) {
      isBackupInProgress = true;
      
      // Create auto backup (synchronous operation)
      const backupResult = await db.createAutoBackup(backupPath);
      
      isBackupInProgress = false;
      
      if (!backupResult.success) {
        console.error('❌ Failed to create auto backup:', backupResult.error);
      } else {
        // Clean up old backups if count exceeds 15 (delete oldest 10 files)
        try {
          const cleanupResult = db.deleteOldBackupsWhenExceeds(15, 10, backupDir);
          if (cleanupResult.success && cleanupResult.deletedCount > 0) {
            console.log(`✅ Cleaned up ${cleanupResult.deletedCount} oldest backup(s) (threshold: 15, deleted: 10)`);
          }
        } catch (cleanupError) {
          console.error('⚠️ Error cleaning up old backups:', cleanupError);
          // Don't fail the backup process if cleanup fails
        }
        
        // Also clean up old renamed files (.old.timestamp) older than 7 days
        try {
          const renamedCleanupResult = await db.cleanupOldRenamedFiles(backupDir, 7);
          if (renamedCleanupResult.success && renamedCleanupResult.deletedCount > 0) {
            const sizeInMB = (renamedCleanupResult.sizeFreed / (1024 * 1024)).toFixed(2);
            // Only log if significant cleanup happened (more than 10 files or 100MB)
            if (renamedCleanupResult.deletedCount > 10 || renamedCleanupResult.sizeFreed > 100 * 1024 * 1024) {
              console.log(`✅ Cleaned up ${renamedCleanupResult.deletedCount} old renamed file(s), freed ${sizeInMB} MB`);
            } else if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
              console.debug(`✅ Cleaned up ${renamedCleanupResult.deletedCount} old renamed file(s), freed ${sizeInMB} MB`);
            }
          }
        } catch (renamedCleanupError) {
          console.warn('⚠️ Error cleaning up old renamed files:', renamedCleanupError);
        }
      }
      
      // Close database connection with proper checkpoint
      if (db) {
        try {
          await db.ensureInitialized();
          // Ensure checkpoint is done before closing
          if (db.db && db.db.open) {
            try {
              db.checkpoint();
            } catch (checkpointError) {
              console.warn('[Main] Checkpoint before quit failed:', checkpointError.message);
            }
          }
          db.close();
        } catch (closeError) {
          console.error('[Main] Error closing database:', closeError);
          // Force close as last resort
          try {
            if (db && db.db) {
              db.db.close();
            }
          } catch (forceCloseError) {
            console.error('[Main] Force close also failed:', forceCloseError);
          }
        }
      }
      
      // Now allow quit
      app.exit(0);
    } else {
      // No backup needed, close database and quit
      if (db) {
        db.close();
      }
      app.exit(0);
    }
  } catch (error) {
    console.error('❌ Error in auto backup on quit:', error);
    isBackupInProgress = false;
    
    // Close database connection even on error
    if (db) {
      try {
        db.close();
      } catch (closeError) {
        console.error('Error closing database:', closeError);
      }
    }
    
    // Allow quit even on error
    app.exit(0);
  }
});

// Handle unexpected shutdown signals (Ctrl+C, kill, etc.)
process.on('SIGINT', () => {
  // Hide shutdown messages - only show errors
  if (db) {
    try {
      // Create emergency backup before shutdown
      db.createEmergencyBackup();
      db.close();
    } catch (error) {
      console.error('Error closing database on SIGINT:', error);
    }
  }
  app.exit(0);
});

process.on('SIGTERM', () => {
  // Hide shutdown messages - only show errors
  if (db) {
    try {
      // Create emergency backup before shutdown
      db.createEmergencyBackup();
      db.close();
    } catch (error) {
      console.error('Error closing database on SIGTERM:', error);
    }
  }
  app.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  
  // Try to save database state before crash
  if (db) {
    try {
      // Create emergency backup
      // Hide backup messages - only show errors
      db.createEmergencyBackup();
      
      // Close database gracefully
      db.close();
    } catch (closeError) {
      console.error('Error closing database on uncaught exception:', closeError);
    }
  }
  
  // Don't exit immediately - give time for cleanup
  setTimeout(() => {
    app.exit(1);
  }, 2000);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - let Electron handle it
});

// Handle process signals to ensure database is closed properly
// This prevents corruption when app is closed via Ctrl+C or kill command
process.on('SIGINT', async () => {
  console.log('[Main] SIGINT received, closing database...');
  if (db) {
    try {
      await db.ensureInitialized();
      db.close();
    } catch (error) {
      console.error('[Main] Error closing database on SIGINT:', error);
    }
  }
  app.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[Main] SIGTERM received, closing database...');
  if (db) {
    try {
      await db.ensureInitialized();
      db.close();
    } catch (error) {
      console.error('[Main] Error closing database on SIGTERM:', error);
    }
  }
  app.exit(0);
});

app.on('window-all-closed', (event) => {
  // Don't close database here - it will be closed in before-quit handler
  // IMPORTANT: Don't quit immediately - wait a moment to check if a new window is being created
  // This prevents the app from closing when login window closes during login process
  if (process.platform !== 'darwin') {
    // Check if login window is still open - if so, don't quit
    if (loginWindow && !loginWindow.isDestroyed() && loginWindow.isVisible()) {
      // Login window is still open and visible, don't quit
      // Hide quit prevention messages - only show errors
      return;
    }
    
    // Give it a moment to check if main window is being created
    // This is important because createMainWindow() might be called just after login window closes
    setTimeout(() => {
      // Check if main window exists
      if (mainWindow && !mainWindow.isDestroyed()) {
        // Main window exists, don't quit
        // Hide quit prevention messages - only show errors
        return;
      }
      
      // Check again after another short delay (main window might still be loading)
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          // Main window exists, don't quit
          // Hide quit prevention messages - only show errors
          return;
        }
        
        // Only quit if both windows are truly closed and no window is being created
        if (!mainWindow || mainWindow.isDestroyed()) {
          if (!loginWindow || loginWindow.isDestroyed()) {
            // Hide quit messages - only show errors
            // Quit will trigger before-quit event which handles backup
            app.quit();
          }
        }
      }, 500);
    }, 100);
  }
});

