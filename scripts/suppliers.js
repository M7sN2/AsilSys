// Suppliers Management System

// Storage Keys
const STORAGE_KEYS = {
    SUPPLIERS: 'asel_suppliers',
    SUPPLIER_COUNTER: 'asel_supplier_counter',
    PAYMENT_VOUCHERS: 'asel_payment_vouchers'
};

// Format numbers using Eastern Arabic numerals (٠١٢٣٤٥٦٧٨٩)
function formatArabicNumber(number, decimals = 2) {
    if (number === null || number === undefined || isNaN(number)) {
        number = 0;
    }
    
    const num = parseFloat(number);
    const formatted = num.toFixed(decimals);
    
    // Split into integer and decimal parts
    const parts = formatted.split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1] || '';
    
    // Add thousands separator (٬)
    let integerWithSeparator = '';
    for (let i = integerPart.length - 1, j = 0; i >= 0; i--, j++) {
        if (j > 0 && j % 3 === 0) {
            integerWithSeparator = '٬' + integerWithSeparator;
        }
        integerWithSeparator = integerPart[i] + integerWithSeparator;
    }
    
    // Combine with decimal separator (٫)
    const result = decimalPart 
        ? integerWithSeparator + '٫' + decimalPart
        : integerWithSeparator;
    
    // Convert to Eastern Arabic numerals
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return result.replace(/\d/g, (digit) => arabicDigits[parseInt(digit)]);
}

// Format currency with Arabic numerals
function formatArabicCurrency(amount, currency = 'ج.م', decimals = 2) {
    return formatArabicNumber(amount, decimals) + ' ' + currency;
}

// Format phone number with Arabic numerals
function formatArabicPhone(phone) {
    if (!phone || phone === '-') return phone || '-';
    // Remove any non-digit characters except + and spaces
    const cleaned = phone.replace(/[^\d+\s]/g, '');
    // Convert digits to Arabic numerals
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return cleaned.replace(/\d/g, (digit) => arabicDigits[parseInt(digit)]);
}

// Initialize
let suppliers = [];
let invoices = [];

// Pagination & Filter State
let currentPage = 1;
const itemsPerPage = 20;
let filteredSuppliers = [];

// Load data on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    initializeEventListeners();
    await recalculateAllSupplierBalances();
    applyFilters();
    await checkInactiveSuppliers();
    
    // Retry event listeners if button wasn't found initially
    setTimeout(() => {
        const addSupplierBtn = document.getElementById('addSupplierBtn');
        if (addSupplierBtn && !addSupplierBtn.hasAttribute('data-listener-attached')) {
            console.log('Retrying to attach addSupplierBtn listener');
            addSupplierBtn.setAttribute('data-listener-attached', 'true');
            addSupplierBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                    await openAddModal();
                } catch (error) {
                    console.error('Error opening add supplier modal:', error);
                    alert('حدث خطأ أثناء فتح النافذة. يرجى المحاولة مرة أخرى.');
                }
            });
        }
    }, 500);
    
    // Check inactive suppliers every hour
    setInterval(async () => {
        await checkInactiveSuppliers();
    }, 3600000); // 1 hour
});

// Initialize Event Listeners
function initializeEventListeners() {
    // Add Supplier Button
    const addSupplierBtn = document.getElementById('addSupplierBtn');
    if (addSupplierBtn) {
        addSupplierBtn.setAttribute('data-listener-attached', 'true');
        addSupplierBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
                await openAddModal();
            } catch (error) {
                console.error('Error opening add supplier modal:', error);
                alert('حدث خطأ أثناء فتح النافذة. يرجى المحاولة مرة أخرى.');
            }
        });
    } else {
        console.error('addSupplierBtn not found!');
    }
    
    // Empty state button
    const emptyStateBtn = document.getElementById('emptyStateAddBtn');
    if (emptyStateBtn) {
        emptyStateBtn.addEventListener('click', () => {
            if (addSupplierBtn) {
                addSupplierBtn.click();
            }
        });
    }

    // Modal Close Buttons
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('closeDetailsModal').addEventListener('click', closeDetailsModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);

    // Form Submit
    document.getElementById('supplierForm').addEventListener('submit', handleFormSubmit);

    // Search and Filters
    document.getElementById('searchInput').addEventListener('input', () => {
        currentPage = 1;
        applyFilters();
    });
    document.getElementById('statusFilter').addEventListener('change', () => {
        currentPage = 1;
        applyFilters();
    });
    document.getElementById('balanceFilter').addEventListener('change', () => {
        currentPage = 1;
        applyFilters();
    });

    // Pagination Event Listeners
    document.getElementById('prevPageBtn').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            applyFilters();
        }
    });
    
    document.getElementById('nextPageBtn').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            applyFilters();
        }
    });

    // Close modal on backdrop click
    document.getElementById('supplierModal').addEventListener('click', (e) => {
        if (e.target.id === 'supplierModal') {
            closeModal();
        }
    });

    document.getElementById('detailsModal').addEventListener('click', (e) => {
        if (e.target.id === 'detailsModal') {
            closeDetailsModal();
        }
    });
}

