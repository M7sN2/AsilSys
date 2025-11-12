// Operating Expenses Management System

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

// Convert number to Arabic words
function numberToArabicWords(number) {
    const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
    const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
    const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
    const thousands = ['', 'ألف', 'ألفان', 'ثلاثة آلاف', 'أربعة آلاف', 'خمسة آلاف', 'ستة آلاف', 'سبعة آلاف', 'ثمانية آلاف', 'تسعة آلاف'];
    
    if (number === 0) return 'صفر';
    if (number < 0) return 'سالب ' + numberToArabicWords(-number);
    
    let result = '';
    const num = Math.floor(number);
    const decimal = Math.round((number - num) * 100);
    
    // Handle thousands
    if (num >= 1000) {
        const thousandsPart = Math.floor(num / 1000);
        if (thousandsPart <= 9) {
            result += thousands[thousandsPart] + ' ';
        } else {
            result += numberToArabicWords(thousandsPart) + ' ألف ';
        }
    }
    
    // Handle hundreds
    const hundredsPart = Math.floor((num % 1000) / 100);
    if (hundredsPart > 0) {
        result += hundreds[hundredsPart] + ' ';
    }
    
    // Handle tens and ones
    const remainder = num % 100;
    if (remainder > 0) {
        if (remainder < 10) {
            result += ones[remainder] + ' ';
        } else if (remainder < 20) {
            if (remainder === 10) {
                result += 'عشرة ';
            } else if (remainder === 11) {
                result += 'أحد عشر ';
            } else if (remainder === 12) {
                result += 'اثنا عشر ';
            } else {
                result += ones[remainder % 10] + ' عشر ';
            }
        } else {
            const onesPart = remainder % 10;
            const tensPart = Math.floor(remainder / 10);
            if (onesPart > 0) {
                result += ones[onesPart] + ' و';
            }
            result += tens[tensPart] + ' ';
        }
    }
    
    // Handle decimal part
    if (decimal > 0) {
        result += 'و ' + numberToArabicWords(decimal) + ' قرش ';
    }
    
    return result.trim() + ' جنيه';
}

let expenses = [];
let isSavingExpense = false; // Flag to prevent duplicate form submissions

// Pagination & Filter State
let currentPage = 1;
const itemsPerPage = 20;
let filteredExpenses = [];
let searchQuery = '';
let dateFrom = '';
let dateTo = '';
let expenseTypeFilter = '';
let categoryFilter = '';
let sortBy = 'date-desc';

// Load data on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    initializeEventListeners();
    await applyFilters();
});

