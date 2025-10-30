// Price List Management for Marketing Page

let allProducts = [];
let filteredProducts = [];
let categories = [];
let priceListData = {}; // Store modified prices temporarily (in memory and localStorage)
const PRICE_LIST_STORAGE_KEY = 'asel_price_list_temporary_changes';

// Get Company Settings
async function getCompanySettings() {
    try {
        if (window.electronAPI && window.electronAPI.dbGet) {
            const companyInfo = await window.electronAPI.dbGet('company_info', 'company_001');
            if (companyInfo) {
                return {
                    name: companyInfo.name || 'شركة أسيل',
                    address: companyInfo.address || '',
                    phone: companyInfo.phone || '',
                    mobile: companyInfo.mobile || '',
                    email: companyInfo.email || '',
                    managerName: companyInfo.managerName || '',
                    managerMobile: companyInfo.managerMobile || ''
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

// Load and display manager info
async function loadManagerInfo() {
    try {
        const companySettings = await getCompanySettings();
        const managerInfoDiv = document.querySelector('.pricelist-manager-signature');
        if (managerInfoDiv) {
            const managerName = companySettings.managerName || '';
            const managerMobile = companySettings.managerMobile || '';
            if (managerName || managerMobile) {
                managerInfoDiv.innerHTML = `
                    <p style="margin: 0; font-weight: bold; font-size: 14px;">ادارة الشركة</p>
                    ${managerName ? `<p style="margin: 4px 0; font-size: 14px;"><strong>${managerName}</strong></p>` : ''}
                    ${managerMobile ? `<p style="margin: 4px 0; font-size: 14px;">${managerMobile}</p>` : ''}
                `;
            } else {
                managerInfoDiv.innerHTML = `
                    <p style="margin: 0; font-weight: bold; font-size: 14px;">ادارة الشركة</p>
                `;
            }
        }
    } catch (error) {
        console.error('Error loading manager info:', error);
    }
}

// Load Products and Categories from Database
async function loadPriceListData() {
    try {
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            // Load products
            const productsResult = await window.electronAPI.dbGetAll('products', 'status = ?', ['active']);
            allProducts = Array.isArray(productsResult) ? productsResult : [];
            
            // Load categories
            const categoriesResult = await window.electronAPI.dbGetAll('categories', '', []);
            categories = Array.isArray(categoriesResult) ? categoriesResult : [];
            
            // Convert categories to simple array of names
            if (categories.length > 0 && typeof categories[0] === 'object') {
                categories = categories.map(cat => cat.name || cat);
            }
            
            // Sort products by category and name
            allProducts.sort((a, b) => {
                if (a.category !== b.category) {
                    return (a.category || '').localeCompare(b.category || '');
                }
                return (a.name || '').localeCompare(b.name || '');
            });
            
            filteredProducts = [...allProducts];
            
            // Load temporary price changes from localStorage (if any)
            loadTemporaryPrices();
            
            // Populate category filter
            populateCategoryFilter();
            
            // Render table
            renderPriceListTable();
        } else {
            console.error('electronAPI not available');
            showError('لا يمكن تحميل البيانات');
        }
    } catch (error) {
        console.error('Error loading price list data:', error);
        showError('حدث خطأ أثناء تحميل البيانات');
    }
}

// Load Temporary Prices from localStorage
function loadTemporaryPrices() {
    try {
        const stored = localStorage.getItem(PRICE_LIST_STORAGE_KEY);
        if (stored) {
            priceListData = JSON.parse(stored);
            console.log('Loaded temporary prices from localStorage:', priceListData);
        } else {
            priceListData = {};
        }
    } catch (error) {
        console.error('Error loading temporary prices:', error);
        priceListData = {};
    }
}

// Save Temporary Prices to localStorage
function saveTemporaryPrices() {
    try {
        const dataToSave = JSON.stringify(priceListData);
        localStorage.setItem(PRICE_LIST_STORAGE_KEY, dataToSave);
        console.log('💾 Saved temporary prices to localStorage:', priceListData);
        console.log('💾 Storage key:', PRICE_LIST_STORAGE_KEY);
        
        // Verify it was saved
        const verify = localStorage.getItem(PRICE_LIST_STORAGE_KEY);
        if (verify) {
            console.log('✅ Verified: Data saved successfully');
        } else {
            console.error('❌ Error: Data not found after saving!');
        }
    } catch (error) {
        console.error('❌ Error saving temporary prices:', error);
    }
}

// Populate Category Filter
function populateCategoryFilter() {
    const categoryFilter = document.getElementById('categoryFilterPriceList');
    if (!categoryFilter) return;
    
    // Clear existing options except "جميع الأصناف"
    categoryFilter.innerHTML = '<option value="">جميع الأصناف</option>';
    
    // Get unique categories from products
    const uniqueCategories = [...new Set(allProducts.map(p => p.category).filter(Boolean))];
    uniqueCategories.sort();
    
    // Add category options
    uniqueCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
    });
}

// Render Price List Table
function renderPriceListTable() {
    const tbody = document.getElementById('pricelistTableBody');
    if (!tbody) {
        console.warn('pricelistTableBody not found');
        return;
    }
    
    // Check if data is still loading (allProducts is empty)
    if (allProducts.length === 0) {
        // Don't change the loading message if data is not loaded yet
        const hasLoadingRow = tbody.querySelector('.loading-row');
        if (!hasLoadingRow) {
            tbody.innerHTML = '<tr><td colspan="9" class="loading-row">جارٍ التحميل...</td></tr>';
        }
        return;
    }
    
    // Check if filtered products is empty (after filtering)
    if (filteredProducts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-row">لا توجد منتجات</td></tr>';
        return;
    }
    
    const tbodyElement = tbody;
    tbody.innerHTML = filteredProducts.map((product, index) => {
        const productId = product.id || '';
        const code = product.code || '';
        const name = product.name || '';
        const category = product.category || '';
        const smallestUnit = product.smallestUnit || '';
        const largestUnit = product.largestUnit || '';
        const conversionFactor = product.conversionFactor || 1;
        
        // Get price from priceListData if exists, otherwise use original price
        // This allows temporary price changes without saving to database
        // Always check priceListData first to use saved values
        const smallestPrice = (priceListData[productId] && priceListData[productId].smallestPrice !== undefined)
            ? priceListData[productId].smallestPrice 
            : (product.smallestPrice || 0);
        const largestPrice = (priceListData[productId] && priceListData[productId].largestPrice !== undefined)
            ? priceListData[productId].largestPrice 
            : (product.largestPrice || 0);
        
        return `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(code)}</td>
                <td>${escapeHtml(name)}</td>
                <td>${escapeHtml(category)}</td>
                <td>${escapeHtml(smallestUnit)}</td>
                <td>
                    <input type="number" 
                           class="price-input" 
                           data-product-id="${productId}" 
                           data-price-type="smallestPrice"
                           value="${smallestPrice}" 
                           step="0.01" 
                           min="0">
                </td>
                <td>${escapeHtml(largestUnit)}</td>
                <td>
                    <input type="number" 
                           class="price-input" 
                           data-product-id="${productId}" 
                           data-price-type="largestPrice"
                           value="${largestPrice}" 
                           step="0.01" 
                           min="0">
                </td>
                <td>${conversionFactor}</td>
            </tr>
        `;
    }).join('');
    
    // Attach event listeners to all price inputs after rendering
    setTimeout(() => {
        tbodyElement.querySelectorAll('.price-input').forEach(input => {
            const productId = input.getAttribute('data-product-id');
            const priceType = input.getAttribute('data-price-type');
            
            if (productId && priceType) {
                // Remove any existing event listeners by cloning
                const newInput = input.cloneNode(true);
                input.parentNode.replaceChild(newInput, input);
                
                // Add event listeners with explicit logging
                newInput.addEventListener('input', function(e) {
                    console.log('📝 Input event:', { productId, priceType, value: this.value });
                    updatePrice(productId, priceType, this.value);
                });
                
                newInput.addEventListener('change', function(e) {
                    console.log('🔄 Change event:', { productId, priceType, value: this.value });
                    updatePrice(productId, priceType, this.value);
                });
                
                newInput.addEventListener('blur', function(e) {
                    console.log('👋 Blur event:', { productId, priceType, value: this.value });
                    updatePrice(productId, priceType, this.value);
                });
                
                console.log('✅ Event listeners attached to:', { productId, priceType });
            }
        });
        
        console.log('✅ All event listeners attached. Total inputs:', tbodyElement.querySelectorAll('.price-input').length);
    }, 100);
}

// Update Price (temporary, saved to localStorage only, NOT to database)
function updatePrice(productId, priceType, value) {
    try {
        if (!productId) {
            console.error('updatePrice: productId is missing');
            return;
        }
        
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue < 0) {
            console.warn('updatePrice: invalid value', value);
            return;
        }
        
        // Initialize if not exists
        if (!priceListData[productId]) {
            priceListData[productId] = {};
        }
        
        // Find the original product to compare
        const product = allProducts.find(p => p.id === productId);
        if (!product) {
            console.error('updatePrice: product not found', productId);
            return;
        }
        
        const originalPrice = priceType === 'smallestPrice' ? (product.smallestPrice || 0) : (product.largestPrice || 0);
        
        // Always save the current value to priceListData (even if it matches original)
        // This ensures the value is preserved for printing/exporting
        priceListData[productId][priceType] = numValue;
        
        // Save to localStorage immediately
        saveTemporaryPrices();
        
        // Mark input as changed if different from original (for visual feedback only)
        const input = document.querySelector(`input[data-product-id="${productId}"][data-price-type="${priceType}"]`);
        if (input) {
            if (Math.abs(numValue - originalPrice) > 0.001) {
                input.classList.add('changed');
            } else {
                input.classList.remove('changed');
                // Note: We keep the value in priceListData even if it matches original
                // This ensures consistency when printing/exporting
            }
        }
        
        console.log('✅ Price updated (temporary):', { productId, priceType, value: numValue, originalPrice });
        console.log('📦 Current priceListData:', priceListData);
    } catch (error) {
        console.error('❌ Error in updatePrice:', error);
    }
}

// Filter Products
function filterPriceList() {
    const categoryFilter = document.getElementById('categoryFilterPriceList')?.value || '';
    const searchQuery = document.getElementById('searchPriceList')?.value.toLowerCase() || '';
    
    filteredProducts = allProducts.filter(product => {
        const matchesCategory = !categoryFilter || product.category === categoryFilter;
        const matchesSearch = !searchQuery || 
            (product.name || '').toLowerCase().includes(searchQuery) ||
            (product.code || '').toLowerCase().includes(searchQuery) ||
            (product.category || '').toLowerCase().includes(searchQuery);
        
        return matchesCategory && matchesSearch;
    });
    
    renderPriceListTable();
}

// Clear Temporary Prices (reset to original)
function clearTemporaryPrices() {
    try {
        // Count how many products have changes
        const changedCount = Object.keys(priceListData).length;
        
        if (changedCount === 0) {
            showToastNextToButton('clearPricesBtn', 'لا توجد تغييرات لإعادة تعيينها', 'info');
            return;
        }
        
        // Ask user for confirmation using custom dialog
        showConfirmDialog(
            `هل تريد إعادة تعيين جميع الأسعار المعدلة إلى القيم الأصلية؟\n\nسيتم حذف ${changedCount} منتج من التغييرات المؤقتة.`,
            () => {
                // User confirmed - proceed with reset
                // Clear from memory
                priceListData = {};
                
                // Clear from localStorage
                localStorage.removeItem(PRICE_LIST_STORAGE_KEY);
                
                // Remove changed class from inputs
                document.querySelectorAll('.price-input.changed').forEach(input => {
                    input.classList.remove('changed');
                });
                
                // Re-render table with original prices
                renderPriceListTable();
                
                showToastNextToButton('clearPricesBtn', `تم إعادة تعيين ${changedCount} منتج إلى القيم الأصلية بنجاح`, 'success');
            },
            () => {
                // User cancelled - do nothing (no toast)
            }
        );
    } catch (error) {
        console.error('Error clearing temporary prices:', error);
        showToastNextToButton('clearPricesBtn', 'حدث خطأ أثناء إعادة التعيين', 'error');
    }
}

// Save Prices - This function collects current values from inputs and saves them temporarily
// Note: Prices are NOT saved to database, only to localStorage temporarily
function savePrices() {
    try {
        // Collect all current prices from inputs directly - save ALL values, not just changed ones
        const currentPrices = {};
        document.querySelectorAll('.price-input').forEach(input => {
            const productId = input.getAttribute('data-product-id');
            const priceType = input.getAttribute('data-price-type');
            const currentValue = parseFloat(input.value);
            
            if (productId && priceType && !isNaN(currentValue)) {
                if (!currentPrices[productId]) {
                    currentPrices[productId] = {};
                }
                // Save ALL current values, not just changed ones
                currentPrices[productId][priceType] = currentValue;
            }
        });
        
        // Update priceListData with ALL current values
        priceListData = currentPrices;
        
        // Save to localStorage
        saveTemporaryPrices();
        
        // Count how many products have prices that differ from original
        let changedCount = 0;
        Object.keys(priceListData).forEach(productId => {
            const product = allProducts.find(p => p.id === productId);
            if (product) {
                const smallestPrice = priceListData[productId].smallestPrice;
                const largestPrice = priceListData[productId].largestPrice;
                
                if (smallestPrice !== undefined && Math.abs(smallestPrice - (product.smallestPrice || 0)) > 0.001) {
                    changedCount++;
                } else if (largestPrice !== undefined && Math.abs(largestPrice - (product.largestPrice || 0)) > 0.001) {
                    changedCount++;
                }
            }
        });
        
        if (changedCount === 0) {
            showToastNextToButton('savePricesBtn', 'لا توجد تغييرات مؤقتة', 'info');
            return;
        }
        
        showToastNextToButton('savePricesBtn', `تم حفظ ${changedCount} منتج مؤقتاً. التغييرات ستُحفظ حتى إغلاق البرنامج ولن تؤثر على جدول المنتجات.`, 'success');
    } catch (error) {
        console.error('Error in savePrices:', error);
        showError('حدث خطأ أثناء حفظ الأسعار المؤقتة');
    }
}

// Print Price List
async function printPriceList() {
    try {
        // Ensure the price list sub-tab is visible/active for printing
        const pricelistSubtab = document.getElementById('pricelist-subtab');
        if (pricelistSubtab) {
            pricelistSubtab.classList.add('active');
            // Also activate the sub-tab button
            document.querySelectorAll('.sub-tab-btn').forEach(btn => {
                if (btn.getAttribute('data-sub-tab') === 'pricelist') {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }
        
        // Ensure data is loaded before printing
        if (allProducts.length === 0) {
            console.log('Loading price list data before printing...');
            // Load data
            await loadPriceListData();
            
            // Wait for data to load and render
            let retries = 0;
            while (allProducts.length === 0 && retries < 10) {
                await new Promise(resolve => setTimeout(resolve, 200));
                retries++;
            }
        }
        
        // Ensure filtered products are set
        if (filteredProducts.length === 0 && allProducts.length > 0) {
            filteredProducts = [...allProducts];
        }
        
        // Re-render table to ensure all data is displayed
        renderPriceListTable();
        
        // Wait for rendering to complete
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Verify that table has content (not loading row)
        const tbody = document.getElementById('pricelistTableBody');
        if (tbody) {
            const loadingRow = tbody.querySelector('.loading-row');
            if (loadingRow && allProducts.length === 0) {
                // Still loading, show error
                showError('لا يمكن الطباعة: البيانات لم يتم تحميلها بعد. يرجى المحاولة مرة أخرى.');
                return;
            }
        }
        
        // Ensure all current input values are saved before printing
        // Collect ALL current values from inputs and save them to priceListData
        document.querySelectorAll('.price-input').forEach(input => {
            const productId = input.getAttribute('data-product-id');
            const priceType = input.getAttribute('data-price-type');
            const currentValue = parseFloat(input.value);
            
            if (productId && priceType && !isNaN(currentValue) && currentValue >= 0) {
                if (!priceListData[productId]) {
                    priceListData[productId] = {};
                }
                // Always save the current value from input field
                priceListData[productId][priceType] = currentValue;
            }
        });
        
        // Save to localStorage
        saveTemporaryPrices();
        
        // Re-render table with updated prices from priceListData
        renderPriceListTable();
        
        // Wait for rendering and ensure inputs have correct values
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Double-check: update priceListData again from rendered inputs to ensure consistency
        document.querySelectorAll('.price-input').forEach(input => {
            const productId = input.getAttribute('data-product-id');
            const priceType = input.getAttribute('data-price-type');
            const currentValue = parseFloat(input.value);
            
            if (productId && priceType && !isNaN(currentValue) && currentValue >= 0) {
                if (!priceListData[productId]) {
                    priceListData[productId] = {};
                }
                priceListData[productId][priceType] = currentValue;
            }
        });
        saveTemporaryPrices();
        
        // Load and update manager info in the page before printing (only once)
        await loadManagerInfo();
        
        window.print();
    } catch (error) {
        console.error('Error in printPriceList:', error);
        showError('حدث خطأ أثناء تحضير الطباعة: ' + error.message);
    }
}

// Export to PDF
async function exportToPDF() {
    try {
        // First, save ALL current input values to priceListData
        document.querySelectorAll('.price-input').forEach(input => {
            const productId = input.getAttribute('data-product-id');
            const priceType = input.getAttribute('data-price-type');
            const currentValue = parseFloat(input.value);
            
            if (productId && priceType && !isNaN(currentValue) && currentValue >= 0) {
                if (!priceListData[productId]) {
                    priceListData[productId] = {};
                }
                // Save the current value from input field
                priceListData[productId][priceType] = currentValue;
            }
        });
        
        // Save to localStorage
        saveTemporaryPrices();
        
        // Re-render table to ensure it uses the updated priceListData
        renderPriceListTable();
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Load manager info into the page before cloning (so it's included in printContent)
        await loadManagerInfo();
        
        // Get logo SVG content and convert to base64
        let logoBase64 = '';
        try {
            const logoResponse = await fetch('assets/aseel_logo.svg');
            if (logoResponse.ok) {
                const logoSvg = await logoResponse.text();
                logoBase64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(logoSvg)));
            }
        } catch (e) {
            console.warn('Could not load logo:', e);
        }
        
        // Get company settings for watermark and title
        const companySettings = await getCompanySettings();
        const companyName = companySettings.name || 'شركة أسيل';
        
        // Create a temporary div with the price list content (after manager info is loaded and table is re-rendered)
        let printContent = document.getElementById('pricelist-subtab').cloneNode(true);
        
        // Update all price inputs in the cloned content with current values from priceListData or inputs
        const clonedInputs = printContent.querySelectorAll('.price-input');
        clonedInputs.forEach(clonedInput => {
            const productId = clonedInput.getAttribute('data-product-id');
            const priceType = clonedInput.getAttribute('data-price-type');
            
            // First try to get from priceListData (most reliable)
            if (productId && priceType && priceListData[productId] && priceListData[productId][priceType] !== undefined) {
                clonedInput.value = priceListData[productId][priceType];
            } else {
                // Fallback to original input value
                const originalInput = document.querySelector(`input[data-product-id="${productId}"][data-price-type="${priceType}"]`);
                if (originalInput) {
                    clonedInput.value = originalInput.value;
                }
            }
            
            // Make it read-only in print version
            clonedInput.readOnly = true;
            clonedInput.style.border = 'none';
            clonedInput.style.background = 'transparent';
        });
        
        // Remove action buttons and filters from print version
        const actions = printContent.querySelector('.pricelist-actions');
        const filters = printContent.querySelector('.pricelist-filters');
        const note = printContent.querySelector('.pricelist-note');
        if (actions) actions.remove();
        if (filters) filters.remove();
        if (note) note.remove();
        
        // Generate HTML content for PDF
        const htmlContent = `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>قائمة الأسعار - ${companyName}</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
                        padding: 20px;
                        direction: rtl;
                    }
                    h2 {
                        text-align: center;
                        color: #8B4513;
                        margin-bottom: 20px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                    }
                    th {
                        background: #8B4513;
                        color: white;
                        padding: 10px;
                        text-align: right;
                        border: 1px solid rgba(255, 255, 255, 0.2);
                    }
                    td {
                        padding: 8px;
                        text-align: right;
                        border-bottom: 1px solid #ddd;
                    }
                    tr:hover {
                        background: #f5f5f5;
                    }
                    .price-input {
                        border: none;
                        background: transparent;
                        width: 100%;
                        text-align: right;
                    }
                    .company-logo {
                        text-align: center;
                        margin-bottom: 30px;
                    }
                    .company-logo img {
                        max-width: 300px;
                        height: auto;
                    }
                    .statistics-section {
                        margin: 40px 0;
                        padding: 30px;
                        background: #f9f9f9;
                        border-radius: 12px;
                    }
                    .stats-grid {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 20px;
                        margin-top: 20px;
                    }
                    .stat-card {
                        background: linear-gradient(135deg, #8B4513 0%, #654321 100%);
                        border-radius: 12px;
                        padding: 20px;
                        text-align: center;
                        color: white;
                    }
                    .stat-number, .stat-icon {
                        font-size: 2.5rem;
                        font-weight: 700;
                        margin-bottom: 10px;
                    }
                    .stat-label {
                        font-size: 1rem;
                        font-weight: 500;
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
                    .watermark-text {
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%) rotate(-45deg);
                        font-size: 120px;
                        font-weight: bold;
                        color: rgba(44, 62, 80, 0.1);
                        white-space: nowrap;
                        text-align: center;
                        line-height: 1.4;
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    }
                    .watermark-text::before {
                        content: '${companyName}';
                        display: block;
                    }
                    body {
                        position: relative;
                    }
                    body > *:not(.watermark) {
                        position: relative;
                        z-index: 1;
                    }
                    .pricelist-manager-signature {
                        display: block !important;
                        margin-top: 40px;
                        text-align: left;
                        padding-top: 20px;
                        border-top: 1px solid #ddd;
                    }
                    .pricelist-manager-signature p {
                        margin: 4px 0;
                        font-size: 14px;
                    }
                </style>
            </head>
            <body>
                <div class="watermark">
                    <div class="watermark-text"></div>
                </div>
                ${logoBase64 ? `<div class="company-logo"><img src="${logoBase64}" alt="${companyName}" style="max-width: 300px; height: auto;" /></div>` : ''}
                <h2>قائمة الأسعار - ${companyName}</h2>
                ${printContent.innerHTML}
            </body>
            </html>
        `;
        
        // Generate filename with current date
        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '_');
        const filename = `قائمة_الأسعار_${dateStr}.pdf`;
        
        // Check if Electron API is available
        if (window.electronAPI && window.electronAPI.saveInvoiceToFile) {
            const result = await window.electronAPI.saveInvoiceToFile(htmlContent, filename);
            
            if (result.success) {
                showMessage('تم حفظ الملف بنجاح', 'success');
            } else if (result.cancelled) {
                // User cancelled, do nothing
            } else {
                showError('فشل حفظ الملف: ' + (result.error || 'خطأ غير معروف'));
            }
        } else {
            // Fallback: Use browser print with PDF option
            showMessage('وظيفة حفظ PDF غير متاحة في المتصفح. يرجى استخدام المتصفح لإلغاء الإلغاء والضغط على "حفظ كـ PDF"', 'warning');
            printPriceList();
        }
    } catch (error) {
        console.error('Error exporting to PDF:', error);
        showError('حدث خطأ أثناء تصدير PDF');
    }
}

// Utility Functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showMessage(message, type = 'success') {
    // Create toast at top center of screen
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'toast-container';
        toastContainer.style.position = 'fixed';
        toastContainer.style.top = '80px'; // Below top bar
        toastContainer.style.left = '50%';
        toastContainer.style.transform = 'translateX(-50%)';
        toastContainer.style.zIndex = '10001';
        toastContainer.style.display = 'flex';
        toastContainer.style.flexDirection = 'column';
        toastContainer.style.alignItems = 'center';
        toastContainer.style.pointerEvents = 'none';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.position = 'relative';
    toast.style.minWidth = '300px';
    toast.style.maxWidth = '500px';
    toast.style.marginBottom = '10px';
    toast.style.pointerEvents = 'auto';
    
    const icon = type === 'error' ? '⚠️' : type === 'success' ? '✓' : type === 'warning' ? '⚠️' : 'ℹ️';
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    const duration = type === 'error' ? 5000 : 3000;
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 300);
    }, duration);
}