// Load Data from Database
async function loadData() {
    // Try to load from database first
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            suppliers = await window.electronAPI.dbGetAll('suppliers', '', []);
            // Don't load all invoices on startup - load only when needed (for performance on weak devices)
            // Invoices will be loaded on demand when viewing supplier details
            invoices = [];
            
            // Ensure arrays
            suppliers = Array.isArray(suppliers) ? suppliers : [];
            invoices = Array.isArray(invoices) ? invoices : [];
            
            return;
        } catch (error) {
            console.error('Error loading from database:', error);
        }
    }
    
    // Fallback to localStorage (for migration only)
    const suppliersData = localStorage.getItem(STORAGE_KEYS.SUPPLIERS);
    const invoicesData = localStorage.getItem('asel_purchase_invoices') || '[]';
    
    suppliers = suppliersData ? JSON.parse(suppliersData) : [];
    invoices = invoicesData ? JSON.parse(invoicesData) : [];
}

// Save Data to Database
async function saveSuppliers() {
    // Save to localStorage as backup only
    localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(suppliers));
    
    // Suppliers are saved individually in handleFormSubmit
    // This function is kept for backward compatibility
}

// Generate Supplier Code
async function generateSupplierCode() {
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            // Get all suppliers to find highest counter
            const allSuppliers = await window.electronAPI.dbGetAll('suppliers', '', []);
            const codes = allSuppliers.map(s => s.code).filter(code => code && code.startsWith('SUPP-'));
            const numbers = codes.map(code => {
                const match = code.match(/SUPP-(\d+)/);
                return match ? parseInt(match[1]) : 0;
            });
            const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
            const counter = maxNumber + 1;
            
            // Format: SUPP-00001
            return `SUPP-${String(counter).padStart(5, '0')}`;
        } catch (error) {
            console.error('Error generating supplier code:', error);
        }
    }
    
    // Fallback to localStorage
    let counter = parseInt(localStorage.getItem(STORAGE_KEYS.SUPPLIER_COUNTER) || '0');
    counter++;
    localStorage.setItem(STORAGE_KEYS.SUPPLIER_COUNTER, counter.toString());
    
    // Format: SUPP-00001
    return `SUPP-${String(counter).padStart(5, '0')}`;
}

// Recalculate all supplier balances from invoices
async function recalculateAllSupplierBalances() {
    for (const supplier of suppliers) {
        await recalculateSupplierBalanceFromInvoices(supplier.id);
    }
    await saveSuppliers();
}

// Update Supplier First Transaction Date
async function updateSupplierFirstTransactionDate(supplierId) {
    if (!window.electronAPI || !window.electronAPI.dbGet || !window.electronAPI.dbUpdate) return;
    
    try {
        const supplier = await window.electronAPI.dbGet('suppliers', supplierId);
        if (!supplier) return;
        
        // Get all invoices and payments for this supplier
        let supplierInvoices = [];
        let supplierPayments = [];
        
        try {
            supplierInvoices = await window.electronAPI.dbGetAll('purchase_invoices', 'supplierId = ?', [supplierId]);
            supplierPayments = await window.electronAPI.dbGetAll('payments', 'supplierId = ?', [supplierId]);
        } catch (error) {
            console.error('Error loading transactions for supplier:', error);
            return;
        }
        
        // Combine all transactions with their dates
        const allTransactions = [];
        supplierInvoices.forEach(inv => {
            if (inv.date) allTransactions.push({ date: inv.date, type: 'invoice' });
        });
        supplierPayments.forEach(pay => {
            if (pay.date) allTransactions.push({ date: pay.date, type: 'payment' });
        });
        
        // Find the earliest transaction date
        if (allTransactions.length > 0) {
            const sortedTransactions = allTransactions.sort((a, b) => 
                new Date(a.date) - new Date(b.date)
            );
            const firstTransactionDate = sortedTransactions[0].date;
            
            // Update firstTransactionDate if it's different or doesn't exist
            if (!supplier.firstTransactionDate || supplier.firstTransactionDate !== firstTransactionDate) {
                await window.electronAPI.dbUpdate('suppliers', supplierId, {
                    ...supplier,
                    firstTransactionDate: firstTransactionDate
                });
                
                // Update local array
                const localSupplier = suppliers.find(s => s.id === supplierId);
                if (localSupplier) {
                    localSupplier.firstTransactionDate = firstTransactionDate;
                }
            }
        }
    } catch (error) {
        console.error('Error updating supplier first transaction date:', error);
    }
}