// Initialize Event Listeners
function initializeEventListeners() {
    // View Blank Payment Button
    const viewBlankPaymentBtn = document.getElementById('viewBlankPaymentBtn');
    if (viewBlankPaymentBtn) {
        viewBlankPaymentBtn.addEventListener('click', () => {
            viewBlankPaymentVoucher();
        });
    }

    // Print Blank Payment Button
    const printBlankPaymentBtn = document.getElementById('printBlankPaymentBtn');
    if (printBlankPaymentBtn) {
        printBlankPaymentBtn.addEventListener('click', () => {
            printBlankPaymentVoucher();
        });
    }

    // New Expense Button (in header)
    const newExpenseBtn = document.getElementById('newExpenseBtn');
    if (newExpenseBtn) {
        newExpenseBtn.addEventListener('click', () => {
            openNewExpense();
        });
    }
    
    // Empty State Add Button
    const emptyStateAddBtn = document.getElementById('emptyStateAddBtn');
    if (emptyStateAddBtn) {
        emptyStateAddBtn.addEventListener('click', () => {
            openNewExpense();
        });
    }

    // Modal Close Buttons
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);

    // Form Submit
    document.getElementById('expenseForm').addEventListener('submit', handleFormSubmit);


    // Close modal on backdrop click
    document.getElementById('expenseModal').addEventListener('click', (e) => {
        if (e.target.id === 'expenseModal') {
            closeModal();
        }
    });

    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('expenseDate').value = today;

    // Expense Type Change Handler
    const expenseTypeSelect = document.getElementById('expenseType');
    const operationalCategoryRow = document.getElementById('operationalCategoryRow');
    const expenseCategorySelect = document.getElementById('expenseCategory');
    
    if (expenseTypeSelect && operationalCategoryRow && expenseCategorySelect) {
        expenseTypeSelect.addEventListener('change', (e) => {
            const expenseType = e.target.value;
            if (expenseType === 'operational') {
                operationalCategoryRow.style.display = 'flex';
                expenseCategorySelect.required = true;
            } else {
                operationalCategoryRow.style.display = 'none';
                expenseCategorySelect.required = false;
                expenseCategorySelect.value = '';
            }
        });
    }

    // Search & Filter Event Listeners
    document.getElementById('searchInput').addEventListener('input', async (e) => {
        searchQuery = e.target.value.trim();
        currentPage = 1;
        await applyFilters();
    });
    
    document.getElementById('clearSearchBtn').addEventListener('click', async () => {
        document.getElementById('searchInput').value = '';
        searchQuery = '';
        currentPage = 1;
        await applyFilters();
    });
    
    document.getElementById('dateFrom').addEventListener('change', async (e) => {
        dateFrom = e.target.value;
        currentPage = 1;
        await applyFilters();
    });
    
    document.getElementById('dateTo').addEventListener('change', async (e) => {
        dateTo = e.target.value;
        currentPage = 1;
        await applyFilters();
    });
    
    // Expense Type Filter Change Handler
    const expenseTypeFilterSelect = document.getElementById('expenseTypeFilter');
    const operationalCategoryFilterRow = document.getElementById('operationalCategoryFilterRow');
    const categoryFilterSelect = document.getElementById('categoryFilter');
    
    if (expenseTypeFilterSelect && operationalCategoryFilterRow && categoryFilterSelect) {
        expenseTypeFilterSelect.addEventListener('change', async (e) => {
            expenseTypeFilter = e.target.value;
            if (expenseTypeFilter === 'operational') {
                operationalCategoryFilterRow.style.display = 'flex';
            } else {
                operationalCategoryFilterRow.style.display = 'none';
                categoryFilter = '';
                categoryFilterSelect.value = '';
            }
            currentPage = 1;
            await applyFilters();
        });
        
        categoryFilterSelect.addEventListener('change', async (e) => {
            categoryFilter = e.target.value;
            currentPage = 1;
            await applyFilters();
        });
    }
    
    document.getElementById('sortBy').addEventListener('change', async (e) => {
        sortBy = e.target.value;
        currentPage = 1;
        await applyFilters();
    });
    
    document.getElementById('clearFiltersBtn').addEventListener('click', async () => {
        document.getElementById('searchInput').value = '';
        document.getElementById('dateFrom').value = '';
        document.getElementById('dateTo').value = '';
        document.getElementById('expenseTypeFilter').value = '';
        document.getElementById('categoryFilter').value = '';
        document.getElementById('sortBy').value = 'date-desc';
        if (operationalCategoryFilterRow) {
            operationalCategoryFilterRow.style.display = 'none';
        }
        searchQuery = '';
        dateFrom = '';
        dateTo = '';
        expenseTypeFilter = '';
        categoryFilter = '';
        sortBy = 'date-desc';
        currentPage = 1;
        await applyFilters();
    });

    // Pagination Event Listeners
    document.getElementById('prevPageBtn').addEventListener('click', async () => {
        if (currentPage > 1) {
            currentPage--;
            await applyFilters();
        }
    });
    
    document.getElementById('nextPageBtn').addEventListener('click', async () => {
        const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            await applyFilters();
        }
    });
}

// Load Data
async function loadData() {
    try {
        // Ensure columns exist before loading
        await ensureExpenseColumnsExist();
        
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            console.log('Loading expenses from database...');
            expenses = await window.electronAPI.dbGetAll('operating_expenses', '', []);
            console.log('Raw expenses from database:', expenses);
            // Ensure expenses is an array
            expenses = Array.isArray(expenses) ? expenses : [];
            console.log('Expenses array length:', expenses.length);
        } else {
            console.log('electronAPI not available, using localStorage');
            // Fallback to localStorage
            const stored = localStorage.getItem('asel_operating_expenses');
            expenses = stored ? JSON.parse(stored) : [];
        }
        
        // Sort by date (newest first)
        expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
        console.log('Expenses sorted, first expense:', expenses[0]);
    } catch (error) {
        console.error('Error loading expenses:', error);
        console.error('Error stack:', error.stack);
        expenses = [];
    }
}

// Open New Expense
function openNewExpense() {
    document.getElementById('isEdit').value = 'false';
    document.getElementById('expenseId').value = '';
    document.getElementById('modalTitle').textContent = 'مصروف جديد';
    document.getElementById('expenseForm').reset();
    
    // Reset expense type and category visibility
    const operationalCategoryRow = document.getElementById('operationalCategoryRow');
    const expenseCategorySelect = document.getElementById('expenseCategory');
    if (operationalCategoryRow) {
        operationalCategoryRow.style.display = 'none';
    }
    if (expenseCategorySelect) {
        expenseCategorySelect.required = false;
    }
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('expenseDate').value = today;
    
    document.getElementById('expenseModal').classList.add('active');
    
    // Ensure focus is restored after opening modal
    setTimeout(() => {
        window.focus();
        // Try to focus on first input field
        const firstInput = document.querySelector('#expenseModal input:not([type="hidden"]), #expenseModal select, #expenseModal textarea');
        if (firstInput) {
            setTimeout(() => {
                firstInput.focus();
            }, 50);
        }
    }, 100);
}

