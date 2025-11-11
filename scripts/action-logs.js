// Action Logs Management System - Reports

// Format numbers using Eastern Arabic numerals
function formatArabicNumber(number, decimals = 2) {
    if (number === null || number === undefined || isNaN(number)) {
        number = 0;
    }
    const num = parseFloat(number);
    const formatted = num.toFixed(decimals);
    const parts = formatted.split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1] || '';
    let integerWithSeparator = '';
    for (let i = integerPart.length - 1, j = 0; i >= 0; i--, j++) {
        if (j > 0 && j % 3 === 0) {
            integerWithSeparator = '٬' + integerWithSeparator;
        }
        integerWithSeparator = integerPart[i] + integerWithSeparator;
    }
    const result = decimalPart 
        ? integerWithSeparator + '٫' + decimalPart
        : integerWithSeparator;
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return result.replace(/\d/g, (digit) => arabicDigits[parseInt(digit)]);
}

// Format currency
function formatCurrency(amount) {
    return formatArabicNumber(amount) + ' ج.م';
}

// Generate unique code
function generateUniqueCode(prefix) {
    return prefix + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Get Company Settings
async function getCompanySettings() {
    try {
        if (window.electronAPI && window.electronAPI.dbGet) {
            const companyInfo = await window.electronAPI.dbGet('company_info', 'company_001');
            if (companyInfo) {
                return {
                    name: companyInfo.name || 'شركة أسيل',
                    address: companyInfo.address || '',
                    phone: companyInfo.phone || companyInfo.mobile || '',
                    email: companyInfo.email || '',
                    accountantName: companyInfo.accountantName || ''
                };
            }
        }
        
        // Fallback to localStorage
        const stored = localStorage.getItem('asel_company_settings');
        return stored ? JSON.parse(stored) : {
            name: 'شركة أسيل',
            address: '',
            phone: '',
            email: '',
            accountantName: ''
        };
    } catch (error) {
        console.error('Error getting company settings:', error);
        return {
            name: 'شركة أسيل',
            address: '',
            phone: '',
            email: '',
            accountantName: ''
        };
    }
}

// Global data
let customers = [];
let suppliers = [];
let products = [];
let users = []; // Store users for name lookup
let currentTab = 'customer-statement';
let customerStatementData = null; // Store statement data for PDF/Print
let supplierStatementData = null; // Store statement data for PDF/Print

// Pagination state for each tab
let customerStatementItems = [];
let supplierStatementItems = [];
let productMovementItems = [];
let deliveryNotesSettlementsItems = [];
let operatingExpensesItems = [];

// Pagination variables
let currentPage = 1;
let itemsPerPage = 20;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadInitialData();
    initializeTabs();
    initializeEventListeners();
    
    // Check for tab parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam) {
        // Valid tab IDs
        const validTabs = ['customer-statement', 'supplier-statement', 'product-movement', 'delivery-notes-settlements', 'operating-expenses'];
        if (validTabs.includes(tabParam)) {
            // Switch to the specified tab
            setTimeout(() => {
                switchTab(tabParam);
                
                // If customer-statement tab and customerId is provided, select the customer
                if (tabParam === 'customer-statement') {
                    const customerId = urlParams.get('customerId');
                    if (customerId) {
                        setTimeout(() => {
                            const customerSelect = document.getElementById('customerSelect');
                            if (customerSelect) {
                                customerSelect.value = customerId;
                                // Optionally auto-load the statement
                                // loadCustomerStatement();
                            }
                        }, 200); // Delay to ensure select is populated
                    }
                }
                
                // If product-movement tab and productId is provided, select the product
                if (tabParam === 'product-movement') {
                    const productId = urlParams.get('productId');
                    if (productId) {
                        setTimeout(() => {
                            const productSelect = document.getElementById('productSelect');
                            if (productSelect) {
                                productSelect.value = productId;
                                // Optionally auto-load the movement
                                // loadProductMovement();
                            }
                        }, 200); // Delay to ensure select is populated
                    }
                }
                
                // If operating-expenses tab, populate recipient filter
                if (tabParam === 'operating-expenses') {
                    setTimeout(() => {
                        populateRecipientFilter();
                    }, 200);
                }
            }, 100); // Small delay to ensure DOM is ready
        } else {
            // If no tab parameter, check if operating-expenses is the default active tab
            const operatingExpensesTab = document.querySelector('.tab-content#operating-expenses-tab');
            if (operatingExpensesTab && operatingExpensesTab.classList.contains('active')) {
                setTimeout(() => {
                    populateRecipientFilter();
                }, 200);
            }
        }
    }
});

// Load initial data (customers, suppliers, products, users)
async function loadInitialData() {
    try {
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            customers = await window.electronAPI.dbGetAll('customers', '', []) || [];
            suppliers = await window.electronAPI.dbGetAll('suppliers', '', []) || [];
            products = await window.electronAPI.dbGetAll('products', '', []) || [];
            users = await window.electronAPI.dbGetAll('users', '', []) || [];
        } else {
            const customersData = localStorage.getItem('asel_customers');
            const suppliersData = localStorage.getItem('asel_suppliers');
            const productsData = localStorage.getItem('asel_products');
            customers = customersData ? JSON.parse(customersData) : [];
            suppliers = suppliersData ? JSON.parse(suppliersData) : [];
            products = productsData ? JSON.parse(productsData) : [];
            users = [];
        }
        
        populateSelects();
    } catch (error) {
        console.error('Error loading initial data:', error);
    }
}

// Helper function to get user name by ID
function getUserName(userId) {
    if (!userId) {
        return 'نظام';
    }
    
    // Ensure users array is loaded - reload if empty
    if (!users || users.length === 0) {
        // Try to reload users
        loadInitialData().then(() => {
            // Users will be loaded, but we can't return async here
            // So we'll just return 'نظام' for now
        }).catch(() => {
            // Ignore errors
        });
        return 'نظام';
    }
    
    // Try to find user by ID
    let user = users.find(u => u.id === userId || u.id === String(userId));
    
    // If not found, try to find by username (in case userId is actually a username)
    if (!user) {
        user = users.find(u => u.username === userId || u.username === String(userId));
    }
    
    if (user) {
        return user.username || 'نظام';
    } else {
        // If still not found, return the userId itself or 'نظام'
        return 'نظام';
    }
}

// Populate select dropdowns
function populateSelects() {
    // Customers
    const customerSelect = document.getElementById('customerSelect');
    if (customerSelect) {
        customerSelect.innerHTML = '<option value="" disabled selected>اختر العميل</option>';
        // Sort customers by name for better UX
        const sortedCustomers = [...customers].sort((a, b) => {
            const nameA = (a.name || a.customerName || '').toLowerCase();
            const nameB = (b.name || b.customerName || '').toLowerCase();
            return nameA.localeCompare(nameB, 'ar');
        });
        sortedCustomers.forEach(customer => {
            const option = document.createElement('option');
            option.value = customer.id;
            const customerName = customer.name || customer.customerName || 'غير معروف';
            const customerCode = customer.code || '';
            option.textContent = customerCode ? `${customerName} (${customerCode})` : customerName;
            option.setAttribute('data-customer-name', customerName);
            option.setAttribute('data-customer-code', customerCode);
            customerSelect.appendChild(option);
        });
    }
    
    // Suppliers
    const supplierSelect = document.getElementById('supplierSelect');
    if (supplierSelect) {
        supplierSelect.innerHTML = '<option value="" disabled selected>اختر المورد</option>';
        // Sort suppliers by name for better UX
        const sortedSuppliers = [...suppliers].sort((a, b) => {
            const nameA = (a.name || a.supplierName || '').toLowerCase();
            const nameB = (b.name || b.supplierName || '').toLowerCase();
            return nameA.localeCompare(nameB, 'ar');
        });
        sortedSuppliers.forEach(supplier => {
            const option = document.createElement('option');
            option.value = supplier.id;
            const supplierName = supplier.name || supplier.supplierName || 'غير معروف';
            const supplierCode = supplier.code || '';
            option.textContent = supplierCode ? `${supplierName} (${supplierCode})` : supplierName;
            option.setAttribute('data-supplier-name', supplierName);
            option.setAttribute('data-supplier-code', supplierCode);
            supplierSelect.appendChild(option);
        });
    }
    
    // Products
    const productSelect = document.getElementById('productSelect');
    if (productSelect) {
        productSelect.innerHTML = '<option value="" disabled selected>اختر المنتج</option>';
        // Sort products by name for better UX
        const sortedProducts = [...products].sort((a, b) => {
            const nameA = (a.name || a.productName || '').toLowerCase();
            const nameB = (b.name || b.productName || '').toLowerCase();
            return nameA.localeCompare(nameB, 'ar');
        });
        sortedProducts.forEach(product => {
            const option = document.createElement('option');
            option.value = product.id;
            const productName = product.name || product.productName || 'غير معروف';
            const productCategory = product.category || 'غير محدد';
            const productCode = product.code || '';
            option.textContent = productCode ? `${productName} (${productCode}) - ${productCategory}` : `${productName} - ${productCategory}`;
            option.setAttribute('data-product-name', productName);
            option.setAttribute('data-product-code', productCode);
            option.setAttribute('data-product-category', productCategory);
            productSelect.appendChild(option);
        });
    }
}

// Initialize tabs
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            switchTab(tabId);
        });
    });
}

// Switch tab
function switchTab(tabId) {
    currentTab = tabId;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabId) {
            btn.classList.add('active');
        }
    });
    
    // Update tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
        if (content.id === tabId + '-tab') {
            content.classList.add('active');
        }
    });
    
    // Reset pagination
    currentPage = 1;
    
    // Populate recipient filter if switching to operating-expenses tab
    if (tabId === 'operating-expenses') {
        populateRecipientFilter();
    }
    
    // Show/hide pagination based on current tab data
    updatePaginationDisplay();
}

// Initialize event listeners
function initializeEventListeners() {
    // Customer Statement
    document.getElementById('loadCustomerStatementBtn')?.addEventListener('click', loadCustomerStatement);
    document.getElementById('saveCustomerStatementBtn')?.addEventListener('click', () => saveReport('customer'));
    document.getElementById('saveCustomerStatementPdfBtn')?.addEventListener('click', () => saveReportAsPDF('customer'));
    document.getElementById('printCustomerStatementBtn')?.addEventListener('click', () => printReport('customer'));
    
    // Supplier Statement
    document.getElementById('loadSupplierStatementBtn')?.addEventListener('click', loadSupplierStatement);
    document.getElementById('saveSupplierStatementBtn')?.addEventListener('click', () => saveReport('supplier'));
    document.getElementById('saveSupplierStatementPdfBtn')?.addEventListener('click', () => saveReportAsPDF('supplier'));
    document.getElementById('printSupplierStatementBtn')?.addEventListener('click', () => printReport('supplier'));
    
    // Product Movement
    document.getElementById('loadProductMovementBtn')?.addEventListener('click', loadProductMovement);
    document.getElementById('saveProductMovementBtn')?.addEventListener('click', () => saveReport('product'));
    document.getElementById('saveProductMovementPdfBtn')?.addEventListener('click', () => saveReportAsPDF('product'));
    document.getElementById('printProductMovementBtn')?.addEventListener('click', () => printReport('product'));
    
    // Delivery Notes
    document.getElementById('loadDeliveryNotesSettlementsBtn')?.addEventListener('click', loadDeliveryNotesSettlements);
    document.getElementById('saveDeliveryNotesSettlementsBtn')?.addEventListener('click', () => saveReport('delivery-notes-settlements'));
    document.getElementById('printDeliveryNotesSettlementsBtn')?.addEventListener('click', () => printReport('delivery-notes-settlements'));
    
    // Operating Expenses
    document.getElementById('loadOperatingExpensesBtn')?.addEventListener('click', loadOperatingExpenses);
    document.getElementById('saveOperatingExpensesBtn')?.addEventListener('click', () => saveReport('operating-expenses'));
    document.getElementById('printOperatingExpensesBtn')?.addEventListener('click', () => printReport('operating-expenses'));
    
    // Pagination controls
    document.getElementById('prevPageBtn')?.addEventListener('click', async () => {
        if (currentPage > 1) {
            currentPage--;
            await renderCurrentTab();
        }
    });
    
    document.getElementById('nextPageBtn')?.addEventListener('click', async () => {
        const totalPages = getTotalPages();
        if (currentPage < totalPages) {
            currentPage++;
            await renderCurrentTab();
        }
    });
    
    // Items per page selector
    document.getElementById('itemsPerPageSelect')?.addEventListener('change', async (e) => {
        const value = e.target.value;
        if (value === 'all') {
            itemsPerPage = Infinity;
        } else {
            itemsPerPage = parseInt(value);
        }
        currentPage = 1;
        await renderCurrentTab();
    });
}

