// Purchase Invoices Management System

// Storage Keys
const STORAGE_KEYS = {
    INVOICES: 'asel_purchase_invoices',
    SUPPLIERS: 'asel_suppliers',
    PRODUCTS: 'asel_products',
    INVOICE_COUNTER: 'asel_purchase_invoice_counter'
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

// Alias for formatCurrency (for compatibility)
function formatCurrency(amount, currency = 'ج.م', decimals = 2) {
    return formatArabicCurrency(amount, currency, decimals);
}

// Initialize
let invoices = [];
let suppliers = [];
let products = [];
let invoiceProducts = [];
let currentInvoice = null;

// Pagination & Filter State
let currentPage = 1;
const itemsPerPage = 20;
let filteredInvoices = [];
let searchQuery = '';
let dateFrom = '';
let dateTo = '';
let sortBy = 'date-desc';
let totalInvoicesCount = 0; // Total count for pagination
let invoiceItemsCache = {}; // Cache for lazy loading invoice items
let useDatabasePagination = false; // Flag to enable database pagination for large datasets
let isSavingInvoice = false; // Flag to prevent duplicate form submissions

// Load data on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    initializeEventListeners();
    renderSuppliers();
    renderProducts();
    applyFilters();
    
    // Retry event listeners if button wasn't found initially
    setTimeout(() => {
        const newInvoiceBtn = document.getElementById('newInvoiceBtn');
        if (newInvoiceBtn && !newInvoiceBtn.hasAttribute('data-listener-attached')) {
            newInvoiceBtn.setAttribute('data-listener-attached', 'true');
            newInvoiceBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                    openNewInvoice();
                } catch (error) {
                    console.error('Error opening new invoice modal:', error);
                    alert('حدث خطأ أثناء فتح النافذة. يرجى المحاولة مرة أخرى.');
                }
            });
        }
    }, 500);
});

// Reload data when page becomes visible again (user returns to page)
document.addEventListener('visibilitychange', async () => {
    if (!document.hidden) {
        await loadData();
        renderSuppliers();
        renderProducts();
        applyFilters();
    }
});

// Also reload when page is shown (for browser back/forward navigation)
window.addEventListener('pageshow', async (event) => {
    if (event.persisted) {
        await loadData();
        renderSuppliers();
        renderProducts();
        applyFilters();
    }
});

// Reload when window gets focus (user switches back to app)
window.addEventListener('focus', async () => {
    await loadData();
    renderSuppliers();
    renderProducts();
    applyFilters();
});

// Initialize Event Listeners
function initializeEventListeners() {
    try {
        // New Invoice Button
        const newInvoiceBtn = document.getElementById('newInvoiceBtn');
        if (newInvoiceBtn) {
            // Remove existing listener if any
            const newBtn = newInvoiceBtn.cloneNode(true);
            newInvoiceBtn.parentNode.replaceChild(newBtn, newInvoiceBtn);
            
            newBtn.setAttribute('data-listener-attached', 'true');
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                    openNewInvoice();
                } catch (error) {
                    console.error('Error opening new invoice modal:', error);
                    if (window.showToast) {
                        window.showToast('حدث خطأ أثناء فتح النافذة. يرجى المحاولة مرة أخرى.', 'error');
                    } else {
                        alert('حدث خطأ أثناء فتح النافذة. يرجى المحاولة مرة أخرى.');
                    }
                }
            });
        } else {
            console.error('newInvoiceBtn not found!');
        }
        
        // Empty state button
        const emptyStateBtn = document.getElementById('emptyStateAddBtn');
        if (emptyStateBtn) {
            emptyStateBtn.addEventListener('click', () => {
                const btn = document.getElementById('newInvoiceBtn');
                if (btn) {
                    btn.click();
                }
            });
        }

        // Modal Close
        const closeModalBtn = document.getElementById('closeModal');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', closeModal);
        }
        
        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', closeModal);
        }

        // Form Submit
        const invoiceForm = document.getElementById('invoiceForm');
        if (invoiceForm) {
            invoiceForm.addEventListener('submit', handleFormSubmit);
        }

        // Add Product Button
        const addProductBtn = document.getElementById('addProductBtn');
        if (addProductBtn) {
            addProductBtn.addEventListener('click', addProductToInvoice);
        }

        // Supplier Selection
        const supplierSelect = document.getElementById('supplierSelect');
        if (supplierSelect) {
            supplierSelect.addEventListener('change', onSupplierChange);
        }

        // Calculate totals on change (tax rate is disabled, so no listener needed)
        const shippingEl = document.getElementById('shipping');
        if (shippingEl) {
            shippingEl.addEventListener('input', calculateTotals);
        }
        
        const discountEl = document.getElementById('discount');
        if (discountEl) {
            discountEl.addEventListener('input', calculateTotals);
        }
        
        const paidEl = document.getElementById('paid');
        if (paidEl) {
            paidEl.addEventListener('input', calculateTotals);
        }

        // Set due date based on invoice date
        const invoiceDateEl = document.getElementById('invoiceDate');
        if (invoiceDateEl) {
            invoiceDateEl.addEventListener('change', setDueDate);
        }

        // Product Unit Change - Update price automatically
        const productUnitSelect = document.getElementById('productUnit');
        if (productUnitSelect) {
            productUnitSelect.addEventListener('change', updatePriceOnUnitChange);
        }

        // Prevent selecting due date before invoice date
        const dueDateEl = document.getElementById('dueDate');
        if (dueDateEl) {
            dueDateEl.addEventListener('change', (e) => {
                const invoiceDate = document.getElementById('invoiceDate').value;
                if (invoiceDate && e.target.value) {
                    const invoiceDateObj = new Date(invoiceDate);
                    const dueDateObj = new Date(e.target.value);
                    invoiceDateObj.setHours(0, 0, 0, 0);
                    dueDateObj.setHours(0, 0, 0, 0);
                    
                    if (dueDateObj < invoiceDateObj) {
                        showMessage('لا يمكن أن يكون تاريخ الاستحقاق قبل تاريخ الفاتورة. سيتم تعيين تاريخ الفاتورة', 'warning');
                        e.target.value = invoiceDate;
                    }
                }
            });
        }

        // Print Button
        const printBtnEl = document.getElementById('printBtn');
        if (printBtnEl) {
            printBtnEl.addEventListener('click', printInvoice);
        }

        // Close modal on backdrop click
        const invoiceModalEl = document.getElementById('invoiceModal');
        if (invoiceModalEl) {
            invoiceModalEl.addEventListener('click', (e) => {
                if (e.target.id === 'invoiceModal') {
                    closeModal();
                }
            });
        }

        // Set today's date as default
        const today = new Date().toISOString().split('T')[0];
        if (invoiceDateEl) {
            invoiceDateEl.value = today;
            setDueDate();
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
        
        // Search & Filter Event Listeners
        const searchInput = document.getElementById('searchInput');
        const clearSearchBtn = document.getElementById('clearSearchBtn');
        const dateFromInput = document.getElementById('dateFrom');
        const dateToInput = document.getElementById('dateTo');
        const sortBySelect = document.getElementById('sortBy');
        const clearFiltersBtn = document.getElementById('clearFiltersBtn');
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value.trim();
                currentPage = 1;
                applyFilters();
            });
        }
        
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                if (searchInput) {
                    searchInput.value = '';
                    searchQuery = '';
                    currentPage = 1;
                    applyFilters();
                }
            });
        }
        
        if (dateFromInput) {
            dateFromInput.addEventListener('change', (e) => {
                dateFrom = e.target.value;
                currentPage = 1;
                applyFilters();
            });
        }
        
        if (dateToInput) {
            dateToInput.addEventListener('change', (e) => {
                dateTo = e.target.value;
                currentPage = 1;
                applyFilters();
            });
        }
        
        if (sortBySelect) {
            sortBySelect.addEventListener('change', (e) => {
                sortBy = e.target.value;
                currentPage = 1;
                applyFilters();
            });
        }
        
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                if (searchInput) searchInput.value = '';
                if (dateFromInput) dateFromInput.value = '';
                if (dateToInput) dateToInput.value = '';
                if (sortBySelect) sortBySelect.value = 'date-desc';
                searchQuery = '';
                dateFrom = '';
                dateTo = '';
                sortBy = 'date-desc';
                currentPage = 1;
                applyFilters();
            });
        }
        
        // Set tax rate to 0 for purchase invoices (no VAT)
        const taxRateEl = document.getElementById('taxRate');
        if (taxRateEl) {
            taxRateEl.value = 0;
        }
    } catch (error) {
        console.error('Error initializing event listeners:', error);
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
    // Set min attribute to prevent selecting due date before invoice date
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
                // Map database fields to expected format - handle null/undefined values
                const settings = {
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
                
                return settings;
            } else {
                console.warn('No company info found in database');
            }
        } else {
            console.warn('Database API not available');
        }
        
        // Fallback to localStorage
        const stored = localStorage.getItem('asel_company_settings');
        if (stored) {
            const parsed = JSON.parse(stored);
            return parsed;
        }
        
        console.warn('No company settings found, returning empty object');
        return {};
    } catch (error) {
        console.error('Error getting company settings:', error);
        return {};
    }
}

// Load Data
// Load invoices with pagination from database
async function loadInvoicesPage(page = 1, limit = 20, filters = {}) {
    if (!window.electronAPI || !window.electronAPI.dbQuery) {
        return { invoices: [], total: 0 };
    }
    
    const offset = (page - 1) * limit;
    let query = 'SELECT * FROM purchase_invoices';
    let params = [];
    
    // Build WHERE clause with filters
    const conditions = [];
    
    // Exclude reverse invoices from main view unless searching
    // If there's a search query, show all invoices (including reverse)
    // Otherwise, only show normal invoices
    if (!filters.searchQuery) {
        conditions.push("(invoiceType IS NULL OR invoiceType = 'normal' OR invoiceType = '')");
    }
    
    if (filters.dateFrom) {
        conditions.push('date >= ?');
        params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
        conditions.push('date <= ?');
        params.push(filters.dateTo + ' 23:59:59');
    }
    if (filters.supplierId) {
        conditions.push('supplierId = ?');
        params.push(filters.supplierId);
    }
    if (filters.searchQuery) {
        conditions.push('(invoiceNumber LIKE ? OR id IN (SELECT id FROM purchase_invoices pi INNER JOIN suppliers s ON pi.supplierId = s.id WHERE s.name LIKE ?))');
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
    let countQuery = 'SELECT COUNT(*) as count FROM purchase_invoices';
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
    
    let query = 'SELECT COUNT(*) as count FROM purchase_invoices';
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
    if (filters.supplierId) {
        conditions.push('supplierId = ?');
        params.push(filters.supplierId);
    }
    if (filters.searchQuery) {
        conditions.push('(invoiceNumber LIKE ? OR id IN (SELECT id FROM purchase_invoices pi INNER JOIN suppliers s ON pi.supplierId = s.id WHERE s.name LIKE ?))');
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
                'purchase_invoice_items', 
                'invoiceId = ?', 
                [invoiceId]
            ) || [];
            
            // Cache the items
            invoiceItemsCache[invoiceId] = items.map(item => {
                // Get product code and category from item or products array
                let productCode = item.productCode || '';
                let productCategory = item.category || '';
                if (item.productId) {
                    const productData = products.find(p => p.id === item.productId);
                    if (productData) {
                        if (!productCode) productCode = productData.code || '';
                        if (!productCategory) productCategory = productData.category || '';
                    }
                }
                return {
                    productId: item.productId,
                    productName: item.productName,
                    productCode: productCode,
                    category: productCategory,
                    quantity: item.quantity || 0,
                    unit: item.unit || '',
                    unitName: item.unitName || item.unit || '',
                    price: item.price || 0,
                    total: item.total || 0
                };
            });
            
            return invoiceItemsCache[invoiceId];
        } catch (error) {
            console.error(`Error loading items for invoice ${invoiceId}:`, error);
            return [];
        }
    }
    
    return [];
}