// Close Modal
function closeModal() {
    document.getElementById('expenseModal').classList.remove('active');
    document.getElementById('expenseForm').reset();
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

// Ensure Database Columns Exist
// Note: Columns are already added in database.js during initialization
// This function is kept for backward compatibility but does nothing
async function ensureExpenseColumnsExist() {
    // Columns expenseNumber and recipientName are already added in database.js
    // during table creation (lines 693-705)
    // No need to add them again here
    return;
}

// Handle Form Submit
async function handleFormSubmit(e) {
    e.preventDefault();
    
    // منع الضغط المتكرر
    if (isSavingExpense) {
        console.log('[Expenses] Save already in progress, ignoring duplicate submit');
        return;
    }
    
    // تعيين حالة الحفظ
    isSavingExpense = true;
    
    // تعطيل زر الحفظ وتغيير النص
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalButtonText = submitButton ? submitButton.textContent : '';
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'جاري الحفظ...';
    }
    
    try {
        // Ensure columns exist before saving
        console.log('Ensuring columns exist before saving...');
        await ensureExpenseColumnsExist();
        console.log('Columns check completed');

    const date = document.getElementById('expenseDate').value;
    const expenseType = document.getElementById('expenseType').value;
    const category = expenseType === 'salaries' ? 'salaries' : document.getElementById('expenseCategory').value;
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const recipientName = document.getElementById('recipientName').value.trim();
    const description = document.getElementById('expenseDescription').value.trim();

    if (!expenseType) {
        if (window.showToast) {
            window.showToast('يرجى اختيار نوع المصروف', 'error');
        } else {
            alert('⚠️ يرجى اختيار نوع المصروف');
        }
        isSavingExpense = false;
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
        return;
    }

    if (expenseType === 'operational' && !category) {
        if (window.showToast) {
            window.showToast('يرجى اختيار نوع المصروف التشغيلي', 'error');
        } else {
            alert('⚠️ يرجى اختيار نوع المصروف التشغيلي');
        }
        isSavingExpense = false;
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
        isSavingExpense = false;
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
        return;
    }

    if (!recipientName) {
        if (window.showToast) {
            window.showToast('يرجى إدخال اسم المستلم', 'error');
        } else {
            alert('⚠️ يرجى إدخال اسم المستلم');
        }
        isSavingExpense = false;
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
        return;
    }

    const expenseId = document.getElementById('expenseId').value || `expense_${Date.now()}`;
    const isEdit = document.getElementById('isEdit').value === 'true';

    // Check if there's a pending expense for the same recipient (only for new expenses, not edits)
    if (!isEdit && window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            const pendingExpenses = await window.electronAPI.dbGetAll(
                'operating_expenses', 
                'recipientName = ? AND status = ?', 
                [recipientName, 'pending']
            );
            
            if (pendingExpenses && pendingExpenses.length > 0) {
                const expenseNumbers = pendingExpenses.map(e => e.expenseNumber || e.id).join(', ');
                
                if (window.showToast) {
                    window.showToast(
                        `لا يمكن إنشاء مصروف جديد. يوجد ${pendingExpenses.length} مصروف بحالة "مسودة" لنفس المستلم "${recipientName}": ${expenseNumbers}. يرجى تغيير حالة المصروفات إلى "حفظ نهائي" أولاً.`,
                        'error',
                        5000
                    );
                } else {
                    alert(`⚠️ لا يمكن إنشاء مصروف جديد.\nيوجد ${pendingExpenses.length} مصروف بحالة "مسودة" لنفس المستلم "${recipientName}": ${expenseNumbers}\nيرجى تغيير حالة المصروفات إلى "حفظ نهائي" أولاً.`);
                }
                isSavingExpense = false;
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = originalButtonText;
                }
                return;
            }
        } catch (error) {
            console.error('Error checking pending expenses:', error);
            // Continue if check fails (don't block expense creation)
        }
    }

    const expenseData = {
        id: expenseId,
        expenseNumber: isEdit ? 
            (expenses.find(e => e.id === expenseId)?.expenseNumber || await generateExpenseNumber()) : 
            await generateExpenseNumber(),
        date: date,
        category: category,
        amount: amount,
        recipientName: recipientName || null,
        description: description || null,
        updatedAt: new Date().toISOString()
    };

        // Save to database if available
        if (window.electronAPI && window.electronAPI.dbInsert && window.electronAPI.dbUpdate) {
            if (isEdit) {
                // Update existing expense
                const updateResult = await window.electronAPI.dbUpdate('operating_expenses', expenseId, expenseData);
                
                // Check if update was successful
                if (updateResult && updateResult.success === false) {
                    throw new Error(updateResult.error || 'فشل تحديث المصروف في قاعدة البيانات');
                }
                
                // Update local array
                const index = expenses.findIndex(e => e.id === expenseId);
                if (index !== -1) {
                    expenses[index] = expenseData;
                }
            } else {
                expenseData.createdAt = new Date().toISOString();
                
                // Add createdBy to track who created this expense
                if (!expenseData.createdBy) {
                    if (typeof addCreatedBy === 'function') {
                        addCreatedBy(expenseData);
                    } else {
                        const currentUser = localStorage.getItem('asel_user') || localStorage.getItem('asel_userId') || '';
                        if (currentUser) {
                            expenseData.createdBy = currentUser;
                        }
                    }
                }
                
                console.log('Inserting expense:', expenseData);
                const insertResult = await window.electronAPI.dbInsert('operating_expenses', expenseData);
                console.log('Insert result:', insertResult);
                
                // Check if insert was successful
                if (insertResult && insertResult.success === false) {
                    throw new Error(insertResult.error || 'فشل حفظ المصروف في قاعدة البيانات');
                }
                
                // Add to local array
                expenses.push(expenseData);
                console.log('Expense added to local array, total expenses:', expenses.length);
            }
        } else {
            // Fallback to localStorage
            if (isEdit) {
                const index = expenses.findIndex(e => e.id === expenseId);
                if (index !== -1) {
                    expenses[index] = expenseData;
                }
            } else {
                expenseData.createdAt = new Date().toISOString();
                expenses.push(expenseData);
            }
            saveExpenses();
        }

        // Reload data from database to ensure we have the latest data
        console.log('Reloading data from database...');
        await loadData();
        console.log('Loaded expenses count:', expenses.length);
        
        expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
        currentPage = 1;
        console.log('Applying filters...');
        await applyFilters();
        console.log('Filters applied, filtered expenses count:', filteredExpenses.length);
        
        // Notify other screens about expense update
        localStorage.setItem('last_expense_update', JSON.stringify({
            timestamp: Date.now(),
            action: isEdit ? 'update' : 'create',
            expenseId: expenseId
        }));
        
        // Broadcast to other windows
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                const channel = new BroadcastChannel('expense-updates');
                channel.postMessage({
                    type: 'expenseUpdated',
                    action: isEdit ? 'update' : 'create',
                    expenseId: expenseId,
                    timestamp: Date.now()
                });
            } catch (error) {
                console.error('Error broadcasting expense update:', error);
            }
        }
        
        closeModal();
        if (window.showToast) {
            window.showToast('تم حفظ المصروف بنجاح', 'success');
        } else {
            alert('✓ تم حفظ المصروف بنجاح');
        }
    } catch (error) {
        console.error('Error saving expense:', error);
        console.error('Error details:', error.message, error.stack);
        console.error('Expense data:', expenseData);
        if (window.showToast) {
            window.showToast('خطأ في حفظ المصروف: ' + error.message, 'error');
        } else {
            alert('✗ خطأ في حفظ المصروف: ' + error.message);
        }
    } finally {
        // إعادة تفعيل الزر في جميع الحالات
        isSavingExpense = false;
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
    }
}

