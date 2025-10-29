// Sales Invoices Management System

// Storage Keys
const STORAGE_KEYS = {
    INVOICES: 'asel_sales_invoices',
    CUSTOMERS: 'asel_customers',
    PRODUCTS: 'asel_products',
    INVOICE_COUNTER: 'asel_invoice_counter'
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

// Initialize
let invoices = [];
let customers = [];
let products = [];
let invoiceProducts = [];
let currentInvoice = null;
let deliveryNotes = []; // أذون الصرف
let selectedDeliveryNote = null; // إذن الصرف المختار

// Pagination & Filter State
let currentPage = 1;
const itemsPerPage = 20;
let filteredInvoices = [];
let searchQuery = '';
let dateFrom = '';
let dateTo = '';
let statusFilter = '';
let sortBy = 'date-desc';
let totalInvoicesCount = 0; // Total count for pagination
let invoiceItemsCache = {}; // Cache for lazy loading invoice items
let useDatabasePagination = false; // Flag to enable database pagination for large datasets
let isSavingInvoice = false; // Flag to prevent duplicate form submissions

// Load data on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    initializeEventListeners();
    renderCustomers();
    renderProducts();
    applyFilters(); // Use applyFilters instead of renderInvoices
});

// Initialize Event Listeners
async function initializeEventListeners() {
    // New Invoice Button
    document.getElementById('newInvoiceBtn').addEventListener('click', () => {
        openNewInvoice();
    });
    
    // Empty state button
    const emptyStateBtn = document.getElementById('emptyStateAddBtn');
    if (emptyStateBtn) {
        emptyStateBtn.addEventListener('click', () => {
            document.getElementById('newInvoiceBtn').click();
        });
    }

    // Modal Close
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);

    // Form Submit
    document.getElementById('invoiceForm').addEventListener('submit', handleFormSubmit);

    // Add Product Button
    document.getElementById('addProductBtn').addEventListener('click', async () => {
        await addProductToInvoice();
    });

    // Customer Selection
    document.getElementById('customerSelect').addEventListener('change', onCustomerChange);

    // Product Unit Change - Update stock display
    const productUnitSelect = document.getElementById('productUnit');
    if (productUnitSelect) {
        productUnitSelect.addEventListener('change', updateStockOnUnitChange);
    }



    // Calculate totals on change
    document.getElementById('taxRate').addEventListener('input', () => calculateTotals());
    document.getElementById('shipping').addEventListener('input', () => calculateTotals());
    document.getElementById('discount').addEventListener('input', () => calculateTotals());
    document.getElementById('paid').addEventListener('input', () => calculateTotals());

    // Set due date based on invoice date
    document.getElementById('invoiceDate').addEventListener('change', (e) => {
        const invoiceDate = e.target.value;
        setDueDate();
        
        // Update min attribute on due date input whenever invoice date changes
        const dueDateInput = document.getElementById('dueDate');
        if (dueDateInput && invoiceDate) {
            dueDateInput.setAttribute('min', invoiceDate);
            // If current due date is before new invoice date, update it
            if (dueDateInput.value) {
                const invoiceDateObj = new Date(invoiceDate);
                const dueDateObj = new Date(dueDateInput.value);
                invoiceDateObj.setHours(0, 0, 0, 0);
                dueDateObj.setHours(0, 0, 0, 0);
                if (dueDateObj < invoiceDateObj) {
                    dueDateInput.value = invoiceDate;
                }
            }
        }
        
        // Prevent selecting past dates for new invoices (only for non-manager/non-engineer users)
        if (!currentInvoice && invoiceDate) {
            const userType = localStorage.getItem('asel_userType') || '';
            const canSelectPastDate = userType === 'manager' || userType === 'system_engineer';
            
            if (!canSelectPastDate) {
                const selectedDate = new Date(invoiceDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                selectedDate.setHours(0, 0, 0, 0);
                
                if (selectedDate < today) {
                    showMessage('لا يمكن اختيار تاريخ سابق. سيتم تعيين تاريخ اليوم', 'warning');
                    const todayStr = today.toISOString().split('T')[0];
                    e.target.value = todayStr;
                    setDueDate();
                    // Update min again after setting today's date
                    if (dueDateInput) {
                        dueDateInput.setAttribute('min', todayStr);
                    }
                }
            }
        }
    });

    // Prevent selecting due date before invoice date (applies to ALL users, including manager and engineer)
    const dueDateInput = document.getElementById('dueDate');
    if (dueDateInput) {
        // Update min attribute before opening date picker (on focus/click/mousedown)
        // This ensures dates before invoice date are disabled in the date picker
        const updateDueDateMin = (e) => {
            const invoiceDate = document.getElementById('invoiceDate').value;
            if (invoiceDate) {
                e.target.setAttribute('min', invoiceDate);
            }
        };
        
        dueDateInput.addEventListener('focus', updateDueDateMin);
        dueDateInput.addEventListener('click', updateDueDateMin);
        dueDateInput.addEventListener('mousedown', updateDueDateMin);
        // Also update on keydown (for keyboard navigation)
        dueDateInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                updateDueDateMin(e);
            }
        });
        
        // Event listener for change event
        dueDateInput.addEventListener('change', (e) => {
            const invoiceDate = document.getElementById('invoiceDate').value;
            if (invoiceDate && e.target.value) {
                const invoiceDateObj = new Date(invoiceDate);
                const dueDateObj = new Date(e.target.value);
                invoiceDateObj.setHours(0, 0, 0, 0);
                dueDateObj.setHours(0, 0, 0, 0);
                
                if (dueDateObj < invoiceDateObj) {
                    showMessage('لا يمكن أن يكون تاريخ الاستحقاق قبل تاريخ الفاتورة. سيتم تعيين تاريخ الفاتورة', 'warning');
                    e.target.value = invoiceDate;
                    // Force update min attribute
                    e.target.setAttribute('min', invoiceDate);
                }
            }
        });
        
        // Also listen to input event for immediate validation (catches manual typing)
        dueDateInput.addEventListener('input', (e) => {
            const invoiceDate = document.getElementById('invoiceDate').value;
            if (invoiceDate && e.target.value) {
                const invoiceDateObj = new Date(invoiceDate);
                const dueDateObj = new Date(e.target.value);
                invoiceDateObj.setHours(0, 0, 0, 0);
                dueDateObj.setHours(0, 0, 0, 0);
                
                if (dueDateObj < invoiceDateObj) {
                    e.target.value = invoiceDate;
                    e.target.setAttribute('min', invoiceDate);
                }
            }
        });
        
        // Also listen to blur event as a final check
        dueDateInput.addEventListener('blur', (e) => {
            const invoiceDate = document.getElementById('invoiceDate').value;
            if (invoiceDate && e.target.value) {
                const invoiceDateObj = new Date(invoiceDate);
                const dueDateObj = new Date(e.target.value);
                invoiceDateObj.setHours(0, 0, 0, 0);
                dueDateObj.setHours(0, 0, 0, 0);
                
                if (dueDateObj < invoiceDateObj) {
                    showMessage('لا يمكن أن يكون تاريخ الاستحقاق قبل تاريخ الفاتورة. سيتم تعيين تاريخ الفاتورة', 'warning');
                    e.target.value = invoiceDate;
                    e.target.setAttribute('min', invoiceDate);
                }
            }
        });
    }

    // Print Button
    document.getElementById('printBtn').addEventListener('click', printInvoice);

    // Close modal on backdrop click
    document.getElementById('invoiceModal').addEventListener('click', (e) => {
        if (e.target.id === 'invoiceModal') {
            closeModal();
        }
    });

    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    const invoiceDateInput = document.getElementById('invoiceDate');
    invoiceDateInput.value = today;
    // Set min attribute to prevent selecting past dates (only for non-manager/non-engineer users)
    const userType = localStorage.getItem('asel_userType') || '';
    const canSelectPastDate = userType === 'manager' || userType === 'system_engineer';
    if (!canSelectPastDate) {
        invoiceDateInput.setAttribute('min', today);
    } else {
        invoiceDateInput.removeAttribute('min'); // Allow past dates for manager and engineer
    }
    invoiceDateInput.removeAttribute('max'); // Remove max restriction for new invoices
    setDueDate();
    
    // Load default tax rate from company settings
    await loadTaxRateFromSettings(true);
    
    // Search & Filter Event Listeners
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim();
            currentPage = 1;
            applyFilters();
        });
    }
    
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            const searchInputEl = document.getElementById('searchInput');
            if (searchInputEl) searchInputEl.value = '';
            searchQuery = '';
            currentPage = 1;
            applyFilters();
        });
    }
    
    const dateFromEl = document.getElementById('dateFrom');
    if (dateFromEl) {
        dateFromEl.addEventListener('change', (e) => {
            dateFrom = e.target.value;
            currentPage = 1;
            applyFilters();
        });
    }
    
    const dateToEl = document.getElementById('dateTo');
    if (dateToEl) {
        dateToEl.addEventListener('change', (e) => {
            dateTo = e.target.value;
            currentPage = 1;
            applyFilters();
        });
    }
    
    const statusFilterEl = document.getElementById('statusFilter');
    if (statusFilterEl) {
        statusFilterEl.addEventListener('change', (e) => {
            statusFilter = e.target.value;
            currentPage = 1;
            applyFilters();
        });
    }
    
    const sortByEl = document.getElementById('sortBy');
    if (sortByEl) {
        sortByEl.addEventListener('change', (e) => {
            sortBy = e.target.value;
            currentPage = 1;
            applyFilters();
        });
    }
    
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            const searchInput = document.getElementById('searchInput');
            const dateFromInput = document.getElementById('dateFrom');
            const dateToInput = document.getElementById('dateTo');
            const statusFilterInput = document.getElementById('statusFilter');
            const sortByInput = document.getElementById('sortBy');
            
            if (searchInput) searchInput.value = '';
            if (dateFromInput) dateFromInput.value = '';
            if (dateToInput) dateToInput.value = '';
            if (statusFilterInput) statusFilterInput.value = '';
            if (sortByInput) sortByInput.value = 'date-desc';
            
            searchQuery = '';
            dateFrom = '';
            dateTo = '';
            statusFilter = '';
            sortBy = 'date-desc';
            currentPage = 1;
            applyFilters();
        });
    }
    
    // Pagination Event Listeners
    const prevPageBtn = document.getElementById('prevPageBtn');
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                applyFilters();
            }
        });
    }
    
    const nextPageBtn = document.getElementById('nextPageBtn');
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', async () => {
            let totalPages;
            if (useDatabasePagination) {
                totalPages = Math.ceil(totalInvoicesCount / itemsPerPage);
            } else {
                totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
            }
            if (currentPage < totalPages) {
                currentPage++;
                await applyFilters();
            }
        });
    }
}

// Set Due Date
function setDueDate() {
    const invoiceDate = document.getElementById('invoiceDate').value;
    if (!invoiceDate) return;
    
    const invoiceSettings = getInvoiceSettings();
    const paymentDays = invoiceSettings.paymentDays || 30;
    const date = new Date(invoiceDate);
    date.setDate(date.getDate() + paymentDays);
    const dueDateInput = document.getElementById('dueDate');
    dueDateInput.value = date.toISOString().split('T')[0];
    // Set min attribute to prevent selecting due date before invoice date (applies to ALL users)
    dueDateInput.setAttribute('min', invoiceDate);
}

// Get Invoice Settings
function getInvoiceSettings() {
    return JSON.parse(localStorage.getItem('asel_invoice_settings') || '{}');
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
                    taxRate: companyInfo.taxRate !== null && companyInfo.taxRate !== undefined ? companyInfo.taxRate : null,
                    commitmentText: companyInfo.commitmentText || 'أقر بأنني قد استلمت البضاعة/الخدمة المبينة أعلاه بحالة جيدة وبمواصفات مطابقة، وأتعهد بالسداد وفق الشروط المذكورة.',
                    salesRepName: companyInfo.salesRepName || '',
                    salesRepPhone: companyInfo.salesRepPhone || '',
                    accountantName: companyInfo.accountantName || '',
                    accountantPhone: companyInfo.accountantPhone || ''
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

// Load invoices with pagination from database
async function loadInvoicesPage(page = 1, limit = 20, filters = {}) {
    if (!window.electronAPI || !window.electronAPI.dbQuery) {
        return { invoices: [], total: 0 };
    }
    
    const offset = (page - 1) * limit;
    let query = 'SELECT * FROM sales_invoices';
    let params = [];
    
    // Build WHERE clause with filters
    const conditions = [];
    
    
    if (filters.dateFrom) {
        conditions.push('date >= ?');
        params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
        conditions.push('date <= ?');
        params.push(filters.dateTo + ' 23:59:59');
    }
    if (filters.customerId) {
        conditions.push('customerId = ?');
        params.push(filters.customerId);
    }
    if (filters.searchQuery) {
        conditions.push('(invoiceNumber LIKE ? OR id IN (SELECT id FROM sales_invoices si INNER JOIN customers c ON si.customerId = c.id WHERE c.name LIKE ?))');
        const searchTerm = `%${filters.searchQuery}%`;
        params.push(searchTerm, searchTerm);
    }
    
    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }
    
    // Apply sorting
    switch (filters.sortBy || 'date-desc') {
        case 'date-desc':
            query += ' ORDER BY date DESC, createdAt DESC';
            break;
        case 'date-asc':
            query += ' ORDER BY date ASC, createdAt ASC';
            break;
        case 'total-desc':
            query += ' ORDER BY total DESC';
            break;
        case 'total-asc':
            query += ' ORDER BY total ASC';
            break;
        case 'number-desc':
            query += ' ORDER BY invoiceNumber DESC';
            break;
        case 'number-asc':
            query += ' ORDER BY invoiceNumber ASC';
            break;
        default:
            query += ' ORDER BY date DESC, createdAt DESC';
    }
    
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const invoices = await window.electronAPI.dbQuery(query, params) || [];
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) as count FROM sales_invoices';
    let countParams = [];
    if (conditions.length > 0) {
        countQuery += ' WHERE ' + conditions.join(' AND ');
        countParams = params.slice(0, -2); // Remove LIMIT and OFFSET params
    }
    const countResult = await window.electronAPI.dbQuery(countQuery, countParams);
    const total = countResult && countResult[0] ? countResult[0].count : 0;
    
    return { invoices, total };
}

// Get total invoices count with filters
async function getInvoicesCount(filters = {}) {
    if (!window.electronAPI || !window.electronAPI.dbQuery) {
        return 0;
    }
    
    let query = 'SELECT COUNT(*) as count FROM sales_invoices';
    let params = [];
    
    const conditions = [];
    if (filters.dateFrom) {
        conditions.push('date >= ?');
        params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
        conditions.push('date <= ?');
        params.push(filters.dateTo + ' 23:59:59');
    }
    if (filters.customerId) {
        conditions.push('customerId = ?');
        params.push(filters.customerId);
    }
    if (filters.searchQuery) {
        conditions.push('(invoiceNumber LIKE ? OR id IN (SELECT id FROM sales_invoices si INNER JOIN customers c ON si.customerId = c.id WHERE c.name LIKE ?))');
        const searchTerm = `%${filters.searchQuery}%`;
        params.push(searchTerm, searchTerm);
    }
    
    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }
    
    const result = await window.electronAPI.dbQuery(query, params);
    return result && result[0] ? result[0].count : 0;
}

// Load invoice items with lazy loading (cache support)
async function loadInvoiceItems(invoiceId) {
    if (!invoiceId) return [];
    
    // Check cache first
    if (invoiceItemsCache[invoiceId]) {
        return invoiceItemsCache[invoiceId];
    }
    
    // Load from database
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            const items = await window.electronAPI.dbGetAll(
                'sales_invoice_items', 
                'invoiceId = ?', 
                [invoiceId]
            ) || [];
            
            // Cache the items
            invoiceItemsCache[invoiceId] = items.map(item => ({
                productId: item.productId,
                productName: item.productName,
                productCode: item.productCode || '',
                category: item.category || '',
                quantity: item.quantity || 0,
                unit: item.unit || '',
                unitName: item.unit || '',
                price: item.price || 0,
                total: item.total || 0
            }));
            
            return invoiceItemsCache[invoiceId];
        } catch (error) {
            console.error(`Error loading items for invoice ${invoiceId}:`, error);
            return [];
        }
    }
    
    return [];
}

// Load Data
async function loadData() {
    // Try to load from database first
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            // Check if we should use database pagination (for large datasets and weak devices)
            // Load a sample to check dataset size
            const sampleCount = await getInvoicesCount({});
            
            // Use database pagination if we have more than 200 invoices (lowered for weak devices)
            // This prevents loading too much data into memory on weak devices
            if (sampleCount > 200) {
                useDatabasePagination = true;
                console.log('[Sales] Using database pagination for dataset:', sampleCount, 'invoices');
                
                // Load only first page
                const result = await loadInvoicesPage(1, itemsPerPage, {});
                invoices = result.invoices || [];
                totalInvoicesCount = result.total || 0;
            } else {
                // Load all invoices for small datasets (only if less than 200)
                invoices = await window.electronAPI.dbGetAll('sales_invoices', '', []);
                totalInvoicesCount = invoices.length;
                console.log('[Sales] Loaded all', invoices.length, 'invoices (small dataset)');
            }
            customers = await window.electronAPI.dbGetAll('customers', '', []);
            products = await window.electronAPI.dbGetAll('products', '', []);
            deliveryNotes = await window.electronAPI.dbGetAll('delivery_notes', 'status = ?', ['issued']);
            
            // Ensure arrays
            invoices = Array.isArray(invoices) ? invoices : [];
            customers = Array.isArray(customers) ? customers : [];
            products = Array.isArray(products) ? products : [];
            deliveryNotes = Array.isArray(deliveryNotes) ? deliveryNotes : [];
            
            // Debug: Check if products have category field
            if (products.length > 0) {
                const sampleProduct = products[0];
                console.log('[Sales] loadData - Sample product:', {
                    id: sampleProduct.id,
                    name: sampleProduct.name,
                    category: sampleProduct.category,
                    hasCategory: 'category' in sampleProduct
                });
                const productsWithCategory = products.filter(p => p.category && p.category.trim() !== '').length;
                console.log('[Sales] loadData - Products with category:', productsWithCategory, 'out of', products.length);
            }
            
            // Ensure cash customer exists
            const cashCustomer = customers.find(c => (c.code || '').trim().toUpperCase() === 'CASH');
            if (!cashCustomer) {
                console.log('[Sales] Cash customer not found, creating...');
                // Try to create cash customer
                if (window.electronAPI && window.electronAPI.dbInsert) {
                    const newCashCustomer = {
                        id: 'cash_customer_' + Date.now().toString(),
                        code: 'CASH',
                        name: 'عميل نقدي',
                        phone: '',
                        address: '',
                        balance: 0,
                        status: 'active',
                        notes: '',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    try {
                        await window.electronAPI.dbInsert('customers', newCashCustomer);
                        customers.push(newCashCustomer);
                        console.log('[Sales] Cash customer created successfully');
                    } catch (error) {
                        console.error('[Sales] Error creating cash customer:', error);
                    }
                }
            } else {
                console.log('[Sales] Cash customer found:', cashCustomer.name, 'Code:', cashCustomer.code);
            }
            
            // Lazy loading: Don't load invoice items here - load them on demand
            // This significantly reduces memory usage and initial load time
            // Items will be loaded when needed using loadInvoiceItems() function
            
            // Ensure status is set for loaded invoices
            for (let invoice of invoices) {
                // Initialize products array (will be loaded on demand)
                if (!invoice.products) {
                    invoice.products = [];
                }
            }
            
            return;
        } catch (error) {
            console.error('Error loading from database:', error);
        }
    }
    
    // Fallback to localStorage
    const invoicesData = localStorage.getItem(STORAGE_KEYS.INVOICES);
    const customersData = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    const productsData = localStorage.getItem(STORAGE_KEYS.PRODUCTS);

    invoices = invoicesData ? JSON.parse(invoicesData) : [];
    customers = customersData ? JSON.parse(customersData) : [];
    products = productsData ? JSON.parse(productsData) : [];
}

// Save Invoices
async function saveInvoices() {
    // Save to localStorage as backup
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));
    
    // Also save to database if available
    if (window.electronAPI && window.electronAPI.dbInsert && window.electronAPI.dbUpdate) {
        // This function will be called after each invoice is saved individually
        // So we don't need to loop through all invoices here
    }
}

// Generate Invoice Number
async function generateInvoiceNumber() {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    
    // Try to get counter from database first (more reliable)
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            // Get all invoices from database
            const allInvoices = await window.electronAPI.dbGetAll('sales_invoices', '', []);
            
            if (allInvoices && allInvoices.length > 0) {
                // Filter invoices with numbers matching current year pattern
                const currentYearNumbers = allInvoices
                    .map(invoice => invoice.invoiceNumber)
                    .filter(number => number && number.startsWith(prefix));
                
                // Extract numbers from invoice numbers (e.g., "INV-2025-001" -> 1)
                const numbers = currentYearNumbers.map(number => {
                    const match = number.match(new RegExp(`${prefix}(\\d+)`));
                    return match ? parseInt(match[1]) : 0;
                });
                
                // Get maximum number
                const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
                const counter = maxNumber + 1;
                
                // Save to localStorage as backup
                localStorage.setItem(STORAGE_KEYS.INVOICE_COUNTER, counter.toString());
                
                return `${prefix}${String(counter).padStart(3, '0')}`;
            }
        } catch (error) {
            console.error('Error generating invoice number from database:', error);
            // Fallback to localStorage
        }
    }
    
    // Fallback: use localStorage counter
    let counter = parseInt(localStorage.getItem(STORAGE_KEYS.INVOICE_COUNTER) || '0');
    counter++;
    localStorage.setItem(STORAGE_KEYS.INVOICE_COUNTER, counter.toString());
    
    return `${prefix}${String(counter).padStart(3, '0')}`;
}

// Render Customers
function renderCustomers() {
    const select = document.getElementById('customerSelect');
    select.innerHTML = '<option value="" disabled selected>اختر العميل</option>';
    
    const activeCustomers = customers.filter(c => c.status === 'active' || !c.status);
    // Sort customers by name for better UX
    const sortedCustomers = [...activeCustomers].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    
    sortedCustomers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer.id;
        // Display customer name with code in a more readable format
        option.textContent = `${customer.name} (${customer.code})`;
        option.setAttribute('data-customer-name', customer.name);
        option.setAttribute('data-customer-code', customer.code);
        select.appendChild(option);
    });
}

// Render Products (for searchable dropdown)
function renderProducts() {
    // Products are stored in global array, filtering will be done in search
    setupProductSearch();
}

// Setup Product Search
function setupProductSearch(showAllProducts = false) {
    console.log('[Sales] setupProductSearch called, showAllProducts:', showAllProducts);
    const searchInput = document.getElementById('productSearch');
    const hiddenInput = document.getElementById('productSelect');
    const dropdown = document.getElementById('productDropdown');
    let selectedProduct = null;
    
    if (!searchInput) {
        console.warn('[Sales] setupProductSearch - productSearch input not found!');
        return;
    }
    
    if (!dropdown) {
        console.warn('[Sales] setupProductSearch - productDropdown not found!');
        return;
    }
    
    console.log('[Sales] setupProductSearch - Products count:', products.length);
    const activeProducts = products.filter(p => p.status === 'active' || !p.status);
    console.log('[Sales] setupProductSearch - Active products:', activeProducts.length);
    
    // Remove old event listeners by cloning the input (this removes all listeners)
    const newSearchInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);
    const searchInputNew = document.getElementById('productSearch');
    
    // Filter products based on search
    function filterProducts(searchTerm) {
        // If showAllProducts is true (for cash customer), show all products regardless of status
        // Otherwise, show only active products
        const availableProducts = showAllProducts 
            ? products  // Show all products for cash customer
            : products.filter(p => p.status === 'active' || !p.status);  // Show only active products
        
        console.log('[Sales] filterProducts - availableProducts:', availableProducts.length, 'showAllProducts:', showAllProducts);
        
        if (!searchTerm || searchTerm.trim() === '') {
            const result = availableProducts.slice(0, 10); // Show first 10 if no search
            console.log('[Sales] filterProducts - No search term, returning:', result.length, 'products');
            return result;
        }
        
        const term = searchTerm.toLowerCase().trim();
        console.log('[Sales] filterProducts - Searching for term:', term, 'in', availableProducts.length, 'products');
        const filtered = availableProducts.filter(product => {
            const name = (product.name || '').toLowerCase();
            const category = (product.category || '').toLowerCase();
            // البحث بالصنف (الفئة) أو اسم المنتج
            const matchesName = name.includes(term);
            const matchesCategory = category && category.trim() !== '' && category.includes(term);
            const matches = matchesName || matchesCategory;
            
            if (matches && matchesCategory) {
                console.log('[Sales] filterProducts - Category match found:', {
                    name: product.name,
                    category: product.category,
                    term: term
                });
            }
            
            return matches;
        }).slice(0, 20); // Limit to 20 results
        
        console.log('[Sales] filterProducts - Search term:', term, 'Filtered:', filtered.length, 'products');
        if (filtered.length === 0) {
            console.log('[Sales] filterProducts - No matches. Sample products:', availableProducts.slice(0, 3).map(p => ({
                name: p.name,
                category: p.category
            })));
        }
        return filtered;
    }
    
    // Render dropdown
    function renderDropdown(filteredProducts) {
        dropdown.innerHTML = '';
        
        if (filteredProducts.length === 0) {
            dropdown.innerHTML = '<div class="dropdown-item no-results">لا توجد نتائج</div>';
            dropdown.classList.add('active');
            return;
        }
        
        filteredProducts.forEach(product => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            item.innerHTML = `
                <div class="product-name">${product.name}</div>
                <div class="product-category">${product.category || 'غير محدد'}</div>
            `;
            item.addEventListener('click', () => {
                selectedProduct = product;
                const searchInputNew = document.getElementById('productSearch');
                const hiddenInputNew = document.getElementById('productSelect');
                if (searchInputNew) {
                    searchInputNew.value = `${product.name} - ${product.category || 'غير محدد'}`;
                }
                if (hiddenInputNew) {
                    hiddenInputNew.value = product.id;
                }
                dropdown.classList.remove('active');
                // Auto-fill price
                const priceInput = document.getElementById('productPrice');
                if (priceInput && product.smallestPrice) {
                    priceInput.value = product.smallestPrice;
                }
                // Update stock display based on current unit selection
                updateStockOnUnitChange();
                // Trigger quantity focus
                document.getElementById('productQuantity')?.focus();
            });
            dropdown.appendChild(item);
        });
        
        dropdown.classList.add('active');
    }
    
    // Handle input
    searchInputNew.addEventListener('input', (e) => {
        const term = e.target.value;
        console.log('[Sales] setupProductSearch - Input event, term:', term);
        if (term) {
            const filtered = filterProducts(term);
            console.log('[Sales] setupProductSearch - Filtered products:', filtered.length);
            renderDropdown(filtered);
        } else {
            dropdown.classList.remove('active');
            const hiddenInputNew = document.getElementById('productSelect');
            if (hiddenInputNew) {
                hiddenInputNew.value = '';
            }
            selectedProduct = null;
        }
    });
    
    // Handle focus
    searchInputNew.addEventListener('focus', () => {
        const term = searchInputNew.value;
        console.log('[Sales] setupProductSearch - Focus event, term:', term);
        const filtered = filterProducts(term);
        console.log('[Sales] setupProductSearch - Filtered products on focus:', filtered.length);
        renderDropdown(filtered);
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.product-search-wrapper')) {
            dropdown.classList.remove('active');
        }
    });
    
    // Handle keyboard navigation
    searchInputNew.addEventListener('keydown', (e) => {
        const items = dropdown.querySelectorAll('.dropdown-item:not(.no-results)');
        let currentIndex = -1;
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            currentIndex = Array.from(items).findIndex(item => item.classList.contains('highlighted'));
            if (currentIndex < items.length - 1) {
                items.forEach(item => item.classList.remove('highlighted'));
                items[currentIndex + 1].classList.add('highlighted');
                items[currentIndex + 1].scrollIntoView({ block: 'nearest' });
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            currentIndex = Array.from(items).findIndex(item => item.classList.contains('highlighted'));
            if (currentIndex > 0) {
                items.forEach(item => item.classList.remove('highlighted'));
                items[currentIndex - 1].classList.add('highlighted');
                items[currentIndex - 1].scrollIntoView({ block: 'nearest' });
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const highlighted = dropdown.querySelector('.dropdown-item.highlighted:not(.no-results)');
            if (highlighted) {
                highlighted.click();
            }
        }
    });
}

