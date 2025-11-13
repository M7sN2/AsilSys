// Receipt Vouchers Management System

const STORAGE_KEYS = {
    RECEIPTS: 'asel_receipt_vouchers',
    CUSTOMERS: 'asel_customers',
    RECEIPT_COUNTER: 'asel_receipt_counter'
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

let receipts = [];
let customers = [];
let isSavingReceipt = false; // Flag to prevent duplicate form submissions

// Pagination & Filter State
let currentPage = 1;
const itemsPerPage = 20;
let filteredReceipts = [];
let searchQuery = '';
let dateFrom = '';
let dateTo = '';
let paymentMethodFilter = '';
let sortBy = 'date-desc';

// Load data on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    initializeEventListeners();
    renderCustomers();
    await applyFilters();
});

// Initialize Event Listeners
function initializeEventListeners() {
    // View Blank Receipt Button
    const viewBlankReceiptBtn = document.getElementById('viewBlankReceiptBtn');
    if (viewBlankReceiptBtn) {
        viewBlankReceiptBtn.addEventListener('click', () => {
            viewBlankProvisionalReceipt();
        });
    }

    // Print Blank Receipt Button
    const printBlankReceiptBtn = document.getElementById('printBlankReceiptBtn');
    if (printBlankReceiptBtn) {
        printBlankReceiptBtn.addEventListener('click', () => {
            printBlankProvisionalReceipt();
        });
    }

    // New Receipt Button
    document.getElementById('newReceiptBtn').addEventListener('click', () => {
        openNewReceipt();
    });
    
    // Empty state button
    const emptyStateBtn = document.getElementById('emptyStateAddBtn');
    if (emptyStateBtn) {
        emptyStateBtn.addEventListener('click', () => {
            document.getElementById('newReceiptBtn').click();
        });
    }

    // Modal Close Buttons
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);

    // Form Submit
    document.getElementById('receiptForm').addEventListener('submit', handleFormSubmit);

    // Customer Selection
    document.getElementById('customerSelect').addEventListener('change', onCustomerChange);

    // Amount Input - Calculate balance
    document.getElementById('amount').addEventListener('input', () => calculateBalance());
    
    // Receipt Date - Recalculate balance when date changes
    document.getElementById('receiptDate').addEventListener('change', () => calculateBalance());

    // Status dropdown - Update visual style based on selection
    const receiptStatusSelect = document.getElementById('receiptStatus');
    if (receiptStatusSelect) {
        receiptStatusSelect.addEventListener('change', function() {
            updateStatusDropdownStyle(this);
        });
        // Initialize style on load
        updateStatusDropdownStyle(receiptStatusSelect);
    }

    // Close modal on backdrop click
    document.getElementById('receiptModal').addEventListener('click', (e) => {
        if (e.target.id === 'receiptModal') {
            closeModal();
        }
    });

    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('receiptDate').value = today;

    // Pagination Event Listeners
    document.getElementById('prevPageBtn').addEventListener('click', async () => {
        if (currentPage > 1) {
            currentPage--;
            await applyFilters();
        }
    });
    
    document.getElementById('nextPageBtn').addEventListener('click', async () => {
        const totalPages = Math.ceil(filteredReceipts.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            await applyFilters();
        }
    });

    // Search & Filter Event Listeners
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const dateFromInput = document.getElementById('dateFrom');
    const dateToInput = document.getElementById('dateTo');
    const paymentMethodFilterSelect = document.getElementById('paymentMethodFilter');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');

    if (searchInput) {
        searchInput.addEventListener('input', async (e) => {
            searchQuery = e.target.value;
            currentPage = 1;
            await applyFilters();
        });
    }

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', async () => {
            if (searchInput) searchInput.value = '';
            searchQuery = '';
            currentPage = 1;
            await applyFilters();
        });
    }

    if (dateFromInput) {
        dateFromInput.addEventListener('change', async (e) => {
            dateFrom = e.target.value;
            currentPage = 1;
            await applyFilters();
        });
    }

    if (dateToInput) {
        dateToInput.addEventListener('change', async (e) => {
            dateTo = e.target.value;
            currentPage = 1;
            await applyFilters();
        });
    }

    if (paymentMethodFilterSelect) {
        paymentMethodFilterSelect.addEventListener('change', async (e) => {
            paymentMethodFilter = e.target.value;
            currentPage = 1;
            await applyFilters();
        });
    }

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', async () => {
            if (searchInput) searchInput.value = '';
            if (dateFromInput) dateFromInput.value = '';
            if (dateToInput) dateToInput.value = '';
            if (paymentMethodFilterSelect) paymentMethodFilterSelect.value = '';
            searchQuery = '';
            dateFrom = '';
            dateTo = '';
            paymentMethodFilter = '';
            currentPage = 1;
            await applyFilters();
        });
    }
}

// Load Data
async function loadData() {
    // Try to load from database first
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            receipts = await window.electronAPI.dbGetAll('receipts', '', []);
            customers = await window.electronAPI.dbGetAll('customers', '', []);
            
            // Ensure arrays
            receipts = Array.isArray(receipts) ? receipts : [];
            customers = Array.isArray(customers) ? customers : [];
            
            return;
        } catch (error) {
            console.error('Error loading from database:', error);
        }
    }
    
    // Fallback to localStorage (for migration only)
    const receiptsData = localStorage.getItem(STORAGE_KEYS.RECEIPTS);
    const customersData = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);

    receipts = receiptsData ? JSON.parse(receiptsData) : [];
    customers = customersData ? JSON.parse(customersData) : [];
}

// Save Receipts
async function saveReceipts() {
    // Save to database if available
    if (window.electronAPI && window.electronAPI.dbInsert && window.electronAPI.dbUpdate) {
        // This function is called after saving individual receipts
        // The actual save happens in handleFormSubmit
        return;
    }
    
    // Fallback to localStorage
    localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify(receipts));
}