// Generate Expense Number
async function generateExpenseNumber() {
    const year = new Date().getFullYear();
    const prefix = `EXP-${year}-`;
    
    // Try to get counter from database first (more reliable)
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            // Get all expenses from database
            const allExpenses = await window.electronAPI.dbGetAll('operating_expenses', '', []);
            
            if (allExpenses && allExpenses.length > 0) {
                // Filter expenses with numbers matching current year pattern
                const currentYearNumbers = allExpenses
                    .map(expense => expense.expenseNumber)
                    .filter(number => number && number.startsWith(prefix));
                
                // Extract numbers from expense numbers (e.g., "EXP-2025-001" -> 1)
                const numbers = currentYearNumbers.map(number => {
                    const match = number.match(new RegExp(`${prefix}(\\d+)`));
                    return match ? parseInt(match[1]) : 0;
                });
                
                // Get maximum number
                const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
                const counter = maxNumber + 1;
                
                // Save to localStorage as backup
                localStorage.setItem('asel_expense_counter', counter.toString());
                
                return `${prefix}${String(counter).padStart(3, '0')}`;
            }
        } catch (error) {
            console.error('Error generating expense number from database:', error);
            // Fallback to localStorage
        }
    }
    
    // Fallback: use localStorage counter
    let counter = parseInt(localStorage.getItem('asel_expense_counter') || '0');
    counter++;
    localStorage.setItem('asel_expense_counter', counter.toString());
    
    return `${prefix}${String(counter).padStart(3, '0')}`;
}

// Save Expenses to localStorage
function saveExpenses() {
    localStorage.setItem('asel_operating_expenses', JSON.stringify(expenses));
}