// Setup Product Search for Delivery Note (show only products from selected delivery note)
function setupProductSearchForDeliveryNote() {
    const searchInput = document.getElementById('productSearch');
    const hiddenInput = document.getElementById('productSelect');
    const dropdown = document.getElementById('productDropdown');
    
    if (!searchInput || !selectedDeliveryNote || !selectedDeliveryNote.items) {
        setupProductSearch(); // Fallback to normal search
        return;
    }
    
    let selectedProduct = null;
    
    function filterProducts(searchTerm) {
        // Filter only products from delivery note that have available quantity
        // Show products with availableQuantity > 0 (including products already in current invoice when editing)
        let availableItems = selectedDeliveryNote.items.filter(item => {
            // Show items with available quantity > 0
            // When editing, items already in invoice will have their quantities added back to availableQuantity
            return (item.availableQuantity || 0) > 0;
        });
        
        if (!searchTerm || searchTerm.trim() === '') {
            return availableItems.slice(0, 10);
        }
        
        const term = searchTerm.toLowerCase().trim();
        console.log('[Sales] setupProductSearchForDeliveryNote - Searching for term:', term, 'in', availableItems.length, 'items');
        return availableItems.filter(item => {
            const name = (item.productName || '').toLowerCase();
            // Get category from item, or from products array if not available
            let category = (item.productCategory || '').toLowerCase();
            if (!category || category.trim() === '') {
                if (item.productId) {
                    const product = products.find(p => p.id === item.productId);
                    if (product && product.category) {
                        category = (product.category || '').toLowerCase();
                        console.log('[Sales] setupProductSearchForDeliveryNote - Loaded category from products:', category, 'for product:', item.productName);
                    }
                }
            }
            // البحث بالصنف (الفئة) أو اسم المنتج
            const matchesName = name.includes(term);
            const matchesCategory = category && category.trim() !== '' && category.includes(term);
            if (matchesCategory) {
                console.log('[Sales] setupProductSearchForDeliveryNote - Category match found:', {
                    name: item.productName,
                    category: category,
                    term: term
                });
            }
            return matchesName || matchesCategory;
        }).slice(0, 20);
    }
    
    function renderDropdown(filteredItems) {
        dropdown.innerHTML = '';
        
        if (filteredItems.length === 0) {
            dropdown.innerHTML = '<div class="dropdown-item no-results">لا توجد منتجات متاحة في إذن الصرف</div>';
            dropdown.classList.add('active');
            return;
        }
        
        filteredItems.forEach(item => {
            const product = products.find(p => p.id === item.productId);
            if (!product) return;
            
            // Get total quantity and reserved quantity from delivery note
            const totalQuantityInNote = item.quantity || 0;
            const reservedQty = item.reservedQuantity || 0;
            
            // Calculate quantity already added to current invoice for this product
            const quantityInCurrentInvoice = invoiceProducts
                .filter(p => p.productId === item.productId && p.unit === item.unit)
                .reduce((sum, p) => sum + (p.quantity || 0), 0);
            
            // Calculate remaining quantity directly:
            // remainingQty = totalQuantity - reservedQuantity - quantityInCurrentInvoice
            // reservedQuantity includes quantities from other pending invoices (not current invoice)
            // When editing, reservedQuantity doesn't include current invoice (it was restored)
            const remainingQty = Math.max(0, totalQuantityInNote - reservedQty - quantityInCurrentInvoice);
            
            const productCategory = product.category || 'غير محدد';
            const itemElement = document.createElement('div');
            itemElement.className = 'dropdown-item';
            
            // Hide quantity from dropdown display
            itemElement.innerHTML = `
                <div class="product-name">${item.productName}</div>
                <div class="product-category">${productCategory}</div>
            `;
            itemElement.addEventListener('click', () => {
                selectedProduct = product;
                searchInput.value = `${item.productName} - ${productCategory}`;
                hiddenInput.value = product.id;
                dropdown.classList.remove('active');
                
                // Store delivery note item info (use remaining quantity, not total available)
                hiddenInput.dataset.deliveryNoteItemId = item.productId;
                hiddenInput.dataset.availableQuantity = remainingQty; // Store remaining quantity
                hiddenInput.dataset.unit = item.unit;
                
                // Auto-fill price
                const priceInput = document.getElementById('productPrice');
                if (priceInput && product.smallestPrice) {
                    priceInput.value = product.smallestPrice;
                }
                
                // Set unit to match delivery note
                const unitSelect = document.getElementById('productUnit');
                if (unitSelect && item.unit) {
                    unitSelect.value = item.unit;
                }
                
                // Update stock display based on unit
                updateStockOnUnitChange();
                
                document.getElementById('productQuantity')?.focus();
            });
            dropdown.appendChild(itemElement);
        });
        
        dropdown.classList.add('active');
    }
    
    // Handle input
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value;
        if (term) {
            const filtered = filterProducts(term);
            renderDropdown(filtered);
        } else {
            dropdown.classList.remove('active');
            hiddenInput.value = '';
            selectedProduct = null;
        }
    });
    
    // Handle focus
    searchInput.addEventListener('focus', () => {
        const term = searchInput.value;
        const filtered = filterProducts(term);
        renderDropdown(filtered);
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.product-search-wrapper')) {
            dropdown.classList.remove('active');
        }
    });
}

// Load Tax Rate from Settings
async function loadTaxRateFromSettings(forceUpdate = false) {
    try {
        const taxRateField = document.getElementById('taxRate');
        if (!taxRateField) return;
        
        // Update tax rate from settings if field is empty
        if (forceUpdate || taxRateField.value === '' || taxRateField.value === null) {
            const companySettings = await getCompanySettings();
            // Handle taxRate: 0 is a valid value, only skip if it's null or undefined
            if (companySettings && companySettings.taxRate !== undefined && companySettings.taxRate !== null) {
                taxRateField.value = companySettings.taxRate;
                // Trigger calculation after setting value
                if (invoiceProducts.length > 0) {
                    await calculateTotals();
                }
            } else if (forceUpdate) {
                // If force update and no setting, set to 0
                taxRateField.value = 0;
                // Trigger calculation if needed
                if (invoiceProducts.length > 0) {
                    await calculateTotals();
                }
            }
        }
    } catch (error) {
        console.error('Error loading tax rate from settings:', error);
    }
}

// Open New Invoice
async function openNewInvoice() {
    currentInvoice = null;
    invoiceProducts = [];
    selectedDeliveryNote = null;
    document.getElementById('isEdit').value = 'false';
    document.getElementById('invoiceId').value = '';
    document.getElementById('modalTitle').textContent = 'فاتورة مبيعات جديدة';
    document.getElementById('invoiceForm').reset();
    document.getElementById('invoiceProductsBody').innerHTML = '';
    document.getElementById('customerInfo').classList.add('hidden');
    document.getElementById('printBtn').style.display = 'none';
    
    // Load delivery notes
    await loadDeliveryNotes();
    renderDeliveryNotes(); // Show all available notes for new invoice
    
    // Re-setup delivery note search for new invoice
    setupDeliveryNoteSearch();
    
    // Enable delivery note search for new invoice
    const deliveryNoteSearch = document.getElementById('deliveryNoteSearch');
    if (deliveryNoteSearch) {
        deliveryNoteSearch.disabled = false;
    }
    
    // Clear delivery note selection for new invoice
    const hiddenInput = document.getElementById('deliveryNoteSelect');
    if (hiddenInput) {
        hiddenInput.value = '';
    }
    if (deliveryNoteSearch) {
        deliveryNoteSearch.value = '';
    }
    
    const today = new Date().toISOString().split('T')[0];
    const invoiceDateInput = document.getElementById('invoiceDate');
    invoiceDateInput.value = today;
    // Set min attribute to prevent selecting past dates (only for non-manager/non-engineer users)
    const userType = localStorage.getItem('asel_userType') || '';
    const canSelectPastDate = userType === 'manager' || userType === 'system_engineer';
    if (!canSelectPastDate) {
        invoiceDateInput.setAttribute('min', today);
    } else {
        invoiceDateInput.removeAttribute('min'); // Allow past dates for manager and engineer
    }
    invoiceDateInput.removeAttribute('max'); // Remove max restriction for new invoices
    setDueDate(); // This will set the due date and min attribute
    // Ensure min attribute is set on due date input
    const dueDateInput = document.getElementById('dueDate');
    if (dueDateInput && today) {
        dueDateInput.setAttribute('min', today);
    }
    document.getElementById('paymentMethod').value = 'cash';
    
    // Update status dropdown style
    const invoiceStatusSelect = document.getElementById('invoiceStatus');
    if (invoiceStatusSelect && typeof updateStatusDropdownStyle === 'function') {
        updateStatusDropdownStyle(invoiceStatusSelect);
    }
    
    // Load default tax rate from company settings (force update for new invoice)
    await loadTaxRateFromSettings(true);
    
    // Hide balance rows initially (will show when customer is selected)
    document.getElementById('newBalanceRow').style.display = 'none';
    document.getElementById('finalBalanceRow').style.display = 'none';
    
    // Show delivery note field initially (will be hidden if cash customer is selected)
    const formSections = document.querySelectorAll('.form-section');
    formSections.forEach(section => {
        const h3 = section.querySelector('h3');
        if (h3 && h3.textContent.includes('إذن الصرف')) {
            section.style.display = '';
        }
    });
    
    // Reload customers from database to get latest balances (especially after receipts are saved)
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            const dbCustomers = await window.electronAPI.dbGetAll('customers', '', []);
            if (dbCustomers && Array.isArray(dbCustomers)) {
                // Update customers array with latest data from database
                dbCustomers.forEach(dbCustomer => {
                    const customerIndex = customers.findIndex(c => c.id === dbCustomer.id);
                    if (customerIndex !== -1) {
                        customers[customerIndex] = { ...customers[customerIndex], ...dbCustomer };
                    } else {
                        customers.push(dbCustomer);
                    }
                });
                console.log('[Sales] openNewInvoice - Reloaded customers from database to get latest balances');
            }
        } catch (error) {
            console.error('[Sales] Error reloading customers from database:', error);
            // Continue with local customers data if database reload fails
        }
    }
    
    await calculateTotals();
    document.getElementById('invoiceModal').classList.add('active');
    
    // Ensure focus is restored after opening modal
    setTimeout(() => {
        window.focus();
        // Try to focus on first input field
        const firstInput = document.querySelector('#invoiceModal input:not([type="hidden"]), #invoiceModal select, #invoiceModal textarea');
        if (firstInput) {
            setTimeout(() => {
                firstInput.focus();
            }, 50);
        }
    }, 100);
}

// Load Delivery Notes
async function loadDeliveryNotes() {
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            deliveryNotes = await window.electronAPI.dbGetAll('delivery_notes', 'status = ?', ['issued']);
            deliveryNotes = Array.isArray(deliveryNotes) ? deliveryNotes : [];
            
            // Load items for each note
            for (let note of deliveryNotes) {
                if (!note.items) {
                    const noteItems = await window.electronAPI.dbGetAll('delivery_note_items', 'deliveryNoteId = ?', [note.id]);
                    note.items = (noteItems || []).map(item => ({
                        productId: item.productId,
                        productName: item.productName,
                        productCode: item.productCode || '',
                        quantity: item.quantity || 0,
                        unit: item.unit || '',
                        unitName: item.unitName || item.unit || '',
                        reservedQuantity: item.reservedQuantity || 0,
                        availableQuantity: item.availableQuantity || 0
                    }));
                }
            }
        } catch (error) {
            console.error('Error loading delivery notes:', error);
            deliveryNotes = [];
        }
    }
}

// Setup Delivery Note Search
function setupDeliveryNoteSearch() {
    const searchInput = document.getElementById('deliveryNoteSearch');
    const hiddenInput = document.getElementById('deliveryNoteSelect');
    const dropdown = document.getElementById('deliveryNoteDropdown');
    
    if (!searchInput || !hiddenInput || !dropdown) return;
    
    let selectedNote = null;
    
    function filterNotes(searchTerm) {
        if (!searchTerm || searchTerm.trim() === '') {
            return deliveryNotes.filter(note => note.status === 'issued');
        }
        
        const term = searchTerm.toLowerCase().trim();
        return deliveryNotes.filter(note => {
            if (note.status !== 'issued') return false;
            const number = (note.deliveryNoteNumber || '').toLowerCase();
            const keeperName = ((note.warehouseKeeperName || note.salesRepName || '')).toLowerCase();
            const date = new Date(note.date).toLocaleDateString('ar-EG');
            return number.includes(term) || keeperName.includes(term) || date.includes(term);
        });
    }
    
    function renderDropdown(filteredNotes) {
        dropdown.innerHTML = '';
        
        if (filteredNotes.length === 0) {
            dropdown.innerHTML = '<div class="dropdown-item no-results">لا توجد أذون صرف متاحة</div>';
            dropdown.classList.add('active');
            return;
        }
        
        filteredNotes.slice(0, 10).forEach(note => {
            const keeperName = note.warehouseKeeperName || note.salesRepName || '';
            const date = new Date(note.date).toLocaleDateString('ar-EG');
            const itemElement = document.createElement('div');
            itemElement.className = 'dropdown-item';
            itemElement.innerHTML = `
                <div class="delivery-note-info">
                    <div class="delivery-note-number">${note.deliveryNoteNumber}</div>
                    <div class="delivery-note-details">
                        <span class="keeper-name">${keeperName}</span>
                        <span class="delivery-note-date">${date}</span>
                    </div>
                </div>
            `;
            itemElement.addEventListener('click', () => {
                selectedNote = note;
                searchInput.value = `${note.deliveryNoteNumber} - ${keeperName} - ${date}`;
                hiddenInput.value = note.id;
                dropdown.classList.remove('active');
                onDeliveryNoteChange();
            });
            dropdown.appendChild(itemElement);
        });
        
        dropdown.classList.add('active');
    }
    
    // Handle input
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value;
        const filtered = filterNotes(term);
        renderDropdown(filtered);
    });
    
    // Handle focus
    searchInput.addEventListener('focus', () => {
        const term = searchInput.value;
        const filtered = filterNotes(term);
        renderDropdown(filtered);
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });
}

// Render Delivery Notes (for editing mode)
function renderDeliveryNotes(onlyNoteId = null) {
    const searchInput = document.getElementById('deliveryNoteSearch');
    const hiddenInput = document.getElementById('deliveryNoteSelect');
    
    if (!searchInput || !hiddenInput) return;
    
    // If onlyNoteId is provided, show only that note (for editing)
    if (onlyNoteId) {
        const note = deliveryNotes.find(n => n.id === onlyNoteId);
        if (note) {
            const keeperName = note.warehouseKeeperName || note.salesRepName || '';
            const date = new Date(note.date).toLocaleDateString('ar-EG');
            searchInput.value = `${note.deliveryNoteNumber} - ${keeperName} - ${date}`;
            hiddenInput.value = note.id;
            
            // Allow changing delivery note only for pending invoices (جاري التسليم)
            // Disable for delivered invoices (تم التسليم)
            searchInput.disabled = false; // Allow change for invoices
        }
        return;
    }
    
    // Reset for new invoice
    searchInput.value = '';
    hiddenInput.value = '';
    searchInput.disabled = false;
}

// Load Delivery Note for Edit
async function loadDeliveryNoteForEdit(deliveryNoteId) {
    // Load the specific delivery note from database if not in local array
    if (window.electronAPI && window.electronAPI.dbGet) {
        try {
            const note = await window.electronAPI.dbGet('delivery_notes', deliveryNoteId);
            if (note) {
                // Load note items
                const noteItems = await window.electronAPI.dbGetAll('delivery_note_items', 'deliveryNoteId = ?', [deliveryNoteId]);
                note.items = (noteItems || []).map(item => ({
                    productId: item.productId,
                    productName: item.productName,
                    productCode: item.productCode || '',
                    quantity: item.quantity || 0,
                    unit: item.unit || '',
                    unitName: item.unitName || item.unit || '',
                    reservedQuantity: item.reservedQuantity || 0,
                    availableQuantity: item.availableQuantity || 0
                }));
                
                // Add to local array if not exists
                const existingIndex = deliveryNotes.findIndex(n => n.id === note.id);
                if (existingIndex === -1) {
                    deliveryNotes.push(note);
                } else {
                    deliveryNotes[existingIndex] = note;
                }
                
                // Set as selected delivery note
                selectedDeliveryNote = note;
                
                // Render only this note
                renderDeliveryNotes(deliveryNoteId);
                
                // Setup product search for this delivery note
                setupProductSearchForDeliveryNote();
            }
        } catch (error) {
            console.error('Error loading delivery note for edit:', error);
            // Fallback to showing all notes
            renderDeliveryNotes();
        }
    } else {
        // Fallback to showing all notes
        renderDeliveryNotes();
    }
}

// On Delivery Note Change
async function onDeliveryNoteChange() {
    const hiddenInput = document.getElementById('deliveryNoteSelect');
    const deliveryNoteId = hiddenInput ? hiddenInput.value : null;
    
    if (!deliveryNoteId) {
        selectedDeliveryNote = null;
        // Only clear products if not editing an existing invoice
        if (!currentInvoice) {
            invoiceProducts = [];
            renderInvoiceProducts();
        }
        setupProductSearch(); // Reset to show all products
        return;
    }
    
    // Always reload delivery note from database to get updated availableQuantity
    if (window.electronAPI && window.electronAPI.dbGet) {
        try {
            const note = await window.electronAPI.dbGet('delivery_notes', deliveryNoteId);
            if (note) {
                // Load note items with updated availableQuantity
                const noteItems = await window.electronAPI.dbGetAll('delivery_note_items', 'deliveryNoteId = ?', [deliveryNoteId]);
                
                // Calculate quantities from all invoices (pending and delivered) for this delivery note
                // This ensures we have the correct availableQuantity even if database is not updated
                let pendingInvoicesReserved = {};
                if (window.electronAPI && window.electronAPI.dbGetAll) {
                    try {
                        // Get all invoices using this delivery note (excluding current invoice if editing)
                        const allInvoices = await window.electronAPI.dbGetAll('sales_invoices', 
                            'deliveryNoteId = ?', 
                            [deliveryNoteId]);
                        
                        // Calculate quantities from all invoices
                        for (const invoice of allInvoices || []) {
                            // Skip current invoice if editing (its quantities are already restored)
                            if (currentInvoice && invoice.id === currentInvoice.id) {
                                continue;
                            }
                            
                            const invoiceItems = await window.electronAPI.dbGetAll('sales_invoice_items', 
                                'invoiceId = ?', [invoice.id]);
                            
                            for (const invoiceItem of invoiceItems || []) {
                                const key = `${invoiceItem.productId}_${invoiceItem.unit}`;
                                
                                // All invoices: add to reserved
                                if (!pendingInvoicesReserved[key]) {
                                    pendingInvoicesReserved[key] = 0;
                                }
                                pendingInvoicesReserved[key] += (invoiceItem.quantity || 0);
                            }
                        }
                    } catch (error) {
                        console.error('Error calculating quantities from invoices:', error);
                    }
                }
                
                // Calculate available quantity dynamically:
                // availableQuantity = totalQuantity - deliveredQuantities - reservedQuantities
                let itemsWithCorrectAvailable = (noteItems || []).map(item => {
                    const totalQuantity = item.quantity || 0;
                    const key = `${item.productId}_${item.unit}`;
                    
                    // Get quantities from invoices
                    const reservedQty = pendingInvoicesReserved[key] || 0;
                    
                    // Calculate available quantity: total - reserved
                    const calculatedAvailable = Math.max(0, totalQuantity - reservedQty);
                    
                    // Use calculated reserved quantity
                    const finalReservedQty = reservedQty > 0 ? reservedQty : (item.reservedQuantity || 0);
                    
                    return {
                        productId: item.productId,
                        productName: item.productName,
                        productCode: item.productCode || '',
                        quantity: totalQuantity, // Total quantity in delivery note
                        unit: item.unit || '',
                        unitName: item.unitName || item.unit || '',
                        reservedQuantity: finalReservedQty, // Use calculated reserved quantity
                        availableQuantity: calculatedAvailable // Calculate dynamically from invoices
                    };
                });
                
                selectedDeliveryNote = {
                    ...note,
                    items: itemsWithCorrectAvailable
                };
                
                // Update local array as well
                const localNoteIndex = deliveryNotes.findIndex(n => n.id === deliveryNoteId);
                if (localNoteIndex !== -1) {
                    deliveryNotes[localNoteIndex] = selectedDeliveryNote;
                }
            } else {
                showMessage('إذن الصرف غير موجود', 'error');
                return;
            }
        } catch (error) {
            console.error('Error loading delivery note:', error);
            // Fallback to local array
            selectedDeliveryNote = deliveryNotes.find(n => n.id === deliveryNoteId);
            if (!selectedDeliveryNote) {
                showMessage('إذن الصرف غير موجود', 'error');
                return;
            }
        }
    } else {
        // Fallback to local array if API not available
        selectedDeliveryNote = deliveryNotes.find(n => n.id === deliveryNoteId);
        if (!selectedDeliveryNote) {
            showMessage('إذن الصرف غير موجود', 'error');
            return;
        }
    }
    
    // Update product search to show only products from delivery note
    setupProductSearchForDeliveryNote();
}

// On Customer Change
async function onCustomerChange() {
    console.log('[Sales] onCustomerChange called');
    const customerId = document.getElementById('customerSelect').value;
    if (!customerId) {
        document.getElementById('customerInfo').classList.add('hidden');
        // Hide balance rows when no customer selected
        document.getElementById('newBalanceRow').style.display = 'none';
        document.getElementById('finalBalanceRow').style.display = 'none';
        
        // Show delivery note field when no customer selected
        const formSections = document.querySelectorAll('.form-section');
        formSections.forEach(section => {
            const h3 = section.querySelector('h3');
            if (h3 && h3.textContent.includes('إذن الصرف')) {
                section.style.display = '';
            }
        });
        
        await calculateTotals();
        return;
    }

    // Reload customer from database to get latest balance (especially after receipts are saved)
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
                    console.log('[Sales] onCustomerChange - Reloaded customer from database, balance:', customer.balance);
                }
            }
        } catch (error) {
            console.error('[Sales] Error reloading customer from database:', error);
            // Continue with local customer data if database reload fails
        }
    }
    
    if (customer) {
        console.log('[Sales] onCustomerChange - Customer found:', customer.name, 'Code:', customer.code, 'Balance:', customer.balance);
        
        // Use the updated balance from database directly (already reloaded above)
        // الرصيد في قاعدة البيانات محفوظ بالجنيه المصري مباشرة
        let oldBalance = parseFloat(customer.balance || 0);
        
        // If editing existing invoice, add back the old invoice remaining to get the balance before this invoice
        if (currentInvoice && currentInvoice.id) {
            try {
                const oldInvoiceRemaining = parseFloat(currentInvoice.remaining || 0);
                oldBalance = oldBalance + oldInvoiceRemaining;
                console.log('[Sales] onCustomerChange - Added back old invoice remaining for edit:', oldInvoiceRemaining);
            } catch (error) {
                console.error('[Sales] Error getting old invoice remaining in onCustomerChange:', error);
                // Continue with current balance if error
            }
        }
        
        console.log('[Sales] onCustomerChange - Using updated balance from database:', {
            customerId,
            oldBalance,
            isEdit: !!(currentInvoice && currentInvoice.id)
        });
        
        document.getElementById('oldBalance').textContent = `${oldBalance.toFixed(2)} ج.م`;
        document.getElementById('customerInfo').classList.remove('hidden');
        
        // Check if this is cash customer (trim and case-insensitive check)
        const customerCode = (customer.code || '').trim().toUpperCase();
        const isCashCustomer = customerCode === 'CASH';
        
        console.log('[Sales] onCustomerChange - isCashCustomer:', isCashCustomer);
        
        // Hide/show delivery note field based on customer type
        // Find the form-section that contains "إذن الصرف"
        const formSections = document.querySelectorAll('.form-section');
        let deliveryNoteSection = null;
        formSections.forEach(section => {
            const h3 = section.querySelector('h3');
            if (h3 && h3.textContent.includes('إذن الصرف')) {
                deliveryNoteSection = section;
            }
        });
        
        if (deliveryNoteSection) {
            if (isCashCustomer) {
                console.log('[Sales] onCustomerChange - Hiding delivery note field for cash customer');
                deliveryNoteSection.style.display = 'none';
                // Clear selected delivery note for cash customer
                selectedDeliveryNote = null;
                const hiddenInput = document.getElementById('deliveryNoteSelect');
                if (hiddenInput) {
                    hiddenInput.value = '';
                    hiddenInput.removeAttribute('required');
                }
                const deliveryNoteSearch = document.getElementById('deliveryNoteSearch');
                if (deliveryNoteSearch) {
                    deliveryNoteSearch.value = '';
                    deliveryNoteSearch.removeAttribute('required');
                }
                // Use normal product search for cash customer (no delivery note restrictions)
                // Pass true to show all products regardless of status for cash customer
                console.log('[Sales] onCustomerChange - Setting up normal product search for cash customer');
                setupProductSearch(true);
                
                // Set invoice status to "delivered" automatically for cash customer
                const invoiceStatusSelect = document.getElementById('invoiceStatus');
                if (invoiceStatusSelect) {
                    invoiceStatusSelect.value = 'delivered';
                    console.log('[Sales] onCustomerChange - Set invoice status to "delivered" for cash customer');
                    // Update status dropdown style
                    if (typeof updateStatusDropdownStyle === 'function') {
                        updateStatusDropdownStyle(invoiceStatusSelect);
                    }
                }
            } else {
                console.log('[Sales] onCustomerChange - Showing delivery note field for non-cash customer');
                deliveryNoteSection.style.display = '';
                // Make delivery note required for non-cash customers
                const hiddenInput = document.getElementById('deliveryNoteSelect');
                if (hiddenInput) {
                    hiddenInput.setAttribute('required', 'required');
                }
                const deliveryNoteSearch = document.getElementById('deliveryNoteSearch');
                if (deliveryNoteSearch) {
                    deliveryNoteSearch.setAttribute('required', 'required');
                }
                // Enable status change for non-cash customers
                const invoiceStatusSelect = document.getElementById('invoiceStatus');
                if (invoiceStatusSelect) {
                    invoiceStatusSelect.disabled = false;
                }
                // If delivery note is selected, use delivery note product search
                if (selectedDeliveryNote) {
                    setupProductSearchForDeliveryNote();
                } else {
                    setupProductSearch();
                }
            }
        } else {
            console.warn('[Sales] onCustomerChange - delivery note section not found!');
        }
        
        await calculateTotals(); // This will show the balance rows
    } else {
        console.warn('[Sales] onCustomerChange - Customer not found for ID:', customerId);
    }
}


// Remove stock info message
function removeStockInfoMessage() {
    const existingStockMsg = document.getElementById('stockInfoMessage');
    if (existingStockMsg) {
        existingStockMsg.remove();
    }
}

// Update stock display when unit changes
function updateStockOnUnitChange() {
    const productSelect = document.getElementById('productSelect');
    const unitSelect = document.getElementById('productUnit');
    
    // Remove existing message first
    removeStockInfoMessage();
    
    if (!productSelect || !productSelect.value || !unitSelect) {
        return;
    }
    
    // Get product from products array
    const productData = products.find(p => p.id === productSelect.value);
    if (!productData) {
        return;
    }
    
    const unit = unitSelect.value;
    
    // Calculate stock based on selected unit
    let stock = 0;
    let unitName = '';
    
    if (unit === 'smallest') {
        stock = productData.stock || 0;
        unitName = productData.smallestUnit || 'أصغر وحدة';
    } else {
        const conversionFactor = productData.conversionFactor || 1;
        stock = (productData.stock || 0) / conversionFactor;
        unitName = productData.largestUnit || 'أكبر وحدة';
    }
    
    // Update price based on unit
    const priceInput = document.getElementById('productPrice');
    if (priceInput && productData) {
        if (unit === 'smallest') {
            priceInput.value = productData.smallestPrice || 0;
        } else {
            priceInput.value = productData.largestPrice || 0;
        }
    }
    
    // Create stock info message
    const stockInfo = document.createElement('div');
    stockInfo.id = 'stockInfoMessage';
    stockInfo.style.cssText = 'margin-top: 8px; padding: 8px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 4px; color: #0369a1; font-size: 0.875rem;';
    stockInfo.textContent = `المخزون المتاح: ${formatArabicNumber(stock, 2)} ${unitName}`;
    
    // Insert after unit select
    const unitSelectParent = unitSelect.parentElement;
    if (unitSelectParent) {
        unitSelectParent.appendChild(stockInfo);
    }
}

// Add Product to Invoice
async function addProductToInvoice() {
    console.log('[Sales] addProductToInvoice called');
    
    const productSelect = document.getElementById('productSelect');
    const quantityInput = document.getElementById('productQuantity');
    const unitSelect = document.getElementById('productUnit');
    const priceInput = document.getElementById('productPrice');

    if (!productSelect.value || !quantityInput.value || !priceInput.value) {
        showMessage('يرجى ملء جميع الحقول', 'error');
        return;
    }

    // Get product from products array
    const productData = products.find(p => p.id === productSelect.value);
    if (!productData) {
        showMessage('المنتج غير موجود', 'error');
        return;
    }
    const quantity = parseFloat(quantityInput.value);
    const unit = unitSelect.value;
    const price = parseFloat(priceInput.value);
    
    // Check stock availability
    const stock = unit === 'smallest' ? (productData.stock || 0) : (productData.stock || 0) / (productData.conversionFactor || 1);
    
    // Check if quantity exceeds stock
    if (quantity > stock) {
        showMessage(`⚠️ الكمية المتاحة في المخزون: ${stock.toFixed(2)} ${unit === 'smallest' ? productData.smallestUnit : productData.largestUnit}`, 'error');
        return;
    }
    
    // Check if product already exists in invoice
    const existingProduct = invoiceProducts.find(p => p.productId === productData.id && p.unit === unit);
    if (existingProduct) {
        const newTotalQuantity = existingProduct.quantity + quantity;
        if (newTotalQuantity > stock) {
            const remainingFromStock = stock - (existingProduct.quantity || 0);
            showMessage(`⚠️ الكمية المتاحة في المخزون: ${stock.toFixed(2)} ${unit === 'smallest' ? productData.smallestUnit : productData.largestUnit}. يمكن إضافة: ${remainingFromStock.toFixed(2)}`, 'error');
            return;
        }
        existingProduct.quantity = newTotalQuantity;
        existingProduct.total = newTotalQuantity * existingProduct.price;
        renderInvoiceProducts();
        await calculateTotals();
        
        // Reset inputs
        productSelect.value = '';
        document.getElementById('productSearch').value = '';
        quantityInput.value = '';
        priceInput.value = '';
        unitSelect.value = 'smallest';
        document.getElementById('productDropdown').classList.remove('active');
        // Remove stock info message
        removeStockInfoMessage();
        return;
    }

    // Get product from products array
    let currentProduct = productData;
    if (window.electronAPI && window.electronAPI.dbGet) {
        try {
            const dbProduct = await window.electronAPI.dbGet('products', productData.id);
            if (dbProduct) {
                currentProduct = dbProduct;
            }
        } catch (error) {
            console.error('Error loading product from database:', error);
        }
    }

    // Calculate quantity in smallest unit
    let quantityInSmallestUnit = quantity;
    if (unit === 'largest') {
        // Convert from largest unit to smallest unit
        const conversionFactor = currentProduct.conversionFactor || 1;
        quantityInSmallestUnit = quantity * conversionFactor;
    }

    const invoiceProduct = {
        productId: currentProduct.id,
        productName: currentProduct.name,
        productCode: currentProduct.code,
        category: currentProduct.category || '', // Store category
        quantity: quantity,
        quantityInSmallestUnit: quantityInSmallestUnit, // Store converted quantity
        unit: unit,
        unitName: unit === 'smallest' ? currentProduct.smallestUnit : currentProduct.largestUnit,
        smallestUnit: currentProduct.smallestUnit || '', // Store smallest unit name
        price: price,
        total: quantity * price
    };

    invoiceProducts.push(invoiceProduct);
    renderInvoiceProducts();
    await calculateTotals();
    
    // Use normal product search
    setupProductSearch();

    // Reset inputs
    productSelect.value = '';
    document.getElementById('productSearch').value = '';
    quantityInput.value = '';
    priceInput.value = '';
    unitSelect.value = 'smallest';
    document.getElementById('productDropdown').classList.remove('active');
    // Remove stock info message
    removeStockInfoMessage();
}