async function loadData() {
    // Try to load from database first
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            // Always reload suppliers and products first
            suppliers = await window.electronAPI.dbGetAll('suppliers', '', []);
            products = await window.electronAPI.dbGetAll('products', '', []);
            
            // Ensure arrays
            suppliers = Array.isArray(suppliers) ? suppliers : [];
            products = Array.isArray(products) ? products : [];
            
            // Check if we should use database pagination (for large datasets and weak devices)
            // Load a sample to check dataset size
            const sampleCount = await getInvoicesCount({});
            
            // Use database pagination if we have more than 200 invoices (lowered for weak devices)
            // This prevents loading too much data into memory on weak devices
            if (sampleCount > 200) {
                useDatabasePagination = true;
                console.log('[Purchases] Using database pagination for dataset:', sampleCount, 'invoices');
                
                // For pagination mode, don't load all invoices here
                // They will be loaded in applyFilters() based on current filters
                invoices = [];
                totalInvoicesCount = sampleCount;
            } else {
                // Load all invoices for small datasets (only if less than 200)
                useDatabasePagination = false;
                invoices = await window.electronAPI.dbGetAll('purchase_invoices', '', []);
                totalInvoicesCount = invoices.length;
                console.log('[Purchases] Loaded all', invoices.length, 'invoices (small dataset)');
                
                // Ensure invoices is an array
                invoices = Array.isArray(invoices) ? invoices : [];
                
                // Initialize products array for loaded invoices
                for (let invoice of invoices) {
                    if (!invoice.products) {
                        invoice.products = [];
                    }
                }
            }
            
            // Clear invoice items cache when reloading data
            invoiceItemsCache = {};
            
            return;
        } catch (error) {
            console.error('Error loading from database:', error);
            console.error('Error details:', error.message, error.stack);
            // Reset to non-pagination mode on error
            useDatabasePagination = false;
        }
    } else {
        console.warn('Database API not available, using localStorage fallback');
        useDatabasePagination = false;
    }
    
    // Fallback to localStorage (for migration only)
    const invoicesData = localStorage.getItem(STORAGE_KEYS.INVOICES);
    const suppliersData = localStorage.getItem(STORAGE_KEYS.SUPPLIERS);
    const productsData = localStorage.getItem(STORAGE_KEYS.PRODUCTS);

    invoices = invoicesData ? JSON.parse(invoicesData) : [];
    suppliers = suppliersData ? JSON.parse(suppliersData) : [];
    products = productsData ? JSON.parse(productsData) : [];
    
    // Ensure arrays
    invoices = Array.isArray(invoices) ? invoices : [];
    suppliers = Array.isArray(suppliers) ? suppliers : [];
    products = Array.isArray(products) ? products : [];
}

// Save Invoices
function saveInvoices() {
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));
}