// Render Expenses
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
    
    // Start with all expenses
    filteredExpenses = [...expenses];
    
    // Apply search filter
    if (searchQuery) {
        const term = searchQuery.toLowerCase().trim();
        filteredExpenses = filteredExpenses.filter(expense => {
            const categoryName = getCategoryName(expense.category);
            const description = (expense.description || '').toLowerCase();
            const recipientName = (expense.recipientName || '').toLowerCase();
            return categoryName.toLowerCase().includes(term) || 
                   description.includes(term) || 
                   recipientName.includes(term);
        });
    }
    
    // Apply date filter (use effectiveDateFrom and effectiveDateTo)
    if (effectiveDateFrom) {
        filteredExpenses = filteredExpenses.filter(expense => {
            return new Date(expense.date) >= new Date(effectiveDateFrom);
        });
    }
    
    if (effectiveDateTo) {
        filteredExpenses = filteredExpenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            const toDate = new Date(effectiveDateTo);
            toDate.setHours(23, 59, 59, 999); // Include the entire day
            return expenseDate <= toDate;
        });
    }
    
    // Apply expense type filter
    if (expenseTypeFilter) {
        if (expenseTypeFilter === 'salaries') {
            filteredExpenses = filteredExpenses.filter(expense => {
                return expense.category === 'salaries';
            });
        } else if (expenseTypeFilter === 'operational') {
            // Filter operational expenses
            filteredExpenses = filteredExpenses.filter(expense => {
                return expense.category !== 'salaries';
            });
            
            // Apply operational category filter if specified
            if (categoryFilter) {
                filteredExpenses = filteredExpenses.filter(expense => {
                    return expense.category === categoryFilter;
                });
            }
        }
    } else if (categoryFilter) {
        // If only category filter is set (for backward compatibility)
        filteredExpenses = filteredExpenses.filter(expense => {
            return expense.category === categoryFilter;
        });
    }
    
    // Apply sorting
    filteredExpenses.sort((a, b) => {
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
    const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
        currentPage = 1;
    }
    
    // Render paginated expenses
    await renderExpenses();
}

// Get Category Name
function getCategoryName(category) {
    const categoryNames = {
        'salaries': 'مرتبات',
        'car': 'مصاريف تشغيل سيارة',
        'shipping': 'شحن',
        'rent': 'إيجار',
        'electricity': 'كهرباء',
        'internet': 'إنترنت',
        'packaging': 'تغليف',
        'maintenance': 'صيانة',
        'other': 'مصروفات أخرى'
    };
    return categoryNames[category] || category;
}

