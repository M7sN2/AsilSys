// Profit & Loss Reports System

let salesInvoices = [];
let purchaseInvoices = [];
let salesInvoiceItems = [];
let purchaseInvoiceItems = [];
let products = [];
let customers = [];
let suppliers = [];
let categories = [];
let operatingExpenses = [];

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

// Format percentage
function formatPercentage(value) {
    return formatArabicNumber(value, 2) + '%';
}

// Calculate average purchase price for a product up to a specific date
// This is the correct way to calculate COGS - we should use purchase prices
// that were available at the time of sale, not just purchases within the filter range
// Returns price per smallest unit
function calculateAveragePurchasePrice(productId, saleDate = null) {
    const product = products.find(p => p.id === productId);
    if (!product) return 0;
    
    const purchaseItems = purchaseInvoiceItems.filter(pi => pi.productId === productId);
    let totalPurchaseCost = 0;
    let totalPurchaseQtyInSmallestUnit = 0;
    
    purchaseItems.forEach(pi => {
        const purchaseInv = purchaseInvoices.find(pi2 => pi2.id === pi.invoiceId);
        if (purchaseInv) {
            // If saleDate is provided, only consider purchases up to that date
            // Otherwise, consider all purchases (for general average cost)
            let shouldInclude = true;
            if (saleDate) {
                const purchaseDate = purchaseInv.date.split('T')[0];
                shouldInclude = purchaseDate <= saleDate;
            }
            
            if (shouldInclude) {
                // Convert quantity to smallest unit
                let quantityInSmallestUnit = pi.quantity || 0;
                if (pi.unit === 'largest') {
                    const conversionFactor = product.conversionFactor || 1;
                    quantityInSmallestUnit = (pi.quantity || 0) * conversionFactor;
                }
                
                // Price is per unit (smallest or largest), so we need to calculate total cost
                // If unit is largest, price is per largest unit, so multiply by quantity
                // If unit is smallest, price is per smallest unit, so multiply by quantity
                const itemCost = (pi.price || 0) * (pi.quantity || 0);
                
                totalPurchaseCost += itemCost;
                totalPurchaseQtyInSmallestUnit += quantityInSmallestUnit;
            }
        }
    });
    
    // Return average price per smallest unit
    return totalPurchaseQtyInSmallestUnit > 0 ? totalPurchaseCost / totalPurchaseQtyInSmallestUnit : 0;
}

// Load data on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    initializeEventListeners();
    setDefaultDates();
    await applyFilters();
    
    // Listen for expense updates from expenses screen
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const channel = new BroadcastChannel('expense-updates');
            channel.addEventListener('message', async (event) => {
                const { type, action, expenseId, timestamp } = event.data;
                if (type === 'expenseUpdated') {
                    // Wait a bit for database to be updated
                    await new Promise(resolve => setTimeout(resolve, 300));
                    // Reload expenses data
                    operatingExpenses = await window.electronAPI.dbGetAll('operating_expenses');
                    // Reapply filters to update KPIs
                    await applyFilters();
                }
            });
        } catch (error) {
            console.error('Error setting up BroadcastChannel for expenses:', error);
        }
    }
    
    // Periodically check for expense updates (fallback mechanism)
    setInterval(async () => {
        const updateMarker = localStorage.getItem('last_expense_update');
        if (updateMarker) {
            try {
                const updateData = JSON.parse(updateMarker);
                const timeSinceUpdate = Date.now() - updateData.timestamp;
                // If update happened in last 10 seconds, reload data
                if (timeSinceUpdate < 10000) {
                    operatingExpenses = await window.electronAPI.dbGetAll('operating_expenses');
                    await applyFilters();
                }
            } catch (error) {
                // If marker exists but invalid, do normal reload
                operatingExpenses = await window.electronAPI.dbGetAll('operating_expenses');
                await applyFilters();
            }
        }
    }, 2000); // Check every 2 seconds
});

// Initialize Event Listeners
function initializeEventListeners() {
    // Apply Filters Button
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', applyFilters);
    }
    
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', resetFilters);
    }
    
    // Tab buttons
    const tabButtons = document.querySelectorAll('.tab-btn');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const tab = btn.getAttribute('data-tab');
            if (tab) {
                switchTab(tab);
            }
        });
    });

    // Print Report Button
    const printReportBtn = document.getElementById('printReportBtn');
    if (printReportBtn) {
        printReportBtn.addEventListener('click', printReport);
    }
    
    // Save Report as PDF Button
    const saveReportPdfBtn = document.getElementById('saveReportPdfBtn');
    if (saveReportPdfBtn) {
        saveReportPdfBtn.addEventListener('click', saveReportAsPDF);
    }
}

// Set default dates (last 30 days)
function setDefaultDates() {
    // Check if dates are provided in URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const fromDateParam = urlParams.get('fromDate');
    const toDateParam = urlParams.get('toDate');
    
    if (fromDateParam && toDateParam) {
        // Use dates from URL parameters
        document.getElementById('fromDate').value = fromDateParam;
        document.getElementById('toDate').value = toDateParam;
    } else {
        // Default: last 30 days
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        document.getElementById('toDate').value = today.toISOString().split('T')[0];
        document.getElementById('fromDate').value = thirtyDaysAgo.toISOString().split('T')[0];
    }
}