// Recalculate supplier balance from invoices and payments
async function recalculateSupplierBalanceFromInvoices(supplierId) {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return;
    
    try {
        // Get all purchase invoices for this supplier from database
        let supplierInvoices = [];
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            // Purchase invoices don't have status, they all affect balance
            supplierInvoices = await window.electronAPI.dbGetAll('purchase_invoices', 'supplierId = ?', [supplierId]);
        } else {
            // Fallback to local array
            supplierInvoices = invoices.filter(inv => inv.supplierId === supplierId);
        }
        
        // Get all payments for this supplier from database
        let supplierPayments = [];
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            supplierPayments = await window.electronAPI.dbGetAll('payments', 'supplierId = ?', [supplierId]);
        }
        
        // Get all returns to this supplier from database
        let supplierReturns = [];
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            supplierReturns = await window.electronAPI.dbGetAll('returns', 'returnType = ? AND entityId = ?', ['to_supplier', supplierId]);
        }
        
        // Get current balance (should not recalculate - balance is updated directly by transactions)
        // This function is kept for backward compatibility but should not be used for normal operations
        // Balance is now updated directly: balance = currentBalance + invoiceRemaining (for new invoice)
        // or balance = currentBalance + (newRemaining - oldRemaining) (for edit)
        // For payments: balance = currentBalance - paymentAmount
        // For returns: balance = currentBalance - returnAmount
        // الرصيد في قاعدة البيانات محفوظ بالجنيه المصري مباشرة
        const balance = parseFloat(supplier.balance || 0);
        supplier.balance = balance;
        
        // Update last transaction date (from invoices, payments, or returns, whichever is latest)
        let latestDate = null;
        if (supplierInvoices.length > 0) {
            const latestInvoice = supplierInvoices.sort((a, b) => 
                new Date(b.date) - new Date(a.date)
            )[0];
            latestDate = latestInvoice.date;
        }
        if (supplierPayments.length > 0) {
            const latestPayment = supplierPayments.sort((a, b) => 
                new Date(b.date) - new Date(a.date)
            )[0];
            if (!latestDate || new Date(latestPayment.date) > new Date(latestDate)) {
                latestDate = latestPayment.date;
            }
        }
        if (supplierReturns.length > 0) {
            const latestReturn = supplierReturns.sort((a, b) => 
                new Date(b.date) - new Date(a.date)
            )[0];
            if (!latestDate || new Date(latestReturn.date) > new Date(latestDate)) {
                latestDate = latestReturn.date;
            }
        }
        if (latestDate) {
            supplier.lastTransactionDate = latestDate;
        }
        
        // Update first transaction date
        await updateSupplierFirstTransactionDate(supplierId);
        
        // Update supplier in database
        if (window.electronAPI && window.electronAPI.dbUpdate) {
            await window.electronAPI.dbUpdate('suppliers', supplierId, supplier);
        }
        
        console.log(`[Suppliers] Balance for supplier ${supplier.name}: ${balance}`);
    } catch (error) {
        console.error('Error recalculating supplier balance:', error);
    }
}

// Open Add Modal
async function openAddModal() {
    const modal = document.getElementById('supplierModal');
    const form = document.getElementById('supplierForm');
    const title = document.getElementById('modalTitle');

    // Reset form
    form.reset();
    document.getElementById('isEdit').value = 'false';
    document.getElementById('supplierId').value = '';
    title.textContent = 'إضافة مورد جديد';
    
    // Generate supplier code
    const code = await generateSupplierCode();
    document.getElementById('supplierCode').value = code;
    
    // Enable and reset current balance field for new suppliers
    const currentBalanceField = document.getElementById('currentBalance');
    if (currentBalanceField) {
        currentBalanceField.removeAttribute('readonly');
        currentBalanceField.value = '0';
        currentBalanceField.style.background = '';
        const helpText = document.getElementById('currentBalanceHelp');
        if (helpText) {
            helpText.textContent = 'يمكن إدخاله عند إنشاء المورد فقط. بعد ذلك يتم تحديثه تلقائياً من فواتير المشتريات وسندات الصرف. (بالجنيه المصري)';
        }
    }
    
    // Show modal
    modal.classList.add('active');
    
    // Ensure focus is restored after opening modal
    setTimeout(() => {
        window.focus();
        const supplierNameInput = document.getElementById('supplierName');
        if (supplierNameInput) {
            setTimeout(() => {
                supplierNameInput.focus();
            }, 50);
        }
    }, 100);
}