// Load Customer Statement
async function loadCustomerStatement() {
    const customerId = document.getElementById('customerSelect').value;
    const dateFrom = document.getElementById('customerDateFrom').value;
    const dateTo = document.getElementById('customerDateTo').value;
    
    if (!customerId) {
        if (window.showToast) {
            window.showToast('يرجى اختيار العميل', 'error');
        } else {
        alert('⚠️ يرجى اختيار العميل');
        }
        return;
    }
    
    try {
        const tbody = document.getElementById('customerStatementBody');
        tbody.innerHTML = '<tr><td colspan="10" class="empty-state">جارٍ التحميل...</td></tr>';
        
        let invoices = [];
        let receipts = [];
        
        // Load invoices
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            let query = 'customerId = ?';
            let params = [customerId];
            
            if (dateFrom) {
                query += ' AND date >= ?';
                params.push(dateFrom);
            }
            if (dateTo) {
                query += ' AND date <= ?';
                params.push(dateTo);
            }
            
            invoices = await window.electronAPI.dbGetAll('sales_invoices', query, params) || [];
            receipts = await window.electronAPI.dbGetAll('receipts', query, params) || [];
        } else {
            // Fallback to localStorage
            const invoicesData = localStorage.getItem('asel_sales_invoices');
            const receiptsData = localStorage.getItem('asel_receipt_vouchers');
            invoices = invoicesData ? JSON.parse(invoicesData).filter(inv => inv.customerId === customerId) : [];
            receipts = receiptsData ? JSON.parse(receiptsData).filter(rec => rec.customerId === customerId) : [];
        }
        
        // Get customer info
        const customer = customers.find(c => c.id === customerId);
        
        const statement = [];
        
        // Add invoices - استخدام القيم المحفوظة مباشرة من قاعدة البيانات
        invoices.forEach(invoice => {
            if ((!dateFrom || invoice.date >= dateFrom) && (!dateTo || invoice.date <= dateTo)) {
                statement.push({
                    code: generateUniqueCode('INV'),
                    refNumber: invoice.invoiceNumber || invoice.id,
                    type: 'فاتورة مبيعات',
                    entityType: 'sales_invoice',
                    entityId: invoice.id,
                    invoiceAmount: parseFloat(invoice.total || 0),
                    totalMovement: parseFloat(invoice.total || 0), // إجمالي الحركة = قيمة الفاتورة
                    paid: parseFloat(invoice.paid || 0), // المدفوع أثناء الحركة
                    oldBalance: parseFloat(invoice.oldBalance || 0), // الرصيد قبل الحركة من قاعدة البيانات
                    newBalance: parseFloat(invoice.remainingWithOldBalance || invoice.newBalance || 0), // الرصيد الجديد من قاعدة البيانات
                    date: invoice.date,
                    createdAt: invoice.createdAt || invoice.date,
                    updatedAt: invoice.updatedAt || invoice.createdAt || invoice.date,
                    notes: invoice.notes || ''
                });
            }
        });
        
        // Add receipts - استخدام القيم المحفوظة مباشرة من قاعدة البيانات
        receipts.forEach(receipt => {
            if ((!dateFrom || receipt.date >= dateFrom) && (!dateTo || receipt.date <= dateTo)) {
                statement.push({
                    code: generateUniqueCode('REC'),
                    refNumber: receipt.receiptNumber || receipt.id,
                    type: 'سند قبض',
                    entityType: 'receipt',
                    entityId: receipt.id,
                    invoiceAmount: 0,
                    totalMovement: parseFloat(receipt.amount || 0), // إجمالي الحركة = المبلغ المدفوع
                    paid: parseFloat(receipt.amount || 0), // المدفوع أثناء الحركة
                    oldBalance: parseFloat(receipt.oldBalance || 0), // الرصيد قبل الحركة من قاعدة البيانات
                    newBalance: parseFloat(receipt.newBalance || 0), // الرصيد الجديد من قاعدة البيانات
                    date: receipt.date,
                    createdAt: receipt.createdAt || receipt.date,
                    updatedAt: receipt.updatedAt || receipt.createdAt || receipt.date,
                    notes: receipt.notes || ''
                });
            }
        });

        // Load returns from customers
        let customerReturns = [];
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            let query = 'returnType = ? AND entityId = ?';
            let params = ['from_customer', customerId];
            
            if (dateFrom) {
                query += ' AND date >= ?';
                params.push(dateFrom);
            }
            if (dateTo) {
                query += ' AND date <= ?';
                params.push(dateTo);
            }
            
            customerReturns = await window.electronAPI.dbGetAll('returns', query, params) || [];
        }

        // Add returns from customers - استخدام القيم المحفوظة مباشرة من قاعدة البيانات
        customerReturns.forEach(ret => {
            const amount = parseFloat(ret.totalAmount || 0);
            const returnTypeLabel = ret.returnType === 'from_customer' ? 'مرتجع من عميل' : 'مرتجع إلى مورد';
            
            statement.push({
                code: generateUniqueCode('RET'),
                refNumber: ret.returnNumber || ret.id,
                type: returnTypeLabel,
                entityType: 'return',
                entityId: ret.id,
                invoiceAmount: 0,
                totalMovement: amount, // إجمالي الحركة = قيمة المرتجع
                paid: amount, // المدفوع أثناء الحركة = قيمة المرتجع
                oldBalance: parseFloat(ret.oldBalance || 0), // الرصيد قبل الحركة من قاعدة البيانات
                newBalance: parseFloat(ret.newBalance || 0), // الرصيد الجديد من قاعدة البيانات
                date: ret.date,
                createdAt: ret.createdAt || ret.date,
                updatedAt: ret.updatedAt || ret.createdAt || ret.date,
                notes: ret.notes || ''
            });
        });
        
        // Sort by createdAt (actual time of operation) - oldest first
        // This ensures correct chronological order even if date is set to future/past
        statement.sort((a, b) => {
            // Sort by actual creation/update time (createdAt or updatedAt)
            const timeA = new Date(a.createdAt || a.updatedAt || a.date);
            const timeB = new Date(b.createdAt || b.updatedAt || b.date);
            return timeA.getTime() - timeB.getTime();
        });
        
        // Calculate summary - استخدام القيم المحفوظة
        const calculatedOpeningBalance = statement.length > 0 ? statement[0].oldBalance : 0;
        const totalSales = statement.filter(s => s.type === 'فاتورة مبيعات').reduce((sum, s) => sum + s.invoiceAmount, 0);
        const totalReceipts = statement.filter(s => s.type === 'سند قبض').reduce((sum, s) => sum + s.paid, 0);
        const totalReturns = statement.filter(s => s.type === 'مرتجع من عميل').reduce((sum, s) => sum + s.paid, 0);
        const closingBalance = statement.length > 0 ? statement[statement.length - 1].newBalance : calculatedOpeningBalance;
        const firstDate = dateFrom || (statement.length > 0 ? statement[0].date : new Date().toISOString().split('T')[0]);
        const lastDate = dateTo || (statement.length > 0 ? statement[statement.length - 1].date : new Date().toISOString().split('T')[0]);
        
        // Store data for PDF/Print
        customerStatementData = {
            customer: customer,
            statement: statement,
            summary: {
                openingBalance: calculatedOpeningBalance,
                totalSales,
                totalReceipts,
                totalReturns,
                closingBalance,
                firstDate,
                lastDate
            },
            dateFrom,
            dateTo
        };
        
        // Store items for pagination
        customerStatementItems = statement;
        currentPage = 1;
        
        // Render with pagination
        await renderCustomerStatement();
    } catch (error) {
        console.error('Error loading customer statement:', error);
        document.getElementById('customerStatementBody').innerHTML = '<tr><td colspan="10" class="empty-state">حدث خطأ أثناء تحميل البيانات</td></tr>';
    }
}