// Load data from database (optimized - only load what's needed for filters)
async function loadData() {
    try {
        // Load only essential data for filters (customers, products, categories)
        // Reports will load filtered data on demand
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            products = await window.electronAPI.dbGetAll('products') || [];
            customers = await window.electronAPI.dbGetAll('customers') || [];
            suppliers = await window.electronAPI.dbGetAll('suppliers') || [];
            categories = await window.electronAPI.dbGetAll('categories') || [];
            
            // Don't load all invoices/items here - load them on demand with filters
            // This significantly reduces memory usage
            salesInvoices = [];
            purchaseInvoices = [];
            salesInvoiceItems = [];
            purchaseInvoiceItems = [];
            operatingExpenses = [];
        }
        
        // Populate filters
        populateFilters();
    } catch (error) {
        console.error('Error loading data:', error);
        showMessage('خطأ في تحميل البيانات', 'error');
    }
}

// Load filtered sales data from database
async function loadFilteredSalesData(filters) {
    if (!window.electronAPI || !window.electronAPI.dbQuery) {
        return { invoices: [], items: [] };
    }
    
    try {
        let query = `
            SELECT 
                si.*,
                c.name as customerName
            FROM sales_invoices si
            LEFT JOIN customers c ON si.customerId = c.id
            WHERE 1=1
        `;
        const params = [];
        
        if (filters.fromDate) {
            query += ' AND si.date >= ?';
            params.push(filters.fromDate);
        }
        if (filters.toDate) {
            query += ' AND si.date <= ?';
            params.push(filters.toDate + ' 23:59:59');
        }
        if (filters.customerId) {
            query += ' AND si.customerId = ?';
            params.push(filters.customerId);
        }
        
        query += ' ORDER BY si.date DESC';
        
        const invoices = await window.electronAPI.dbQuery(query, params) || [];
        
        // Load items for these invoices
        let items = [];
        if (invoices.length > 0) {
            const invoiceIds = invoices.map(inv => inv.id);
            const placeholders = invoiceIds.map(() => '?').join(',');
            
            let itemsQuery = `
                SELECT 
                    sii.*,
                    p.category as productCategory
                FROM sales_invoice_items sii
                LEFT JOIN products p ON sii.productId = p.id
                WHERE sii.invoiceId IN (${placeholders})
            `;
            
            const itemsParams = [...invoiceIds];
            
            // Apply category/product filter if exists
            if (filters.category) {
                if (filters.category.startsWith('category:')) {
                    const categoryName = filters.category.replace('category:', '');
                    itemsQuery += ' AND p.category = ?';
                    itemsParams.push(categoryName);
                } else if (filters.category.startsWith('product:')) {
                    const productId = filters.category.replace('product:', '');
                    itemsQuery += ' AND sii.productId = ?';
                    itemsParams.push(productId);
                }
            }
            
            items = await window.electronAPI.dbQuery(itemsQuery, itemsParams) || [];
        }
        
        return { invoices, items };
    } catch (error) {
        console.error('Error loading filtered sales data:', error);
        return { invoices: [], items: [] };
    }
}

// Load filtered purchase data from database
async function loadFilteredPurchaseData(filters) {
    if (!window.electronAPI || !window.electronAPI.dbQuery) {
        return { invoices: [], items: [] };
    }
    
    try {
        let query = `
            SELECT * FROM purchase_invoices
            WHERE 1=1
        `;
        const params = [];
        
        if (filters.fromDate) {
            query += ' AND date >= ?';
            params.push(filters.fromDate);
        }
        if (filters.toDate) {
            query += ' AND date <= ?';
            params.push(filters.toDate + ' 23:59:59');
        }
        
        query += ' ORDER BY date DESC';
        
        const invoices = await window.electronAPI.dbQuery(query, params) || [];
        
        // Load items for these invoices
        let items = [];
        if (invoices.length > 0) {
            const invoiceIds = invoices.map(inv => inv.id);
            const placeholders = invoiceIds.map(() => '?').join(',');
            
            items = await window.electronAPI.dbQuery(`
                SELECT * FROM purchase_invoice_items
                WHERE invoiceId IN (${placeholders})
            `, invoiceIds) || [];
        }
        
        return { invoices, items };
    } catch (error) {
        console.error('Error loading filtered purchase data:', error);
        return { invoices: [], items: [] };
    }
}

// Load filtered operating expenses
async function loadFilteredExpenses(filters) {
    if (!window.electronAPI || !window.electronAPI.dbGetAll) {
        return [];
    }
    
    try {
        return await window.electronAPI.dbGetAll(
            'operating_expenses',
            'date >= ? AND date <= ?',
            [filters.fromDate || '', filters.toDate ? filters.toDate + ' 23:59:59' : '']
        ) || [];
    } catch (error) {
        console.error('Error loading filtered expenses:', error);
        return [];
    }
}