// Open Edit Modal
function openEditModal(supplierId) {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return;

    const modal = document.getElementById('supplierModal');
    const form = document.getElementById('supplierForm');
    const title = document.getElementById('modalTitle');

    // Fill form with supplier data
    document.getElementById('supplierId').value = supplier.id;
    document.getElementById('isEdit').value = 'true';
    document.getElementById('supplierCode').value = supplier.code;
    document.getElementById('supplierName').value = supplier.name;
    document.getElementById('phone').value = supplier.phone || '';
    document.getElementById('address').value = supplier.address || '';
    document.getElementById('notes').value = supplier.notes || '';
    
    // Set current balance (read-only for existing suppliers)
    const currentBalanceField = document.getElementById('currentBalance');
    if (currentBalanceField) {
        // الرصيد في قاعدة البيانات محفوظ بالجنيه المصري مباشرة
        const balance = parseFloat(supplier.balance) || 0;
        currentBalanceField.value = balance;
        currentBalanceField.setAttribute('readonly', 'readonly');
        currentBalanceField.style.background = '#f5f5f5';
        const helpText = document.getElementById('currentBalanceHelp');
        if (helpText) {
            helpText.textContent = 'لا يمكن تعديل الرصيد الحالي بعد إنشاء المورد. يتم تحديثه تلقائياً من فواتير المشتريات وسندات الصرف';
        }
    }
    document.getElementById('status').value = supplier.status || 'active';
    
    title.textContent = 'تعديل المورد';
    
    // Show modal
    modal.classList.add('active');
}

// Close Modal
function closeModal() {
    document.getElementById('supplierModal').classList.remove('active');
    // Ensure focus is restored after closing modal
    setTimeout(() => {
        const activeElement = document.activeElement;
        if (activeElement && activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') {
            activeElement.blur();
        }
        // Force focus on window to restore input capabilities
        window.focus();
    }, 100);
}

function closeDetailsModal() {
    document.getElementById('detailsModal').classList.remove('active');
}