// Generate Invoice Number
async function generateInvoiceNumber() {
    const year = new Date().getFullYear();
    const prefix = `PUR-${year}-`;
    
    // Try to get counter from database first (more reliable)
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            // Get all invoices from database
            const allInvoices = await window.electronAPI.dbGetAll('purchase_invoices', '', []);
            
            if (allInvoices && allInvoices.length > 0) {
                // Filter invoices with numbers matching current year pattern
                const currentYearNumbers = allInvoices
                    .map(invoice => invoice.invoiceNumber)
                    .filter(number => number && number.startsWith(prefix));
                
                // Extract numbers from invoice numbers (e.g., "PUR-2025-001" -> 1)
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

// Render Suppliers
function renderSuppliers() {
    const select = document.getElementById('supplierSelect');
    select.innerHTML = '<option value="" disabled selected>اختر المورد</option>';
    
    const activeSuppliers = suppliers.filter(s => s.status === 'active' || !s.status);
    // Sort suppliers by name for better UX
    const sortedSuppliers = [...activeSuppliers].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    
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

// Render Products (for searchable dropdown)
function renderProducts() {
    // Products are stored in global array, filtering will be done in search
    // Setup product search after products are loaded
    if (products && products.length > 0) {
        setupProductSearch();
    } else {
        // If products not loaded yet, try again after a short delay
        setTimeout(() => {
            if (products && products.length > 0) {
                setupProductSearch();
            }
        }, 100);
    }
}

// Setup Product Search
function setupProductSearch() {
    const searchInput = document.getElementById('productSearch');
    const hiddenInput = document.getElementById('productSelect');
    const dropdown = document.getElementById('productDropdown');
    let selectedProduct = null;
    
    if (!searchInput) return;
    
    // Filter products based on search
    function filterProducts(searchTerm) {
        const activeProducts = products.filter(p => p.status === 'active' || !p.status);
        
        if (!searchTerm || searchTerm.trim() === '') {
            return activeProducts.slice(0, 10); // Show first 10 if no search
        }
        
        const term = searchTerm.toLowerCase().trim();
        return activeProducts.filter(product => {
            const name = (product.name || '').toLowerCase();
            const category = (product.category || '').toLowerCase();
            const code = (product.code || '').toLowerCase();
            return name.includes(term) || category.includes(term) || code.includes(term);
        }).slice(0, 20); // Limit to 20 results
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
                searchInput.value = `${product.name} - ${product.category || 'غير محدد'}`;
                hiddenInput.value = product.id;
                dropdown.classList.remove('active');
                // Auto-fill price based on current unit selection
                const unitSelect = document.getElementById('productUnit');
                const priceInput = document.getElementById('productPrice');
                if (priceInput) {
                    const currentUnit = unitSelect ? unitSelect.value : 'smallest';
                    if (currentUnit === 'smallest') {
                        priceInput.value = product.priceSmallestUnit || product.smallestPrice || 0;
                    } else {
                        priceInput.value = product.priceLargestUnit || product.largestPrice || 0;
                    }
                }
                // Trigger quantity focus
                document.getElementById('productQuantity')?.focus();
            });
            dropdown.appendChild(item);
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
    
    // Handle keyboard navigation
    searchInput.addEventListener('keydown', (e) => {
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

// Open New Invoice
function openNewInvoice() {
    try {
        currentInvoice = null;
        invoiceProducts = [];
        
        // Get elements with null checks
        const isEditEl = document.getElementById('isEdit');
        const invoiceIdEl = document.getElementById('invoiceId');
        const modalTitleEl = document.getElementById('modalTitle');
        const invoiceFormEl = document.getElementById('invoiceForm');
        const invoiceProductsBodyEl = document.getElementById('invoiceProductsBody');
        const supplierInfoEl = document.getElementById('supplierInfo');
        const printBtnEl = document.getElementById('printBtn');
        const invoiceDateEl = document.getElementById('invoiceDate');
        const paymentMethodEl = document.getElementById('paymentMethod');
        const invoiceStatusEl = document.getElementById('invoiceStatus');
        const taxRateEl = document.getElementById('taxRate');
        const invoiceModalEl = document.getElementById('invoiceModal');
        
        if (!invoiceModalEl) {
            console.error('invoiceModal element not found!');
            alert('خطأ: لا يمكن العثور على نافذة الفاتورة. يرجى تحديث الصفحة.');
            return;
        }
        
        if (isEditEl) isEditEl.value = 'false';
        if (invoiceIdEl) invoiceIdEl.value = '';
        if (modalTitleEl) modalTitleEl.textContent = 'فاتورة مشتريات جديدة';
        if (invoiceFormEl) invoiceFormEl.reset();
        if (invoiceProductsBodyEl) invoiceProductsBodyEl.innerHTML = '';
        if (supplierInfoEl) supplierInfoEl.classList.add('hidden');
        if (printBtnEl) printBtnEl.style.display = 'none';
        
        const today = new Date().toISOString().split('T')[0];
        if (invoiceDateEl) invoiceDateEl.value = today;
        setDueDate();
        if (paymentMethodEl) paymentMethodEl.value = 'cash';
        
        // Set tax rate to 0 for purchase invoices (no VAT)
        if (taxRateEl) taxRateEl.value = 0;
        
        // Reset product search
        const productSearch = document.getElementById('productSearch');
        const productSelect = document.getElementById('productSelect');
        const productDropdown = document.getElementById('productDropdown');
        if (productSearch) productSearch.value = '';
        if (productSelect) productSelect.value = '';
        if (productDropdown) productDropdown.classList.remove('active');
        
        // Setup product search when modal opens
        try {
            setupProductSearch();
        } catch (error) {
            console.error('Error setting up product search:', error);
        }
        
        try {
            calculateTotals();
        } catch (error) {
            console.error('Error calculating totals:', error);
        }
        
        invoiceModalEl.classList.add('active');
        
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
    } catch (error) {
        console.error('Error in openNewInvoice:', error);
        alert('حدث خطأ أثناء فتح نافذة الفاتورة: ' + error.message);
    }
}

// On Supplier Change
async function onSupplierChange() {
    const supplierId = document.getElementById('supplierSelect').value;
    if (!supplierId) {
        document.getElementById('supplierInfo').classList.add('hidden');
        // Hide balance rows when no supplier selected
        document.getElementById('newBalanceRow').style.display = 'none';
        document.getElementById('finalBalanceRow').style.display = 'none';
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
                        console.log('[Purchases] onSupplierChange - Reloaded supplier from database, balance:', dbSupplier.balance);
                    }
                }
            } catch (error) {
                console.error('[Purchases] Error reloading supplier from database:', error);
                // Continue with local supplier data if database reload fails
            }
        }
        
        document.getElementById('supplierInfo').classList.remove('hidden');
        await calculateTotals();
    }
}

// Update price when unit changes
function updatePriceOnUnitChange() {
    const productSelect = document.getElementById('productSelect');
    const unitSelect = document.getElementById('productUnit');
    const priceInput = document.getElementById('productPrice');
    
    if (!productSelect || !productSelect.value || !unitSelect || !priceInput) {
        return;
    }
    
    // Get product from products array
    const productData = products.find(p => p.id === productSelect.value);
    if (!productData) {
        return;
    }
    
    const unit = unitSelect.value;
    
    // Update price based on unit
    if (unit === 'smallest') {
        // Use smallest unit price
        priceInput.value = productData.priceSmallestUnit || productData.smallestPrice || 0;
    } else {
        // Use largest unit price
        priceInput.value = productData.priceLargestUnit || productData.largestPrice || 0;
    }
}

// Add Product to Invoice
function addProductToInvoice() {
    const productSelect = document.getElementById('productSelect');
    const quantityInput = document.getElementById('productQuantity');
    const unitSelect = document.getElementById('productUnit');
    const priceInput = document.getElementById('productPrice');

    if (!productSelect || !productSelect.value) {
        showMessage('يرجى اختيار منتج أولاً', 'error');
        return;
    }

    if (!quantityInput || !quantityInput.value) {
        showMessage('يرجى إدخال الكمية', 'error');
        return;
    }

    if (!priceInput || !priceInput.value) {
        showMessage('يرجى إدخال السعر', 'error');
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

    const invoiceProduct = {
        productId: productData.id,
        productName: productData.name,
        productCode: productData.code,
        category: productData.category || '',
        quantity: quantity,
        unit: unit,
        unitName: unit === 'smallest' ? productData.smallestUnit : productData.largestUnit,
        price: price,
        total: quantity * price
    };

    invoiceProducts.push(invoiceProduct);
    renderInvoiceProducts();
    calculateTotals();

    // Reset inputs
    productSelect.value = '';
    document.getElementById('productSearch').value = '';
    quantityInput.value = '';
    priceInput.value = '';
    unitSelect.value = 'smallest';
    document.getElementById('productDropdown').classList.remove('active');
}

// Remove Product from Invoice
function removeProduct(index) {
    invoiceProducts.splice(index, 1);
    renderInvoiceProducts();
    calculateTotals();
}

// Render Invoice Products
function renderInvoiceProducts() {
    const tbody = document.getElementById('invoiceProductsBody');
    if (!tbody) return;
    
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
                <span class="unit-badge">${product.unitName || ''}</span>
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

// Calculate Totals with debouncing to prevent excessive calls
let calculateTotalsTimeout = null;
async function calculateTotals() {
    // Clear existing timeout
    if (calculateTotalsTimeout) {
        clearTimeout(calculateTotalsTimeout);
    }
    
    // Debounce: wait 100ms before executing
    return new Promise((resolve) => {
        calculateTotalsTimeout = setTimeout(async () => {
            await calculateTotalsInternal();
            resolve();
        }, 100);
    });
}

// Internal function that does the actual calculation
async function calculateTotalsInternal() {
    const subtotal = invoiceProducts.reduce((sum, p) => sum + p.total, 0);
    // Tax is always 0 for purchase invoices (no VAT)
    const taxRate = 0;
    const taxAmount = 0;
    const shipping = parseFloat(document.getElementById('shipping').value) || 0;
    const discount = parseFloat(document.getElementById('discount').value) || 0;
    const total = subtotal + taxAmount + shipping - discount;
    const paid = parseFloat(document.getElementById('paid').value) || 0;
    const remainingFromInvoice = total - paid; // المتبقي من الفاتورة فقط

    document.getElementById('subtotal').textContent = `${subtotal.toFixed(2)} ج.م`;
    document.getElementById('taxAmount').textContent = `${taxAmount.toFixed(2)} ج.م`;
    document.getElementById('total').textContent = `${total.toFixed(2)} ج.م`;

    // Show balance info if supplier selected
    const supplierId = document.getElementById('supplierSelect').value;
    
    if (supplierId) {
        const supplier = suppliers.find(s => s.id === supplierId);
        if (supplier) {
            // Load supplier data fresh from database first to get latest firstTransactionDate
            let supplierData = supplier;
            if (window.electronAPI && window.electronAPI.dbGet) {
                try {
                    const dbSupplier = await window.electronAPI.dbGet('suppliers', supplierId);
                    if (dbSupplier) {
                        supplierData = dbSupplier;
                        // Update local supplier object and array
                        Object.assign(supplier, dbSupplier);
                        const supplierIndex = suppliers.findIndex(s => s.id === supplierId);
                        if (supplierIndex !== -1) {
                            suppliers[supplierIndex] = { ...suppliers[supplierIndex], ...dbSupplier };
                        }
                    }
                } catch (error) {
                    console.error('Error loading supplier from database:', error);
                    // Use local supplier if database load fails
                }
            }
            
            // Update first transaction date BEFORE recalculating balance
            // This ensures firstTransactionDate is set if there are any transactions
            if (window.electronAPI && updateSupplierFirstTransactionDate) {
                try {
                    await updateSupplierFirstTransactionDate(supplierId);
                    // Reload supplier after updating first transaction date
                    if (window.electronAPI && window.electronAPI.dbGet) {
                        try {
                            const dbSupplier = await window.electronAPI.dbGet('suppliers', supplierId);
                            if (dbSupplier) {
                                supplierData = dbSupplier;
                                Object.assign(supplier, dbSupplier);
                            }
                        } catch (error) {
                            console.error('Error reloading supplier after updating firstTransactionDate:', error);
                        }
                    }
                } catch (error) {
                    console.error('Error updating first transaction date:', error);
                }
            }
            
            // Balance is now updated directly by transactions, no need to recalculate
            
            // الرصيد القديم = الرصيد الحالي من قاعدة البيانات مباشرة (تم إعادة تحميله أعلاه)
            // الرصيد في قاعدة البيانات محفوظ بالجنيه المصري مباشرة
            let oldBalance = parseFloat(supplierData.balance || 0);
            
            // عند تعديل فاتورة موجودة: إضافة المتبقي القديم للفاتورة لإرجاع الرصيد إلى ما كان عليه قبل هذه الفاتورة
            if (currentInvoice && currentInvoice.id && currentInvoice.supplierId === supplierId) {
                try {
                    // المتبقي في قاعدة البيانات محفوظ بالجنيه المصري مباشرة
                    const oldInvoiceRemaining = parseFloat(currentInvoice.remaining || 0);
                    oldBalance = oldBalance + oldInvoiceRemaining;
                    console.log('[Purchases] calculateTotals - Editing invoice: Added back old invoice remaining to get balance before this invoice:', {
                        currentBalance: parseFloat(supplierData.balance || 0),
                        oldInvoiceRemaining,
                        calculatedOldBalance: oldBalance
                    });
                } catch (error) {
                    console.error('[Purchases] Error getting old invoice remaining in calculateTotals:', error);
                    // Continue with current balance if error
                }
            }
            
            console.log('[Purchases] calculateTotals - Using updated balance from database:', {
                supplierId,
                oldBalance,
                isEdit: !!(currentInvoice && currentInvoice.id)
            });
            
            // الرصيد الجديد = الرصيد القديم + المتبقي (remaining)
            // المتبقي = الإجمالي - المدفوع
            // إذن: الرصيد الجديد = الرصيد القديم + (الإجمالي - المدفوع)
            const newBalance = oldBalance + remainingFromInvoice;
            
            console.log('[Purchases] calculateTotals - Balance calculation:', {
                                oldBalance,
                remainingFromInvoice,
                newBalance,
                calculation: `${oldBalance} + ${remainingFromInvoice} = ${newBalance}`
            });
            
            // المتبقي المعروض = المتبقي من الفاتورة فقط
            const remaining = remainingFromInvoice;
            
            document.getElementById('remaining').textContent = `${remaining.toFixed(2)} ج.م`;
            document.getElementById('oldBalanceDisplay').textContent = `${oldBalance.toFixed(2)} ج.م`;
            document.getElementById('newBalanceDisplay').textContent = `${newBalance.toFixed(2)} ج.م`;
            document.getElementById('newBalanceRow').style.display = 'flex';
            document.getElementById('finalBalanceRow').style.display = 'flex';
            
            // Also update oldBalance in supplier info section
            const oldBalanceElement = document.getElementById('oldBalance');
            if (oldBalanceElement) {
                oldBalanceElement.textContent = `${oldBalance.toFixed(2)} ج.م`;
            }
        } else {
            // If supplier not found, show only invoice remaining
            document.getElementById('remaining').textContent = `${remainingFromInvoice.toFixed(2)} ج.م`;
            document.getElementById('newBalanceRow').style.display = 'none';
            document.getElementById('finalBalanceRow').style.display = 'none';
        }
    } else {
        // If no supplier selected, show only invoice remaining
        document.getElementById('remaining').textContent = `${remainingFromInvoice.toFixed(2)} ج.م`;
        document.getElementById('newBalanceRow').style.display = 'none';
        document.getElementById('finalBalanceRow').style.display = 'none';
    }
}

// Handle Form Submit
async function handleFormSubmit(e) {
    e.preventDefault();
    
    // منع الضغط المتكرر
    if (isSavingInvoice) {
        console.log('[Purchases] Save already in progress, ignoring duplicate submit');
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
        const supplierId = document.getElementById('supplierSelect').value;
    const date = document.getElementById('invoiceDate').value;
    let dueDate = document.getElementById('dueDate').value;
    const paymentMethod = document.getElementById('paymentMethod').value;
    
    // Validate that due date is not before invoice date
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
    // Tax is always 0 for purchase invoices (no VAT)
    const taxRate = 0;
    const shipping = parseFloat(document.getElementById('shipping').value) || 0;
    const discount = parseFloat(document.getElementById('discount').value) || 0;
    const paid = parseFloat(document.getElementById('paid').value) || 0;

    if (!supplierId) {
        showMessage('يرجى اختيار المورد', 'error');
        isSavingInvoice = false;
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
        return;
    }

    if (invoiceProducts.length === 0) {
        showMessage('يرجى إضافة منتجات للفاتورة', 'error');
        isSavingInvoice = false;
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
        return;
    }
    
    const subtotal = invoiceProducts.reduce((sum, p) => sum + p.total, 0);
    const taxAmount = 0;
    const total = subtotal + taxAmount + shipping - discount;
    const remaining = total - paid;

    const invoiceId = currentInvoice ? currentInvoice.id : Date.now().toString();

    const notesElement = document.getElementById('notes');
    const notes = notesElement ? notesElement.value.trim() || '' : '';
    
    // Preserve invoiceType when editing, set to 'normal' for new invoices
    const invoiceType = currentInvoice ? (currentInvoice.invoiceType || 'normal') : 'normal';
    
    // Get current user for createdBy field
    const currentUser = localStorage.getItem('asel_user') || localStorage.getItem('asel_userId') || '';
    
    // Calculate old balance for saving (to preserve it at invoice creation time)
    // الرصيد القديم = الرصيد الحالي من قاعدة البيانات (يُحفظ في عمود oldBalance في الفاتورة)
    let oldBalanceToSave = null;
    const selectedSupplier = suppliers.find(s => s.id === supplierId);
    if (!selectedSupplier) {
        console.error('[Purchases] selectedSupplier is undefined when calculating old balance');
        showMessage('خطأ: المورد غير موجود', 'error');
        isSavingInvoice = false;
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
        return;
    }
    
    // إعادة تحميل المورد من قاعدة البيانات للحصول على الرصيد الحالي المحدث
    let supplierForBalance = selectedSupplier;
    if (window.electronAPI && window.electronAPI.dbGet) {
        try {
            const dbSupplier = await window.electronAPI.dbGet('suppliers', supplierId);
            if (dbSupplier) {
                supplierForBalance = dbSupplier;
                console.log('[Purchases] handleFormSubmit - Reloaded supplier from database, current balance:', supplierForBalance.balance);
            }
        } catch (error) {
            console.error('[Purchases] Error reloading supplier from database in handleFormSubmit:', error);
            // Continue with local supplier data if database reload fails
        }
    }
    
    // الرصيد القديم = الرصيد الحالي من قاعدة البيانات مباشرة
    let calculatedOldBalance = parseFloat(supplierForBalance.balance || 0);
    
    // عند تعديل فاتورة موجودة: إضافة المتبقي القديم للفاتورة لإرجاع الرصيد إلى ما كان عليه قبل هذه الفاتورة
    if (currentInvoice && currentInvoice.id && currentInvoice.supplierId === supplierId) {
        const oldInvoiceRemaining = parseFloat(currentInvoice.remaining || 0);
        calculatedOldBalance = calculatedOldBalance + oldInvoiceRemaining;
        console.log('[Purchases] handleFormSubmit - Editing invoice: Added back old invoice remaining to get balance before this invoice:', {
            currentBalance: parseFloat(supplierForBalance.balance || 0),
            oldInvoiceRemaining,
            calculatedOldBalance
        });
    }
    
    // الرصيد يُحفظ بالجنيه المصري مباشرة في قاعدة البيانات
    // الرصيد القديم يُحفظ في عمود oldBalance في جدول purchase_invoices
    oldBalanceToSave = calculatedOldBalance;
    
    // حساب القديم + الإجمالي (oldBalance + total)
    const oldBalancePlusTotal = oldBalanceToSave + total;
    
    // حساب الرصيد الجديد (oldBalance + remaining)
    // الرصيد الجديد = الرصيد القديم + المتبقي
    const newBalanceToSave = oldBalanceToSave + remaining;
    
    // حساب المتبقي من الفاتورة والرصيد القديم (oldBalance + remaining)
    // هذه القيمة = newBalance (لكن نحفظها كعمود منفصل للوضوح)
    const remainingWithOldBalanceToSave = oldBalanceToSave + remaining;
    
    console.log('[Purchases] handleFormSubmit - Balance calculations to save in invoice:', {
        calculatedOldBalance,
        oldBalanceToSave,
        total,
        remaining,
        oldBalancePlusTotal,
        newBalanceToSave,
        remainingWithOldBalanceToSave,
        isEdit: !!(currentInvoice && currentInvoice.id)
    });
    
    const invoiceData = {
        id: invoiceId,
        invoiceNumber: currentInvoice ? currentInvoice.invoiceNumber : await generateInvoiceNumber(),
        supplierId: supplierId,
        date: date,
        dueDate: dueDate,
        invoiceType: invoiceType, // Preserve original type when editing
        paymentMethod: paymentMethod,
        notes: notes,
        products: [...invoiceProducts],
        subtotal: subtotal,
        taxRate: taxRate,
        taxAmount: taxAmount,
        shipping: shipping,
        discount: discount,
        total: total,
        paid: paid,
        remaining: remaining,
        // الرصيد القديم يُحفظ في عمود oldBalance في جدول purchase_invoices
        // الرصيد القديم = الرصيد الحالي من قاعدة البيانات (قبل إضافة هذه الفاتورة)
        // ⚠️ مهم: هذه القيم تظل ثابتة ولا تتغير حتى بعد إنشاء فواتير جديدة أو سندات صرف
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
        createdBy: currentInvoice ? (currentInvoice.createdBy || currentUser) : currentUser,
        createdAt: currentInvoice ? currentInvoice.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

        // Save to database first
        if (window.electronAPI && window.electronAPI.dbInsert && window.electronAPI.dbUpdate) {
            // Prepare invoice data for database (without products array)
            const invoiceDbData = { ...invoiceData };
            delete invoiceDbData.products;
            
            if (currentInvoice) {
                // Update existing invoice in database
                console.log(`[Edit] Updating invoice ${invoiceId} with remaining: ${remaining}`);
                console.log(`[Edit] Old invoice remaining: ${currentInvoice.remaining}`);
                const updateResult = await window.electronAPI.dbUpdate('purchase_invoices', invoiceId, invoiceDbData);
                
                // Check if update was successful
                if (!updateResult || !updateResult.success) {
                    const errorMsg = updateResult?.error || 'خطأ غير معروف';
                    console.error('Failed to update purchase invoice in database:', errorMsg);
                    throw new Error('فشل تحديث فاتورة الشراء في قاعدة البيانات: ' + errorMsg);
                }
                console.log(`[Edit] Invoice updated in database`);
                
                // Delete old invoice items
                if (window.electronAPI && window.electronAPI.dbQuery) {
                    await window.electronAPI.dbQuery('DELETE FROM purchase_invoice_items WHERE invoiceId = ?', [invoiceId]);
                } else {
                    // Fallback: get all items and delete one by one
                    const oldItems = await window.electronAPI.dbGetAll('purchase_invoice_items', 'invoiceId = ?', [invoiceId]);
                    for (const item of oldItems) {
                        await window.electronAPI.dbDelete('purchase_invoice_items', item.id);
                    }
                }
                
                // Revert stock changes from old invoice items (both "pending" and "delivered" add stock)
                if (currentInvoice.products) {
                    for (const invProduct of currentInvoice.products) {
                        await revertProductStockFromPurchase(invProduct);
                    }
                }
            } else {
                // Insert new invoice in database
                const insertResult = await window.electronAPI.dbInsert('purchase_invoices', invoiceDbData);
                
                // Check if insert was successful
                if (!insertResult || !insertResult.success) {
                    const errorMsg = insertResult?.error || 'خطأ غير معروف';
                    console.error('Failed to insert purchase invoice to database:', errorMsg);
                    throw new Error('فشل حفظ فاتورة الشراء في قاعدة البيانات: ' + errorMsg);
                }
            }
            
            // Save invoice items
            for (const product of invoiceProducts) {
                // Get product code from product data
                let productCode = product.productCode || '';
                if (!productCode && product.productId) {
                    const productData = products.find(p => p.id === product.productId);
                    if (productData) {
                        productCode = productData.code || '';
                    }
                }
                
                // Get category from product data if not already in product object
                let productCategory = product.category || '';
                if (!productCategory && product.productId) {
                    const productData = products.find(p => p.id === product.productId);
                    if (productData) {
                        productCategory = productData.category || '';
                    }
                }
                
                const itemData = {
                    id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
                    invoiceId: invoiceId,
                    productId: product.productId,
                    productName: product.productName || product.name || '',
                    category: productCategory,
                    quantity: product.quantity || 0,
                    unit: product.unit || product.unitName || '',
                    price: product.price || 0,
                    total: product.total || 0
                };
                try {
                    const insertResult = await window.electronAPI.dbInsert('purchase_invoice_items', itemData);
                    if (insertResult && insertResult.success === false) {
                        console.error(`Failed to insert invoice item:`, insertResult);
                        throw new Error(`فشل حفظ منتج في الفاتورة: ${insertResult.error || 'خطأ غير معروف'}`);
                    }
                } catch (error) {
                    console.error(`❌ Error saving invoice item:`, error);
                    throw error; // Re-throw to stop the process
                }
            }
        } else {
            console.warn('Database API not available, saving to localStorage only');
        }

        // Update local array
        if (currentInvoice) {
            const index = invoices.findIndex(inv => inv.id === currentInvoice.id);
            if (index !== -1) {
                invoices[index] = invoiceData;
            }
        } else {
            invoices.push(invoiceData);
        }

        // Update product stock in database for both "pending" (مسودة) and "delivered" (تم التخزين)
        // Both statuses add stock to inventory
        await updateProductStockFromPurchase(invoiceProducts, invoiceId);
        
        // If editing and changing from "delivered" to "pending", no need to revert stock
        // because both statuses add stock (we already updated with new products)
        
        // Dispatch event to notify products screen
        invoiceProducts.forEach(product => {
            window.dispatchEvent(new CustomEvent('productStockUpdated', { detail: { productId: product.productId } }));
        });

        // Save products to localStorage as backup
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
        
        // Reload invoices from database to ensure sync (optimized for performance)
        // Only reload if using database pagination, otherwise update local array
        if (useDatabasePagination && window.electronAPI && window.electronAPI.dbGetAll) {
            try {
                // Only reload current page, not all invoices
                const result = await loadInvoicesPage(currentPage, itemsPerPage, {});
                if (result && result.invoices) {
                    invoices = result.invoices;
                    totalInvoicesCount = result.total || totalInvoicesCount;
                    console.log('[Purchases] Reloaded page', currentPage, 'with', invoices.length, 'invoices');
                }
            } catch (error) {
                console.error('[Purchases] Error reloading invoices after save:', error);
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
            console.log('[Purchases] Updated local array, skipping full reload for performance');
            
            // Ensure products are loaded for the saved invoice (only if needed)
            const savedInvoiceLocal = invoices.find(inv => inv.id === invoiceId);
            if (savedInvoiceLocal && (!savedInvoiceLocal.products || savedInvoiceLocal.products.length === 0)) {
                try {
                    const invoiceItems = await window.electronAPI.dbGetAll('purchase_invoice_items', 'invoiceId = ?', [invoiceId]);
                    if (invoiceItems && invoiceItems.length > 0) {
                        savedInvoiceLocal.products = invoiceItems.map(item => {
                            // Get product code from products array (not stored in database)
                            let productCode = '';
                            if (item.productId) {
                                const productData = products.find(p => p.id === item.productId);
                                if (productData) {
                                    productCode = productData.code || '';
                                }
                            }
                            return {
                                productId: item.productId,
                                productName: item.productName,
                                productCode: productCode,
                                quantity: item.quantity || 0,
                                unit: item.unit || '',
                                unitName: item.unit || '', // Use unit as unitName since unitName is not stored
                                price: item.price || 0,
                                total: item.total || 0
                            };
                        });
                    }
                } catch (error) {
                    console.error('Error loading invoice items after save:', error);
                }
            }
        }
        
        // Get saved invoice from invoices array (works for both pagination and non-pagination cases)
        const savedInvoice = invoices.find(inv => inv.id === invoiceId);
        
        // Ensure saved invoice has correct remaining value
        if (savedInvoice) {
            savedInvoice.remaining = remaining;
            // Update in database to ensure consistency
            if (window.electronAPI && window.electronAPI.dbUpdate) {
                try {
                    const invoiceDbData = { ...savedInvoice };
                    delete invoiceDbData.products;
                    await window.electronAPI.dbUpdate('purchase_invoices', invoiceId, invoiceDbData);
                } catch (error) {
                    console.error('Error updating invoice remaining in database:', error);
                }
            }
        }
        
        // Save to localStorage as backup
        await saveInvoices();
        
        currentPage = 1;
        applyFilters();
        
        // Recalculate supplier balance from all invoices
        // IMPORTANT: For edits, we need to ensure the invoice is updated in database before recalculating
        // Wait a bit to ensure database transaction is committed
        if (currentInvoice) {
            // Small delay to ensure database transaction is committed
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // This will use the updated remaining value from the database directly
        // Update supplier balance directly after saving invoice
        // If supplier was changed, update balance for old supplier first (subtract old invoice remaining)
        if (currentInvoice && currentInvoice.supplierId && currentInvoice.supplierId !== supplierId) {
            const oldSupplierId = currentInvoice.supplierId;
            console.log(`[Purchases] Supplier changed from ${oldSupplierId} to ${supplierId}. Updating old supplier balance...`);
            try {
                const oldSupplier = await window.electronAPI.dbGet('suppliers', oldSupplierId);
                if (oldSupplier) {
                    const oldInvoiceRemaining = parseFloat(currentInvoice.remaining || 0);
                    const newOldSupplierBalance = Math.max(0, (parseFloat(oldSupplier.balance || 0) - oldInvoiceRemaining));
                    await window.electronAPI.dbUpdate('suppliers', oldSupplierId, {
                        ...oldSupplier,
                        balance: newOldSupplierBalance,
                        updatedAt: new Date().toISOString()
                    });
                }
            } catch (error) {
                console.error('[Purchases] Error updating old supplier balance:', error);
                // Continue even if update fails
            }
        }
        
        // Update supplier balance directly: currentBalance + newRemaining - oldRemaining (if editing)
        try {
            const supplier = await window.electronAPI.dbGet('suppliers', supplierId);
            if (supplier) {
                const currentBalance = parseFloat(supplier.balance || 0);
                const newRemaining = parseFloat(remaining || 0);
                let newBalance = currentBalance;
                
                if (currentInvoice && currentInvoice.id && currentInvoice.supplierId === supplierId) {
                    // Editing existing invoice: subtract old remaining, add new remaining
                    const oldRemaining = parseFloat(currentInvoice.remaining || 0);
                    newBalance = currentBalance - oldRemaining + newRemaining;
                } else {
                    // New invoice: add remaining
                    newBalance = currentBalance + newRemaining;
                }
                
                await window.electronAPI.dbUpdate('suppliers', supplierId, {
                    ...supplier,
                    balance: newBalance,
                    lastTransactionDate: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
                
                console.log('[Purchases] Supplier balance updated directly:', {
                    supplierId,
                    oldBalance: currentBalance,
                    newBalance,
                    invoiceRemaining: newRemaining
                });
            }
        } catch (error) {
            console.error('[Purchases] Error updating supplier balance:', error);
            // Continue even if update fails
        }
        
        // Update first transaction date for new invoices
        if (!currentInvoice) {
            await updateSupplierFirstTransactionDate(supplierId);
        }
        
        // Auto print after saving
        closeModal();
        setTimeout(() => {
            openPrintWindow(invoiceData);
        }, 500);
        showMessage('تم حفظ الفاتورة وطباعتها بنجاح', 'success');
    } catch (error) {
        console.error('Error saving purchase invoice:', error);
        showMessage('خطأ في حفظ الفاتورة: ' + error.message, 'error');
    } finally {
        // إعادة تفعيل الزر في جميع الحالات
        isSavingInvoice = false;
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
    }
}

// Update Product Stock from Purchase Invoice
async function updateProductStockFromPurchase(invoiceProducts, invoiceId) {
    try {
        for (const invoiceProduct of invoiceProducts) {
            // Get product from database
            let product = null;
            if (window.electronAPI && window.electronAPI.dbGet) {
                product = await window.electronAPI.dbGet('products', invoiceProduct.productId);
            }
            
            if (!product) {
                console.error('Product not found:', invoiceProduct.productId);
                continue;
            }
            
            // Calculate quantity to add in smallest unit
            let quantityToAdd = invoiceProduct.quantity || 0;
            
            // If unit is largest, convert to smallest
            if (invoiceProduct.unit === 'largest') {
                const conversionFactor = product.conversionFactor || 1;
                quantityToAdd = invoiceProduct.quantity * conversionFactor;
            }
            
            // Update stock
            const currentStock = parseFloat(product.stock) || 0;
            const newStock = currentStock + quantityToAdd;
            
            product.stock = newStock;
            
            // Update product in database
            if (window.electronAPI && window.electronAPI.dbUpdate) {
                await window.electronAPI.dbUpdate('products', product.id, product);
            }
            
            // Update in local array too
            const localProduct = products.find(p => p.id === product.id);
            if (localProduct) {
                localProduct.stock = newStock;
            }
        }
    } catch (error) {
        console.error('Error updating product stock:', error);
    }
}

// Revert Product Stock from Purchase Invoice (for editing)
async function revertProductStockFromPurchase(invProduct) {
    try {
        let product = null;
        if (window.electronAPI && window.electronAPI.dbGet) {
            product = await window.electronAPI.dbGet('products', invProduct.productId);
        }
        
        if (!product) {
            return;
        }
        
        // Calculate quantity to revert in smallest unit
        let quantityToRevert = invProduct.quantity || 0;
        
        // If unit is largest, convert to smallest
        if (invProduct.unit === 'largest') {
            const conversionFactor = product.conversionFactor || 1;
            quantityToRevert = invProduct.quantity * conversionFactor;
        }
        
        // Revert stock (decrease - was added on purchase)
        const currentStock = parseFloat(product.stock) || 0;
        const newStock = Math.max(0, currentStock - quantityToRevert);
        
        product.stock = newStock;
        
        // Update product in database
        if (window.electronAPI && window.electronAPI.dbUpdate) {
            await window.electronAPI.dbUpdate('products', product.id, product);
        }
        
        // Update in local array too
        const localProduct = products.find(p => p.id === product.id);
        if (localProduct) {
            localProduct.stock = newStock;
        }
    } catch (error) {
        console.error('Error reverting product stock:', error);
    }
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

// Recalculate Supplier Balance from all invoices
async function recalculateSupplierBalance(supplierId) {
    // Load supplier data fresh from database first to get latest firstTransactionDate
    let supplier = null;
    if (window.electronAPI && window.electronAPI.dbGet) {
        try {
            supplier = await window.electronAPI.dbGet('suppliers', supplierId);
            if (supplier) {
                // Update local suppliers array
                const supplierIndex = suppliers.findIndex(s => s.id === supplierId);
                if (supplierIndex !== -1) {
                    suppliers[supplierIndex] = { ...suppliers[supplierIndex], ...supplier };
                } else {
                    suppliers.push(supplier);
                }
            }
        } catch (error) {
            console.error('Error loading supplier from database:', error);
            supplier = suppliers.find(s => s.id === supplierId);
        }
    } else {
        supplier = suppliers.find(s => s.id === supplierId);
    }
    
    if (!supplier) return;
    
    // Get all invoices for this supplier from database
    // IMPORTANT: Always load from database to ensure we have the latest data
    let supplierInvoices = [];
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            // Always load fresh from database, never use local array
            supplierInvoices = await window.electronAPI.dbGetAll('purchase_invoices', 'supplierId = ?', [supplierId]);
        } catch (error) {
            console.error('Error loading invoices from database:', error);
            // Fallback to local array only if database fails
            supplierInvoices = invoices.filter(inv => inv.supplierId === supplierId);
            console.warn(`[Balance] Using local array fallback: ${supplierInvoices.length} invoices`);
        }
    } else {
        // Fallback to local array only if database API not available
        supplierInvoices = invoices.filter(inv => inv.supplierId === supplierId);
        console.warn(`[Balance] Database API not available, using local array: ${supplierInvoices.length} invoices`);
    }
    
    // Get all payments for this supplier from database
    let supplierPayments = [];
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            supplierPayments = await window.electronAPI.dbGetAll('payments', 'supplierId = ?', [supplierId]);
        } catch (error) {
            console.error('Error loading payments from database:', error);
            supplierPayments = [];
        }
    }
    
    // Calculate: sum of all remaining amounts from all invoices
    let totalRemaining = 0;
    supplierInvoices.forEach(invoice => {
        const invoiceRemaining = parseFloat(invoice.remaining) || 0;
        totalRemaining += invoiceRemaining;
    });
    
    // Calculate: sum of all payment amounts (payments reduce supplier debt)
    let totalPayments = 0;
    supplierPayments.forEach(payment => {
        totalPayments += parseFloat(payment.amount) || 0;
    });
    
    // Get all returns to this supplier from database
    let supplierReturns = [];
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            supplierReturns = await window.electronAPI.dbGetAll('returns', 'returnType = ? AND entityId = ?', ['to_supplier', supplierId]);
        } catch (error) {
            console.error('Error loading returns from database:', error);
            supplierReturns = [];
        }
    }
    
    // Calculate: sum of all returns to supplier (returns reduce debt/balance)
    let totalReturns = 0;
    supplierReturns.forEach(ret => {
        totalReturns += parseFloat(ret.totalAmount || 0);
    });
    
    // Balance calculation:
    // Balance is calculated from transactions: invoices (debt) - payments - returns
    // The initial balance is already included in the supplier.balance when created
    const balance = totalRemaining - totalPayments - totalReturns;
    
    supplier.balance = balance;
    supplier.lastTransactionDate = new Date().toISOString();
    
    // Update first transaction date
    await updateSupplierFirstTransactionDate(supplierId);
    
    localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(suppliers));
    
    // Update supplier in database
    if (window.electronAPI && window.electronAPI.dbUpdate) {
        try {
            await window.electronAPI.dbUpdate('suppliers', supplierId, {
                ...supplier,
                balance: balance,
                lastTransactionDate: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error updating supplier balance in database:', error);
        }
    }
    
    // Update supplier display if modal is open
    if (document.getElementById('supplierSelect')) {
        const currentSupplierId = document.getElementById('supplierSelect').value;
        if (currentSupplierId === supplierId) {
            document.getElementById('oldBalance').textContent = `${balance.toFixed(2)} ج.م`;
            calculateTotals();
        }
    }
}

// Apply Filters and Search
async function applyFilters() {
    // If no date filters are set, show all invoices (don't filter by date)
    let effectiveDateFrom = dateFrom;
    let effectiveDateTo = dateTo;
    
    // Only apply current month filter if user explicitly sets dates or searches
    // Otherwise, show all invoices
    // Removed automatic current month filtering to show all invoices by default
    
    // Update date inputs only if they have values
    const dateFromInput = document.getElementById('dateFrom');
    const dateToInput = document.getElementById('dateTo');
    // Don't auto-set dates - let user choose
    
    // If using database pagination, load from database with filters
    if (useDatabasePagination) {
        const filters = {
            dateFrom: effectiveDateFrom || null,
            dateTo: effectiveDateTo || null,
            supplierId: null, // Can be added if needed
            searchQuery: searchQuery || null,
            sortBy: sortBy || 'date-desc'
        };
        
        const result = await loadInvoicesPage(currentPage, itemsPerPage, filters);
        filteredInvoices = result.invoices || [];
        totalInvoicesCount = result.total || 0;
        
        // Initialize products array
        filteredInvoices.forEach(invoice => {
            if (!invoice.products) {
                invoice.products = [];
            }
        });
        
        // Render paginated invoices
        renderInvoices();
        return;
    }
    
    // For small datasets, use in-memory filtering (original behavior)
    // Start with all invoices
    console.log('[Purchases] applyFilters - invoices.length:', invoices.length);
    filteredInvoices = [...invoices];
    console.log('[Purchases] applyFilters - filteredInvoices.length (after copy):', filteredInvoices.length);
    
    // Apply search filter
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredInvoices = filteredInvoices.filter(invoice => {
            // Search by invoice number
            const invoiceNumber = (invoice.invoiceNumber || '').toLowerCase();
            if (invoiceNumber.includes(query)) return true;
            
            // Search by supplier name
            const supplier = suppliers.find(s => s.id === invoice.supplierId);
            if (supplier) {
                const supplierName = (supplier.name || '').toLowerCase();
                if (supplierName.includes(query)) return true;
            }
            
            return false;
        });
        console.log('[Purchases] applyFilters - filteredInvoices.length (after search):', filteredInvoices.length);
    }
    
    // Apply date range filter (use effectiveDateFrom and effectiveDateTo from above)
    if (effectiveDateFrom) {
        filteredInvoices = filteredInvoices.filter(invoice => {
            return new Date(invoice.date) >= new Date(effectiveDateFrom);
        });
        console.log('[Purchases] applyFilters - filteredInvoices.length (after dateFrom):', filteredInvoices.length);
    }
    
    if (effectiveDateTo) {
        filteredInvoices = filteredInvoices.filter(invoice => {
            const invoiceDate = new Date(invoice.date);
            const toDate = new Date(effectiveDateTo);
            toDate.setHours(23, 59, 59, 999); // Include entire day
            return invoiceDate <= toDate;
        });
        console.log('[Purchases] applyFilters - filteredInvoices.length (after dateTo):', filteredInvoices.length);
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
    renderInvoices();
}

async function renderInvoices() {
    const tbody = document.getElementById('invoicesTableBody');
    const emptyState = document.getElementById('emptyState');
    const paginationContainer = document.getElementById('paginationContainer');
    
    if (!tbody) {
        console.error('invoicesTableBody element not found!');
        return;
    }
    
    tbody.innerHTML = '';

    console.log('[Purchases] renderInvoices - filteredInvoices.length:', filteredInvoices.length);
    console.log('[Purchases] renderInvoices - invoices.length:', invoices.length);
    console.log('[Purchases] renderInvoices - useDatabasePagination:', useDatabasePagination);

    if (filteredInvoices.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (paginationContainer) paginationContainer.classList.add('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (paginationContainer) paginationContainer.classList.remove('hidden');

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

    // Process invoices sequentially to handle async operations
    for (const invoice of paginatedInvoices) {
        const supplier = suppliers.find(s => s.id === invoice.supplierId);
        
        const row = document.createElement('tr');
        const notesText = invoice.notes ? (invoice.notes.length > 50 ? invoice.notes.substring(0, 50) + '...' : invoice.notes) : '-';
        const createdBy = invoice.createdBy || '-';
        
        row.innerHTML = `
            <td>${invoice.invoiceNumber}</td>
            <td>${new Date(invoice.date).toLocaleDateString('ar-EG')}</td>
            <td class="supplier-name-cell"><strong>${supplier ? supplier.name : 'غير محدد'}</strong></td>
            <td class="invoice-total-cell"><strong>${formatCurrency(invoice.total)}</strong></td>
            <td>${createdBy}</td>
            <td class="invoice-notes-cell" title="${invoice.notes || ''}">${notesText}</td>
            <td>
                <div class="actions-buttons">
                    <button class="action-btn view" data-invoice-id="${invoice.id}" title="عرض">👁️</button>
                    <button class="action-btn print" data-invoice-id="${invoice.id}" title="طباعة">🖨️</button>
                    <button class="action-btn save" data-invoice-id="${invoice.id}" title="حفظ على القرص">💾</button>
                </div>
            </td>
        `;
        
        // Add event listeners to buttons
        const viewBtn = row.querySelector('.action-btn.view');
        const printBtn = row.querySelector('.action-btn.print');
        const saveBtn = row.querySelector('.action-btn.save');
        const actionsDiv = row.querySelector('.actions-buttons');
        
        if (viewBtn) {
            viewBtn.addEventListener('click', () => viewInvoice(invoice.id));
        }
        if (printBtn) {
            printBtn.addEventListener('click', () => printInvoiceById(invoice.id));
        }
        if (saveBtn) {
            saveBtn.addEventListener('click', () => saveInvoiceToDisk(invoice.id));
        }
        
        tbody.appendChild(row);
    }
}

// View Invoice
async function viewInvoice(invoiceId) {
    let invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;

    // Always load invoice items from database to ensure fresh data
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            const invoiceItems = await window.electronAPI.dbGetAll('purchase_invoice_items', 'invoiceId = ?', [invoiceId]);
            if (invoiceItems && Array.isArray(invoiceItems) && invoiceItems.length > 0) {
                invoice.products = invoiceItems.map(item => {
                    // Get product code and category from products array if not stored in database
                    let productCode = item.productCode || '';
                    let productCategory = item.category || '';
                    if (item.productId) {
                        const productData = products.find(p => p.id === item.productId);
                        if (productData) {
                            if (!productCode) productCode = productData.code || '';
                            if (!productCategory) productCategory = productData.category || '';
                        }
                    }
                    return {
                        productId: item.productId,
                        productName: item.productName,
                        productCode: productCode,
                        category: productCategory,
                        quantity: item.quantity || 0,
                        unit: item.unit || '',
                        unitName: item.unit || '', // Use unit as unitName since unitName is not stored
                        price: item.price || 0,
                        total: item.total || 0
                    };
                });
            } else {
                invoice.products = [];
            }
        } catch (error) {
            console.error('Error loading invoice items:', error);
            invoice.products = invoice.products || [];
        }
    } else {
        invoice.products = invoice.products || [];
    }

    // Open in view window (no print)
    try {
        const supplier = suppliers.find(s => s.id === invoice.supplierId);
        const viewContent = await generatePrintContent(invoice, supplier);
        const viewWindow = window.open('', '_blank', 'width=800,height=600');
        if (!viewWindow || viewWindow.closed || typeof viewWindow.closed === 'undefined') {
            console.error('Failed to open view window - may be blocked');
            const blob = new Blob([viewContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            return;
        }
        
        viewWindow.document.write(viewContent);
        viewWindow.document.close();
    } catch (error) {
        console.error('Error viewing invoice:', error);
        showMessage('خطأ في عرض الفاتورة: ' + error.message, 'error');
    }
}

// Edit Invoice
async function editInvoice(invoiceId) {
    let invoice = invoices.find(inv => inv.id === invoiceId);
    
    // If not found in memory, try to load from database (for pagination mode)
    if (!invoice && useDatabasePagination && window.electronAPI && window.electronAPI.dbGet) {
        try {
            invoice = await window.electronAPI.dbGet('purchase_invoices', invoiceId);
        } catch (error) {
            console.error('Error loading invoice from database:', error);
        }
    }
    
    if (!invoice) {
        showMessage('الفاتورة غير موجودة', 'error');
        return;
    }
    
    // Prevent editing cancelled (reverse) invoices
    if (invoice.invoiceType === 'reverse') {
        if (window.showToast) {
            window.showToast('لا يمكن تعديل الفاتورة الملغاة', 'error', 5000);
        } else {
            showMessage('لا يمكن تعديل الفاتورة الملغاة', 'error');
        }
        return;
    }

    // Lazy load invoice items if not already loaded
    if (!invoice.products || invoice.products.length === 0) {
        invoice.products = await loadInvoiceItems(invoiceId);
    } else {
        // Always refresh from database to ensure fresh data
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            try {
                const invoiceItems = await window.electronAPI.dbGetAll('purchase_invoice_items', 'invoiceId = ?', [invoiceId]);
                if (invoiceItems && Array.isArray(invoiceItems) && invoiceItems.length > 0) {
                    invoice.products = invoiceItems.map(item => {
                        // Get product code and category from products array if not stored in database
                        let productCode = item.productCode || '';
                        let productCategory = item.category || '';
                        if (item.productId) {
                            const productData = products.find(p => p.id === item.productId);
                            if (productData) {
                                if (!productCode) productCode = productData.code || '';
                                if (!productCategory) productCategory = productData.category || '';
                            }
                        }
                        return {
                            productId: item.productId,
                            productName: item.productName,
                            productCode: productCode,
                            category: productCategory,
                            quantity: item.quantity || 0,
                            unit: item.unit || '',
                            unitName: item.unit || '', // Use unit as unitName since unitName is not stored
                            price: item.price || 0,
                            total: item.total || 0
                        };
                    });
                } else {
                    invoice.products = [];
                }
            } catch (error) {
                console.error('Error loading invoice items:', error);
                invoice.products = invoice.products || [];
            }
        } else {
            invoice.products = invoice.products || [];
        }
    }

    currentInvoice = invoice;
    // Load products from invoice
    invoiceProducts = invoice.products ? [...invoice.products] : [];
    
    
    document.getElementById('isEdit').value = 'true';
    document.getElementById('invoiceId').value = invoice.id;
    document.getElementById('modalTitle').textContent = `تعديل فاتورة ${invoice.invoiceNumber}`;
    document.getElementById('supplierSelect').value = invoice.supplierId;
    document.getElementById('invoiceDate').value = invoice.date;
    const dueDateInput = document.getElementById('dueDate');
    dueDateInput.value = invoice.dueDate || '';
    // Set min attribute to prevent selecting due date before invoice date
    if (invoice.date) {
        dueDateInput.setAttribute('min', invoice.date);
    }
    document.getElementById('paymentMethod').value = invoice.paymentMethod || 'cash';
    document.getElementById('notes').value = invoice.notes || '';
    // Tax is always 0 for purchase invoices (no VAT)
    document.getElementById('taxRate').value = 0;
    document.getElementById('shipping').value = invoice.shipping || 0;
    document.getElementById('discount').value = invoice.discount || 0;
    document.getElementById('paid').value = invoice.paid || 0;
    
    onSupplierChange();
    renderInvoiceProducts();
    calculateTotals();
    document.getElementById('invoiceModal').classList.add('active');
}

// Print Invoice
function printInvoiceById(invoiceId) {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (invoice) {
        openPrintWindow(invoice);
    }
}

// Save Invoice to Disk
async function saveInvoiceToDisk(invoiceId) {
    // Try to find invoice in local array first
    let invoice = invoices.find(inv => inv && inv.id === invoiceId);
    
    // If not found, load from database
    if (!invoice && window.electronAPI && window.electronAPI.dbGet) {
        try {
            invoice = await window.electronAPI.dbGet('purchase_invoices', invoiceId);
            
            if (!invoice) {
                showMessage('الفاتورة غير موجودة', 'error');
                return;
            }
            
            // Load invoice items from database
            const invoiceItems = await window.electronAPI.dbGetAll('purchase_invoice_items', 'invoiceId = ?', [invoiceId]);
            invoice.products = (invoiceItems || []).map(item => {
                // Get product code from products array (not stored in database)
                let productCode = '';
                if (item.productId) {
                    const productData = products.find(p => p.id === item.productId);
                    if (productData) {
                        productCode = productData.code || '';
                    }
                }
                return {
                    productId: item.productId,
                    productName: item.productName,
                    productCode: productCode,
                    quantity: item.quantity || 0,
                    unit: item.unit || '',
                    unitName: item.unit || '', // Use unit as unitName since unitName is not stored
                    price: item.price || 0,
                    total: item.total || 0
                };
            });
            
            // Load supplier from database if needed
            if (!suppliers.find(s => s && s.id === invoice.supplierId)) {
                const supplier = await window.electronAPI.dbGet('suppliers', invoice.supplierId);
                if (supplier) {
                    suppliers.push(supplier);
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
    if (!invoice.products || !Array.isArray(invoice.products)) {
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            try {
                const invoiceItems = await window.electronAPI.dbGetAll('purchase_invoice_items', 'invoiceId = ?', [invoiceId]);
                invoice.products = (invoiceItems || []).map(item => {
                    // Get product code from products array (not stored in database)
                    let productCode = '';
                    if (item.productId) {
                        const productData = products.find(p => p.id === item.productId);
                        if (productData) {
                            productCode = productData.code || '';
                        }
                    }
                    return {
                        productId: item.productId,
                        productName: item.productName,
                        productCode: productCode,
                        quantity: item.quantity || 0,
                        unit: item.unit || '',
                        unitName: item.unit || '', // Use unit as unitName since unitName is not stored
                        price: item.price || 0,
                        total: item.total || 0
                    };
                });
            } catch (error) {
                console.error('Error loading invoice items:', error);
                invoice.products = [];
            }
        } else {
            invoice.products = [];
        }
    }
    
    // Get supplier
    const supplier = suppliers.find(s => s && s.id === invoice.supplierId);
    
    // Generate invoice HTML content
    const invoiceContent = await generatePrintContent(invoice, supplier);
    
    // Generate default file name
    const defaultFileName = `فاتورة_مشتريات_${invoice.invoiceNumber}_${new Date(invoice.date).toISOString().split('T')[0]}.pdf`;
    
    // Save to file
    if (window.electronAPI && window.electronAPI.saveInvoiceToFile) {
        try {
            const result = await window.electronAPI.saveInvoiceToFile(invoiceContent, defaultFileName);
            if (result.success) {
                showMessage(`تم حفظ الفاتورة بنجاح في: ${result.filePath}`, 'success');
            } else if (result.cancelled) {
                // User cancelled, do nothing
            } else {
                showMessage('خطأ في حفظ الفاتورة: ' + (result.error || 'خطأ غير معروف'), 'error');
            }
        } catch (error) {
            console.error('Error saving invoice to file:', error);
            showMessage('خطأ في حفظ الفاتورة: ' + error.message, 'error');
        }
    } else {
        showMessage('وظيفة حفظ الملف غير متاحة', 'error');
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

// Delete Invoice
async function deleteInvoice(invoiceId) {
    try {
        // Find invoice
        let invoice = invoices.find(inv => inv.id === invoiceId);
        
        // If not found, load from database
        if (!invoice && window.electronAPI && window.electronAPI.dbGet) {
            invoice = await window.electronAPI.dbGet('purchase_invoices', invoiceId);
            if (!invoice) {
                showMessage('الفاتورة غير موجودة', 'error');
                return;
            }
            
            // Load invoice items
            const invoiceItems = await window.electronAPI.dbGetAll('purchase_invoice_items', 'invoiceId = ?', [invoiceId]);
            invoice.products = (invoiceItems || []).map(item => ({
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity || 0,
                unit: item.unit || '',
                unitName: item.unit || '' // Use unit as unitName since unitName is not stored
            }));
        }
        
        if (!invoice) {
            showMessage('الفاتورة غير موجودة', 'error');
            return;
        }
        
        // Allow deletion for all invoices
        
        // Confirm deletion using custom dialog
        showConfirmDialog(
            'هل أنت متأكد من حذف هذه الفاتورة؟\n\nسيتم إرجاع المخزون للمنتجات وإعادة حساب رصيد المورد.',
            () => {
                // User confirmed - proceed with deletion
                proceedWithInvoiceDeletion(invoiceId);
            },
            () => {
                // User cancelled - do nothing
            }
        );
    } catch (error) {
        console.error('Error in deleteInvoice:', error);
        showMessage('خطأ في حذف الفاتورة: ' + error.message, 'error');
    }
}

// Proceed with invoice deletion
async function proceedWithInvoiceDeletion(invoiceId) {
    try {
        // Find invoice
        let invoice = invoices.find(inv => inv.id === invoiceId);
        
        // If not found, load from database
        if (!invoice && window.electronAPI && window.electronAPI.dbGet) {
            invoice = await window.electronAPI.dbGet('purchase_invoices', invoiceId);
            if (!invoice) {
                showMessage('الفاتورة غير موجودة', 'error');
                return;
            }
            
            // Load invoice items
            const invoiceItems = await window.electronAPI.dbGetAll('purchase_invoice_items', 'invoiceId = ?', [invoiceId]);
            invoice.products = (invoiceItems || []).map(item => ({
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity || 0,
                unit: item.unit || '',
                unitName: item.unit || ''
            }));
        }
        
        if (!invoice) {
            showMessage('الفاتورة غير موجودة', 'error');
            return;
        }
        
        // Revert product stock for "pending" (مسودة) invoices
        // Both "pending" and "delivered" add stock, so we need to revert it on deletion
        if (invoice.products && invoice.products.length > 0) {
            for (const invProduct of invoice.products) {
                // Get product from database
                let product = null;
                if (window.electronAPI && window.electronAPI.dbGet) {
                    product = await window.electronAPI.dbGet('products', invProduct.productId);
                }
                
                if (product) {
                    // Calculate quantity to revert in smallest unit
                    let quantityToRevert = invProduct.quantity || 0;
                    
                    // If unit is largest, convert to smallest
                    if (invProduct.unit === 'largest') {
                        const conversionFactor = product.conversionFactor || 1;
                        quantityToRevert = invProduct.quantity * conversionFactor;
                    }
                    
                    // Revert stock (decrease - was added on purchase)
                    const currentStock = parseFloat(product.stock) || 0;
                    const newStock = Math.max(0, currentStock - quantityToRevert);
                    
                    product.stock = newStock;
                    
                    // Update product in database
                    if (window.electronAPI && window.electronAPI.dbUpdate) {
                        await window.electronAPI.dbUpdate('products', product.id, product);
                    }
                    
                    // Update in local array too
                    const localProduct = products.find(p => p.id === product.id);
                    if (localProduct) {
                        localProduct.stock = newStock;
                    }
                }
            }
        }
        
        // Always recalculate supplier balance (to remove invoice remaining from balance)
        if (invoice.supplierId) {
            await recalculateSupplierBalance(invoice.supplierId);
        }
        
        // Delete invoice items from database first (foreign key constraint)
        if (window.electronAPI && window.electronAPI.dbQuery) {
            await window.electronAPI.dbQuery('DELETE FROM purchase_invoice_items WHERE invoiceId = ?', [invoiceId]);
        } else if (window.electronAPI && window.electronAPI.dbGetAll && window.electronAPI.dbDelete) {
            const invoiceItems = await window.electronAPI.dbGetAll('purchase_invoice_items', 'invoiceId = ?', [invoiceId]);
            for (const item of invoiceItems) {
                await window.electronAPI.dbDelete('purchase_invoice_items', item.id);
            }
        }
        
        // Delete invoice from database
        if (window.electronAPI && window.electronAPI.dbDelete) {
            await window.electronAPI.dbDelete('purchase_invoices', invoiceId);
        }
        
        // Remove from local array
        invoices = invoices.filter(inv => inv.id !== invoiceId);
        
        // Save to localStorage
        await saveInvoices();
        
        // Reload invoices from database
        await loadData();
        
        // Render invoices
        currentPage = 1;
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
        console.error('Error deleting purchase invoice:', error);
        showMessage('خطأ في حذف الفاتورة: ' + error.message, 'error');
    }
}

// Print Current Invoice
function printInvoice() {
    if (!currentInvoice) return;
    openPrintWindow(currentInvoice);
}

// Open Print Window
async function openPrintWindow(invoice) {
    try {
        const supplier = suppliers.find(s => s.id === invoice.supplierId);
        const printContent = await generatePrintContent(invoice, supplier);
        
        // Open window off-screen or very small to minimize visibility
        const printWindow = window.open('', '_blank', 'width=1,height=1,left=-1000,top=-1000');
        if (!printWindow || printWindow.closed || typeof printWindow.closed === 'undefined') {
            console.error('Failed to open print window - may be blocked');
            showMessage('فشل فتح نافذة الطباعة. يرجى التحقق من إعدادات منع النوافذ المنبثقة', 'error');
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
    } catch (error) {
        console.error('Error in openPrintWindow:', error);
        showMessage('خطأ في طباعة الفاتورة: ' + error.message, 'error');
    }
}

// Generate Print Content
async function generatePrintContent(invoice, supplier) {
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
    
    // Ensure we have valid values (not null, undefined, or empty string)
    const companyName = companySettings.name && companySettings.name.trim() ? companySettings.name : 'شركة أسيل';
    const companyAddress = companySettings.address && companySettings.address.trim() ? companySettings.address : '';
    const companyPhone = companySettings.phone && companySettings.phone.trim() ? companySettings.phone : (companySettings.mobile && companySettings.mobile.trim() ? companySettings.mobile : '');
    
    // حساب الرصيد القديم: supplier.balance يحتوي بالفعل على invoice.remaining
    // لذلك نطرح invoice.remaining للحصول على الرصيد بدون هذه الفاتورة
    // قراءة الرصيد القديم من قاعدة البيانات (لقطة تاريخية)
    // الرصيد القديم محفوظ في عمود oldBalance في جدول purchase_invoices
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
            invoiceRemaining: invoice.remaining || 0
        });
    } else {
        // Fallback: إذا لم تكن القيم موجودة (للحوافظ القديمة)
        // Calculate old balance: current balance - current invoice remaining
        oldBalance = supplier ? (supplier.balance || 0) - (invoice.remaining || 0) : 0;
        oldBalancePlusTotal = oldBalance + invoice.total;
        newBalance = supplier ? (supplier.balance || 0) : 0;
        remainingWithOldBalance = (invoice.remaining || 0) + oldBalance;
        
        console.warn('[generatePrintContent] Balance values not found in database, using fallback calculation:', {
            oldBalance,
            oldBalancePlusTotal,
            newBalance,
            remainingWithOldBalance
        });
    }
    
    // استخدام oldBalancePlusTotal بدلاً من balancePlusInvoice
    const balancePlusInvoice = oldBalancePlusTotal;
    
    const printContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>فاتورة مشتريات ${invoice.invoiceNumber}</title>
    <style>
        @page {
            size: A4;
            margin: 20mm 20mm 20mm 20mm;
        }
        @media print {
            body {
                padding: 0 !important;
                margin: 0 !important;
            }
            .invoice-container {
                padding: 0;
                margin: 0;
            }
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
            padding: 20px 20px 20px 20px;
            margin: 0;
        }
        .invoice-container {
            position: relative;
            page-break-after: always;
        }
        .invoice-container:last-child {
            page-break-after: auto;
        }
        .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 180px;
            color: rgba(102, 126, 234, 0.2);
            font-weight: bold;
            z-index: 0;
            pointer-events: none;
            white-space: nowrap;
        }
        .watermark-2 {
            position: absolute;
            top: 25%;
            left: 25%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 150px;
            color: rgba(102, 126, 234, 0.15);
            font-weight: bold;
            z-index: 0;
            pointer-events: none;
            white-space: nowrap;
        }
        .watermark-3 {
            position: absolute;
            top: 75%;
            left: 75%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 150px;
            color: rgba(102, 126, 234, 0.15);
            font-weight: bold;
            z-index: 0;
            pointer-events: none;
            white-space: nowrap;
        }
        .watermark-4 {
            position: absolute;
            top: 25%;
            left: 75%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 150px;
            color: rgba(102, 126, 234, 0.15);
            font-weight: bold;
            z-index: 0;
            pointer-events: none;
            white-space: nowrap;
        }
        .watermark-5 {
            position: absolute;
            top: 75%;
            left: 25%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 150px;
            color: rgba(102, 126, 234, 0.15);
            font-weight: bold;
            z-index: 0;
            pointer-events: none;
            white-space: nowrap;
        }
        .invoice-content {
            position: relative;
            z-index: 1;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
        }
        .company-logo {
            width: 60px;
            height: 60px;
            object-fit: contain;
            vertical-align: middle;
            margin-left: 10px;
        }
        .company-name {
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .company-info {
            font-size: 14px;
            line-height: 1.8;
        }
        .company-header {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin-bottom: 10px;
        }
        .invoice-title {
            font-size: 24px;
            font-weight: bold;
            margin: 30px 0;
            text-align: center;
        }
        .invoice-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
        }
        .invoice-details {
            width: 48%;
        }
        .invoice-details table {
            width: 100%;
        }
        .invoice-details td {
            padding: 5px 0;
            font-size: 14px;
        }
        .invoice-details td:first-child {
            font-weight: bold;
            width: 120px;
        }
        .products-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        .products-table th,
        .products-table td {
            border: 1px solid #ddd;
            padding: 10px;
            text-align: right;
        }
        .products-table th {
            background: #f5f5f5;
            font-weight: bold;
        }
        .totals-section {
            margin-top: 20px;
            text-align: left;
        }
        .totals-table {
            width: 100%;
            border-collapse: collapse;
        }
        .totals-table td {
            padding: 8px;
            font-size: 14px;
        }
        .totals-table td:first-child {
            font-weight: bold;
            width: 200px;
        }
        .totals-table tr.highlight {
            background: #f0f0f0;
            font-weight: bold;
            font-size: 16px;
        }
        .notes {
            margin-top: 30px;
            padding: 15px;
            border: 1px solid #ddd;
            font-size: 13px;
        }
        .signature {
            margin-top: 60px;
            display: flex;
            justify-content: space-between;
            padding: 20px 0;
        }
        .signature-box {
            width: 45%;
            text-align: center;
            border-top: 2px solid #333;
            padding-top: 15px;
            margin-top: 20px;
        }
        .signature-box h4 {
            margin: 0 0 40px 0;
            font-size: 16px;
            font-weight: bold;
        }
        .signature-line {
            margin-top: 50px;
            border-top: 1px solid #333;
            padding-top: 5px;
            font-size: 14px;
        }
    </style>
</head>
    <body>
    <div class="invoice-container">
        <div class="watermark">${companyName || 'أسيل'}</div>
        <div class="watermark-2">${companyName || 'أسيل'}</div>
        <div class="watermark-3">${companyName || 'أسيل'}</div>
        <div class="watermark-4">${companyName || 'أسيل'}</div>
        <div class="watermark-5">${companyName || 'أسيل'}</div>
        <div class="invoice-content">
            <div class="invoice-title" style="font-size: 32px; margin: 30px 0; text-align: center; font-weight: bold; border-bottom: 3px solid #333; padding-bottom: 15px;">
                فاتورة مشتريات
            </div>
            <div class="invoice-info" style="margin: 30px 0;">
                <div class="invoice-details" style="width: 48%; border: 1px solid #ddd; padding: 15px; background: #f9f9f9;">
                    <div class="company-header" style="margin-bottom: 15px; border-bottom: 2px solid #333; padding-bottom: 8px;">
                        <h3 style="margin: 0 0 10px 0; font-size: 18px; text-align: center;">بيانات الشركة</h3>
                        <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                            <span style="font-size: 18px; font-weight: bold; flex: 1; text-align: right;">${companyName}</span>
                            <img src="${logoBase64 || logoPath}" alt="Logo" class="company-logo" style="width: 50px; height: 50px; object-fit: contain; margin: 0 5px;" />
                            <span style="font-size: 18px; font-weight: bold; flex: 1; text-align: left;"></span>
                        </div>
                    </div>
                    <table>
                        <tr>
                            <td>اسم الشركة:</td>
                            <td><strong>${companyName}</strong></td>
                        </tr>
                        <tr>
                            <td>عنوان الشركة:</td>
                            <td>${companyAddress || 'غير محدد'}</td>
                        </tr>
                        <tr>
                            <td>هاتف الشركة:</td>
                            <td>${companyPhone || 'غير محدد'}</td>
                        </tr>
                        ${companySettings.mobile && companySettings.mobile.trim() && companySettings.mobile !== companyPhone ? `
                        <tr>
                            <td>موبايل الشركة:</td>
                            <td>${companySettings.mobile}</td>
                        </tr>
                        ` : ''}
                    </table>
                </div>
                <div class="invoice-details" style="width: 48%; border: 1px solid #ddd; padding: 15px; background: #f9f9f9;">
                    <h3 style="margin: 0 0 15px 0; font-size: 18px; border-bottom: 2px solid #333; padding-bottom: 8px;">بيانات المورد</h3>
                    <table>
                        <tr>
                            <td>اسم المورد:</td>
                            <td><strong>${supplier ? supplier.name : '[اسم المورد]'}</strong></td>
                        </tr>
                        <tr>
                            <td>عنوان المورد:</td>
                            <td>${supplier && supplier.address ? supplier.address : '[عنوان المورد]'}</td>
                        </tr>
                        <tr>
                            <td>هاتف المورد:</td>
                            <td>${supplier && supplier.phone ? supplier.phone : '[هاتف المورد]'}</td>
                        </tr>
                    </table>
                </div>
            </div>
            <div class="invoice-info" style="margin: 20px 0; display: flex; justify-content: space-between;">
                <div style="width: 48%; border: 1px solid #ddd; padding: 15px; background: #f0f8ff;">
                    <table>
                        <tr>
                            <td style="font-weight: bold; width: 140px;">رقم الفاتورة:</td>
                            <td><strong>${invoice.invoiceNumber}</strong></td>
                        </tr>
                        <tr>
                            <td style="font-weight: bold; width: 140px;">الحالة:</td>
                            <td><strong>-</strong></td>
                        </tr>
                        <tr>
                            <td style="font-weight: bold;">تاريخ الفاتورة:</td>
                            <td><strong>${new Date(invoice.date).toLocaleDateString('ar-EG')}</strong></td>
                        </tr>
                    </table>
                </div>
            </div>
            <h4 style="margin: 30px 0 15px 0; font-weight: bold; font-size: 20px; text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px;">جدول الأصناف</h4>
            <table class="products-table" style="margin: 20px 0;">
                <thead>
                    <tr>
                        <th style="width: 50px;">#</th>
                        <th>اسم المنتج</th>
                        <th>الصنف (الكود)</th>
                        <th>الكمية</th>
                        <th>الوحدة / المقاس</th>
                        <th>السعر (ج.م)</th>
                        <th>الإجمالي (ج.م)</th>
                    </tr>
                </thead>
                <tbody>
                    ${(invoice.products && Array.isArray(invoice.products) ? invoice.products : []).map((product, index) => `
                    <tr>
                        <td style="text-align: center;">${index + 1}</td>
                        <td><strong>${product.productName || '[اسم المنتج]'}</strong></td>
                        <td>${product.category || 'غير محدد'}${product.productCode ? ` (${product.productCode})` : ''}</td>
                        <td style="text-align: center;">${(product.quantity || 0).toFixed(2)}</td>
                        <td style="text-align: center;">${product.unitName || product.unit || '[الوحدة]'}</td>
                        <td style="text-align: left;">${(product.price || 0).toFixed(2)}</td>
                        <td style="text-align: left; font-weight: bold;">${(product.total || 0).toFixed(2)}</td>
                    </tr>
                    `).join('')}
                    ${(!invoice.products || !Array.isArray(invoice.products) || invoice.products.length === 0) ? '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #94a3b8;">لا توجد منتجات</td></tr>' : ''}
                </tbody>
            </table>
            <div class="totals-section" style="margin-top: 30px; border: 2px solid #333; padding: 20px; background: #f9f9f9;">
                <h3 style="margin: 0 0 20px 0; font-size: 18px; text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px;">ملخص الحسابات</h3>
                <table class="totals-table" style="width: 100%;">
                    <tr>
                        <td style="font-weight: bold; font-size: 16px; padding: 10px;">الإجمالي الفرعي:</td>
                        <td style="text-align: left; font-size: 16px; padding: 10px;"><strong>${invoice.subtotal.toFixed(2)} ج.م</strong></td>
                    </tr>
                    ${invoice.shipping > 0 ? `
                    <tr>
                        <td style="padding: 8px;">الشحن والتوصيل:</td>
                        <td style="text-align: left; padding: 8px;">${invoice.shipping.toFixed(2)} ج.م</td>
                    </tr>
                    ` : ''}
                    ${invoice.discount > 0 ? `
                    <tr>
                        <td style="padding: 8px;">الخصم:</td>
                        <td style="text-align: left; padding: 8px;">- ${invoice.discount.toFixed(2)} ج.م</td>
                    </tr>
                    ` : ''}
                    <tr style="background: #e8f4f8; border-top: 2px solid #333; border-bottom: 2px solid #333;">
                        <td style="font-weight: bold; font-size: 18px; padding: 12px;">إجمالي الفاتورة الحالية:</td>
                        <td style="text-align: left; font-weight: bold; font-size: 18px; padding: 12px;">${invoice.total.toFixed(2)} ج.م</td>
                    </tr>
                    ${supplier ? `
                    <tr>
                        <td style="padding: 10px; font-weight: bold;">الرصيد القديم للمورد:</td>
                        <td style="text-align: left; padding: 10px; font-weight: bold;">${oldBalance.toFixed(2)} ج.م</td>
                    </tr>
                    <tr style="background: #fff3cd;">
                        <td style="padding: 10px; font-weight: bold;">الرصيد القديم + الفاتورة الحالية:</td>
                        <td style="text-align: left; padding: 10px; font-weight: bold;">${oldBalancePlusTotal.toFixed(2)} ج.م</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; font-weight: bold;">المبلغ المدفوع من الشركة للمورد:</td>
                        <td style="text-align: left; padding: 10px; font-weight: bold;">${invoice.paid.toFixed(2)} ج.م</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; font-weight: bold;">المتبقي من الفاتورة والرصيد القديم:</td>
                        <td style="text-align: left; padding: 10px; font-weight: bold;">${remainingWithOldBalance.toFixed(2)} ج.م</td>
                    </tr>
                    <tr style="background: #d4edda; border-top: 3px solid #28a745; border-bottom: 3px solid #28a745;">
                        <td style="font-weight: bold; font-size: 18px; padding: 12px;">الرصيد الجديد للمورد عند الشركة:</td>
                        <td style="text-align: left; font-weight: bold; font-size: 18px; padding: 12px; color: #155724;">${newBalance.toFixed(2)} ج.م</td>
                    </tr>
                    ` : ''}
                </table>
            </div>
            
            <!-- Signature Section -->
            <div class="signature">
                <div class="signature-box">
                    <h4>توقيع الشركة المشترية</h4>
                    <div class="signature-line">
                        <div style="margin-bottom: 10px;">________________________</div>
                        <div style="margin-top: 5px; font-weight: bold;">${companyName || 'اسم الشركة'}</div>
                        <div style="margin-top: 5px; font-size: 12px;">ختم الشركة</div>
                    </div>
                </div>
                <div class="signature-box">
                    <h4>توقيع المورد المستلم منه</h4>
                    <div class="signature-line">
                        <div style="margin-bottom: 10px;">________________________</div>
                        <div style="margin-top: 5px; font-weight: bold;">${supplier ? supplier.name : 'اسم المورد'}</div>
                        <div style="margin-top: 5px; font-size: 12px;">توقيع وختم المورد</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
    `;
    
    return printContent;
}

// Close Modal
function closeModal() {
    document.getElementById('invoiceModal').classList.remove('active');
    currentInvoice = null;
    invoiceProducts = [];
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

// Make functions global
window.removeProduct = removeProduct;
window.viewInvoice = viewInvoice;
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

window.editInvoice = editInvoice;
window.printInvoiceById = printInvoiceById;
window.saveInvoiceToDisk = saveInvoiceToDisk;
window.updateStatusDropdownStyle = updateStatusDropdownStyle;
window.recalculateSupplierBalance = recalculateSupplierBalance;