// Populate filter dropdowns
function populateFilters() {
    // Customers
    const customerFilter = document.getElementById('customerFilter');
    customerFilter.innerHTML = '<option value="">جميع العملاء</option>';
    customers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer.id;
        option.textContent = customer.name;
        customerFilter.appendChild(option);
    });

    // Categories and Products
    const categoryFilter = document.getElementById('categoryFilter');
    categoryFilter.innerHTML = '<option value="">جميع التصنيفات والمنتجات</option>';
    
    // Add categories section
    const uniqueCategories = [...new Set(products.map(p => p.category).filter(Boolean))];
    if (uniqueCategories.length > 0) {
        // Add optgroup for categories
        const categoryOptgroup = document.createElement('optgroup');
        categoryOptgroup.label = '─── التصنيفات ───';
        uniqueCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = `category:${category}`;
            option.textContent = `📁 ${category}`;
            categoryOptgroup.appendChild(option);
        });
        categoryFilter.appendChild(categoryOptgroup);
    }
    
    // Add products section
    const productsWithCategory = products.filter(p => p.name && p.category);
    if (productsWithCategory.length > 0) {
        // Group products by category for better organization
        const productsByCategory = {};
        productsWithCategory.forEach(product => {
            if (!productsByCategory[product.category]) {
                productsByCategory[product.category] = [];
            }
            productsByCategory[product.category].push(product);
        });
        
        // Add products grouped by category
        Object.keys(productsByCategory).sort().forEach(category => {
            const productOptgroup = document.createElement('optgroup');
            productOptgroup.label = `─── منتجات: ${category} ───`;
            productsByCategory[category].forEach(product => {
                const option = document.createElement('option');
                option.value = `product:${product.id}`;
                option.textContent = `📦 ${product.name} (${category})`;
                productOptgroup.appendChild(option);
            });
            categoryFilter.appendChild(productOptgroup);
        });
    }
}

// Get filter values
function getFilters() {
    return {
        fromDate: document.getElementById('fromDate').value,
        toDate: document.getElementById('toDate').value,
        customerId: document.getElementById('customerFilter').value,
        category: document.getElementById('categoryFilter').value
    };
}

// Reset filters
function resetFilters() {
    setDefaultDates();
    document.getElementById('customerFilter').value = '';
    document.getElementById('categoryFilter').value = '';
    applyFilters();
}

// Apply filters and calculate profits
async function applyFilters() {
    const filters = getFilters();
    
    // Load filtered data from database (optimized)
    const salesData = await loadFilteredSalesData(filters);
    let filteredSalesInvoices = salesData.invoices || [];
    let filteredSalesItems = salesData.items || [];
    
    // Filter invoices to only include those that have items from the filtered category/product
    // This ensures that customers table and all calculations only show data for the selected filter
    if (filters.category) {
        const invoiceIdsWithFilteredItems = [...new Set(filteredSalesItems.map(item => item.invoiceId))];
        filteredSalesInvoices = filteredSalesInvoices.filter(inv => 
            invoiceIdsWithFilteredItems.includes(inv.id)
        );
    }

    // Load purchase data for cost calculation
    const purchaseData = await loadFilteredPurchaseData(filters);
    purchaseInvoices = purchaseData.invoices || [];
    purchaseInvoiceItems = purchaseData.items || [];
    
    // Load operating expenses
    operatingExpenses = await loadFilteredExpenses(filters);

    // Calculate KPIs
    await calculateKPIs(filteredSalesInvoices, filteredSalesItems);
    
    // Render tables
    renderProductsProfit(filteredSalesItems, filteredSalesInvoices);
    renderCustomersProfit(filteredSalesInvoices, filteredSalesItems);
    renderSuppliersProfit();
    
    // Generate alerts
    generateAlerts(filteredSalesItems, filteredSalesInvoices);
}

// Calculate KPIs
async function calculateKPIs(invoices, items) {
    // Total Sales
    const totalSales = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    
    // Calculate COGS (Cost of Goods Sold)
    let totalCOGS = 0;
    for (const item of items) {
        const product = products.find(p => p.id === item.productId);
        if (!product) continue;
        
        // Get the invoice date for this item to calculate cost correctly
        const invoice = invoices.find(inv => inv.id === item.invoiceId);
        const saleDate = invoice ? invoice.date.split('T')[0] : null;
        
        // Use the correct calculation that considers purchases up to the sale date
        // avgPurchasePrice is per smallest unit
        const avgPurchasePrice = calculateAveragePurchasePrice(item.productId, saleDate);
        
        // Convert item quantity to smallest unit
        let quantityInSmallestUnit = item.quantity || 0;
        if (item.unit === 'largest') {
            const conversionFactor = product.conversionFactor || 1;
            quantityInSmallestUnit = (item.quantity || 0) * conversionFactor;
        }
        
        // Calculate cost: price per smallest unit * quantity in smallest unit
        const itemCost = avgPurchasePrice * quantityInSmallestUnit;
        totalCOGS += itemCost;
    }
    
    // Gross Profit
    const grossProfit = totalSales - totalCOGS;
    
    // Operating Expenses
    const filters = getFilters();
    const filteredExpenses = operatingExpenses.filter(exp => {
        const expDate = exp.date.split('T')[0];
        return expDate >= filters.fromDate && expDate <= filters.toDate;
    });
    const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    
    // Net Profit
    const netProfit = grossProfit - totalExpenses;
    
    // Profit Margin
    const profitMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;
    
    // Update KPI Cards
    document.getElementById('totalSales').textContent = formatArabicCurrency(totalSales);
    document.getElementById('totalCOGS').textContent = formatArabicCurrency(totalCOGS);
    document.getElementById('grossProfit').textContent = formatArabicCurrency(grossProfit);
    document.getElementById('totalExpenses').textContent = formatArabicCurrency(totalExpenses);
    document.getElementById('netProfit').textContent = formatArabicCurrency(netProfit);
    document.getElementById('profitMargin').textContent = formatPercentage(profitMargin);
    
    // Add color classes based on values
    const netProfitElement = document.getElementById('netProfit');
    const grossProfitElement = document.getElementById('grossProfit');
    netProfitElement.className = 'kpi-value' + (netProfit < 0 ? ' negative' : netProfit > 0 ? ' positive' : '');
    grossProfitElement.className = 'kpi-value' + (grossProfit < 0 ? ' negative' : grossProfit > 0 ? ' positive' : '');
}