// Handle Form Submit
async function handleFormSubmit(e) {
    e.preventDefault();

    const isEdit = document.getElementById('isEdit').value === 'true';
    const supplierId = document.getElementById('supplierId').value;

    const notes = document.getElementById('notes').value.trim() || '';
    
    let supplierData = {
        code: document.getElementById('supplierCode').value,
        name: document.getElementById('supplierName').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        address: document.getElementById('address').value.trim(),
        notes: notes,
        status: document.getElementById('status').value || 'active',
        lastTransactionDate: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    // Validate name is not empty
    if (!supplierData.name) {
        showMessage('يرجى إدخال اسم المورد', 'error');
        return;
    }

    try {
        // Check for duplicate name (case-insensitive)
        // Check in local array first
        const duplicateSupplier = suppliers.find(s => 
            s.name.toLowerCase().trim() === supplierData.name.toLowerCase().trim() && 
            s.id !== supplierId
        );
        
        if (duplicateSupplier) {
            showMessage('يوجد مورد آخر بنفس الاسم. يرجى اختيار اسم مختلف', 'error');
            return;
        }
        
        // Also check in database to ensure no duplicates
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            try {
                const allSuppliers = await window.electronAPI.dbGetAll('suppliers', '', []);
                const dbDuplicate = Array.isArray(allSuppliers) ? allSuppliers.find(s => 
                    s && s.id !== supplierId && 
                    s.name && s.name.toLowerCase().trim() === supplierData.name.toLowerCase().trim()
                ) : null;
                if (dbDuplicate) {
                    showMessage('يوجد مورد آخر بنفس الاسم. يرجى اختيار اسم مختلف', 'error');
                    return;
                }
            } catch (dbErr) {
                console.error('Error checking database for duplicate supplier:', dbErr);
                // Continue with local check only if database check fails
            }
        }

        if (isEdit) {
            // Edit existing supplier
            const existingSupplier = suppliers.find(s => s.id === supplierId);
            if (!existingSupplier) {
                showMessage('المورد غير موجود', 'error');
                return;
            }
            
            supplierData.id = existingSupplier.id;
            supplierData.firstTransactionDate = existingSupplier.firstTransactionDate;
            supplierData.lastTransactionDate = existingSupplier.lastTransactionDate;
            supplierData.createdAt = existingSupplier.createdAt;
            // Preserve balance (don't update it when editing, updated by transactions)
            supplierData.balance = existingSupplier.balance || 0;
            
            // Update in database
            if (window.electronAPI && window.electronAPI.dbUpdate) {
                const updateResult = await window.electronAPI.dbUpdate('suppliers', supplierId, supplierData);
                
                // Check if update was successful
                if (!updateResult || !updateResult.success) {
                    const errorMsg = updateResult?.error || 'خطأ غير معروف';
                    console.error('Failed to update supplier in database:', errorMsg);
                    showMessage('فشل تحديث المورد في قاعدة البيانات: ' + errorMsg, 'error');
                    return; // Don't continue if database update failed
                }
            } else {
                console.warn('Database API not available, updating localStorage only');
                showMessage('تحذير: قاعدة البيانات غير متاحة، تم التحديث في الذاكرة المحلية فقط', 'warning');
            }
            
            // Update local array only after successful database update
            const index = suppliers.findIndex(s => s.id === supplierId);
            if (index !== -1) {
                suppliers[index] = supplierData;
            }
            
            // Recalculate balance from invoices after editing supplier
            await recalculateSupplierBalanceFromInvoices(supplierId);
        } else {
        // Add new supplier
            // Get current balance from form (only for new suppliers) - الرصيد الافتتاحي (بالجنيه المصري)
            const currentBalance = parseFloat(document.getElementById('currentBalance').value) || 0;
            // الرصيد يُحفظ بالجنيه المصري مباشرة في قاعدة البيانات
            const openingBalance = currentBalance;
            
            // Check if supplier with same name already exists
            // Check in local array first
            const duplicateSupplier = suppliers.find(s => 
                s.name.toLowerCase().trim() === supplierData.name.toLowerCase().trim()
            );
            if (duplicateSupplier) {
                showMessage('يوجد مورد آخر بنفس الاسم. يرجى اختيار اسم مختلف', 'error');
                return;
            }
            
            // Also check in database to ensure no duplicates
            if (window.electronAPI && window.electronAPI.dbGetAll) {
                try {
                    const allSuppliers = await window.electronAPI.dbGetAll('suppliers', '', []);
                    const dbDuplicate = Array.isArray(allSuppliers) ? allSuppliers.find(s => 
                        s && s.name && s.name.toLowerCase().trim() === supplierData.name.toLowerCase().trim()
                    ) : null;
                    if (dbDuplicate) {
                        showMessage('يوجد مورد آخر بنفس الاسم. يرجى اختيار اسم مختلف', 'error');
                        return;
                    }
                } catch (dbErr) {
                    console.error('Error checking database for duplicate supplier:', dbErr);
                    // Continue with local check only if database check fails
                }
            }
            
            supplierData.id = Date.now().toString();
            // حفظ الرصيد الافتتاحي (في سنتات)
            supplierData.balance = openingBalance; // Set initial balance to opening balance from form
            supplierData.firstTransactionDate = null; // Will be set when first transaction occurs
            
            // Insert in database
            if (window.electronAPI && window.electronAPI.dbInsert) {
                // Add createdBy to track who created this supplier
                if (!supplierData.createdBy) {
                    if (typeof addCreatedBy === 'function') {
                        addCreatedBy(supplierData);
                    } else {
                        const currentUser = localStorage.getItem('asel_user') || localStorage.getItem('asel_userId') || '';
                        if (currentUser) {
                            supplierData.createdBy = currentUser;
                        }
                    }
                }
                
                const insertResult = await window.electronAPI.dbInsert('suppliers', supplierData);
                
                // Check if insert was successful
                if (!insertResult || !insertResult.success) {
                    const errorMsg = insertResult?.error || 'خطأ غير معروف';
                    console.error('Failed to insert supplier to database:', errorMsg);
                    showMessage('فشل حفظ المورد في قاعدة البيانات: ' + errorMsg, 'error');
                    return; // Don't continue if database insert failed
                }
                
                // Verify supplier was actually saved
                try {
                    const savedSupplier = await window.electronAPI.dbGet('suppliers', supplierData.id);
                    if (!savedSupplier) {
                        console.warn('Warning: Supplier insert returned success but supplier not found in database');
                        showMessage('تحذير: لم يتم التحقق من حفظ المورد في قاعدة البيانات', 'warning');
                    }
                } catch (verifyError) {
                    console.error('Error verifying supplier save:', verifyError);
                }
            } else {
                console.warn('Database API not available, saving to localStorage only');
                showMessage('تحذير: قاعدة البيانات غير متاحة، تم الحفظ في الذاكرة المحلية فقط', 'warning');
            }
            
            // Don't add to local array here - we'll reload all suppliers from database after
            // This ensures we have the latest balance after opening balance invoice creation
        }
        
        // Reload ALL suppliers from database to ensure latest balance is displayed
        // This is critical after creating opening balance invoice
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            try {
                const allSuppliers = await window.electronAPI.dbGetAll('suppliers', '', []);
                if (allSuppliers && Array.isArray(allSuppliers)) {
                    suppliers = allSuppliers;
                    await saveSuppliers();
                    
                    // Log the balance of the newly created supplier for debugging
                    if (supplierData && supplierData.id && !isEdit) {
                        const createdSupplier = suppliers.find(s => s.id === supplierData.id);
                        if (createdSupplier) {
                            console.log(`[Suppliers] Reloaded supplier ${createdSupplier.name} with balance: ${createdSupplier.balance}`);
                        } else {
                            console.warn(`[Suppliers] Supplier ${supplierData.id} not found after reload`);
                        }
                    }
                    
                    console.log('[Suppliers] Reloaded all suppliers from database, total:', suppliers.length);
                }
            } catch (reloadError) {
                console.error('Error reloading suppliers from database:', reloadError);
                // Fallback: add supplierData to local array if reload fails
                if (supplierData && !isEdit) {
                    suppliers.push(supplierData);
                }
            }
        } else {
            // Fallback: add to local array if database API not available
            if (supplierData && !isEdit) {
                suppliers.push(supplierData);
            }
        }
        
        // Save to localStorage as backup
        await saveSuppliers();
        
        // Force table refresh
        currentPage = 1;
        applyFilters();
        closeModal();
        
        // Show success message
        showMessage('تم حفظ المورد بنجاح', 'success');
    } catch (error) {
        console.error('Error saving supplier:', error);
        showMessage('خطأ في حفظ المورد: ' + error.message, 'error');
    }
}

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
        <h2 style="margin: 0; font-size: 1.25rem;">تأكيد الحذف</h2>
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
    confirmBtn.textContent = 'حذف';
    
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
    closeBtn.addEventListener('click', () => {
        modal.remove();
        if (onCancel) onCancel();
    });
    
    // Cancel button handler
    cancelBtn.addEventListener('click', () => {
        modal.remove();
        if (onCancel) onCancel();
    });
    
    // Confirm button handler
    confirmBtn.addEventListener('click', () => {
        modal.remove();
        if (onConfirm) onConfirm();
    });
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
            if (onCancel) onCancel();
        }
    });
    
    // Focus on confirm button
    setTimeout(() => {
        confirmBtn.focus();
    }, 100);
}

