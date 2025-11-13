// Payment Vouchers Management System

const STORAGE_KEYS = {
    PAYMENTS: 'asel_payment_vouchers',
    SUPPLIERS: 'asel_suppliers',
    PAYMENT_COUNTER: 'asel_payment_counter'
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

let payments = [];
let suppliers = [];
let isSavingPayment = false; // Flag to prevent duplicate form submissions

// Pagination & Filter State
let currentPage = 1;
const itemsPerPage = 20;
let filteredPayments = [];
let searchQuery = '';
let dateFrom = '';
let dateTo = '';
let paymentMethodFilter = '';
let sortBy = 'date-desc';

// Load data on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    initializeEventListeners();
    renderSuppliers();
    await applyFilters();
});

// Initialize Event Listeners
function initializeEventListeners() {
    // New Payment Button
    document.getElementById('newPaymentBtn').addEventListener('click', () => {
        openNewPayment();
    });
    
    // Empty state button
    const emptyStateBtn = document.getElementById('emptyStateAddBtn');
    if (emptyStateBtn) {
        emptyStateBtn.addEventListener('click', () => {
            document.getElementById('newPaymentBtn').click();
        });
    }

    // Modal Close Buttons
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);

    // Form Submit
    document.getElementById('paymentForm').addEventListener('submit', handleFormSubmit);

    // Supplier Selection
    document.getElementById('supplierSelect').addEventListener('change', onSupplierChange);

    // Amount Input - Calculate balance
    document.getElementById('amount').addEventListener('input', () => calculateBalance());
    
    // Payment Date - Calculate balance on date change
    document.getElementById('paymentDate').addEventListener('change', () => calculateBalance());
    
    // Status dropdown - Update visual style based on selection
    const paymentStatusSelect = document.getElementById('paymentStatus');
    if (paymentStatusSelect) {
        paymentStatusSelect.addEventListener('change', function() {
            updateStatusDropdownStyle(this);
        });
        // Initialize style on load
        updateStatusDropdownStyle(paymentStatusSelect);
    }

    // Close modal on backdrop click
    document.getElementById('paymentModal').addEventListener('click', (e) => {
        if (e.target.id === 'paymentModal') {
            closeModal();
        }
    });

    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('paymentDate').value = today;

    // Pagination Event Listeners
    document.getElementById('prevPageBtn').addEventListener('click', async () => {
        if (currentPage > 1) {
            currentPage--;
            await applyFilters();
        }
    });
    
    document.getElementById('nextPageBtn').addEventListener('click', async () => {
        const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
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
            payments = await window.electronAPI.dbGetAll('payments', '', []);
            suppliers = await window.electronAPI.dbGetAll('suppliers', '', []);
            
            // Ensure arrays
            payments = Array.isArray(payments) ? payments : [];
            suppliers = Array.isArray(suppliers) ? suppliers : [];
            
            return;
        } catch (error) {
            console.error('Error loading from database:', error);
        }
    }
    
    // Fallback to localStorage (for migration only)
    const paymentsData = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
    const suppliersData = localStorage.getItem(STORAGE_KEYS.SUPPLIERS);

    payments = paymentsData ? JSON.parse(paymentsData) : [];
    suppliers = suppliersData ? JSON.parse(suppliersData) : [];
}

// Save Payments
async function savePayments() {
    // Save to database if available
    if (window.electronAPI && window.electronAPI.dbInsert && window.electronAPI.dbUpdate) {
        // This function is called after saving individual payments
        // The actual save happens in handleFormSubmit
        return;
    }
    
    // Fallback to localStorage
    localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));
}

// Generate Payment Number
async function generatePaymentNumber() {
    const year = new Date().getFullYear();
    const prefix = `PAY-${year}-`;
    
    // Try to get counter from database first (more reliable)
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            // Get all payments from database
            const allPayments = await window.electronAPI.dbGetAll('payments', '', []);
            
            if (allPayments && allPayments.length > 0) {
                // Filter payments with numbers matching current year pattern
                const currentYearNumbers = allPayments
                    .map(payment => payment.paymentNumber)
                    .filter(number => number && number.startsWith(prefix));
                
                // Extract numbers from payment numbers (e.g., "PAY-2025-001" -> 1)
                const numbers = currentYearNumbers.map(number => {
                    const match = number.match(new RegExp(`${prefix}(\\d+)`));
                    return match ? parseInt(match[1]) : 0;
                });
                
                // Get maximum number
                const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
                const counter = maxNumber + 1;
                
                // Save to localStorage as backup
                localStorage.setItem(STORAGE_KEYS.PAYMENT_COUNTER, counter.toString());
                
                return `${prefix}${String(counter).padStart(3, '0')}`;
            }
        } catch (error) {
            console.error('Error generating payment number from database:', error);
            // Fallback to localStorage
        }
    }
    
    // Fallback: use localStorage counter
    let counter = parseInt(localStorage.getItem(STORAGE_KEYS.PAYMENT_COUNTER) || '0');
    counter++;
    localStorage.setItem(STORAGE_KEYS.PAYMENT_COUNTER, counter.toString());
    
    return `${prefix}${String(counter).padStart(3, '0')}`;
}

// Render Suppliers
function renderSuppliers() {
    const select = document.getElementById('supplierSelect');
    select.innerHTML = '<option value="" disabled selected>اختر المورد</option>';
    
    // Sort suppliers by name for better UX
    const sortedSuppliers = [...suppliers].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    
    sortedSuppliers.forEach(supplier => {
        const option = document.createElement('option');
        option.value = supplier.id;
        // Display supplier name with code in a more readable format
        option.textContent = `${supplier.name} (${supplier.code})`;
        option.setAttribute('data-supplier-name', supplier.name);
        option.setAttribute('data-supplier-code', supplier.code);
        select.appendChild(option);
    });
}