// Generate Receipt Number
async function generateReceiptNumber() {
    const year = new Date().getFullYear();
    const prefix = `REC-${year}-`;
    
    // Try to get the highest receipt number from database
    let maxCounter = 0;
    
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            const allReceipts = await window.electronAPI.dbGetAll('receipts', '', []);
            if (Array.isArray(allReceipts) && allReceipts.length > 0) {
                // Find the highest counter for this year
                const yearReceipts = allReceipts.filter(r => 
                    r.receiptNumber && r.receiptNumber.startsWith(prefix)
                );
                
                if (yearReceipts.length > 0) {
                    yearReceipts.forEach(r => {
                        const match = r.receiptNumber.match(new RegExp(`${prefix}(\\d+)`));
                        if (match && match[1]) {
                            const num = parseInt(match[1]);
                            if (num > maxCounter) {
                                maxCounter = num;
                            }
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error getting receipts for number generation:', error);
            // Fallback to localStorage
            maxCounter = parseInt(localStorage.getItem(STORAGE_KEYS.RECEIPT_COUNTER) || '0');
        }
    } else {
        // Fallback to localStorage
        maxCounter = parseInt(localStorage.getItem(STORAGE_KEYS.RECEIPT_COUNTER) || '0');
    }
    
    // Increment counter
    maxCounter++;
    
    // Save to localStorage as backup
    localStorage.setItem(STORAGE_KEYS.RECEIPT_COUNTER, maxCounter.toString());
    
    // Format: REC-2024-001
    return `${prefix}${String(maxCounter).padStart(3, '0')}`;
}

// Render Customers
function renderCustomers() {
    const select = document.getElementById('customerSelect');
    select.innerHTML = '<option value="">اختر العميل</option>';
    
    // Filter out cash customer (عميل نقدي) - code is 'CASH'
    const filteredCustomers = customers.filter(customer => customer.code !== 'CASH');
    
    filteredCustomers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer.id;
        option.textContent = `${customer.name} - ${customer.code}`;
        select.appendChild(option);
    });
}

// Open New Receipt
function openNewReceipt() {
    document.getElementById('isEdit').value = 'false';
    document.getElementById('receiptId').value = '';
    document.getElementById('modalTitle').textContent = 'سند قبض جديد';
    document.getElementById('receiptForm').reset();
    document.getElementById('customerInfo').classList.add('hidden');
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('receiptDate').value = today;
    document.getElementById('paymentMethod').value = 'cash';
    document.getElementById('receiptModal').classList.add('active');
    
    // Ensure focus is restored after opening modal
    setTimeout(() => {
        window.focus();
        // Try to focus on first input field
        const firstInput = document.querySelector('#receiptModal input:not([type="hidden"]), #receiptModal select, #receiptModal textarea');
        if (firstInput) {
            setTimeout(() => {
                firstInput.focus();
            }, 50);
        }
    }, 100);
}

// On Customer Change
async function onCustomerChange() {
    const customerId = document.getElementById('customerSelect').value;
    if (!customerId) {
        document.getElementById('customerInfo').classList.add('hidden');
        return;
    }

    const customer = customers.find(c => c.id === customerId);
    if (customer) {
        await calculateBalance();
        document.getElementById('customerInfo').classList.remove('hidden');
    }
}

// Calculate Balance
async function calculateBalance() {
    const customerId = document.getElementById('customerSelect').value;
    const amount = parseFloat(document.getElementById('amount').value) || 0;
    const isEdit = document.getElementById('isEdit').value === 'true';
    const receiptId = document.getElementById('receiptId').value;

    if (!customerId) return;

    // Reload customer from database to get latest balance (especially after invoices are saved)
    let customer = customers.find(c => c.id === customerId);
    if (customer && window.electronAPI && window.electronAPI.dbGet) {
        try {
            const dbCustomer = await window.electronAPI.dbGet('customers', customerId);
            if (dbCustomer) {
                // Update customer in local array with latest data from database
                const customerIndex = customers.findIndex(c => c.id === customerId);
                if (customerIndex !== -1) {
                    customers[customerIndex] = { ...customers[customerIndex], ...dbCustomer };
                    customer = customers[customerIndex];
                    console.log('[Receipts] calculateBalance - Reloaded customer from database, balance:', customer.balance);
                }
            }
        } catch (error) {
            console.error('[Receipts] Error reloading customer from database in calculateBalance:', error);
            // Continue with local customer data if database reload fails
        }
    }
    
    if (customer) {
        // Use the updated balance from database directly (already reloaded above)
        // الرصيد في قاعدة البيانات محفوظ بالجنيه المصري مباشرة
        let oldBalance = parseFloat(customer.balance || 0);
        
        // If editing existing receipt, add back the old receipt amount to get the balance before this receipt
                if (isEdit && receiptId) {
            try {
                    const oldReceipt = receipts.find(r => r.id === receiptId);
                if (!oldReceipt && window.electronAPI && window.electronAPI.dbGet) {
                    // Try to get from database if not in local array
                    const dbReceipt = await window.electronAPI.dbGet('receipts', receiptId);
                    if (dbReceipt && dbReceipt.customerId === customerId) {
                        // المبلغ في قاعدة البيانات محفوظ بالجنيه المصري مباشرة
                        const oldAmount = parseFloat(dbReceipt.amount || 0);
                        oldBalance = oldBalance + oldAmount;
                        console.log('[Receipts] calculateBalance - Added back old receipt amount for edit:', oldAmount);
                    }
                } else if (oldReceipt && oldReceipt.customerId === customerId) {
                    // المبلغ في قاعدة البيانات محفوظ بالجنيه المصري مباشرة
                    const oldAmount = parseFloat(oldReceipt.amount || 0);
                    oldBalance = oldBalance + oldAmount;
                    console.log('[Receipts] calculateBalance - Added back old receipt amount for edit:', oldAmount);
                }
            } catch (error) {
                console.error('[Receipts] Error getting old receipt in calculateBalance:', error);
                // Continue with current balance if error
            }
        }
        
        // Receipt reduces customer debt (balance)
        const newBalance = oldBalance - amount;

        console.log('[Receipts] calculateBalance - Using updated balance from database:', {
            customerId,
            oldBalance,
            amount,
            newBalance,
            isEdit
        });

        document.getElementById('oldBalance').textContent = `${oldBalance.toFixed(2)} ج.م`;
        document.getElementById('newBalance').textContent = `${newBalance.toFixed(2)} ج.م`;
    }
}

// Handle Form Submit
async function handleFormSubmit(e) {
    e.preventDefault();
    
    // منع الضغط المتكرر
    if (isSavingReceipt) {
        console.log('[Receipts] Save already in progress, ignoring duplicate submit');
        return;
    }
    
    // تعيين حالة الحفظ
    isSavingReceipt = true;
    
    // تعطيل زر الحفظ وتغيير النص
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalButtonText = submitButton ? submitButton.textContent : '';
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'جاري الحفظ...';
    }
    
    try {
        const customerId = document.getElementById('customerSelect').value;
    const date = document.getElementById('receiptDate').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const paymentMethod = document.getElementById('paymentMethod').value;
    const notes = document.getElementById('notes').value.trim();

    if (!customerId) {
        if (window.showToast) {
            window.showToast('يرجى اختيار العميل', 'error');
        } else {
            alert('⚠️ يرجى اختيار العميل');
        }
        isSavingReceipt = false;
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
        return;
    }

    if (!amount || amount <= 0) {
        if (window.showToast) {
            window.showToast('يرجى إدخال مبلغ صحيح', 'error');
        } else {
            alert('⚠️ يرجى إدخال مبلغ صحيح');
        }
        isSavingReceipt = false;
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
        return;
    }

    const receiptId = document.getElementById('receiptId').value || Date.now().toString();
    const isEdit = document.getElementById('isEdit').value === 'true';
    
    // Reload customer from database to get latest balance
    let customer = customers.find(c => c.id === customerId);
    if (customer && window.electronAPI && window.electronAPI.dbGet) {
        try {
            const dbCustomer = await window.electronAPI.dbGet('customers', customerId);
            if (dbCustomer) {
                const customerIndex = customers.findIndex(c => c.id === customerId);
                if (customerIndex !== -1) {
                    customers[customerIndex] = { ...customers[customerIndex], ...dbCustomer };
                    customer = customers[customerIndex];
                }
            }
        } catch (error) {
            console.error('[Receipts] Error reloading customer in handleFormSubmit:', error);
        }
    }
    
    if (!customer) {
        if (window.showToast) {
            window.showToast('العميل غير موجود', 'error');
        } else {
            alert('⚠️ العميل غير موجود');
        }
        return;
    }

    // Check if receipt amount exceeds customer balance (only for new receipts, not edits)
    if (!isEdit) {
        // الرصيد في قاعدة البيانات محفوظ بالجنيه المصري مباشرة
        const customerBalance = parseFloat(customer.balance) || 0;
        
        // Check if amount exceeds balance
        if (amount > customerBalance) {
            const excessAmount = amount - customerBalance;
            const warningMessage = `⚠️ تحذير: مبلغ السند (${amount.toFixed(2)} ج.م) أكبر من رصيد العميل (${customerBalance.toFixed(2)} ج.م)\n\nالفرق: ${excessAmount.toFixed(2)} ج.م\n\nسيصبح رصيد العميل سالباً (نحن مدينون للعميل). هل تريد المتابعة؟`;
            
            // Use showConfirmDialog if available, otherwise use confirm
            if (typeof showConfirmDialog === 'function') {
                showConfirmDialog(
                    warningMessage,
                    () => {
                        // User confirmed - proceed with receipt
                        proceedWithReceipt().finally(() => {
                            isSavingReceipt = false;
                            if (submitButton) {
                                submitButton.disabled = false;
                                submitButton.textContent = originalButtonText;
                            }
                        });
                    },
                    () => {
                        // User cancelled - reset button
                        isSavingReceipt = false;
                        if (submitButton) {
                            submitButton.disabled = false;
                            submitButton.textContent = originalButtonText;
                        }
                    }
                );
            } else {
                if (confirm(warningMessage)) {
                    proceedWithReceipt().finally(() => {
                        isSavingReceipt = false;
                        if (submitButton) {
                            submitButton.disabled = false;
                            submitButton.textContent = originalButtonText;
                        }
                    });
                } else {
                    isSavingReceipt = false;
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = originalButtonText;
                    }
                }
            }
            return;
        }
    }
    
    // Proceed with receipt if amount is valid
    await proceedWithReceipt();
    } catch (error) {
        console.error('Error in handleFormSubmit:', error);
        if (window.showToast) {
            window.showToast('خطأ في حفظ السند: ' + error.message, 'error');
        } else {
            alert('✗ خطأ في حفظ السند: ' + error.message);
        }
    } finally {
        // إعادة تفعيل الزر في جميع الحالات
        isSavingReceipt = false;
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
    }
}