// Remove Product from Invoice
async function removeProduct(index) {
    // Remove product from invoice
    invoiceProducts.splice(index, 1);
    renderInvoiceProducts();
    await calculateTotals();
}

// Render Invoice Products
function renderInvoiceProducts() {
    const tbody = document.getElementById('invoiceProductsBody');
    tbody.innerHTML = '';

    if (invoiceProducts.length === 0) {
        // Show empty state message in table
        const emptyRow = document.createElement('tr');
        emptyRow.className = 'empty-products-row';
        emptyRow.innerHTML = `
            <td colspan="6" style="text-align: center; padding: 40px 20px; color: #94a3b8; font-size: 0.875rem;">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                    <span style="font-size: 2rem;">📦</span>
                    <span>لا توجد منتجات مضافة</span>
                </div>
            </td>
        `;
        tbody.appendChild(emptyRow);
        return;
    }

    invoiceProducts.forEach((product, index) => {
        const row = document.createElement('tr');
        row.className = 'product-row';
        const productNameDisplay = `${product.productName}${product.category ? ` - ${product.category}` : ''} ${product.productCode ? `(${product.productCode})` : ''}`;
        row.innerHTML = `
            <td class="product-name-cell">
                <div class="product-name-wrapper">
                    <strong class="product-name">${product.productName}</strong>
                    ${product.category ? `<span class="product-category-badge">${product.category}</span>` : ''}
                    ${product.productCode ? `<span class="product-code">(${product.productCode})</span>` : ''}
                </div>
            </td>
            <td class="quantity-cell">
                <span class="quantity-value">${formatArabicNumber(product.quantity)}</span>
            </td>
            <td class="unit-cell">
                <span class="unit-badge">${product.unitName || (product.unit === 'smallest' ? 'أصغر وحدة' : 'أكبر وحدة')}</span>
            </td>
            <td class="price-cell">
                <span class="price-value">${formatArabicNumber(product.price.toFixed(2))}</span>
                <span class="currency-symbol">ج.م</span>
            </td>
            <td class="total-cell">
                <strong class="total-value">${formatArabicNumber(product.total.toFixed(2))}</strong>
                <span class="currency-symbol">ج.م</span>
            </td>
            <td class="action-cell">
                <button type="button" class="action-btn delete-btn" data-product-index="${index}" title="حذف المنتج">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                </button>
            </td>
        `;
        
        // Add event listener to delete button
        const deleteBtn = row.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => removeProduct(index));
        }
        
        tbody.appendChild(row);
    });
}

// Calculate Totals
async function calculateTotals() {
    // Calculate subtotal: sum of products
    let subtotal = 0;
    
    if (invoiceProducts.length > 0) {
        // Calculate subtotal from products
        subtotal = invoiceProducts.reduce((sum, p) => sum + p.total, 0);
    } else {
        subtotal = 0;
    }
    
    const taxRateField = document.getElementById('taxRate');
    let taxRate = parseFloat(taxRateField.value);
    
    // Use the value from the field, or 0 if empty/invalid
    // Don't auto-fill from settings here - let user control it
    if (isNaN(taxRate) || taxRateField.value === '') {
        taxRate = 0;
    }
    
    const taxAmount = (subtotal * taxRate) / 100;
    const shipping = parseFloat(document.getElementById('shipping').value) || 0;
    const discount = parseFloat(document.getElementById('discount').value) || 0;
    const total = subtotal + taxAmount + shipping - discount;
    const paid = parseFloat(document.getElementById('paid').value) || 0;
    const remaining = total - paid;

    document.getElementById('subtotal').textContent = `${subtotal.toFixed(2)} ج.م`;
    document.getElementById('taxAmount').textContent = `${taxAmount.toFixed(2)} ج.م`;
    document.getElementById('total').textContent = `${total.toFixed(2)} ج.م`;
    document.getElementById('remaining').textContent = `${remaining.toFixed(2)} ج.م`;

    // Show balance info if customer selected (for both pending and delivered)
    const customerId = document.getElementById('customerSelect').value;
    
    if (customerId) {
        // Reload customer from database to get latest balance (especially after receipts are saved)
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
                        console.log('[Sales] calculateTotals - Reloaded customer from database, balance:', customer.balance);
                    }
                }
            } catch (error) {
                console.error('[Sales] Error reloading customer from database in calculateTotals:', error);
                // Continue with local customer data if database reload fails
            }
        }
        
        if (customer) {
            // الرصيد القديم = الرصيد الحالي من قاعدة البيانات مباشرة (تم إعادة تحميله أعلاه)
            // الرصيد في قاعدة البيانات محفوظ بالجنيه المصري مباشرة
            let oldBalance = parseFloat(customer.balance || 0);
            
            // عند تعديل فاتورة موجودة: إضافة المتبقي القديم للفاتورة لإرجاع الرصيد إلى ما كان عليه قبل هذه الفاتورة
            if (currentInvoice && currentInvoice.id) {
                try {
                    // المتبقي في قاعدة البيانات محفوظ بالجنيه المصري مباشرة
                    const oldInvoiceRemaining = parseFloat(currentInvoice.remaining || 0);
                    oldBalance = oldBalance + oldInvoiceRemaining;
                    console.log('[Sales] calculateTotals - Editing invoice: Added back old invoice remaining to get balance before this invoice:', {
                        currentBalance: parseFloat(customer.balance || 0),
                        oldInvoiceRemaining,
                        calculatedOldBalance: oldBalance
                    });
                } catch (error) {
                    console.error('[Sales] Error getting old invoice remaining in calculateTotals:', error);
                    // Continue with current balance if error
                }
            }
            
            console.log('[Sales] calculateTotals - Using updated balance from database:', {
                customerId,
                oldBalance,
                isEdit: !!(currentInvoice && currentInvoice.id)
            });
            
            // الرصيد الجديد = الرصيد القديم + المتبقي (remaining)
            // المتبقي = الإجمالي - المدفوع
            // إذن: الرصيد الجديد = الرصيد القديم + (الإجمالي - المدفوع)
            const newBalance = oldBalance + remaining;
            
            console.log('[Sales] calculateTotals - Balance calculation:', {
                oldBalance,
                remaining,
                newBalance,
                calculation: `${oldBalance} + ${remaining} = ${newBalance}`
            });
            
            // Update oldBalance in customerInfo section as well
            const oldBalanceElement = document.getElementById('oldBalance');
            if (oldBalanceElement) {
                oldBalanceElement.textContent = `${oldBalance.toFixed(2)} ج.م`;
            }
            
            // Update oldBalanceDisplay in totals section
            const oldBalanceDisplayElement = document.getElementById('oldBalanceDisplay');
            if (oldBalanceDisplayElement) {
                oldBalanceDisplayElement.textContent = `${oldBalance.toFixed(2)} ج.م`;
            } else {
                console.warn('[Sales] calculateTotals - oldBalanceDisplay element not found');
            }
            
            const newBalanceDisplayElement = document.getElementById('newBalanceDisplay');
            if (newBalanceDisplayElement) {
                newBalanceDisplayElement.textContent = `${newBalance.toFixed(2)} ج.م`;
            } else {
                console.warn('[Sales] calculateTotals - newBalanceDisplay element not found');
            }
            
            const newBalanceRowElement = document.getElementById('newBalanceRow');
            if (newBalanceRowElement) {
                newBalanceRowElement.style.display = 'flex';
            } else {
                console.warn('[Sales] calculateTotals - newBalanceRow element not found');
            }
            
            const finalBalanceRowElement = document.getElementById('finalBalanceRow');
            if (finalBalanceRowElement) {
                finalBalanceRowElement.style.display = 'flex';
            } else {
                console.warn('[Sales] calculateTotals - finalBalanceRow element not found');
            }
        }
    } else {
        document.getElementById('newBalanceRow').style.display = 'none';
        document.getElementById('finalBalanceRow').style.display = 'none';
    }
}