// Render Products Profit Table
function renderProductsProfit(items, invoices = []) {
    const tbody = document.getElementById('productsProfitTableBody');
    
    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">لا توجد بيانات</td></tr>';
        return;
    }
    
    // Group by product
    const productStats = {};
    
    items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        if (!product) return;
        
        if (!productStats[product.id]) {
            productStats[product.id] = {
                product: product,
                totalQuantity: 0,
                totalSales: 0,
                totalCost: 0
            };
        }
        
        productStats[product.id].totalQuantity += (item.quantity || 0);
        productStats[product.id].totalSales += (item.price || 0) * (item.quantity || 0);
        
        // Calculate cost - get the invoice date for accurate cost calculation
        const invoice = invoices.find(inv => inv.id === item.invoiceId);
        const saleDate = invoice ? invoice.date.split('T')[0] : null;
        const avgPurchasePrice = calculateAveragePurchasePrice(product.id, saleDate);
        
        // Convert item quantity to smallest unit
        let quantityInSmallestUnit = item.quantity || 0;
        if (item.unit === 'largest') {
            const conversionFactor = product.conversionFactor || 1;
            quantityInSmallestUnit = (item.quantity || 0) * conversionFactor;
        }
        
        productStats[product.id].totalCost += avgPurchasePrice * quantityInSmallestUnit;
    });
    
    // Convert to array and calculate averages
    const productArray = Object.values(productStats).map(stat => {
        const avgPurchasePrice = stat.totalQuantity > 0 ? stat.totalCost / stat.totalQuantity : 0;
        const avgSalePrice = stat.totalQuantity > 0 ? stat.totalSales / stat.totalQuantity : 0;
        const profit = stat.totalSales - stat.totalCost;
        const profitMargin = stat.totalSales > 0 ? (profit / stat.totalSales) * 100 : 0;
        
        return {
            ...stat,
            avgPurchasePrice,
            avgSalePrice,
            profit,
            profitMargin
        };
    });
    
    // Sort by profit (descending)
    productArray.sort((a, b) => b.profit - a.profit);
    
    // Render
    tbody.innerHTML = productArray.map(stat => {
        const profitClass = stat.profit < 0 ? 'negative' : stat.profit > 0 ? 'positive' : '';
        return `
            <tr>
                <td><strong>${stat.product.name}</strong><br><small>${stat.product.category || 'غير محدد'}</small></td>
                <td>${formatArabicNumber(stat.totalQuantity, 2)}</td>
                <td>${formatArabicCurrency(stat.avgPurchasePrice)}</td>
                <td>${formatArabicCurrency(stat.avgSalePrice)}</td>
                <td>${formatArabicCurrency(stat.totalCost)}</td>
                <td>${formatArabicCurrency(stat.totalSales)}</td>
                <td class="${profitClass}">${formatArabicCurrency(stat.profit)}</td>
                <td class="${profitClass}">${formatPercentage(stat.profitMargin)}</td>
            </tr>
        `;
    }).join('');
}

// Render Customers Profit Table
function renderCustomersProfit(invoices, items) {
    const tbody = document.getElementById('customersProfitTableBody');
    
    if (!invoices || invoices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">لا توجد بيانات</td></tr>';
        return;
    }
    
    // Group by customer
    const customerStats = {};
    
    invoices.forEach(invoice => {
        const customer = customers.find(c => c.id === invoice.customerId);
        if (!customer) return;
        
        if (!customerStats[customer.id]) {
            customerStats[customer.id] = {
                customer: customer,
                totalSales: 0,
                totalCost: 0
            };
        }
        
        customerStats[customer.id].totalSales += (invoice.total || 0);
    });
    
    // Calculate costs for each customer
    Object.keys(customerStats).forEach(customerId => {
        const customerInvoices = invoices.filter(inv => inv.customerId === customerId);
        let totalCost = 0;
        
        customerInvoices.forEach(invoice => {
            const invoiceItems = items.filter(item => item.invoiceId === invoice.id);
            const saleDate = invoice.date.split('T')[0];
            invoiceItems.forEach(item => {
                const product = products.find(p => p.id === item.productId);
                if (!product) return;
                
                // Use the correct calculation that considers purchases up to the sale date
                const avgPurchasePrice = calculateAveragePurchasePrice(product.id, saleDate);
                
                // Convert item quantity to smallest unit
                let quantityInSmallestUnit = item.quantity || 0;
                if (item.unit === 'largest') {
                    const conversionFactor = product.conversionFactor || 1;
                    quantityInSmallestUnit = (item.quantity || 0) * conversionFactor;
                }
                
                totalCost += avgPurchasePrice * quantityInSmallestUnit;
            });
        });
        
        customerStats[customerId].totalCost = totalCost;
    });
    
    // Convert to array and calculate profit
    const customerArray = Object.values(customerStats).map(stat => {
        const profit = stat.totalSales - stat.totalCost;
        const profitMargin = stat.totalSales > 0 ? (profit / stat.totalSales) * 100 : 0;
        const status = profitMargin >= 20 ? 'profitable' : profitMargin >= 10 ? 'moderate' : profitMargin < 0 ? 'loss' : 'low';
        
        return {
            ...stat,
            profit,
            profitMargin,
            status
        };
    });
    
    // Sort by profit (descending)
    customerArray.sort((a, b) => b.profit - a.profit);
    
    // Render
    tbody.innerHTML = customerArray.map(stat => {
        const statusClass = stat.status === 'profitable' ? 'positive' : stat.status === 'loss' ? 'negative' : '';
        const statusText = stat.status === 'profitable' ? 'مربح جداً' : stat.status === 'moderate' ? 'مربح' : stat.status === 'low' ? 'ربح منخفض' : 'خسارة';
        return `
            <tr>
                <td><strong>${stat.customer.name}</strong></td>
                <td>${formatArabicCurrency(stat.totalSales)}</td>
                <td>${formatArabicCurrency(stat.totalCost)}</td>
                <td class="${statusClass}">${formatArabicCurrency(stat.profit)}</td>
                <td class="${statusClass}">${formatPercentage(stat.profitMargin)}</td>
                <td><span class="status-badge ${stat.status}">${statusText}</span></td>
            </tr>
        `;
    }).join('');
}