// Open New Payment
function openNewPayment() {
    document.getElementById('isEdit').value = 'false';
    document.getElementById('paymentId').value = '';
    document.getElementById('modalTitle').textContent = 'سند صرف جديد';
    document.getElementById('paymentForm').reset();
    document.getElementById('supplierInfo').classList.add('hidden');
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('paymentDate').value = today;
    document.getElementById('paymentMethod').value = 'cash';
    document.getElementById('paymentModal').classList.add('active');
    
    // Ensure focus is restored after opening modal
    setTimeout(() => {
        window.focus();
        // Try to focus on first input field
        const firstInput = document.querySelector('#paymentModal input:not([type="hidden"]), #paymentModal select, #paymentModal textarea');
        if (firstInput) {
            setTimeout(() => {
                firstInput.focus();
            }, 50);
        }
    }, 100);
}

// On Supplier Change
async function onSupplierChange() {
    const supplierId = document.getElementById('supplierSelect').value;
    if (!supplierId) {
        document.getElementById('supplierInfo').classList.add('hidden');
        return;
    }

    const supplier = suppliers.find(s => s.id === supplierId);
    if (supplier) {
        // إعادة تحميل المورد من قاعدة البيانات للحصول على الرصيد المحدث
        if (window.electronAPI && window.electronAPI.dbGet) {
            try {
                const dbSupplier = await window.electronAPI.dbGet('suppliers', supplierId);
                if (dbSupplier) {
                    // تحديث المورد في المصفوفة المحلية بأحدث البيانات من قاعدة البيانات
                    const supplierIndex = suppliers.findIndex(s => s.id === supplierId);
                    if (supplierIndex !== -1) {
                        suppliers[supplierIndex] = { ...suppliers[supplierIndex], ...dbSupplier };
                        console.log('[Payments] onSupplierChange - Reloaded supplier from database, balance:', dbSupplier.balance);
                    }
                }
            } catch (error) {
                console.error('[Payments] Error reloading supplier from database:', error);
                // Continue with local supplier data if database reload fails
            }
        }
        
        await calculateBalance();
        document.getElementById('supplierInfo').classList.remove('hidden');
    }
}

// Calculate Balance
async function calculateBalance() {
    const supplierId = document.getElementById('supplierSelect').value;
    const amount = parseFloat(document.getElementById('amount').value) || 0;
    const isEdit = document.getElementById('isEdit').value === 'true';
    const paymentId = document.getElementById('paymentId').value;

    if (!supplierId) {
        document.getElementById('supplierInfo').classList.add('hidden');
        return;
    }

    // Reload supplier from database to get latest balance
    let supplier = suppliers.find(s => s.id === supplierId);
    if (supplier && window.electronAPI && window.electronAPI.dbGet) {
        try {
            const dbSupplier = await window.electronAPI.dbGet('suppliers', supplierId);
            if (dbSupplier) {
                const supplierIndex = suppliers.findIndex(s => s.id === supplierId);
                if (supplierIndex !== -1) {
                    suppliers[supplierIndex] = { ...suppliers[supplierIndex], ...dbSupplier };
                    supplier = suppliers[supplierIndex];
                    console.log('[Payments] calculateBalance - Reloaded supplier from database, balance:', supplier.balance);
                }
            }
        } catch (error) {
            console.error('[Payments] Error reloading supplier from database in calculateBalance:', error);
        }
    }

    if (supplier) {
        // Use the updated balance from database directly (already reloaded above)
        // الرصيد في قاعدة البيانات محفوظ بالجنيه المصري مباشرة
        let oldBalance = parseFloat(supplier.balance || 0);
        
        // If editing existing payment, add back the old payment amount to get the balance before this payment
                if (isEdit && paymentId) {
            try {
                    const oldPayment = payments.find(p => p.id === paymentId);
                if (!oldPayment && window.electronAPI && window.electronAPI.dbGet) {
                    // Try to get from database if not in local array
                    const dbPayment = await window.electronAPI.dbGet('payments', paymentId);
                    if (dbPayment && dbPayment.supplierId === supplierId) {
                        // المبلغ في قاعدة البيانات محفوظ بالجنيه المصري مباشرة
                        const oldAmount = parseFloat(dbPayment.amount || 0);
                        oldBalance = oldBalance + oldAmount;
                        console.log('[Payments] calculateBalance - Added back old payment amount for edit:', oldAmount);
                    }
                } else if (oldPayment && oldPayment.supplierId === supplierId) {
                    // المبلغ في قاعدة البيانات محفوظ بالجنيه المصري مباشرة
                    const oldAmount = parseFloat(oldPayment.amount || 0);
                    oldBalance = oldBalance + oldAmount;
                    console.log('[Payments] calculateBalance - Added back old payment amount for edit:', oldAmount);
                }
            } catch (error) {
                console.error('[Payments] Error getting old payment in calculateBalance:', error);
                // Continue with current balance if error
            }
        }

        // Payment decreases supplier debt (balance) - when we pay, debt decreases
        const newBalance = oldBalance - amount;
        
        console.log('[Payments] calculateBalance - Using updated balance from database:', {
            supplierId,
            oldBalance,
            amount,
            newBalance,
            isEdit
        });

        document.getElementById('oldBalance').textContent = `${oldBalance.toFixed(2)} ج.م`;
        document.getElementById('newBalance').textContent = `${newBalance.toFixed(2)} ج.م`;
        document.getElementById('supplierInfo').classList.remove('hidden');
    }
}