async function renderExpenses() {
    const tbody = document.getElementById('expensesTableBody');
    const emptyState = document.getElementById('emptyState');
    const paginationContainer = document.getElementById('paginationContainer');

    tbody.innerHTML = '';

    if (filteredExpenses.length === 0) {
        emptyState.classList.remove('hidden');
        paginationContainer.classList.add('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    paginationContainer.classList.remove('hidden');

    // Calculate pagination
    const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredExpenses.length);
    const paginatedExpenses = filteredExpenses.slice(startIndex, endIndex);
    
    // Get current logged-in user type
    const currentUserType = localStorage.getItem('asel_userType') || '';
    const canDeleteExpenses = currentUserType === 'manager' || currentUserType === 'system_engineer';
    const canEditExpenses = currentUserType === 'manager' || currentUserType === 'system_engineer';
    
    // Update pagination info
    document.getElementById('paginationInfo').textContent = 
        `عرض ${startIndex + 1} - ${endIndex} من ${filteredExpenses.length}`;
    
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

    const categoryNames = {
        salaries: 'مرتبات',
        car: 'مصاريف تشغيل سيارة',
        shipping: 'شحن',
        rent: 'إيجار',
        electricity: 'كهرباء',
        internet: 'إنترنت',
        packaging: 'تغليف',
        maintenance: 'صيانة',
        other: 'مصروفات أخرى'
    };

    for (const expense of paginatedExpenses) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${expense.expenseNumber || '-'}</strong></td>
            <td>${new Date(expense.date).toLocaleDateString('ar-EG')}</td>
            <td><span class="category-badge">${getCategoryName(expense.category)}</span></td>
            <td class="expense-amount-cell"><strong>${formatArabicCurrency(expense.amount)}</strong></td>
            <td class="recipient-name-cell"><strong>${expense.recipientName || '-'}</strong></td>
            <td>${expense.description || '-'}</td>
            <td class="created-by-cell">${expense.createdBy || '-'}</td>
            <td>
                <div class="actions-buttons">
                    <button class="action-btn view" data-expense-id="${expense.id}" title="عرض">👁️</button>
                    <button class="action-btn print" data-expense-id="${expense.id}" title="طباعة">🖨️</button>
                    <button class="action-btn save" data-expense-id="${expense.id}" title="حفظ">💾</button>
                </div>
            </td>
        `;
        
        // Add event listeners to buttons
        const viewBtn = row.querySelector('.action-btn.view');
        const printBtn = row.querySelector('.action-btn.print');
        const saveBtn = row.querySelector('.action-btn.save');
        const actionsDiv = row.querySelector('.actions-buttons');
        
        if (viewBtn) {
            viewBtn.addEventListener('click', () => viewExpense(expense.id));
        }
        if (printBtn) {
            printBtn.addEventListener('click', () => printExpense(expense.id));
        }
        if (saveBtn) {
            saveBtn.addEventListener('click', () => saveExpenseAsPDF(expense.id));
        }
        
        tbody.appendChild(row);
    }
}

// Edit Expense
function editExpense(expenseId) {
    const expense = expenses.find(e => e.id === expenseId);
    if (!expense) return;

    document.getElementById('isEdit').value = 'true';
    document.getElementById('expenseId').value = expense.id;
    document.getElementById('modalTitle').textContent = 'تعديل مصروف';
    document.getElementById('expenseDate').value = expense.date.split('T')[0];
    
    // Set expense type and category
    const expenseTypeSelect = document.getElementById('expenseType');
    const operationalCategoryRow = document.getElementById('operationalCategoryRow');
    const expenseCategorySelect = document.getElementById('expenseCategory');
    
    if (expense.category === 'salaries') {
        expenseTypeSelect.value = 'salaries';
        if (operationalCategoryRow) {
            operationalCategoryRow.style.display = 'none';
        }
        if (expenseCategorySelect) {
            expenseCategorySelect.required = false;
            expenseCategorySelect.value = '';
        }
    } else {
        expenseTypeSelect.value = 'operational';
        if (operationalCategoryRow) {
            operationalCategoryRow.style.display = 'flex';
        }
        if (expenseCategorySelect) {
            expenseCategorySelect.required = true;
            expenseCategorySelect.value = expense.category;
        }
    }
    
    document.getElementById('expenseAmount').value = expense.amount;
    document.getElementById('recipientName').value = expense.recipientName || '';
    document.getElementById('expenseDescription').value = expense.description || '';

    document.getElementById('expenseModal').classList.add('active');
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

// Delete Expense
async function deleteExpense(expenseId) {
    // Check expense status - prevent deletion if status is 'delivered' (حفظ نهائي)
    const expense = expenses.find(e => e.id === expenseId);
    if (!expense) {
        if (window.showToast) {
            window.showToast('المصروف غير موجود', 'error');
        } else {
            showMessage('المصروف غير موجود', 'error');
        }
        return;
    }
    
    
    // Use custom confirmation dialog instead of confirm()
    showConfirmDialog(
        'هل أنت متأكد من حذف هذا المصروف؟',
        () => {
            // User confirmed - proceed with deletion
            proceedWithExpenseDeletion(expenseId);
        },
        () => {
            // User cancelled - do nothing
        }
    );
}

// Proceed with expense deletion
async function proceedWithExpenseDeletion(expenseId) {

    const expense = expenses.find(e => e.id === expenseId);
    if (!expense) return;

    try {
        // Delete from database if available
        if (window.electronAPI && window.electronAPI.dbDelete) {
            await window.electronAPI.dbDelete('operating_expenses', expenseId);
        } else {
            // Fallback to localStorage
            saveExpenses();
        }

        expenses = expenses.filter(e => e.id !== expenseId);
        currentPage = 1;
        await applyFilters();
        
        // Notify other screens about expense deletion
        localStorage.setItem('last_expense_update', JSON.stringify({
            timestamp: Date.now(),
            action: 'delete',
            expenseId: expenseId
        }));
        
        // Broadcast to other windows
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                const channel = new BroadcastChannel('expense-updates');
                channel.postMessage({
                    type: 'expenseUpdated',
                    action: 'delete',
                    expenseId: expenseId,
                    timestamp: Date.now()
                });
            } catch (error) {
                console.error('Error broadcasting expense deletion:', error);
            }
        }
        
        if (window.showToast) {
            window.showToast('تم حذف المصروف بنجاح', 'success');
        }
    } catch (error) {
        console.error('Error deleting expense:', error);
        if (window.showToast) {
            window.showToast('خطأ في حذف المصروف: ' + error.message, 'error');
        }
    }
}

// Get Company Settings
async function getCompanySettings() {
    try {
        if (window.electronAPI && window.electronAPI.dbGet) {
            const companyInfo = await window.electronAPI.dbGet('company_info', 'company_001');
            return {
                name: companyInfo?.name || 'شركة أسيل',
                address: companyInfo?.address || '',
                phone: companyInfo?.phone || '',
                mobile: companyInfo?.mobile || '',
                email: companyInfo?.email || '',
                taxId: companyInfo?.taxId || '',
                commercialRegister: companyInfo?.commercialRegister || '',
                accountantName: companyInfo?.accountantName || '',
                accountantPhone: companyInfo?.accountantPhone || ''
            };
        }
    } catch (error) {
        console.error('Error loading company settings:', error);
    }
    return {
        name: 'شركة أسيل',
        address: '',
        phone: '',
        mobile: '',
        email: '',
        taxId: '',
        commercialRegister: '',
        accountantName: '',
        accountantPhone: ''
    };
}

// Generate Expense Print Content
async function generateExpensePrintContent(expense) {
    const companySettings = await getCompanySettings();
    const categoryNames = {
        salaries: 'مرتبات',
        car: 'مصاريف تشغيل سيارة',
        shipping: 'شحن',
        rent: 'إيجار',
        electricity: 'كهرباء',
        internet: 'إنترنت',
        packaging: 'تغليف',
        maintenance: 'صيانة',
        other: 'مصروفات أخرى'
    };
    
    const amountInWords = numberToArabicWords(expense.amount);
    const expenseDate = new Date(expense.date);
    const day = expenseDate.getDate();
    const month = expenseDate.getMonth() + 1;
    const year = expenseDate.getFullYear();
    
    // Get recipient name and description from expense data
    const recipientName = expense.recipientName || '';
    const description = expense.description || '';
    
    // Determine expense type (salaries, operational, or general)
    const isSalaries = expense.category === 'salaries';
    const isOperational = expense.category && expense.category !== 'salaries';
    
    // Generate dynamic content based on expense type
    let voucherTitle = '';
    let recipientSection = '';
    let purposeSection = '';
    let additionalTerms = '';
    
    if (isSalaries) {
        // سند صرف نقدي - مرتبات
        voucherTitle = 'سند صرف نقدي - مرتبات';
        const jobTitle = description || '____________________';
        recipientSection = `
            <p>إلى السيد / ${recipientName || '____________________'}</p>
            <p>بصفته موظف - ${jobTitle}</p>
        `;
        purposeSection = `
            <p>وذلك مقابل مرتب الشهر الحالي</p>
        `;
    } else if (isOperational) {
        // سند صرف نقدي - مصاريف تشغيل
        const categoryName = categoryNames[expense.category] || expense.category;
        voucherTitle = `سند صرف نقدي - ${categoryName}`;
        recipientSection = `
            <p>إلى السيد / ${recipientName || '____________________'}</p>
        `;
        purposeSection = `
            <p>وذلك مقابل: ${description || '_______________________'}</p>
        `;
        additionalTerms = `
            <p>ويتعهد المستلم بتقديم ما يثبت صرف المبلغ في الغرض المخصص له خلال المدة المحددة،</p>
            <p>كما يتعهد برد أي مبالغ متبقية لم تُصرف.</p>
        `;
    } else {
        // سند صرف نقدي (عام)
        voucherTitle = 'سند صرف نقدي';
        recipientSection = `
            <p>إلى السيد / ${recipientName || '____________________'}</p>
        `;
        if (description) {
            purposeSection = `
                <p>وذلك مقابل: ${description}</p>
            `;
        }
    }
    
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
    <title>سند صرف ${expense.expenseNumber || ''}</title>
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
        .voucher-content {
            margin: 10px 0;
            line-height: 1.6;
            font-size: 13px;
        }
        .voucher-content p {
            margin: 8px 0;
        }
        .amount-line {
            margin: 10px 0;
            padding: 8px;
            background: #f8f9fa;
            border-radius: 5px;
        }
        .signature-section {
            margin-top: 25px;
            display: flex;
            justify-content: space-between;
            gap: 10px;
        }
        .signature-box {
            width: 30%;
            text-align: center;
            border-top: 1px solid #333;
            padding-top: 8px;
            margin-top: 20px;
            font-size: 11px;
        }
        .info-line {
            margin: 6px 0;
            display: flex;
            justify-content: space-between;
            font-size: 12px;
        }
        .info-label {
            font-weight: bold;
            width: 100px;
        }
        .info-value {
            flex: 1;
            border-bottom: 1px dotted #333;
            padding-right: 8px;
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
        <div class="voucher-title">${voucherTitle}</div>
        <div class="voucher-content">
            <p>تم صرف مبلغ وقدره: <strong>${formatArabicCurrency(expense.amount)}</strong></p>
            <div class="amount-line">
                <p>فقط وقدره: <strong>${amountInWords}</strong></p>
            </div>
            ${recipientSection}
            ${purposeSection}
            ${additionalTerms}
            <div class="info-line">
                <span class="info-label">تاريخ الصرف:</span>
                <span class="info-value">${day} / ${month} / ${year}</span>
            </div>
            <div class="info-line">
                <span class="info-label">رقم السند:</span>
                <span class="info-value">${expense.expenseNumber || '____________'}</span>
            </div>
        </div>
        <div class="signature-section">
            <div class="signature-box">
                <div>المستلم: ____________________</div>
                <div>(توقيع المستلم)</div>
            </div>
            <div class="signature-box">
                <div>اسم المحاسب: ${companySettings.accountantName || '____________________'}</div>
            </div>
            <div class="signature-box">
                <div>اعتماد المدير المالي / الإدارة: ____________________</div>
            </div>
        </div>
    </div>
</body>
</html>
    `;
}

// View Expense
async function viewExpense(expenseId) {
    const expense = expenses.find(e => e.id === expenseId);
    if (!expense) {
        if (window.showToast) {
            window.showToast('المصروف غير موجود', 'error');
        }
        return;
    }

    try {
        const printContent = await generateExpensePrintContent(expense);
        const viewWindow = window.open('', '_blank');
        viewWindow.document.write(printContent);
        viewWindow.document.close();
    } catch (error) {
        console.error('Error viewing expense:', error);
        if (window.showToast) {
            window.showToast('خطأ في عرض المصروف: ' + error.message, 'error');
        }
    }
}

// Print Expense
async function printExpense(expenseId) {
    try {
        const expense = expenses.find(e => e.id === expenseId);
        if (!expense) {
            if (window.showToast) {
                window.showToast('المصروف غير موجود', 'error');
            }
            return;
        }

        const printContent = await generateExpensePrintContent(expense);
        
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
        console.error('Error printing expense:', error);
        if (window.showToast) {
            window.showToast('خطأ في طباعة المصروف: ' + error.message, 'error');
        }
    }
}

// Save Expense as PDF
async function saveExpenseAsPDF(expenseId) {
    const expense = expenses.find(e => e.id === expenseId);
    if (!expense) {
        if (window.showToast) {
            window.showToast('المصروف غير موجود', 'error');
        }
        return;
    }

    try {
        const expenseContent = await generateExpensePrintContent(expense);
        
        // Generate default file name
        const defaultFileName = `سند_صرف_${expense.expenseNumber || expense.id}_${new Date(expense.date).toISOString().split('T')[0]}.pdf`;
        
        // Save to file
        if (window.electronAPI && window.electronAPI.saveInvoiceToFile) {
            try {
                const result = await window.electronAPI.saveInvoiceToFile(expenseContent, defaultFileName);
                if (result.success) {
                    if (window.showToast) {
                        window.showToast('تم حفظ السند بنجاح', 'success');
                    }
                } else {
                    if (window.showToast) {
                        window.showToast('فشل حفظ السند: ' + (result.error || 'خطأ غير معروف'), 'error');
                    }
                }
            } catch (error) {
                console.error('Error saving expense to file:', error);
                if (window.showToast) {
                    window.showToast('خطأ في حفظ السند: ' + error.message, 'error');
                }
            }
        } else {
            if (window.showToast) {
                window.showToast('وظيفة الحفظ غير متاحة', 'error');
            }
        }
    } catch (error) {
        console.error('Error in saveExpenseAsPDF:', error);
        if (window.showToast) {
            window.showToast('خطأ في حفظ السند: ' + error.message, 'error');
        }
    }
}

// Generate Blank Payment Voucher Print Content
async function generateBlankPaymentVoucherPrintContent() {
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

    // Generate single payment voucher HTML
    const singlePaymentHTML = `
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
                <div>سند مصروف نثري (طارئ)</div>
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
                        <td>نوع المصروف:</td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>وصف المصروف:</td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>المبلغ:</td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>مقدم السند:</td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>ملاحظات:</td>
                        <td></td>
                    </tr>
                </table>
            </div>
            <div class="amount-section">
                <div>المبلغ المدفوع</div>
                <div class="amount-value"></div>
            </div>
            <div class="signature">
                <div class="signature-box">
                    <div>مقدم السند</div>
                    <div style="margin-top: 15px; font-size: 7px;">(توقيع مقدم السند)</div>
                </div>
                <div class="signature-box">
                    <div>شاهد</div>
                    <div style="margin-top: 15px; font-size: 7px;">(توقيع الشاهد)</div>
                </div>
                <div class="signature-box">
                    <div>المحاسب</div>
                    <div style="margin-top: 15px; font-size: 7px;">(توقيع المحاسب)</div>
                </div>
            </div>
        </div>
    `;

    return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>سند مصروف نثري (طارئ) احتياطي فارغ</title>
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
            width: 30%;
            text-align: center;
            border-top: 1px solid #333;
            padding-top: 3px;
            margin-top: 4px;
            font-size: 7px;
            flex-shrink: 0;
        }
        .balance-section {
            margin: 6px 0;
            padding: 6px;
            background: #f0f4f8;
            border-radius: 4px;
            border: 1px solid #ddd;
        }
        .balance-section table {
            width: 100%;
        }
        .balance-section td {
            padding: 3px 0;
            font-size: 9px;
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
    <div class="receipt-wrapper">${singlePaymentHTML}</div>
    <div class="receipt-wrapper">${singlePaymentHTML}</div>
    <div class="receipt-wrapper">${singlePaymentHTML}</div>
    <div class="receipt-wrapper">${singlePaymentHTML}</div>
</body>
    </html>
    `;
}

// View Blank Payment Voucher
async function viewBlankPaymentVoucher() {
    try {
        // Generate print content
        const printContent = await generateBlankPaymentVoucherPrintContent();
        
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
        console.error('Error in viewBlankPaymentVoucher:', error);
        if (window.showToast) {
            window.showToast('خطأ في عرض سند الصرف الاحتياطي الفارغ: ' + error.message, 'error');
        }
    }
}

// Print Blank Payment Voucher
async function printBlankPaymentVoucher() {
    try {
        // Generate print content
        const printContent = await generateBlankPaymentVoucherPrintContent();
        
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
                    window.showToast('تم طباعة سند الصرف الاحتياطي الفارغ بنجاح', 'success');
                }
            } catch (printError) {
                console.error('Error calling print():', printError);
                if (window.showToast) {
                    window.showToast('تم فتح نافذة الطباعة. يرجى استخدام زر الطباعة في المتصفح', 'info');
                }
            }
        }, 500);
    } catch (error) {
        console.error('Error in printBlankPaymentVoucher:', error);
        if (window.showToast) {
            window.showToast('خطأ في طباعة سند الصرف الاحتياطي الفارغ: ' + error.message, 'error');
        }
    }
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

// Make functions global for onclick handlers
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

window.viewExpense = viewExpense;
window.updateStatusDropdownStyle = updateStatusDropdownStyle;
window.printExpense = printExpense;
window.saveExpenseAsPDF = saveExpenseAsPDF;