// Proceed with receipt after confirmation
async function proceedWithReceipt() {
    const customerId = document.getElementById('customerSelect').value;
    const date = document.getElementById('receiptDate').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const paymentMethod = document.getElementById('paymentMethod').value;
    const notes = document.getElementById('notes').value.trim();
    const receiptId = document.getElementById('receiptId').value || Date.now().toString();
    const isEdit = document.getElementById('isEdit').value === 'true';
    
    // Generate receipt number (async for new receipts)
    let receiptNumber;
    if (isEdit) {
        receiptNumber = receipts.find(r => r.id === receiptId)?.receiptNumber;
    } else {
        receiptNumber = await generateReceiptNumber();
    }
    
    const receiptData = {
        id: receiptId,
        receiptNumber: receiptNumber,
        customerId: customerId,
        date: date,
        amount: amount,
        paymentMethod: paymentMethod,
        notes: notes || '',
        createdAt: isEdit ? 
            receipts.find(r => r.id === receiptId)?.createdAt : 
            new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    try {
        // Check if receipt amount exceeds customer balance (for edits too)
        if (isEdit) {
            // Reload customer from database to get latest balance
            let customer = customers.find(c => c.id === customerId);
            if (customer && window.electronAPI && window.electronAPI.dbGet) {
                try {
                    const dbCustomer = await window.electronAPI.dbGet('customers', customerId);
                    if (dbCustomer) {
                        const customerIndex = customers.findIndex(c => c.id === customerId);
                        if (customerIndex !== -1) {
                            customers[customerIndex] = { ...customers[customerIndex], ...dbCustomer };
                            customer = customers[customerIndex];
                        }
                }
            } catch (error) {
                    console.error('[Receipts] Error reloading customer in proceedWithReceipt:', error);
            }
        }
        
            if (customer) {
                // الرصيد في قاعدة البيانات محفوظ بالجنيه المصري مباشرة
        const customerBalance = parseFloat(customer.balance) || 0;
                const oldReceipt = receipts.find(r => r.id === receiptId);
                
                // Calculate effective balance (add back old receipt amount)
                let effectiveBalance = customerBalance;
                if (oldReceipt && oldReceipt.customerId === customerId) {
                    effectiveBalance = customerBalance + oldReceipt.amount;
                }
                
                // Check if new amount exceeds balance
                if (amount > effectiveBalance) {
                    const excessAmount = amount - effectiveBalance;
                    const warningMessage = `⚠️ تحذير: مبلغ السند الجديد (${amount.toFixed(2)} ج.م) أكبر من رصيد العميل (${effectiveBalance.toFixed(2)} ج.م)\n\nالفرق: ${excessAmount.toFixed(2)} ج.م\n\nسيصبح رصيد العميل سالباً (نحن مدينون للعميل). هل تريد المتابعة؟`;
                    
                    // Use showConfirmDialog if available, otherwise use confirm
                    if (typeof showConfirmDialog === 'function') {
                        showConfirmDialog(
                            warningMessage,
                            () => {
                                // User confirmed - proceed with receipt save
                                proceedWithReceiptSave();
                            },
                            () => {
                                // User cancelled - do nothing
                            }
                        );
                    } else {
                        if (confirm(warningMessage)) {
                            proceedWithReceiptSave();
                        }
                    }
                    return;
                }
            }
        }
        
        // Proceed with receipt save
        proceedWithReceiptSave();
    } catch (error) {
        console.error('Error in proceedWithReceipt:', error);
        if (window.showToast) {
            window.showToast('خطأ في حفظ سند القبض: ' + error.message, 'error');
        } else {
            alert('✗ خطأ في حفظ سند القبض: ' + error.message);
        }
    }
}

// Proceed with receipt save after confirmation
async function proceedWithReceiptSave() {
    const customerId = document.getElementById('customerSelect').value;
    const date = document.getElementById('receiptDate').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const paymentMethod = document.getElementById('paymentMethod').value;
    const notes = document.getElementById('notes').value.trim();
    const receiptId = document.getElementById('receiptId').value || Date.now().toString();
    const isEdit = document.getElementById('isEdit').value === 'true';
    
    // إعادة تحميل العميل من قاعدة البيانات للحصول على الرصيد الحالي المحدث
    let customer = customers.find(c => c.id === customerId);
    if (customer && window.electronAPI && window.electronAPI.dbGet) {
        try {
            const dbCustomer = await window.electronAPI.dbGet('customers', customerId);
            if (dbCustomer) {
                const customerIndex = customers.findIndex(c => c.id === customerId);
                if (customerIndex !== -1) {
                    customers[customerIndex] = { ...customers[customerIndex], ...dbCustomer };
                    customer = customers[customerIndex];
                    console.log('[Receipts] proceedWithReceiptSave - Reloaded customer from database, current balance:', customer.balance);
                }
            }
        } catch (error) {
            console.error('[Receipts] Error reloading customer from database in proceedWithReceiptSave:', error);
            // Continue with local customer data if database reload fails
        }
    }
    
    if (!customer) {
        if (window.showToast) {
            window.showToast('العميل غير موجود', 'error');
        } else {
            alert('⚠️ العميل غير موجود');
        }
        return;
    }
    
    // الرصيد القديم = الرصيد الحالي من قاعدة البيانات مباشرة
    let calculatedOldBalance = parseFloat(customer.balance || 0);
    
    // عند تعديل سند قبض موجود: إضافة المبلغ القديم للسند لإرجاع الرصيد إلى ما كان عليه قبل هذا السند
    if (isEdit && receiptId) {
        const oldReceipt = receipts.find(r => r.id === receiptId);
        if (oldReceipt && oldReceipt.customerId === customerId) {
            const oldAmount = parseFloat(oldReceipt.amount || 0);
            calculatedOldBalance = calculatedOldBalance + oldAmount;
            console.log('[Receipts] proceedWithReceiptSave - Editing receipt: Added back old receipt amount to get balance before this receipt:', {
                currentBalance: parseFloat(customer.balance || 0),
                oldAmount,
                calculatedOldBalance
            });
        }
    }
    
    // الرصيد يُحفظ بالجنيه المصري مباشرة في قاعدة البيانات
    const oldBalanceToSave = calculatedOldBalance;
    
    // حساب الرصيد الجديد (oldBalance - amount)
    // سند القبض يقلل دين العميل (الرصيد)
    const newBalanceToSave = oldBalanceToSave - amount;
    
    console.log('[Receipts] proceedWithReceiptSave - Balance calculations to save in receipt:', {
        calculatedOldBalance,
        oldBalanceToSave,
        amount,
        newBalanceToSave,
        isEdit
    });
    
    // Generate receipt number (async for new receipts)
    let receiptNumber;
    if (isEdit) {
        receiptNumber = receipts.find(r => r.id === receiptId)?.receiptNumber;
    } else {
        receiptNumber = await generateReceiptNumber();
    }
    
    const receiptData = {
        id: receiptId,
        receiptNumber: receiptNumber,
        customerId: customerId,
        date: date,
        amount: amount,
        paymentMethod: paymentMethod,
        notes: notes || '',
        // الرصيد القديم يُحفظ في عمود oldBalance في جدول receipts
        // الرصيد القديم = الرصيد الحالي من قاعدة البيانات (قبل خصم هذا السند)
        // ⚠️ مهم: هذه القيم تظل ثابتة ولا تتغير حتى بعد إنشاء فواتير جديدة أو سندات قبض
        // لأنها تمثل "لقطة تاريخية" (snapshot) من الرصيد في وقت إنشاء السند
        oldBalance: oldBalanceToSave,
        // الرصيد الجديد يُحفظ في عمود newBalance
        // الرصيد الجديد = الرصيد القديم - المبلغ
        // ⚠️ هذه القيمة تظل ثابتة ولا تتغير
        newBalance: newBalanceToSave,
        createdAt: isEdit ? 
            receipts.find(r => r.id === receiptId)?.createdAt : 
            new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    try {
        
        // Save to database if available
        if (window.electronAPI && window.electronAPI.dbInsert && window.electronAPI.dbUpdate) {
            if (isEdit) {
                // Update existing receipt
                const oldReceipt = receipts.find(r => r.id === receiptId);
                if (oldReceipt) {
                    // Update receipt in database first
                    const updateResult = await window.electronAPI.dbUpdate('receipts', receiptId, receiptData);
                    
                    // Check if update was successful
                    if (!updateResult || !updateResult.success) {
                        const errorMsg = updateResult?.error || 'خطأ غير معروف';
                        console.error('Failed to update receipt in database:', errorMsg);
                        throw new Error('فشل تحديث السند في قاعدة البيانات: ' + errorMsg);
                    }
                    
                    // Recalculate customer balance for both old and new customer (if changed)
                    if (window.recalculateCustomerBalance && typeof window.recalculateCustomerBalance === 'function') {
                        if (oldReceipt.customerId !== customerId) {
                            // Customer changed: recalculate both old and new customer balances
                            await window.recalculateCustomerBalance(oldReceipt.customerId);
                            await window.recalculateCustomerBalance(customerId);
                        } else {
                            // Same customer: recalculate once
                            await window.recalculateCustomerBalance(customerId);
                        }
                        console.log('[Receipts] Customer balance updated after receipt update');
                    } else {
                        // Fallback to direct update if recalculateCustomerBalance is not available
                        await updateCustomerBalanceInDB(oldReceipt.customerId, oldReceipt.amount);
                        await updateCustomerBalanceInDB(customerId, -amount);
                    }
                }
            } else {
                // New receipt
                // Add createdBy to track who created this receipt
                if (!receiptData.createdBy) {
                    if (typeof addCreatedBy === 'function') {
                        addCreatedBy(receiptData);
                    } else {
                        const currentUser = localStorage.getItem('asel_user') || localStorage.getItem('asel_userId') || '';
                        if (currentUser) {
                            receiptData.createdBy = currentUser;
                        }
                    }
                }
                
                const insertResult = await window.electronAPI.dbInsert('receipts', receiptData);
                
                // Check if insert was successful
                if (!insertResult || !insertResult.success) {
                    const errorMsg = insertResult?.error || 'خطأ غير معروف';
                    console.error('Failed to insert receipt to database:', errorMsg);
                    throw new Error('فشل حفظ السند في قاعدة البيانات: ' + errorMsg);
                }
                // Recalculate customer balance (includes all invoices, receipts, and returns)
                if (window.recalculateCustomerBalance && typeof window.recalculateCustomerBalance === 'function') {
                    await window.recalculateCustomerBalance(customerId);
                    console.log('[Receipts] Customer balance updated after receipt save');
                } else {
                    // Fallback to direct update if recalculateCustomerBalance is not available
                    await updateCustomerBalanceInDB(customerId, -amount);
                }
                // Update first transaction date
                await updateCustomerFirstTransactionDate(customerId);
            }
            
            // Reload receipts from database to ensure consistency
            try {
                receipts = await window.electronAPI.dbGetAll('receipts', '', []);
                receipts = Array.isArray(receipts) ? receipts : [];
            } catch (reloadError) {
                console.error('Error reloading receipts from database:', reloadError);
                // Fallback: update local array manually
                if (isEdit) {
                    const index = receipts.findIndex(r => r.id === receiptId);
                    if (index !== -1) {
                        receipts[index] = receiptData;
                    }
                } else {
                    receipts.push(receiptData);
                }
            }
        } else {
            // Fallback to localStorage
            if (isEdit) {
                const index = receipts.findIndex(r => r.id === receiptId);
                if (index !== -1) {
                    const oldReceipt = receipts[index];
                    // Revert old amount
                    updateCustomerBalance(oldReceipt.customerId, oldReceipt.amount);
                    // Apply new amount
                    updateCustomerBalance(customerId, -amount);
                    receipts[index] = receiptData;
                }
            } else {
                receipts.push(receiptData);
                // Update customer balance (receipt reduces debt)
                updateCustomerBalance(customerId, -amount);
            }
            saveReceipts();
        }
        
        currentPage = 1;
        await applyFilters();
        closeModal();
        if (window.showToast) {
            window.showToast('تم حفظ سند القبض بنجاح', 'success');
        } else {
            alert('✓ تم حفظ سند القبض بنجاح');
        }
    } catch (error) {
        console.error('Error saving receipt:', error);
        if (window.showToast) {
            window.showToast('خطأ في حفظ سند القبض: ' + error.message, 'error');
        } else {
            alert('✗ خطأ في حفظ سند القبض: ' + error.message);
        }
    }
}

// Update Customer First Transaction Date
async function updateCustomerFirstTransactionDate(customerId) {
    if (!window.electronAPI || !window.electronAPI.dbGet || !window.electronAPI.dbUpdate) return;
    
    try {
        const customer = await window.electronAPI.dbGet('customers', customerId);
        if (!customer) return;
        
        // Get all invoices and receipts for this customer
        let customerInvoices = [];
        let customerReceipts = [];
        
        try {
            customerInvoices = await window.electronAPI.dbGetAll('sales_invoices', 'customerId = ?', [customerId]);
            customerReceipts = await window.electronAPI.dbGetAll('receipts', 'customerId = ?', [customerId]);
        } catch (error) {
            console.error('Error loading transactions for customer:', error);
            return;
        }
        
        // Combine all transactions with their dates
        const allTransactions = [];
        customerInvoices.forEach(inv => {
            if (inv.date) allTransactions.push({ date: inv.date, type: 'invoice' });
        });
        customerReceipts.forEach(rec => {
            if (rec.date) allTransactions.push({ date: rec.date, type: 'receipt' });
        });
        
        // Find the earliest transaction date
        if (allTransactions.length > 0) {
            const sortedTransactions = allTransactions.sort((a, b) => 
                new Date(a.date) - new Date(b.date)
            );
            const firstTransactionDate = sortedTransactions[0].date;
            
            // Update firstTransactionDate if it's different or doesn't exist
            if (!customer.firstTransactionDate || customer.firstTransactionDate !== firstTransactionDate) {
                await window.electronAPI.dbUpdate('customers', customerId, {
                    ...customer,
                    firstTransactionDate: firstTransactionDate
                });
                
                // Update local array
                const localCustomer = customers.find(c => c.id === customerId);
                if (localCustomer) {
                    localCustomer.firstTransactionDate = firstTransactionDate;
                }
            }
        }
    } catch (error) {
        console.error('Error updating customer first transaction date:', error);
    }
}

// Update Customer Balance in Database
async function updateCustomerBalanceInDB(customerId, amount) {
    if (window.electronAPI && window.electronAPI.dbGet && window.electronAPI.dbUpdate) {
        try {
            const customer = await window.electronAPI.dbGet('customers', customerId);
            if (customer) {
                const newBalance = (parseFloat(customer.balance) || 0) + amount;
                await window.electronAPI.dbUpdate('customers', customerId, {
                    ...customer,
                    balance: newBalance,
                    lastTransactionDate: new Date().toISOString()
                });
                
                // Update first transaction date
                await updateCustomerFirstTransactionDate(customerId);
                
                // Update local array
                const localCustomer = customers.find(c => c.id === customerId);
                if (localCustomer) {
                    localCustomer.balance = newBalance;
                    localCustomer.lastTransactionDate = new Date().toISOString();
                }
            }
        } catch (error) {
            console.error('Error updating customer balance in database:', error);
        }
    }
}

// Update Customer Balance (localStorage fallback)
function updateCustomerBalance(customerId, amount) {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
        customer.balance = (customer.balance || 0) + amount;
        customer.lastTransactionDate = new Date().toISOString();
        localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
    }
}

// Render Receipts
// Apply Filters
async function applyFilters() {
    // If no date filters are set, default to current month
    let effectiveDateFrom = dateFrom;
    let effectiveDateTo = dateTo;
    
    // If no date filters are set and no search query, show only current month
    if (!dateFrom && !dateTo && !searchQuery) {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        effectiveDateFrom = firstDayOfMonth.toISOString().split('T')[0];
        effectiveDateTo = lastDayOfMonth.toISOString().split('T')[0];
        
        // Update date inputs to show current month
        const dateFromInput = document.getElementById('dateFrom');
        const dateToInput = document.getElementById('dateTo');
        if (dateFromInput && !dateFromInput.value) {
            dateFromInput.value = effectiveDateFrom;
        }
        if (dateToInput && !dateToInput.value) {
            dateToInput.value = effectiveDateTo;
        }
    }
    
    // Start with all receipts
    filteredReceipts = [...receipts];
    
    // Apply search filter
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredReceipts = filteredReceipts.filter(receipt => {
            // Search by receipt number
            const receiptNumber = (receipt.receiptNumber || '').toLowerCase();
            if (receiptNumber.includes(query)) return true;
            
            // Search by customer name
            const customer = customers.find(c => c.id === receipt.customerId);
            if (customer) {
                const customerName = (customer.name || '').toLowerCase();
                if (customerName.includes(query)) return true;
            }
            
            return false;
        });
    }
    
    // Apply date range filter (use effectiveDateFrom and effectiveDateTo)
    if (effectiveDateFrom) {
        filteredReceipts = filteredReceipts.filter(receipt => {
            return new Date(receipt.date) >= new Date(effectiveDateFrom);
        });
    }
    
    if (effectiveDateTo) {
        filteredReceipts = filteredReceipts.filter(receipt => {
            const receiptDate = new Date(receipt.date);
            const toDate = new Date(effectiveDateTo);
            toDate.setHours(23, 59, 59, 999); // Include entire day
            return receiptDate <= toDate;
        });
    }
    
    // Apply payment method filter
    if (paymentMethodFilter) {
        filteredReceipts = filteredReceipts.filter(receipt => {
            return receipt.paymentMethod === paymentMethodFilter;
        });
    }
    
    // Apply sorting
    filteredReceipts.sort((a, b) => {
        switch (sortBy) {
            case 'date-desc':
                // Sort by date first, then by createdAt/updatedAt (newest first)
                const dateA = new Date(a.date || 0);
                const dateB = new Date(b.date || 0);
                if (dateB.getTime() !== dateA.getTime()) {
                    return dateB.getTime() - dateA.getTime();
                }
                // If same date, sort by createdAt or updatedAt (newest first)
                const timeA = new Date(a.createdAt || a.updatedAt || 0);
                const timeB = new Date(b.createdAt || b.updatedAt || 0);
                return timeB.getTime() - timeA.getTime();
            case 'date-asc':
                // Sort by date first, then by createdAt/updatedAt (oldest first)
                const dateA2 = new Date(a.date || 0);
                const dateB2 = new Date(b.date || 0);
                if (dateA2.getTime() !== dateB2.getTime()) {
                    return dateA2.getTime() - dateB2.getTime();
                }
                // If same date, sort by createdAt or updatedAt (oldest first)
                const timeA2 = new Date(a.createdAt || a.updatedAt || 0);
                const timeB2 = new Date(b.createdAt || b.updatedAt || 0);
                return timeA2.getTime() - timeB2.getTime();
            case 'amount-desc':
                return (b.amount || 0) - (a.amount || 0);
            case 'amount-asc':
                return (a.amount || 0) - (b.amount || 0);
            case 'number-desc':
                return (b.receiptNumber || '').localeCompare(a.receiptNumber || '');
            case 'number-asc':
                return (a.receiptNumber || '').localeCompare(b.receiptNumber || '');
            default:
                // Default: newest first by date, then by createdAt/updatedAt
                const dateA3 = new Date(a.date || 0);
                const dateB3 = new Date(b.date || 0);
                if (dateB3.getTime() !== dateA3.getTime()) {
                    return dateB3.getTime() - dateA3.getTime();
                }
                const timeA3 = new Date(a.createdAt || a.updatedAt || 0);
                const timeB3 = new Date(b.createdAt || b.updatedAt || 0);
                return timeB3.getTime() - timeA3.getTime();
        }
    });
    
    // Reset to first page if current page is out of bounds
    const totalPages = Math.ceil(filteredReceipts.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
        currentPage = 1;
    }
    
    // Render paginated receipts
    await renderReceipts();
}