// Delete Supplier
async function deleteSupplier(supplierId) {
    try {
        // Check if supplier has invoices or balance > 0
        if (window.electronAPI && window.electronAPI.dbGetAll && window.electronAPI.dbGet) {
            // Get supplier
            const supplier = await window.electronAPI.dbGet('suppliers', supplierId);
            
            if (!supplier) {
                showMessage('المورد غير موجود', 'error');
                return;
            }
            
            // Check supplier balance
            const supplierBalance = parseFloat(supplier.balance) || 0;
            
            // Check for purchase invoices
            const supplierInvoices = await window.electronAPI.dbGetAll('purchase_invoices', 'supplierId = ?', [supplierId]);
            
            // Check for payments
            const supplierPayments = await window.electronAPI.dbGetAll('payments', 'supplierId = ?', [supplierId]);
            
            // If supplier has balance, invoices, or payments, prevent deletion
            if (supplierBalance > 0 || supplierInvoices.length > 0 || supplierPayments.length > 0) {
                showMessage('لا يمكن حذف هذا المورد. يرجى حذف سندات الصرف والفواتير المرتبطة به', 'error');
                return;
            }
        }
        
        // Use custom confirmation dialog instead of confirm()
        showConfirmDialog(
            'هل أنت متأكد من حذف هذا المورد؟',
            () => {
                // User confirmed - proceed with deletion
                proceedWithSupplierDeletion(supplierId);
            },
            () => {
                // User cancelled - do nothing
            }
        );
    } catch (error) {
        console.error('Error deleting supplier:', error);
        showMessage('خطأ في حذف المورد: ' + error.message, 'error');
    }
}

// Proceed with supplier deletion
async function proceedWithSupplierDeletion(supplierId) {
    try {
        // Delete from database
        if (window.electronAPI && window.electronAPI.dbDelete) {
            await window.electronAPI.dbDelete('suppliers', supplierId);
        }
        
        // Remove from local array
        suppliers = suppliers.filter(s => s.id !== supplierId);
        await saveSuppliers();
        currentPage = 1;
        applyFilters();
        showMessage('تم حذف المورد بنجاح', 'success');
    } catch (error) {
        console.error('Error deleting supplier:', error);
        showMessage('خطأ في حذف المورد: ' + error.message, 'error');
    }
}

// View Supplier Details
function viewSupplierDetails(supplierId) {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return;

    const detailsHtml = `
        <div class="detail-row">
            <div class="detail-label">كود المورد:</div>
            <div class="detail-value">${supplier.code}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">اسم المورد:</div>
            <div class="detail-value">${supplier.name}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">رقم التلفون:</div>
            <div class="detail-value detail-value-emphasized">${supplier.phone ? formatArabicPhone(supplier.phone) : 'غير محدد'}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">العنوان:</div>
            <div class="detail-value detail-value-emphasized">${supplier.address || 'غير محدد'}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">الرصيد الحالي:</div>
            <div class="detail-value ${(supplier.balance || 0) >= 0 ? 'balance-positive' : 'balance-negative'}">
                ${formatArabicCurrency(supplier.balance || 0)}
            </div>
        </div>
        <div class="detail-row">
            <div class="detail-label">تاريخ أول تعامل:</div>
            <div class="detail-value">${supplier.firstTransactionDate ? new Date(supplier.firstTransactionDate).toLocaleDateString('ar-EG') : 'لم يحدث تعامل بعد'}</div>
        </div>
        ${supplier.lastTransactionDate ? `
        <div class="detail-row">
            <div class="detail-label">تاريخ آخر تعامل:</div>
            <div class="detail-value">${new Date(supplier.lastTransactionDate).toLocaleDateString('ar-EG')}</div>
        </div>
        ` : ''}
        <div class="detail-row">
            <div class="detail-label">الحالة:</div>
            <div class="detail-value">
                <span class="status-badge ${supplier.status}">${supplier.status === 'active' ? 'نشط' : 'غير نشط'}</span>
            </div>
        </div>
        <div class="detail-row">
            <div class="detail-label">تاريخ الإنشاء:</div>
            <div class="detail-value">${new Date(supplier.createdAt).toLocaleDateString('ar-EG')}</div>
        </div>
        ${supplier.notes ? `
        <div class="detail-row">
            <div class="detail-label">ملاحظات:</div>
            <div class="detail-value">${supplier.notes}</div>
        </div>
        ` : ''}
    `;

    document.getElementById('supplierDetails').innerHTML = detailsHtml;
    document.getElementById('detailsModal').classList.add('active');
}