// Render Suppliers Profit Table
function renderSuppliersProfit() {
    const tbody = document.getElementById('suppliersProfitTableBody');
    
    const filters = getFilters();
    const filteredPurchases = purchaseInvoices.filter(inv => {
        const invDate = inv.date.split('T')[0];
        return invDate >= filters.fromDate && invDate <= filters.toDate;
    });
    
    if (!filteredPurchases || filteredPurchases.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">لا توجد بيانات</td></tr>';
        return;
    }
    
    // Group by supplier
    const supplierStats = {};
    
    filteredPurchases.forEach(invoice => {
        const supplier = suppliers.find(s => s.id === invoice.supplierId);
        if (!supplier) return;
        
        const invoiceItems = purchaseInvoiceItems.filter(item => item.invoiceId === invoice.id);
        
        // Filter items by category or product if filter is set
        let filteredItems = invoiceItems;
        if (filters.category) {
            if (filters.category.startsWith('category:')) {
                // Filter by category
                const categoryName = filters.category.replace('category:', '');
                filteredItems = invoiceItems.filter(item => {
                    const product = products.find(p => p.id === item.productId);
                    return product && product.category === categoryName;
                });
            } else if (filters.category.startsWith('product:')) {
                // Filter by specific product
                const productId = filters.category.replace('product:', '');
                filteredItems = invoiceItems.filter(item => item.productId === productId);
            }
            
            // Skip this invoice if no items match the filter
            if (filteredItems.length === 0) return;
        }
        
        if (!supplierStats[supplier.id]) {
            supplierStats[supplier.id] = {
                supplier: supplier,
                totalPurchases: 0,
                totalCost: 0,
                totalQuantityInSmallestUnit: 0
            };
        }
        
        // Calculate total only for filtered items (or all items if no category filter)
        const invoiceTotal = filteredItems.reduce((sum, item) => 
            sum + ((item.price || 0) * (item.quantity || 0)), 0);
        supplierStats[supplier.id].totalPurchases += invoiceTotal;
        
        filteredItems.forEach(item => {
            const product = products.find(p => p.id === item.productId);
            if (!product) return;
            
            // Calculate item cost
            const itemCost = (item.price || 0) * (item.quantity || 0);
            supplierStats[supplier.id].totalCost += itemCost;
            
            // Convert quantity to smallest unit for accurate average calculation
            let quantityInSmallestUnit = item.quantity || 0;
            if (item.unit === 'largest') {
                const conversionFactor = product.conversionFactor || 1;
                quantityInSmallestUnit = (item.quantity || 0) * conversionFactor;
            }
            
            // Add to total quantity in smallest unit
            supplierStats[supplier.id].totalQuantityInSmallestUnit = 
                (supplierStats[supplier.id].totalQuantityInSmallestUnit || 0) + quantityInSmallestUnit;
        });
    });
    
    // Convert to array and calculate average
    // Average price is calculated per smallest unit, considering conversion factors
    const supplierArray = Object.values(supplierStats).map(stat => {
        // Calculate average price per smallest unit
        // This ensures accurate comparison across different unit types
        const avgPrice = stat.totalQuantityInSmallestUnit > 0 
            ? stat.totalCost / stat.totalQuantityInSmallestUnit 
            : 0;
        const status = avgPrice <= 100 ? 'good' : avgPrice <= 500 ? 'moderate' : 'high';
        
        return {
            ...stat,
            avgPrice,
            status
        };
    });
    
    // Sort by total purchases (descending)
    supplierArray.sort((a, b) => b.totalPurchases - a.totalPurchases);
    
    // Render
    tbody.innerHTML = supplierArray.map(stat => {
        const statusClass = stat.status === 'good' ? 'positive' : stat.status === 'high' ? 'negative' : '';
        const statusText = stat.status === 'good' ? 'سعر مناسب' : stat.status === 'moderate' ? 'متوسط' : 'سعر مرتفع';
        return `
            <tr>
                <td><strong>${stat.supplier.name}</strong></td>
                <td>${formatArabicCurrency(stat.totalPurchases)}</td>
                <td>${formatArabicCurrency(stat.totalCost)}</td>
                <td>${formatArabicCurrency(stat.avgPrice)}</td>
                <td><span class="status-badge ${stat.status}">${statusText}</span></td>
            </tr>
        `;
    }).join('');
}