async function renderReceipts() {
    const tbody = document.getElementById('receiptsTableBody');
    const emptyState = document.getElementById('emptyState');
    const paginationContainer = document.getElementById('paginationContainer');
    
    tbody.innerHTML = '';
    
    if (filteredReceipts.length === 0) {
        emptyState.classList.remove('hidden');
        paginationContainer.classList.add('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    paginationContainer.classList.remove('hidden');

    // Calculate pagination
    const totalPages = Math.ceil(filteredReceipts.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredReceipts.length);
    const paginatedReceipts = filteredReceipts.slice(startIndex, endIndex);
    
    // Get current logged-in user type
    const currentUserType = localStorage.getItem('asel_userType') || '';
    // السماح لجميع المستخدمين بالتعديل إذا كانت الحالة "مسودة"
    // يمكن تعديل canEditReceipts لاحقاً إذا لزم الأمر للحالات الأخرى
    const canDeleteReceipts = currentUserType === 'manager' || currentUserType === 'system_engineer';
    
    // Update pagination info
    document.getElementById('paginationInfo').textContent = 
        `عرض ${startIndex + 1} - ${endIndex} من ${filteredReceipts.length}`;
    
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
        pageBtn.addEventListener('click', async () => {
            currentPage = i;
            await applyFilters();
        });
        pageNumbersEl.appendChild(pageBtn);
    }
    
    for (const receipt of paginatedReceipts) {
        const customer = customers.find(c => c.id === receipt.customerId);
        const paymentMethodText = {
            'cash': 'نقدي',
            'bank': 'تحويل بنكي',
            'check': 'شيك',
            'wallet': 'محفظة إلكترونية'
        };
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${receipt.receiptNumber}</td>
            <td>${new Date(receipt.date).toLocaleDateString('ar-EG')}</td>
            <td class="customer-name-cell">${customer ? `<strong>${customer.name}</strong>` : 'غير محدد'}</td>
            <td class="receipt-amount-cell"><strong>${formatArabicCurrency(receipt.amount)}</strong></td>
            <td><span class="payment-method-badge">${paymentMethodText[receipt.paymentMethod] || receipt.paymentMethod}</span></td>
            <td>${receipt.notes || '-'}</td>
            <td class="created-by-cell">${receipt.createdBy || '-'}</td>
            <td>
                <div class="actions-buttons">
                    <button class="action-btn view" data-receipt-id="${receipt.id}" title="عرض">👁️</button>
                    <button class="action-btn save" data-receipt-id="${receipt.id}" title="حفظ">💾</button>
                    <button class="action-btn print" data-receipt-id="${receipt.id}" title="طباعة">🖨️</button>
                </div>
            </td>
        `;
        
        // Add event listeners to buttons
        const viewBtn = row.querySelector('.action-btn.view');
        const saveBtn = row.querySelector('.action-btn.save');
        const printBtn = row.querySelector('.action-btn.print');
        const actionsDiv = row.querySelector('.actions-buttons');
        
        if (viewBtn) {
            viewBtn.addEventListener('click', () => viewReceipt(receipt.id));
        }
        if (saveBtn) {
            saveBtn.addEventListener('click', () => saveReceiptAsPDF(receipt.id));
        }
        if (printBtn) {
            printBtn.addEventListener('click', () => printReceipt(receipt.id));
        }
        
        tbody.appendChild(row);
    }
}

// View Receipt
function viewReceipt(receiptId) {
    const receipt = receipts.find(r => r.id === receiptId);
    if (!receipt) return;

    const customer = customers.find(c => c.id === receipt.customerId);
    const paymentMethodText = {
        'cash': 'نقدي',
        'bank': 'تحويل بنكي',
        'check': 'شيك',
        'wallet': 'محفظة إلكترونية'
    };

    // Calculate balances
    const currentBalance = customer ? (customer.balance || 0) : 0;
    const oldBalance = currentBalance + receipt.amount; // الرصيد القديم = الرصيد الحالي + المدفوع
    const paidAmount = receipt.amount; // المدفوع
    const newBalance = currentBalance; // الرصيد الجديد = الرصيد الحالي

    const receiptInfo = `سند قبض رقم: ${receipt.receiptNumber}\nالتاريخ: ${new Date(receipt.date).toLocaleDateString('ar-EG')}\nمن: ${customer ? customer.name : 'غير محدد'}\nالمبلغ: ${receipt.amount.toFixed(2)} ج.م\nطريقة الدفع: ${paymentMethodText[receipt.paymentMethod] || receipt.paymentMethod}\n\nالرصيد القديم: ${oldBalance.toFixed(2)} ج.م\nالمدفوع: ${paidAmount.toFixed(2)} ج.م\nالرصيد الجديد: ${newBalance.toFixed(2)} ج.م\n${receipt.notes ? `\nملاحظات: ${receipt.notes}` : ''}`;
    if (window.showToast) {
        window.showToast(receiptInfo, 'info');
    } else {
        alert(receiptInfo);
    }
}

// Edit Receipt
async function editReceipt(receiptId) {
    const receipt = receipts.find(r => r.id === receiptId);
    if (!receipt) return;

    document.getElementById('isEdit').value = 'true';
    document.getElementById('receiptId').value = receipt.id;
    document.getElementById('modalTitle').textContent = `تعديل سند قبض ${receipt.receiptNumber}`;
    document.getElementById('receiptDate').value = receipt.date;
    document.getElementById('customerSelect').value = receipt.customerId;
    document.getElementById('amount').value = receipt.amount;
    document.getElementById('paymentMethod').value = receipt.paymentMethod;
    document.getElementById('notes').value = receipt.notes || '';

    await onCustomerChange();
    await calculateBalance();
    document.getElementById('receiptModal').classList.add('active');
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
        <h2 style="margin: 0; font-size: 1.25rem;">تأكيد العملية</h2>
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
    messageP.style.whiteSpace = 'pre-line';
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
    confirmBtn.className = 'btn btn-primary';
    confirmBtn.style.minWidth = '100px';
    confirmBtn.textContent = 'تأكيد';
    
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

// Delete Receipt
async function deleteReceipt(receiptId) {
    // Check receipt status - prevent deletion if status is 'delivered' (حفظ نهائي)
    const receipt = receipts.find(r => r.id === receiptId);
    if (!receipt) {
        if (window.showToast) {
            window.showToast('السند غير موجود', 'error');
        } else {
            showMessage('السند غير موجود', 'error');
        }
        return;
    }
    
    
    // Use custom confirmation dialog instead of confirm()
    showConfirmDialog(
        'هل أنت متأكد من حذف هذا السند؟',
        () => {
            // User confirmed - proceed with deletion
            proceedWithReceiptDeletion(receiptId);
        },
        () => {
            // User cancelled - do nothing
        }
    );
}

// Proceed with receipt deletion
async function proceedWithReceiptDeletion(receiptId) {
    const receipt = receipts.find(r => r.id === receiptId);
    if (!receipt) return;

    try {
        // Save to database if available
        if (window.electronAPI && window.electronAPI.dbDelete) {
            await window.electronAPI.dbDelete('receipts', receiptId);
            // Recalculate customer balance (includes all invoices and receipts)
            if (window.recalculateCustomerBalance && typeof window.recalculateCustomerBalance === 'function') {
                await window.recalculateCustomerBalance(receipt.customerId);
            } else {
                // Fallback to direct update if recalculateCustomerBalance is not available
            await updateCustomerBalanceInDB(receipt.customerId, receipt.amount);
            }
            
            // Reload receipts from database to ensure consistency
            try {
                receipts = await window.electronAPI.dbGetAll('receipts', '', []);
                receipts = Array.isArray(receipts) ? receipts : [];
            } catch (reloadError) {
                console.error('Error reloading receipts from database:', reloadError);
                // Fallback: remove from local array manually
                receipts = receipts.filter(r => r.id !== receiptId);
            }
        } else {
            // Fallback to localStorage
            updateCustomerBalance(receipt.customerId, receipt.amount);
            receipts = receipts.filter(r => r.id !== receiptId);
            saveReceipts();
        }

        currentPage = 1;
        await applyFilters();
        if (window.showToast) {
            window.showToast('تم حذف السند بنجاح', 'success');
        }
    } catch (error) {
        console.error('Error deleting receipt:', error);
        if (window.showToast) {
            window.showToast('خطأ في حذف السند: ' + error.message, 'error');
        }
    }
}

// Get Company Settings
async function getCompanySettings() {
    try {
        if (window.electronAPI && window.electronAPI.dbGet) {
            const companyInfo = await window.electronAPI.dbGet('company_info', 'company_001');
            if (companyInfo) {
                // Map database fields to expected format
                return {
                    name: companyInfo.name || 'شركة أسيل',
                    address: companyInfo.address || '',
                    taxId: companyInfo.taxId || '',
                    tax: companyInfo.taxId || '', // Alias for compatibility
                    commercialRegister: companyInfo.commercialRegister || '',
                    register: companyInfo.commercialRegister || '', // Alias for compatibility
                    phone: companyInfo.phone || '',
                    mobile: companyInfo.mobile || '',
                    email: companyInfo.email || '',
                    commitmentText: companyInfo.commitmentText || 'أقر بأنني قد استلمت البضاعة/الخدمة المبينة أعلاه بحالة جيدة وبمواصفات مطابقة، وأتعهد بالسداد وفق الشروط المذكورة.'
                };
            }
        }
        
        // Fallback to localStorage
        const stored = localStorage.getItem('asel_company_settings');
        return stored ? JSON.parse(stored) : {};
    } catch (error) {
        console.error('Error getting company settings:', error);
        return {};
    }
}

// Generate Receipt Print Content
async function generateReceiptPrintContent(receipt) {
    const customer = customers.find(c => c.id === receipt.customerId);
    const paymentMethodText = {
        'cash': 'نقدي',
        'bank': 'تحويل بنكي',
        'check': 'شيك',
        'wallet': 'محفظة إلكترونية'
    };
    const companySettings = await getCompanySettings();
    
    // Get logo path or base64
    let logoPath = 'assets/icon-asel.ico';
    let logoBase64 = '';
    
    try {
        // Use electronAPI.getAssetPath to get correct file path
        if (window.electronAPI && window.electronAPI.getAssetPath) {
        // Try to get SVG logo first
            const logoSvgResult = await window.electronAPI.getAssetPath('aseel_logo.svg');
            if (logoSvgResult && logoSvgResult.success) {
                try {
                    const logoSvgResponse = await fetch(logoSvgResult.path);
                    if (logoSvgResponse.ok) {
                        const logoSvg = await logoSvgResponse.text();
                        logoBase64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(logoSvg)));
                    }
                } catch (error) {
                    console.warn('Error fetching SVG logo:', error);
                }
            }
            
            // Fallback to ICO if SVG not found or failed
            if (!logoBase64) {
                const logoIcoResult = await window.electronAPI.getAssetPath('icon-asel.ico');
                if (logoIcoResult && logoIcoResult.success) {
                    try {
                        const logoIcoResponse = await fetch(logoIcoResult.path);
                        if (logoIcoResponse.ok) {
                            const logoBlob = await logoIcoResponse.blob();
                            const reader = new FileReader();
                            logoBase64 = await new Promise((resolve) => {
                                reader.onloadend = () => resolve(reader.result);
                                reader.readAsDataURL(logoBlob);
                            });
                        }
                    } catch (error) {
                        console.warn('Error fetching ICO logo:', error);
                    }
                }
            }
        } else {
            // Fallback: try direct fetch (for development)
            try {
        const logoSvgResponse = await fetch('assets/aseel_logo.svg');
        if (logoSvgResponse.ok) {
            const logoSvg = await logoSvgResponse.text();
            logoBase64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(logoSvg)));
        } else {
            const logoIcoResponse = await fetch('assets/icon-asel.ico');
            if (logoIcoResponse.ok) {
                const logoBlob = await logoIcoResponse.blob();
                const reader = new FileReader();
                logoBase64 = await new Promise((resolve) => {
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(logoBlob);
                });
                    }
                }
            } catch (error) {
                console.warn('Error loading logo:', error);
            }
        }
    } catch (error) {
        console.warn('Error loading logo:', error);
    }
    
    // For print/view, use file path if available
    if (window.electronAPI && window.electronAPI.getAssetPath) {
        try {
            const result = await window.electronAPI.getAssetPath('icon-asel.ico');
            if (result && result.success) {
                logoPath = result.path;
            }
        } catch (error) {
            console.warn('Error getting logo path:', error);
        }
    }

    return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>سند قبض ${receipt.receiptNumber}</title>
    <style>
        @page {
            size: A4;
            margin: 0;
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Arial', sans-serif;
            direction: rtl;
            background: white;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            min-height: 100vh;
        }
        .voucher-container {
            border: 2px solid #333;
            padding: 20px;
            width: 50%;
            max-width: 400px;
            margin: 0 auto;
            min-height: 50vh;
        }
        .header {
            text-align: center;
            margin-bottom: 15px;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }
        .company-logo {
            width: 50px;
            height: 50px;
            object-fit: contain;
        }
        .company-info {
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .company-name {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .header div {
            font-size: 12px;
            margin: 2px 0;
        }
        .voucher-title {
            font-size: 16px;
            font-weight: bold;
            text-align: center;
            margin: 15px 0;
        }
        .voucher-info {
            margin: 10px 0;
        }
        .voucher-info table {
            width: 100%;
        }
        .voucher-info td {
            padding: 5px 0;
            font-size: 12px;
        }
        .voucher-info td:first-child {
            font-weight: bold;
            width: 100px;
        }
        .amount-section {
            text-align: center;
            margin: 15px 0;
            padding: 12px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        .amount-value {
            font-size: 20px;
            font-weight: bold;
            color: #667eea;
            margin: 8px 0;
        }
        .signature {
            margin-top: 20px;
            display: flex;
            justify-content: space-between;
            gap: 10px;
        }
        .signature-box {
            width: 45%;
            text-align: center;
            border-top: 1px solid #333;
            padding-top: 8px;
            margin-top: 15px;
            font-size: 11px;
        }
        .balance-section {
            margin: 15px 0;
            padding: 12px;
            background: #f0f4f8;
            border-radius: 8px;
            border: 1px solid #ddd;
        }
        .balance-section table {
            width: 100%;
        }
        .balance-section td {
            padding: 6px 0;
            font-size: 12px;
        }
        .balance-section td:first-child {
            font-weight: bold;
            width: 120px;
        }
        .balance-section td:last-child {
            text-align: left;
            font-weight: bold;
            color: #2c3e50;
        }
        @media print {
            body {
                padding: 0;
            }
            .voucher-container {
                width: 50%;
                max-width: 400px;
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="voucher-container">
        <div class="header">
            <img src="${logoBase64 || logoPath}" alt="Logo" class="company-logo" />
            <div class="company-info">
                <div class="company-name">${companySettings.name || 'شركة أسيل'}</div>
                <div>${companySettings.address || ''}</div>
                <div>${companySettings.phone || ''}</div>
            </div>
        </div>
        <div class="voucher-title">سند قبض</div>
        <div class="voucher-info">
            <table>
                <tr>
                    <td>رقم السند:</td>
                    <td>${receipt.receiptNumber}</td>
                </tr>
                <tr>
                    <td>التاريخ:</td>
                    <td>${new Date(receipt.date).toLocaleDateString('ar-EG')}</td>
                </tr>
                <tr>
                    <td>من:</td>
                    <td>${customer ? customer.name : 'غير محدد'}</td>
                </tr>
                <tr>
                    <td>المبلغ:</td>
                    <td>${receipt.amount.toFixed(2)} ج.م</td>
                </tr>
                <tr>
                    <td>طريقة الدفع:</td>
                    <td>${paymentMethodText[receipt.paymentMethod] || receipt.paymentMethod}</td>
                </tr>
                ${receipt.notes ? `
                <tr>
                    <td>ملاحظات:</td>
                    <td>${receipt.notes}</td>
                </tr>
                ` : ''}
            </table>
        </div>
        <div class="amount-section">
            <div>المبلغ المستلم</div>
            <div class="amount-value">${receipt.amount.toFixed(2)} ج.م</div>
        </div>
        <div class="balance-section">
            <table>
                <tr>
                    <td>الرصيد القديم:</td>
                    <td>${((customer ? (customer.balance || 0) : 0) + receipt.amount).toFixed(2)} ج.م</td>
                </tr>
                <tr>
                    <td>المدفوع:</td>
                    <td>${receipt.amount.toFixed(2)} ج.م</td>
                </tr>
                <tr>
                    <td>الرصيد الجديد:</td>
                    <td>${(customer ? (customer.balance || 0) : 0).toFixed(2)} ج.م</td>
                </tr>
            </table>
        </div>
        <div class="signature">
            <div class="signature-box">
                <div>توقيع المستلم</div>
            </div>
            <div class="signature-box">
                <div>توقيع المدير</div>
            </div>
        </div>
    </div>
</body>
    </html>
    `;
}

// Print Receipt
async function printReceipt(receiptId) {
    try {
        const receipt = receipts.find(r => r.id === receiptId);
        if (!receipt) {
            if (window.showToast) {
                window.showToast('السند غير موجود', 'error');
            }
            return;
        }

        const printContent = await generateReceiptPrintContent(receipt);
        
        // Open window off-screen or very small to minimize visibility
        const printWindow = window.open('', '_blank', 'width=1,height=1,left=-1000,top=-1000');
        if (!printWindow || printWindow.closed || typeof printWindow.closed === 'undefined') {
            console.error('Failed to open print window - may be blocked');
            if (window.showToast) {
                window.showToast('فشل فتح نافذة الطباعة. يرجى التحقق من إعدادات منع النوافذ المنبثقة', 'error');
            }
            return;
        }
        
        printWindow.document.write(printContent);
        printWindow.document.close();
        
        // Wait for content to load, then print directly
        setTimeout(() => {
            try {
                // Print directly - this will open print dialog
                printWindow.print();
            } catch (printError) {
                console.error('Error calling print():', printError);
                if (window.showToast) {
                    window.showToast('تم فتح نافذة الطباعة. يرجى استخدام زر الطباعة في المتصفح', 'info');
                }
            }
        }, 500);
    } catch (error) {
        console.error('Error in printReceipt:', error);
        if (window.showToast) {
            window.showToast('خطأ في طباعة السند: ' + error.message, 'error');
        }
    }
}

// Generate Provisional Receipt Print Content
async function generateProvisionalReceiptPrintContent(receiptData) {
    const customer = customers.find(c => c.id === receiptData.customerId);
    const paymentMethodText = {
        'cash': 'نقدي',
        'bank': 'تحويل بنكي',
        'check': 'شيك',
        'wallet': 'محفظة إلكترونية'
    };
    const companySettings = await getCompanySettings();
    
    // Get logo path or base64
    let logoPath = 'assets/icon-asel.ico';
    let logoBase64 = '';
    
    try {
        // Use electronAPI.getAssetPath to get correct file path
        if (window.electronAPI && window.electronAPI.getAssetPath) {
        // Try to get SVG logo first
            const logoSvgResult = await window.electronAPI.getAssetPath('aseel_logo.svg');
            if (logoSvgResult && logoSvgResult.success) {
                try {
                    const logoSvgResponse = await fetch(logoSvgResult.path);
                    if (logoSvgResponse.ok) {
                        const logoSvg = await logoSvgResponse.text();
                        logoBase64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(logoSvg)));
                    }
                } catch (error) {
                    console.warn('Error fetching SVG logo:', error);
                }
            }
            
            // Fallback to ICO if SVG not found or failed
            if (!logoBase64) {
                const logoIcoResult = await window.electronAPI.getAssetPath('icon-asel.ico');
                if (logoIcoResult && logoIcoResult.success) {
                    try {
                        const logoIcoResponse = await fetch(logoIcoResult.path);
                        if (logoIcoResponse.ok) {
                            const logoBlob = await logoIcoResponse.blob();
                            const reader = new FileReader();
                            logoBase64 = await new Promise((resolve) => {
                                reader.onloadend = () => resolve(reader.result);
                                reader.readAsDataURL(logoBlob);
                            });
                        }
                    } catch (error) {
                        console.warn('Error fetching ICO logo:', error);
                    }
                }
            }
        } else {
            // Fallback: try direct fetch (for development)
            try {
        const logoSvgResponse = await fetch('assets/aseel_logo.svg');
        if (logoSvgResponse.ok) {
            const logoSvg = await logoSvgResponse.text();
            logoBase64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(logoSvg)));
        } else {
            const logoIcoResponse = await fetch('assets/icon-asel.ico');
            if (logoIcoResponse.ok) {
                const logoBlob = await logoIcoResponse.blob();
                const reader = new FileReader();
                logoBase64 = await new Promise((resolve) => {
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(logoBlob);
                });
                    }
                }
            } catch (error) {
                console.warn('Error loading logo:', error);
            }
        }
    } catch (error) {
        console.warn('Error loading logo:', error);
    }
    
    // For print/view, use file path if available
    if (window.electronAPI && window.electronAPI.getAssetPath) {
        try {
            const result = await window.electronAPI.getAssetPath('icon-asel.ico');
            if (result && result.success) {
                logoPath = result.path;
            }
        } catch (error) {
            console.warn('Error getting logo path:', error);
        }
    }
    
    // Generate provisional receipt number
    const timestamp = new Date().getTime();
    const provisionalNumber = `REC-PROV-${timestamp.toString().slice(-6)}`;

    return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>سند قبض احتياطي ${provisionalNumber}</title>
    <style>
        @page {
            size: A4;
            margin: 0;
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Arial', sans-serif;
            direction: rtl;
            background: white;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            min-height: 100vh;
        }
        .voucher-container {
            border: 2px solid #333;
            padding: 20px;
            width: 50%;
            max-width: 400px;
            margin: 0 auto;
            min-height: 50vh;
        }
        .header {
            text-align: center;
            margin-bottom: 15px;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
        }
        .company-name {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .header div {
            font-size: 12px;
            margin: 2px 0;
        }
        .voucher-title {
            font-size: 16px;
            font-weight: bold;
            text-align: center;
            margin: 15px 0;
        }
        .provisional-badge {
            background-color: #ffc107;
            color: #000;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            display: inline-block;
            margin-bottom: 10px;
        }
        .voucher-info {
            margin: 10px 0;
        }
        .voucher-info table {
            width: 100%;
        }
        .voucher-info td {
            padding: 5px 0;
            font-size: 12px;
        }
        .voucher-info td:first-child {
            font-weight: bold;
            width: 100px;
        }
        .amount-section {
            text-align: center;
            margin: 15px 0;
            padding: 12px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        .amount-value {
            font-size: 20px;
            font-weight: bold;
            color: #667eea;
            margin: 8px 0;
        }
        .signature {
            margin-top: 20px;
            display: flex;
            justify-content: space-between;
            gap: 10px;
        }
        .signature-box {
            width: 45%;
            text-align: center;
            border-top: 1px solid #333;
            padding-top: 8px;
            margin-top: 15px;
            font-size: 11px;
        }
        .balance-section {
            margin: 15px 0;
            padding: 12px;
            background: #f0f4f8;
            border-radius: 8px;
            border: 1px solid #ddd;
        }
        .balance-section table {
            width: 100%;
        }
        .balance-section td {
            padding: 6px 0;
            font-size: 12px;
        }
        .balance-section td:first-child {
            font-weight: bold;
            width: 120px;
        }
        .balance-section td:last-child {
            text-align: left;
            font-weight: bold;
            color: #2c3e50;
        }
        .warning-note {
            background-color: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 4px;
            padding: 8px;
            margin: 10px 0;
            font-size: 11px;
            color: #856404;
            text-align: center;
        }
        @media print {
            body {
                padding: 0;
            }
            .voucher-container {
                width: 50%;
                max-width: 400px;
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="voucher-container">
        <div class="header">
            <img src="${logoBase64 || logoPath}" alt="Logo" class="company-logo" />
            <div class="company-info">
                <div class="company-name">${companySettings.name || 'شركة أسيل'}</div>
                <div>${companySettings.address || ''}</div>
                <div>${companySettings.phone || ''}</div>
            </div>
        </div>
        <div class="voucher-title">
            <div class="provisional-badge">⚠️ سند قبض احتياطي</div>
            <div>سند قبض</div>
        </div>
        <div class="warning-note">
            ⚠️ هذا سند قبض احتياطي - يجب إدخاله في النظام عند العودة للمخزن
        </div>
        <div class="voucher-info">
            <table>
                <tr>
                    <td>رقم السند:</td>
                    <td>${provisionalNumber}</td>
                </tr>
                <tr>
                    <td>التاريخ:</td>
                    <td>${new Date(receiptData.date).toLocaleDateString('ar-EG')}</td>
                </tr>
                <tr>
                    <td>من:</td>
                    <td>${customer ? customer.name : 'غير محدد'}</td>
                </tr>
                <tr>
                    <td>المبلغ:</td>
                    <td>${receiptData.amount.toFixed(2)} ج.م</td>
                </tr>
                <tr>
                    <td>طريقة الدفع:</td>
                    <td>${paymentMethodText[receiptData.paymentMethod] || receiptData.paymentMethod}</td>
                </tr>
                ${receiptData.notes ? `
                <tr>
                    <td>ملاحظات:</td>
                    <td>${receiptData.notes}</td>
                </tr>
                ` : ''}
            </table>
        </div>
        <div class="amount-section">
            <div>المبلغ المستلم</div>
            <div class="amount-value">${receiptData.amount.toFixed(2)} ج.م</div>
        </div>
        <div class="balance-section">
            <table>
                <tr>
                    <td>الرصيد القديم:</td>
                    <td>${((customer ? (customer.balance || 0) : 0) + receiptData.amount).toFixed(2)} ج.م</td>
                </tr>
                <tr>
                    <td>المدفوع:</td>
                    <td>${receiptData.amount.toFixed(2)} ج.م</td>
                </tr>
                <tr>
                    <td>الرصيد الجديد:</td>
                    <td>${(customer ? (customer.balance || 0) : 0).toFixed(2)} ج.م</td>
                </tr>
            </table>
        </div>
        <div class="signature">
            <div class="signature-box">
                <div>توقيع المستلم</div>
            </div>
            <div class="signature-box">
                <div>توقيع المدير</div>
            </div>
        </div>
    </div>
</body>
    </html>
    `;
}

// Print Provisional Receipt
async function printProvisionalReceipt() {
    try {
        // Get form data
        const customerId = document.getElementById('customerSelect').value;
        const date = document.getElementById('receiptDate').value;
        const amount = parseFloat(document.getElementById('amount').value);
        const paymentMethod = document.getElementById('paymentMethod').value;
        const notes = document.getElementById('notes').value.trim();

        // Validate form data
        if (!customerId) {
            if (window.showToast) {
                window.showToast('يرجى اختيار العميل', 'error');
            } else {
                alert('⚠️ يرجى اختيار العميل');
            }
            return;
        }

        if (!amount || amount <= 0) {
            if (window.showToast) {
                window.showToast('يرجى إدخال مبلغ صحيح', 'error');
            } else {
                alert('⚠️ يرجى إدخال مبلغ صحيح');
            }
            return;
        }

        if (!date) {
            if (window.showToast) {
                window.showToast('يرجى اختيار التاريخ', 'error');
            } else {
                alert('⚠️ يرجى اختيار التاريخ');
            }
            return;
        }

        // Create provisional receipt data object
        const receiptData = {
            customerId: customerId,
            date: date,
            amount: amount,
            paymentMethod: paymentMethod,
            notes: notes || ''
        };

        // Generate print content
        const printContent = await generateProvisionalReceiptPrintContent(receiptData);
        
        // Open window off-screen or very small to minimize visibility
        const printWindow = window.open('', '_blank', 'width=1,height=1,left=-1000,top=-1000');
        if (!printWindow || printWindow.closed || typeof printWindow.closed === 'undefined') {
            console.error('Failed to open print window - may be blocked');
            if (window.showToast) {
                window.showToast('فشل فتح نافذة الطباعة. يرجى التحقق من إعدادات منع النوافذ المنبثقة', 'error');
            }
            return;
        }
        
        printWindow.document.write(printContent);
        printWindow.document.close();
        
        // Wait for content to load, then print directly
        setTimeout(() => {
            try {
                // Print directly - this will open print dialog
                printWindow.print();
                if (window.showToast) {
                    window.showToast('تم طباعة السند الاحتياطي بنجاح. تذكر إدخاله في النظام عند العودة', 'success');
                }
            } catch (printError) {
                console.error('Error calling print():', printError);
                if (window.showToast) {
                    window.showToast('تم فتح نافذة الطباعة. يرجى استخدام زر الطباعة في المتصفح', 'info');
                }
            }
        }, 500);
    } catch (error) {
        console.error('Error in printProvisionalReceipt:', error);
        if (window.showToast) {
            window.showToast('خطأ في طباعة السند الاحتياطي: ' + error.message, 'error');
        }
    }
}

// Generate Blank Provisional Receipt Print Content
async function generateBlankProvisionalReceiptPrintContent() {
    const companySettings = await getCompanySettings();
    const currentYear = new Date().getFullYear();
    
    // Get logo path or base64
    let logoPath = 'assets/icon-asel.ico';
    let logoBase64 = '';
    
    try {
        // Use electronAPI.getAssetPath to get correct file path
        if (window.electronAPI && window.electronAPI.getAssetPath) {
        // Try to get SVG logo first
            const logoSvgResult = await window.electronAPI.getAssetPath('aseel_logo.svg');
            if (logoSvgResult && logoSvgResult.success) {
                try {
                    const logoSvgResponse = await fetch(logoSvgResult.path);
                    if (logoSvgResponse.ok) {
                        const logoSvg = await logoSvgResponse.text();
                        logoBase64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(logoSvg)));
                    }
                } catch (error) {
                    console.warn('Error fetching SVG logo:', error);
                }
            }
            
            // Fallback to ICO if SVG not found or failed
            if (!logoBase64) {
                const logoIcoResult = await window.electronAPI.getAssetPath('icon-asel.ico');
                if (logoIcoResult && logoIcoResult.success) {
                    try {
                        const logoIcoResponse = await fetch(logoIcoResult.path);
                        if (logoIcoResponse.ok) {
                            const logoBlob = await logoIcoResponse.blob();
                            const reader = new FileReader();
                            logoBase64 = await new Promise((resolve) => {
                                reader.onloadend = () => resolve(reader.result);
                                reader.readAsDataURL(logoBlob);
                            });
                        }
                    } catch (error) {
                        console.warn('Error fetching ICO logo:', error);
                    }
                }
            }
        } else {
            // Fallback: try direct fetch (for development)
            try {
        const logoSvgResponse = await fetch('assets/aseel_logo.svg');
        if (logoSvgResponse.ok) {
            const logoSvg = await logoSvgResponse.text();
            logoBase64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(logoSvg)));
        } else {
            const logoIcoResponse = await fetch('assets/icon-asel.ico');
            if (logoIcoResponse.ok) {
                const logoBlob = await logoIcoResponse.blob();
                const reader = new FileReader();
                logoBase64 = await new Promise((resolve) => {
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(logoBlob);
                });
                    }
                }
            } catch (error) {
                console.warn('Error loading logo:', error);
            }
        }
    } catch (error) {
        console.warn('Error loading logo:', error);
    }
    
    // For print/view, use file path if available
    if (window.electronAPI && window.electronAPI.getAssetPath) {
        try {
            const result = await window.electronAPI.getAssetPath('icon-asel.ico');
            if (result && result.success) {
                logoPath = result.path;
            }
        } catch (error) {
            console.warn('Error getting logo path:', error);
        }
    }

    // Generate single receipt HTML
    const singleReceiptHTML = `
        <div class="voucher-container">
            <div class="watermark">${companySettings.name || 'شركة أسيل'}</div>
            <div class="header">
                <img src="${logoBase64 || logoPath}" alt="Logo" class="company-logo" />
                <div class="header-info">
                    <div class="header-row">
                        <div class="header-right">${companySettings.name || 'شركة أسيل'}</div>
                        <div class="header-left">${companySettings.address || ''}</div>
                    </div>
                    <div class="header-row">
                        <div class="header-right">${companySettings.phone || ''}</div>
                        <div class="header-left"></div>
                    </div>
                </div>
            </div>
            <div class="voucher-title">
                <div>سند قبض</div>
            </div>
            <div class="voucher-info">
                <table>
                    <tr>
                        <td>رقم السند:</td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>التاريخ:</td>
                        <td>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; / &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; / ${currentYear}</td>
                    </tr>
                    <tr>
                        <td>من:</td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>المبلغ:</td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>طريقة الدفع:</td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>ملاحظات:</td>
                        <td></td>
                    </tr>
                </table>
            </div>
            <div class="amount-section">
                <div>المبلغ المستلم</div>
                <div class="amount-value"></div>
            </div>
            <div class="balance-section">
                <table>
                    <tr>
                        <td>الرصيد القديم:</td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>المدفوع:</td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>الرصيد الجديد:</td>
                        <td></td>
                    </tr>
                </table>
            </div>
            <div class="signature">
                <div class="signature-box">
                    <div>توقيع العميل</div>
                </div>
                <div class="signature-box">
                    <div>توقيع المندوب المستلم</div>
                </div>
            </div>
        </div>
    `;

    return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>سند قبض احتياطي فارغ</title>
    <style>
        @page {
            size: A4;
            margin: 0;
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Arial', sans-serif;
            direction: rtl;
            background: white;
            padding: 0;
            margin: 0;
        }
        @media screen {
            body {
                padding: 20px;
                display: grid;
                grid-template-columns: 1fr 1fr;
                grid-template-rows: 1fr 1fr;
                gap: 20px;
                width: 100%;
                min-height: 100vh;
            }
        }
        @media print {
            body {
                width: 210mm;
                height: 297mm;
                display: grid;
                grid-template-columns: 1fr 1fr;
                grid-template-rows: 1fr 1fr;
                gap: 0;
            }
        }
        .receipt-wrapper {
            width: 100%;
            height: 100%;
            padding: 0 3mm 3mm 3mm;
            display: flex;
            align-items: flex-start;
            justify-content: center;
            page-break-inside: avoid;
            break-inside: avoid;
            box-sizing: border-box;
        }
        @media screen {
            .receipt-wrapper {
                padding: 10px;
            }
        }
        .voucher-container {
            border: 1.5px solid #333;
            padding: 0 8px 8px 8px;
            width: 100%;
            height: 100%;
            max-width: 95mm;
            max-height: 140mm;
            display: flex;
            flex-direction: column;
            font-size: 10px;
            page-break-inside: avoid;
            break-inside: avoid;
            position: relative;
            overflow: hidden;
            box-sizing: border-box;
        }
        .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 60px;
            font-weight: bold;
            color: rgba(0, 0, 0, 0.08);
            z-index: 0;
            pointer-events: none;
            white-space: nowrap;
        }
        .header {
            position: relative;
            z-index: 10;
        }
        .voucher-container > * {
            position: relative;
            z-index: 1;
        }
        @media screen {
            .voucher-container {
                max-width: 300px;
                max-height: 400px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
        }
        .header {
            margin-bottom: 4px;
            border-bottom: 1.5px solid #333;
            padding-bottom: 3px;
            margin-top: 0;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .company-logo {
            width: 30px;
            height: 30px;
            object-fit: contain;
            flex-shrink: 0;
        }
        .header-info {
            flex: 1;
        }
        .header-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 0;
        }
        .header-right {
            font-size: 9px;
            text-align: right;
            font-weight: bold;
        }
        .header-left {
            font-size: 9px;
            text-align: left;
        }
        .company-name {
            font-size: 13px;
            font-weight: bold;
            margin-bottom: 3px;
        }
        .header div {
            font-size: 9px;
            margin: 1px 0;
        }
        .voucher-title {
            font-size: 12px;
            font-weight: bold;
            text-align: center;
            margin: 4px 0;
            flex-shrink: 0;
        }
        .provisional-badge {
            background-color: #ffc107;
            color: #000;
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 9px;
            font-weight: bold;
            display: inline-block;
            margin-bottom: 4px;
        }
        .voucher-info {
            margin: 4px 0;
            flex-shrink: 1;
        }
        .voucher-info table {
            width: 100%;
        }
        .voucher-info td {
            padding: 2px 0;
            font-size: 9px;
        }
        .voucher-info td:first-child {
            font-weight: bold;
            width: 70px;
        }
        .voucher-info td:last-child {
            border-bottom: 1px dotted #333;
            min-height: 15px;
        }
        .amount-section {
            text-align: center;
            margin: 4px 0;
            padding: 4px;
            background: #f8f9fa;
            border-radius: 4px;
            flex-shrink: 1;
        }
        .amount-section > div:first-child {
            font-size: 9px;
        }
        .amount-value {
            font-size: 12px;
            font-weight: bold;
            color: #667eea;
            margin: 2px 0;
            border-bottom: 1.5px solid #667eea;
            min-height: 15px;
        }
        .signature {
            margin-top: auto;
            margin-bottom: 0;
            padding-top: 5px;
            display: flex;
            justify-content: space-between;
            gap: 4px;
            flex-shrink: 0;
            min-height: 25px;
        }
        .signature-box {
            width: 45%;
            text-align: center;
            border-top: 1px solid #333;
            padding-top: 3px;
            margin-top: 4px;
            font-size: 7px;
            flex-shrink: 0;
        }
        .balance-section {
            margin: 4px 0;
            padding: 4px;
            background: #f0f4f8;
            border-radius: 4px;
            border: 1px solid #ddd;
            flex-shrink: 1;
        }
        .balance-section table {
            width: 100%;
        }
        .balance-section td {
            padding: 2px 0;
            font-size: 8px;
        }
        .balance-section td:first-child {
            font-weight: bold;
            width: 80px;
        }
        .balance-section td:last-child {
            text-align: left;
            font-weight: bold;
            color: #2c3e50;
            border-bottom: 1px dotted #333;
            min-height: 15px;
        }
        .warning-note {
            background-color: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 3px;
            padding: 4px;
            margin: 4px 0;
            font-size: 8px;
            color: #856404;
            text-align: center;
        }
        @media print {
            body {
                padding: 0;
                margin: 0;
                width: 210mm;
                height: 297mm;
            }
            .receipt-wrapper {
                page-break-inside: avoid;
                break-inside: avoid;
            }
            .voucher-container {
                page-break-inside: avoid;
                break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="receipt-wrapper">${singleReceiptHTML}</div>
    <div class="receipt-wrapper">${singleReceiptHTML}</div>
    <div class="receipt-wrapper">${singleReceiptHTML}</div>
    <div class="receipt-wrapper">${singleReceiptHTML}</div>
</body>
    </html>
    `;
}

// View Blank Provisional Receipt
async function viewBlankProvisionalReceipt() {
    try {
        // Generate print content
        const printContent = await generateBlankProvisionalReceiptPrintContent();
        
        // Open window for viewing
        const viewWindow = window.open('', '_blank', 'width=800,height=1000');
        if (!viewWindow || viewWindow.closed || typeof viewWindow.closed === 'undefined') {
            console.error('Failed to open view window - may be blocked');
            if (window.showToast) {
                window.showToast('فشل فتح نافذة العرض. يرجى التحقق من إعدادات منع النوافذ المنبثقة', 'error');
            }
            return;
        }
        
        viewWindow.document.write(printContent);
        viewWindow.document.close();
        
        if (window.showToast) {
            window.showToast('تم فتح نافذة العرض', 'success');
        }
    } catch (error) {
        console.error('Error in viewBlankProvisionalReceipt:', error);
        if (window.showToast) {
            window.showToast('خطأ في عرض السند الاحتياطي الفارغ: ' + error.message, 'error');
        }
    }
}

// Print Blank Provisional Receipt
async function printBlankProvisionalReceipt() {
    try {
        // Generate print content
        const printContent = await generateBlankProvisionalReceiptPrintContent();
        
        // Open window off-screen or very small to minimize visibility
        const printWindow = window.open('', '_blank', 'width=1,height=1,left=-1000,top=-1000');
        if (!printWindow || printWindow.closed || typeof printWindow.closed === 'undefined') {
            console.error('Failed to open print window - may be blocked');
            if (window.showToast) {
                window.showToast('فشل فتح نافذة الطباعة. يرجى التحقق من إعدادات منع النوافذ المنبثقة', 'error');
            }
            return;
        }
        
        printWindow.document.write(printContent);
        printWindow.document.close();
        
        // Wait for content to load, then print directly
        setTimeout(() => {
            try {
                // Print directly - this will open print dialog
                printWindow.print();
                if (window.showToast) {
                    window.showToast('تم طباعة السند الاحتياطي الفارغ بنجاح', 'success');
                }
            } catch (printError) {
                console.error('Error calling print():', printError);
                if (window.showToast) {
                    window.showToast('تم فتح نافذة الطباعة. يرجى استخدام زر الطباعة في المتصفح', 'info');
                }
            }
        }, 500);
    } catch (error) {
        console.error('Error in printBlankProvisionalReceipt:', error);
        if (window.showToast) {
            window.showToast('خطأ في طباعة السند الاحتياطي الفارغ: ' + error.message, 'error');
        }
    }
}

// Save Receipt as PDF
async function saveReceiptAsPDF(receiptId) {
    const receipt = receipts.find(r => r.id === receiptId);
    if (!receipt) {
        if (window.showToast) {
            window.showToast('السند غير موجود', 'error');
        } else {
            alert('⚠️ السند غير موجود');
        }
        return;
    }

    try {
        // Generate receipt HTML content
        const receiptContent = await generateReceiptPrintContent(receipt);
        
        // Generate default file name
        const defaultFileName = `سند_قبض_${receipt.receiptNumber}_${new Date(receipt.date).toISOString().split('T')[0]}.pdf`;
        
        // Save to file
        if (window.electronAPI && window.electronAPI.saveInvoiceToFile) {
            try {
                const result = await window.electronAPI.saveInvoiceToFile(receiptContent, defaultFileName);
                if (result.success) {
                    if (window.showToast) {
                        window.showToast(`تم حفظ السند بنجاح في: ${result.filePath}`, 'success');
                    } else {
                        alert(`✅ تم حفظ السند بنجاح في: ${result.filePath}`);
                    }
                } else if (result.cancelled) {
                    // User cancelled, do nothing
                } else {
                    if (window.showToast) {
                        window.showToast('خطأ في حفظ السند: ' + (result.error || 'خطأ غير معروف'), 'error');
                    } else {
                        alert('❌ خطأ في حفظ السند: ' + (result.error || 'خطأ غير معروف'));
                    }
                }
            } catch (error) {
                console.error('Error saving receipt to file:', error);
                if (window.showToast) {
                    window.showToast('خطأ في حفظ السند: ' + error.message, 'error');
                } else {
                    alert('❌ خطأ في حفظ السند: ' + error.message);
                }
            }
        } else {
            if (window.showToast) {
                window.showToast('وظيفة حفظ الملف غير متاحة', 'error');
            } else {
                alert('⚠️ وظيفة حفظ الملف غير متاحة');
            }
        }
    } catch (error) {
        console.error('Error in saveReceiptAsPDF:', error);
        if (window.showToast) {
            window.showToast('خطأ في حفظ السند: ' + error.message, 'error');
        } else {
            alert('❌ خطأ في حفظ السند: ' + error.message);
        }
    }
}

// Close Modal
function closeModal() {
    document.getElementById('receiptModal').classList.remove('active');
    // Ensure focus is restored after closing modal
    setTimeout(() => {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
            activeElement.blur();
        }
        // Force focus on window to restore input capabilities
        window.focus();
    }, 100);
}

// Update status dropdown visual style
function updateStatusDropdownStyle(selectElement) {
    if (!selectElement) return;
    
    const value = selectElement.value;
    // Remove existing status classes
    selectElement.classList.remove('status-pending-active', 'status-delivered-active');
    
    if (value === 'pending') {
        selectElement.classList.add('status-pending-active');
        selectElement.style.borderColor = '#fbbf24';
        selectElement.style.background = 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)';
        selectElement.style.color = '#92400e';
    } else if (value === 'delivered') {
        selectElement.classList.add('status-delivered-active');
        selectElement.style.borderColor = '#10b981';
        selectElement.style.background = 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)';
        selectElement.style.color = '#065f46';
    }
}