function showError(message) {
    showMessage(message, 'error');
}

// Show Toast Next to Button (now shows at top center of screen)
function showToastNextToButton(buttonId, message, type = 'success') {
    // Show toast at top center instead of next to button
    showMessage(message, type);
}

// Custom Confirmation Dialog (replaces confirm() to avoid Electron focus issues)
function showConfirmDialog(message, onConfirm, onCancel) {
    // Create confirmation modal
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.style.zIndex = '10001';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content modal-small';
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
    
    // Close handlers
    const closeModal = () => {
        modal.classList.remove('active');
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 300);
    };
    
    // Close button
    modalHeader.querySelector('.modal-close').addEventListener('click', () => {
        closeModal();
        if (onCancel) onCancel();
    });
    
    // Cancel button
    cancelBtn.addEventListener('click', () => {
        closeModal();
        if (onCancel) onCancel();
    });
    
    // Confirm button
    confirmBtn.addEventListener('click', () => {
        closeModal();
        if (onConfirm) onConfirm();
    });
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
            if (onCancel) onCancel();
        }
    });
    
    // Show modal with animation
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
}

// Initialize Event Listeners
function initializePriceListListeners() {
    // Sub-tab switching (inside marketing tab)
    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const subTabName = btn.getAttribute('data-sub-tab');
            
            // Update active sub-tab button
            document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update active sub-tab content
            document.querySelectorAll('.sub-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            const subTabElement = document.getElementById(`${subTabName}-subtab`);
            if (subTabElement) {
                subTabElement.classList.add('active');
            }
            
            // Load price list data when switching to price list sub-tab
            if (subTabName === 'pricelist') {
                if (allProducts.length === 0) {
                    loadPriceListData();
                } else {
                    // Data already loaded, just ensure table is rendered
                    renderPriceListTable();
                }
                // Load and display manager info
                loadManagerInfo();
            }
        });
    });
    
    // Filter listeners
    const categoryFilter = document.getElementById('categoryFilterPriceList');
    const searchInput = document.getElementById('searchPriceList');
    
    if (categoryFilter) {
        categoryFilter.addEventListener('change', filterPriceList);
    }
    
    if (searchInput) {
        searchInput.addEventListener('input', filterPriceList);
    }
    
    // Action buttons
    const printBtn = document.getElementById('printPriceListBtn');
    const exportBtn = document.getElementById('exportPdfBtn');
    const saveBtn = document.getElementById('savePricesBtn');
    
    if (printBtn) {
        printBtn.addEventListener('click', printPriceList);
    }
    
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToPDF);
    }
    
    if (saveBtn) {
        saveBtn.addEventListener('click', savePrices);
    }
    
    const clearBtn = document.getElementById('clearPricesBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearTemporaryPrices);
    }
}

// Make updatePrice globally accessible
window.updatePrice = updatePrice;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializePriceListListeners();
});