// Handle Form Submit
async function handleFormSubmit(e) {
    e.preventDefault();
    
    // منع الضغط المتكرر
    if (isSavingPayment) {
        console.log('[Payments] Save already in progress, ignoring duplicate submit');
        return;
    }
    
    // تعيين حالة الحفظ
    isSavingPayment = true;
    
    // تعطيل زر الحفظ وتغيير النص
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalButtonText = submitButton ? submitButton.textContent : '';
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'جاري الحفظ...';
    }
    
    try {
        const date = document.getElementById('paymentDate').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const paymentMethod = document.getElementById('paymentMethod').value;
    const notes = document.getElementById('notes').value.trim();
    const supplierId = document.getElementById('supplierSelect').value;

    if (!supplierId) {
        if (window.showToast) {
            window.showToast('يرجى اختيار المورد', 'error');
        } else {
            alert('⚠️ يرجى اختيار المورد');
        }
        isSavingPayment = false;
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
        isSavingPayment = false;
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
        return;
    }

    const paymentId = document.getElementById('paymentId').value || Date.now().toString();
    const isEdit = document.getElementById('isEdit').value === 'true';

    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) {
        if (window.showToast) {
            window.showToast('المورد غير موجود', 'error');
        } else {
            alert('⚠️ المورد غير موجود');
        }
        isSavingPayment = false;
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
        return;
    }

    // Check if payment amount exceeds supplier balance (only for new payments, not edits)
    if (!isEdit) {
        // الرصيد في قاعدة البيانات محفوظ بالجنيه المصري مباشرة
        const supplierBalance = parseFloat(supplier.balance) || 0;
        
        // If editing, we need to account for the old payment amount
        let effectiveBalance = supplierBalance;
        if (isEdit && paymentId) {
            const oldPayment = payments.find(p => p.id === paymentId);
            if (oldPayment && oldPayment.supplierId === supplierId) {
                // Add back the old payment amount to get balance before this payment
                effectiveBalance = supplierBalance + oldPayment.amount;
            }
        }
        
        // Check if amount exceeds balance
        if (amount > effectiveBalance) {
            const excessAmount = amount - effectiveBalance;
            const warningMessage = `⚠️ تحذير: مبلغ السند (${amount.toFixed(2)} ج.م) أكبر من رصيد المورد (${effectiveBalance.toFixed(2)} ج.م)\n\nالفرق: ${excessAmount.toFixed(2)} ج.م\n\nسيصبح رصيد المورد سالباً (المورد سيدين لنا). هل تريد المتابعة؟`;
            
            // Use showConfirmDialog if available, otherwise use confirm
            if (typeof showConfirmDialog === 'function') {
                showConfirmDialog(
                    warningMessage,
                    () => {
                        // User confirmed - proceed with payment
                        proceedWithPayment().finally(() => {
                            isSavingPayment = false;
                            if (submitButton) {
                                submitButton.disabled = false;
                                submitButton.textContent = originalButtonText;
                            }
                        });
                    },
                    () => {
                        // User cancelled - reset button
                        isSavingPayment = false;
                        if (submitButton) {
                            submitButton.disabled = false;
                            submitButton.textContent = originalButtonText;
                        }
                    }
                );
            } else {
                if (confirm(warningMessage)) {
                    proceedWithPayment().finally(() => {
                        isSavingPayment = false;
                        if (submitButton) {
                            submitButton.disabled = false;
                            submitButton.textContent = originalButtonText;
                        }
                    });
                } else {
                    isSavingPayment = false;
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = originalButtonText;
                    }
                }
            }
            return;
        }
    }
    
    // Proceed with payment if amount is valid
    await proceedWithPayment();
    } catch (error) {
        console.error('Error in handleFormSubmit:', error);
        if (window.showToast) {
            window.showToast('خطأ في حفظ السند: ' + error.message, 'error');
        } else {
            alert('✗ خطأ في حفظ السند: ' + error.message);
        }
    } finally {
        // إعادة تفعيل الزر في جميع الحالات
        isSavingPayment = false;
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
    }
}

