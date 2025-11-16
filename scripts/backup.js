// Backup Management System

// Custom Confirmation Dialog (replaces confirm() to avoid Electron focus issues)
function showConfirmDialog(message, onConfirm, onCancel) {
    // Create confirmation modal
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.style.zIndex = '10001';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.maxWidth = '450px';
    
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';
    modalHeader.innerHTML = `
        <h2 style="margin: 0; font-size: 1.25rem;">تأكيد الاستعادة</h2>
        <button class="modal-close">&times;</button>
    `;
    
    const modalBody = document.createElement('div');
    modalBody.className = 'modal-body';
    modalBody.style.padding = '24px';
    
    const messageP = document.createElement('p');
    messageP.style.margin = '0 0 24px 0';
    messageP.style.fontSize = '1rem';
    messageP.style.color = 'var(--text-primary)';
    messageP.style.lineHeight = '1.6';
    messageP.textContent = message;
    
    const buttonsDiv = document.createElement('div');
    buttonsDiv.style.display = 'flex';
    buttonsDiv.style.gap = '12px';
    buttonsDiv.style.justifyContent = 'flex-end';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.style.minWidth = '100px';
    cancelBtn.textContent = 'إلغاء';
    
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn btn-danger';
    confirmBtn.style.minWidth = '100px';
    confirmBtn.textContent = 'استعادة';
    
    buttonsDiv.appendChild(cancelBtn);
    buttonsDiv.appendChild(confirmBtn);
    
    modalBody.appendChild(messageP);
    modalBody.appendChild(buttonsDiv);
    
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modal.appendChild(modalContent);
    
    document.body.appendChild(modal);
    
    // Close button handler
    const closeBtn = modalHeader.querySelector('.modal-close');
    const closeModal = () => {
        modal.remove();
        if (onCancel) onCancel();
    };
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    confirmBtn.addEventListener('click', () => {
        modal.remove();
        if (onConfirm) onConfirm();
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Focus on confirm button
    setTimeout(() => {
        confirmBtn.focus();
    }, 100);
}

// Pagination State
let currentPage = 1;
const itemsPerPage = 20;
let allBackupHistory = [];

// Load backup history on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Small delay to ensure permissions.js has run
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await loadBackupHistory();
    await loadAutoBackupSettings();
    initializeEventListeners();
});

// Initialize Event Listeners
function initializeEventListeners() {
    // Create Backup Button
    document.getElementById('createBackupBtn').addEventListener('click', async () => {
        await createBackup();
    });

    // Restore Backup Button
    document.getElementById('restoreBackupBtn').addEventListener('click', async () => {
        await restoreBackup();
    });

    // Auto Backup Settings
    document.getElementById('autoBackupEnabled').addEventListener('change', (e) => {
        const pathGroup = document.getElementById('autoBackupPathGroup');
        const intervalGroup = document.getElementById('autoBackupIntervalGroup');
        if (e.target.checked) {
            pathGroup.style.display = 'block';
            intervalGroup.style.display = 'block';
        } else {
            pathGroup.style.display = 'none';
            intervalGroup.style.display = 'none';
        }
    });

    // Select Backup Path Button
    const selectBackupPathBtn = document.getElementById('selectBackupPathBtn');
    if (selectBackupPathBtn) {
        selectBackupPathBtn.addEventListener('click', async () => {
            try {
                console.log('🔍 Selecting backup path...');
                const result = await window.electronAPI.backupSelectPath();
                console.log('📁 Backup path result:', result);
                
                if (result && result.success && !result.cancelled) {
                    document.getElementById('backupPath').value = result.path;
                    console.log('✅ Backup path selected:', result.path);
                } else if (result && result.cancelled) {
                    console.log('ℹ️ User cancelled path selection');
                } else {
                    console.error('❌ Failed to select backup path:', result);
                    if (window.showToast) {
                        window.showToast('فشل اختيار المسار. يرجى المحاولة مرة أخرى.', 'error');
                    }
                }
            } catch (error) {
                console.error('❌ Error selecting backup path:', error);
                if (window.showToast) {
                    window.showToast('حدث خطأ أثناء اختيار المسار: ' + (error.message || error), 'error');
                }
            }
        });
    }

    // Save Auto Backup Settings
    document.getElementById('saveAutoBackupBtn').addEventListener('click', async () => {
        await saveAutoBackupSettings();
    });

    // Pagination Event Listeners
    document.getElementById('prevPageBtn').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderBackupHistory();
        }
    });

    document.getElementById('nextPageBtn').addEventListener('click', () => {
        const totalPages = Math.ceil(allBackupHistory.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderBackupHistory();
        }
    });

    // Refresh Backup List Button
    const refreshBtn = document.getElementById('refreshBackupListBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<span>🔄</span> جارٍ التحديث...';
            await loadBackupHistory();
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<span>🔄</span> تحديث';
            if (window.showToast) {
                window.showToast('تم تحديث قائمة النسخ الاحتياطية', 'success');
            }
        });
    }
}