// Handle Form Submit
async function handleFormSubmit(e) {
    e.preventDefault();
    
    // منع الضغط المتكرر
    if (isSavingInvoice) {
        console.log('[Sales] Save already in progress, ignoring duplicate submit');
        return;
    }
    
    // تعيين حالة الحفظ
    isSavingInvoice = true;
    
    // تعطيل زر الحفظ وتغيير النص
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalButtonText = submitButton ? submitButton.textContent : '';
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'جاري الحفظ...';
    }
    
    try {
        console.log('[Sales] handleFormSubmit called - starting validation...');

        const customerId = document.getElementById('customerSelect').value;
    const date = document.getElementById('invoiceDate').value;
    let dueDate = document.getElementById('dueDate').value || '';
    // Status removed - invoices are always active unless cancelled
    const paymentMethod = document.getElementById('paymentMethod').value || 'cash';
    
    // Validate that due date is not before invoice date (applies to ALL users, including manager and engineer)
    if (date && dueDate) {
        const invoiceDateObj = new Date(date);
        const dueDateObj = new Date(dueDate);
        invoiceDateObj.setHours(0, 0, 0, 0);
        dueDateObj.setHours(0, 0, 0, 0);
        
        if (dueDateObj < invoiceDateObj) {
            showMessage('لا يمكن أن يكون تاريخ الاستحقاق قبل تاريخ الفاتورة. يرجى اختيار تاريخ صحيح', 'error');
            isSavingInvoice = false;
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
            return;
        }
    }
    const discount = parseFloat(document.getElementById('discount').value) || 0;
    const paid = parseFloat(document.getElementById('paid').value) || 0;

    if (!customerId) {
        showMessage('يرجى اختيار العميل', 'error');
        isSavingInvoice = false;
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
        return;
    }
    
    // Prevent creating invoices with past dates (only for non-manager/non-engineer users)
    if (!currentInvoice && date) {
        const userType = localStorage.getItem('asel_userType') || '';
        const canSelectPastDate = userType === 'manager' || userType === 'system_engineer';
        
        if (!canSelectPastDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Reset time to start of day
            
            const invoiceDate = new Date(date);
            invoiceDate.setHours(0, 0, 0, 0); // Reset time to start of day
            
            if (invoiceDate < today) {
                showMessage('لا يمكن إنشاء فاتورة بتاريخ سابق. يرجى اختيار تاريخ اليوم أو تاريخ لاحق', 'error');
                isSavingInvoice = false;
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = originalButtonText;
                }
                return;
            }
        }
    }

    // Check if products exist
    if (invoiceProducts.length === 0) {
        showMessage('يرجى إضافة منتجات للفاتورة', 'error');
        isSavingInvoice = false;
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
        return;
    }

    // Calculate subtotal: sum of products
    let subtotal = 0;
    
    if (invoiceProducts.length > 0) {
        subtotal = invoiceProducts.reduce((sum, p) => sum + p.total, 0);
    }
    const taxRate = parseFloat(document.getElementById('taxRate').value) || 0;
    const taxAmount = (subtotal * taxRate) / 100;
    const shipping = parseFloat(document.getElementById('shipping').value) || 0;
    const total = subtotal + taxAmount + shipping - discount;
    const remaining = total - paid;

    const invoiceId = currentInvoice ? currentInvoice.id : Date.now().toString();
    
    console.log('[Sales] handleFormSubmit - invoiceProducts:', {
        count: invoiceProducts.length,
        products: invoiceProducts.map(p => ({
            productName: p.productName,
            quantity: p.quantity,
            price: p.price,
            total: p.total
        }))
    });
    
    // Check if customer is cash customer
    const selectedCustomer = customers.find(c => c.id === customerId);
    if (!selectedCustomer) {
        showMessage('العميل غير موجود', 'error');
        isSavingInvoice = false;
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
        return;
    }
    
    
    // Generate invoice number and check for duplicates
    let invoiceNumber = currentInvoice ? currentInvoice.invoiceNumber : await generateInvoiceNumber();
    
    // Check if invoice number already exists (only for new invoices)
    if (!currentInvoice && window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            const existingInvoices = await window.electronAPI.dbGetAll('sales_invoices', 'invoiceNumber = ?', [invoiceNumber]);
            if (existingInvoices && existingInvoices.length > 0) {
                // Generate a new number if duplicate found
                console.warn('Invoice number already exists, generating new one:', invoiceNumber);
                invoiceNumber = await generateInvoiceNumber();
                // Check again (should be very rare)
                const checkAgain = await window.electronAPI.dbGetAll('sales_invoices', 'invoiceNumber = ?', [invoiceNumber]);
                if (checkAgain && checkAgain.length > 0) {
                    // Use timestamp-based number as fallback
                    invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now()}`;
                }
            }
        } catch (error) {
            console.error('Error checking invoice number:', error);
            // Continue with generated number
        }
    }
    
    // Calculate old balance for saving (to preserve it at invoice creation time)
    // الرصيد القديم = الرصيد الحالي من قاعدة البيانات (يُحفظ في عمود oldBalance في الفاتورة)
    let oldBalanceToSave = null;
    if (!selectedCustomer) {
        console.error('[Sales] selectedCustomer is undefined when calculating old balance');
        showMessage('خطأ: العميل غير موجود', 'error');
        isSavingInvoice = false;
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
        return;
    }
    
    // إعادة تحميل العميل من قاعدة البيانات للحصول على الرصيد الحالي المحدث
    let customerForBalance = selectedCustomer;
    if (window.electronAPI && window.electronAPI.dbGet) {
        try {
            const dbCustomer = await window.electronAPI.dbGet('customers', customerId);
            if (dbCustomer) {
                customerForBalance = dbCustomer;
                console.log('[Sales] handleFormSubmit - Reloaded customer from database, current balance:', customerForBalance.balance);
            }
        } catch (error) {
            console.error('[Sales] Error reloading customer from database in handleFormSubmit:', error);
            // Continue with local customer data if database reload fails
        }
    }
    
    // الرصيد القديم = الرصيد الحالي من قاعدة البيانات مباشرة
    let calculatedOldBalance = parseFloat(customerForBalance.balance || 0);
    
    // عند تعديل فاتورة موجودة: إضافة المتبقي القديم للفاتورة لإرجاع الرصيد إلى ما كان عليه قبل هذه الفاتورة
    if (currentInvoice && currentInvoice.id && currentInvoice.customerId === customerId) {
        const oldInvoiceRemaining = parseFloat(currentInvoice.remaining || 0);
        calculatedOldBalance = calculatedOldBalance + oldInvoiceRemaining;
        console.log('[Sales] handleFormSubmit - Editing invoice: Added back old invoice remaining to get balance before this invoice:', {
            currentBalance: parseFloat(customerForBalance.balance || 0),
            oldInvoiceRemaining,
            calculatedOldBalance
        });
    }
    
    // الرصيد يُحفظ بالجنيه المصري مباشرة في قاعدة البيانات
    // الرصيد القديم يُحفظ في عمود oldBalance في جدول sales_invoices
    oldBalanceToSave = calculatedOldBalance;
    
    // حساب القديم + الإجمالي (oldBalance + total)
    const oldBalancePlusTotal = oldBalanceToSave + total;
    
    // حساب الرصيد الجديد (oldBalance + remaining)
    // الرصيد الجديد = الرصيد القديم + المتبقي
    const newBalanceToSave = oldBalanceToSave + remaining;
    
    // حساب المتبقي من الفاتورة والرصيد القديم (oldBalance + remaining)
    // هذه القيمة = newBalance (لكن نحفظها كعمود منفصل للوضوح)
    const remainingWithOldBalanceToSave = oldBalanceToSave + remaining;
    
    console.log('[Sales] handleFormSubmit - Balance calculations to save in invoice:', {
        calculatedOldBalance,
        oldBalanceToSave,
        total,
        remaining,
        oldBalancePlusTotal,
        newBalanceToSave,
        remainingWithOldBalanceToSave,
        isEdit: !!(currentInvoice && currentInvoice.id)
    });
    
    const notes = document.getElementById('notes').value.trim() || '';
    
    const invoiceData = {
        id: invoiceId,
        invoiceNumber: invoiceNumber,
        customerId: customerId,
        date: date,
        dueDate: dueDate,
        paymentMethod: paymentMethod,
        notes: notes,
        deliveryNoteId: null,
        deliveryNoteNumber: null,
        subtotal: subtotal,
        taxRate: taxRate,
        taxAmount: taxAmount,
        shipping: shipping,
        discount: discount,
        total: total,
        paid: paid,
        remaining: remaining,
        // الرصيد القديم يُحفظ في عمود oldBalance في جدول sales_invoices
        // الرصيد القديم = الرصيد الحالي من قاعدة البيانات (قبل إضافة هذه الفاتورة)
        // ⚠️ مهم: هذه القيم تظل ثابتة ولا تتغير حتى بعد إنشاء فواتير جديدة أو سندات قبض
        // لأنها تمثل "لقطة تاريخية" (snapshot) من الرصيد في وقت إنشاء الفاتورة
        oldBalance: oldBalanceToSave,
        // القديم + الإجمالي يُحفظ في عمود oldBalancePlusTotal
        // ⚠️ هذه القيمة تظل ثابتة ولا تتغير
        oldBalancePlusTotal: oldBalancePlusTotal,
        // الرصيد الجديد يُحفظ في عمود newBalance
        // الرصيد الجديد = الرصيد القديم + المتبقي
        // ⚠️ هذه القيمة تظل ثابتة ولا تتغير
        newBalance: newBalanceToSave,
        // المتبقي من الفاتورة والرصيد القديم يُحفظ في عمود remainingWithOldBalance
        // المتبقي من الفاتورة والرصيد القديم = الرصيد القديم + المتبقي = newBalance
        // ⚠️ هذه القيمة تظل ثابتة ولا تتغير (لقطة تاريخية)
        remainingWithOldBalance: remainingWithOldBalanceToSave,
        products: [...invoiceProducts], // Include products from form
        createdAt: currentInvoice ? currentInvoice.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

        // Save to database first
        if (window.electronAPI && window.electronAPI.dbInsert && window.electronAPI.dbUpdate) {
            // Prepare invoice data for database (without products array)
            const invoiceDbData = { ...invoiceData };
            delete invoiceDbData.products;
            
            // Get old invoice items before deletion (for updating delivery note quantities)
            let oldInvoiceItems = [];
            if (currentInvoice) {
                oldInvoiceItems = await window.electronAPI.dbGetAll('sales_invoice_items', 'invoiceId = ?', [invoiceId]);
            }
            
            if (currentInvoice) {
                // Update existing invoice in database
                // dbUpdate expects (table, id, data)
                const updateResult = await window.electronAPI.dbUpdate('sales_invoices', invoiceId, invoiceDbData);
                
                // Check if update was successful
                // updateResult from better-sqlite3 is {changes: number}
                // In case of error, it returns {success: false, error: ...}
                if (updateResult && updateResult.success === false) {
                    const errorMsg = updateResult.error || 'فشل تحديث الفاتورة في قاعدة البيانات';
                    console.error('Failed to update invoice:', updateResult);
                    throw new Error(errorMsg);
                }
                if (!updateResult || (updateResult.changes === undefined)) {
                    console.error('Invalid update result:', updateResult);
                    throw new Error('فشل تحديث الفاتورة في قاعدة البيانات: نتيجة غير صحيحة');
                }
                
                
                // Delete old invoice items
                if (window.electronAPI && window.electronAPI.dbQuery) {
                    await window.electronAPI.dbQuery('DELETE FROM sales_invoice_items WHERE invoiceId = ?', [invoiceId]);
                } else {
                    // Fallback: get all items and delete one by one
                    for (const item of oldInvoiceItems) {
                        await window.electronAPI.dbDelete('sales_invoice_items', item.id);
                    }
                }
            } else {
                // Insert new invoice in database
                // Add createdBy to track who created this invoice
                if (!invoiceDbData.createdBy) {
                    if (typeof addCreatedBy === 'function') {
                        addCreatedBy(invoiceDbData);
                    } else {
                        const currentUser = localStorage.getItem('asel_user') || localStorage.getItem('asel_userId') || '';
                        if (currentUser) {
                            invoiceDbData.createdBy = currentUser;
                        }
                    }
                }
                
                const insertResult = await window.electronAPI.dbInsert('sales_invoices', invoiceDbData);
                
                // Check if insert was successful
                // insertResult from better-sqlite3 is {changes: number, lastInsertRowid: number}
                // In case of error, it returns {success: false, error: ...}
                if (insertResult && insertResult.success === false) {
                    const errorMsg = insertResult.error || 'فشل حفظ الفاتورة في قاعدة البيانات';
                    console.error('Failed to insert invoice:', insertResult);
                    throw new Error(errorMsg);
                }
                if (!insertResult || (insertResult.changes === undefined && insertResult.lastInsertRowid === undefined)) {
                    console.error('Invalid insert result:', insertResult);
                    throw new Error('فشل حفظ الفاتورة في قاعدة البيانات: نتيجة غير صحيحة');
                }
            }
            
            // Save invoice items and update delivery note quantities
            for (const product of invoiceProducts) {
                const itemData = {
                    id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
                    invoiceId: invoiceId,
                    productId: product.productId,
                    productName: product.productName || product.name || '',
                    quantity: product.quantity || 0,
                    unit: product.unit || product.unitName || '',
                    price: product.price || 0,
                    total: product.total || 0
                };
                const itemInsertResult = await window.electronAPI.dbInsert('sales_invoice_items', itemData);
                // Check if insert was successful
                // itemInsertResult from better-sqlite3 is {changes: number, lastInsertRowid: number}
                // In case of error, it returns {success: false, error: ...}
                if (itemInsertResult && itemInsertResult.success === false) {
                    console.error('Failed to insert invoice item:', itemInsertResult);
                    throw new Error(`فشل حفظ منتج في الفاتورة: ${itemInsertResult.error || 'خطأ غير معروف'}`);
                }
                if (!itemInsertResult || (itemInsertResult.changes === undefined && itemInsertResult.lastInsertRowid === undefined)) {
                    console.error('Invalid item insert result:', itemInsertResult);
                    throw new Error(`فشل حفظ منتج في الفاتورة: نتيجة غير صحيحة`);
                }
                
            }
        }
        
        // Wait a moment to ensure database commits
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Update customer balance directly after saving invoice
        // If customer was changed, update balance for old customer first (subtract old invoice remaining)
        if (currentInvoice && currentInvoice.customerId && currentInvoice.customerId !== customerId) {
            const oldCustomerId = currentInvoice.customerId;
            console.log(`[Sales] Customer changed from ${oldCustomerId} to ${customerId}. Updating old customer balance...`);
            try {
                const oldCustomer = await window.electronAPI.dbGet('customers', oldCustomerId);
                if (oldCustomer) {
                    const oldInvoiceRemaining = parseFloat(currentInvoice.remaining || 0);
                    const newOldCustomerBalance = Math.max(0, (parseFloat(oldCustomer.balance || 0) - oldInvoiceRemaining));
                    await window.electronAPI.dbUpdate('customers', oldCustomerId, {
                        ...oldCustomer,
                        balance: newOldCustomerBalance,
                        updatedAt: new Date().toISOString()
                    });
                }
            } catch (error) {
                console.error('[Sales] Error updating old customer balance:', error);
                // Continue even if update fails
            }
        }
        
        // Update customer balance directly: currentBalance + newRemaining - oldRemaining (if editing)
        try {
            const customer = await window.electronAPI.dbGet('customers', customerId);
            if (customer) {
                const currentBalance = parseFloat(customer.balance || 0);
                const newRemaining = parseFloat(remaining || 0);
                let newBalance = currentBalance;
                
                if (currentInvoice && currentInvoice.id && currentInvoice.customerId === customerId) {
                    // Editing existing invoice: subtract old remaining, add new remaining
                    const oldRemaining = parseFloat(currentInvoice.remaining || 0);
                    newBalance = currentBalance - oldRemaining + newRemaining;
                } else {
                    // New invoice: add remaining
                    newBalance = currentBalance + newRemaining;
                }
                
                await window.electronAPI.dbUpdate('customers', customerId, {
                    ...customer,
                    balance: newBalance,
                    lastTransactionDate: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
                
                console.log('[Sales] Customer balance updated directly:', {
                    customerId,
                    oldBalance: currentBalance,
                    newBalance,
                    invoiceRemaining: newRemaining
                });
            }
        } catch (error) {
            console.error('[Sales] Error updating customer balance:', error);
            // Continue even if update fails - balance will be updated on next load
        }
        
        // Update local array
        if (currentInvoice) {
            // Update existing invoice
            const index = invoices.findIndex(inv => inv.id === currentInvoice.id);
            if (index !== -1) {
                invoiceData.products = [...invoiceProducts];
                invoices[index] = invoiceData;
            }
        } else {
            // New invoice
            invoiceData.products = [...invoiceProducts];
            invoices.push(invoiceData);
        }

        // Save to localStorage as backup
        await saveInvoices();
        
        // Reload data from database to ensure fresh data (optimized for performance)
        // Only reload if using database pagination, otherwise update local array
        if (useDatabasePagination && window.electronAPI && window.electronAPI.dbGetAll) {
            try {
                // Only reload current page, not all invoices
                const result = await loadInvoicesPage(currentPage, itemsPerPage, {});
                if (result && result.invoices) {
                    invoices = result.invoices;
                    totalInvoicesCount = result.total || totalInvoicesCount;
                    console.log('[Sales] Reloaded page', currentPage, 'with', invoices.length, 'invoices');
                }
            } catch (error) {
                console.error('[Sales] Error reloading invoices after save:', error);
                // Fallback: just update local array without reloading
                if (currentInvoice) {
                    const index = invoices.findIndex(inv => inv.id === currentInvoice.id);
                    if (index !== -1) {
                        invoices[index] = invoiceData;
                    }
                } else {
                    invoices.push(invoiceData);
                }
            }
        } else {
            // For small datasets, just update local array (no need to reload all)
            // The invoice was already added/updated above
            console.log('[Sales] Updated local array, skipping full reload for performance');
        }
        
        // Reset to first page and clear filters to show new invoice
        currentPage = 1;
        searchQuery = '';
        dateFrom = '';
        dateTo = '';
        statusFilter = '';
        
        // Clear filter inputs
        const searchInput = document.getElementById('searchInput');
        const dateFromInput = document.getElementById('dateFrom');
        const dateToInput = document.getElementById('dateTo');
        const statusFilterInput = document.getElementById('statusFilter');
        
        if (searchInput) searchInput.value = '';
        if (dateFromInput) dateFromInput.value = '';
        if (dateToInput) dateToInput.value = '';
        if (statusFilterInput) statusFilterInput.value = '';
        
        applyFilters(); // Use applyFilters instead of renderInvoices
        
        // Update first transaction date for new invoices
        if (!currentInvoice) {
            await updateCustomerFirstTransactionDate(customerId);
        }
        
        // Update product stock for any invoice (pending or delivered)
        // IMPORTANT: For edits, we need to revert old stock first, then apply new stock
        console.log('[Sales] Invoice status:', status, 'invoiceId:', invoiceId);
        console.log('[Sales] Updating product stock for invoice:', invoiceId);
        console.log('[Sales] Invoice products count:', invoiceProducts.length);
        console.log('[Sales] Is edit mode:', !!currentInvoice);
        
        // Always revert old stock first if editing (before deleting old items from database)
        const isEdit = !!currentInvoice;
        if (isEdit && window.electronAPI && window.electronAPI.dbGetAll) {
            try {
                console.log('[Sales] Reverting old stock changes BEFORE applying new changes');
                
                // Get old invoice to check if it was linked to a delivery note
                let oldInvoice = null;
                if (window.electronAPI && window.electronAPI.dbGet) {
                    oldInvoice = await window.electronAPI.dbGet('sales_invoices', invoiceId);
                }
                
                // Get old invoice items BEFORE they are deleted
                const oldItems = await window.electronAPI.dbGetAll('sales_invoice_items', 'invoiceId = ?', [invoiceId]);
                console.log('[Sales] Found old items to revert:', oldItems.length);
                
                // Revert stock changes for ALL old items
                for (const oldItem of oldItems) {
                    const oldProduct = await window.electronAPI.dbGet('products', oldItem.productId);
                    if (oldProduct) {
                        // Restore old stock (add back what was subtracted)
                        let quantityToAdd = oldItem.quantity || 0;
                        if (oldItem.unit === 'largest') {
                            const conversionFactor = oldProduct.conversionFactor || 1;
                            quantityToAdd = oldItem.quantity * conversionFactor;
                        }
                        
                        const currentStock = parseFloat(oldProduct.stock) || 0;
                        oldProduct.stock = currentStock + quantityToAdd;
                        oldProduct.updatedAt = new Date().toISOString();
                        await window.electronAPI.dbUpdate('products', oldProduct.id, oldProduct);
                    }
                }
            } catch (error) {
                console.error('[Sales] Error reverting old stock:', error);
            }
        }
        
        // Now apply new stock changes
        await updateProductStockFromInvoice(invoiceProducts, invoiceId);
        
        // Wait a small delay to ensure database updates are committed
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Dispatch event to notify products screen - send for ALL products to ensure full refresh
        const uniqueProductIds = [...new Set(invoiceProducts.map(p => p.productId))];
        uniqueProductIds.forEach(productId => {
            window.dispatchEvent(new CustomEvent('productStockUpdated', { 
                detail: { productId: productId },
                bubbles: true,
                cancelable: true
            }));
        });
        
        // Also dispatch a global refresh event
        window.dispatchEvent(new CustomEvent('productsNeedRefresh', { bubbles: true }));
        
        // Update currentInvoice with saved invoice data (including products)
        currentInvoice = {
            ...invoiceData,
            products: [...invoiceProducts] // Ensure products are included
        };
        
        // Create invoice object for printing (use invoiceData which has all the saved data)
        const invoiceForPrint = {
            ...invoiceData,
            products: [...invoiceProducts] // Ensure products are included
        };
        
        console.log('[Sales] Invoice for print:', {
            id: invoiceForPrint.id,
            invoiceNumber: invoiceForPrint.invoiceNumber,
            productsCount: invoiceForPrint.products ? invoiceForPrint.products.length : 0,
        });
        
        // Auto print invoice
        closeModal();
        setTimeout(async () => {
            // Use invoiceForPrint instead of currentInvoice to ensure it's not null
            if (invoiceForPrint && invoiceForPrint.products && invoiceForPrint.products.length > 0) {
                console.log('[Sales] Opening print window with invoice:', invoiceForPrint.id);
                await openPrintWindow(invoiceForPrint);
            } else {
                console.error('[Sales] Invoice for print is invalid:', {
                    invoice: invoiceForPrint,
                    hasProducts: !!invoiceForPrint?.products,
                    productsLength: invoiceForPrint?.products?.length || 0
                });
                showMessage('خطأ في طباعة الفاتورة: بيانات الفاتورة غير صحيحة', 'error');
            }
        }, 500);
        showMessage('تم حفظ الفاتورة وطباعتها بنجاح', 'success');
    } catch (error) {
        console.error('Error saving invoice:', error);
        console.error('Error stack:', error.stack);
        console.error('Invoice data:', invoiceData);
        console.error('Invoice products:', invoiceProducts);
        
        // Check for specific error types
        let errorMessage = 'خطأ في حفظ الفاتورة: ' + error.message;
        if (error.message && (error.message.includes('UNIQUE') || error.message.includes('duplicate'))) {
            errorMessage = '⚠️ رقم الفاتورة موجود بالفعل. يرجى المحاولة مرة أخرى.';
        } else if (error.message && error.message.includes('FOREIGN KEY')) {
            errorMessage = '⚠️ خطأ في البيانات المرسلة. يرجى التحقق من العميل والمنتجات.';
        }
        
        showMessage(errorMessage, 'error');
    } finally {
        // إعادة تفعيل الزر في جميع الحالات
        isSavingInvoice = false;
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
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

// Recalculate Customer Balance from all invoices
async function recalculateCustomerBalance(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    
    // Get all invoices for this customer from database (all invoices are included in balance regardless of status)
    let customerInvoices = [];
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            customerInvoices = await window.electronAPI.dbGetAll(
                'sales_invoices', 
                'customerId = ?', 
                [customerId]
            );
        } catch (error) {
            console.error('Error loading invoices from database:', error);
            // Fallback to local array
            customerInvoices = invoices.filter(inv => 
                inv.customerId === customerId
            );
        }
    } else {
        // Fallback to local array
        customerInvoices = invoices.filter(inv => 
            inv.customerId === customerId
        );
    }
    
    // Calculate: sum of all remaining amounts from all invoices (all invoices are included in balance)
    let totalRemaining = 0;
    customerInvoices.forEach(invoice => {
        totalRemaining += (invoice.remaining || 0);
    });
    
    // Get all receipts for this customer from database
    let customerReceipts = [];
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            customerReceipts = await window.electronAPI.dbGetAll('receipts', 'customerId = ?', [customerId]);
        } catch (error) {
            console.error('Error loading receipts from database:', error);
            customerReceipts = [];
        }
    }
    
    // Calculate: sum of all receipt amounts (receipts reduce customer debt)
    let totalReceipts = 0;
    customerReceipts.forEach(receipt => {
        totalReceipts += (receipt.amount || 0);
    });
    
    // Get all returns from customers (returns reduce customer debt)
    let customerReturns = [];
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            customerReturns = await window.electronAPI.dbGetAll(
                'returns', 
                'returnType = ? AND entityId = ?', 
                ['from_customer', customerId]
            );
        } catch (error) {
            console.error('Error loading returns from database:', error);
            customerReturns = [];
        }
    }
    
    // Calculate: sum of all return amounts (returns reduce customer debt)
    let totalReturns = 0;
    customerReturns.forEach(ret => {
        totalReturns += (ret.totalAmount || 0);
    });
    
    // Get current balance (should not recalculate - balance is updated directly by transactions)
    // This function is kept for backward compatibility but should not be used for normal operations
    // Balance is now updated directly: balance = currentBalance + invoiceRemaining (for new invoice)
    // or balance = currentBalance + (newRemaining - oldRemaining) (for edit)
    // For receipts: balance = currentBalance - receiptAmount
    const balance = parseFloat(customer.balance || 0);
    
    customer.balance = balance;
    customer.lastTransactionDate = new Date().toISOString();
    
    // Update first transaction date
    await updateCustomerFirstTransactionDate(customerId);
    
    // Save customer to localStorage
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
    
    // Update customer in database
    if (window.electronAPI && window.electronAPI.dbUpdate) {
        try {
            customer.balance = balance;
            customer.lastTransactionDate = new Date().toISOString();
            customer.updatedAt = new Date().toISOString();
            await window.electronAPI.dbUpdate('customers', customerId, customer);
        } catch (error) {
            console.error('Error updating customer balance in database:', error);
        }
    }
    
    // Update customer display if modal is open
    if (document.getElementById('customerSelect')) {
        const currentCustomerId = document.getElementById('customerSelect').value;
        if (currentCustomerId === customerId) {
            const oldBalanceEl = document.getElementById('oldBalance');
            if (oldBalanceEl) {
                oldBalanceEl.textContent = `${balance.toFixed(2)} ج.م`;
            }
            calculateTotals();
        }
    }
}

// Update Product Stock from Invoice
async function updateProductStockFromInvoice(invoiceProducts, invoiceId) {
    try {
        // Note: Reverting old stock is now done BEFORE this function is called
        // (in handleFormSubmit before deleting old items from database)
        
        // Apply new stock changes
        for (const invoiceProduct of invoiceProducts) {
            // Get product from database
            let product = null;
            if (window.electronAPI && window.electronAPI.dbGet) {
                product = await window.electronAPI.dbGet('products', invoiceProduct.productId);
            }
            
            if (!product) {
                console.error('[Sales] Product not found:', invoiceProduct.productId);
                continue;
            }
            
            // Calculate quantity to subtract in smallest unit
            let quantityToSubtract = invoiceProduct.quantityInSmallestUnit || invoiceProduct.quantity;
            
            // If unit is largest, convert to smallest
            if (invoiceProduct.unit === 'largest') {
                const conversionFactor = product.conversionFactor || 1;
                quantityToSubtract = invoiceProduct.quantity * conversionFactor;
            }
            
            // Update stock
            const currentStock = parseFloat(product.stock) || 0;
            const newStock = Math.max(0, currentStock - quantityToSubtract);
            
            product.stock = newStock;
            product.lastSaleDate = new Date().toISOString();
            product.updatedAt = new Date().toISOString();
            
            // Update product in database
            if (window.electronAPI && window.electronAPI.dbUpdate) {
                await window.electronAPI.dbUpdate('products', product.id, product);
            } else {
                console.error('[Sales] electronAPI or dbUpdate not available!');
            }
            
            // Update in local array too
            const localProduct = products.find(p => p.id === product.id);
            if (localProduct) {
                localProduct.stock = newStock;
                localProduct.lastSaleDate = product.lastSaleDate;
            }
        }
    } catch (error) {
        console.error('[Sales] Error updating product stock:', error);
        console.error('[Sales] Error details:', error.message, error.stack);
    }
}

// Update Customer Balance (deprecated - use recalculateCustomerBalance instead)
function updateCustomerBalance(customerId, amount) {
    // This function is kept for backward compatibility but recalculateCustomerBalance should be used
    recalculateCustomerBalance(customerId);
}

// Apply Filters and Search
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
    
    // If using database pagination, load from database with filters
    if (useDatabasePagination) {
        const filters = {
            dateFrom: effectiveDateFrom || null,
            dateTo: effectiveDateTo || null,
            status: statusFilter || null,
            searchQuery: searchQuery || null,
            sortBy: sortBy || 'date-desc'
        };
        
        const result = await loadInvoicesPage(currentPage, itemsPerPage, filters);
        filteredInvoices = result.invoices || [];
        totalInvoicesCount = result.total || 0;
        
        // Ensure status is set
        filteredInvoices.forEach(invoice => {
            if (!invoice.status) {
                invoice.status = 'pending';
            }
            if (!invoice.products) {
                invoice.products = [];
            }
        });
        
        // Render paginated invoices
        await renderInvoices();
        return;
    }
    
    // For small datasets, use in-memory filtering (original behavior)
    // Start with all invoices
    filteredInvoices = [...invoices];
    
    // Apply search filter
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredInvoices = filteredInvoices.filter(invoice => {
            // Search by invoice number
            const invoiceNumber = (invoice.invoiceNumber || '').toLowerCase();
            if (invoiceNumber.includes(query)) return true;
            
            // Search by customer name
            const customer = customers.find(c => c.id === invoice.customerId);
            if (customer) {
                const customerName = (customer.name || '').toLowerCase();
                if (customerName.includes(query)) return true;
            }
            
            return false;
        });
    }
    
    // Apply date range filter (use effectiveDateFrom and effectiveDateTo from above)
    if (effectiveDateFrom) {
        filteredInvoices = filteredInvoices.filter(invoice => {
            return new Date(invoice.date) >= new Date(effectiveDateFrom);
        });
    }
    
    if (effectiveDateTo) {
        filteredInvoices = filteredInvoices.filter(invoice => {
            const invoiceDate = new Date(invoice.date);
            const toDate = new Date(effectiveDateTo);
            toDate.setHours(23, 59, 59, 999); // Include entire day
            return invoiceDate <= toDate;
        });
    }
    
    // Apply status filter
    if (statusFilter) {
        filteredInvoices = filteredInvoices.filter(invoice => {
            return true; // All invoices pass filter (status removed)
        });
    }
    
    // Apply sorting
    filteredInvoices.sort((a, b) => {
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
            case 'total-desc':
                return (b.total || 0) - (a.total || 0);
            case 'total-asc':
                return (a.total || 0) - (b.total || 0);
            case 'number-desc':
                return (b.invoiceNumber || '').localeCompare(a.invoiceNumber || '');
            case 'number-asc':
                return (a.invoiceNumber || '').localeCompare(b.invoiceNumber || '');
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
    
    // Render paginated invoices
    await renderInvoices();
}

// Render Invoices
async function renderInvoices() {
    const tbody = document.getElementById('invoicesTableBody');
    const emptyState = document.getElementById('emptyState');
    const paginationContainer = document.getElementById('paginationContainer');
    
    tbody.innerHTML = '';

    if (filteredInvoices.length === 0) {
        emptyState.classList.remove('hidden');
        paginationContainer.classList.add('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    paginationContainer.classList.remove('hidden');

    // Calculate pagination
    let totalPages, startIndex, endIndex, paginatedInvoices;
    
    if (useDatabasePagination) {
        // Use total count from database
        totalPages = Math.ceil(totalInvoicesCount / itemsPerPage);
        startIndex = (currentPage - 1) * itemsPerPage;
        endIndex = Math.min(startIndex + filteredInvoices.length, totalInvoicesCount);
        paginatedInvoices = filteredInvoices; // Already paginated from database
    } else {
        // Use in-memory pagination
        totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
        startIndex = (currentPage - 1) * itemsPerPage;
        endIndex = Math.min(startIndex + itemsPerPage, filteredInvoices.length);
        paginatedInvoices = filteredInvoices.slice(startIndex, endIndex);
    }
    
    // Delete button is now available for all users, but only for pending invoices
    // No need to check user type - all users can delete pending invoices
    
    // Update pagination info
    const totalCount = useDatabasePagination ? totalInvoicesCount : filteredInvoices.length;
    document.getElementById('paginationInfo').textContent = 
        `عرض ${startIndex + 1} - ${endIndex} من ${totalCount}`;
    
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

    for (const invoice of paginatedInvoices) {
        const customer = customers.find(c => c.id === invoice.customerId);
        const row = document.createElement('tr');
        
        // Create cells
        const invoiceNumberCell = document.createElement('td');
        invoiceNumberCell.textContent = invoice.invoiceNumber;
        row.appendChild(invoiceNumberCell);
        
        const dateCell = document.createElement('td');
        dateCell.textContent = new Date(invoice.date).toLocaleDateString('ar-EG');
        row.appendChild(dateCell);
        
        // Customer name cell with strong tag
        const customerNameCell = document.createElement('td');
        customerNameCell.className = 'customer-name-cell';
        customerNameCell.innerHTML = `<strong>${customer ? customer.name : 'غير محدد'}</strong>`;
        row.appendChild(customerNameCell);
        
        // Total cell with strong tag
        const totalCell = document.createElement('td');
        totalCell.className = 'invoice-total-cell';
        totalCell.innerHTML = `<strong>${invoice.total.toFixed(2)} ج.م</strong>`;
        row.appendChild(totalCell);
        
        // CreatedBy cell
        const createdByCell = document.createElement('td');
        createdByCell.className = 'created-by-cell';
        createdByCell.textContent = invoice.createdBy || '-';
        row.appendChild(createdByCell);
        
        // Notes cell
        const notesCell = document.createElement('td');
        notesCell.className = 'invoice-notes-cell';
        const notesText = invoice.notes ? (invoice.notes.length > 50 ? invoice.notes.substring(0, 50) + '...' : invoice.notes) : '-';
        notesCell.textContent = notesText;
        notesCell.title = invoice.notes || '';
        row.appendChild(notesCell);
        
        // Actions cell
        const actionsCell = document.createElement('td');
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'actions-buttons';
        
        // View button
        const viewBtn = document.createElement('button');
        viewBtn.className = 'action-btn view';
        viewBtn.textContent = '👁️';
        viewBtn.title = 'عرض';
        viewBtn.addEventListener('click', async () => {
            await viewInvoice(invoice.id);
        });
        actionsDiv.appendChild(viewBtn);
        
        // Print button
        const printBtn = document.createElement('button');
        printBtn.className = 'action-btn print';
        printBtn.textContent = '🖨️';
        printBtn.title = 'طباعة';
        printBtn.addEventListener('click', async () => {
            await printInvoiceById(invoice.id);
        });
        actionsDiv.appendChild(printBtn);
        
        // Save button
        const saveBtn = document.createElement('button');
        saveBtn.className = 'action-btn save';
        saveBtn.textContent = '💾';
        saveBtn.title = 'حفظ على القرص';
        saveBtn.addEventListener('click', async () => {
            await saveInvoiceToDisk(invoice.id);
        });
        actionsDiv.appendChild(saveBtn);
        
        // Save Customer Copy button
        const saveCustomerCopyBtn = document.createElement('button');
        saveCustomerCopyBtn.className = 'action-btn save-customer-copy';
        saveCustomerCopyBtn.textContent = '📄';
        saveCustomerCopyBtn.title = 'حفظ نسخة العميل (A5)';
        saveCustomerCopyBtn.addEventListener('click', async () => {
            await saveCustomerCopyToDiskById(invoice.id);
        });
        actionsDiv.appendChild(saveCustomerCopyBtn);
        
        // Delete button removed - invoices can only be cancelled, not deleted
        
        actionsCell.appendChild(actionsDiv);
        row.appendChild(actionsCell);
        
        tbody.appendChild(row);
    }
}

// View Invoice (view only, no print)
async function viewInvoice(invoiceId) {
    console.log('viewInvoice called with ID:', invoiceId);
    
    // Try to find invoice in local array first
    let invoice = invoices.find(inv => inv && inv.id === invoiceId);
    
    // If not found, load from database
    if (!invoice && window.electronAPI && window.electronAPI.dbGet) {
        try {
            console.log('Loading invoice from database...');
            invoice = await window.electronAPI.dbGet('sales_invoices', invoiceId);
            
            if (!invoice) {
                showMessage('الفاتورة غير موجودة', 'error');
                return;
            }
            
            // Load invoice items from database
            const invoiceItems = await window.electronAPI.dbGetAll('sales_invoice_items', 'invoiceId = ?', [invoiceId]);
            invoice.products = [];
            
            // Load each product with full details
            for (const item of invoiceItems || []) {
                let productData = null;
                if (window.electronAPI && window.electronAPI.dbGet) {
                    try {
                        productData = await window.electronAPI.dbGet('products', item.productId);
                    } catch (error) {
                        console.error('Error loading product:', error);
                    }
                }
                
                // Calculate quantityInSmallestUnit
                let quantityInSmallestUnit = item.quantity || 0;
                if (item.unit === 'largest' && productData) {
                    const conversionFactor = productData.conversionFactor || 1;
                    quantityInSmallestUnit = item.quantity * conversionFactor;
                }
                
                invoice.products.push({
                    productId: item.productId,
                    productName: item.productName,
                    productCode: productData?.code || '',
                    category: productData?.category || '',
                    quantity: item.quantity || 0,
                    unit: item.unit || '',
                    unitName: item.unit || '',
                    smallestUnit: productData?.smallestUnit || '',
                    quantityInSmallestUnit: quantityInSmallestUnit,
                    price: item.price || 0,
                    total: item.total || 0
                });
            }
            
            // Load customer from database if needed
            if (!customers.find(c => c && c.id === invoice.customerId)) {
                const customer = await window.electronAPI.dbGet('customers', invoice.customerId);
                if (customer) {
                    customers.push(customer);
                }
            }
        } catch (error) {
            console.error('Error loading invoice from database:', error);
            showMessage('خطأ في تحميل الفاتورة: ' + error.message, 'error');
            return;
        }
    }
    
    if (!invoice) {
        showMessage('الفاتورة غير موجودة', 'error');
        return;
    }
    
    // Ensure invoice has products array
    if (!invoice.products || !Array.isArray(invoice.products) || invoice.products.length === 0) {
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            try {
                const invoiceItems = await window.electronAPI.dbGetAll('sales_invoice_items', 'invoiceId = ?', [invoiceId]);
                invoice.products = [];
                
                // Load each product with full details
                for (const item of invoiceItems || []) {
                    let productData = null;
                    if (window.electronAPI && window.electronAPI.dbGet) {
                        try {
                            productData = await window.electronAPI.dbGet('products', item.productId);
                        } catch (error) {
                            console.error('Error loading product:', error);
                        }
                    }
                    
                    // Calculate quantityInSmallestUnit
                    let quantityInSmallestUnit = item.quantity || 0;
                    if (item.unit === 'largest' && productData) {
                        const conversionFactor = productData.conversionFactor || 1;
                        quantityInSmallestUnit = item.quantity * conversionFactor;
                    }
                    
                    invoice.products.push({
                        productId: item.productId,
                        productName: item.productName,
                        productCode: productData?.code || '',
                        category: productData?.category || '',
                        quantity: item.quantity || 0,
                        unit: item.unit || '',
                        unitName: item.unit || '',
                        smallestUnit: productData?.smallestUnit || '',
                        quantityInSmallestUnit: quantityInSmallestUnit,
                        price: item.price || 0,
                        total: item.total || 0
                    });
                }
            } catch (error) {
                console.error('Error loading invoice items:', error);
                invoice.products = [];
            }
        } else {
            invoice.products = [];
        }
    }

    // Open in view window (no print)
    await openViewWindow(invoice);
}

// Edit Invoice
async function editInvoice(invoiceId) {
    let invoice = invoices.find(inv => inv.id === invoiceId);
    
    // If not found in memory, try to load from database (for pagination mode)
    if (!invoice && useDatabasePagination && window.electronAPI && window.electronAPI.dbGet) {
        try {
            invoice = await window.electronAPI.dbGet('sales_invoices', invoiceId);
        } catch (error) {
            console.error('Error loading invoice from database:', error);
        }
    }
    
    if (!invoice) {
        showMessage('الفاتورة غير موجودة', 'error');
        return;
    }
    
    currentInvoice = invoice;
    
    // Lazy load invoice items if not already loaded
    if (!invoice.products || invoice.products.length === 0) {
        invoice.products = await loadInvoiceItems(invoiceId);
    }
    
    invoiceProducts = [...invoice.products];
    
    // Load category for each product if not present
    if (window.electronAPI && window.electronAPI.dbGet) {
        for (let product of invoiceProducts) {
            if (product.productId && !product.category) {
                try {
                    const productData = await window.electronAPI.dbGet('products', product.productId);
                    if (productData && productData.category) {
                        product.category = productData.category;
                    }
                } catch (error) {
                    console.error('Error loading product category:', error);
                }
            }
        }
    }
    
    document.getElementById('isEdit').value = 'true';
    document.getElementById('invoiceId').value = invoice.id;
    document.getElementById('modalTitle').textContent = `تعديل فاتورة ${invoice.invoiceNumber}`;
    document.getElementById('customerSelect').value = invoice.customerId;
    const invoiceDateInput = document.getElementById('invoiceDate');
    invoiceDateInput.value = invoice.date;
    // For editing, allow past dates (remove min restriction)
    invoiceDateInput.removeAttribute('min');
    const dueDateInput = document.getElementById('dueDate');
    // Set min attribute first to prevent selecting dates before invoice date
    if (invoice.date) {
        dueDateInput.setAttribute('min', invoice.date);
    }
    // Then set the value, and validate it
    if (invoice.dueDate) {
        const invoiceDateObj = new Date(invoice.date);
        const dueDateObj = new Date(invoice.dueDate);
        invoiceDateObj.setHours(0, 0, 0, 0);
        dueDateObj.setHours(0, 0, 0, 0);
        // If due date is before invoice date, set it to invoice date
        if (dueDateObj < invoiceDateObj) {
            dueDateInput.value = invoice.date;
        } else {
            dueDateInput.value = invoice.dueDate;
        }
    } else {
        dueDateInput.value = '';
    }
    document.getElementById('paymentMethod').value = invoice.paymentMethod || 'cash';
    document.getElementById('notes').value = invoice.notes || '';
    
    // Update status dropdown style
    const invoiceStatusSelect = document.getElementById('invoiceStatus');
    if (invoiceStatusSelect && typeof updateStatusDropdownStyle === 'function') {
        updateStatusDropdownStyle(invoiceStatusSelect);
    }
    
    // For pending invoices, always update tax rate from settings
    // For delivered invoices, use invoice taxRate if exists
    const status = invoice.status;
    
    if (status === 'pending') {
        // Always get latest tax rate from settings for pending invoices
        await loadTaxRateFromSettings(true); // Force update
    } else {
        // For delivered invoices, use invoice taxRate if exists
        let taxRate = invoice.taxRate;
        if (taxRate === null || taxRate === undefined) {
            const companySettings = await getCompanySettings();
            if (companySettings && companySettings.taxRate !== undefined && companySettings.taxRate !== null) {
                taxRate = companySettings.taxRate;
            } else {
                taxRate = ''; // Leave empty if no default
            }
        }
        document.getElementById('taxRate').value = taxRate;
    }
    
    document.getElementById('shipping').value = invoice.shipping || 0;
    document.getElementById('discount').value = invoice.discount || 0;
    document.getElementById('paid').value = invoice.paid || 0;
    
    // No delivery note selection needed anymore
    
    await onCustomerChange();
    renderInvoiceProducts();
    await calculateTotals();
    
    // Show print button for existing invoices
    document.getElementById('printBtn').style.display = 'inline-block';
    
    document.getElementById('invoiceModal').classList.add('active');
}

// Print Invoice
async function printInvoiceById(invoiceId) {
    console.log('printInvoiceById called with ID:', invoiceId);
    
    // Try to find invoice in local array first
    let invoice = invoices.find(inv => inv && inv.id === invoiceId);
    
    // If not found, load from database
    if (!invoice && window.electronAPI && window.electronAPI.dbGet) {
        try {
            console.log('Loading invoice from database...');
            invoice = await window.electronAPI.dbGet('sales_invoices', invoiceId);
            
            if (!invoice) {
                showMessage('الفاتورة غير موجودة', 'error');
                return;
            }
            
            // Load invoice items from database
            const invoiceItems = await window.electronAPI.dbGetAll('sales_invoice_items', 'invoiceId = ?', [invoiceId]);
            invoice.products = [];
            
            // Load each product with full details
            for (const item of invoiceItems || []) {
                let productData = null;
                if (window.electronAPI && window.electronAPI.dbGet) {
                    try {
                        productData = await window.electronAPI.dbGet('products', item.productId);
                    } catch (error) {
                        console.error('Error loading product:', error);
                    }
                }
                
                // Calculate quantityInSmallestUnit
                let quantityInSmallestUnit = item.quantity || 0;
                if (item.unit === 'largest' && productData) {
                    const conversionFactor = productData.conversionFactor || 1;
                    quantityInSmallestUnit = item.quantity * conversionFactor;
                }
                
                invoice.products.push({
                    productId: item.productId,
                    productName: item.productName,
                    productCode: productData?.code || '',
                    category: productData?.category || '',
                    quantity: item.quantity || 0,
                    unit: item.unit || '',
                    unitName: item.unit || '',
                    smallestUnit: productData?.smallestUnit || '',
                    quantityInSmallestUnit: quantityInSmallestUnit,
                    price: item.price || 0,
                    total: item.total || 0
                });
            }
            
            // Load customer from database if needed
            if (!customers.find(c => c && c.id === invoice.customerId)) {
                const customer = await window.electronAPI.dbGet('customers', invoice.customerId);
                if (customer) {
                    customers.push(customer);
                }
            }
        } catch (error) {
            console.error('Error loading invoice from database:', error);
            showMessage('خطأ في تحميل الفاتورة: ' + error.message, 'error');
            return;
        }
    }
    
    if (!invoice) {
        showMessage('الفاتورة غير موجودة', 'error');
        return;
    }
    
    // Ensure invoice has products array
    if (!invoice.products || !Array.isArray(invoice.products) || invoice.products.length === 0) {
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            try {
                const invoiceItems = await window.electronAPI.dbGetAll('sales_invoice_items', 'invoiceId = ?', [invoiceId]);
                invoice.products = [];
                
                // Load each product with full details
                for (const item of invoiceItems || []) {
                    let productData = null;
                    if (window.electronAPI && window.electronAPI.dbGet) {
                        try {
                            productData = await window.electronAPI.dbGet('products', item.productId);
                        } catch (error) {
                            console.error('Error loading product:', error);
                        }
                    }
                    
                    // Calculate quantityInSmallestUnit
                    let quantityInSmallestUnit = item.quantity || 0;
                    if (item.unit === 'largest' && productData) {
                        const conversionFactor = productData.conversionFactor || 1;
                        quantityInSmallestUnit = item.quantity * conversionFactor;
                    }
                    
                    invoice.products.push({
                        productId: item.productId,
                        productName: item.productName,
                        productCode: productData?.code || '',
                        category: productData?.category || '',
                        quantity: item.quantity || 0,
                        unit: item.unit || '',
                        unitName: item.unit || '',
                        smallestUnit: productData?.smallestUnit || '',
                        quantityInSmallestUnit: quantityInSmallestUnit,
                        price: item.price || 0,
                        total: item.total || 0
                    });
                }
            } catch (error) {
                console.error('Error loading invoice items:', error);
                invoice.products = [];
            }
        } else {
            invoice.products = [];
        }
    }

    await openPrintWindow(invoice);
}

// Save Invoice to Disk
async function saveInvoiceToDisk(invoiceId) {
    console.log('saveInvoiceToDisk called with ID:', invoiceId);
    
    try {
        // Try to find invoice in local array first
        let invoice = invoices.find(inv => inv && inv.id === invoiceId);
        console.log('Invoice found in local array:', !!invoice);
        
        // If not found, load from database
        if (!invoice && window.electronAPI && window.electronAPI.dbGet) {
            try {
                console.log('Loading invoice from database...');
                invoice = await window.electronAPI.dbGet('sales_invoices', invoiceId);
                console.log('Invoice loaded from database:', !!invoice);
            
            if (!invoice) {
                showMessage('الفاتورة غير موجودة', 'error');
                return;
            }
            
            // Load invoice items from database
            const invoiceItems = await window.electronAPI.dbGetAll('sales_invoice_items', 'invoiceId = ?', [invoiceId]);
            invoice.products = (invoiceItems || []).map(item => ({
                productId: item.productId,
                productName: item.productName,
                productCode: '',
                quantity: item.quantity || 0,
                unit: item.unit || '',
                unitName: item.unit || '',
                price: item.price || 0,
                total: item.total || 0
            }));
            
            // Load customer from database if needed
            if (!customers.find(c => c && c.id === invoice.customerId)) {
                const customer = await window.electronAPI.dbGet('customers', invoice.customerId);
                if (customer) {
                    customers.push(customer);
                }
            }
            } catch (error) {
                console.error('Error loading invoice from database:', error);
                showMessage('خطأ في تحميل الفاتورة: ' + error.message, 'error');
                return;
            }
        }
        
        if (!invoice) {
            console.error('Invoice not found with ID:', invoiceId);
            showMessage('الفاتورة غير موجودة', 'error');
            return;
        }
        
        // Ensure invoice has products array
        if (!invoice.products || !Array.isArray(invoice.products)) {
            if (window.electronAPI && window.electronAPI.dbGetAll) {
                try {
                    const invoiceItems = await window.electronAPI.dbGetAll('sales_invoice_items', 'invoiceId = ?', [invoiceId]);
                    invoice.products = (invoiceItems || []).map(item => ({
                        productId: item.productId,
                        productName: item.productName,
                        productCode: '',
                        quantity: item.quantity || 0,
                        unit: item.unit || '',
                        unitName: item.unit || '',
                        price: item.price || 0,
                        total: item.total || 0
                    }));
                } catch (error) {
                    console.error('Error loading invoice items:', error);
                    invoice.products = [];
                }
            } else {
                invoice.products = [];
            }
        }
        
        // Get customer
        const customer = customers.find(c => c && c.id === invoice.customerId);
        
        // Generate invoice HTML content
        const invoiceContent = await generatePrintContent(invoice, customer, false);
        
        // Generate default file name
        const defaultFileName = `فاتورة_مبيعات_${invoice.invoiceNumber}_${new Date(invoice.date).toISOString().split('T')[0]}.pdf`;
        
        // Save to file
        if (window.electronAPI && window.electronAPI.saveInvoiceToFile) {
            try {
                const result = await window.electronAPI.saveInvoiceToFile(invoiceContent, defaultFileName);
                
                if (result.success) {
                    // Show success message immediately
                    showMessage(`تم حفظ الفاتورة بنجاح في: ${result.filePath}`, 'success');
                } else if (result.cancelled) {
                    // User cancelled, do nothing
                } else {
                    console.error('Save failed:', result.error);
                    showMessage('خطأ في حفظ الفاتورة: ' + (result.error || 'خطأ غير معروف'), 'error');
                }
            } catch (error) {
                console.error('Error saving invoice to file:', error);
                showMessage('خطأ في حفظ الفاتورة: ' + error.message, 'error');
            }
        } else {
            console.error('saveInvoiceToFile API not available');
            showMessage('وظيفة حفظ الملف غير متاحة', 'error');
        }
    } catch (error) {
        console.error('Error in saveInvoiceToDisk:', error);
        showMessage('خطأ في حفظ الفاتورة: ' + error.message, 'error');
    }
}

// Save Customer Copy to Disk by ID (A5 size, customer copy only)
async function saveCustomerCopyToDiskById(invoiceId) {
    console.log('saveCustomerCopyToDiskById called with ID:', invoiceId);
    
    try {
        if (!invoiceId) {
            showMessage('معرف الفاتورة غير موجود', 'error');
            return;
        }
        
        // Try to find invoice in local array first
        let invoice = invoices.find(inv => inv && inv.id === invoiceId);
        console.log('Invoice found in local array:', !!invoice);
        
        // If not found, load from database
        if (!invoice && window.electronAPI && window.electronAPI.dbGet) {
            try {
                console.log('Loading invoice from database...');
                invoice = await window.electronAPI.dbGet('sales_invoices', invoiceId);
                console.log('Invoice loaded from database:', !!invoice);
            
                if (!invoice) {
                    showMessage('الفاتورة غير موجودة', 'error');
                    return;
                }
                
                // Load invoice items from database
                const invoiceItems = await window.electronAPI.dbGetAll('sales_invoice_items', 'invoiceId = ?', [invoiceId]);
                invoice.products = (invoiceItems || []).map(item => ({
                    productId: item.productId,
                    productName: item.productName,
                    productCode: '',
                    quantity: item.quantity || 0,
                    unit: item.unit || '',
                    unitName: item.unit || '',
                    price: item.price || 0,
                    total: item.total || 0
                }));
                
                // Load customer from database if needed
                if (!customers.find(c => c && c.id === invoice.customerId)) {
                    const customer = await window.electronAPI.dbGet('customers', invoice.customerId);
                    if (customer) {
                        customers.push(customer);
                    }
                }
            } catch (error) {
                console.error('Error loading invoice from database:', error);
                showMessage('خطأ في تحميل الفاتورة: ' + error.message, 'error');
                return;
            }
        }
        
        if (!invoice) {
            console.error('Invoice not found with ID:', invoiceId);
            showMessage('الفاتورة غير موجودة', 'error');
            return;
        }
        
        // Ensure invoice has products array
        if (!invoice.products || !Array.isArray(invoice.products)) {
            if (window.electronAPI && window.electronAPI.dbGetAll) {
                try {
                    const invoiceItems = await window.electronAPI.dbGetAll('sales_invoice_items', 'invoiceId = ?', [invoiceId]);
                    invoice.products = (invoiceItems || []).map(item => ({
                        productId: item.productId,
                        productName: item.productName,
                        productCode: '',
                        quantity: item.quantity || 0,
                        unit: item.unit || '',
                        unitName: item.unit || '',
                        price: item.price || 0,
                        total: item.total || 0
                    }));
                } catch (error) {
                    console.error('Error loading invoice items:', error);
                    invoice.products = [];
                }
            } else {
                invoice.products = [];
            }
        }
        
        // Get customer
        const customer = customers.find(c => c && c.id === invoice.customerId);
        
        // Generate invoice HTML content (customer copy only, A5 size)
        const invoiceContent = await generatePrintContent(invoice, customer, false, true, 'A5');
        
        // Generate default file name
        const defaultFileName = `فاتورة_مبيعات_نسخة_العميل_${invoice.invoiceNumber}_${new Date(invoice.date).toISOString().split('T')[0]}.pdf`;
        
        // Save to file
        if (window.electronAPI && window.electronAPI.saveInvoiceToFile) {
            try {
                const result = await window.electronAPI.saveInvoiceToFile(invoiceContent, defaultFileName);
                
                if (result.success) {
                    // Show success message immediately
                    showMessage(`تم حفظ نسخة العميل بنجاح في: ${result.filePath}`, 'success');
                } else if (result.cancelled) {
                    // User cancelled, do nothing
                } else {
                    console.error('Save failed:', result.error);
                    showMessage('خطأ في حفظ نسخة العميل: ' + (result.error || 'خطأ غير معروف'), 'error');
                }
            } catch (error) {
                console.error('Error saving customer copy to file:', error);
                showMessage('خطأ في حفظ نسخة العميل: ' + error.message, 'error');
            }
        } else {
            console.error('saveInvoiceToFile API not available');
            showMessage('وظيفة حفظ الملف غير متاحة', 'error');
        }
    } catch (error) {
        console.error('Error in saveCustomerCopyToDiskById:', error);
        showMessage('خطأ في حفظ نسخة العميل: ' + error.message, 'error');
    }
}

// Save Customer Copy to Disk (A5 size, customer copy only) - from modal
async function saveCustomerCopyToDisk() {
    console.log('saveCustomerCopyToDisk called');
    
    try {
        // Check if we have a current invoice
        if (!currentInvoice || !currentInvoice.id) {
            showMessage('لا توجد فاتورة مفتوحة', 'error');
            return;
        }
        
        const invoiceId = currentInvoice.id;
        
        // Use the by-id function
        await saveCustomerCopyToDiskById(invoiceId);
    } catch (error) {
        console.error('Error in saveCustomerCopyToDisk:', error);
        showMessage('خطأ في حفظ نسخة العميل: ' + error.message, 'error');
    }
}

// Print Current Invoice
async function printInvoice() {
    // Check if we have products in the form
    if (!invoiceProducts || invoiceProducts.length === 0) {
        showMessage('لا توجد منتجات في الفاتورة', 'error');
        return;
    }
    
    // For new invoices (not saved yet) or if currentInvoice is null, use invoiceProducts from form
    // For existing invoices, use currentInvoice.products
    if (!currentInvoice || !currentInvoice.id || !currentInvoice.products || currentInvoice.products.length === 0) {
        // Create a temporary invoice object with current form data
        const customerId = document.getElementById('customerSelect').value;
        const customer = customers.find(c => c && c.id === customerId);
        const invoiceDate = document.getElementById('invoiceDate').value;
        const invoiceStatus = document.getElementById('invoiceStatus').value;
        const paymentMethod = document.getElementById('paymentMethod').value;
        const shipping = parseFloat(document.getElementById('shipping').value) || 0;
        const discount = parseFloat(document.getElementById('discount').value) || 0;
        const paid = parseFloat(document.getElementById('paid').value) || 0;
        const taxRate = parseFloat(document.getElementById('taxRate').value) || 0;
        const deliveryNoteId = document.getElementById('deliveryNoteSelect')?.value || null;
        
        const subtotal = invoiceProducts.reduce((sum, p) => sum + p.total, 0);
        const taxAmount = (subtotal * taxRate) / 100;
        const total = subtotal + taxAmount + shipping - discount;
        const remaining = total - paid;
        
        // Generate temporary invoice number if not exists
        const invoiceNumber = currentInvoice?.invoiceNumber || `TEMP-${Date.now()}`;
        
        const tempInvoice = {
            id: currentInvoice?.id || null,
            invoiceNumber: invoiceNumber,
            customerId: customerId,
            date: invoiceDate || new Date().toISOString(),
            dueDate: document.getElementById('dueDate')?.value || null,
            status: invoiceStatus || 'pending',
            paymentMethod: paymentMethod || 'cash',
            deliveryNoteId: deliveryNoteId,
            shipping: shipping,
            discount: discount,
            paid: paid,
            taxRate: taxRate,
            subtotal: subtotal,
            taxAmount: taxAmount,
            total: total,
            remaining: remaining,
            products: [...invoiceProducts] // Use current form products
        };
        
        await openPrintWindow(tempInvoice);
    } else {
        await openPrintWindow(currentInvoice);
    }
}

// Open View Window (view only, no print)
async function openViewWindow(invoice) {
    try {
        if (!invoice) {
            console.error('Invoice is null or undefined');
            showMessage('الفاتورة غير موجودة', 'error');
            return;
        }
        
        // Ensure invoice has products array
        if (!invoice.products || !Array.isArray(invoice.products)) {
            console.warn('Invoice products not found, setting empty array');
            invoice.products = [];
        }
        
        const customer = customers.find(c => c && c.id === invoice.customerId);
        if (!customer) {
            console.warn('Customer not found for invoice:', invoice.customerId);
        }
        
        const viewContent = await generatePrintContent(invoice, customer, false);
        
        if (!viewContent) {
            console.error('View content is empty');
            showMessage('خطأ في إنشاء محتوى العرض', 'error');
            return;
        }
        
        // Try to open view window
        try {
            const viewWindow = window.open('', '_blank', 'width=800,height=600');
            if (!viewWindow || viewWindow.closed || typeof viewWindow.closed === 'undefined') {
                console.error('Failed to open view window - may be blocked');
                // Fallback: try to create a blob URL
                const blob = new Blob([viewContent], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
                return;
            }
            
            viewWindow.document.write(viewContent);
            viewWindow.document.close();
        } catch (openError) {
            console.error('Error opening view window:', openError);
            showMessage('خطأ في فتح نافذة العرض: ' + openError.message, 'error');
        }
    } catch (error) {
        console.error('Error in openViewWindow:', error);
        showMessage('خطأ في عرض الفاتورة: ' + error.message, 'error');
    }
}

// Open Print Window
async function openPrintWindow(invoice) {
    try {
        if (!invoice) {
            console.error('Invoice is null or undefined');
            showMessage('الفاتورة غير موجودة', 'error');
            return;
        }
        
        // Ensure invoice has products array
        if (!invoice.products || !Array.isArray(invoice.products)) {
            console.warn('Invoice products not found, setting empty array');
            invoice.products = [];
        }
        
        const customer = customers.find(c => c && c.id === invoice.customerId);
        if (!customer) {
            console.warn('Customer not found for invoice:', invoice.customerId);
        } else {
            console.log('[Print] Customer found:', customer.name, 'Code:', customer.code);
            const customerCode = (customer.code || '').trim().toUpperCase();
            console.log('[Print] Customer code (normalized):', customerCode, 'Is CASH:', customerCode === 'CASH');
        }
        
        const printContent = await generatePrintContent(invoice, customer, true);
        
        if (!printContent) {
            console.error('Print content is empty');
            showMessage('خطأ في إنشاء محتوى الطباعة', 'error');
            return;
        }
        
        // Try to use Electron API first (no tab will appear)
        if (window.electronAPI && window.electronAPI.openPrintWindow) {
            try {
                const result = await window.electronAPI.openPrintWindow(printContent, `فاتورة ${invoice.invoiceNumber || ''}`);
                if (result && result.success) {
                    // Print dialog opened successfully, no tab created
                    return;
                } else {
                    console.warn('Electron print failed, falling back to window.open:', result?.error);
                    // Fall through to fallback method
                }
            } catch (electronError) {
                console.warn('Electron print error, falling back to window.open:', electronError);
                // Fall through to fallback method
            }
        }
        
        // Fallback: Use window.open (for browser compatibility or if Electron API fails)
        try {
            // Open window off-screen or very small to minimize visibility
            const printWindow = window.open('', '_blank', 'width=1,height=1,left=-1000,top=-1000');
            if (!printWindow || printWindow.closed || typeof printWindow.closed === 'undefined') {
                console.error('Failed to open print window - may be blocked');
                // Fallback: try to create a blob URL
                const blob = new Blob([printContent], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const newWindow = window.open(url, '_blank', 'width=1,height=1,left=-1000,top=-1000');
                if (newWindow) {
                    setTimeout(() => {
                        newWindow.print();
                        URL.revokeObjectURL(url);
                    }, 500);
                } else {
                    showMessage('فشل فتح نافذة الطباعة. يرجى التحقق من إعدادات منع النوافذ المنبثقة', 'error');
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
                    showMessage('تم فتح نافذة الطباعة. يرجى استخدام زر الطباعة في المتصفح', 'info');
                }
            }, 500);
        } catch (openError) {
            console.error('Error opening print window:', openError);
            showMessage('خطأ في فتح نافذة الطباعة: ' + openError.message, 'error');
        }
    } catch (error) {
        console.error('Error in openPrintWindow:', error);
        showMessage('خطأ في طباعة الفاتورة: ' + error.message, 'error');
    }
}

// Generate Print Content
async function generatePrintContent(invoice, customer, isForPrint = true, customerCopyOnly = false, pageSize = 'A4') {
    try {
        // Get logo path or base64 - use icon-asel.ico directly
        let logoPath = 'assets/icon-asel.ico'; // Default fallback
        let logoBase64 = '';
        
        // For PDF saving, convert logo to base64
        if (!isForPrint) {
            try {
                // Use electronAPI.getAssetPath to get correct file path
                if (window.electronAPI && window.electronAPI.getAssetPath) {
                    // Use icon-asel.ico directly
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
                } else {
                    // Fallback: try direct fetch (for development)
                    try {
                        const logoIcoResponse = await fetch('assets/icon-asel.ico');
                        if (logoIcoResponse.ok) {
                            const logoBlob = await logoIcoResponse.blob();
                            const reader = new FileReader();
                            logoBase64 = await new Promise((resolve) => {
                                reader.onloadend = () => resolve(reader.result);
                                reader.readAsDataURL(logoBlob);
                            });
                        }
                    } catch (error) {
                        console.warn('Error converting logo to base64:', error);
                    }
                }
            } catch (error) {
                console.warn('Error converting logo to base64:', error);
            }
        } else {
            // For print/view, use file path
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
        }
        
        // Ensure invoice has products array
        if (!invoice.products || !Array.isArray(invoice.products)) {
            console.warn('Invoice products not found in generatePrintContent, setting empty array');
            invoice.products = [];
        }
        
        // Use financial amounts directly from database (they are stored as EGP, not cents)
        const invoiceSubtotal = invoice.subtotal || 0;
        const invoiceTaxAmount = invoice.taxAmount || 0;
        const invoiceShipping = invoice.shipping || 0;
        const invoiceDiscount = invoice.discount || 0;
        const invoiceTotal = invoice.total || 0;
        const invoicePaid = invoice.paid || 0;
        const invoiceRemaining = invoice.remaining || 0;
        
        // Product prices and totals are already in EGP, no conversion needed
        
        console.log('[generatePrintContent] Invoice products:', {
            count: invoice.products.length,
            products: invoice.products.map(p => ({
                productName: p.productName,
                quantity: p.quantity,
                price: p.price,
                total: p.total
            }))
        });
        
        // Calculate product count - invoice can fit up to 22 products on A5 page without splitting
        const productCount = invoice.products.length;
        // Never split pages - always use single-page layout (even if products > 22)
        const shouldSplitPages = false;
        
        // Load smallestUnit, category and calculate quantityInSmallestUnit for each product if not already present
        if (window.electronAPI && window.electronAPI.dbGet) {
            for (let product of invoice.products) {
                if (product.productId) {
                    try {
                        const productData = await window.electronAPI.dbGet('products', product.productId);
                        if (productData) {
                            // Set smallestUnit if not present
                            if (!product.smallestUnit && productData.smallestUnit) {
                                product.smallestUnit = productData.smallestUnit;
                            }
                            // Set category if not present
                            if (!product.category && productData.category) {
                                product.category = productData.category;
                            }
                            // Calculate quantityInSmallestUnit if not present
                            if (!product.quantityInSmallestUnit && product.quantity) {
                                if (product.unit === 'largest' || (product.unitName && product.unitName === productData.largestUnit)) {
                                    // Convert from largest unit to smallest unit
                                    const conversionFactor = productData.conversionFactor || 1;
                                    product.quantityInSmallestUnit = product.quantity * conversionFactor;
                                } else {
                                    // Already in smallest unit
                                    product.quantityInSmallestUnit = product.quantity;
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error loading product data:', error);
                    }
                }
            }
        }
        
        const companySettings = await getCompanySettings();
        
        // Check if customer is cash customer
        const customerCode = customer ? (customer.code || '').trim().toUpperCase() : '';
        const isCashCustomer = customerCode === 'CASH';
        
        console.log('[generatePrintContent] Customer check:', {
            customerId: customer ? customer.id : 'null',
            customerName: customer ? customer.name : 'null',
            customerCode: customerCode,
            isCashCustomer: isCashCustomer
        });
        
        // قراءة الرصيد القديم من قاعدة البيانات (لقطة تاريخية)
        // الرصيد القديم محفوظ في عمود oldBalance في جدول sales_invoices
        // ⚠️ مهم: يجب قراءة القيمة من قاعدة البيانات وليس حسابها
        // لأنها تمثل "لقطة تاريخية" من الرصيد في وقت إنشاء الفاتورة
        let oldBalance = 0;
        let oldBalancePlusTotal = 0;
        let newBalance = 0;
        let remainingWithOldBalance = 0;
        
        if (invoice.oldBalance !== null && invoice.oldBalance !== undefined) {
            // قراءة القيم المحفوظة من قاعدة البيانات
            oldBalance = parseFloat(invoice.oldBalance) || 0;
            oldBalancePlusTotal = parseFloat(invoice.oldBalancePlusTotal) || 0;
            newBalance = parseFloat(invoice.newBalance) || 0;
            remainingWithOldBalance = parseFloat(invoice.remainingWithOldBalance) || 0;
            
            console.log('[generatePrintContent] Reading balance values from database (historical snapshot):', {
                oldBalance,
                oldBalancePlusTotal,
                newBalance,
                remainingWithOldBalance,
                invoiceRemaining: invoiceRemaining
            });
        } else {
            // Fallback: إذا لم تكن القيم موجودة (للحوافظ القديمة)
            // Calculate old balance: current balance - current invoice remaining
            oldBalance = (customer.balance || 0) - (invoice.remaining || 0);
            oldBalancePlusTotal = oldBalance + invoiceTotal;
            newBalance = oldBalance + invoiceRemaining;
            remainingWithOldBalance = oldBalance + invoiceRemaining;
            
            console.warn('[generatePrintContent] Balance values not found in database, using fallback calculation:', {
                oldBalance,
                oldBalancePlusTotal,
                newBalance,
                remainingWithOldBalance
            });
        }
        
        // Check if customer's old balance (excluding current invoice) exceeds 10,000
        // Exclude cash customer from warning
        const shouldShowWarning = customer && !isCashCustomer && oldBalance > 10000;
        
        // If cash customer, generate simplified half-page A4 format
        if (isCashCustomer) {
            console.log('[generatePrintContent] Using cash customer invoice format');
            // Ensure invoice has products array
            if (!invoice.products || !Array.isArray(invoice.products)) {
                invoice.products = [];
            }
            return generateCashCustomerInvoiceHTML(invoice, companySettings, logoBase64, logoPath, customer);
        }
        
        // Payment method text
        const paymentMethodText = {
            'cash': 'نقدي',
            'vodafone_cash': 'فودافون كاش',
            'bank': 'تحويل بنكي',
            'visa': 'فيزا',
            'check': 'شيك',
            'wallet': 'محفظة إلكترونية'
        };
        
        const paymentMethod = paymentMethodText[invoice.paymentMethod] || 'نقدي';
    
    // Convert numbers to Persian/Arabic numerals
    const toPersianNumerals = (str) => {
        const persianDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
        return str.toString().replace(/\d/g, (digit) => persianDigits[parseInt(digit)]);
    };
    
    // Format currency - use English numerals, no commas, decimal point only if needed
    const formatCurrency = (amount) => {
        // Check if amount is a whole number
        const isWholeNumber = amount % 1 === 0;
        let formatted;
        if (isWholeNumber) {
            // No decimal places for whole numbers - use English numerals, no commas
            formatted = Math.round(amount).toString();
        } else {
            // Keep 2 decimal places for non-whole numbers - use English numerals, no commas
            formatted = amount.toFixed(2);
        }
        return formatted; // Return English numerals without Persian conversion
    };
    
    // Format quantity - use English numerals, decimal point only if needed
    const formatQuantity = (quantity) => {
        let formatted;
        if (quantity % 1 === 0) {
            // Integer, no decimal places - use English numerals
            formatted = quantity.toString();
        } else {
            // Decimal, show up to 2 decimal places - use English numerals
            formatted = quantity.toFixed(2).replace(/\.?0+$/, '');
        }
        return formatted; // Return English numerals without Persian conversion
    };
    
    // Format date
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const formatted = date.toLocaleDateString('ar-EG');
        return toPersianNumerals(formatted);
    };
    
    // Format date and time
    const formatDateTime = (dateString, timeDate = null) => {
        const date = new Date(dateString);
        const formattedDate = date.toLocaleDateString('ar-EG');
        
        // Use timeDate if provided (for actual invoice creation time), otherwise use current time
        let timeToUse = timeDate ? new Date(timeDate) : new Date();
        
        let hours = timeToUse.getHours();
        let minutes = timeToUse.getMinutes();
        let seconds = timeToUse.getSeconds();
        
        const ampm = hours >= 12 ? 'مساءً' : 'صباحاً';
        
        // Convert to 12-hour format
        hours = hours % 12;
        hours = hours ? hours : 12; // 0 should be 12
        hours = String(hours).padStart(2, '0');
        minutes = String(minutes).padStart(2, '0');
        seconds = String(seconds).padStart(2, '0');
        
        const formattedTime = `${hours}:${minutes}:${seconds} ${ampm}`;
        return `${toPersianNumerals(formattedDate)} - ${toPersianNumerals(formattedTime)}`;
    };
    
    // Get invoice status text
    const getStatusText = (status) => {
        const statusMap = {
            'pending': 'معلق',
            'delivered': 'مدفوعة',
            'partial': 'جزئي',
            'cancelled': 'ملغاة'
        };
        return statusMap[status] || 'غير محدد';
    };
    
    return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>فاتورة ${invoice.invoiceNumber}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f5f5f5;
        }
        @media print {
            @page {
                size: ${pageSize};
                margin: 0 !important;
                padding: 0 !important;
            }
            html, body {
                margin: 0 !important;
                padding: 0 !important;
                width: ${pageSize === 'A5' ? '148mm' : '210mm'} !important; /* A5: 148mm, A4: 210mm */
                height: ${pageSize === 'A5' ? '210mm' : '297mm'} !important; /* A5: 210mm, A4: 297mm */
            }
            * {
                margin-top: 0 !important;
                margin-bottom: 0 !important;
            }
            body {
                background: white;
            }
            .page-break {
                height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                page-break-after: never !important;
                page-break-before: never !important;
                display: none !important;
            }
            /* Two invoice containers stacked vertically on A4 page */
            .invoices-wrapper {
                display: block !important;
                margin: 0 !important;
                padding-left: 5mm !important; /* Add padding from left */
                padding-right: 10mm !important; /* زيادة padding من اليمين لتجنب قطع المحتوى */
                padding-top: 5mm !important; /* Add padding from top */
                padding-bottom: 0 !important;
                width: ${pageSize === 'A5' ? '148mm' : '210mm'} !important; /* A5: 148mm, A4: 210mm */
            }
            .invoice-container {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                page-break-after: avoid !important;
                break-after: avoid !important;
                page-break-before: avoid !important;
                break-before: avoid !important;
                margin-top: 5mm !important;
                margin-right: 0 !important;
                margin-bottom: 0 !important;
                margin-left: 0 !important;
                padding: 0 !important;
                height: 147mm !important; /* Half A4 height for each copy (297mm / 2 = 148.5mm, minus cut-line ~1.5mm = ~147mm each) 
                Maximum products per copy: ~22 items (each row ~3.2mm height, available space ~70mm after optimized header/info/total/footer) */
                max-height: 147mm !important;
                min-height: 147mm !important;
                display: block !important;
                width: calc(210mm - 15mm) !important; /* A4 width minus left (5mm) and right (10mm) margins */
                max-width: calc(210mm - 15mm) !important;
                min-width: calc(210mm - 15mm) !important;
                overflow: hidden !important;
                box-sizing: border-box !important;
            }
            .invoice-container:first-of-type {
                height: 147mm !important;
                max-height: 147mm !important;
                min-height: 147mm !important; /* First copy (company) */
            }
            .invoice-container:nth-of-type(2) {
                height: 147mm !important;
                max-height: 147mm !important;
                min-height: 147mm !important; /* Second copy (customer) */
                page-break-before: avoid !important;
                break-before: avoid !important;
                margin-top: 0 !important;
                margin-bottom: 0 !important;
                padding-top: 0 !important;
                padding-bottom: 0 !important;
            }
            /* Remove any gap between containers in print */
            .invoice-container + .invoice-container {
                margin-top: 0 !important;
                padding-top: 0 !important;
            }
            /* Remove gap after cut-line - ensure customer copy starts immediately */
            .invoice-container:first-of-type .cut-line {
                margin-bottom: 0 !important;
                padding-bottom: 0 !important;
                margin-top: 0 !important;
                padding-top: 0 !important;
            }
            .invoice-container:first-of-type {
                margin-bottom: 0 !important;
                padding-bottom: 0 !important;
            }
            /* Force second container to start immediately after first */
            .invoice-container:first-of-type ~ .invoice-container {
                margin-top: 0 !important;
                padding-top: 0 !important;
            }
            /* Ensure cut-line doesn't add spacing in print */
            .invoice-container:first-of-type .cut-line {
                display: block !important;
                margin: 0 !important;
                padding: 0 !important;
                line-height: 0 !important;
                font-size: 0 !important;
            }
            .invoice-container table,
            .invoice-container .items-table,
            .invoice-container .tables-container {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
            .invoice-container tbody tr {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
            .invoice-container:first-of-type {
                page-break-before: avoid !important;
                break-before: avoid !important;
                margin-top: 0 !important;
                padding-top: 0 !important;
            }
            /* Ensure all content starts from top */
            .invoice-container > *:first-child {
                margin-top: 0 !important;
                padding-top: 0 !important;
            }
            /* Ensure second invoice container header has no top spacing */
            .invoice-container:nth-of-type(2) .header {
                margin-top: 0 !important;
                padding-top: 0 !important;
            }
            .invoice-container .header {
                margin-top: 0 !important;
                padding-top: 0 !important;
            }
            /* Ensure second invoice container starts immediately after cut-line */
            .invoice-container:nth-of-type(2) > *:first-child {
                margin-top: 0 !important;
                padding-top: 0 !important;
            }
            .invoice-container .invoice-type {
                top: 0 !important;
            }
            /* Never split pages - always keep both copies on same page */
            .invoices-wrapper.split-pages .invoice-container:nth-of-type(2),
            .invoices-wrapper.single-page .invoice-container:nth-of-type(2) {
                page-break-before: avoid !important;
                break-before: avoid !important;
                margin-top: 0 !important;
                padding-top: 0 !important;
            }
            /* Ensure cut-line doesn't cause page break */
            .cut-line {
                page-break-before: avoid !important;
                break-before: avoid !important;
                page-break-after: avoid !important;
                break-after: avoid !important;
                margin: 0 !important;
                margin-top: 0 !important;
                margin-bottom: 0 !important;
                padding: 0 !important;
                padding-top: 0 !important;
                padding-bottom: 0 !important;
                height: 2mm !important;
                min-height: 2mm !important;
                max-height: 2mm !important;
                border-top: 2px dashed #666 !important;
                display: block !important;
            }
            /* Remove gap after cut-line in first container */
            .invoice-container:first-of-type .cut-line {
                margin-bottom: 0 !important;
                padding-bottom: 0 !important;
            }
            .invoice-container:first-of-type {
                margin-bottom: 0 !important;
                padding-bottom: 0 !important;
            }
            /* Remove all spacing from second invoice container and its children in print */
            .invoice-container:nth-of-type(2) {
                margin-top: 0 !important;
                padding-top: 0 !important;
                margin-bottom: 0 !important;
                padding-bottom: 0 !important;
            }
            .invoice-container:nth-of-type(2) > *:not(.watermark) {
                margin-top: 0 !important;
                padding-top: 0 !important;
            }
            .invoice-container:nth-of-type(2) .header {
                margin-top: 0 !important;
                padding-top: 0 !important;
                margin-bottom: 0.5px !important;
            }
            .invoice-container:nth-of-type(2) .invoice-type {
                margin-top: 0 !important;
                padding-top: 0 !important;
                top: 0 !important;
            }
            /* Ensure first non-absolute element has no spacing */
            .invoice-container:nth-of-type(2) > .header:first-of-type {
                margin-top: 0 !important;
                padding-top: 0 !important;
            }
            /* Ensure cut-line has no spacing before second container */
            .cut-line {
                margin-bottom: 0 !important;
                padding-bottom: 0 !important;
                line-height: 0 !important;
            }
            /* Keep cut-line visible - no page breaks */
            .invoices-wrapper.split-pages .cut-line,
            .invoices-wrapper.single-page .cut-line {
                display: block !important;
                height: 2mm !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            /* Prevent page break around thank-you-text and footer */
            .footer {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
            .thank-you-text {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                page-break-after: avoid !important;
                break-after: avoid !important;
                page-break-before: avoid !important;
                break-before: avoid !important;
            }
            /* Prevent page break for back-page-notice - keep on same page */
            .back-page-notice {
                page-break-before: avoid !important;
                break-before: avoid !important;
                page-break-after: avoid !important;
                break-after: avoid !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
        }
        .invoices-wrapper {
            display: block;
            width: 210mm !important; /* A4 width */
            margin: 0 auto;
            padding-left: 5mm !important; /* Add padding from left */
            padding-right: 10mm !important; /* زيادة padding من اليمين لتجنب قطع المحتوى */
            padding-top: 5mm !important; /* Add padding from top */
            padding-bottom: 0 !important;
            background: white;
        }
        body {
            background: white;
            padding: 10px;
        }
        .invoice-container {
            width: ${customerCopyOnly ? (pageSize === 'A5' ? 'calc(148mm - 15mm)' : 'calc(210mm - 15mm)') : 'calc(210mm - 15mm)'} !important;
            max-width: ${customerCopyOnly ? (pageSize === 'A5' ? 'calc(148mm - 15mm)' : 'calc(210mm - 15mm)') : 'calc(210mm - 15mm)'} !important;
            min-width: ${customerCopyOnly ? (pageSize === 'A5' ? 'calc(148mm - 15mm)' : 'calc(210mm - 15mm)') : 'calc(210mm - 15mm)'} !important;
            height: ${customerCopyOnly ? (pageSize === 'A5' ? '210mm' : '297mm') : '147mm'} !important;
            max-height: ${customerCopyOnly ? (pageSize === 'A5' ? '210mm' : '297mm') : '147mm'} !important;
            min-height: ${customerCopyOnly ? (pageSize === 'A5' ? '210mm' : '297mm') : '147mm'} !important;
            margin-top: ${customerCopyOnly ? '0' : '5mm'} !important;
            margin-right: 0 !important;
            margin-bottom: 0 !important;
            margin-left: 0 !important;
            background: white;
            padding: 0 !important;
            position: relative;
            box-sizing: border-box;
            overflow: hidden !important; /* Prevent watermark and content from going outside */
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            contain: layout style paint !important; /* Contain content within container */
        }
        .invoice-container:first-of-type {
            height: 147mm !important;
            max-height: 147mm !important;
            min-height: 147mm !important;
        }
        .invoice-container:nth-of-type(2) {
            height: 147mm !important;
            max-height: 147mm !important;
            min-height: 147mm !important;
            margin-top: 0 !important;
            margin-bottom: 0 !important;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            page-break-before: avoid !important;
            break-before: avoid !important;
        }
        /* Ensure second invoice container starts immediately after cut-line - no spacing on first child */
        .invoice-container:nth-of-type(2) > *:first-child {
            margin-top: 0 !important;
            padding-top: 0 !important;
        }
        /* Remove any gap between containers and cut-line */
        .cut-line + .invoice-container {
            margin-top: 0 !important;
            padding-top: 0 !important;
        }
        .invoice-container + .invoice-container {
            margin-top: 0 !important;
            padding-top: 0 !important;
        }
        /* Remove gap after cut-line - ensure customer copy starts immediately */
        .invoice-container:first-of-type .cut-line {
            margin-bottom: 0 !important;
            padding-bottom: 0 !important;
            margin-top: 0 !important;
            padding-top: 0 !important;
        }
        .invoice-container:first-of-type {
            margin-bottom: 0 !important;
            padding-bottom: 0 !important;
        }
        /* Force second container to start immediately after first */
        .invoice-container:first-of-type ~ .invoice-container {
            margin-top: 0 !important;
            padding-top: 0 !important;
        }
        /* Ensure cut-line doesn't add spacing */
        .invoice-container:first-of-type .cut-line {
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            line-height: 0 !important;
            font-size: 0 !important;
        }
        /* Remove all spacing from second invoice container and its children */
        .invoice-container:nth-of-type(2) {
            margin-top: 0 !important;
            padding-top: 0 !important;
        }
        .invoice-container:nth-of-type(2) > *:not(.watermark) {
            margin-top: 0 !important;
            padding-top: 0 !important;
        }
        .invoice-container:nth-of-type(2) .header {
            margin-top: 0 !important;
            padding-top: 0 !important;
        }
        .invoice-container:nth-of-type(2) .invoice-type {
            margin-top: 0 !important;
            padding-top: 0 !important;
            top: 0 !important;
        }
        /* Ensure first non-absolute element has no spacing */
        .invoice-container:nth-of-type(2) > .header:first-of-type {
            margin-top: 0 !important;
            padding-top: 0 !important;
        }
        @media print {
            .invoice-container {
                padding: 0 !important;
                height: 147mm !important;
                max-height: 147mm !important;
                min-height: 147mm !important;
            }
            .invoice-container:first-of-type {
                height: 147mm !important;
                max-height: 147mm !important;
                min-height: 147mm !important;
            }
            .invoice-container:nth-of-type(2) {
                height: 147mm !important;
                max-height: 147mm !important;
                min-height: 147mm !important;
                margin-top: 0 !important;
                margin-bottom: 0 !important;
                padding-top: 0 !important;
                padding-bottom: 0 !important;
            }
            /* Remove any gap between containers in print */
            .invoice-container + .invoice-container {
                margin-top: 0 !important;
                padding-top: 0 !important;
            }
        }
        /* Invoice content - watermark will appear above header and table */
        .invoice-container > *:not(.watermark) {
            position: relative;
            z-index: 1;
        }
        /* Ensure header and table are above watermark */
        .header, .tables-container, .items-table {
            position: relative;
            z-index: 2;
        }
        .page-break {
            height: 0;
            border-top: 1px dashed #ccc;
            margin: 2mm 0;
        }
        .invoice-type {
            position: absolute;
            top: 0;
            left: 35mm;
            background: rgba(44, 62, 80, 0.5);
            color: white;
            padding: 2px 8px;
            border-radius: 2px;
            font-size: 8px;
            font-weight: bold;
            opacity: 0.6;
        }
        @media print {
            .invoice-type {
                top: 0 !important;
                margin: 0 !important;
                padding: 1px 5px !important;
            }
        }
        .invoice-type.company-copy {
            background: rgba(192, 57, 43, 0.5);
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: start;
            margin: 0 0 1px 0 !important;
            border-bottom: 1px solid #2c3e50;
            padding: 0 0 0.5px 0 !important;
        }
        /* Ensure second invoice container header has no top spacing */
        .invoice-container:nth-of-type(2) .header {
            margin-top: 0 !important;
            margin-bottom: 0.5px !important;
            padding-top: 0 !important;
            padding-bottom: 0.5px !important;
        }
        /* Ensure header is the first visible element with no spacing in second container */
        .invoice-container:nth-of-type(2) .header:first-of-type,
        .invoice-container:nth-of-type(2) > .header {
            margin-top: 0 !important;
            padding-top: 0 !important;
        }
        @media print {
            .header {
                margin-top: 0 !important;
                padding-top: 0 !important;
                margin-bottom: 0.3px !important;
                padding-bottom: 0.3px !important;
            }
        }
        .company-logo {
            width: 18px;
            height: 18px;
            margin-left: 2px;
            margin-bottom: 0.2px;
            object-fit: contain;
        }
        @media print {
            .company-logo {
                width: 15px !important;
                height: 15px !important;
                margin-left: 2px !important;
                margin-bottom: 0 !important;
            }
        }
        .company-info {
            flex: 1;
        }
        .company-name {
            font-size: 15px;
            font-weight: 700;
            color: #1a1a1a;
            margin-bottom: 0.3px;
            line-height: 1.2;
            letter-spacing: 0.3px;
        }
        @media print {
            .company-name {
                font-size: 15px !important;
                font-weight: 700 !important;
                color: #000000 !important;
                margin-bottom: 0 !important;
                line-height: 1.2 !important;
                letter-spacing: 0.3px !important;
            }
        }
        .company-details {
            font-size: 9px;
            color: #000000;
            line-height: 1.3;
            font-weight: bold;
        }
        @media print {
            .company-details {
                font-size: 8.5px !important;
                line-height: 1.15 !important;
                color: #000000 !important;
            }
        }
        .company-details p {
            margin: 0.3px 0;
        }
        @media print {
            .company-details p {
                margin: 0.1px 0 !important;
            }
        }
        .company-details strong {
            font-weight: 700;
            color: #000000;
        }
        @media print {
            .company-details strong {
                color: #000000 !important;
                font-weight: 700 !important;
            }
        }
        .invoice-title {
            text-align: left;
            color: #2c3e50;
        }
        .invoice-title h1 {
            font-size: 8px;
            margin-bottom: 0.2px;
        }
        @media print {
            .invoice-title h1 {
                font-size: 7.5px !important;
                margin-bottom: 0 !important;
            }
        }
        .invoice-number {
            font-size: 7px;
            color: #000000;
            font-weight: 700;
        }
        @media print {
            .invoice-number {
                font-size: 6.5px !important;
                color: #000000 !important;
                font-weight: 700 !important;
            }
        }
        .info-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 1px;
            gap: 4px;
        }
        @media print {
            .info-section {
                margin-bottom: 0.3px !important;
                gap: 2px !important;
            }
        }
        .info-box {
            flex: 1;
            background: #f8f9fa;
            padding: 1px;
            border-radius: 2px;
        }
        @media print {
            .info-box {
                padding: 0.3px !important;
            }
        }
        .info-box h3 {
            font-size: 5px;
            color: #2c3e50;
            margin-bottom: 0.2px;
            border-bottom: 1px solid #3498db;
            padding-bottom: 0.2px;
        }
        @media print {
            .info-box h3 {
                font-size: 4px !important;
                margin-bottom: 0 !important;
                padding-bottom: 0.1px !important;
            }
        }
        .info-box p {
            font-size: 5.5px;
            color: #000000;
            margin: 0.2px 0;
            font-weight: bold;
            line-height: 1.2;
        }
        @media print {
            .info-box p {
                font-size: 4.5px !important;
                color: #000000 !important;
                margin: 0.1px 0 !important;
                line-height: 1.05 !important;
            }
        }
        .info-box p strong {
            font-weight: 700;
            color: #000000;
        }
        @media print {
            .info-box p strong {
                font-weight: 700 !important;
                color: #000000 !important;
            }
        }
        .tables-container {
            display: flex;
            gap: 3px;
            margin-bottom: 0.5px !important;
            align-items: flex-start;
        }
        @media print {
            .tables-container {
                gap: 2px !important;
                margin-bottom: 0 !important;
            }
        }
        .items-table {
            flex: 0 0 65% !important; /* 65% of page width */
            max-width: 65% !important;
            width: 65% !important;
            border-collapse: collapse;
            font-size: 4.5px;
            margin-bottom: 0;
        }
        @media print {
            .items-table {
                font-size: 4px !important;
                flex: 0 0 65% !important;
                max-width: 65% !important;
                width: 65% !important;
            }
        }
        .items-table thead {
            background: #2c3e50;
            color: white;
        }
        .items-table th {
            padding: 2px 0.3px !important;
            text-align: center;
            font-size: 7px;
            font-weight: 700;
            color: #ffffff;
            border-right: 1px solid #1a1a1a;
        }
        .items-table th:last-child {
            border-right: none;
        }
        @media print {
            .items-table th {
                padding: 1px 0.15px !important;
                font-size: 6px !important;
                border-right: 1px solid #1a1a1a !important;
            }
            .items-table th:last-child {
                border-right: none !important;
            }
        }
        .items-table td {
            padding: 2px 0.3px !important;
            text-align: center;
            border-bottom: 1px solid #ddd;
            border-right: 1px solid #ddd;
            font-size: 6.5px;
            font-weight: 700;
            line-height: 1.4 !important;
            color: #000000;
        }
        .items-table td:last-child {
            border-right: none;
        }
        @media print {
            .items-table td {
                padding: 1px 0.15px !important;
                font-size: 6px !important;
                line-height: 1.25 !important;
                color: #000000 !important;
                border-right: 1px solid #ddd !important;
            }
            .items-table td:last-child {
                border-right: none !important;
            }
        }
        /* توضيح بيانات الكمية وسعر الوحدة والمجموع - تكبير الخط للقراءة */
        .items-table td:nth-child(3),
        .items-table td:nth-child(4),
        .items-table td:nth-child(5) {
            font-size: 11px !important;
            font-weight: 700 !important;
            color: #000000 !important;
            background-color: #f8f9fa;
            padding: 2px 0.3px !important;
        }
        @media print {
            .items-table td:nth-child(3),
            .items-table td:nth-child(4),
            .items-table td:nth-child(5) {
                font-size: 9.5px !important;
                padding: 1px 0.15px !important;
                line-height: 1.25 !important;
                color: #000000 !important;
            }
        }
        /* زيادة حجم خط اسم الصنف (اسم المنتج) - جعله واضح للقراءة */
        .items-table td:nth-child(2) {
            font-size: 10px !important;
            font-weight: 700 !important;
            padding: 2px 0.3px !important;
            color: #000000;
        }
        @media print {
            .items-table td:nth-child(2) {
                font-size: 8.5px !important;
                padding: 1px 0.15px !important;
                line-height: 1.25 !important;
                color: #000000 !important;
            }
        }
        /* تكبير رؤوس الأعمدة للكمية والسعر والمجموع */
        .items-table th:nth-child(3),
        .items-table th:nth-child(4),
        .items-table th:nth-child(5) {
            background-color: #34495e;
            font-size: 9px;
        }
        @media print {
            .items-table th:nth-child(3),
            .items-table th:nth-child(4),
            .items-table th:nth-child(5) {
                font-size: 8.5px !important;
            }
        }
        /* تكبير رأس عمود الصنف */
        .items-table th:nth-child(2) {
            font-size: 9px;
        }
        @media print {
            .items-table th:nth-child(2) {
                font-size: 8.5px !important;
            }
        }
        .items-table tbody tr:hover {
            background: #f8f9fa;
        }
        .items-table tbody tr.empty-row {
            height: 1.5px !important;
            border-bottom: 1px dashed #ddd;
        }
        .items-table tbody tr.empty-row td {
            border-bottom: 1px dashed #ddd;
            min-height: 1.5px;
            padding: 0 !important;
            line-height: 0.8 !important;
        }
        @media print {
            .items-table tbody tr.empty-row {
                height: 1px !important;
            }
            .items-table tbody tr.empty-row td {
                min-height: 1px !important;
            }
        }
        .manual-edit-section {
            margin-top: 2px;
            padding: 2px;
            border: 1px dashed #ccc;
            border-radius: 2px;
            background: #fafafa;
            font-size: 6px;
            color: #666;
        }
        .manual-edit-section p {
            margin: 1px 0;
            font-weight: bold;
        }
        .total-section {
            display: flex;
            justify-content: flex-start;
            margin-bottom: 1px !important;
            flex: 0 0 35% !important; /* 35% of page width */
            max-width: 35% !important;
            width: 35% !important;
        }
        .total-box {
            min-width: 100% !important;
            width: 100% !important;
            max-width: 100% !important;
            border: 1.5px solid #2c3e50;
            border-radius: 2px;
            overflow: hidden;
            background: #ffffff;
        }
        @media print {
            .total-section {
                flex: 0 0 35% !important;
                max-width: 35% !important;
                width: 35% !important;
            }
            .total-box {
                min-width: 100% !important;
                width: 100% !important;
            }
        }
        .total-row {
            display: flex;
            justify-content: space-between;
            padding: 3px 2px !important;
            min-height: 7px;
            font-size: 10px;
            line-height: 1.3 !important;
            color: #000000;
            font-weight: 700;
        }
        .total-row span:first-child {
            border-right: 1px solid #ddd;
            padding-right: 3px;
            flex: 1;
            text-align: right;
            font-size: 10px;
        }
        .total-row span:last-child {
            padding-left: 3px;
            flex-shrink: 0;
            text-align: left;
            font-weight: 700;
            font-size: 10.5px;
        }
        /* زيادة حجم خط المجموع الفرعي والرصيد القديم + الإجمالي والمدفوع من العميل */
        .total-row.subtotal-row,
        .total-row.old-balance-plus-total-row,
        .total-row.paid-by-customer-row {
            font-size: 11px !important;
            font-weight: 700 !important;
            padding: 3px 2px !important;
            min-height: 8.5px;
            line-height: 1.5 !important;
            color: #000000 !important;
        }
        .total-row.subtotal-row span:first-child,
        .total-row.old-balance-plus-total-row span:first-child,
        .total-row.paid-by-customer-row span:first-child {
            font-size: 11px !important;
        }
        .total-row.subtotal-row span:last-child,
        .total-row.old-balance-plus-total-row span:last-child,
        .total-row.paid-by-customer-row span:last-child {
            font-size: 11.5px !important;
        }
        .total-row:not(:last-child) {
            border-bottom: 1px solid #ddd;
        }
        .total-row.grand-total {
            background: #2c3e50;
            color: white;
            font-weight: 700;
            font-size: 12px;
            padding: 3.5px 2px !important;
            min-height: 9px;
        }
        .total-row.grand-total span:first-child {
            border-right: 1px solid rgba(255, 255, 255, 0.3);
            font-size: 12px;
        }
        .total-row.grand-total span:last-child {
            font-size: 12.5px !important;
        }
        .total-row.grand-total.highlighted {
            font-weight: 700;
            font-size: 12.5px;
            color: #000000;
            background: transparent;
            padding: 3.5px 2px !important;
            min-height: 9px;
        }
        .total-row.grand-total.highlighted span:first-child {
            border-right: 1px solid #ddd;
            font-size: 12.5px;
        }
        .total-row.grand-total.highlighted span:last-child {
            font-size: 13px !important;
        }
        .total-row.new-balance {
            font-weight: 700;
            font-size: 11.5px;
            color: #000000;
            padding: 3px 2px !important;
            min-height: 8.5px;
        }
        .total-row.new-balance span:first-child {
            font-size: 11.5px;
        }
        .total-row.new-balance span:last-child {
            font-size: 12px !important;
        }
        .total-row.new-balance span {
            white-space: nowrap;
        }
        .total-row.old-balance {
            font-weight: 700;
            font-size: 11px;
            color: #000000;
            padding: 3px 2px !important;
            min-height: 8.5px;
            background-color: #fff3cd !important; /* Light yellow background to make it visible */
        }
        .total-row.old-balance span:first-child {
            font-size: 11px;
        }
        .total-row.old-balance span:last-child {
            font-size: 11.5px !important;
        }
        @media print {
            .total-row.old-balance {
                color: #000000 !important;
                background-color: #fff3cd !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
        }
        @media print {
            .total-box {
                min-width: 100% !important;
                width: 100% !important;
            }
            .total-row {
                font-size: 9px !important;
                padding: 2px 1.5px !important;
                min-height: 6.5px !important;
                line-height: 1.25 !important;
            }
            .total-row span:first-child {
                border-right: 1px solid #ddd !important;
                padding-right: 2px !important;
                font-size: 9.5px !important;
            }
            .total-row span:last-child {
                padding-left: 2px !important;
                font-size: 10px !important;
            }
            .total-row.subtotal-row,
            .total-row.old-balance-plus-total-row,
            .total-row.paid-by-customer-row {
                font-size: 10.5px !important;
                padding: 2.5px 2px !important;
                min-height: 8px !important;
                line-height: 1.4 !important;
            }
            .total-row.subtotal-row span:first-child,
            .total-row.old-balance-plus-total-row span:first-child,
            .total-row.paid-by-customer-row span:first-child {
                font-size: 10.5px !important;
            }
            .total-row.subtotal-row span:last-child,
            .total-row.old-balance-plus-total-row span:last-child,
            .total-row.paid-by-customer-row span:last-child {
                font-size: 11px !important;
            }
            .total-row.grand-total {
                font-size: 11px !important;
                padding: 3px 2px !important;
                min-height: 8.5px !important;
            }
            .total-row.grand-total span:first-child {
                border-right: 1px solid rgba(255, 255, 255, 0.3) !important;
                font-size: 11px !important;
            }
            .total-row.grand-total span:last-child {
                font-size: 11.5px !important;
            }
            .total-row.grand-total.highlighted {
                font-size: 11.5px !important;
                padding: 3px 2px !important;
                min-height: 8.5px !important;
            }
            .total-row.grand-total.highlighted span:first-child {
                border-right: 1px solid #ddd !important;
                font-size: 11.5px !important;
            }
            .total-row.grand-total.highlighted span:last-child {
                font-size: 12px !important;
            }
            .total-row.new-balance {
                font-size: 10.5px !important;
                padding: 2.5px 2px !important;
                min-height: 8px !important;
            }
            .total-row.new-balance span:first-child {
                font-size: 10.5px !important;
            }
            .total-row.new-balance span:last-child {
                font-size: 11px !important;
            }
            .total-row.old-balance {
                font-size: 10.5px !important;
                padding: 2.5px 2px !important;
                min-height: 8px !important;
            }
            .total-row.old-balance span:first-child {
                font-size: 10.5px !important;
            }
            .total-row.old-balance span:last-child {
                font-size: 11px !important;
            }
        }
        .manual-edit-row.remaining-balance {
            font-weight: bold;
        }
        .manual-edit-row.remaining-balance span:first-child {
            font-weight: bold;
            color: #000000;
        }
        .total-row.empty-row {
            height: 4px;
            border-bottom: 1px dashed #ddd;
            padding: 1px 3px;
            min-height: 4px;
        }
        .total-row.empty-row span {
            border: none;
            font-size: 6px;
            line-height: 1.2;
        }
        .manual-edit-section-wrapper {
            background: #fef3c7;
            border: 2px solid #fbbf24;
            border-radius: 4px;
            padding: 2px;
            margin-top: 2px;
        }
        .manual-edit-header {
            font-weight: bold;
            font-size: 6px;
            white-space: nowrap;
        }
        .manual-edit-header::before {
            content: '✏️ ';
            margin-left: 2px;
        }
        .manual-edit-row {
            font-size: 6px;
            color: #1e293b;
            font-weight: bold;
            line-height: 1.3;
            white-space: nowrap;
        }
        .total-row.empty-row.manual-edit-row {
            padding: 1px 3px;
            height: auto;
            min-height: 4px;
        }
        .total-row.empty-row.manual-edit-row span {
            font-size: 6px;
            line-height: 1.3;
        }
        /* Ensure text doesn't overlap in manual edit section */
        .total-row.empty-row span {
            display: inline-block;
            max-width: 50%;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .total-row.empty-row span:first-child {
            text-align: right;
            flex: 1;
            min-width: 0;
        }
        .total-row.empty-row span:last-child {
            text-align: left;
            flex-shrink: 0;
            margin-left: 4px;
        }
        @media print {
            .manual-edit-row {
                font-size: 5.5px !important;
                line-height: 1.25 !important;
            }
            .manual-edit-header {
                font-size: 5.5px !important;
            }
            .total-row.empty-row {
                height: 3.5px !important;
                padding: 0.8px 2.5px !important;
                min-height: 3.5px !important;
            }
            .total-row.empty-row span {
                font-size: 5.5px !important;
                line-height: 1.2 !important;
            }
            .total-row.empty-row.manual-edit-row {
                padding: 0.8px 2.5px !important;
                height: auto !important;
                min-height: 3.5px !important;
            }
            .total-row.empty-row.manual-edit-row span {
                font-size: 5.5px !important;
                line-height: 1.25 !important;
            }
            .manual-edit-section-wrapper {
                padding: 1.5px !important;
                margin-top: 1px !important;
            }
        }
        .signature-section {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 0.5px !important;
            margin-bottom: 0 !important;
            padding-top: 0.5px !important;
            padding-bottom: 0 !important;
            border-top: 1px solid #ddd;
            min-height: 15px !important;
        }
        @media print {
            .signature-section {
                margin-top: 0.3px !important;
                margin-bottom: 0 !important;
                padding-top: 0.3px !important;
                padding-bottom: 0 !important;
                min-height: 12px !important;
            }
        }
        .company-seal {
            text-align: left;
            flex: 1;
        }
        .company-seal-label {
            font-size: 6.5px;
            text-align: right;
            width: 100%;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 0.5px;
        }
        .company-seal-space {
            width: 80px;
            height: 15px;
            margin-top: 0.5px;
        }
        .customer-signature {
            text-align: right;
            flex: 1;
        }
        .customer-signature-label {
            font-size: 6.5px;
            text-align: left;
            width: 100%;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 0.5px;
        }
        .customer-signature-space {
            text-align: left;
            height: 15px;
            margin-top: 0.5px;
            margin-left: 0;
        }
        .thank-you-text {
            text-align: center;
            margin-top: 0.5px;
            font-size: 6.5px;
            font-weight: bold;
            color: #2c3e50;
            padding: 1px 0;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
        }
        .footer {
            margin-top: 0.3px;
            padding-top: 0.2px;
            padding-bottom: 0 !important;
            margin-bottom: 0 !important;
            border-top: 1px solid #ddd;
            text-align: center;
            font-size: 8px;
            font-weight: 700;
            color: #000000;
            line-height: 1.4;
        }
        /* Ensure cut-line is right after footer with no gap - remove footer bottom spacing */
        .invoice-container:first-of-type .footer {
            margin-bottom: 0 !important;
            padding-bottom: 0 !important;
        }
        .footer + .cut-line {
            margin-top: 0 !important;
            padding-top: 0 !important;
        }
        .footer p {
            font-size: 8px;
            font-weight: 700;
            color: #000000;
            line-height: 1.4;
            margin: 0 !important;
            padding: 0 !important;
        }
        .footer span {
            font-size: 8px;
            font-weight: 700;
            color: #000000;
            line-height: 1.4;
        }
        @media print {
            .footer {
                margin-top: 0.15px !important;
                margin-bottom: 0 !important;
                padding-top: 0.1px !important;
                padding-bottom: 0 !important;
                font-size: 7px !important;
                line-height: 1.25 !important;
                color: #000000 !important;
            }
            .footer p {
                font-size: 7.5px !important;
                color: #000000 !important;
            }
            .footer span {
                font-size: 7.5px !important;
                color: #000000 !important;
            }
            /* Remove footer spacing before cut-line in first container */
            .invoice-container:first-of-type .footer {
                margin-bottom: 0 !important;
                padding-bottom: 0 !important;
            }
        }
        .back-page-notice {
            page-break-before: avoid !important;
            width: 100%;
            max-width: 148mm; /* A5 width */
            margin: 2mm auto;
            background: white;
            padding: 5mm;
            box-sizing: border-box;
            border: 2px solid #dc2626;
            border-radius: 3px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            font-size: 8px;
        
        }
        .back-page-notice h3 {
            font-size: 18px;
            color: #dc2626;
            // margin-bottom: 20px;
            font-weight: bold;
            text-align: center;
            margin-top: 100mm;
        }
        .back-page-notice-content {
            font-size: 14px;
            line-height: 2;
            color: #333;
            text-align: right;
            direction: rtl;
            max-width: 160mm;
            width: 100%;
            margin-top: 10mm;
            
        }
        .back-page-notice-content p {
            margin-bottom: 15px;
            text-align: right;
        
        }
        @media print {
            .back-page-notice {
                page-break-before: avoid !important;
                page-break-inside: avoid !important;
                page-break-after: avoid !important;
                break-before: avoid !important;
                break-inside: avoid !important;
                break-after: avoid !important;
            }
        }
        .cut-line {
            margin: 0 !important;
            padding: 0 !important;
            margin-top: 0 !important;
            margin-bottom: 0 !important;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            text-align: center;
            border-top: 2px dashed #666 !important;
            border-bottom: none !important;
            position: relative;
            height: 2mm !important;
            min-height: 2mm !important;
            max-height: 2mm !important;
            overflow: visible;
            display: block !important;
            width: 100%;
            line-height: 0 !important;
        }
        .cut-line::before {
            content: '✂️';
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 0 5px;
            font-size: 10px;
            color: #666;
        }
        @media print {
            .cut-line {
                display: block !important;
                height: 2mm !important;
                margin: 0 !important;
                padding: 0 !important;
                border-top: 2px dashed #666 !important;
            }
        }
        .status-row {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: nowrap;
            flex-shrink: 1;
        }
        .status-checkbox {
            display: flex;
            gap: 6px;
            align-items: center;
            flex-wrap: nowrap;
            flex-shrink: 1;
        }
        .status-item {
            display: flex;
            align-items: center;
            gap: 2px;
            font-size: 9px;
            white-space: nowrap;
            flex-shrink: 1;
        }
        .status-item label {
            font-size: 9px;
        }
        .status-checkbox input[type="checkbox"] {
            width: 11px;
            height: 11px;
            cursor: pointer;
            flex-shrink: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        @media print {
            .status-checkbox input[type="checkbox"] {
                -webkit-appearance: none;
                appearance: none;
                border: 2px solid #2c3e50;
                border-radius: 2px;
                position: relative;
            }
            .status-checkbox input[type="checkbox"]:checked::before {
                content: '✓';
                position: absolute;
                top: -3px;
                left: 0px;
                color: #2c3e50;
                font-weight: bold;
                font-size: 9px;
            }
        }
        .watermark {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100% !important; /* Cover entire container from start to end */
            max-height: 100% !important;
            z-index: 999; /* High z-index to appear above all content */
            pointer-events: none;
            overflow: hidden !important; /* Prevent watermark from going outside container */
        }
        .watermark-text {
            position: absolute;
            top: 50%; /* Center vertically in full height */
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 140px !important; /* Extra large size to stretch across full height */
            font-weight: bold;
            color: rgba(44, 62, 80, 0.12);
            white-space: nowrap;
            text-align: center;
            line-height: 1.2;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 200%;
            width: 200%;
        }
        .watermark-text::before {
            content: 'شركة أسيل';
            display: block;
        }
        @media print {
            .watermark {
                height: 100% !important;
                max-height: 100% !important;
                overflow: hidden !important;
            }
            .watermark-text {
                font-size: 130px !important; /* Extra large size for print to stretch full height */
                top: 50% !important;
                color: rgba(44, 62, 80, 0.12) !important;
                max-width: 200% !important;
                width: 200% !important;
            }
        }
    </style>
      </head>
      <body>
      <div class="invoices-wrapper ${shouldSplitPages ? 'split-pages' : 'single-page'}">
      ${!customerCopyOnly ? `<!-- فاتورة مبيعات الشركة (نسخة) -->
      <div class="invoice-container">
        <div class="watermark">
            <div class="watermark-text"></div>
        </div>
        <div class="invoice-type company-copy">نسخة الشركة - COPY</div>
        
            <div class="header">
                <div class="company-info" style="display: flex; align-items: center; gap: 8px;">
                <img src="${logoBase64 || logoPath}" alt="Logo" class="company-logo" />
                <div>
                <div class="company-name">${companySettings.name || 'شركة أسيل'}</div>
                <div class="company-details">
                    ${companySettings.address ? `<p><strong>العنوان:</strong> <strong>${companySettings.address}</strong></p>` : ''}
                    <p><strong>${companySettings.phone ? `هاتف: ${companySettings.phone}` : ''}${companySettings.phone && companySettings.mobile ? ' | ' : ''}${companySettings.mobile ? `المحمول: ${companySettings.mobile}` : ''}${(companySettings.phone || companySettings.mobile) && companySettings.email ? ' | ' : ''}${companySettings.email ? `البريد: ${companySettings.email}` : ''}</strong></p>
                    ${companySettings.register || companySettings.tax ? `<p><strong>${companySettings.register ? `السجل التجاري: ${companySettings.register}` : ''}${companySettings.register && companySettings.tax ? ' | ' : ''}${companySettings.tax ? `الرقم الضريبي: ${companySettings.tax}` : ''}</strong></p>` : ''}
                </div>
                </div>
            </div>
            <div class="invoice-title">
                <h1>فاتورة مبيعات</h1>
                <p class="invoice-number">رقم: ${invoice.invoiceNumber}</p>
                <p class="invoice-number" style="font-size: 7px;font-weight: bold;">التاريخ: ${formatDateTime(invoice.date || invoice.createdAt || new Date().toISOString(), invoice.createdAt || new Date().toISOString())}${invoice.deliveryNoteNumber ? ` | رقم إذن الصرف: ${invoice.deliveryNoteNumber}` : ''}</p>
                </div>
                </div>

        <div class="info-section">
            <div class="info-box">
                <h3>بيانات العميل</h3>
                <p><strong>الاسم:</strong> <strong><span style="font-size: 11px;font-weight: bold;">${customer ? customer.name : 'غير محدد'}</span></strong>${customer && customer.phone ? ` <strong style="font-size: 8px; color: #1a1a1a; background: #f0f0f0; padding: 1px 4px; border-radius: 3px; margin-right: 8px; margin-left: 8px;">رقم الهاتف: ${customer.phone}</strong>` : ''}</p>
                ${customer && customer.address ? `<p style="margin-top: 3px;"><strong>العنوان:</strong> <strong style="font-size: 8px; font-weight: bold; color: #000000;">${customer.address}</strong></p>` : ''}
            </div>
            <div class="info-box">
                <h3>تفاصيل الدفع</h3>
                <p class="status-row"><strong>طريقة الدفع:</strong>
                    <span class="status-checkbox">
                        <span class="status-item">
                            <input type="checkbox" disabled>
                            <label>نقدي</label>
                        </span>
                        <span class="status-item">
                            <input type="checkbox" disabled>
                            <label>تحويل بنكي</label>
                        </span>
                        <span class="status-item">
                            <input type="checkbox" disabled>
                            <label>شيك</label>
                        </span>
                        <span class="status-item">
                            <input type="checkbox" disabled>
                            <label>محفظة إلكترونية</label>
                        </span>
                    </span>
                </p>
                ${invoice.dueDate ? `<p><strong>تاريخ الاستحقاق:</strong> ${formatDate(invoice.dueDate)}</p>` : ''}
                ${invoice.deliveryNoteNumber ? `<p><strong>رقم إذن الصرف:</strong> <strong>${invoice.deliveryNoteNumber}</strong></p>` : ''}
                <p class="status-row"><strong>الحالة:</strong>
                    <span class="status-checkbox">
                        <span class="status-item">
                            <input type="checkbox" disabled>
                            <label>اجله</label>
                        </span>
                        <span class="status-item">
                            <input type="checkbox" disabled>
                            <label>مدفوعه</label>
                        </span>
                    </span>
                </p>
            </div>
        </div>

        <div class="tables-container">
        <table class="items-table">
                <thead>
                    <tr>
                    <th>م</th>
                    <th>الصنف</th>
                        <th>الكمية</th>
                    <th>سعر الوحدة</th>
                    <th>المجموع</th>
                    </tr>
                </thead>
                <tbody>
                    ${invoice.products.map((product, index) => `
                    <tr>
                        <td>${index + 1}</td>
                    <td>${product.productName}${product.category ? ` - ${product.category}` : ''}${product.productCode ? ` (${product.productCode})` : ''}</td>
                    <td>${formatQuantity(product.quantityInSmallestUnit || product.quantity || 0)} ${product.smallestUnit || product.unitName || ''}</td>
                    <td>${formatCurrency(product.price)} ج.م</td>
                    <td>${formatCurrency(product.total)} ج.م</td>
                </tr>
                `).join('')}
                <!-- سطور فارغة للتعديل اليدوي - fill up to 30 products -->
                ${Array(Math.max(0, 30 - invoice.products.length)).fill(0).map(() => `
                <tr class="empty-row">
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>

        <div class="total-section">
            <div class="total-box">
                <div class="total-row subtotal-row">
                    <span>المجموع الفرعي:</span>
                    <span>${formatCurrency(invoiceSubtotal)} ج.م</span>
                </div>
                    ${invoiceTaxAmount > 0 ? `
                <div class="total-row">
                    <span>ضريبة القيمة المضافة (${toPersianNumerals(invoice.taxRate || 0)}%):</span>
                    <span>${formatCurrency(invoiceTaxAmount)} ج.م</span>
                </div>
                    ` : ''}
                    ${invoiceShipping > 0 ? `
                <div class="total-row">
                    <span>الشحن والتوصيل:</span>
                    <span>${formatCurrency(invoiceShipping)} ج.م</span>
                </div>
                    ` : ''}
                    ${invoiceDiscount > 0 ? `
                <div class="total-row">
                    <span>الخصم:</span>
                    <span>- ${formatCurrency(invoiceDiscount)} ج.م</span>
                </div>
                    ` : ''}
                <div class="total-row grand-total highlighted">
                    <span>الإجمالي:</span>
                    <span>${formatCurrency(invoiceTotal)} ج.م</span>
            </div>
                    ${customer ? `
                <div class="total-row old-balance">
                    <span>الرصيد القديم:</span>
                    <span>${formatCurrency(oldBalance)} ج.م</span>
            </div>
                <div class="total-row old-balance-plus-total-row">
                    <span>القديم + الفاتورة:</span>
                    <span>${formatCurrency(oldBalancePlusTotal)} ج.م</span>
            </div>
                <div class="total-row paid-by-customer-row">
                    <span>المدفوع من العميل:</span>
                    <span>${formatCurrency(invoiceTotal - invoiceRemaining)} ج.م</span>
                </div>
                <div class="total-row new-balance">
                    <span>الرصيد الجديد:</span>
                    <span>${formatCurrency(newBalance)} ج.م</span>
                </div>
                ${shouldShowWarning ? `
                <div class="credit-warning" style="margin-top: 3px; padding: 3px; background: #fff3cd; border: 1.5px solid #ffc107; border-radius: 3px; font-size: 6px; line-height: 1.4; color: #000000; text-align: right; direction: rtl;">
                    <p style="margin: 0.8px 0; font-weight: 700; font-size: 7px; color: #856404;"><strong>تنويه:</strong></p>
                    <p style="margin: 0.5px 0; font-weight: 700; font-size: 6px;">نُلفت عنايتكم إلى أن الرصيد المستحق (الآجل) — باستثناء الفاتورة الحالية — قد تجاوز الحد الائتماني المسموح به (10,000 ج.م)، ولم يتم السداد حتى تاريخه.</p>
                    <p style="margin: 0.5px 0; font-weight: 700; font-size: 6px;">نرجو من سيادتكم تسوية الفاتورة الحالية بالكامل، والعمل على تنظيم سداد المبالغ المتأخرة حفاظًا على استمرار التعاون وضمان تقديم أفضل الخدمات لكم.</p>
                    <p style="margin: 0.5px 0; font-weight: 700; font-size: 6px;">شاكرين تفهمكم وتعاونكم الدائم.</p>
                    <p style="margin: 0.5px 0; font-weight: 700; font-size: 6px; text-align: left;">إدارة الشركة</p>
                </div>
                ` : ''}
                ` : ''}
                <div class="total-row empty-row">
                    <span></span>
                    <span></span>
                </div>
            </div>
            </div>
        </div>
        
        <div class="signature-section">
            <div class="company-seal">
                <div class="company-seal-label">ختم الشركة</div>
                <div class="company-seal-space"></div>
                ${companySettings.salesRepName || companySettings.salesRepPhone ? `
                <div style="margin-top: 5px; font-size: 7px !important; font-weight: bold !important; color: #2c3e50;">
                    <strong>المندوب:</strong> ${companySettings.salesRepName || ''}${companySettings.salesRepName && companySettings.salesRepPhone ? ' - ' : ''}${companySettings.salesRepPhone || ''}
                </div>
                ` : ''}
                ${companySettings.accountantName || companySettings.accountantPhone ? `
                <div style="margin-top: 3px; font-size: 7px !important; font-weight: bold !important; color: #2c3e50;">
                    <strong>المحاسب:</strong> ${companySettings.accountantName || ''}${companySettings.accountantName && companySettings.accountantPhone ? ' - ' : ''}${companySettings.accountantPhone || ''}
                </div>
                ` : ''}
            </div>
            <div class="customer-signature">
                <div class="customer-signature-label">توقيع المستلم</div>
                <div class="customer-signature-space"></div>
            </div>
        </div>
        
        <div class="footer">
            ${companySettings.commitmentText ? `<p style="font-size: 8px;font-weight: 700; line-height: 1.4; color: #000000;"><strong>${companySettings.commitmentText}</strong></p>` : '<span style="font-size: 8px;font-weight: 700; align-items: center; text-align: center; line-height: 1.4; color: #000000;">أقر بأنني قد استلمت البضاعة/الخدمة المبينة أعلاه بحالة جيدة وبمواصفات مطابقة، وأتعهد بالسداد وفق الشروط المذكورة.</span>'}
        </div>
    </div>
    ` : ''}
    <!-- فاتورة العميل (الأصل) -->
    <div class="invoice-container" style="margin-top: 0 !important; padding-top: 0 !important; margin-bottom: 0 !important; padding-bottom: 0 !important;">
        <div class="watermark">
            <div class="watermark-text"></div>
        </div>
        <div class="invoice-type">ORIGINAL</div>
        
            <div class="header">
                <div class="company-info" style="display: flex; align-items: center; gap: 8px;">
                <img src="${logoBase64 || logoPath}" alt="Logo" class="company-logo" />
                <div>
                <div class="company-name">${companySettings.name || 'شركة أسيل'}</div>
                <div class="company-details">
                    ${companySettings.address ? `<p><strong>العنوان:</strong> <strong>${companySettings.address}</strong></p>` : ''}
                    <p><strong>${companySettings.phone ? `هاتف: ${companySettings.phone}` : ''}${companySettings.phone && companySettings.mobile ? ' | ' : ''}${companySettings.mobile ? `المحمول: ${companySettings.mobile}` : ''}${(companySettings.phone || companySettings.mobile) && companySettings.email ? ' | ' : ''}${companySettings.email ? `البريد: ${companySettings.email}` : ''}</strong></p>
                    ${companySettings.register || companySettings.tax ? `<p><strong>${companySettings.register ? `السجل التجاري: ${companySettings.register}` : ''}${companySettings.register && companySettings.tax ? ' | ' : ''}${companySettings.tax ? `الرقم الضريبي: ${companySettings.tax}` : ''}</strong></p>` : ''}
                </div>
                </div>
            </div>
            <div class="invoice-title">
                <h1>فاتورة مبيعات</h1>
                <p class="invoice-number">رقم: ${invoice.invoiceNumber}</p>
                <p class="invoice-number" style="font-size: 7px;font-weight: bold;">التاريخ: ${formatDateTime(invoice.date || invoice.createdAt || new Date().toISOString(), invoice.createdAt || new Date().toISOString())}${invoice.deliveryNoteNumber ? ` | رقم إذن الصرف: ${invoice.deliveryNoteNumber}` : ''}</p>
                </div>
                </div>

        <div class="info-section">
            <div class="info-box">
                <h3>بيانات العميل</h3>
                <p><strong>الاسم:</strong> <strong><span style="font-size: 11px;font-weight: bold;">${customer ? customer.name : 'غير محدد'}</span></strong>${customer && customer.phone ? ` <strong style="font-size: 8px; color: #1a1a1a; background: #f0f0f0; padding: 1px 4px; border-radius: 3px; margin-right: 8px; margin-left: 8px;">رقم الهاتف: ${customer.phone}</strong>` : ''}</p>
                ${customer && customer.address ? `<p style="margin-top: 3px;"><strong>العنوان:</strong> <strong style="font-size: 8px; font-weight: bold; color: #000000;">${customer.address}</strong></p>` : ''}
            </div>
            <div class="info-box">
                <h3>تفاصيل الدفع</h3>
                <p class="status-row"><strong>طريقة الدفع:</strong>
                    <span class="status-checkbox">
                        <span class="status-item">
                            <input type="checkbox" disabled>
                            <label>نقدي</label>
                        </span>
                        <span class="status-item">
                            <input type="checkbox" disabled>
                            <label>تحويل بنكي</label>
                        </span>
                        <span class="status-item">
                            <input type="checkbox" disabled>
                            <label>شيك</label>
                        </span>
                        <span class="status-item">
                            <input type="checkbox" disabled>
                            <label>محفظة إلكترونية</label>
                        </span>
                    </span>
                </p>
                ${invoice.dueDate ? `<p><strong>تاريخ الاستحقاق:</strong> ${formatDate(invoice.dueDate)}</p>` : ''}
                ${invoice.deliveryNoteNumber ? `<p><strong>رقم إذن الصرف:</strong> <strong>${invoice.deliveryNoteNumber}</strong></p>` : ''}
                <p class="status-row"><strong>الحالة:</strong>
                    <span class="status-checkbox">
                        <span class="status-item">
                            <input type="checkbox" disabled>
                            <label>اجله</label>
                        </span>
                        <span class="status-item">
                            <input type="checkbox" disabled>
                            <label>مدفوعه</label>
                        </span>
                    </span>
                </p>
            </div>
        </div>

        <div class="tables-container">
        <table class="items-table">
                <thead>
                    <tr>
                    <th>م</th>
                    <th>الصنف</th>
                        <th>الكمية</th>
                        <th>سعر الوحدة</th>
                    <th>المجموع</th>
                    </tr>
                </thead>
                <tbody>
                    ${invoice.products.map((product, index) => `
                    <tr>
                        <td>${index + 1}</td>
                    <td>${product.productName}${product.category ? ` - ${product.category}` : ''}${product.productCode ? ` (${product.productCode})` : ''}</td>
                    <td>${formatQuantity(product.quantityInSmallestUnit || product.quantity || 0)} ${product.smallestUnit || product.unitName || ''}</td>
                    <td>${formatCurrency(product.price)} ج.م</td>
                    <td>${formatCurrency(product.total)} ج.م</td>
                </tr>
                `).join('')}
                <!-- سطور فارغة للتعديل اليدوي - fill up to 30 products -->
                ${Array(Math.max(0, 30 - invoice.products.length)).fill(0).map(() => `
                <tr class="empty-row">
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>

        <div class="total-section">
            <div class="total-box">
                <div class="total-row subtotal-row">
                    <span>المجموع الفرعي:</span>
                    <span>${formatCurrency(invoiceSubtotal)} ج.م</span>
                </div>
                ${invoiceTaxAmount > 0 ? `
                <div class="total-row">
                    <span>ضريبة القيمة المضافة (${toPersianNumerals(invoice.taxRate || 0)}%):</span>
                    <span>${formatCurrency(invoiceTaxAmount)} ج.م</span>
                </div>
                    ` : ''}
                ${invoiceShipping > 0 ? `
                <div class="total-row">
                    <span>الشحن والتوصيل:</span>
                    <span>${formatCurrency(invoiceShipping)} ج.م</span>
                </div>
                    ` : ''}
                    ${invoiceDiscount > 0 ? `
                <div class="total-row">
                    <span>الخصم:</span>
                    <span>- ${formatCurrency(invoiceDiscount)} ج.م</span>
            </div>
                    ` : ''}
                <div class="total-row grand-total highlighted">
                    <span>الإجمالي:</span>
                    <span>${formatCurrency(invoiceTotal)} ج.م</span>
            </div>
                    ${customer ? `
                <div class="total-row">
                    <span>الرصيد القديم:</span>
                    <span>${formatCurrency(oldBalance)} ج.م</span>
                </div>
                <div class="total-row old-balance-plus-total-row">
                    <span>القديم + الفاتورة:</span>
                    <span>${formatCurrency(oldBalancePlusTotal)} ج.م</span>
                </div>
                <div class="total-row paid-by-customer-row">
                    <span>المدفوع من العميل:</span>
                    <span>${formatCurrency(invoiceTotal - invoiceRemaining)} ج.م</span>
                </div>
                <div class="total-row new-balance">
                    <span>الرصيد الجديد:</span>
                    <span>${formatCurrency(newBalance)} ج.م</span>
                </div>
                ${shouldShowWarning ? `
                <div class="credit-warning" style="margin-top: 3px; padding: 3px; background: #fff3cd; border: 1.5px solid #ffc107; border-radius: 3px; font-size: 6px; line-height: 1.4; color: #000000; text-align: right; direction: rtl;">
                    <p style="margin: 0.8px 0; font-weight: 700; font-size: 7px; color: #856404;"><strong>تنويه:</strong></p>
                    <p style="margin: 0.5px 0; font-weight: 700; font-size: 6px;">نُلفت عنايتكم إلى أن الرصيد المستحق (الآجل) — باستثناء الفاتورة الحالية — قد تجاوز الحد الائتماني المسموح به (10,000 ج.م)، ولم يتم السداد حتى تاريخه.</p>
                    <p style="margin: 0.5px 0; font-weight: 700; font-size: 6px;">نرجو من سيادتكم تسوية الفاتورة الحالية بالكامل، والعمل على تنظيم سداد المبالغ المتأخرة حفاظًا على استمرار التعاون وضمان تقديم أفضل الخدمات لكم.</p>
                    <p style="margin: 0.5px 0; font-weight: 700; font-size: 6px;">شاكرين تفهمكم وتعاونكم الدائم.</p>
                    <p style="margin: 0.5px 0; font-weight: 700; font-size: 6px; text-align: left;">إدارة الشركة</p>
                </div>
                ` : ''}
                ` : ''}
                </div>
            </div>
        </div>
        
        <div class="signature-section">
            <div class="company-seal">
                <div class="company-seal-label" >ختم الشركة</div>
                <div class="company-seal-space"></div>
                ${companySettings.salesRepName || companySettings.salesRepPhone ? `
                <div style="margin-top: 5px; font-size: 7px !important; font-weight: bold !important; color: #2c3e50;">
                    <strong>المندوب:</strong> ${companySettings.salesRepName || ''}${companySettings.salesRepName && companySettings.salesRepPhone ? ' - ' : ''}${companySettings.salesRepPhone || ''}
                </div>
                ` : ''}
                ${companySettings.accountantName || companySettings.accountantPhone ? `
                <div style="margin-top: 3px; font-size: 7px !important; font-weight: bold !important; color: #2c3e50;">
                    <strong>المحاسب:</strong> ${companySettings.accountantName || ''}${companySettings.accountantName && companySettings.accountantPhone ? ' - ' : ''}${companySettings.accountantPhone || ''}
                </div>
                ` : ''}
            </div>
            <div class="customer-signature">
                <div class="customer-signature-label">توقيع المستلم</div>
                <div class="customer-signature-space"></div>
            </div>
        </div>
        
        <div class="footer">
            ${companySettings.commitmentText ? `<p style="font-size: 8px;font-weight: 700; line-height: 1.4; color: #000000;"><strong>${companySettings.commitmentText}</strong></p>` : '<span style="font-size: 8px;font-weight: 700; align-items: center; text-align: center; line-height: 1.4; color: #000000;">أقر بأنني قد استلمت البضاعة/الخدمة المبينة أعلاه بحالة جيدة وبمواصفات مطابقة، وأتعهد بالسداد وفق الشروط المذكورة.</span>'}
        </div>
        <div class="customer-notice" style="margin-top: 0.5px; padding: 0.5px; background: #fff9e6; border: 0.5px solid #ffd700; border-radius: 1px; font-size: 6px; line-height: 1.3; text-align: right; direction: rtl;">
            <p style="margin: 0.3px 0; font-weight: 700; color: #000000; white-space: nowrap;">يرجى مراجعة الفاتورة قبل مغادرة المندوب &nbsp; &nbsp; | &nbsp; &nbsp; لا يتم الاسترجاع إلا في وجود الفاتورة &nbsp; &nbsp; | &nbsp; &nbsp; لا يوجد مرتجع للمجمدات والفريشات</p>
            <p style="margin: 0.3px 0; font-weight: 700; color: #000000; text-align: center;">تسعدنا خدمتكم</p>
        </div>
    </div>
    </div>
</body>
</html>
    `;
        
        return printContent;
    } catch (error) {
        console.error('Error in generatePrintContent:', error);
        return '<html><body><h1>خطأ في إنشاء محتوى الطباعة</h1><p>' + error.message + '</p></body></html>';
    }
}

// Generate Cash Customer Invoice HTML (Half A4 Page)
function generateCashCustomerInvoiceHTML(invoice, companySettings, logoBase64, logoPath, customer = null) {
    console.log('[generateCashCustomerInvoiceHTML] Generating cash customer invoice HTML');
    // Helper functions
    const toPersianNumerals = (str) => {
        const persianDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
        return str.toString().replace(/\d/g, (digit) => persianDigits[parseInt(digit)]);
    };
    
    // Format currency - use English numerals, no commas, decimal point only if needed
    const formatCurrency = (amount) => {
        // Check if amount is a whole number
        const isWholeNumber = amount % 1 === 0;
        let formatted;
        if (isWholeNumber) {
            // No decimal places for whole numbers - use English numerals, no commas
            formatted = Math.round(amount).toString();
        } else {
            // Keep 2 decimal places for non-whole numbers - use English numerals, no commas
            formatted = amount.toFixed(2);
        }
        return formatted; // Return English numerals without Persian conversion
    };
    
    // Format quantity - use English numerals, decimal point only if needed
    const formatQuantity = (quantity) => {
        let formatted;
        if (quantity % 1 === 0) {
            // Integer, no decimal places - use English numerals
            formatted = quantity.toString();
        } else {
            // Decimal, show up to 2 decimal places - use English numerals
            formatted = quantity.toFixed(2).replace(/\.?0+$/, '');
        }
        return formatted; // Return English numerals without Persian conversion
    };
    
    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const formatted = date.toLocaleDateString('ar-EG');
        return toPersianNumerals(formatted);
    };
    
    const formatTime = (dateString) => {
        if (!dateString) {
            dateString = new Date().toISOString();
        }
        const date = new Date(dateString);
        
        let hours = date.getHours();
        let minutes = date.getMinutes();
        let seconds = date.getSeconds();
        
        const ampm = hours >= 12 ? 'مساءً' : 'صباحاً';
        
        // Convert to 12-hour format
        hours = hours % 12;
        hours = hours ? hours : 12; // 0 should be 12
        hours = String(hours).padStart(2, '0');
        minutes = String(minutes).padStart(2, '0');
        seconds = String(seconds).padStart(2, '0');
        
        const formattedTime = `${hours}:${minutes}:${seconds} ${ampm}`;
        return toPersianNumerals(formattedTime);
    };
    
    // Determine invoice type
    const invoiceType = invoice.status === 'delivered' ? 'فاتورة ضريبية' : 'فاتورة مبدئية';
    
    // Payment method text
    const paymentMethodText = {
        'cash': 'نقدًا',
        'vodafone_cash': 'فودافون كاش',
        'bank': 'تحويل بنكي',
        'visa': 'فيزا',
        'check': 'شيك',
        'wallet': 'محفظة إلكترونية'
    };
    const paymentMethod = paymentMethodText[invoice.paymentMethod] || 'نقدًا';
    
    // Calculate totals
    const subtotal = invoice.subtotal || 0;
    const taxAmount = invoice.taxAmount || 0;
    const discount = invoice.discount || 0;
    const shipping = invoice.shipping || 0;
    const total = invoice.total || 0;
    const paid = invoice.paid || 0;
    const remaining = invoice.remaining || 0;
    
    return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>فاتورة ${invoice.invoiceNumber}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        @page {
            size: A4;
            margin: 0;
        }
        body {
            font-family: 'Arial', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            direction: rtl;
            background: white;
            padding: 0;
            margin: 0;
        }
        .invoice-container {
            width: 50%;
            max-width: 105mm;
            margin: 0 auto;
            padding: 10mm;
            background: white;
            border: 1px solid #ddd;
            min-height: 148.5mm;
            position: relative;
        }
        .header {
            text-align: center;
            margin-bottom: 4mm;
            border-bottom: 2px solid #333;
            padding-bottom: 3mm;
        }
        .company-logo {
            width: 50px;
            height: 50px;
            object-fit: contain;
            margin-bottom: 5px;
        }
        .company-name {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 3px;
            color: #2c3e50;
        }
        .company-details {
            font-size: 10px;
            color: #666;
            line-height: 1.4;
            display: flex;
            justify-content: center;
            align-items: center;
            flex-wrap: wrap;
            gap: 5px;
        }
        .company-details div {
            display: inline;
        }
        .invoice-title {
            text-align: center;
            margin: 4mm 0;
            font-size: 20px;
            font-weight: bold;
            color: #2c3e50;
        }
        .invoice-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3mm;
            font-size: 11px;
            line-height: 1.8;
        }
        .invoice-info-left, .invoice-info-right {
            flex: 1;
        }
        .invoice-info-item {
            margin-bottom: 3px;
        }
        .invoice-info-label {
            font-weight: bold;
            color: #333;
        }
        .customer-section {
            background: #f8f9fa;
            padding: 3mm;
            border-radius: 4px;
            margin-bottom: 3mm;
            border: 1px solid #ddd;
        }
        .customer-section h3 {
            font-size: 11px;
            font-weight: bold;
            margin-bottom: 2px;
            color: #2c3e50;
        }
        .customer-info {
            font-size: 10px;
            line-height: 1.4;
        }
        .products-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 3mm;
            font-size: 10px;
        }
        .products-table th {
            background: #2c3e50;
            color: white;
            padding: 4px;
            text-align: center;
            font-weight: bold;
            border: 1px solid #ddd;
        }
        .products-table td {
            padding: 4px;
            text-align: center;
            border: 1px solid #ddd;
        }
        .products-table td:nth-child(2) {
            text-align: right;
        }
        .totals-section {
            margin-bottom: 3mm;
        }
        .total-row {
            display: flex;
            justify-content: space-between;
            padding: 3px 0;
            font-size: 11px;
            border-bottom: 1px solid #eee;
        }
        .total-row.grand-total {
            font-weight: bold;
            font-size: 13px;
            border-top: 2px solid #2c3e50;
            border-bottom: 2px solid #2c3e50;
            padding: 5px 0;
            margin-top: 3px;
        }
        .payment-section {
            background: #f8f9fa;
            padding: 3mm;
            border-radius: 4px;
            margin-bottom: 3mm;
            border: 1px solid #ddd;
            font-size: 10px;
        }
        .payment-section h4 {
            font-size: 11px;
            font-weight: bold;
            margin-bottom: 3px;
            color: #2c3e50;
        }
        .notes-section {
            margin-bottom: 3mm;
            font-size: 10px;
            line-height: 1.6;
            color: #666;
        }
        .footer {
            text-align: center;
            font-size: 9px;
            color: #999;
            border-top: 1px solid #ddd;
            padding-top: 2mm;
            margin-top: 3mm;
        }
        @media print {
            @page {
                size: A4;
                margin: 0;
            }
            body {
                padding: 0;
                margin: 0;
            }
            .invoice-container {
                width: 50%;
                max-width: 105mm;
                margin: 0;
                padding: 10mm;
                page-break-inside: avoid;
                break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <!-- Header: Company Info -->
        <div class="header">
            <img src="${logoBase64 || logoPath}" alt="Logo" class="company-logo" />
            <div class="company-details">
                <div>الشرقية - ههيا - المهدية</div>
                <div>|</div>
                <div>هاتف: 01015179727</div>
            </div>
        </div>
        
        <!-- Invoice Info -->
        <div class="invoice-info">
            <div class="invoice-info-left">
                <div class="invoice-info-item">
                    <span class="invoice-info-label">رقم الفاتورة:</span> ${invoice.invoiceNumber || '-'}
                </div>
                <div class="invoice-info-item" style="display: flex; justify-content: space-between; align-items: center;">
                    <span><span class="invoice-info-label">تاريخ الفاتورة:</span> ${formatDate(invoice.date)}</span>
                    <span style="margin-right: auto; margin-left: 20px;">${formatTime(new Date().toISOString())}</span>
                </div>
            </div>
        </div>
        
        <!-- Customer Section -->
        <div class="customer-section">
            <h3>بيانات العميل</h3>
            <div class="customer-info">
                <div><strong>اسم العميل:</strong> عميل نقدي</div>
                ${(customer && customer.phone) || invoice.customerPhone ? `<div><strong>رقم الهاتف:</strong> ${(customer && customer.phone) || invoice.customerPhone || ''}</div>` : ''}
            </div>
        </div>
        
        <!-- Products Table -->
        <table class="products-table">
            <thead>
                <tr>
                    <th style="width: 8%;">رقم</th>
                    <th style="width: 40%;">الوصف</th>
                    <th style="width: 15%;">الكمية</th>
                    <th style="width: 18%;">سعر الوحدة</th>
                    <th style="width: 19%;">الإجمالي</th>
                </tr>
            </thead>
            <tbody>
                ${invoice.products.map((product, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${product.productName || ''}${product.category ? ` - ${product.category}` : ''}</td>
                    <td>${formatQuantity(product.quantityInSmallestUnit || product.quantity || 0)} ${product.smallestUnit || product.unitName || ''}</td>
                    <td>${formatCurrency(product.price)} ج.م</td>
                    <td>${formatCurrency(product.total)} ج.م</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        
        <!-- Totals Section -->
        <div class="totals-section">
            <div class="total-row">
                <span>الإجمالي قبل الضريبة:</span>
                <span>${formatCurrency(subtotal)} ج.م</span>
            </div>
            ${discount > 0 ? `
            <div class="total-row">
                <span>إجمالي الخصومات:</span>
                <span>- ${formatCurrency(discount)} ج.م</span>
            </div>
            ` : ''}
            ${taxAmount > 0 ? `
            <div class="total-row">
                <span>إجمالي الضريبة (VAT):</span>
                <span>${formatCurrency(taxAmount)} ج.م</span>
            </div>
            ` : ''}
            ${shipping > 0 ? `
            <div class="total-row">
                <span>الشحن والتوصيل:</span>
                <span>${formatCurrency(shipping)} ج.م</span>
            </div>
            ` : ''}
            <div class="total-row grand-total">
                <span>الإجمالي النهائي المستحق:</span>
                <span>${formatCurrency(total)} ج.م</span>
            </div>
        </div>
        
        <!-- Payment Section -->
        <div class="payment-section">
            <div><strong>سياسة الإرجاع:</strong> لا يتم الاسترجاع الا في وجود الفاتورة ، لا يوجد مرتجع للمجمدات والفريشات</div>
        </div>
        
        <!-- Notes Section -->
        <div class="notes-section">
            <div style="margin-top: 2px; text-align: center; font-weight: bold;">تسعدنا خدمتكم</div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
            <div style="margin-bottom: 3px;"><strong>تم إصدار هذه الفاتورة إلكترونيًا، ولا تحتاج إلى توقيع</strong></div>
        </div>
    </div>
</body>
</html>
    `;
}

// Close Modal
async function closeModal() {
    document.getElementById('invoiceModal').classList.remove('active');
    currentInvoice = null;
    invoiceProducts = [];
    selectedDeliveryNote = null;
    
    // Remove stock info message
    removeStockInfoMessage();
    
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
        const modal = document.querySelector('.modal.active, [class*="modal"].active, #invoiceModal.active');
        if (modal) {
            const firstInput = modal.querySelector('input:not([type="hidden"]):not([readonly]), select, textarea');
            if (firstInput && !firstInput.disabled && !firstInput.readOnly) {
                firstInput.focus();
            }
        }
    }, 50);
}

// Update Status Dropdown Style based on value
function updateStatusDropdownStyle(selectElement) {
    if (!selectElement) return;
    
    // Remove existing status classes
    selectElement.classList.remove('status-pending', 'status-delivered', 'status-cancelled');
    
    // Add class based on current value
    const status = selectElement.value;
    if (status === 'pending') {
        selectElement.classList.add('status-pending');
    } else if (status === 'delivered') {
        selectElement.classList.add('status-delivered');
    } else if (status === 'cancelled') {
        selectElement.classList.add('status-cancelled');
    }
}

// Custom Prompt Dialog (replaces prompt() to avoid Electron issues)
function showPromptDialog(message, defaultValue = '', onConfirm, onCancel) {
    return new Promise((resolve, reject) => {
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
            if (onCancel) onCancel();
            resolve(null);
        });
        
        // Cancel button handler
        cancelBtn.addEventListener('click', () => {
            modal.remove();
            if (onCancel) onCancel();
            resolve(null);
        });
        
        // Confirm button handler
        confirmBtn.addEventListener('click', () => {
            const value = input.value.trim();
            modal.remove();
            if (onConfirm) onConfirm(value);
            resolve(value);
        });
        
        // Enter key handler
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmBtn.click();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelBtn.click();
            }
        });
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                if (onCancel) onCancel();
                resolve(null);
            }
        });
    });
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

// Delete Invoice
async function deleteInvoice(invoiceId) {
    console.log('🗑️ deleteInvoice called with invoiceId:', invoiceId);
    
    // Find invoice to check status
    let invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice && window.electronAPI && window.electronAPI.dbGet) {
        invoice = await window.electronAPI.dbGet('sales_invoices', invoiceId);
    }
    
    if (!invoice) {
        showMessage('الفاتورة غير موجودة', 'error');
        return;
    }
    
    // If invoice status is "delivered" (تم التسليم), show warning and don't delete
    if (invoice.status === 'delivered') {
        if (window.showToast) {
            window.showToast(
                '⚠️ لا يمكن حذف الفاتورة. الفاتورة بحالة "تم التسليم" وتُعتبر محفوظة نهائياً. لن يتم إرجاع رصيد الفاتورة للعميل أو المنتجات للمخزن.',
                'warning',
                5000
            );
        } else if (window.showMessage) {
            showMessage('⚠️ لا يمكن حذف الفاتورة. الفاتورة بحالة "تم التسليم" وتُعتبر محفوظة نهائياً. لن يتم إرجاع رصيد الفاتورة للعميل أو المنتجات للمخزن.', 'warning');
        }
        return;
    }
    
    // For pending invoices, proceed with deletion
    // Use custom confirmation dialog instead of confirm()
    showConfirmDialog(
        'هل أنت متأكد من حذف هذه الفاتورة؟\n\nسيتم حذف الفاتورة نهائياً وإعادة المخزون للمنتجات.',
        () => {
            // User confirmed - proceed with deletion
            console.log('✅ User confirmed deletion');
            proceedWithInvoiceDeletion(invoiceId);
        },
        () => {
            // User cancelled - do nothing
            console.log('❌ User cancelled deletion');
        }
    );
}

// Proceed with invoice deletion
async function proceedWithInvoiceDeletion(invoiceId) {
    try {
        // Find invoice
        let invoice = invoices.find(inv => inv.id === invoiceId);
        
        // If not found, load from database
        if (!invoice && window.electronAPI && window.electronAPI.dbGet) {
            invoice = await window.electronAPI.dbGet('sales_invoices', invoiceId);
        }
        
        if (!invoice) {
            showMessage('الفاتورة غير موجودة', 'error');
            return;
        }
        
        // Always load invoice items from database to ensure we have the latest data
        // This is important because products array in memory may not be up to date
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            const invoiceItems = await window.electronAPI.dbGetAll('sales_invoice_items', 'invoiceId = ?', [invoiceId]);
            invoice.products = [];
            for (const item of invoiceItems) {
                // Get product to calculate conversion factor
                const product = await window.electronAPI.dbGet('products', item.productId);
                let quantityInSmallestUnit = item.quantity || 0;
                
                // If unit was largest, convert to smallest
                if (item.unit === 'largest' && product) {
                    const conversionFactor = product.conversionFactor || 1;
                    quantityInSmallestUnit = item.quantity * conversionFactor;
                }
                
                invoice.products.push({
                    productId: item.productId,
                    productName: item.productName,
                    quantity: item.quantity || 0,
                    unit: item.unit || '',
                    quantityInSmallestUnit: quantityInSmallestUnit
                });
            }
        } else if (!invoice.products || invoice.products.length === 0) {
            // Fallback: if no products loaded and no database access, show error
            showMessage('لا يمكن تحميل منتجات الفاتورة', 'error');
            return;
        }
        
        console.log('[Sales] Deleting invoice:', invoiceId);
        console.log('[Sales] Invoice status:', invoice.status);
        console.log('[Sales] Invoice customerId:', invoice.customerId);
        console.log('[Sales] Invoice products count:', invoice.products ? invoice.products.length : 0);
        
        // Restore stock directly (no delivery note anymore)
        if (invoice.products && invoice.products.length > 0) {
            console.log('[Sales] Restoring stock directly...');
            for (const invoiceProduct of invoice.products) {
                // Get product from database
                let product = null;
                if (window.electronAPI && window.electronAPI.dbGet) {
                    product = await window.electronAPI.dbGet('products', invoiceProduct.productId);
                }
                
                if (product) {
                    // Calculate quantity to add back in smallest unit
                    let quantityToAdd = invoiceProduct.quantityInSmallestUnit || invoiceProduct.quantity;
                    
                    // If unit is largest, convert to smallest
                    if (invoiceProduct.unit === 'largest') {
                        const conversionFactor = product.conversionFactor || 1;
                        quantityToAdd = invoiceProduct.quantity * conversionFactor;
                    }
                    
                    // Restore stock
                    const currentStock = parseFloat(product.stock) || 0;
                    const newStock = currentStock + quantityToAdd;
                    
                    product.stock = newStock;
                    product.updatedAt = new Date().toISOString();
                    
                    // Update product in database
                    if (window.electronAPI && window.electronAPI.dbUpdate) {
                        await window.electronAPI.dbUpdate('products', product.id, product);
                        console.log(`[Sales] Restored product ${product.name} stock: ${currentStock} -> ${newStock} (+${quantityToAdd})`);
                    }
                    
                    // Update in local array too
                    const localProduct = products.find(p => p.id === product.id);
                    if (localProduct) {
                        localProduct.stock = newStock;
                    }
                }
            }
        }
        
        // Delete invoice items from database first (foreign key constraint)
        if (window.electronAPI && window.electronAPI.dbQuery) {
            await window.electronAPI.dbQuery('DELETE FROM sales_invoice_items WHERE invoiceId = ?', [invoiceId]);
        } else if (window.electronAPI && window.electronAPI.dbGetAll && window.electronAPI.dbDelete) {
            const invoiceItems = await window.electronAPI.dbGetAll('sales_invoice_items', 'invoiceId = ?', [invoiceId]);
            for (const item of invoiceItems) {
                await window.electronAPI.dbDelete('sales_invoice_items', item.id);
            }
        }
        
        // Delete invoice from database
        if (window.electronAPI && window.electronAPI.dbDelete) {
            await window.electronAPI.dbDelete('sales_invoices', invoiceId);
        }
        
        // Recalculate customer balance AFTER invoice deletion (for both pending and delivered)
        // Pending invoices are also included in customer balance, so we need to recalculate
        // IMPORTANT: Do this AFTER deleting from database so the invoice is not included in the calculation
        if (invoice.customerId) {
            console.log('[Sales] Recalculating customer balance after invoice deletion...');
            await recalculateCustomerBalance(invoice.customerId);
        }
        
        // Remove from local array
        invoices = invoices.filter(inv => inv.id !== invoiceId);
        
        // Save to localStorage
        await saveInvoices();
        
        // Re-apply filters and render
        applyFilters();
        
        // Dispatch events to update other screens
        if (invoice.products && invoice.products.length > 0) {
            const uniqueProductIds = [...new Set(invoice.products.map(p => p.productId))];
            uniqueProductIds.forEach(productId => {
                window.dispatchEvent(new CustomEvent('productStockUpdated', { 
                    detail: { productId: productId },
                    bubbles: true,
                    cancelable: true
                }));
            });
        }
        window.dispatchEvent(new CustomEvent('productsNeedRefresh', { bubbles: true }));
        
        showMessage('تم حذف الفاتورة بنجاح', 'success');
    } catch (error) {
        console.error('[Sales] Error deleting invoice:', error);
        showMessage('خطأ في حذف الفاتورة: ' + error.message, 'error');
    }
}

// Open Collection Journal
async function openCollectionJournal() {
    try {
        // Get all invoices with status "pending" (جاري التسليم)
        const pendingInvoices = invoices.filter(inv => inv.status === 'pending');
        
        if (pendingInvoices.length === 0) {
            showMessage('لا توجد فواتير بحالة جاري التسليم', 'info');
            return;
        }
        
        // Generate collection journal HTML
        const journalHTML = await generateCollectionJournalHTML(pendingInvoices);
        
        // Open in new window with print and save buttons
        const journalWindow = window.open('', '_blank');
        if (!journalWindow) {
            showMessage('يرجى السماح بالنوافذ المنبثقة', 'error');
            return;
        }
        
        journalWindow.document.write(journalHTML);
        journalWindow.document.close();
        
    } catch (error) {
        console.error('Error opening collection journal:', error);
        showMessage('خطأ في فتح يوميات التحصيل: ' + error.message, 'error');
    }
}

// Generate Collection Journal HTML
async function generateCollectionJournalHTML(pendingInvoices) {
    // Get company settings
    const companySettings = await getCompanySettings();
    
    // Get logo - all paths are local, no internet required
    let logoBase64 = '';
    let logoPath = 'assets/icon-asel.ico';
    
    try {
        // First try: Use electronAPI.getAssetPath (works in both dev and packaged mode)
        if (window.electronAPI && window.electronAPI.getAssetPath) {
            // Try to get SVG logo first
            const logoSvgResult = await window.electronAPI.getAssetPath('aseel_logo.svg');
            if (logoSvgResult && logoSvgResult.success) {
                try {
                    // Fetch from local file path (file:// URL)
                    const logoSvgResponse = await fetch(logoSvgResult.path);
                    if (logoSvgResponse && logoSvgResponse.ok) {
                        const logoSvg = await logoSvgResponse.text();
                        logoBase64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(logoSvg)));
                    }
                } catch (error) {
                    console.warn('Error fetching SVG logo from asset path:', error);
                }
            }
            
            // Fallback to ICO if SVG not found or failed
            if (!logoBase64) {
                const logoIcoResult = await window.electronAPI.getAssetPath('icon-asel.ico');
                if (logoIcoResult && logoIcoResult.success) {
                    try {
                        const logoIcoResponse = await fetch(logoIcoResult.path);
                        if (logoIcoResponse && logoIcoResponse.ok) {
                            const logoBlob = await logoIcoResponse.blob();
                            logoBase64 = await new Promise((resolve) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result);
                                reader.readAsDataURL(logoBlob);
                            });
                        }
                    } catch (error) {
                        console.warn('Error fetching ICO logo from asset path:', error);
                    }
                }
            }
        }
        
        // Fallback: try direct relative path (for development mode only)
        if (!logoBase64) {
            try {
                const logoSvgResponse = await fetch('assets/aseel_logo.svg');
                if (logoSvgResponse && logoSvgResponse.ok) {
                    const logoSvg = await logoSvgResponse.text();
                    logoBase64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(logoSvg)));
                } else {
                    const logoIcoResponse = await fetch('assets/icon-asel.ico');
                    if (logoIcoResponse && logoIcoResponse.ok) {
                        const logoBlob = await logoIcoResponse.blob();
                        logoBase64 = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.readAsDataURL(logoBlob);
                        });
                    }
                }
            } catch (error) {
                // Logo is optional, continue without it if loading fails
                console.warn('Error loading logo from relative path (logo is optional):', error);
            }
        }
    } catch (error) {
        // Logo is optional, continue without it if loading fails
        console.warn('Error loading logo (logo is optional):', error);
    }
    
    // Get company info
    const companyName = companySettings.name && companySettings.name.trim() ? companySettings.name : 'شركة أسيل';
    const companyAddress = companySettings.address && companySettings.address.trim() ? companySettings.address : '';
    const companyPhone = (companySettings.phone || companySettings.mobile || '').trim();
    
    // Get today's date
    const today = new Date();
    const collectionDate = today.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // Convert numbers to Persian/Arabic numerals
    const toPersianNumerals = (str) => {
        const persianDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
        return str.toString().replace(/\d/g, (digit) => persianDigits[parseInt(digit)]);
    };
    
    // Build table rows for invoices - only customer names, rest empty
    let invoiceRows = '';
    pendingInvoices.forEach((invoice, index) => {
        const customer = customers.find(c => c.id === invoice.customerId);
        const customerName = customer ? customer.name : 'غير محدد';
        
        invoiceRows += `
            <tr>
                <td style="text-align: center; padding: 8px; border: 1px solid #ddd;">${index + 1}</td>
                <td style="text-align: right; padding: 8px; border: 1px solid #ddd; font-weight: bold; font-size: 15px; color: #1a252f;"><strong>${customerName}</strong></td>
                <td style="text-align: center; padding: 8px; border: 1px solid #ddd;"></td>
                <td style="text-align: center; padding: 8px; border: 1px solid #ddd;"></td>
                <td style="text-align: left; padding: 8px; border: 1px solid #ddd;"></td>
                <td style="text-align: right; padding: 8px; border: 1px solid #ddd;"></td>
            </tr>
        `;
    });
    
    // Add empty rows (reserve rows) - add rows to reach total of 20 customers
    const totalRows = pendingInvoices.length;
    const targetRows = 20;
    const reserveRows = Math.max(0, targetRows - totalRows);
    for (let i = totalRows; i < totalRows + reserveRows; i++) {
        invoiceRows += `
            <tr>
                <td style="text-align: center; padding: 8px; border: 1px solid #ddd;">${toPersianNumerals(i + 1)}</td>
                <td style="text-align: right; padding: 8px; border: 1px solid #ddd;"></td>
                <td style="text-align: center; padding: 8px; border: 1px solid #ddd;"></td>
                <td style="text-align: center; padding: 8px; border: 1px solid #ddd;"></td>
                <td style="text-align: left; padding: 8px; border: 1px solid #ddd;"></td>
                <td style="text-align: right; padding: 8px; border: 1px solid #ddd;"></td>
            </tr>
        `;
    }
    
    // Build company header with logo
    const logoHTML = logoBase64 ? `<img src="${logoBase64}" alt="Logo" style="max-height: 60px; margin-bottom: 10px;">` : '';
    const companyHeaderHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 20px; margin-bottom: 20px;">
            ${logoHTML}
            <div style="text-align: center;">
                <h2 style="margin: 0; color: #2c3e50; font-size: 24px;">${companyName}</h2>
                ${companyAddress ? `<p style="margin: 5px 0; color: #555; font-size: 14px;">${companyAddress}</p>` : ''}
                ${companyPhone ? `<p style="margin: 5px 0; color: #555; font-size: 14px;">📞 ${companyPhone}</p>` : ''}
            </div>
        </div>
    `;
    
    return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>يوميات التحصيل</title>
    <style>
        @page {
            size: A4;
            margin: 0.8cm;
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Arial', 'Tahoma', sans-serif;
            direction: rtl;
            padding: 15px;
            background: white;
            color: #333;
            page-break-inside: avoid;
            position: relative;
        }
        .watermark {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }
        .watermark-text {
            font-size: 180px;
            font-weight: bold;
            color: rgba(44, 62, 80, 0.08);
            transform: rotate(-45deg);
            white-space: nowrap;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            letter-spacing: 30px;
        }
        .content-wrapper {
            position: relative;
            z-index: 2;
        }
        .action-buttons {
            position: fixed;
            top: 20px;
            left: 20px;
            display: flex;
            gap: 10px;
            z-index: 1000;
        }
        .action-buttons button {
            padding: 10px 20px;
            font-size: 16px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
            transition: all 0.3s;
        }
        .btn-print {
            background-color: #3498db;
            color: white;
        }
        .btn-print:hover {
            background-color: #2980b9;
        }
        .btn-save {
            background-color: #27ae60;
            color: white;
        }
        .btn-save:hover {
            background-color: #229954;
        }
        .company-header {
            text-align: center;
            margin-bottom: 15px;
            border-bottom: 2px solid #2c3e50;
            padding-bottom: 10px;
            page-break-inside: avoid;
        }
        .document-title {
            font-size: 22px;
            color: #2c3e50;
            margin: 10px 0;
            font-weight: bold;
        }
        .date-info {
            text-align: center;
            margin-bottom: 10px;
            font-size: 14px;
            color: #555;
        }
        .table-container {
            width: 100%;
            margin: 10px 0;
            page-break-inside: avoid;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
            page-break-inside: avoid;
        }
        thead {
            background-color: #2c3e50;
            color: white;
        }
        th {
            padding: 8px 6px;
            text-align: center;
            font-weight: bold;
            border: 1px solid #1a252f;
            font-size: 12px;
        }
        td {
            padding: 6px 4px;
            border: 1px solid #ddd;
            min-height: 25px;
            font-size: 11px;
        }
        tbody tr {
            page-break-inside: avoid;
            page-break-after: auto;
        }
        tbody tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        tbody td:nth-child(2) {
            font-weight: bold;
            font-size: 15px;
            color: #1a252f;
            background-color: #ffffff;
        }
        .signature-section {
            margin-top: 15px;
            display: flex;
            justify-content: space-between;
            padding-top: 15px;
            border-top: 2px solid #2c3e50;
            page-break-inside: avoid;
        }
        .signature-box {
            width: 200px;
            text-align: center;
        }
        .signature-label {
            font-weight: bold;
            margin-bottom: 40px;
            color: #2c3e50;
            font-size: 12px;
        }
        .signature-line {
            border-top: 1px solid #333;
            margin-top: 5px;
        }
        .release-text {
            margin-top: 10px;
            margin-bottom: 10px;
            text-align: right;
            padding: 0;
            page-break-inside: avoid;
        }
        .release-text p {
            margin: 0;
            font-size: 11px;
            color: #2c3e50;
            line-height: 1.5;
            font-weight: normal;
        }
        .toast {
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #333;
            color: white;
            padding: 15px 25px;
            border-radius: 5px;
            z-index: 10000;
            font-size: 16px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            display: none;
        }
        .toast.show {
            display: block;
            animation: slideIn 0.3s ease-out;
        }
        .toast.success {
            background-color: #27ae60;
        }
        .toast.error {
            background-color: #e74c3c;
        }
        .toast.info {
            background-color: #3498db;
        }
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateX(-50%) translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
        }
        @media print {
            body {
                padding: 0.5cm;
                margin: 0;
            }
            .watermark {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
            }
            .watermark-text {
                font-size: 220px;
                color: rgba(44, 62, 80, 0.06);
                letter-spacing: 40px;
            }
            .content-wrapper {
                position: relative;
                z-index: 2;
            }
            .no-print {
                display: none !important;
            }
            .action-buttons {
                display: none !important;
            }
            .company-header {
                margin-bottom: 10px;
                padding-bottom: 8px;
            }
            .table-container {
                margin: 5px 0;
            }
            table {
                margin-bottom: 5px;
            }
            th, td {
                padding: 5px 3px;
            }
            tbody td:nth-child(2) {
                font-weight: bold;
                font-size: 14px;
                color: #1a252f;
                background-color: #ffffff;
            }
            .signature-section {
                margin-top: 10px;
                padding-top: 10px;
            }
            .signature-label {
                margin-bottom: 30px;
            }
            .release-text {
                margin-top: 8px;
                margin-bottom: 8px;
            }
            * {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="watermark">
        <div class="watermark-text">شركة أسيل</div>
    </div>
    
    <div class="action-buttons no-print">
        <button class="btn-print" onclick="printJournal()">🖨️ طباعة</button>
        <button class="btn-save" onclick="saveJournal()">💾 حفظ</button>
    </div>
    
    <div class="toast" id="toast"></div>
    
    <div class="content-wrapper">
    <div class="company-header">
        ${companyHeaderHTML}
        <div class="document-title">يوميات التحصيل</div>
        <div class="date-info">
            <strong>تاريخ التحصيل:</strong> ${toPersianNumerals(collectionDate)}
        </div>
    </div>
    
    <div class="table-container">
        <table>
            <thead>
                <tr>
                    <th style="width: 5%;">م</th>
                    <th style="width: 25%;">العميل</th>
                    <th style="width: 15%;">طريقة الدفع</th>
                    <th style="width: 20%;">الموظف المستلم</th>
                    <th style="width: 15%;">المبلغ المستلم</th>
                    <th style="width: 20%;">ملاحظات</th>
                </tr>
            </thead>
            <tbody>
                ${invoiceRows}
            </tbody>
        </table>
    </div>
    
    <div class="release-text">
        <p>أقر أنا الموظف القائم بالتحصيل أنني قد استلمت المبالغ المذكورة أعلاه من العملاء وقمت بتحريرها في الفواتير أو سندات قبض في حالة عدم وجود فاتورة للعميل أثناء القبض.</p>
    </div>
    
    <div class="signature-section">
        <div class="signature-box">
            <div class="signature-label">توقيع الموظف القائم بالتحصيل</div>
            <div class="signature-line"></div>
        </div>
        <div class="signature-box">
            <div class="signature-label">توقيع المستلم منه</div>
            <div class="signature-line"></div>
        </div>
    </div>
    </div>
    
    <script>
        function showToast(message, type = 'info') {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.className = 'toast ' + type + ' show';
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }
        
        function printJournal() {
            window.print();
            showToast('جارٍ فتح نافذة الطباعة...', 'info');
        }
        
        async function saveJournal() {
            try {
                const htmlContent = document.documentElement.outerHTML;
                const today = new Date().toISOString().split('T')[0];
                const defaultFileName = 'يوميات_التحصيل_' + today + '.pdf';
                
                // Try to use parent window's electronAPI if available
                if (window.opener && window.opener.electronAPI && window.opener.electronAPI.saveInvoiceToFile) {
                    try {
                        const result = await window.opener.electronAPI.saveInvoiceToFile(htmlContent, defaultFileName);
                        if (result.success) {
                            showToast('تم حفظ يوميات التحصيل بنجاح', 'success');
                        } else if (result.cancelled) {
                            showToast('تم إلغاء الحفظ', 'info');
                        } else {
                            showToast('خطأ في حفظ الملف: ' + (result.error || 'خطأ غير معروف'), 'error');
                        }
                    } catch (error) {
                        console.error('Error saving:', error);
                        showToast('خطأ في حفظ الملف: ' + error.message, 'error');
                    }
                } else {
                    // Fallback: create blob and download
                    const blob = new Blob([htmlContent], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'يوميات_التحصيل_' + today + '.html';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    showToast('تم حفظ يوميات التحصيل بنجاح', 'success');
                }
            } catch (error) {
                console.error('Error saving journal:', error);
                showToast('خطأ في حفظ يوميات التحصيل: ' + error.message, 'error');
            }
        }
    </script>
</body>
</html>
    `;
}

// Save Collection Journal to Disk
async function saveCollectionJournalToDisk(journalHTML = null) {
    try {
        // If HTML not provided, generate it
        if (!journalHTML) {
            // Get all invoices with status "pending"
            const pendingInvoices = invoices.filter(inv => inv.status === 'pending');
            
            if (pendingInvoices.length === 0) {
                showMessage('لا توجد فواتير بحالة جاري التسليم', 'info');
                return;
            }
            
            // Generate collection journal HTML
            journalHTML = await generateCollectionJournalHTML(pendingInvoices);
        }
        
        // Generate default file name
        const today = new Date().toISOString().split('T')[0];
        const defaultFileName = `يوميات_التحصيل_${today}.pdf`;
        
        // Save to file using the same method as invoices
        if (window.electronAPI && window.electronAPI.saveInvoiceToFile) {
            try {
                const result = await window.electronAPI.saveInvoiceToFile(journalHTML, defaultFileName);
                
                if (result.success) {
                    showMessage(`تم حفظ يوميات التحصيل بنجاح في: ${result.filePath}`, 'success');
                } else if (result.cancelled) {
                    // User cancelled, do nothing
                } else {
                    console.error('Save failed:', result.error);
                    showMessage('خطأ في حفظ يوميات التحصيل: ' + (result.error || 'خطأ غير معروف'), 'error');
                }
            } catch (error) {
                console.error('Error saving collection journal to file:', error);
                showMessage('خطأ في حفظ يوميات التحصيل: ' + error.message, 'error');
            }
        } else {
            // Fallback: create blob and download
            const blob = new Blob([journalHTML], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `يوميات_التحصيل_${today}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showMessage('تم حفظ يوميات التحصيل بنجاح', 'success');
        }
    } catch (error) {
        console.error('Error saving collection journal:', error);
        showMessage('خطأ في حفظ يوميات التحصيل: ' + error.message, 'error');
    }
}

// Make functions global
window.removeProduct = removeProduct;
window.viewInvoice = viewInvoice;

window.editInvoice = editInvoice;
window.printInvoiceById = printInvoiceById;
window.deleteInvoice = deleteInvoice;
window.openCollectionJournal = openCollectionJournal;
window.saveCollectionJournalToDisk = saveCollectionJournalToDisk;
window.updateStatusDropdownStyle = updateStatusDropdownStyle;
window.recalculateCustomerBalance = recalculateCustomerBalance;