// Load Supplier Statement
async function loadSupplierStatement() {
    const supplierId = document.getElementById('supplierSelect').value;
    const dateFrom = document.getElementById('supplierDateFrom').value;
    const dateTo = document.getElementById('supplierDateTo').value;
    
    if (!supplierId) {
        if (window.showToast) {
            window.showToast('يرجى اختيار المورد', 'error');
        } else {
        alert('⚠️ يرجى اختيار المورد');
        }
        return;
    }
    
    try {
        const tbody = document.getElementById('supplierStatementBody');
        tbody.innerHTML = '<tr><td colspan="10" class="empty-state">جارٍ التحميل...</td></tr>';
        
        let invoices = [];
        let payments = [];
        
        // Load invoices
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            let query = 'supplierId = ?';
            let params = [supplierId];
            
            if (dateFrom) {
                query += ' AND date >= ?';
                params.push(dateFrom);
            }
            if (dateTo) {
                query += ' AND date <= ?';
                params.push(dateTo);
            }
            
            invoices = await window.electronAPI.dbGetAll('purchase_invoices', query, params) || [];
            
            // Load payments
            query = 'supplierId = ?';
            params = [supplierId];
            if (dateFrom) {
                query += ' AND date >= ?';
                params.push(dateFrom);
            }
            if (dateTo) {
                query += ' AND date <= ?';
                params.push(dateTo);
            }
            payments = await window.electronAPI.dbGetAll('payments', query, params) || [];
        } else {
            // Fallback to localStorage
            const invoicesData = localStorage.getItem('asel_purchase_invoices');
            const paymentsData = localStorage.getItem('asel_payments');
            invoices = invoicesData ? JSON.parse(invoicesData).filter(inv => inv.supplierId === supplierId) : [];
            payments = paymentsData ? JSON.parse(paymentsData).filter(pay => pay.supplierId === supplierId) : [];
        }
        
        // Get supplier info
        const supplier = suppliers.find(s => s.id === supplierId);
        
        const statement = [];
        
        // Add invoices - استخدام القيم المحفوظة مباشرة من قاعدة البيانات
        invoices.forEach(invoice => {
            if ((!dateFrom || invoice.date >= dateFrom) && (!dateTo || invoice.date <= dateTo)) {
                statement.push({
                    code: generateUniqueCode('PINV'),
                    refNumber: invoice.invoiceNumber || invoice.id,
                    type: 'فاتورة مشتريات',
                    entityType: 'purchase_invoice',
                    entityId: invoice.id,
                    invoiceAmount: parseFloat(invoice.total || 0),
                    totalMovement: parseFloat(invoice.total || 0), // إجمالي الحركة = قيمة الفاتورة
                    paid: parseFloat(invoice.paid || 0), // المدفوع أثناء الحركة
                    oldBalance: parseFloat(invoice.oldBalance || 0), // الرصيد قبل الحركة من قاعدة البيانات
                    newBalance: parseFloat(invoice.remainingWithOldBalance || invoice.newBalance || 0), // الرصيد الجديد من قاعدة البيانات
                    date: invoice.date,
                    createdAt: invoice.createdAt || invoice.date,
                    updatedAt: invoice.updatedAt || invoice.createdAt || invoice.date,
                    notes: invoice.notes || ''
                });
            }
        });
        
        // Add payments - استخدام القيم المحفوظة مباشرة من قاعدة البيانات
        payments.forEach(payment => {
            if ((!dateFrom || payment.date >= dateFrom) && (!dateTo || payment.date <= dateTo)) {
                statement.push({
                    code: generateUniqueCode('PAY'),
                    refNumber: payment.paymentNumber || payment.id,
                    type: 'سند صرف',
                    entityType: 'payment',
                    entityId: payment.id,
                    invoiceAmount: 0,
                    totalMovement: parseFloat(payment.amount || 0), // إجمالي الحركة = المبلغ المدفوع
                    paid: parseFloat(payment.amount || 0), // المدفوع أثناء الحركة
                    oldBalance: parseFloat(payment.oldBalance || 0), // الرصيد قبل الحركة من قاعدة البيانات
                    newBalance: parseFloat(payment.newBalance || 0), // الرصيد الجديد من قاعدة البيانات
                    date: payment.date,
                    createdAt: payment.createdAt || payment.date,
                    updatedAt: payment.updatedAt || payment.createdAt || payment.date,
                    notes: payment.notes || ''
                });
            }
        });

        // Load returns to suppliers
        let supplierReturns = [];
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            let query = 'returnType = ? AND entityId = ?';
            let params = ['to_supplier', supplierId];
            
            if (dateFrom) {
                query += ' AND date >= ?';
                params.push(dateFrom);
            }
            if (dateTo) {
                query += ' AND date <= ?';
                params.push(dateTo);
            }
            
            supplierReturns = await window.electronAPI.dbGetAll('returns', query, params) || [];
        }

        // Add returns to suppliers - استخدام القيم المحفوظة مباشرة من قاعدة البيانات
        supplierReturns.forEach(ret => {
            const amount = parseFloat(ret.totalAmount || 0);
            const returnTypeLabel = ret.returnType === 'to_supplier' ? 'مرتجع إلى مورد' : 'مرتجع من عميل';
            
            statement.push({
                code: generateUniqueCode('RET'),
                refNumber: ret.returnNumber || ret.id,
                type: returnTypeLabel,
                entityType: 'return',
                entityId: ret.id,
                invoiceAmount: 0,
                totalMovement: amount, // إجمالي الحركة = قيمة المرتجع
                paid: amount, // المدفوع أثناء الحركة = قيمة المرتجع
                oldBalance: parseFloat(ret.oldBalance || 0), // الرصيد قبل الحركة من قاعدة البيانات
                newBalance: parseFloat(ret.newBalance || 0), // الرصيد الجديد من قاعدة البيانات
                date: ret.date,
                createdAt: ret.createdAt || ret.date,
                updatedAt: ret.updatedAt || ret.createdAt || ret.date,
                notes: ret.notes || ''
            });
        });
        
        // Sort by createdAt (actual time of operation) - oldest first
        // This ensures correct chronological order even if date is set to future/past
        statement.sort((a, b) => {
            // Sort by actual creation/update time (createdAt or updatedAt)
            const timeA = new Date(a.createdAt || a.updatedAt || a.date);
            const timeB = new Date(b.createdAt || b.updatedAt || b.date);
            return timeA.getTime() - timeB.getTime();
        });
        
        // Calculate summary - استخدام القيم المحفوظة
        const calculatedOpeningBalance = statement.length > 0 ? statement[0].oldBalance : 0;
        const totalPurchases = statement.filter(s => s.type === 'فاتورة مشتريات').reduce((sum, s) => sum + s.invoiceAmount, 0);
        const totalPayments = statement.filter(s => s.type === 'سند صرف').reduce((sum, s) => sum + s.paid, 0);
        const totalReturns = statement.filter(s => s.type === 'مرتجع إلى مورد').reduce((sum, s) => sum + s.paid, 0);
        const closingBalance = statement.length > 0 ? statement[statement.length - 1].newBalance : calculatedOpeningBalance;
        const firstDate = dateFrom || (statement.length > 0 ? statement[0].date : new Date().toISOString().split('T')[0]);
        const lastDate = dateTo || (statement.length > 0 ? statement[statement.length - 1].date : new Date().toISOString().split('T')[0]);
        
        // Store data for PDF/Print
        supplierStatementData = {
            supplier: supplier,
            statement: statement,
            summary: {
                openingBalance: calculatedOpeningBalance,
                totalPurchases,
                totalPayments,
                totalReturns,
                closingBalance,
                firstDate,
                lastDate
            },
            dateFrom,
            dateTo
        };
        
        // Store items for pagination
        supplierStatementItems = statement;
        currentPage = 1;
        
        // Render with pagination
        await renderSupplierStatement();
    } catch (error) {
        console.error('Error loading supplier statement:', error);
        document.getElementById('supplierStatementBody').innerHTML = '<tr><td colspan="10" class="empty-state">حدث خطأ أثناء تحميل البيانات</td></tr>';
    }
}

// Load Product Movement
async function loadProductMovement() {
    // Ensure users are loaded
    if (!users || users.length === 0) {
        await loadInitialData();
    }
    
    const productId = document.getElementById('productSelect').value;
    const dateFrom = document.getElementById('productDateFrom').value;
    const dateTo = document.getElementById('productDateTo').value;
    
    if (!productId) {
        if (window.showToast) {
            window.showToast('يرجى اختيار المنتج', 'error');
        } else {
        alert('⚠️ يرجى اختيار المنتج');
        }
        return;
    }
    
    try {
        const tbody = document.getElementById('productMovementBody');
        tbody.innerHTML = '<tr><td colspan="12" class="empty-state">جارٍ التحميل...</td></tr>';
        
        const product = products.find(p => p.id === productId);
        if (!product) {
            tbody.innerHTML = '<tr><td colspan="12" class="empty-state">المنتج غير موجود</td></tr>';
            return;
        }
        
        const movements = [];
        
        // Load purchase invoices
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            let query = '';
            let params = [];
            if (dateFrom) {
                query += 'date >= ?';
                params.push(dateFrom);
            }
            if (dateTo) {
                if (query) query += ' AND ';
                query += 'date <= ?';
                params.push(dateTo);
            }
            
            const purchaseInvoices = await window.electronAPI.dbGetAll('purchase_invoices', query, params) || [];
            
            // Optimized: Load all items in one query instead of per-invoice
            let purchaseItems = [];
            if (purchaseInvoices.length > 0 && window.electronAPI.dbQuery) {
                const invoiceIds = purchaseInvoices.map(inv => inv.id);
                const placeholders = invoiceIds.map(() => '?').join(',');
                purchaseItems = await window.electronAPI.dbQuery(
                    `SELECT * FROM purchase_invoice_items WHERE invoiceId IN (${placeholders}) AND productId = ?`,
                    [...invoiceIds, productId]
                ) || [];
            }
            
            // Create a map for faster lookup
            const purchaseItemsMap = {};
            purchaseItems.forEach(item => {
                if (!purchaseItemsMap[item.invoiceId]) {
                    purchaseItemsMap[item.invoiceId] = [];
                }
                purchaseItemsMap[item.invoiceId].push(item);
            });
            
            for (const invoice of purchaseInvoices) {
                const items = purchaseItemsMap[invoice.id] || [];
                for (const item of items) {
                    movements.push({
                        date: invoice.date,
                        createdAt: invoice.createdAt || invoice.date,
                        type: 'purchase',
                        typeLabel: 'مشتريات',
                        entityType: 'purchase_invoice',
                        entityId: invoice.id,
                        refNumber: invoice.invoiceNumber || invoice.id,
                        productName: item.productName || product.name,
                        category: product.category || 'غير محدد',
                        unit: item.unit === 'smallest' ? 'صغرى' : 'كبرى',
                        quantity: parseFloat(item.quantity || 0),
                        price: parseFloat(item.price || 0),
                        total: parseFloat(item.total || 0),
                        balanceBefore: 0, // Will calculate
                        balanceAfter: 0,
                        user: getUserName(invoice.userId)
                    });
                }
            }
            
            // Load sales invoices
            const salesInvoices = await window.electronAPI.dbGetAll('sales_invoices', query, params) || [];
            
            // Optimized: Load all items in one query instead of per-invoice
            let salesItems = [];
            if (salesInvoices.length > 0 && window.electronAPI.dbQuery) {
                const invoiceIds = salesInvoices.map(inv => inv.id);
                const placeholders = invoiceIds.map(() => '?').join(',');
                salesItems = await window.electronAPI.dbQuery(
                    `SELECT * FROM sales_invoice_items WHERE invoiceId IN (${placeholders}) AND productId = ?`,
                    [...invoiceIds, productId]
                ) || [];
            }
            
            // Create a map for faster lookup
            const salesItemsMap = {};
            salesItems.forEach(item => {
                if (!salesItemsMap[item.invoiceId]) {
                    salesItemsMap[item.invoiceId] = [];
                }
                salesItemsMap[item.invoiceId].push(item);
            });
            
            for (const invoice of salesInvoices) {
                const items = salesItemsMap[invoice.id] || [];
                for (const item of items) {
                    movements.push({
                        date: invoice.date,
                        createdAt: invoice.createdAt || invoice.date,
                        type: 'sale',
                        typeLabel: 'مبيعات',
                        entityType: 'sales_invoice',
                        entityId: invoice.id,
                        refNumber: invoice.invoiceNumber || invoice.id,
                        productName: item.productName || product.name,
                        category: product.category || 'غير محدد',
                        unit: item.unit === 'smallest' ? 'صغرى' : 'كبرى',
                        quantity: -parseFloat(item.quantity || 0),
                        price: parseFloat(item.price || 0),
                        total: parseFloat(item.total || 0),
                        balanceBefore: 0, // Will calculate
                        balanceAfter: 0,
                        user: getUserName(invoice.userId)
                    });
                }
            }
            
            // Load inventory adjustments
            query = 'productId = ?';
            params = [productId];
            if (dateFrom) {
                query += ' AND date >= ?';
                params.push(dateFrom);
            }
            if (dateTo) {
                query += ' AND date <= ?';
                params.push(dateTo);
            }
            
            const adjustments = await window.electronAPI.dbGetAll('inventory_adjustments', query, params) || [];
            
            for (const adj of adjustments) {
                let quantity = parseFloat(adj.quantity || 0);
                
                if (adj.type === 'increase') {
                    // Keep positive for increase
                } else if (adj.type === 'decrease') {
                    quantity = -quantity;
                } else if (adj.type === 'set') {
                    // Keep as is for set
                }
                
                movements.push({
                    date: adj.date,
                    createdAt: adj.createdAt || adj.date,
                    type: 'adjustment',
                    typeLabel: 'جرد',
                    entityType: 'inventory_adjustment',
                    entityId: adj.id,
                    refNumber: adj.adjustmentNumber || adj.id,
                    productName: product.name,
                    category: product.category || 'غير محدد',
                    unit: 'صغرى',
                    quantity: quantity,
                    price: 0,
                    total: 0,
                    balanceBefore: 0, // Will calculate
                    balanceAfter: 0,
                    user: getUserName(adj.userId)
                });
            }

            // Load returns for this product (only those that restore to stock)
            let returnQuery = 'productId = ? AND restoredToStock = ?';
            let returnParams = [productId, 'true'];
            if (dateFrom) {
                returnQuery += ' AND date >= ?';
                returnParams.push(dateFrom);
            }
            if (dateTo) {
                returnQuery += ' AND date <= ?';
                returnParams.push(dateTo);
            }
            
            const returns = await window.electronAPI.dbGetAll('returns', returnQuery, returnParams) || [];
            
            for (const ret of returns) {
                // Calculate quantity based on return type:
                // - Return from customer: positive (increases inventory - we get product back)
                // - Return to supplier: negative (decreases inventory - we return product to supplier)
                let quantity = parseFloat(ret.quantity || 0);
                if (ret.returnType === 'to_supplier') {
                    quantity = -quantity; // Negative for supplier returns (decreases inventory)
                }
                // If returnType is 'from_customer', quantity stays positive (increases inventory)
                
                const returnTypeLabel = ret.returnType === 'from_customer' ? 'مرتجع من عميل' : 'مرتجع إلى مورد';
                
                movements.push({
                    date: ret.date,
                    createdAt: ret.createdAt || ret.date,
                    type: 'return',
                    typeLabel: returnTypeLabel,
                    entityType: 'return',
                    entityId: ret.id,
                    refNumber: ret.returnNumber || ret.id,
                    productName: product.name,
                    category: product.category || 'غير محدد',
                    unit: 'صغرى',
                    quantity: quantity,
                    price: parseFloat(ret.unitPrice || 0),
                    total: parseFloat(ret.totalAmount || 0),
                    balanceBefore: 0, // Will calculate
                    balanceAfter: 0,
                    user: getUserName(ret.userId)
                });
            }
        }
        
        // Sort by createdAt (actual time of operation) from oldest to newest
        // This ensures correct chronological order even if date is set to future/past
        movements.sort((a, b) => {
            const timeA = new Date(a.createdAt || a.updatedAt || a.date);
            const timeB = new Date(b.createdAt || b.updatedAt || b.date);
            return timeA.getTime() - timeB.getTime(); // Oldest first (ascending order)
        });
        
        // Start from opening stock, not current stock
        let currentBalance = parseFloat(product.openingStock || 0);
        movements.forEach(movement => {
            // Store balance before movement
            movement.balanceBefore = currentBalance;
            
            if (movement.type === 'set' || movement.type === 'adjustment') {
                // For set operations, check if it's a set type
                const adjustment = movements.find(m => m.refNumber === movement.refNumber && m.type === 'adjustment');
                if (adjustment && adjustment.type === 'set') {
                    currentBalance = Math.abs(movement.quantity);
                } else {
                    currentBalance += movement.quantity;
                }
            } else {
                currentBalance += movement.quantity;
            }
            movement.balanceAfter = currentBalance;
        });
        
        // Store items for pagination
        productMovementItems = movements;
        currentPage = 1;
        
        // Render with pagination
        await renderProductMovement();
    } catch (error) {
        console.error('Error loading product movement:', error);
        document.getElementById('productMovementBody').innerHTML = '<tr><td colspan="13" class="empty-state">حدث خطأ أثناء تحميل البيانات</td></tr>';
    }
}