// Create Backup
async function createBackup() {
    try {
        // Check if electronAPI is available
        if (!window.electronAPI || !window.electronAPI.backupCreate) {
            if (window.showToast) {
                window.showToast('واجهة البرنامج غير متاحة. يرجى إعادة تشغيل البرنامج.', 'error');
            }
            return;
        }
        
        const btn = document.getElementById('createBackupBtn');
        if (!btn) {
            console.error('Create backup button not found');
            return;
        }
        
        btn.disabled = true;
        btn.textContent = 'جارٍ الإنشاء...';

        const result = await window.electronAPI.backupCreate('manual');
        
        if (result && result.success) {
            if (window.showToast) {
                const pathMsg = result.backupPath ? ` المسار: ${result.backupPath}` : '';
                const sizeMsg = result.fileSize ? ` الحجم: ${formatFileSize(result.fileSize)}` : '';
                window.showToast(`تم إنشاء النسخة الاحتياطية بنجاح!${pathMsg}${sizeMsg}`, 'success');
            }
            currentPage = 1; // Reset to first page
            await loadBackupHistory();
        } else if (result && result.cancelled) {
            // User cancelled, do nothing
        } else {
            const errorMsg = (result && result.error) ? result.error : 'خطأ غير معروف';
            if (window.showToast) {
                window.showToast(`فشل إنشاء النسخة الاحتياطية: ${errorMsg}`, 'error');
            }
        }
    } catch (error) {
        console.error('Error creating backup:', error);
        if (window.showToast) {
            window.showToast('حدث خطأ أثناء إنشاء النسخة الاحتياطية: ' + (error.message || error), 'error');
        }
    } finally {
        const btn = document.getElementById('createBackupBtn');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span>+</span> إنشاء نسخة احتياطية';
        }
    }
}

// Restore Backup
async function restoreBackup() {
    showConfirmDialog(
        '⚠️ تحذير: استعادة النسخة الاحتياطية ستحذف جميع البيانات الحالية!\nهل أنت متأكد من الاستمرار؟',
        () => {
            // User confirmed - proceed with restore
            proceedWithRestore();
        },
        () => {
            // User cancelled - do nothing
        }
    );
}