// Prompt Dialog Function
function showPromptDialog(message, defaultValue = '') {
    return new Promise((resolve) => {
        // Create prompt modal
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.style.zIndex = '10001';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.style.maxWidth = '450px';
        
        const modalHeader = document.createElement('div');
        modalHeader.className = 'modal-header';
        modalHeader.innerHTML = `
            <h2 style="margin: 0; font-size: 1.25rem;">إدخال</h2>
            <button class="modal-close">&times;</button>
        `;
        
        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';
        modalBody.style.padding = '24px';
        
        const messageP = document.createElement('p');
        messageP.style.margin = '0 0 16px 0';
        messageP.style.fontSize = '1rem';
        messageP.style.color = 'var(--text-primary)';
        messageP.style.lineHeight = '1.6';
        messageP.textContent = message;
        
        const inputDiv = document.createElement('div');
        inputDiv.style.marginBottom = '24px';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-control';
        input.style.width = '100%';
        input.style.padding = '10px';
        input.style.fontSize = '1rem';
        input.value = defaultValue;
        input.placeholder = 'أدخل النص هنا...';
        
        inputDiv.appendChild(input);
        
        const buttonsDiv = document.createElement('div');
        buttonsDiv.style.display = 'flex';
        buttonsDiv.style.gap = '12px';
        buttonsDiv.style.justifyContent = 'flex-end';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.style.minWidth = '100px';
        cancelBtn.textContent = 'إلغاء';
        
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'btn btn-primary';
        confirmBtn.style.minWidth = '100px';
        confirmBtn.textContent = 'موافق';
        
        buttonsDiv.appendChild(cancelBtn);
        buttonsDiv.appendChild(confirmBtn);
        
        modalBody.appendChild(messageP);
        modalBody.appendChild(inputDiv);
        modalBody.appendChild(buttonsDiv);
        
        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalBody);
        modal.appendChild(modalContent);
        
        document.body.appendChild(modal);
        
        // Focus on input
        setTimeout(() => {
            input.focus();
            input.select();
        }, 100);
        
        // Close button handler
        const closeBtn = modalHeader.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => {
            modal.remove();
            resolve(null);
        });
        
        // Cancel button handler
        cancelBtn.addEventListener('click', () => {
            modal.remove();
            resolve(null);
        });
        
        // Confirm button handler
        confirmBtn.addEventListener('click', () => {
            const value = input.value.trim();
            modal.remove();
            resolve(value);
        });
        
        // Enter key handler
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const value = input.value.trim();
                modal.remove();
                resolve(value);
            }
        });
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                resolve(null);
            }
        });
    });
}

// Make functions global
window.viewReceipt = viewReceipt;
window.saveReceiptAsPDF = saveReceiptAsPDF;
window.printReceipt = printReceipt;
window.updateStatusDropdownStyle = updateStatusDropdownStyle;