// Proceed with payment after confirmation
async function proceedWithPayment() {
    const date = document.getElementById('paymentDate').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const paymentMethod = document.getElementById('paymentMethod').value;
    const notes = document.getElementById('notes').value.trim();
    const supplierId = document.getElementById('supplierSelect').value;
    const paymentId = document.getElementById('paymentId').value || Date.now().toString();
    const isEdit = document.getElementById('isEdit').value === 'true';
    const supplier = suppliers.find(s => s.id === supplierId);

    let paymentData = {
        id: paymentId,
        paymentNumber: isEdit ? 
            payments.find(p => p.id === paymentId)?.paymentNumber : 
            await generatePaymentNumber(),
        date: date,
        amount: amount,
        paymentMethod: paymentMethod,
        notes: notes || '',
        supplierId: supplierId,
        toName: supplier.name,
        createdAt: isEdit ? 
            payments.find(p => p.id === paymentId)?.createdAt : 
            new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    try {
        // Check if payment amount exceeds supplier balance (for edits too)
        if (isEdit) {
            // الرصيد في قاعدة البيانات محفوظ بالجنيه المصري مباشرة
        const supplierBalance = parseFloat(supplier.balance) || 0;
            const oldPayment = payments.find(p => p.id === paymentId);
            
            // Calculate effective balance (add back old payment amount)
            let effectiveBalance = supplierBalance;
            if (oldPayment && oldPayment.supplierId === supplierId) {
                effectiveBalance = supplierBalance + oldPayment.amount;
            }
            
            // Check if new amount exceeds balance
            if (amount > effectiveBalance) {
                const excessAmount = amount - effectiveBalance;
                const warningMessage = `⚠️ تحذير: مبلغ السند الجديد (${amount.toFixed(2)} ج.م) أكبر من رصيد المورد (${effectiveBalance.toFixed(2)} ج.م)\n\nالفرق: ${excessAmount.toFixed(2)} ج.م\n\nسيصبح رصيد المورد سالباً (المورد سيدين لنا). هل تريد المتابعة؟`;
                
                // Use showConfirmDialog if available, otherwise use confirm
                if (typeof showConfirmDialog === 'function') {
                    showConfirmDialog(
                        warningMessage,
                        () => {
                            // User confirmed - proceed with payment save
                            proceedWithPaymentSave();
                        },
                        () => {
                            // User cancelled - do nothing
                        }
                    );
                } else {
                    if (confirm(warningMessage)) {
                        proceedWithPaymentSave();
                    }
                }
                return;
            }
        }
        
        // Proceed with payment save
        proceedWithPaymentSave();
    } catch (error) {
        console.error('Error in proceedWithPayment:', error);
        if (window.showToast) {
            window.showToast('خطأ في حفظ سند الصرف: ' + error.message, 'error');
        } else {
            alert('✗ خطأ في حفظ سند الصرف: ' + error.message);
        }
    }
}

// Proceed with payment save after confirmation
async function proceedWithPaymentSave() {
    const date = document.getElementById('paymentDate').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const paymentMethod = document.getElementById('paymentMethod').value;
    const notes = document.getElementById('notes').value.trim();
    const supplierId = document.getElementById('supplierSelect').value;
    const paymentId = document.getElementById('paymentId').value || Date.now().toString();
    const isEdit = document.getElementById('isEdit').value === 'true';
    const supplier = suppliers.find(s => s.id === supplierId);
    
    // إعادة تحميل المورد من قاعدة البيانات للحصول على الرصيد الحالي المحدث
    let supplierForBalance = supplier;
    if (window.electronAPI && window.electronAPI.dbGet) {
        try {
            const dbSupplier = await window.electronAPI.dbGet('suppliers', supplierId);
            if (dbSupplier) {
                supplierForBalance = dbSupplier;
                console.log('[Payments] proceedWithPaymentSave - Reloaded supplier from database, current balance:', supplierForBalance.balance);
            }
        } catch (error) {
            console.error('[Payments] Error reloading supplier from database in proceedWithPaymentSave:', error);
            // Continue with local supplier data if database reload fails
        }
    }
    
    // الرصيد القديم = الرصيد الحالي من قاعدة البيانات مباشرة
    let calculatedOldBalance = parseFloat(supplierForBalance.balance || 0);
    
    // عند تعديل سند صرف موجود: إضافة المبلغ القديم للسند لإرجاع الرصيد إلى ما كان عليه قبل هذا السند
    if (isEdit && paymentId) {
        const oldPayment = payments.find(p => p.id === paymentId);
        if (oldPayment && oldPayment.supplierId === supplierId) {
            const oldAmount = parseFloat(oldPayment.amount || 0);
            calculatedOldBalance = calculatedOldBalance + oldAmount;
            console.log('[Payments] proceedWithPaymentSave - Editing payment: Added back old payment amount to get balance before this payment:', {
                currentBalance: parseFloat(supplierForBalance.balance || 0),
                oldAmount,
                calculatedOldBalance
            });
        }
    }
    
    // الرصيد يُحفظ بالجنيه المصري مباشرة في قاعدة البيانات
    const oldBalanceToSave = calculatedOldBalance;
    
    // حساب الرصيد الجديد (oldBalance - amount)
    // سند الصرف يقلل دين المورد (الرصيد)
    const newBalanceToSave = oldBalanceToSave - amount;
    
    console.log('[Payments] proceedWithPaymentSave - Balance calculations to save in payment:', {
        calculatedOldBalance,
        oldBalanceToSave,
        amount,
        newBalanceToSave,
        isEdit
    });

    let paymentData = {
        id: paymentId,
        paymentNumber: isEdit ? 
            payments.find(p => p.id === paymentId)?.paymentNumber : 
            await generatePaymentNumber(),
        date: date,
        amount: amount,
        paymentMethod: paymentMethod,
        notes: notes || '',
        supplierId: supplierId,
        toName: supplier.name,
        // الرصيد القديم يُحفظ في عمود oldBalance في جدول payments
        // الرصيد القديم = الرصيد الحالي من قاعدة البيانات (قبل خصم هذا السند)
        // ⚠️ مهم: هذه القيم تظل ثابتة ولا تتغير حتى بعد إنشاء فواتير جديدة أو سندات صرف
        // لأنها تمثل "لقطة تاريخية" (snapshot) من الرصيد في وقت إنشاء السند
        oldBalance: oldBalanceToSave,
        // الرصيد الجديد يُحفظ في عمود newBalance
        // الرصيد الجديد = الرصيد القديم - المبلغ
        // ⚠️ هذه القيمة تظل ثابتة ولا تتغير
        newBalance: newBalanceToSave,
        createdAt: isEdit ? 
            payments.find(p => p.id === paymentId)?.createdAt : 
            new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    try {
        // Save to database if available
        if (window.electronAPI && window.electronAPI.dbInsert && window.electronAPI.dbUpdate) {
            if (isEdit) {
                // Update existing payment
                const oldPayment = payments.find(p => p.id === paymentId);
                if (oldPayment) {
                    // Update supplier balance directly for both old and new supplier (if changed)
                    if (oldPayment.supplierId) {
                        // Add back old payment amount to old supplier
                        const oldSupplier = await window.electronAPI.dbGet('suppliers', oldPayment.supplierId);
                        if (oldSupplier) {
                            const newOldSupplierBalance = (parseFloat(oldSupplier.balance || 0) + parseFloat(oldPayment.amount || 0));
                            await window.electronAPI.dbUpdate('suppliers', oldPayment.supplierId, {
                                ...oldSupplier,
                                balance: newOldSupplierBalance,
                                updatedAt: new Date().toISOString()
                            });
                        }
                    }
                    // Apply new payment amount (subtract) if supplier
                    if (paymentData.supplierId) {
                        if (oldPayment.supplierId !== paymentData.supplierId) {
                            // Supplier changed: update new supplier balance
                            const newSupplier = await window.electronAPI.dbGet('suppliers', paymentData.supplierId);
                            if (newSupplier) {
                                const newSupplierBalance = (parseFloat(newSupplier.balance || 0) - parseFloat(paymentData.amount || 0));
                                await window.electronAPI.dbUpdate('suppliers', paymentData.supplierId, {
                                    ...newSupplier,
                                    balance: newSupplierBalance,
                                    updatedAt: new Date().toISOString()
                                });
                            }
                        } else {
                            // Same supplier: update balance directly (add old amount, subtract new amount)
                            const supplier = await window.electronAPI.dbGet('suppliers', paymentData.supplierId);
                            if (supplier) {
                                const newBalance = (parseFloat(supplier.balance || 0) + parseFloat(oldPayment.amount || 0) - parseFloat(paymentData.amount || 0));
                                await window.electronAPI.dbUpdate('suppliers', paymentData.supplierId, {
                                    ...supplier,
                                    balance: newBalance,
                                    updatedAt: new Date().toISOString()
                                });
                            }
                        }
                    }
                    // Update payment in database
                    const updateResult = await window.electronAPI.dbUpdate('payments', paymentId, paymentData);
                    
                    // Check if update was successful
                    if (!updateResult || !updateResult.success) {
                        const errorMsg = updateResult?.error || 'خطأ غير معروف';
                        console.error('Failed to update payment in database:', errorMsg);
                        throw new Error('فشل تحديث الدفعة في قاعدة البيانات: ' + errorMsg);
                    }
                    
                    // Update local array only after successful database update
                    const index = payments.findIndex(p => p.id === paymentId);
                    if (index !== -1) {
                        payments[index] = paymentData;
                    }
                }
            } else {
                // New payment
                // Add createdBy to track who created this payment
                if (!paymentData.createdBy) {
                    if (typeof addCreatedBy === 'function') {
                        addCreatedBy(paymentData);
                    } else {
                        const currentUser = localStorage.getItem('asel_user') || localStorage.getItem('asel_userId') || '';
                        if (currentUser) {
                            paymentData.createdBy = currentUser;
                        }
                    }
                }
                
                const insertResult = await window.electronAPI.dbInsert('payments', paymentData);
                
                // Check if insert was successful
                if (!insertResult || !insertResult.success) {
                    const errorMsg = insertResult?.error || 'خطأ غير معروف';
                    console.error('Failed to insert payment to database:', errorMsg);
                    throw new Error('فشل حفظ الدفعة في قاعدة البيانات: ' + errorMsg);
                }
                payments.push(paymentData);
                // Update supplier balance directly (subtract payment amount)
                const supplier = await window.electronAPI.dbGet('suppliers', paymentData.supplierId);
                if (supplier) {
                    const newBalance = (parseFloat(supplier.balance || 0) - parseFloat(paymentData.amount || 0));
                    await window.electronAPI.dbUpdate('suppliers', paymentData.supplierId, {
                        ...supplier,
                        balance: newBalance,
                        lastTransactionDate: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                }
                // Update first transaction date
                await updateSupplierFirstTransactionDate(paymentData.supplierId);
            }
        } else {
            // Fallback to localStorage
            if (isEdit) {
                const index = payments.findIndex(p => p.id === paymentId);
                if (index !== -1) {
                    const oldPayment = payments[index];
                    // Revert old amount (add back the old payment)
                    if (oldPayment.supplierId) {
                        updateSupplierBalance(oldPayment.supplierId, oldPayment.amount);
                    }
                    // Apply new amount (subtract the new payment)
                    if (paymentData.supplierId) {
                        updateSupplierBalance(paymentData.supplierId, -paymentData.amount);
                    }
                    payments[index] = paymentData;
                }
            } else {
                payments.push(paymentData);
                // Update supplier balance (subtract payment amount - reduces debt)
                updateSupplierBalance(paymentData.supplierId, -paymentData.amount);
            }
            savePayments();
        }
        
        // Balance is already updated directly above, no need to recalculate
        
        currentPage = 1;
        await applyFilters();
        closeModal();
        if (window.showToast) {
            window.showToast('تم حفظ سند الصرف بنجاح', 'success');
        } else {
            alert('✓ تم حفظ سند الصرف بنجاح');
        }
    } catch (error) {
        console.error('Error saving payment:', error);
        if (window.showToast) {
            window.showToast('خطأ في حفظ سند الصرف: ' + error.message, 'error');
        } else {
            alert('✗ خطأ في حفظ سند الصرف: ' + error.message);
        }
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

// Update Supplier Balance in Database
async function updateSupplierBalanceInDB(supplierId, amount) {
    if (window.electronAPI && window.electronAPI.dbGet && window.electronAPI.dbUpdate) {
        try {
            const supplier = await window.electronAPI.dbGet('suppliers', supplierId);
            if (supplier) {
                const newBalance = (parseFloat(supplier.balance) || 0) + amount;
                await window.electronAPI.dbUpdate('suppliers', supplierId, {
                    ...supplier,
                    balance: newBalance,
                    lastTransactionDate: new Date().toISOString()
                });
                
                // Update first transaction date
                await updateSupplierFirstTransactionDate(supplierId);
                
                // Update local array
                const localSupplier = suppliers.find(s => s.id === supplierId);
                if (localSupplier) {
                    localSupplier.balance = newBalance;
                    localSupplier.lastTransactionDate = new Date().toISOString();
                }
            }
        } catch (error) {
            console.error('Error updating supplier balance in database:', error);
        }
    }
}

// Update Supplier Balance (localStorage fallback)
function updateSupplierBalance(supplierId, amount) {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (supplier) {
        supplier.balance = (supplier.balance || 0) + amount;
        supplier.lastTransactionDate = new Date().toISOString();
        localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(suppliers));
    }
}

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
    
    // Start with all payments
    filteredPayments = [...payments];
    
    // Apply search filter
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredPayments = filteredPayments.filter(payment => {
            // Search by payment number
            const paymentNumber = (payment.paymentNumber || '').toLowerCase();
            if (paymentNumber.includes(query)) return true;
            
            // Search by supplier name
            const supplier = suppliers.find(s => s.id === payment.supplierId);
            if (supplier) {
                const supplierName = (supplier.name || '').toLowerCase();
                if (supplierName.includes(query)) return true;
            }
            
            return false;
        });
    }
    
    // Apply date range filter (use effectiveDateFrom and effectiveDateTo)
    if (effectiveDateFrom) {
        filteredPayments = filteredPayments.filter(payment => {
            return new Date(payment.date) >= new Date(effectiveDateFrom);
        });
    }
    
    if (effectiveDateTo) {
        filteredPayments = filteredPayments.filter(payment => {
            const paymentDate = new Date(payment.date);
            const toDate = new Date(effectiveDateTo);
            toDate.setHours(23, 59, 59, 999); // Include entire day
            return paymentDate <= toDate;
        });
    }
    
    // Apply payment method filter
    if (paymentMethodFilter) {
        filteredPayments = filteredPayments.filter(payment => {
            return payment.paymentMethod === paymentMethodFilter;
        });
    }
    
    // Apply sorting
    filteredPayments.sort((a, b) => {
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
                return (b.paymentNumber || '').localeCompare(a.paymentNumber || '');
            case 'number-asc':
                return (a.paymentNumber || '').localeCompare(b.paymentNumber || '');
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
    const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
        currentPage = 1;
    }
    
    // Render paginated payments
    await renderPayments();
}

async function renderPayments() {
    const tbody = document.getElementById('paymentsTableBody');
    const emptyState = document.getElementById('emptyState');
    const paginationContainer = document.getElementById('paginationContainer');
    
    tbody.innerHTML = '';
    
    if (filteredPayments.length === 0) {
        emptyState.classList.remove('hidden');
        paginationContainer.classList.add('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    paginationContainer.classList.remove('hidden');

    // Calculate pagination
    const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredPayments.length);
    const paginatedPayments = filteredPayments.slice(startIndex, endIndex);
    
    // Get current logged-in user type
    const currentUserType = localStorage.getItem('asel_userType') || '';
    // السماح لجميع المستخدمين بالتعديل إذا كانت الحالة "مسودة"
    // يمكن تعديل canEditPayments لاحقاً إذا لزم الأمر للحالات الأخرى
    const canDeletePayments = currentUserType === 'manager' || currentUserType === 'system_engineer';
    
    // Update pagination info
    document.getElementById('paginationInfo').textContent = 
        `عرض ${startIndex + 1} - ${endIndex} من ${filteredPayments.length}`;
    
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
    
    for (const payment of paginatedPayments) {
        const paymentMethodText = {
            'cash': 'نقدي',
            'bank': 'تحويل بنكي',
            'check': 'شيك',
            'wallet': 'محفظة إلكترونية'
        };
        
        const supplier = payment.supplierId ? suppliers.find(s => s.id === payment.supplierId) : null;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${payment.paymentNumber}</td>
            <td>${new Date(payment.date).toLocaleDateString('ar-EG')}</td>
            <td class="supplier-name-cell">${supplier ? `<strong>${supplier.name}</strong>` : '-'}</td>
            <td class="payment-amount-cell"><strong>${formatArabicCurrency(payment.amount)}</strong></td>
            <td><span class="payment-method-badge">${paymentMethodText[payment.paymentMethod] || payment.paymentMethod}</span></td>
            <td>${payment.notes || '-'}</td>
            <td class="created-by-cell">${payment.createdBy || '-'}</td>
            <td>
                <div class="actions-buttons">
                    <button class="action-btn view" data-payment-id="${payment.id}" title="عرض">👁️</button>
                    <button class="action-btn save" data-payment-id="${payment.id}" title="حفظ">💾</button>
                    <button class="action-btn print" data-payment-id="${payment.id}" title="طباعة">🖨️</button>
                </div>
            </td>
        `;
        
        // Add event listeners to buttons
        const viewBtn = row.querySelector('.action-btn.view');
        const saveBtn = row.querySelector('.action-btn.save');
        const printBtn = row.querySelector('.action-btn.print');
        const actionsDiv = row.querySelector('.actions-buttons');
        
        if (viewBtn) {
            viewBtn.addEventListener('click', () => viewPayment(payment.id));
        }
        if (saveBtn) {
            saveBtn.addEventListener('click', () => savePaymentAsPDF(payment.id));
        }
        if (printBtn) {
            printBtn.addEventListener('click', () => printPayment(payment.id));
        }
        
        tbody.appendChild(row);
    }
}

// View Payment
function viewPayment(paymentId) {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) return;
    
    const supplier = payment.supplierId ? suppliers.find(s => s.id === payment.supplierId) : null;
    
    const paymentMethodText = {
        'cash': 'نقدي',
        'bank': 'تحويل بنكي',
        'check': 'شيك',
        'wallet': 'محفظة إلكترونية'
    };

    // Calculate balances
    const currentBalance = supplier ? (supplier.balance || 0) : 0;
    const oldBalance = currentBalance + payment.amount; // الرصيد القديم = الرصيد الحالي + المدفوع
    const paidAmount = payment.amount; // المدفوع
    const newBalance = currentBalance; // الرصيد الجديد = الرصيد الحالي

    const paymentInfo = `سند صرف رقم: ${payment.paymentNumber}\nالتاريخ: ${new Date(payment.date).toLocaleDateString('ar-EG')}\nالمورد: ${supplier ? supplier.name : '-'}\nالمبلغ: ${formatArabicCurrency(payment.amount)}\nطريقة الدفع: ${paymentMethodText[payment.paymentMethod] || payment.paymentMethod}\n\nالرصيد القديم: ${oldBalance.toFixed(2)} ج.م\nالمدفوع: ${paidAmount.toFixed(2)} ج.م\nالرصيد الجديد: ${newBalance.toFixed(2)} ج.م\n${payment.notes ? `\nملاحظات: ${payment.notes}` : ''}`;
    if (window.showToast) {
        window.showToast(paymentInfo, 'info');
    } else {
        alert(paymentInfo);
    }
}

// Edit Payment
async function editPayment(paymentId) {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) {
        console.error('Payment not found:', paymentId);
        if (window.showToast) {
            window.showToast('السند غير موجود', 'error');
        } else {
            alert('⚠️ السند غير موجود');
        }
        return;
    }

    // Load supplier balance from database if available to get latest balance
    if (window.electronAPI && window.electronAPI.dbGet && payment.supplierId) {
        try {
            const supplier = await window.electronAPI.dbGet('suppliers', payment.supplierId);
            if (supplier) {
                // Update supplier in local array
                const supplierIndex = suppliers.findIndex(s => s.id === supplier.id);
                if (supplierIndex !== -1) {
                    suppliers[supplierIndex] = supplier;
                } else {
                    suppliers.push(supplier);
                }
            }
        } catch (error) {
            console.error('Error loading supplier:', error);
        }
    }

    // Ensure suppliers dropdown is populated
    renderSuppliers();

    document.getElementById('isEdit').value = 'true';
    document.getElementById('paymentId').value = payment.id;
    document.getElementById('modalTitle').textContent = `تعديل سند صرف ${payment.paymentNumber}`;
    document.getElementById('paymentDate').value = payment.date;
    document.getElementById('amount').value = payment.amount;
    document.getElementById('paymentMethod').value = payment.paymentMethod || 'cash';
    document.getElementById('notes').value = payment.notes || '';
    
    // Set supplier value after a short delay to ensure dropdown is populated
    setTimeout(async () => {
        document.getElementById('supplierSelect').value = payment.supplierId || '';
        if (payment.supplierId) {
            await calculateBalance();
        }
    }, 100);

    document.getElementById('paymentModal').classList.add('active');
}

// Delete Payment
async function deletePayment(paymentId) {
    // Check payment status - prevent deletion if status is 'delivered' (حفظ نهائي)
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) {
        showMessage('السند غير موجود', 'error');
        return;
    }
    
    
    if (!confirm('هل أنت متأكد من حذف هذا السند؟')) {
        return;
    }

    try {
        // Save to database if available
        if (window.electronAPI && window.electronAPI.dbDelete) {
            await window.electronAPI.dbDelete('payments', paymentId);
            
            // Recalculate supplier balance (includes all invoices and payments)
            // This ensures opening balance is only used for first transaction
            if (payment.supplierId) {
                if (window.recalculateSupplierBalance && typeof window.recalculateSupplierBalance === 'function') {
                    await window.recalculateSupplierBalance(payment.supplierId);
                } else {
                    // Fallback to direct update if recalculateSupplierBalance is not available
                    const supplier = await window.electronAPI.dbGet('suppliers', payment.supplierId);
                    if (supplier) {
                        // Get all purchase invoices
                        const supplierInvoices = await window.electronAPI.dbGetAll('purchase_invoices', 'supplierId = ?', [payment.supplierId]);
                        // Get all payments (after deletion, this payment won't be included)
                        const supplierPayments = await window.electronAPI.dbGetAll('payments', 'supplierId = ?', [payment.supplierId]);
                        
                        let totalRemaining = 0;
                        supplierInvoices.forEach(invoice => {
                            totalRemaining += invoice.remaining || 0;
                        });
                        let totalPayments = 0;
                        supplierPayments.forEach(p => {
                            totalPayments += p.amount || 0;
                        });
                        
                        // Balance calculation: total remaining from invoices minus total payments
                        const newBalance = totalRemaining - totalPayments;
                        
                        await window.electronAPI.dbUpdate('suppliers', payment.supplierId, {
                            ...supplier,
                            balance: newBalance,
                            lastTransactionDate: new Date().toISOString()
                        });
                        
                        // Update local array
                        const localSupplier = suppliers.find(s => s.id === payment.supplierId);
                        if (localSupplier) {
                            localSupplier.balance = newBalance;
                            localSupplier.lastTransactionDate = new Date().toISOString();
                        }
                        
                        console.log(`[Payments] Recalculated supplier balance after deletion: ${newBalance} (invoices: ${totalRemaining}, payments: ${totalPayments})`);
                    }
                }
            }
        } else {
            // Fallback to localStorage
            if (payment.supplierId) {
                updateSupplierBalance(payment.supplierId, payment.amount);
            }
            savePayments();
        }

        payments = payments.filter(p => p.id !== paymentId);
        currentPage = 1;
        await applyFilters();
        if (window.showToast) {
            window.showToast('تم حذف السند بنجاح', 'success');
        } else {
            alert('✓ تم حذف السند بنجاح');
        }
    } catch (error) {
        console.error('Error deleting payment:', error);
        if (window.showToast) {
            window.showToast('خطأ في حذف السند: ' + error.message, 'error');
        } else {
            alert('✗ خطأ في حذف السند: ' + error.message);
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

// Generate Payment Print Content
async function generatePaymentPrintContent(payment) {
    const supplier = payment.supplierId ? suppliers.find(s => s.id === payment.supplierId) : null;
    
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
        // Try to get SVG logo first
        const logoSvgResponse = await fetch('assets/aseel_logo.svg');
        if (logoSvgResponse.ok) {
            const logoSvg = await logoSvgResponse.text();
            logoBase64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(logoSvg)));
        } else {
            // Fallback to ICO if SVG not found
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
    <title>سند صرف ${payment.paymentNumber}</title>
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
        <div class="voucher-title">سند صرف</div>
        <div class="voucher-info">
            <table>
                <tr>
                    <td>رقم السند:</td>
                    <td>${payment.paymentNumber}</td>
                </tr>
                <tr>
                    <td>التاريخ:</td>
                    <td>${new Date(payment.date).toLocaleDateString('ar-EG')}</td>
                </tr>
                <tr>
                    <td>المورد:</td>
                    <td>${supplier ? supplier.name : '-'}</td>
                </tr>
                <tr>
                    <td>المبلغ:</td>
                    <td>${payment.amount.toFixed(2)} ج.م</td>
                </tr>
                <tr>
                    <td>طريقة الدفع:</td>
                    <td>${paymentMethodText[payment.paymentMethod] || payment.paymentMethod}</td>
                </tr>
                ${payment.notes ? `
                <tr>
                    <td>ملاحظات:</td>
                    <td>${payment.notes}</td>
                </tr>
                ` : ''}
            </table>
        </div>
        <div class="amount-section">
            <div>المبلغ المدفوع</div>
            <div class="amount-value">${payment.amount.toFixed(2)} ج.م</div>
        </div>
        <div class="balance-section">
            <table>
                <tr>
                    <td>الرصيد القديم:</td>
                    <td>${((supplier ? (supplier.balance || 0) : 0) + payment.amount).toFixed(2)} ج.م</td>
                </tr>
                <tr>
                    <td>المدفوع:</td>
                    <td>${payment.amount.toFixed(2)} ج.م</td>
                </tr>
                <tr>
                    <td>الرصيد الجديد:</td>
                    <td>${(supplier ? (supplier.balance || 0) : 0).toFixed(2)} ج.م</td>
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

// Print Payment
async function printPayment(paymentId) {
    try {
        const payment = payments.find(p => p.id === paymentId);
        if (!payment) {
            if (window.showToast) {
                window.showToast('السند غير موجود', 'error');
            }
            return;
        }

        const printContent = await generatePaymentPrintContent(payment);
        
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
        console.error('Error in printPayment:', error);
        if (window.showToast) {
            window.showToast('خطأ في طباعة السند: ' + error.message, 'error');
        }
    }
}

// Save Payment as PDF
async function savePaymentAsPDF(paymentId) {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) {
        if (window.showToast) {
            window.showToast('السند غير موجود', 'error');
        } else {
            alert('⚠️ السند غير موجود');
        }
        return;
    }

    try {
        // Generate payment HTML content
        const paymentContent = await generatePaymentPrintContent(payment);
        
        // Generate default file name
        const defaultFileName = `سند_صرف_${payment.paymentNumber}_${new Date(payment.date).toISOString().split('T')[0]}.pdf`;
        
        // Save to file
        if (window.electronAPI && window.electronAPI.saveInvoiceToFile) {
            try {
                const result = await window.electronAPI.saveInvoiceToFile(paymentContent, defaultFileName);
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
                console.error('Error saving payment to file:', error);
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
        console.error('Error in savePaymentAsPDF:', error);
        if (window.showToast) {
            window.showToast('خطأ في حفظ السند: ' + error.message, 'error');
        } else {
            alert('❌ خطأ في حفظ السند: ' + error.message);
        }
    }
}

// Close Modal
function closeModal() {
    document.getElementById('paymentModal').classList.remove('active');
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

// Make functions global
window.viewPayment = viewPayment;
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

window.savePaymentAsPDF = savePaymentAsPDF;
window.printPayment = printPayment;
window.updateStatusDropdownStyle = updateStatusDropdownStyle;