// Render Suppliers Table
// Apply Filters
function applyFilters() {
    // Get filters
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    const balanceFilter = document.getElementById('balanceFilter').value;

    // Filter suppliers
    filteredSuppliers = suppliers.filter(supplier => {
        const matchSearch = !searchTerm || 
            supplier.name.toLowerCase().includes(searchTerm) ||
            supplier.code.toLowerCase().includes(searchTerm) ||
            (supplier.phone && supplier.phone.includes(searchTerm));
        
        const matchStatus = !statusFilter || supplier.status === statusFilter;

        // Balance filter
        let matchBalance = true;
        if (balanceFilter) {
            const balance = parseFloat(supplier.balance) || 0;
            switch (balanceFilter) {
                case 'high':
                    matchBalance = balance > 10000;
                    break;
                case 'medium':
                    matchBalance = balance > 5000 && balance <= 10000;
                    break;
                case 'low':
                    matchBalance = balance > 0 && balance <= 5000;
                    break;
                case 'zero':
                    matchBalance = balance === 0;
                    break;
                case 'negative':
                    matchBalance = balance < 0;
                    break;
            }
        }

        return matchSearch && matchStatus && matchBalance;
    });

    // Render paginated suppliers
    currentPage = 1;
    renderSuppliers();
}

function renderSuppliers() {
    const tbody = document.getElementById('suppliersTableBody');
    const emptyState = document.getElementById('emptyState');
    const paginationContainer = document.getElementById('paginationContainer');
    
    // Clear table
    tbody.innerHTML = '';

    if (filteredSuppliers.length === 0) {
        emptyState.classList.remove('hidden');
        paginationContainer.classList.add('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    paginationContainer.classList.remove('hidden');

    // Calculate pagination
    const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredSuppliers.length);
    const paginatedSuppliers = filteredSuppliers.slice(startIndex, endIndex);
    
    // Get current logged-in user type
    const currentUserType = localStorage.getItem('asel_userType') || '';
    const canDeleteSuppliers = currentUserType === 'manager' || currentUserType === 'system_engineer';
    
    // Update pagination info
    document.getElementById('paginationInfo').textContent = 
        `عرض ${startIndex + 1} - ${endIndex} من ${filteredSuppliers.length}`;
    
    // Update pagination buttons
    document.getElementById('prevPageBtn').disabled = currentPage === 1;
    document.getElementById('nextPageBtn').disabled = currentPage >= totalPages;
    
    // Render page numbers
    const pageNumbersEl = document.getElementById('pageNumbers');
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
            applyFilters();
        });
        pageNumbersEl.appendChild(pageBtn);
    }

    // Render suppliers
    paginatedSuppliers.forEach(supplier => {
        const row = document.createElement('tr');
        // الرصيد في قاعدة البيانات محفوظ بالجنيه المصري مباشرة
        const balance = parseFloat(supplier.balance) || 0;
        
        // Determine balance color class based on amount
        let balanceClass = 'balance-zero';
        if (balance > 10000) {
            balanceClass = 'balance-high';
        } else if (balance > 5000) {
            balanceClass = 'balance-medium';
        } else if (balance > 0) {
            balanceClass = 'balance-low';
        } else if (balance < 0) {
            balanceClass = 'balance-negative';
        }
        
        const notesText = supplier.notes ? (supplier.notes.length > 50 ? supplier.notes.substring(0, 50) + '...' : supplier.notes) : '-';
        
        row.innerHTML = `
            <td>${supplier.code}</td>
            <td class="supplier-name-cell"><strong>${supplier.name}</strong></td>
            <td class="phone-cell">${supplier.phone ? formatArabicPhone(supplier.phone) : '-'}</td>
            <td class="address-cell">${supplier.address || '-'}</td>
            <td>${supplier.firstTransactionDate ? new Date(supplier.firstTransactionDate).toLocaleDateString('ar-EG') : '-'}</td>
            <td><span class="balance-text ${balanceClass}">${formatArabicCurrency(balance)}</span></td>
            <td><span class="status-badge ${supplier.status}">${supplier.status === 'active' ? 'نشط' : 'غير نشط'}</span></td>
            <td class="created-by-cell">${supplier.createdBy || '-'}</td>
            <td class="supplier-notes-cell" title="${supplier.notes || ''}">${notesText}</td>
            <td>
                <div class="actions-buttons">
                    <button class="action-btn view" data-supplier-id="${supplier.id}" title="عرض التفاصيل">
                        👁️
                    </button>
                    <button class="action-btn edit" data-supplier-id="${supplier.id}" title="تعديل">
                        ✏️
                    </button>
                </div>
            </td>
        `;
        
        // Add event listeners to buttons
        const viewBtn = row.querySelector('.action-btn.view');
        const editBtn = row.querySelector('.action-btn.edit');
        const actionsDiv = row.querySelector('.actions-buttons');
        
        if (viewBtn) {
            viewBtn.addEventListener('click', () => viewSupplierDetails(supplier.id));
        }
        if (editBtn) {
            editBtn.addEventListener('click', () => openEditModal(supplier.id));
        }
        
        // Add delete button only for manager or system_engineer
        if (canDeleteSuppliers) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'action-btn delete';
            deleteBtn.textContent = '🗑️';
            deleteBtn.type = 'button';
            deleteBtn.title = 'حذف';
            deleteBtn.setAttribute('data-supplier-id', supplier.id);
            deleteBtn.addEventListener('click', () => deleteSupplier(supplier.id));
            if (actionsDiv) {
                actionsDiv.appendChild(deleteBtn);
            }
        }
        
        tbody.appendChild(row);
    });
}