// Helper functions for pagination
function getCurrentItems() {
    switch (currentTab) {
        case 'customer-statement':
            return customerStatementItems;
        case 'supplier-statement':
            return supplierStatementItems;
        case 'product-movement':
            return productMovementItems;
        case 'delivery-notes-settlements':
            return deliveryNotesSettlementsItems;
        case 'operating-expenses':
            return operatingExpensesItems;
        default:
            return [];
    }
}

function getTotalPages() {
    const items = getCurrentItems();
    if (itemsPerPage === Infinity || itemsPerPage >= items.length) {
        return 1;
    }
    return Math.ceil(items.length / itemsPerPage);
}

function updatePaginationDisplay() {
    const paginationContainer = document.getElementById('paginationContainer');
    const items = getCurrentItems();
    
    if (items.length === 0) {
        paginationContainer.style.display = 'none';
        return;
    }
    
    paginationContainer.style.display = 'flex';
    renderPagination();
}

function renderPagination() {
    const items = getCurrentItems();
    const totalPages = getTotalPages();
    const startIndex = itemsPerPage === Infinity ? 0 : (currentPage - 1) * itemsPerPage;
    const endIndex = itemsPerPage === Infinity ? items.length : Math.min(startIndex + itemsPerPage, items.length);
    
    // Update pagination info
    document.getElementById('paginationInfo').textContent = 
        `عرض ${startIndex + 1} - ${endIndex} من ${items.length}`;
    
    // Hide/show pagination controls based on itemsPerPage
    const showPagination = itemsPerPage !== Infinity && totalPages > 1;
    document.getElementById('prevPageBtn').style.display = showPagination ? '' : 'none';
    document.getElementById('nextPageBtn').style.display = showPagination ? '' : 'none';
    document.getElementById('pageNumbers').style.display = showPagination ? '' : 'none';
    
    // Update pagination buttons
    document.getElementById('prevPageBtn').disabled = currentPage === 1;
    document.getElementById('nextPageBtn').disabled = currentPage >= totalPages;
    
    // Render page numbers
    const pageNumbersEl = document.getElementById('pageNumbers');
    pageNumbersEl.innerHTML = '';
    
    if (showPagination) {
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
                await renderCurrentTab();
            });
            pageNumbersEl.appendChild(pageBtn);
        }
    }
}

async function renderCurrentTab() {
    switch (currentTab) {
        case 'customer-statement':
            await renderCustomerStatement();
            break;
        case 'supplier-statement':
            await renderSupplierStatement();
            break;
        case 'product-movement':
            await renderProductMovement();
            break;
        case 'delivery-notes-settlements':
            renderDeliveryNotesSettlements();
            break;
        case 'operating-expenses':
            renderOperatingExpenses();
            break;
    }
}

// Render Customer Statement with pagination
async function renderCustomerStatement() {
    const tbody = document.getElementById('customerStatementBody');
    const items = customerStatementItems;
    
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="empty-state">لا توجد حركات في الفترة المحددة</td></tr>';
        document.getElementById('paginationContainer').style.display = 'none';
        return;
    }
    
    // Calculate pagination
    const totalPages = getTotalPages();
    const startIndex = itemsPerPage === Infinity ? 0 : (currentPage - 1) * itemsPerPage;
    const endIndex = itemsPerPage === Infinity ? items.length : Math.min(startIndex + itemsPerPage, items.length);
    const paginatedItems = itemsPerPage === Infinity ? items : items.slice(startIndex, endIndex);
    
    // Render items
    tbody.innerHTML = '';
    for (const item of paginatedItems) {
        // Determine type class for badge
        let typeClass = 'invoice';
        if (item.type === 'فاتورة مبيعات') {
            typeClass = 'invoice';
        } else if (item.type === 'سند قبض') {
            typeClass = 'receipt';
        } else if (item.type === 'مرتجع من عميل') {
            typeClass = 'return';
        }
        
        // Format type label
        let typeLabel = item.type;
        
        // Format time from createdAt or updatedAt
        const timeValue = item.createdAt || item.updatedAt || item.date;
        const timeDate = new Date(timeValue);
        const timeString = timeDate.toLocaleTimeString('ar-EG', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: true 
        });
        
        // Format createdAt (date and time)
        const createdAtValue = item.createdAt || item.updatedAt || item.date;
        const createdAtDate = new Date(createdAtValue);
        const createdAtDateStr = createdAtDate.toLocaleDateString('ar-EG');
        const createdAtTimeStr = createdAtDate.toLocaleTimeString('ar-EG', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: true 
        });
        const createdAtFull = `${createdAtDateStr} ${createdAtTimeStr}`;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.code}</td>
            <td>${item.refNumber}</td>
            <td>${new Date(item.date).toLocaleDateString('ar-EG')}</td>
            <td>${timeString}</td>
            <td>${createdAtFull}</td>
            <td><span class="movement-type-badge ${typeClass}">${typeLabel}</span></td>
            <td>${formatCurrency(item.totalMovement || item.invoiceAmount || 0)}</td>
            <td class="${item.oldBalance >= 0 ? 'balance-positive' : 'balance-negative'}">${formatCurrency(item.oldBalance)}</td>
            <td>${formatCurrency(item.paid)}</td>
            <td class="${item.newBalance >= 0 ? 'balance-positive' : 'balance-negative'}">${formatCurrency(item.newBalance)}</td>
            <td>${item.notes || '-'}</td>
        `;
        tbody.appendChild(row);
    }
    
    // Update pagination
    updatePaginationDisplay();
}

// Render Supplier Statement with pagination
async function renderSupplierStatement() {
    const tbody = document.getElementById('supplierStatementBody');
    const items = supplierStatementItems;
    
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="empty-state">لا توجد حركات في الفترة المحددة</td></tr>';
        document.getElementById('paginationContainer').style.display = 'none';
        return;
    }
    
    // Calculate pagination
    const totalPages = getTotalPages();
    const startIndex = itemsPerPage === Infinity ? 0 : (currentPage - 1) * itemsPerPage;
    const endIndex = itemsPerPage === Infinity ? items.length : Math.min(startIndex + itemsPerPage, items.length);
    const paginatedItems = itemsPerPage === Infinity ? items : items.slice(startIndex, endIndex);
    
    // Render items
    tbody.innerHTML = '';
    for (const item of paginatedItems) {
        // Determine type class for badge
        let typeClass = 'purchase-invoice';
        if (item.type === 'فاتورة مشتريات') {
            typeClass = 'purchase-invoice';
        } else if (item.type === 'سند صرف') {
            typeClass = 'payment';
        } else if (item.type === 'مرتجع إلى مورد') {
            typeClass = 'return';
        }
        
        // Format type label
        let typeLabel = item.type;
        
        // Format time from createdAt or updatedAt
        const timeValue = item.createdAt || item.updatedAt || item.date;
        const timeDate = new Date(timeValue);
        const timeString = timeDate.toLocaleTimeString('ar-EG', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: true 
        });
        
        // Format createdAt (date and time)
        const createdAtValue = item.createdAt || item.updatedAt || item.date;
        const createdAtDate = new Date(createdAtValue);
        const createdAtDateStr = createdAtDate.toLocaleDateString('ar-EG');
        const createdAtTimeStr = createdAtDate.toLocaleTimeString('ar-EG', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: true 
        });
        const createdAtFull = `${createdAtDateStr} ${createdAtTimeStr}`;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.code}</td>
            <td>${item.refNumber}</td>
            <td>${new Date(item.date).toLocaleDateString('ar-EG')}</td>
            <td>${timeString}</td>
            <td>${createdAtFull}</td>
            <td><span class="movement-type-badge ${typeClass}">${typeLabel}</span></td>
            <td>${formatCurrency(item.totalMovement || item.invoiceAmount || 0)}</td>
            <td class="${item.oldBalance >= 0 ? 'balance-positive' : 'balance-negative'}">${formatCurrency(item.oldBalance)}</td>
            <td>${formatCurrency(item.paid)}</td>
            <td class="${item.newBalance >= 0 ? 'balance-positive' : 'balance-negative'}">${formatCurrency(item.newBalance)}</td>
            <td>${item.notes || '-'}</td>
        `;
        tbody.appendChild(row);
    }
    
    // Update pagination
    updatePaginationDisplay();
}