// Charts removed - no longer used

// Generate Alerts
function generateAlerts(items, invoices = []) {
    // High Sales Low Profit
    const highSalesLowProfit = [];
    // Loss Products
    const lossProducts = [];
    
    // Group by product
    const productStats = {};
    
    items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        if (!product) return;
        
        if (!productStats[product.id]) {
            productStats[product.id] = {
                product: product,
                totalQuantity: 0,
                totalSales: 0,
                totalCost: 0
            };
        }
        
        productStats[product.id].totalQuantity += (item.quantity || 0);
        productStats[product.id].totalSales += (item.price || 0) * (item.quantity || 0);
        
        // Calculate cost - get the invoice date for accurate cost calculation
        const invoice = invoices.find(inv => inv.id === item.invoiceId);
        const saleDate = invoice ? invoice.date.split('T')[0] : null;
        const avgPurchasePrice = calculateAveragePurchasePrice(product.id, saleDate);
        
        // Convert item quantity to smallest unit
        let quantityInSmallestUnit = item.quantity || 0;
        if (item.unit === 'largest') {
            const conversionFactor = product.conversionFactor || 1;
            quantityInSmallestUnit = (item.quantity || 0) * conversionFactor;
        }
        
        productStats[product.id].totalCost += avgPurchasePrice * quantityInSmallestUnit;
    });
    
    // Analyze each product
    Object.values(productStats).forEach(stat => {
        const profit = stat.totalSales - stat.totalCost;
        const profitMargin = stat.totalSales > 0 ? (profit / stat.totalSales) * 100 : 0;
        
        // High sales but low profit
        if (stat.totalSales > 1000 && profitMargin < 10 && profitMargin >= 0) {
            highSalesLowProfit.push({ ...stat, profit, profitMargin });
        }
        
        // Loss products
        if (profit < 0) {
            lossProducts.push({ ...stat, profit, profitMargin });
        }
    });
    
    // Render alerts
    renderAlerts(highSalesLowProfit, lossProducts);
}

// Render Alerts
function renderAlerts(highSalesLowProfit, lossProducts) {
    const highSalesList = document.getElementById('highSalesLowProfitList');
    const lossList = document.getElementById('lossProductsList');
    
    if (highSalesLowProfit.length === 0) {
        highSalesList.innerHTML = '<p class="no-alerts">لا توجد منتجات</p>';
    } else {
        highSalesList.innerHTML = highSalesLowProfit.map(stat => `
            <div class="alert-item">
                <strong>${stat.product.name}</strong>
                <span>المبيعات: ${formatArabicCurrency(stat.totalSales)}</span>
                <span>الربح: ${formatArabicCurrency(stat.profit)}</span>
                <span>النسبة: ${formatPercentage(stat.profitMargin)}</span>
            </div>
        `).join('');
    }
    
    if (lossProducts.length === 0) {
        lossList.innerHTML = '<p class="no-alerts">لا توجد منتجات</p>';
    } else {
        lossList.innerHTML = lossProducts.map(stat => `
            <div class="alert-item loss">
                <strong>${stat.product.name}</strong>
                <span>الخسارة: ${formatArabicCurrency(Math.abs(stat.profit))}</span>
                <span>المبيعات: ${formatArabicCurrency(stat.totalSales)}</span>
            </div>
        `).join('');
    }
}

// Switch Tab
async function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        const btnTab = btn.getAttribute('data-tab');
        btn.classList.remove('active');
        if (btnTab === tabName) {
            btn.classList.add('active');
        }
    });
    
    // Update tab panels
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.remove('active');
        const panelId = panel.id;
        const expectedId = `${tabName}-tab`;
        
        if (panelId === expectedId) {
            panel.classList.add('active');
            // Force display with inline style to override any conflicting CSS
            panel.style.display = 'block';
            panel.style.visibility = 'visible';
            panel.style.opacity = '1';
            panel.style.height = 'auto';
            panel.style.overflow = 'visible';
            panel.style.position = 'relative';
            panel.style.zIndex = '1';
            // Force remove any conflicting styles
            panel.style.maxHeight = '';
            panel.style.minHeight = '';
        } else {
            // Ensure other panels are hidden
            panel.classList.remove('active');
            panel.style.display = 'none';
            panel.style.visibility = 'hidden';
            panel.style.opacity = '0';
        }
    });
    
    // If alerts tab, generate alerts
    if (tabName === 'alerts') {
        const filters = getFilters();
        
        // Load filtered data from database (optimized)
        const salesData = await loadFilteredSalesData(filters);
        let filteredSalesInvoices = salesData.invoices || [];
        let filteredSalesItems = salesData.items || [];
        
        // Filter invoices to only include those that have items from the filtered category/product
        if (filters.category) {
            const invoiceIdsWithFilteredItems = [...new Set(filteredSalesItems.map(item => item.invoiceId))];
            filteredSalesInvoices = filteredSalesInvoices.filter(inv => 
                invoiceIdsWithFilteredItems.includes(inv.id)
            );
        }
        
        generateAlerts(filteredSalesItems, filteredSalesInvoices);
    }
}