// Proceed with restore after confirmation
async function proceedWithRestore() {
    try {
        const btn = document.getElementById('restoreBackupBtn');
        btn.disabled = true;
        btn.textContent = 'جارٍ الاستعادة...';

        const result = await window.electronAPI.backupRestore();
        
        if (result.success) {
            if (window.showToast) {
                window.showToast('تم استعادة النسخة الاحتياطية بنجاح! سيتم إعادة تحميل الصفحة...', 'success');
            }
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else if (result.cancelled) {
            // User cancelled, do nothing
        } else {
            if (window.showToast) {
                window.showToast(`فشل استعادة النسخة الاحتياطية: ${result.error}`, 'error');
            }
        }
    } catch (error) {
        console.error('Error restoring backup:', error);
        if (window.showToast) {
            window.showToast('حدث خطأ أثناء استعادة النسخة الاحتياطية: ' + error.message, 'error');
        }
    } finally {
        const btn = document.getElementById('restoreBackupBtn');
        btn.disabled = false;
        btn.innerHTML = '<span>↻</span> استعادة نسخة احتياطية';
    }
}

// Load Backup History
async function loadBackupHistory() {
    try {
        // Check if electronAPI is available
        if (!window.electronAPI || !window.electronAPI.backupGetHistory) {
            console.error('electronAPI.backupGetHistory is not available');
            document.getElementById('backupHistoryBody').innerHTML = 
                '<tr><td colspan="5" class="text-center">⚠️ واجهة البرنامج غير متاحة. يرجى إعادة تحميل الصفحة.</td></tr>';
            return;
        }
        
        // Load all backup history (not limited)
        const result = await window.electronAPI.backupGetHistory(1000);
        
        // Handle result - check if it's an array or wrapped in success object
        if (Array.isArray(result)) {
            allBackupHistory = result;
        } else if (result && Array.isArray(result.data)) {
            allBackupHistory = result.data;
        } else if (result && result.success !== false && Array.isArray(result)) {
            allBackupHistory = result;
        } else {
            allBackupHistory = [];
            console.warn('Unexpected backup history result format:', result);
        }
        
        currentPage = 1;
        renderBackupHistory();
    } catch (error) {
        console.error('Error loading backup history:', error);
        const tbody = document.getElementById('backupHistoryBody');
        if (tbody) {
            tbody.innerHTML = 
                '<tr><td colspan="5" class="text-center">❌ حدث خطأ أثناء تحميل التاريخ: ' + (error.message || error) + '</td></tr>';
        }
    }
}

// Render Backup History
function renderBackupHistory() {
    const tbody = document.getElementById('backupHistoryBody');
    const emptyState = document.getElementById('emptyState');
    const paginationContainer = document.getElementById('paginationContainer');
    
    if (!allBackupHistory || allBackupHistory.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) {
            emptyState.classList.remove('hidden');
        }
        if (paginationContainer) {
            paginationContainer.style.display = 'none';
        }
        return;
    }

    // Hide empty state
    if (emptyState) {
        emptyState.classList.add('hidden');
    }

    // Calculate pagination
    const totalPages = Math.ceil(allBackupHistory.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, allBackupHistory.length);
    const paginatedHistory = allBackupHistory.slice(startIndex, endIndex);

    // Get current logged-in user type
    const currentUserType = localStorage.getItem('asel_userType') || '';
    const canRestoreBackups = currentUserType === 'manager' || currentUserType === 'system_engineer';

    // Show pagination
    if (paginationContainer) {
        paginationContainer.style.display = 'flex';
    }

    // Update pagination info
    const paginationInfo = document.getElementById('paginationInfo');
    if (paginationInfo) {
        paginationInfo.textContent = `عرض ${startIndex + 1} - ${endIndex} من ${allBackupHistory.length}`;
    }

    // Update pagination buttons
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

    // Render page numbers
    const pageNumbersEl = document.getElementById('pageNumbers');
    if (pageNumbersEl) {
        pageNumbersEl.innerHTML = '';
        const maxPagesToShow = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
        
        if (endPage - startPage < maxPagesToShow - 1) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.type = 'button';
            pageBtn.className = `btn ${i === currentPage ? 'btn-primary' : 'btn-secondary'}`;
            pageBtn.textContent = i;
            pageBtn.addEventListener('click', () => {
                currentPage = i;
                renderBackupHistory();
            });
            pageNumbersEl.appendChild(pageBtn);
        }
    }

    // Render table rows
    tbody.innerHTML = '';
    
    paginatedHistory.forEach(backup => {
        const date = new Date(backup.createdAt);
        const formattedDate = date.toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const row = document.createElement('tr');
        const isDiscovered = backup.discovered === true;
        const backupTypeBadge = backup.backupType === 'auto' ? 'badge-success' : 'badge-primary';
        const backupTypeText = backup.backupType === 'auto' ? 'تلقائي' : 'يدوي';
        const discoveredBadge = isDiscovered ? '<span class="badge badge-warning" style="margin-right: 5px;" title="تم اكتشاف هذا الملف على القرص">مكتشف</span>' : '';
        
        row.innerHTML = `
            <td>${formattedDate}</td>
            <td>${backup.backupPath || '-'}</td>
            <td>${discoveredBadge}<span class="badge ${backupTypeBadge}">${backupTypeText}</span></td>
            <td>${formatFileSize(backup.fileSize || 0)}</td>
            <td>
            </td>
        `;
        
        // Add restore button only for manager or system_engineer
        const actionsCell = row.querySelector('td:last-child');
        if (canRestoreBackups && actionsCell) {
            const restoreBtn = document.createElement('button');
            restoreBtn.className = 'btn btn-sm btn-secondary';
            restoreBtn.textContent = '↻';
            restoreBtn.type = 'button';
            restoreBtn.title = 'استعادة';
            restoreBtn.setAttribute('data-backup-path', backup.backupPath);
            restoreBtn.addEventListener('click', () => restoreSpecificBackup(backup.backupPath));
            actionsCell.appendChild(restoreBtn);
        }
        
        tbody.appendChild(row);
    });
}