// Check Inactive Suppliers (based on purchase invoices)
async function checkInactiveSuppliers() {
    const now = new Date();
    const fifteenDaysAgo = new Date(now.getTime() - (15 * 24 * 60 * 60 * 1000));

    try {
        // Get purchase invoices from database - only load recent ones (last 30 days) for performance
        let purchaseInvoices = [];
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            // Load only recent invoices (last 30 days) instead of all (for performance on weak devices)
            const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
            const dateStr = thirtyDaysAgo.toISOString().split('T')[0];
            purchaseInvoices = await window.electronAPI.dbGetAll('purchase_invoices', 'date >= ?', [dateStr]) || [];
        } else {
            // Fallback to localStorage
            purchaseInvoices = invoices;
        }

        for (const supplier of suppliers) {
            // Find invoices for this supplier (all purchase invoices affect status)
            const supplierInvoices = purchaseInvoices.filter(invoice => 
                invoice.supplierId === supplier.id
            );

            if (supplierInvoices.length > 0) {
                // Get most recent invoice
                const lastInvoice = supplierInvoices.sort((a, b) => 
                    new Date(b.date) - new Date(a.date)
                )[0];
                
                supplier.lastTransactionDate = lastInvoice.date;
                
                // Check if last invoice was more than 15 days ago
                const lastInvoiceDate = new Date(lastInvoice.date);
                if (lastInvoiceDate < fifteenDaysAgo) {
                    supplier.status = 'inactive';
                } else {
                    supplier.status = 'active';
                }
            } else {
                // No invoices for this supplier
                // Check if supplier was created more than 15 days ago
                const createdDate = new Date(supplier.createdAt);
                if (createdDate < fifteenDaysAgo) {
                    supplier.status = 'inactive';
                }
            }
            
            // Update supplier in database
            if (window.electronAPI && window.electronAPI.dbUpdate) {
                await window.electronAPI.dbUpdate('suppliers', supplier.id, supplier);
            }
        }

        await saveSuppliers();
        applyFilters();
    } catch (error) {
        console.error('Error checking inactive suppliers:', error);
    }
}

// Show Message
// Show Toast Notification (replaces alert() to avoid Electron focus issues)
function showMessage(message, type = 'info') {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Set icon based on type
    const icon = type === 'error' ? '⚠️' : type === 'success' ? '✓' : 'ℹ️';
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;

    // Add toast to container
    toastContainer.appendChild(toast);

    // Show toast with animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Auto-remove toast after 3 seconds (5 seconds for errors)
    const duration = type === 'error' ? 5000 : 3000;
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 300);
    }, duration);

    // Focus on input field if modal is open (no need to wait for alert to close)
    setTimeout(() => {
        const modal = document.querySelector('.modal.active, [class*="modal"].active');
        if (modal) {
            const firstInput = modal.querySelector('input:not([type="hidden"]):not([readonly]), select, textarea');
            if (firstInput && !firstInput.disabled && !firstInput.readOnly) {
                firstInput.focus();
            }
        }
    }, 50);
}

// Make functions global for onclick handlers
window.openEditModal = openEditModal;
window.deleteSupplier = deleteSupplier;
window.viewSupplierDetails = viewSupplierDetails;