// Show message function
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
                    mobile: companyInfo.mobile || '',
                    email: companyInfo.email || '',
                    register: companyInfo.register || '',
                    tax: companyInfo.tax || '',
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
            mobile: '',
            email: '',
            register: '',
            tax: '',
            accountantName: ''
        };
    } catch (error) {
        console.error('Error getting company settings:', error);
        return {
            name: 'شركة أسيل',
            address: '',
            phone: '',
            mobile: '',
            email: '',
            register: '',
            tax: '',
            accountantName: ''
        };
    }
}

// Generate Report HTML for Print/PDF
async function generateReportHTML() {
    const filters = getFilters();
    const companySettings = await getCompanySettings();
    
    // Get current KPI values
    const totalSales = document.getElementById('totalSales')?.textContent || '٠';
    const totalCOGS = document.getElementById('totalCOGS')?.textContent || '٠';
    const grossProfit = document.getElementById('grossProfit')?.textContent || '٠';
    const totalExpenses = document.getElementById('totalExpenses')?.textContent || '٠';
    const netProfit = document.getElementById('netProfit')?.textContent || '٠';
    const profitMargin = document.getElementById('profitMargin')?.textContent || '٠٪';
    
    // Format dates
    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    
    // Get products profit table
    const productsTableBody = document.getElementById('productsProfitTableBody');
    let productsTableHTML = '';
    if (productsTableBody) {
        const rows = productsTableBody.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length > 0 && !row.classList.contains('empty-state')) {
                productsTableHTML += '<tr>';
                cells.forEach(cell => {
                    productsTableHTML += `<td>${cell.textContent || ''}</td>`;
                });
                productsTableHTML += '</tr>';
            }
        });
    }
    
    // Get customers profit table
    const customersTableBody = document.getElementById('customersProfitTableBody');
    let customersTableHTML = '';
    if (customersTableBody) {
        const rows = customersTableBody.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length > 0 && !row.classList.contains('empty-state')) {
                customersTableHTML += '<tr>';
                cells.forEach(cell => {
                    customersTableHTML += `<td>${cell.textContent || ''}</td>`;
                });
                customersTableHTML += '</tr>';
            }
        });
    }
    
    const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>تقرير حساب الأرباح</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
            padding: 30px;
            direction: rtl;
            background: white;
            color: #1f2937;
        }
        .header {
            margin-bottom: 30px;
            border-bottom: 3px solid #8b4513;
            padding-bottom: 20px;
        }
        .company-info {
            margin-bottom: 20px;
        }
        .company-info h1 {
            font-size: 28px;
            color: #8b4513;
            margin-bottom: 12px;
            font-weight: 700;
        }
        .company-info p {
            margin: 6px 0;
            font-size: 14px;
            color: #64748b;
        }
        .report-title {
            font-size: 24px;
            color: #8b4513;
            margin: 20px 0;
            text-align: center;
            font-weight: 700;
        }
        .filters-info {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            padding: 18px 20px;
            border-radius: 12px;
            margin-bottom: 25px;
            border: 1px solid #e5e7eb;
        }
        .filters-info p {
            margin: 6px 0;
            font-size: 14px;
            color: #374151;
            font-weight: 500;
        }
        .kpi-section {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-bottom: 35px;
        }
        .kpi-card {
            background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
            border: 2px solid #e5e7eb;
            border-right: 4px solid #8b4513;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }
        .kpi-card h3 {
            font-size: 14px;
            color: #64748b;
            margin-bottom: 12px;
            font-weight: 600;
        }
        .kpi-card .value {
            font-size: 26px;
            font-weight: 700;
            color: #8b4513;
        }
        .table-section {
            margin-bottom: 35px;
        }
        .table-section h2 {
            font-size: 20px;
            color: #8b4513;
            margin-bottom: 15px;
            border-bottom: 2px solid #cd853f;
            padding-bottom: 12px;
            font-weight: 700;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }
        th, td {
            padding: 12px 14px;
            text-align: right;
            border: 1px solid #e5e7eb;
        }
        th {
            background: linear-gradient(135deg, #8b4513 0%, #cd853f 100%);
            color: white;
            font-weight: 700;
            font-size: 14px;
        }
        td {
            font-size: 13px;
            color: #374151;
        }
        tr:nth-child(even) {
            background: #f9fafb;
        }
        tbody tr:hover {
            background: #f3f4f6;
        }
        .footer {
            margin-top: 50px;
            padding-top: 25px;
            border-top: 2px solid #e5e7eb;
            text-align: center;
        }
        .footer p {
            margin: 8px 0;
            font-size: 12px;
            color: #64748b;
        }
        @media print {
            body {
                padding: 15px;
            }
            .header, .footer {
                page-break-inside: avoid;
            }
            .table-section {
                page-break-inside: avoid;
            }
            @page {
                margin: 1.5cm;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="company-info">
            <h1>${companySettings.name || 'شركة أسيل'}</h1>
            ${companySettings.address ? `<p><strong>العنوان:</strong> ${companySettings.address}</p>` : ''}
            ${companySettings.phone || companySettings.mobile ? `<p><strong>الهاتف:</strong> ${companySettings.phone || companySettings.mobile}${companySettings.mobile && companySettings.phone ? ` | ${companySettings.mobile}` : ''}</p>` : ''}
            ${companySettings.email ? `<p><strong>البريد الإلكتروني:</strong> ${companySettings.email}</p>` : ''}
        </div>
        <div class="report-title">
            <h2>تقرير حساب الأرباح</h2>
        </div>
        <div class="filters-info">
            <p><strong>الفترة:</strong> من ${formatDate(filters.fromDate)} إلى ${formatDate(filters.toDate)}</p>
            <p><strong>تاريخ الطباعة:</strong> ${new Date().toLocaleDateString('ar-EG')}</p>
        </div>
    </div>
    
    <div class="kpi-section">
        <div class="kpi-card">
            <h3>إجمالي المبيعات</h3>
            <div class="value">${totalSales}</div>
        </div>
        <div class="kpi-card">
            <h3>تكلفة البضاعة المباعة</h3>
            <div class="value">${totalCOGS}</div>
        </div>
        <div class="kpi-card">
            <h3>إجمالي الربح</h3>
            <div class="value">${grossProfit}</div>
        </div>
        <div class="kpi-card">
            <h3>المصاريف التشغيلية</h3>
            <div class="value">${totalExpenses}</div>
        </div>
        <div class="kpi-card">
            <h3>صافي الربح</h3>
            <div class="value">${netProfit}</div>
        </div>
        <div class="kpi-card">
            <h3>نسبة هامش الربح</h3>
            <div class="value">${profitMargin}</div>
        </div>
    </div>
    
    ${productsTableHTML ? `
    <div class="table-section">
        <h2>ربح المنتجات</h2>
        <table>
            <thead>
                <tr>
                    <th>المنتج</th>
                    <th>إجمالي الكمية المباعة</th>
                    <th>متوسط تكلفة الشراء</th>
                    <th>متوسط سعر البيع</th>
                    <th>إجمالي التكلفة</th>
                    <th>إجمالي البيع</th>
                    <th>الربح</th>
                    <th>نسبة الربح</th>
                </tr>
            </thead>
            <tbody>
                ${productsTableHTML}
            </tbody>
        </table>
    </div>
    ` : ''}
    
    ${customersTableHTML ? `
    <div class="table-section">
        <h2>ربح العملاء</h2>
        <table>
            <thead>
                <tr>
                    <th>العميل</th>
                    <th>إجمالي المبيعات</th>
                    <th>تكلفة البضاعة</th>
                    <th>الربح</th>
                    <th>نسبة الربح</th>
                    <th>الحالة</th>
                </tr>
            </thead>
            <tbody>
                ${customersTableHTML}
            </tbody>
        </table>
    </div>
    ` : ''}
    
    <div class="footer">
        <p>© 2025 نظام أسيل — تم التطوير بواسطة المهندس محمد محسن. جميع الحقوق محفوظة.</p>
        <p>تم إنشاء هذا التقرير تلقائياً بواسطة نظام إدارة الشركة</p>
    </div>
</body>
</html>`;
    
    return html;
}

// Print Report
async function printReport() {
    try {
        const htmlContent = await generateReportHTML();
        
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            if (window.showToast) {
                window.showToast('يرجى السماح للنوافذ المنبثقة لطباعة التقرير', 'warning');
            } else {
                alert('⚠️ يرجى السماح للنوافذ المنبثقة لطباعة التقرير');
            }
            return;
        }
        
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        
        // Wait for content to load before printing
        printWindow.onload = () => {
            setTimeout(() => {
                printWindow.print();
            }, 250);
        };
    } catch (error) {
        console.error('Error printing report:', error);
        if (window.showToast) {
            window.showToast('حدث خطأ أثناء الطباعة: ' + error.message, 'error');
        } else {
            alert('❌ حدث خطأ أثناء الطباعة: ' + error.message);
        }
    }
}

// Save Report as PDF
async function saveReportAsPDF() {
    try {
        const htmlContent = await generateReportHTML();
        const filters = getFilters();
        const dateStr = filters.fromDate ? filters.fromDate.replace(/-/g, '_') : new Date().toISOString().split('T')[0];
        const filename = `تقرير_حساب_الأرباح_${dateStr}.pdf`;
        
        // Check if Electron API is available
        if (window.electronAPI && window.electronAPI.saveInvoiceToFile) {
            const result = await window.electronAPI.saveInvoiceToFile(htmlContent, filename);
            
            if (result.success) {
                if (window.showToast) {
                    window.showToast('تم حفظ التقرير بنجاح!', 'success');
                } else {
                    alert('✅ تم حفظ التقرير بنجاح!');
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
                window.showToast('وظيفة حفظ PDF غير متاحة في المتصفح. يرجى استخدام المتصفح لإلغاء الإلغاء والضغط على "حفظ كـ PDF"', 'warning');
            } else {
                alert('⚠️ وظيفة حفظ PDF غير متاحة في المتصفح. يرجى استخدام المتصفح لإلغاء الإلغاء والضغط على "حفظ كـ PDF"');
            }
            printReport();
        }
    } catch (error) {
        console.error('Error saving PDF:', error);
        if (window.showToast) {
            window.showToast('حدث خطأ أثناء حفظ التقرير: ' + error.message, 'error');
        } else {
            alert('❌ حدث خطأ أثناء حفظ التقرير: ' + error.message);
        }
    }
}