// Restore Specific Backup
async function restoreSpecificBackup(backupPath) {
    showConfirmDialog(
        '⚠️ تحذير: استعادة هذه النسخة الاحتياطية ستحذف جميع البيانات الحالية!\nهل أنت متأكد من الاستمرار؟',
        () => {
            // User confirmed - proceed with restore
            proceedWithSpecificRestore(backupPath);
        },
        () => {
            // User cancelled - do nothing
        }
    );
}

// Proceed with specific restore after confirmation
async function proceedWithSpecificRestore(backupPath) {
    try {
        if (!backupPath || typeof backupPath !== 'string') {
            if (window.showToast) {
                window.showToast('مسار النسخة الاحتياطية غير صحيح', 'error');
            }
            return;
        }
        
        // Check if electronAPI is available
        if (!window.electronAPI || !window.electronAPI.backupRestore) {
            if (window.showToast) {
                window.showToast('واجهة البرنامج غير متاحة. يرجى إعادة تشغيل البرنامج.', 'error');
            }
            return;
        }
        
        // Disable restore button to prevent multiple clicks
        const restoreBtns = document.querySelectorAll('[data-backup-path]');
        restoreBtns.forEach(btn => {
            btn.disabled = true;
            btn.textContent = 'جارٍ الاستعادة...';
        });
        
        // Call restore with specific backup path
        const result = await window.electronAPI.backupRestore(backupPath);
        
        // Re-enable buttons
        restoreBtns.forEach(btn => {
            btn.disabled = false;
            btn.textContent = '↻';
        });
        
        if (result.success) {
            if (window.showToast) {
                window.showToast('تم استعادة النسخة الاحتياطية بنجاح! سيتم إعادة تحميل الصفحة...', 'success');
            }
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else if (result.cancelled) {
            // User cancelled, do nothing
        } else {
            if (window.showToast) {
                window.showToast(`فشل استعادة النسخة الاحتياطية: ${result.error || 'خطأ غير معروف'}`, 'error');
            }
        }
    } catch (error) {
        console.error('Error restoring specific backup:', error);
        
        // Re-enable buttons
        const restoreBtns = document.querySelectorAll('[data-backup-path]');
        restoreBtns.forEach(btn => {
            btn.disabled = false;
            btn.textContent = '↻';
        });
        
        if (window.showToast) {
            window.showToast('حدث خطأ أثناء استعادة النسخة الاحتياطية: ' + (error.message || error), 'error');
        }
    }
}

// Load Auto Backup Settings
async function loadAutoBackupSettings() {
    try {
        const result = await window.electronAPI.backupGetAutoSettings();
        
        if (result.success) {
            const settings = result.settings || {};
            
            document.getElementById('autoBackupEnabled').checked = settings.enabled || false;
            document.getElementById('backupPath').value = settings.path || '';
            document.getElementById('backupInterval').value = settings.interval || 'daily';

            // Show/hide settings based on enabled state
            const pathGroup = document.getElementById('autoBackupPathGroup');
            const intervalGroup = document.getElementById('autoBackupIntervalGroup');
            if (settings.enabled) {
                pathGroup.style.display = 'block';
                intervalGroup.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Error loading auto backup settings:', error);
    }
}

// Save Auto Backup Settings
async function saveAutoBackupSettings() {
    try {
        const enabled = document.getElementById('autoBackupEnabled').checked;
        const path = document.getElementById('backupPath').value;
        const interval = document.getElementById('backupInterval').value;

        if (enabled && !path) {
            if (window.showToast) {
                window.showToast('يرجى اختيار مجلد حفظ النسخ الاحتياطية أولاً', 'error');
            }
            return;
        }

        const settings = {
            enabled: enabled,
            path: path,
            interval: interval || 'daily'
        };
        
        // Send settings to main process
        const result = await window.electronAPI.backupSetAutoSettings(settings);
        
        if (result.success) {
            const intervalText = interval === 'daily' ? 'يومي' : interval === 'weekly' ? 'أسبوعي' : 'شهري';
            if (window.showToast) {
                window.showToast(`تم حفظ الإعدادات بنجاح! سيتم إنشاء نسخة احتياطية تلقائياً (${intervalText}) عند إغلاق البرنامج حسب الفترة المحددة.`, 'success');
            }
        } else {
            if (window.showToast) {
                window.showToast('فشل حفظ الإعدادات: ' + (result.error || 'خطأ غير معروف'), 'error');
            }
        }
    } catch (error) {
        console.error('Error saving auto backup settings:', error);
        if (window.showToast) {
            window.showToast('حدث خطأ أثناء حفظ الإعدادات: ' + error.message, 'error');
        }
    }
}

// Format File Size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