// Render Product Movement with pagination
async function renderProductMovement() {
    const tbody = document.getElementById('productMovementBody');
    const items = productMovementItems;
    
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="14" class="empty-state">لا توجد حركات في الفترة المحددة</td></tr>';
        document.getElementById('paginationContainer').style.display = 'none';
        return;
    }
    
    // Calculate pagination
    const totalPages = getTotalPages();
    const startIndex = itemsPerPage === Infinity ? 0 : (currentPage - 1) * itemsPerPage;
    const endIndex = itemsPerPage === Infinity ? items.length : Math.min(startIndex + itemsPerPage, items.length);
    const paginatedItems = itemsPerPage === Infinity ? items : items.slice(startIndex, endIndex);
    
    // Render items
    tbody.innerHTML = '';
    for (const movement of paginatedItems) {
        const quantityClass = movement.quantity > 0 ? 'quantity-positive' : 
                             movement.quantity < 0 ? 'quantity-negative' : 'quantity-set';
        
        // Format type label
        let typeLabel = movement.typeLabel;
        
        // Format time from createdAt
        const timeValue = movement.createdAt || movement.date;
        const timeDate = new Date(timeValue);
        const timeString = timeDate.toLocaleTimeString('ar-EG', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: true 
        });
        
        // Format createdAt (date and time)
        const createdAtValue = movement.createdAt || movement.updatedAt || movement.date;
        const createdAtDate = new Date(createdAtValue);
        const createdAtDateStr = createdAtDate.toLocaleDateString('ar-EG');
        const createdAtTimeStr = createdAtDate.toLocaleTimeString('ar-EG', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: true 
        });
        const createdAtFull = `${createdAtDateStr} ${createdAtTimeStr}`;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${new Date(movement.date).toLocaleDateString('ar-EG')}</td>
            <td>${timeString}</td>
            <td>${createdAtFull}</td>
            <td><span class="movement-type-badge ${movement.type}">${typeLabel}</span></td>
            <td>${movement.refNumber}</td>
            <td>${movement.productName}</td>
            <td>${movement.category || 'غير محدد'}</td>
            <td>${movement.unit}</td>
            <td>${formatArabicNumber(movement.balanceBefore, 0)}</td>
            <td class="${quantityClass}">${movement.quantity > 0 ? '+' : ''}${formatArabicNumber(movement.quantity, 0)}</td>
            <td>${formatArabicNumber(movement.balanceAfter, 0)}</td>
            <td>${movement.price > 0 ? formatCurrency(movement.price) : '-'}</td>
            <td>${movement.total > 0 ? formatCurrency(movement.total) : '-'}</td>
            <td>${movement.user}</td>
        `;
        tbody.appendChild(row);
    }
    
    // Update pagination
    updatePaginationDisplay();
}

// Load Delivery Notes
async function loadDeliveryNotesSettlements() {
    const dateFrom = document.getElementById('dnDateFrom').value;
    const dateTo = document.getElementById('dnDateTo').value;
    
    try {
        const tbody = document.getElementById('deliveryNotesSettlementsBody');
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">جارٍ التحميل...</td></tr>';
        
        const items = [];
        
        // Load delivery notes
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            let query = '';
            let params = [];
            
            if (dateFrom) {
                query += 'date >= ?';
                params.push(dateFrom);
            }
            if (dateTo) {
                if (query) query += ' AND ';
                query += 'date <= ?';
                params.push(dateTo);
            }
            
            const deliveryNotes = await window.electronAPI.dbGetAll('delivery_notes', query, params) || [];
            
            for (const note of deliveryNotes) {
                // Load note items
                const noteItems = await window.electronAPI.dbGetAll('delivery_note_items', 'deliveryNoteId = ?', [note.id]) || [];
                
                // Create items for each note item
                for (const noteItem of noteItems) {
                    const product = products.find(p => p.id === noteItem.productId);
                    
                    items.push({
                        date: note.date,
                        createdAt: note.createdAt || note.updatedAt || note.date,
                        updatedAt: note.updatedAt || note.createdAt || note.date,
                        deliveryNoteNumber: note.deliveryNoteNumber || note.id,
                        warehouseKeeperName: note.warehouseKeeperName || note.salesRepName || '',
                        productName: noteItem.productName || product?.name || 'غير معروف',
                        issuedQuantity: parseFloat(noteItem.quantity || 0),
                        unit: noteItem.unitName || noteItem.unit || ''
                    });
                }
            }
        }
        
        // Sort by createdAt (actual time of operation) - oldest first
        // This ensures correct chronological order even if date is set to future/past
        items.sort((a, b) => {
            const timeA = new Date(a.createdAt || a.updatedAt || a.date);
            const timeB = new Date(b.createdAt || b.updatedAt || b.date);
            return timeA.getTime() - timeB.getTime();
        });
        
        // Store items for pagination
        deliveryNotesSettlementsItems = items;
        currentPage = 1;
        
        // Render with pagination
        renderDeliveryNotesSettlements();
    } catch (error) {
        console.error('Error loading delivery notes:', error);
        document.getElementById('deliveryNotesSettlementsBody').innerHTML = '<tr><td colspan="7" class="empty-state">حدث خطأ أثناء تحميل البيانات</td></tr>';
    }
}

// Render Delivery Notes
function renderDeliveryNotesSettlements() {
    const tbody = document.getElementById('deliveryNotesSettlementsBody');
    const items = deliveryNotesSettlementsItems;
    
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">لا توجد بيانات في الفترة المحددة</td></tr>';
        document.getElementById('paginationContainer').style.display = 'none';
        return;
    }
    
    // Calculate pagination
    const totalPages = getTotalPages();
    const startIndex = itemsPerPage === Infinity ? 0 : (currentPage - 1) * itemsPerPage;
    const endIndex = itemsPerPage === Infinity ? items.length : Math.min(startIndex + itemsPerPage, items.length);
    const paginatedItems = itemsPerPage === Infinity ? items : items.slice(startIndex, endIndex);
    
    // Render items
    tbody.innerHTML = paginatedItems.map(item => {
        // Format createdAt (date and time)
        const createdAtValue = item.createdAt || item.updatedAt || item.date;
        const createdAtDate = new Date(createdAtValue);
        const createdAtDateStr = createdAtDate.toLocaleDateString('ar-EG');
        const createdAtTimeStr = createdAtDate.toLocaleTimeString('ar-EG', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: true 
        });
        const createdAtFull = `${createdAtDateStr} ${createdAtTimeStr}`;
        
        return `
            <tr>
                <td>${new Date(item.date).toLocaleDateString('ar-EG')}</td>
                <td>${createdAtFull}</td>
                <td><strong>${item.deliveryNoteNumber}</strong></td>
                <td>${item.warehouseKeeperName}</td>
                <td>${item.productName}</td>
                <td>${formatArabicNumber(item.issuedQuantity, 0)}</td>
                <td>${item.unit}</td>
            </tr>
        `;
    }).join('');
    
    // Update pagination
    updatePaginationDisplay();
}

// Load Operating Expenses
async function loadOperatingExpenses() {
    const dateFrom = document.getElementById('expensesDateFrom').value;
    const dateTo = document.getElementById('expensesDateTo').value;
    const typeFilter = document.getElementById('expensesTypeFilter').value;
    const recipientFilter = document.getElementById('expensesRecipientFilter').value;
    
    try {
        // Ensure users are loaded
        if (!users || users.length === 0) {
            await loadInitialData();
        }
        
        const tbody = document.getElementById('operatingExpensesBody');
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">جارٍ التحميل...</td></tr>';
        
        // Load and populate recipient filter dropdown
        await populateRecipientFilter();
        
        let expenses = [];
        
        // Load expenses from database
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            let query = '';
            let params = [];
            
            if (dateFrom) {
                query += 'date >= ?';
                params.push(dateFrom);
            }
            if (dateTo) {
                if (query) query += ' AND ';
                query += 'date <= ?';
                params.push(dateTo);
            }
            
            if (typeFilter) {
                if (query) query += ' AND ';
                if (typeFilter === 'salaries') {
                    query += 'category = ?';
                    params.push('salaries');
                } else if (typeFilter === 'operational') {
                    query += 'category != ?';
                    params.push('salaries');
                }
            }
            
            if (recipientFilter) {
                if (query) query += ' AND ';
                query += 'recipientName = ?';
                params.push(recipientFilter);
            }
            
            expenses = await window.electronAPI.dbGetAll('operating_expenses', query, params);
            expenses = Array.isArray(expenses) ? expenses : [];
        } else {
            // Fallback to localStorage
            const stored = localStorage.getItem('asel_operating_expenses');
            expenses = stored ? JSON.parse(stored) : [];
        }
        
        // Filter by date if needed (for localStorage fallback)
        if (dateFrom || dateTo) {
            expenses = expenses.filter(expense => {
                const expenseDate = new Date(expense.date);
                if (dateFrom && expenseDate < new Date(dateFrom)) return false;
                if (dateTo) {
                    const toDate = new Date(dateTo);
                    toDate.setHours(23, 59, 59, 999);
                    if (expenseDate > toDate) return false;
                }
                return true;
            });
        }
        
        // Filter by type if needed (for localStorage fallback)
        if (typeFilter) {
            if (typeFilter === 'salaries') {
                expenses = expenses.filter(expense => expense.category === 'salaries');
            } else if (typeFilter === 'operational') {
                expenses = expenses.filter(expense => expense.category !== 'salaries');
            }
        }
        
        // Filter by recipient if needed (for localStorage fallback)
        if (recipientFilter) {
            expenses = expenses.filter(expense => expense.recipientName === recipientFilter);
        }
        
        // Sort by createdAt (actual time of operation) - oldest first
        // This ensures correct chronological order even if date is set to future/past
        expenses.sort((a, b) => {
            const timeA = new Date(a.createdAt || a.updatedAt || a.date);
            const timeB = new Date(b.createdAt || b.updatedAt || b.date);
            return timeA.getTime() - timeB.getTime();
        });
        
        // Map expenses to items format
        operatingExpensesItems = expenses.map(expense => {
            // Get category name
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
            
            // Get user name
            const userName = getUserName(expense.userId);
            
            return {
                date: expense.date,
                createdAt: expense.createdAt || expense.date,
                updatedAt: expense.updatedAt || expense.createdAt || expense.date,
                expenseNumber: expense.expenseNumber || '-',
                category: categoryNames[expense.category] || expense.category,
                amount: expense.amount || 0,
                recipientName: expense.recipientName || '-',
                description: expense.description || '-',
                user: userName
            };
        });
        
        // Reset to first page
        currentPage = 1;
        
        // Render expenses
        renderOperatingExpenses();
    } catch (error) {
        console.error('Error loading operating expenses:', error);
        document.getElementById('operatingExpensesBody').innerHTML = '<tr><td colspan="8" class="empty-state">حدث خطأ أثناء تحميل البيانات</td></tr>';
    }
}

// Populate Recipient Filter Dropdown
async function populateRecipientFilter() {
    const recipientSelect = document.getElementById('expensesRecipientFilter');
    if (!recipientSelect) {
        console.log('[Action Logs] expensesRecipientFilter element not found');
        return;
    }
    
    try {
        // Get all expenses to extract unique recipient names
        let allExpenses = [];
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            allExpenses = await window.electronAPI.dbGetAll('operating_expenses', '', []);
            allExpenses = Array.isArray(allExpenses) ? allExpenses : [];
        } else {
            // Fallback to localStorage
            const stored = localStorage.getItem('asel_operating_expenses');
            allExpenses = stored ? JSON.parse(stored) : [];
        }
        
        // Extract unique recipient names - check both recipientName and toName fields
        const uniqueRecipients = [...new Set(allExpenses
            .map(expense => {
                // Try recipientName first, then toName as fallback
                return expense.recipientName || expense.toName || '';
            })
            .filter(name => name && name.trim() !== '' && name !== '-')
        )].sort();
        
        console.log('[Action Logs] Found', allExpenses.length, 'expenses');
        console.log('[Action Logs] Unique recipients:', uniqueRecipients);
        
        // Store current selection
        const currentValue = recipientSelect.value;
        
        // Clear and populate dropdown
        recipientSelect.innerHTML = '<option value="">جميع المستلمين</option>';
        uniqueRecipients.forEach(recipient => {
            const option = document.createElement('option');
            option.value = recipient;
            option.textContent = recipient;
            recipientSelect.appendChild(option);
        });
        
        // Restore selection if it still exists
        if (currentValue && uniqueRecipients.includes(currentValue)) {
            recipientSelect.value = currentValue;
        }
    } catch (error) {
        console.error('Error populating recipient filter:', error);
    }
}

// Render Operating Expenses
function renderOperatingExpenses() {
    const tbody = document.getElementById('operatingExpensesBody');
    const items = operatingExpensesItems;
    
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-state">لا توجد بيانات في الفترة المحددة</td></tr>';
        document.getElementById('paginationContainer').style.display = 'none';
        return;
    }
    
    // Calculate pagination
    const totalPages = getTotalPages();
    const startIndex = itemsPerPage === Infinity ? 0 : (currentPage - 1) * itemsPerPage;
    const endIndex = itemsPerPage === Infinity ? items.length : Math.min(startIndex + itemsPerPage, items.length);
    const paginatedItems = itemsPerPage === Infinity ? items : items.slice(startIndex, endIndex);
    
    // Render items
    tbody.innerHTML = paginatedItems.map(item => {
        // Format time from createdAt or updatedAt
        const timeValue = item.createdAt || item.updatedAt || item.date;
        const timeDate = new Date(timeValue);
        const timeString = timeDate.toLocaleTimeString('ar-EG', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: true 
        });
        
        // Format createdAt (date and time)
        const createdAtValue = item.createdAt || item.updatedAt || item.date;
        const createdAtDate = new Date(createdAtValue);
        const createdAtDateStr = createdAtDate.toLocaleDateString('ar-EG');
        const createdAtTimeStr = createdAtDate.toLocaleTimeString('ar-EG', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: true 
        });
        const createdAtFull = `${createdAtDateStr} ${createdAtTimeStr}`;
        
        return `
            <tr>
                <td>${new Date(item.date).toLocaleDateString('ar-EG')}</td>
                <td>${timeString}</td>
                <td>${createdAtFull}</td>
                <td><strong>${item.expenseNumber}</strong></td>
                <td>${item.category}</td>
                <td class="balance-positive">${formatCurrency(item.amount)}</td>
                <td>${item.recipientName}</td>
                <td>${item.description}</td>
                <td>${item.user}</td>
            </tr>
        `;
    }).join('');
    
    // Update pagination
    updatePaginationDisplay();
}

// Convert table to CSV
function tableToCSV(table) {
    const rows = table.querySelectorAll('tr');
    const csv = [];
    
    rows.forEach((row, index) => {
        const cols = row.querySelectorAll('th, td');
        const csvRow = [];
        
        cols.forEach(col => {
            let text = col.textContent.trim();
            // Remove badges and formatting
            text = text.replace(/\s+/g, ' ');
            // Escape quotes and wrap in quotes if contains comma
            if (text.includes(',') || text.includes('"') || text.includes('\n')) {
                text = '"' + text.replace(/"/g, '""') + '"';
            }
            csvRow.push(text);
        });
        
        csv.push(csvRow.join(','));
    });
    
    // Add BOM for Excel UTF-8 support
    return '\uFEFF' + csv.join('\n');
}

// Save report as Excel (CSV) - uses all data, not just current page
function saveReport(type) {
    try {
        let items = [];
        let filename = '';
        let headers = [];
        
        if (type === 'customer') {
            items = customerStatementItems;
            const customerName = document.getElementById('customerSelect').selectedOptions[0]?.text || 'عميل';
            filename = `كشف_حساب_${customerName}_${new Date().toISOString().split('T')[0]}.csv`;
            headers = ['كود الحركة', 'رقم المرجع', 'التاريخ', 'التوقيت', 'وقت الإضافة في النظام', 'نوع الحركة', 'إجمالي الحركة', 'الرصيد قبل الحركة', 'المدفوع أثناء الحركة', 'الرصيد الجديد', 'ملاحظات'];
        } else if (type === 'supplier') {
            items = supplierStatementItems;
            const supplierName = document.getElementById('supplierSelect').selectedOptions[0]?.text || 'مورد';
            filename = `كشف_حساب_${supplierName}_${new Date().toISOString().split('T')[0]}.csv`;
            headers = ['كود الحركة', 'رقم المرجع', 'التاريخ', 'التوقيت', 'وقت الإضافة في النظام', 'نوع الحركة', 'إجمالي الحركة', 'الرصيد قبل الحركة', 'المدفوع أثناء الحركة', 'الرصيد الجديد', 'ملاحظات'];
        } else if (type === 'product') {
            items = productMovementItems;
            const productName = document.getElementById('productSelect').selectedOptions[0]?.text || 'منتج';
            filename = `حركة_${productName}_${new Date().toISOString().split('T')[0]}.csv`;
            headers = ['التاريخ', 'التوقيت', 'وقت الإضافة في النظام', 'نوع الحركة', 'رقم المرجع', 'اسم المنتج', 'الصنف', 'الوحدة', 'الكمية قبل الحركة', 'كمية الحركة', 'الكمية بعد الحركة', 'السعر', 'إجمالي الحركة', 'المستخدم'];
        } else if (type === 'delivery-notes-settlements') {
            items = deliveryNotesSettlementsItems;
            filename = `أذونات_الصرف_${new Date().toISOString().split('T')[0]}.csv`;
            headers = ['التاريخ', 'وقت الإضافة في النظام', 'رقم إذن الصرف', 'أمين المخزن', 'اسم المنتج', 'الكمية المصروفة', 'الوحدة', 'الحالة'];
        }
        
        if (!items || items.length === 0) {
            if (window.showToast) {
                window.showToast('لا يوجد بيانات للتصدير', 'error');
            } else {
            alert('❌ لا يوجد بيانات للتصدير');
            }
            return;
        }
        
        // Create CSV with all data
        const csvRows = [];
        csvRows.push(headers.join(','));
        
        items.forEach(item => {
            const row = [];
            if (type === 'customer' || type === 'supplier') {
                const timeValue = item.createdAt || item.updatedAt || item.date;
                const timeDate = new Date(timeValue);
                const timeString = timeDate.toLocaleTimeString('ar-EG', { 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    second: '2-digit',
                    hour12: true 
                });
                const createdAtValue = item.createdAt || item.updatedAt || item.date;
                const createdAtDate = new Date(createdAtValue);
                const createdAtFull = `${createdAtDate.toLocaleDateString('ar-EG')} ${createdAtDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`;
                
                row.push(item.code || '');
                row.push(item.refNumber || '');
                row.push(new Date(item.date).toLocaleDateString('ar-EG'));
                row.push(timeString);
                row.push(createdAtFull);
                row.push(item.type || '');
                row.push(item.totalMovement || item.invoiceAmount || 0);
                row.push(item.oldBalance || 0);
                row.push(item.paid || 0);
                row.push(item.newBalance || 0);
                row.push(item.notes || '');
            } else if (type === 'inventory') {
                row.push(new Date(item.date).toLocaleDateString('ar-EG'));
                row.push(item.typeLabel || '');
                row.push(item.refNumber || '');
                row.push(item.productName || '');
                row.push(item.unit || '');
                row.push(item.balanceBefore || 0);
                row.push(item.quantity || 0);
                row.push(item.balanceAfter || 0);
                row.push(item.user || '');
            } else if (type === 'product') {
                const timeValue = item.createdAt || item.date;
                const timeDate = new Date(timeValue);
                const timeString = timeDate.toLocaleTimeString('ar-EG', { 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    second: '2-digit',
                    hour12: true 
                });
                const createdAtValue = item.createdAt || item.updatedAt || item.date;
                const createdAtDate = new Date(createdAtValue);
                const createdAtFull = `${createdAtDate.toLocaleDateString('ar-EG')} ${createdAtDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`;
                
                row.push(new Date(item.date).toLocaleDateString('ar-EG'));
                row.push(timeString);
                row.push(createdAtFull);
                row.push(item.typeLabel || '');
                row.push(item.refNumber || '');
                row.push(item.productName || '');
                row.push(item.category || 'غير محدد');
                row.push(item.unit || '');
                row.push(item.balanceBefore || 0);
                row.push(item.quantity || 0);
                row.push(item.balanceAfter || 0);
                row.push(item.price || 0);
                row.push(item.total || 0);
                row.push(item.user || '');
            } else if (type === 'delivery-notes-settlements') {
                const createdAtValue = item.createdAt || item.updatedAt || item.date;
                const createdAtDate = new Date(createdAtValue);
                const createdAtFull = `${createdAtDate.toLocaleDateString('ar-EG')} ${createdAtDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`;
                
                row.push(new Date(item.date).toLocaleDateString('ar-EG'));
                row.push(createdAtFull);
                row.push(item.deliveryNoteNumber || '');
                row.push(item.warehouseKeeperName || '');
                row.push(item.productName || '');
                row.push(item.issuedQuantity || 0);
                row.push(item.unit || '');
            }
            csvRows.push(row.join(','));
        });
        
        // Add BOM for Excel UTF-8 support
        const csv = '\uFEFF' + csvRows.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        
        if (window.showToast) {
            window.showToast('تم حفظ التقرير بنجاح كملف Excel', 'success');
        } else {
        alert('✅ تم حفظ التقرير بنجاح كملف Excel');
        }
    } catch (error) {
        console.error('Error saving report:', error);
        if (window.showToast) {
            window.showToast('حدث خطأ أثناء حفظ التقرير', 'error');
        } else {
        alert('❌ حدث خطأ أثناء حفظ التقرير');
        }
    }
}

// Generate full statement HTML with header and footer
async function generateStatementHTML(type) {
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
    
    let data = null;
    let title = '';
    let entityName = '';
    let entityCode = '';
    let entityAddress = '';
    let entityPhone = '';
    let isCustomer = false;
    
    if (type === 'customer') {
        data = customerStatementData;
        isCustomer = true;
        if (!data || !data.customer) {
            if (window.showToast) {
                window.showToast('يرجى تحميل كشف الحساب أولاً', 'error');
            } else {
            alert('❌ يرجى تحميل كشف الحساب أولاً');
            }
            return null;
        }
        const customer = data.customer;
        title = 'كشف حساب عميل';
        entityName = customer.name || customer.customerName || 'غير معروف';
        entityCode = customer.code || customer.customerCode || customer.id || '-';
        entityAddress = customer.address || '-';
        entityPhone = customer.phone || customer.mobile || '-';
    } else if (type === 'supplier') {
        data = supplierStatementData;
        if (!data || !data.supplier) {
            if (window.showToast) {
                window.showToast('يرجى تحميل كشف الحساب أولاً', 'error');
            } else {
            alert('❌ يرجى تحميل كشف الحساب أولاً');
            }
            return null;
        }
        const supplier = data.supplier;
        title = 'كشف حساب مورد';
        entityName = supplier.name || supplier.supplierName || 'غير معروف';
        entityCode = supplier.code || supplier.supplierCode || supplier.id || '-';
        entityAddress = supplier.address || '-';
        entityPhone = supplier.phone || supplier.mobile || '-';
        } else {
            // For inventory, product movements, and delivery notes settlements, generate HTML from all data
            let items = [];
            let headers = [];
            
            if (type === 'product') {
                items = productMovementItems;
                const productName = document.getElementById('productSelect').selectedOptions[0]?.text || 'منتج';
                title = `حركة منتج - ${productName}`;
                headers = ['التاريخ', 'التوقيت', 'وقت الإضافة في النظام', 'نوع الحركة', 'رقم المرجع', 'اسم المنتج', 'الصنف', 'الوحدة', 'الكمية قبل الحركة', 'كمية الحركة', 'الكمية بعد الحركة', 'السعر', 'إجمالي الحركة', 'المستخدم'];
            } else if (type === 'delivery-notes-settlements') {
                items = deliveryNotesSettlementsItems;
                title = 'أذونات الصرف';
                headers = ['التاريخ', 'وقت الإضافة في النظام', 'رقم إذن الصرف', 'أمين المخزن', 'اسم المنتج', 'الكمية المصروفة', 'الوحدة'];
            } else if (type === 'operating-expenses') {
                items = operatingExpensesItems;
                title = 'المصاريف التشغيلية';
                headers = ['التاريخ', 'التوقيت', 'وقت الإضافة في النظام', 'رقم المصروف', 'نوع المصروف', 'المبلغ', 'لمن صرف له', 'الوصف / الغرض', 'المستخدم'];
            }
            
            if (!items || items.length === 0) {
                if (window.showToast) {
                    window.showToast('لا يوجد بيانات للطباعة', 'error');
                } else {
                alert('❌ لا يوجد بيانات للطباعة');
                }
                return null;
            }
            
            // Generate table rows from all items
            const tableRows = items.map(item => {
                if (type === 'inventory') {
                    const quantityClass = item.quantity > 0 ? 'quantity-positive' : 
                                         item.quantity < 0 ? 'quantity-negative' : 'quantity-set';
                    return `
                        <tr>
                            <td>${new Date(item.date).toLocaleDateString('ar-EG')}</td>
                            <td>${item.typeLabel}</td>
                            <td>${item.refNumber}</td>
                            <td>${item.productName}</td>
                            <td>${item.unit}</td>
                            <td>${formatArabicNumber(item.balanceBefore, 0)}</td>
                            <td>${item.quantity > 0 ? '+' : ''}${formatArabicNumber(item.quantity, 0)}</td>
                            <td>${formatArabicNumber(item.balanceAfter, 0)}</td>
                            <td>${item.user}</td>
                        </tr>
                    `;
                } else if (type === 'product') {
                    const quantityClass = item.quantity > 0 ? 'quantity-positive' : 
                                         item.quantity < 0 ? 'quantity-negative' : 'quantity-set';
                    const timeValue = item.createdAt || item.date;
                    const timeDate = new Date(timeValue);
                    const timeString = timeDate.toLocaleTimeString('ar-EG', { 
                        hour: '2-digit', 
                        minute: '2-digit', 
                        second: '2-digit',
                        hour12: true 
                    });
                    const createdAtValue = item.createdAt || item.updatedAt || item.date;
                    const createdAtDate = new Date(createdAtValue);
                    const createdAtFull = `${createdAtDate.toLocaleDateString('ar-EG')} ${createdAtDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`;
                    return `
                        <tr>
                            <td>${new Date(item.date).toLocaleDateString('ar-EG')}</td>
                            <td>${timeString}</td>
                            <td>${createdAtFull}</td>
                            <td>${item.typeLabel}</td>
                            <td>${item.refNumber}</td>
                            <td>${item.productName}</td>
                            <td>${item.category || 'غير محدد'}</td>
                            <td>${item.unit}</td>
                            <td>${formatArabicNumber(item.balanceBefore, 0)}</td>
                            <td>${item.quantity > 0 ? '+' : ''}${formatArabicNumber(item.quantity, 0)}</td>
                            <td>${formatArabicNumber(item.balanceAfter, 0)}</td>
                            <td>${item.price > 0 ? formatCurrency(item.price) : '-'}</td>
                            <td>${item.total > 0 ? formatCurrency(item.total) : '-'}</td>
                            <td>${item.user}</td>
                        </tr>
                    `;
                } else if (type === 'delivery-notes-settlements') {
                    const createdAtValue = item.createdAt || item.updatedAt || item.date;
                    const createdAtDate = new Date(createdAtValue);
                    const createdAtFull = `${createdAtDate.toLocaleDateString('ar-EG')} ${createdAtDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`;
                    return `
                        <tr>
                            <td>${new Date(item.date).toLocaleDateString('ar-EG')}</td>
                            <td>${createdAtFull}</td>
                            <td><strong>${item.deliveryNoteNumber}</strong></td>
                            <td>${item.warehouseKeeperName}</td>
                            <td>${item.productName}</td>
                            <td>${formatArabicNumber(item.issuedQuantity, 0)}</td>
                            <td>${item.unit}</td>
                        </tr>
                    `;
                } else if (type === 'operating-expenses') {
                    const timeValue = item.createdAt || item.updatedAt || item.date;
                    const timeDate = new Date(timeValue);
                    const timeString = timeDate.toLocaleTimeString('ar-EG', { 
                        hour: '2-digit', 
                        minute: '2-digit', 
                        second: '2-digit',
                        hour12: true 
                    });
                    const createdAtValue = item.createdAt || item.updatedAt || item.date;
                    const createdAtDate = new Date(createdAtValue);
                    const createdAtFull = `${createdAtDate.toLocaleDateString('ar-EG')} ${createdAtDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`;
                    return `
                        <tr>
                            <td>${new Date(item.date).toLocaleDateString('ar-EG')}</td>
                            <td>${timeString}</td>
                            <td>${createdAtFull}</td>
                            <td><strong>${item.expenseNumber}</strong></td>
                            <td>${item.category}</td>
                            <td class="balance-positive">${formatCurrency(item.amount)}</td>
                            <td>${item.recipientName}</td>
                            <td>${item.description}</td>
                            <td>${item.user}</td>
                        </tr>
                    `;
                }
            }).join('');
            
            const tableHTML = `
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                    <thead>
                        <tr>
                            ${headers.map(h => `<th style="padding: 8px; text-align: right; border: 1px solid #ddd; background-color: #f5f5f5;">${h}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            `;
            
            return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; direction: rtl; }
        .header-section {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 15px;
            margin-bottom: 20px;
            border-bottom: 2px solid #333;
            padding-bottom: 15px;
        }
        .company-logo {
            width: 60px;
            height: 60px;
            object-fit: contain;
        }
        h1 { text-align: center; margin: 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; text-align: right; border: 1px solid #ddd; }
        th { background-color: #f5f5f5; }
        @media print {
            @page {
                size: A4;
                margin: 10mm;
            }
            body { 
                padding: 10px; 
                margin: 0;
            }
        }
    </style>
</head>
<body>
    <div class="header-section">
        <img src="${logoBase64 || logoPath}" alt="Logo" class="company-logo" />
        <h1>${title}</h1>
    </div>
    ${tableHTML}
</body>
</html>`;
        }
    
    const summary = data.summary;
    const table = document.querySelector(`#${type === 'customer' ? 'customer-statement' : 'supplier-statement'}-tab table`);
    if (!table) {
        alert('❌ لا يوجد بيانات للطباعة');
        return null;
    }
    
    // Generate table rows
    const tableRows = data.statement.map(item => {
        const timeValue = item.createdAt || item.updatedAt || item.date;
        const timeDate = new Date(timeValue);
        const timeString = timeDate.toLocaleTimeString('ar-EG', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: true 
        });
        const createdAtValue = item.createdAt || item.updatedAt || item.date;
        const createdAtDate = new Date(createdAtValue);
        const createdAtFull = `${createdAtDate.toLocaleDateString('ar-EG')} ${createdAtDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`;
        
        return `
        <tr>
            <td style="padding: 6px 4px; font-size: 10px;">${item.code}</td>
            <td style="padding: 6px 4px; font-size: 10px;">${item.refNumber}</td>
            <td style="padding: 6px 4px; font-size: 10px;">${new Date(item.date).toLocaleDateString('ar-EG')}</td>
            <td style="padding: 6px 4px; font-size: 10px;">${timeString}</td>
            <td style="padding: 6px 4px; font-size: 10px;">${createdAtFull}</td>
            <td style="padding: 6px 4px; font-size: 10px;">${item.type}</td>
            <td style="padding: 6px 4px; font-size: 10px;">${formatCurrency(item.totalMovement || item.invoiceAmount || 0)}</td>
            <td style="padding: 6px 4px; font-size: 10px;">${formatCurrency(item.oldBalance)}</td>
            <td style="padding: 6px 4px; font-size: 10px;">${formatCurrency(item.paid)}</td>
            <td style="padding: 6px 4px; font-size: 10px;">${formatCurrency(item.newBalance)}</td>
            <td style="padding: 6px 4px; font-size: 10px;">${item.notes || '-'}</td>
        </tr>
    `;
    }).join('');
    
    const tableHTML = `
        <table class="statement-table" style="width: 100%; border-collapse: collapse; margin-top: 20px; table-layout: auto;">
            <thead>
                <tr>
                    <th style="padding: 6px 4px; text-align: right; border: 1px solid #ddd; background-color: #f5f5f5; font-size: 10px;">كود الحركة</th>
                    <th style="padding: 6px 4px; text-align: right; border: 1px solid #ddd; background-color: #f5f5f5; font-size: 10px;">رقم المرجع</th>
                    <th style="padding: 6px 4px; text-align: right; border: 1px solid #ddd; background-color: #f5f5f5; font-size: 10px;">التاريخ</th>
                    <th style="padding: 6px 4px; text-align: right; border: 1px solid #ddd; background-color: #f5f5f5; font-size: 10px;">التوقيت</th>
                    <th style="padding: 6px 4px; text-align: right; border: 1px solid #ddd; background-color: #f5f5f5; font-size: 10px;">وقت الإضافة في النظام</th>
                    <th style="padding: 6px 4px; text-align: right; border: 1px solid #ddd; background-color: #f5f5f5; font-size: 10px;">نوع الحركة</th>
                    <th style="padding: 6px 4px; text-align: right; border: 1px solid #ddd; background-color: #f5f5f5; font-size: 10px;">إجمالي الحركة</th>
                    <th style="padding: 6px 4px; text-align: right; border: 1px solid #ddd; background-color: #f5f5f5; font-size: 10px;">الرصيد قبل الحركة</th>
                    <th style="padding: 6px 4px; text-align: right; border: 1px solid #ddd; background-color: #f5f5f5; font-size: 10px;">المدفوع أثناء الحركة</th>
                    <th style="padding: 6px 4px; text-align: right; border: 1px solid #ddd; background-color: #f5f5f5; font-size: 10px;">الرصيد الجديد</th>
                    <th style="padding: 6px 4px; text-align: right; border: 1px solid #ddd; background-color: #f5f5f5; font-size: 10px;">ملاحظات</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
    `;
    
    const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            padding: 20px; 
            direction: rtl; 
            position: relative;
        }
        .watermark {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 0;
            pointer-events: none;
            overflow: visible;
        }
        .watermark-item {
            position: absolute;
            transform: rotate(-45deg);
            font-size: 60px;
            font-weight: bold;
            color: rgba(44, 62, 80, 0.08);
            white-space: nowrap;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            pointer-events: none;
            width: 200px;
            height: 50px;
        }
        body > *:not(.watermark) {
            position: relative;
            z-index: 1;
        }
        .header { 
            margin-bottom: 30px; 
            border-bottom: 2px solid #333; 
            padding-bottom: 20px; 
            display: flex;
            gap: 20px;
            align-items: flex-start;
        }
        .company-logo {
            width: 60px;
            height: 60px;
            object-fit: contain;
            flex-shrink: 0;
        }
        .company-info { 
            flex: 1;
            background-color: #f9f9f9;
            padding: 15px;
            border-radius: 5px;
            display: flex;
            gap: 15px;
            align-items: flex-start;
        }
        .company-info-content {
            flex: 1;
        }
        .company-info h2 { margin: 0 0 10px 0; font-size: 20px; }
        .entity-info { 
            flex: 1;
            background-color: #f9f9f9; 
            padding: 15px; 
            border-radius: 5px; 
        }
        .entity-info h3 { margin: 0 0 10px 0; font-size: 18px; color: #333; }
        .summary-section { margin: 20px 0; padding: 15px; background-color: #f0f0f0; border-radius: 5px; }
        .summary-section h3 { margin: 0 0 15px 0; font-size: 16px; }
        .summary-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd; }
        .summary-row:last-child { border-bottom: none; font-weight: bold; font-size: 16px; }
        .summary-label { font-weight: 600; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; table-layout: auto; }
        th, td { padding: 8px; text-align: right; border: 1px solid #ddd; white-space: nowrap; }
        th { background-color: #f5f5f5; font-weight: bold; }
        .statement-table { width: 100%; min-width: 100%; }
        .statement-table th, .statement-table td { padding: 6px 4px; font-size: 11px; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #333; }
        .footer h4 { margin: 15px 0 10px 0; font-size: 16px; }
        .footer p { margin: 8px 0; line-height: 1.6; }
        .signature-section { margin-top: 30px; display: flex; justify-content: space-between; }
        .signature-box { width: 45%; text-align: center; }
        @page {
            size: A4 landscape;
            margin: 5mm;
        }
        @media print {
            @page {
                size: A4 landscape;
                margin: 5mm;
            }
            body { 
                padding: 10px; 
                margin: 0;
                width: 100%;
                max-width: 100%;
            }
            .header, .footer { 
                page-break-inside: avoid; 
                break-inside: avoid;
            }
            .header {
                display: flex;
                gap: 20px;
            }
            .summary-section {
                page-break-inside: avoid;
                break-inside: avoid;
            }
            table {
                page-break-inside: auto;
                break-inside: auto;
                width: 100% !important;
                table-layout: auto !important;
                font-size: 9px !important;
            }
            th, td {
                padding: 3px 2px !important;
                font-size: 8px !important;
                white-space: nowrap !important;
                overflow: visible !important;
            }
            .statement-table {
                width: 100% !important;
                min-width: 100% !important;
                overflow: visible !important;
            }
            .statement-table th, .statement-table td {
                display: table-cell !important;
                visibility: visible !important;
                overflow: visible !important;
            }
            .statement-table tbody tr td {
                display: table-cell !important;
                visibility: visible !important;
            }
            tr {
                page-break-inside: avoid;
                break-inside: avoid;
                page-break-after: auto;
            }
            thead {
                display: table-header-group;
            }
            tfoot {
                display: table-footer-group;
            }
            .signature-section {
                page-break-inside: avoid;
                break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="watermark">
        <div class="watermark-item" style="top: 10%; left: 10%;">شركة أسيل</div>
        <div class="watermark-item" style="top: 10%; left: 60%;">شركة أسيل</div>
        <div class="watermark-item" style="top: 35%; left: 0%;">شركة أسيل</div>
        <div class="watermark-item" style="top: 35%; left: 50%;">شركة أسيل</div>
        <div class="watermark-item" style="top: 60%; left: 25%;">شركة أسيل</div>
        <div class="watermark-item" style="top: 60%; left: 75%;">شركة أسيل</div>
        <div class="watermark-item" style="top: 85%; left: 10%;">شركة أسيل</div>
        <div class="watermark-item" style="top: 85%; left: 60%;">شركة أسيل</div>
    </div>
    <div class="header">
        <div class="company-info">
            <img src="${logoBase64 || logoPath}" alt="Logo" class="company-logo" />
            <div class="company-info-content">
                <h2>${companySettings.name || 'شركة أسيل'}</h2>
                <p><strong>العنوان:</strong> ${companySettings.address || '-'}</p>
                <p><strong>الهاتف:</strong> ${companySettings.phone || '-'}</p>
                <p><strong>البريد الإلكتروني:</strong> ${companySettings.email || '-'}</p>
            </div>
        </div>
        
        <div class="entity-info">
            <h3>بيانات ${isCustomer ? 'العميل' : 'المورد'}</h3>
            <p><strong>اسم ${isCustomer ? 'العميل' : 'المورد'}:</strong> ${entityName}</p>
            <p><strong>رقم ${isCustomer ? 'العميل' : 'المورد'} / كود:</strong> ${entityCode}</p>
            <p><strong>العنوان:</strong> ${entityAddress}</p>
            <p><strong>هاتف / تواصل:</strong> ${entityPhone}</p>
        </div>
    </div>
    
    <div class="summary-section">
        <h3>ملخص الحساب</h3>
        <div class="summary-row">
            <span class="summary-label">رصيد مفتتح بتاريخ ${new Date(summary.firstDate).toLocaleDateString('ar-EG')}:</span>
            <span>${formatCurrency(summary.openingBalance)}</span>
        </div>
        <div class="summary-row">
            <span class="summary-label">الرصيد الختامي بتاريخ ${new Date(summary.lastDate).toLocaleDateString('ar-EG')}:</span>
            <span>${formatCurrency(summary.closingBalance)}</span>
        </div>
    </div>
    
    <h3 style="margin-top: 30px;">تفاصيل المعاملات</h3>
    ${tableHTML}
    
    <div class="footer">
        <h4>ملاحظات وشروط:</h4>
        <p>يرجى التواصل خلال 14 يومًا لتسوية الرصيد إن لزم.</p>
        <p>أي اختلافات يُرجى إثباتها بمستندات (فواتير/إيصالات) خلال 7 أيام من استلام كشف الحساب.</p>
        <p>يتحمل ${isCustomer ? 'العميل' : 'المورد'} أية رسوم تأخير أو فوائد متفق عليها بعد المدة المتفق عليها.</p>
        
        <div class="signature-section">
            <div class="signature-box">
                <p><strong>توقيع المحاسب:</strong></p>
                <p style="margin-top: 40px;">____________________</p>
                ${companySettings.accountantName ? `<p>${companySettings.accountantName}</p>` : ''}
            </div>
            <div class="signature-box">
                <p><strong>الختم:</strong></p>
                <p style="margin-top: 40px;">____________________</p>
            </div>
        </div>
    </div>
</body>
</html>`;
    
    return html;
}

// Print report (print only)
async function printReport(type) {
    try {
        let htmlContent = '';
        
        if (type === 'customer' || type === 'supplier') {
            htmlContent = await generateStatementHTML(type);
            if (!htmlContent) return;
        } else {
            // For inventory and product movements, use generateStatementHTML
            htmlContent = await generateStatementHTML(type);
            if (!htmlContent) return;
        }
        
        // Open window off-screen or very small to minimize visibility
        const printWindow = window.open('', '_blank', 'width=1,height=1,left=-1000,top=-1000');
        if (!printWindow || printWindow.closed || typeof printWindow.closed === 'undefined') {
            console.error('Failed to open print window - may be blocked');
            if (window.showToast) {
                window.showToast('فشل فتح نافذة الطباعة. يرجى التحقق من إعدادات منع النوافذ المنبثقة', 'error');
            } else {
                alert('❌ فشل فتح نافذة الطباعة. يرجى التحقق من إعدادات منع النوافذ المنبثقة');
            }
            return;
        }
        
        printWindow.document.write(htmlContent);
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
                } else {
                    alert('⚠️ تم فتح نافذة الطباعة. يرجى استخدام زر الطباعة في المتصفح');
                }
            }
        }, 500);
    } catch (error) {
        console.error('Error printing report:', error);
        if (window.showToast) {
            window.showToast('حدث خطأ أثناء الطباعة', 'error');
        } else {
        alert('❌ حدث خطأ أثناء الطباعة');
        }
    }
}

// Save report as PDF
async function saveReportAsPDF(type) {
    try {
        let htmlContent = '';
        let filename = '';
        
        if (type === 'customer' || type === 'supplier') {
            htmlContent = await generateStatementHTML(type);
            if (!htmlContent) return;
            
            if (type === 'customer') {
                const customerName = document.getElementById('customerSelect').selectedOptions[0]?.text || 'عميل';
                filename = `كشف_حساب_${customerName}_${new Date().toISOString().split('T')[0]}.pdf`;
            } else {
                const supplierName = document.getElementById('supplierSelect').selectedOptions[0]?.text || 'مورد';
                filename = `كشف_حساب_${supplierName}_${new Date().toISOString().split('T')[0]}.pdf`;
            }
        } else {
            // For inventory, product movements, and delivery notes settlements
            if (type === 'inventory') {
                filename = `حركة_مخزون_${new Date().toISOString().split('T')[0]}.pdf`;
            } else if (type === 'delivery-notes-settlements') {
                filename = `أذونات_الصرف_${new Date().toISOString().split('T')[0]}.pdf`;
            } else {
                const productName = document.getElementById('productSelect').selectedOptions[0]?.text || 'منتج';
                filename = `حركة_${productName}_${new Date().toISOString().split('T')[0]}.pdf`;
            }
            
            htmlContent = await generateStatementHTML(type);
            if (!htmlContent) return;
        }
        
        // Check if Electron API is available
        if (window.electronAPI && window.electronAPI.saveInvoiceToFile) {
            const result = await window.electronAPI.saveInvoiceToFile(htmlContent, filename);
            
            if (result.success) {
                if (window.showToast) {
                    window.showToast('تم حفظ الملف بنجاح', 'success');
                } else {
                alert('✅ تم حفظ الملف بنجاح');
                }
            } else if (result.cancelled) {
                // User cancelled, do nothing
            } else {
                if (window.showToast) {
                    window.showToast('فشل حفظ الملف: ' + (result.error || 'خطأ غير معروف'), 'error');
            } else {
                alert('❌ فشل حفظ الملف: ' + (result.error || 'خطأ غير معروف'));
                }
            }
        } else {
            // Fallback: Use browser print with PDF option
            if (window.showToast) {
                window.showToast('وظيفة حفظ PDF غير متاحة في المتصفح. يرجى استخدام المتصفح لإلغاء الإلغاء والضغط على "حفظ كـ PDF"', 'error');
            } else {
            alert('⚠️ وظيفة حفظ PDF غير متاحة في المتصفح. يرجى استخدام المتصفح لإلغاء الإلغاء والضغط على "حفظ كـ PDF"');
            }
            printReport(type);
        }
    } catch (error) {
        console.error('Error saving PDF:', error);
        if (window.showToast) {
            window.showToast('حدث خطأ أثناء حفظ PDF: ' + error.message, 'error');
        } else {
        alert('❌ حدث خطأ أثناء حفظ PDF: ' + error.message);
        }
    }
}
