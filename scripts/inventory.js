// Inventory Management System

const STORAGE_KEYS = {
    INVENTORY: 'asel_inventory_operations',
    PRODUCTS: 'asel_products',
    CATEGORIES: 'asel_categories',
    INVENTORY_COUNTER: 'asel_inventory_counter'
};

// Format currency
function formatCurrency(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) {
        amount = 0;
    }
    return parseFloat(amount).toFixed(2) + ' ج.م';
}

let inventoryOperations = [];
let returns = [];
let products = [];
let categories = [];
let customers = [];
let suppliers = [];

// Pagination & Filter State
let currentPage = 1;
const itemsPerPage = 20;
let filteredOperations = [];

// Tab State
let currentTab = 'adjustment'; // 'adjustment' or 'return'
let adjustmentCurrentPage = 1;
let returnCurrentPage = 1;
let filteredAdjustments = [];
let filteredReturns = [];
let sortBy = 'date-desc';

// Load data on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    initializeTabs();
    initializeEventListeners();
    renderProducts();
    renderCategories();
    await applyAdjustmentFilters();
    await applyReturnFilters();
});

// Reload data when page becomes visible again (user returns to page)
document.addEventListener('visibilitychange', async () => {
    if (!document.hidden) {
        await loadData();
        renderProducts();
        renderCategories();
        if (currentTab === 'adjustment') {
            await applyAdjustmentFilters();
        } else {
            await applyReturnFilters();
        }
    }
});

// Also reload when page is shown (for browser back/forward navigation)
window.addEventListener('pageshow', async (event) => {
    if (event.persisted) {
        await loadData();
        renderProducts();
        renderCategories();
        if (currentTab === 'adjustment') {
            await applyAdjustmentFilters();
        } else {
            await applyReturnFilters();
        }
    }
});

// Reload when window gets focus (user switches back to app)
window.addEventListener('focus', async () => {
    await loadData();
    renderProducts();
    renderCategories();
    if (currentTab === 'adjustment') {
        applyAdjustmentFilters();
    } else {
        applyReturnFilters();
    }
});

// Initialize Tabs
async function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    if (tabButtons.length === 0) {
        console.error('[Inventory] No tab buttons found!');
        return;
    }
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const tabId = btn.dataset.tab;
            if (!tabId) {
                console.error('[Inventory] Tab button has no data-tab attribute:', btn);
                return;
            }
            console.log('[Inventory] Switching to tab:', tabId);
            switchTab(tabId);
        });
    });
    
    console.log('[Inventory] Tabs initialized, found', tabButtons.length, 'tab buttons');
}

// Switch Tab
async function switchTab(tabId) {
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
    
    // Refresh display based on current tab
    try {
        if (tabId === 'adjustment') {
            await applyAdjustmentFilters();
        } else if (tabId === 'return') {
            await applyReturnFilters();
        }
    } catch (error) {
        console.error('[Inventory] Error refreshing tab display:', error);
        if (window.showToast) {
            window.showToast('حدث خطأ أثناء تحميل البيانات: ' + error.message, 'error');
        }
    }
}

// Initialize Event Listeners
function initializeEventListeners() {
    // New Adjustment Button
    const newAdjustmentBtn = document.getElementById('newAdjustmentBtn');
    if (newAdjustmentBtn) {
        // Remove existing listeners to avoid duplicates
        const newBtn = newAdjustmentBtn.cloneNode(true);
        newAdjustmentBtn.parentNode.replaceChild(newBtn, newAdjustmentBtn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
                openNewAdjustment();
            } catch (error) {
                console.error('Error opening new adjustment modal:', error);
                if (window.showToast) {
                    window.showToast('حدث خطأ أثناء فتح النافذة. يرجى المحاولة مرة أخرى.', 'error');
                }
            }
        });
    } else {
        console.error('newAdjustmentBtn not found!');
    }

    // New Return Button
    document.getElementById('newReturnBtn').addEventListener('click', () => {
        openNewReturn();
    });

    // View Blank Return Button
    const viewBlankReturnBtn = document.getElementById('viewBlankReturnBtn');
    if (viewBlankReturnBtn) {
        viewBlankReturnBtn.addEventListener('click', () => {
            viewBlankReturnVoucher();
        });
    }

    // Print Blank Return Button
    const printBlankReturnBtn = document.getElementById('printBlankReturnBtn');
    if (printBlankReturnBtn) {
        printBlankReturnBtn.addEventListener('click', () => {
            printBlankReturnVoucher();
        });
    }
    
    // Empty state buttons
    const adjustmentEmptyStateBtn = document.getElementById('adjustmentEmptyStateAddBtn');
    if (adjustmentEmptyStateBtn) {
        adjustmentEmptyStateBtn.addEventListener('click', () => {
            const newAdjustmentBtn = document.getElementById('newAdjustmentBtn');
            if (newAdjustmentBtn) {
                newAdjustmentBtn.click();
            }
        });
    }
    
    const returnEmptyStateBtn = document.getElementById('returnEmptyStateAddBtn');
    if (returnEmptyStateBtn) {
        returnEmptyStateBtn.addEventListener('click', () => {
            document.getElementById('newReturnBtn').click();
        });
    }

    // Refresh Button
    document.getElementById('refreshBtn').addEventListener('click', async () => {
        await loadData();
        renderProducts();
        renderCategories();
        if (currentTab === 'adjustment') {
            await applyAdjustmentFilters();
        } else {
            await applyReturnFilters();
        }
        if (window.showToast) {
            window.showToast('تم تحديث البيانات', 'success');
        }
    });

    // Adjustment Modal Close Buttons
    document.getElementById('closeAdjustmentModal').addEventListener('click', () => closeAdjustmentModal());

    // Return Modal Close Buttons
    document.getElementById('closeReturnModal').addEventListener('click', () => closeReturnModal());

    // Adjustment Form Submit
    document.getElementById('adjustmentForm').addEventListener('submit', handleAdjustmentSubmit);

    // Return Form Submit
    document.getElementById('returnForm').addEventListener('submit', handleReturnFormSubmit);

    // Adjustment Form Event Listeners
    document.getElementById('adjustmentProductSelect').addEventListener('change', onAdjustmentProductChange);
    document.getElementById('adjustmentType').addEventListener('change', onAdjustmentTypeChange);
    document.getElementById('adjustmentAmount').addEventListener('input', calculateAdjustmentNewStock);
    document.getElementById('adjustmentDate').addEventListener('change', () => {
        const today = new Date().toISOString().split('T')[0];
        if (!document.getElementById('adjustmentDate').value) {
            document.getElementById('adjustmentDate').value = today;
        }
    });

    // Return Form Event Listeners
    document.getElementById('returnType').addEventListener('change', onReturnTypeChange);
    document.getElementById('returnEntitySelect').addEventListener('change', onReturnEntitySelectChange);
    document.getElementById('returnProductSelect').addEventListener('change', onReturnProductChangeForReturn);
    document.getElementById('returnReason').addEventListener('change', onReturnReasonChange);
    document.getElementById('returnDate').addEventListener('change', () => {
        const today = new Date().toISOString().split('T')[0];
        if (!document.getElementById('returnDate').value) {
            document.getElementById('returnDate').value = today;
        }
    });

    // Adjustment Search and Filters
    document.getElementById('adjustmentSearchInput').addEventListener('input', async () => {
        adjustmentCurrentPage = 1;
        await applyAdjustmentFilters();
    });
    document.getElementById('adjustmentCategoryFilter').addEventListener('change', async () => {
        adjustmentCurrentPage = 1;
        await applyAdjustmentFilters();
    });
    document.getElementById('adjustmentStatusFilter').addEventListener('change', async () => {
        adjustmentCurrentPage = 1;
        await applyAdjustmentFilters();
    });

    // Return Search and Filters
    document.getElementById('returnSearchInput').addEventListener('input', async () => {
        returnCurrentPage = 1;
        await applyReturnFilters();
    });
    document.getElementById('returnCategoryFilter').addEventListener('change', async () => {
        returnCurrentPage = 1;
        await applyReturnFilters();
    });
    document.getElementById('returnStatusFilter').addEventListener('change', async () => {
        returnCurrentPage = 1;
        await applyReturnFilters();
    });

    // Adjustment Pagination Event Listeners
    document.getElementById('adjustmentPrevPageBtn').addEventListener('click', async () => {
        if (adjustmentCurrentPage > 1) {
            adjustmentCurrentPage--;
            await applyAdjustmentFilters();
        }
    });

    document.getElementById('adjustmentNextPageBtn').addEventListener('click', async () => {
        const totalPages = Math.ceil(filteredAdjustments.length / itemsPerPage);
        if (adjustmentCurrentPage < totalPages) {
            adjustmentCurrentPage++;
            await applyAdjustmentFilters();
        }
    });

    // Return Pagination Event Listeners
    document.getElementById('returnPrevPageBtn').addEventListener('click', async () => {
        if (returnCurrentPage > 1) {
            returnCurrentPage--;
            await applyReturnFilters();
        }
    });

    document.getElementById('returnNextPageBtn').addEventListener('click', async () => {
        const totalPages = Math.ceil(filteredReturns.length / itemsPerPage);
        if (returnCurrentPage < totalPages) {
            returnCurrentPage++;
            await applyReturnFilters();
        }
    });

    // Close modals on backdrop click
    document.getElementById('adjustmentModal').addEventListener('click', (e) => {
        if (e.target.id === 'adjustmentModal') {
            closeAdjustmentModal();
        }
    });

    document.getElementById('returnModal').addEventListener('click', (e) => {
        if (e.target.id === 'returnModal') {
            closeReturnModal();
        }
    });

    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('adjustmentDate').value = today;
    document.getElementById('returnDate').value = today;
}

// Load Data
async function loadData() {
    // Load from database if available
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            const rawInventoryOperations = await window.electronAPI.dbGetAll('inventory_adjustments', '', []) || [];
            returns = await window.electronAPI.dbGetAll('returns', '', []) || [];
            products = await window.electronAPI.dbGetAll('products', '', []) || [];
            customers = await window.electronAPI.dbGetAll('customers', '', []) || [];
            suppliers = await window.electronAPI.dbGetAll('suppliers', '', []) || [];
            
            // Convert database format to display format for inventory operations
            // Sort operations by date to calculate oldStock correctly
            const sortedOperations = [...rawInventoryOperations].sort((a, b) => {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                if (dateA.getTime() === dateB.getTime()) {
                    // If same date, sort by createdAt to maintain order
                    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
                }
                return dateA - dateB;
            });
            
            inventoryOperations = sortedOperations.map((op, index) => {
                const product = products.find(p => p.id === op.productId);
                if (!product) {
                    console.warn(`[Inventory] Product ${op.productId} not found for operation ${op.id}`);
                    return null;
                }
                
                const quantity = parseFloat(op.quantity || 0);
                
                // Use saved oldStock and newStock from database if available
                // Otherwise, calculate them (for backward compatibility with old records)
                let oldStock, newStock, change;
                
                if (op.oldStock !== undefined && op.oldStock !== null && 
                    op.newStock !== undefined && op.newStock !== null) {
                    // Use saved values from database (actual values at time of adjustment)
                    oldStock = parseFloat(op.oldStock || 0);
                    newStock = parseFloat(op.newStock || 0);
                    change = newStock - oldStock;
                } else {
                    // Fallback: Calculate oldStock by reversing all operations from current stock back to this operation
                    // Start from current product stock and work backwards
                    let calculatedStock = parseFloat(product.stock || 0);
                    
                    // Reverse all operations that happened after this one (same product)
                    for (let i = sortedOperations.length - 1; i > index; i--) {
                        const laterOp = sortedOperations[i];
                        if (laterOp.productId === op.productId) {
                            const laterQuantity = parseFloat(laterOp.quantity || 0);
                            if (laterOp.type === 'increase') {
                                calculatedStock = calculatedStock - laterQuantity;
                            } else if (laterOp.type === 'decrease') {
                                calculatedStock = calculatedStock + laterQuantity;
                            } else if (laterOp.type === 'set') {
                                // For set operations, we need to find the stock before the set
                                // Look for the previous operation for this product before the set
                                let stockBeforeSet = calculatedStock;
                                for (let j = i - 1; j >= 0; j--) {
                                    const prevOp = sortedOperations[j];
                                    if (prevOp.productId === laterOp.productId) {
                                        const prevQuantity = parseFloat(prevOp.quantity || 0);
                                        if (prevOp.type === 'increase') {
                                            stockBeforeSet = stockBeforeSet - prevQuantity;
                                        } else if (prevOp.type === 'decrease') {
                                            stockBeforeSet = stockBeforeSet + prevQuantity;
                                        } else if (prevOp.type === 'set') {
                                            stockBeforeSet = prevQuantity;
                                        }
                                        break;
                                    }
                                }
                                calculatedStock = stockBeforeSet;
                            }
                        }
                    }
                    
                    // calculatedStock is now the stock before this operation
                    oldStock = Math.max(0, calculatedStock);
                    
                    // Calculate newStock and change
                    newStock = oldStock;
                    change = 0;
                    
                    if (op.type === 'increase') {
                        newStock = oldStock + quantity;
                        change = quantity;
                    } else if (op.type === 'decrease') {
                        newStock = Math.max(0, oldStock - quantity);
                        change = -quantity;
                    } else if (op.type === 'set') {
                        newStock = quantity;
                        change = newStock - oldStock;
                    }
                }
                
                return {
                    id: op.id,
                    operationNumber: op.adjustmentNumber || op.operationNumber,
                    adjustmentNumber: op.adjustmentNumber,
                    productId: op.productId,
                    productName: product.name || product.productName || 'غير معروف',
                    productCode: product.code || product.productCode || '',
                    date: op.date,
                    adjustmentType: op.type,
                    type: op.type,
                    adjustmentAmount: quantity,
                    quantity: quantity,
                    oldStock: oldStock,
                    newStock: newStock,
                    change: change,
                    reason: op.reason || '',
                    notes: op.notes || '',
                    createdAt: op.createdAt,
                    updatedAt: op.updatedAt || op.createdAt
                };
            }).filter(op => op !== null); // Remove null entries
            
            // Sort by date descending for display (newest first)
            inventoryOperations.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            
            // Load categories from products
            categories = [...new Set(products.map(p => p.category).filter(c => c))];
        } catch (error) {
            console.error('[Inventory] Error loading data from database:', error);
            // Fallback to localStorage
            loadFromLocalStorage();
        }
    } else {
        loadFromLocalStorage();
    }
    
}

function loadFromLocalStorage() {
    const inventoryData = localStorage.getItem(STORAGE_KEYS.INVENTORY);
    const productsData = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    const categoriesData = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    const customersData = localStorage.getItem('asel_customers');
    const suppliersData = localStorage.getItem('asel_suppliers');

    inventoryOperations = inventoryData ? JSON.parse(inventoryData) : [];
    products = productsData ? JSON.parse(productsData) : [];
    categories = categoriesData ? JSON.parse(categoriesData) : [];
    customers = customersData ? JSON.parse(customersData) : [];
    suppliers = suppliersData ? JSON.parse(suppliersData) : [];
}

// Save Inventory Operations
function saveInventoryOperations() {
    localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(inventoryOperations));
}

// Generate Inventory Operation Number
function generateInventoryNumber() {
    let counter = parseInt(localStorage.getItem(STORAGE_KEYS.INVENTORY_COUNTER) || '0');
    counter++;
    localStorage.setItem(STORAGE_KEYS.INVENTORY_COUNTER, counter.toString());
    
    const year = new Date().getFullYear();
    // Format: INV-2024-001
    return `INV-STK-${year}-${String(counter).padStart(3, '0')}`;
}

// Render Products (for both adjustment and return forms)
function renderProducts() {
    // Render for adjustment form
    const adjustmentSelect = document.getElementById('adjustmentProductSelect');
    if (adjustmentSelect) {
        renderProductsInSelect(adjustmentSelect);
    }
    
    // Render for return form (all products)
    const returnSelect = document.getElementById('returnProductSelect');
    if (returnSelect) {
        renderProductsInSelect(returnSelect);
    }
}

// Helper function to render products in a select element
function renderProductsInSelect(select) {
    if (!select) {
        console.error('Product select element not found');
        return;
    }
    
    select.innerHTML = '<option value="">اختر المنتج</option>';
    
    if (!products || products.length === 0) {
        // No products available - this is normal if no products have been added yet
        return;
    }
    
    const activeProducts = products.filter(p => {
        // Filter active products or products without status
        const isActive = p.status === 'active' || !p.status || p.status === undefined;
        // Make sure product has id, name, and code
        const hasRequiredFields = p.id && (p.name || p.productName) && (p.code || p.productCode);
        return isActive && hasRequiredFields;
    });
    
    if (activeProducts.length === 0) {
        // No active products found - this is normal if all products are inactive
        return;
    }
    
    activeProducts.forEach(product => {
        const option = document.createElement('option');
        option.value = product.id;
        const productName = product.name || product.productName || 'غير معروف';
        const productCode = product.code || product.productCode || '';
        const productCategory = product.category || '';
        // Display: Name - Code - Category
        let displayText = productName;
        if (productCode) {
            displayText += ' - ' + productCode;
        }
        if (productCategory) {
            displayText += ' - ' + productCategory;
        }
        option.textContent = displayText;
        option.dataset.product = JSON.stringify(product);
        select.appendChild(option);
    });
    
}

// Render Categories (for both tabs)
function renderCategories() {
    // Render for adjustment tab
    const adjustmentSelect = document.getElementById('adjustmentCategoryFilter');
    if (adjustmentSelect) {
        adjustmentSelect.innerHTML = '<option value="">جميع الأصناف</option>';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            adjustmentSelect.appendChild(option);
        });
    }
    
    // Render for return tab
    const returnSelect = document.getElementById('returnCategoryFilter');
    if (returnSelect) {
        returnSelect.innerHTML = '<option value="">جميع الأصناف</option>';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            returnSelect.appendChild(option);
        });
    }
}

// Open New Adjustment
function openNewAdjustment() {
    try {
        
        const adjustmentIsEdit = document.getElementById('adjustmentIsEdit');
        const adjustmentId = document.getElementById('adjustmentId');
        const adjustmentModalTitle = document.getElementById('adjustmentModalTitle');
        const adjustmentForm = document.getElementById('adjustmentForm');
        const adjustmentProductInfo = document.getElementById('adjustmentProductInfo');
        const adjustmentNewStockRow = document.getElementById('adjustmentNewStockRow');
        const adjustmentDate = document.getElementById('adjustmentDate');
        const adjustmentType = document.getElementById('adjustmentType');
        
        if (!adjustmentIsEdit || !adjustmentId || !adjustmentModalTitle || !adjustmentForm) {
            console.error('[Inventory] Required elements not found for adjustment modal');
            if (window.showToast) {
                window.showToast('حدث خطأ أثناء فتح النافذة. يرجى تحديث الصفحة والمحاولة مرة أخرى.', 'error');
            } else {
            if (window.showToast) {
                window.showToast('حدث خطأ أثناء فتح النافذة. يرجى تحديث الصفحة والمحاولة مرة أخرى.', 'error');
            }
            }
            return;
        }
        
        adjustmentIsEdit.value = 'false';
        adjustmentId.value = '';
        adjustmentModalTitle.textContent = 'عملية جرد جديدة';
        adjustmentForm.reset();
        
        if (adjustmentProductInfo) {
            adjustmentProductInfo.classList.add('hidden');
        }
        if (adjustmentNewStockRow) {
            adjustmentNewStockRow.style.display = 'none';
        }
        
        const today = new Date().toISOString().split('T')[0];
        if (adjustmentDate) {
            adjustmentDate.value = today;
        }
        if (adjustmentType) {
            adjustmentType.value = 'increase';
        }
        
        // Call onAdjustmentTypeChange if it exists
        if (typeof onAdjustmentTypeChange === 'function') {
            try {
                onAdjustmentTypeChange();
            } catch (error) {
                console.error('[Inventory] Error calling onAdjustmentTypeChange:', error);
            }
        }
        
        const adjustmentModal = document.getElementById('adjustmentModal');
        if (adjustmentModal) {
            adjustmentModal.classList.add('active');
            
            // Ensure focus is restored after opening modal
            setTimeout(() => {
                window.focus();
                // Try to focus on first input field
                const firstInput = adjustmentModal.querySelector('input:not([type="hidden"]):not([readonly]), select, textarea');
                if (firstInput && !firstInput.disabled && !firstInput.readOnly) {
                    setTimeout(() => {
                        firstInput.focus();
                    }, 50);
                }
            }, 100);
        } else {
            console.error('[Inventory] adjustmentModal not found!');
            if (window.showToast) {
                window.showToast('حدث خطأ أثناء فتح النافذة. يرجى تحديث الصفحة والمحاولة مرة أخرى.', 'error');
            } else {
            if (window.showToast) {
                window.showToast('حدث خطأ أثناء فتح النافذة. يرجى تحديث الصفحة والمحاولة مرة أخرى.', 'error');
            }
            }
        }
    } catch (error) {
        console.error('[Inventory] Error in openNewAdjustment:', error);
        if (window.showToast) {
            window.showToast('حدث خطأ أثناء فتح النافذة: ' + error.message, 'error');
        }
    }
}

// Open New Return
function openNewReturn() {
    
    document.getElementById('returnIsEdit').value = 'false';
    document.getElementById('returnId').value = '';
    document.getElementById('returnModalTitle').textContent = 'عملية مرتجع جديدة';
    document.getElementById('returnForm').reset();
    
    // Hide return-specific fields initially
    document.getElementById('returnEntitySelectGroup').style.display = 'none';
    document.getElementById('returnProductSelect').innerHTML = '<option value="">اختر المنتج</option>';
    document.getElementById('returnUnit').value = '';
    document.getElementById('returnQuantity').value = '';
    document.getElementById('returnUnitPrice').value = '';
    document.getElementById('returnReason').value = '';
    
    // Reset restore balance checkbox
    const restoreBalanceCheckbox = document.getElementById('restoreBalance');
    if (restoreBalanceCheckbox) {
        restoreBalanceCheckbox.checked = false;
    }
    const restoreBalanceRow = document.getElementById('restoreBalanceRow');
    if (restoreBalanceRow) {
        restoreBalanceRow.style.display = 'none';
    }
    
    // Render products in return form
    renderProducts();
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('returnDate').value = today;
    
    document.getElementById('returnModal').classList.add('active');
    
    // Ensure focus is restored after opening modal
    setTimeout(() => {
        window.focus();
        // Try to focus on first input field
        const firstInput = document.querySelector('#returnModal input:not([type="hidden"]), #returnModal select, #returnModal textarea');
        if (firstInput) {
            setTimeout(() => {
                firstInput.focus();
            }, 50);
        }
    }, 100);
}

// Close Adjustment Modal
function closeAdjustmentModal() {
    document.getElementById('adjustmentModal').classList.remove('active');
    document.getElementById('adjustmentForm').reset();
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

// Close Return Modal
function closeReturnModal() {
    document.getElementById('returnModal').classList.remove('active');
    document.getElementById('returnForm').reset();
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

// Adjustment Form Event Handlers
function onAdjustmentProductChange() {
    const productId = document.getElementById('adjustmentProductSelect').value;
    if (!productId) {
        document.getElementById('adjustmentProductInfo').classList.add('hidden');
        return;
    }

    const product = products.find(p => p.id === productId);
    if (product) {
        document.getElementById('adjustmentCurrentStock').textContent = (product.stock || 0).toFixed(2);
        document.getElementById('adjustmentProductUnit').textContent = product.smallestUnit;
        document.getElementById('adjustmentProductInfo').classList.remove('hidden');
        calculateAdjustmentNewStock();
    }
}

function onAdjustmentTypeChange() {
    calculateAdjustmentNewStock();
}

function calculateAdjustmentNewStock() {
    const productId = document.getElementById('adjustmentProductSelect').value;
    if (!productId) return;

    const product = products.find(p => p.id === productId);
    if (!product) return;

    const adjustmentType = document.getElementById('adjustmentType').value;
    const adjustmentAmount = parseFloat(document.getElementById('adjustmentAmount').value) || 0;
    const currentStock = parseFloat(product.stock || 0);
    let newStock = currentStock;

    if (adjustmentType === 'increase') {
        newStock = currentStock + adjustmentAmount;
    } else if (adjustmentType === 'decrease') {
        newStock = Math.max(0, currentStock - adjustmentAmount);
    } else if (adjustmentType === 'set') {
        newStock = adjustmentAmount;
    }

    document.getElementById('adjustmentNewStock').value = newStock.toFixed(2);
    if (adjustmentType === 'set') {
        document.getElementById('adjustmentNewStockRow').style.display = 'flex';
    } else {
        document.getElementById('adjustmentNewStockRow').style.display = 'none';
    }
}

// Return Form Event Handlers
function onReturnTypeChange() {
    const returnType = document.getElementById('returnType').value;
    const entitySelectGroup = document.getElementById('returnEntitySelectGroup');
    const entitySelect = document.getElementById('returnEntitySelect');
    const entityLabel = document.getElementById('returnEntityLabel');


    if (!entitySelectGroup || !entitySelect || !entityLabel) {
        console.error('[Return] Required elements not found!');
        console.error('[Return] entitySelectGroup:', entitySelectGroup);
        console.error('[Return] entitySelect:', entitySelect);
        console.error('[Return] entityLabel:', entityLabel);
        return;
    }

    if (returnType === 'from_customer') {
        entitySelectGroup.style.display = 'flex';
        entityLabel.textContent = 'اختر العميل';
        entitySelect.innerHTML = '<option value="">اختر العميل</option>';
        
        // Show restore balance option for customer returns
        const restoreBalanceRow = document.getElementById('restoreBalanceRow');
        if (restoreBalanceRow) {
            restoreBalanceRow.style.display = 'flex';
        }
        
        if (customers.length === 0) {
            console.warn('[Return] No customers available!');
            entitySelect.innerHTML = '<option value="">لا يوجد عملاء - يرجى إضافة عملاء أولاً</option>';
        } else {
            customers.forEach(customer => {
                const option = document.createElement('option');
                option.value = customer.id;
                option.textContent = customer.name || customer.customerName || 'عميل بدون اسم';
                entitySelect.appendChild(option);
            });
        }
    } else if (returnType === 'to_supplier') {
        entitySelectGroup.style.display = 'flex';
        entityLabel.textContent = 'اختر المورد';
        entitySelect.innerHTML = '<option value="">اختر المورد</option>';
        
        // Show restore balance option for supplier returns
        const restoreBalanceRow = document.getElementById('restoreBalanceRow');
        const restoreBalanceLabel = document.getElementById('restoreBalanceLabel');
        const restoreBalanceHint = document.getElementById('restoreBalanceHint');
        if (restoreBalanceRow) {
            restoreBalanceRow.style.display = 'flex';
        }
        if (restoreBalanceLabel) {
            restoreBalanceLabel.textContent = 'استعادة الرصيد في حساب المورد';
        }
        if (restoreBalanceHint) {
            restoreBalanceHint.textContent = 'إذا تم تحديد هذا الخيار، سيتم خصم قيمة المرتجع من رصيد المورد';
        }
        
        if (suppliers.length === 0) {
            console.warn('[Return] No suppliers available!');
            entitySelect.innerHTML = '<option value="">لا يوجد موردين - يرجى إضافة موردين أولاً</option>';
        } else {
            suppliers.forEach(supplier => {
                const option = document.createElement('option');
                option.value = supplier.id;
                option.textContent = supplier.name || supplier.supplierName || 'مورد بدون اسم';
                entitySelect.appendChild(option);
            });
        }
    } else {
        entitySelectGroup.style.display = 'none';
    }
}

function onReturnEntitySelectChange() {
    // Just ensure product select is visible when entity is selected
    // No need to load invoices anymore
}

function onReturnProductChangeForReturn() {
    const productId = document.getElementById('returnProductSelect').value;
    const returnQuantityField = document.getElementById('returnQuantity');
    const unitPriceField = document.getElementById('returnUnitPrice');
    const returnUnitField = document.getElementById('returnUnit');


    if (!productId) {
        returnQuantityField.value = '';
        unitPriceField.value = '';
        if (returnUnitField) returnUnitField.value = '';
        return;
    }

    const product = products.find(p => p.id === productId);
    if (product) {
        // Set unit
        const unit = product.smallestUnit || product.unit || '';
        if (returnUnitField) {
            returnUnitField.value = unit;
        }
        
        // Clear quantity and price fields
        returnQuantityField.value = '';
        unitPriceField.value = '';
    } else {
        console.error('[Return] Product not found in products array. ProductId:', productId);
        console.error('[Return] Available product IDs:', products.map(p => p.id));
        if (window.showToast) {
            window.showToast('المنتج غير موجود', 'error');
        } else {
        if (window.showToast) {
            window.showToast('المنتج غير موجود', 'error');
        }
        }
    }
}

async function loadInvoicesForReturn(returnType, entityId) {
    const date = document.getElementById('returnDate').value;
    const invoiceSelect = document.getElementById('returnInvoiceSelect');
    const invoiceType = returnType === 'from_customer' ? 'sales' : 'purchase';
    
    invoiceSelect.innerHTML = '<option value="">اختر الفاتورة</option>';
    
    try {
        const invoices = await window.electronAPI.dbGetAll(
            invoiceType === 'sales' ? 'sales_invoices' : 'purchase_invoices',
            '',
            []
        ) || [];
        
        const filteredInvoices = invoices.filter(inv => {
            const matchesEntity = inv.customerId === entityId || inv.supplierId === entityId;
            const matchesDate = !date || inv.date <= date;
            return matchesEntity && matchesDate;
        });
        
        filteredInvoices.forEach(inv => {
            const option = document.createElement('option');
            option.value = inv.id;
            option.textContent = `${inv.invoiceNumber} - ${new Date(inv.date).toLocaleDateString('ar-EG')}`;
            invoiceSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading invoices:', error);
    }
}

async function loadInvoiceProductsForReturn(invoiceId) {
    const returnType = document.getElementById('returnType').value;
    const invoiceType = returnType === 'from_customer' ? 'sales' : 'purchase';
    const productSelect = document.getElementById('returnProductSelect');
    
    productSelect.innerHTML = '<option value="">اختر المنتج</option>';
    
    try {
        const invoiceItems = await window.electronAPI.dbGetAll(
            invoiceType === 'sales' ? 'sales_invoice_items' : 'purchase_invoice_items',
            '',
            []
        ) || [];
        
        const filteredItems = invoiceItems.filter(item => item.invoiceId === invoiceId);
        
        for (const item of filteredItems) {
            const product = products.find(p => p.id === item.productId);
            if (product) {
                const option = document.createElement('option');
                option.value = product.id;
                const productName = product.name || product.productName || 'غير معروف';
                const productCode = product.code || product.productCode || '';
                option.textContent = `${productName}${productCode ? ' - ' + productCode : ''} (الكمية في الفاتورة: ${item.quantity})`;
                option.dataset.product = JSON.stringify(product);
                option.dataset.invoiceQuantity = item.quantity || 0;
                option.dataset.invoicePrice = item.price || 0;
                productSelect.appendChild(option);
            }
        }
    } catch (error) {
        console.error('Error loading invoice items:', error);
    }
}

// On Product Change
function onProductChange() {
    const productId = document.getElementById('productSelect').value;
    if (!productId) {
        document.getElementById('productInfo').classList.add('hidden');
        return;
    }

    const productData = JSON.parse(document.getElementById('productSelect').options[document.getElementById('productSelect').selectedIndex].dataset.product);
    const product = products.find(p => p.id === productId);
    
    if (product) {
        document.getElementById('currentStock').textContent = (product.stock || 0).toFixed(2);
        document.getElementById('productUnit').textContent = product.smallestUnit;
        document.getElementById('productInfo').classList.remove('hidden');
        calculateNewStock();
    }
}

// On Operation Type Change
function onOperationTypeChange() {
    const operationType = document.getElementById('operationType').value;
    const returnTypeRow = document.getElementById('returnTypeRow');
    const returnReasonRow = document.getElementById('returnReasonRow');
    const unitPriceGroup = document.getElementById('unitPriceGroup');
    const adjustmentTypeRow = document.getElementById('adjustmentTypeRow');
    const adjustmentTypeSelect = document.getElementById('adjustmentType');

    const returnQuantityRow = document.getElementById('returnQuantityRow');
    const adjustmentAmountField = document.getElementById('adjustmentAmount');

    if (operationType === 'return') {
        // Show return fields
        returnTypeRow.style.display = 'flex';
        returnReasonRow.style.display = 'flex';
        unitPriceGroup.style.display = 'flex';
        returnQuantityRow.style.display = 'flex';
        // Hide adjustment type for returns
        if (adjustmentTypeRow) {
            adjustmentTypeRow.style.display = 'none';
        }
        if (adjustmentTypeSelect) {
            adjustmentTypeSelect.removeAttribute('required');
            adjustmentTypeSelect.value = 'increase'; // Default for returns
        }
        // Hide adjustmentAmount field for returns, show returnQuantity instead
        if (adjustmentAmountField) {
            adjustmentAmountField.style.display = 'none';
            adjustmentAmountField.removeAttribute('required');
        }
    } else {
        // Hide return fields
        returnTypeRow.style.display = 'none';
        returnReasonRow.style.display = 'none';
        unitPriceGroup.style.display = 'none';
        returnQuantityRow.style.display = 'none';
        // Show adjustment type for adjustments
        if (adjustmentTypeRow) {
            adjustmentTypeRow.style.display = 'flex';
        }
        if (adjustmentTypeSelect) {
            adjustmentTypeSelect.setAttribute('required', 'required');
        }
        // Show adjustmentAmount field for adjustments
        if (adjustmentAmountField) {
            adjustmentAmountField.style.display = 'block';
            adjustmentAmountField.setAttribute('required', 'required');
        }
        // Reset return fields
        document.getElementById('returnType').value = '';
        document.getElementById('entitySelect').value = '';
        document.getElementById('entitySelectGroup').style.display = 'none';
        document.getElementById('invoiceSelectRow').style.display = 'none';
        document.getElementById('returnReason').value = '';
        document.getElementById('unitPrice').value = '';
        document.getElementById('returnQuantity').value = '';
        // Reset product select to show all products
        renderProducts();
    }
}

// Note: This duplicate function has been removed. The correct onReturnTypeChange is defined earlier at line 628.
// This function was using incorrect IDs (entitySelectGroup instead of returnEntitySelectGroup).

// On Entity Select Change
async function onEntitySelectChange() {
    const entityId = document.getElementById('entitySelect').value;
    const returnType = document.getElementById('returnType').value;
    const invoiceSelectRow = document.getElementById('invoiceSelectRow');
    const invoiceSelect = document.getElementById('invoiceSelect');

    if (!entityId || !returnType) {
        invoiceSelectRow.style.display = 'none';
        return;
    }

    // Show invoice select
    invoiceSelectRow.style.display = 'flex';
    
    // Load invoices based on date filter
    await loadInvoicesForReturn();
}

// On Date Change
async function onDateChange() {
    const operationType = document.getElementById('operationType').value;
    const entityId = document.getElementById('entitySelect').value;
    
    // Only reload invoices if it's a return and entity is selected
    if (operationType === 'return' && entityId) {
        await loadInvoicesForReturn();
    }
}

// Load Invoices for Return
async function loadInvoicesForReturn() {
    const returnType = document.getElementById('returnType').value;
    const entityId = document.getElementById('entitySelect').value;
    const date = document.getElementById('inventoryDate').value;
    const invoiceSelect = document.getElementById('invoiceSelect');

    if (!returnType || !entityId) {
        invoiceSelect.innerHTML = '<option value="">اختر الفاتورة</option>';
        return;
    }

    invoiceSelect.innerHTML = '<option value="">جارٍ التحميل...</option>';

    try {
        let invoices = [];
        const invoiceType = returnType === 'from_customer' ? 'sales' : 'purchase';
        const tableName = returnType === 'from_customer' ? 'sales_invoices' : 'purchase_invoices';
        const entityField = returnType === 'from_customer' ? 'customerId' : 'supplierId';

        if (window.electronAPI && window.electronAPI.dbGetAll) {
            // Build query with date filter
            let query = `${entityField} = ?`;
            let params = [entityId];

            if (date) {
                // Filter invoices by date (invoices on or before the selected date)
                query += ' AND date <= ?';
                params.push(date);
            }

            invoices = await window.electronAPI.dbGetAll(tableName, query, params) || [];
            
            // Sort by date descending (newest first)
            invoices.sort((a, b) => new Date(b.date) - new Date(a.date));
        } else {
            // Fallback to localStorage
            const invoicesData = localStorage.getItem(`asel_${tableName}`);
            if (invoicesData) {
                invoices = JSON.parse(invoicesData).filter(inv => {
                    const matchesEntity = inv[entityField] === entityId;
                    const matchesDate = !date || inv.date <= date;
                    return matchesEntity && matchesDate;
                });
                invoices.sort((a, b) => new Date(b.date) - new Date(a.date));
            }
        }

        // Populate invoice select
        invoiceSelect.innerHTML = '<option value="">اختر الفاتورة</option>';
        
        if (invoices.length === 0) {
            invoiceSelect.innerHTML = '<option value="">لا توجد فواتير في التاريخ المحدد</option>';
            return;
        }

        invoices.forEach(invoice => {
            const option = document.createElement('option');
            option.value = invoice.id;
            const invoiceDate = new Date(invoice.date).toLocaleDateString('ar-EG');
            option.textContent = `${invoice.invoiceNumber || invoice.id} - ${invoiceDate} - ${formatCurrency(invoice.total || 0)}`;
            option.dataset.invoice = JSON.stringify(invoice);
            invoiceSelect.appendChild(option);
        });

    } catch (error) {
        console.error('Error loading invoices:', error);
        invoiceSelect.innerHTML = '<option value="">خطأ في تحميل الفواتير</option>';
    }
}

// On Invoice Select Change
async function onInvoiceSelectChange() {
    const invoiceId = document.getElementById('invoiceSelect').value;
    const returnType = document.getElementById('returnType').value;
    const productSelect = document.getElementById('productSelect');
    const returnQuantityField = document.getElementById('returnQuantity');
    const maxReturnQuantitySpan = document.getElementById('maxReturnQuantity');

    if (!invoiceId) {
        // Reset product select to show all products
        renderProducts();
        returnQuantityField.value = '';
        maxReturnQuantitySpan.textContent = '0';
        return;
    }

    // Load invoice items
    try {
        const invoiceType = returnType === 'from_customer' ? 'sales' : 'purchase';
        const itemsTableName = returnType === 'from_customer' ? 'sales_invoice_items' : 'purchase_invoice_items';
        
        let invoiceItems = [];
        
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            invoiceItems = await window.electronAPI.dbGetAll(itemsTableName, 'invoiceId = ?', [invoiceId]) || [];
        } else {
            // Fallback to localStorage
            const itemsData = localStorage.getItem(`asel_${itemsTableName}`);
            if (itemsData) {
                invoiceItems = JSON.parse(itemsData).filter(item => item.invoiceId === invoiceId);
            }
        }

        // Populate product select with invoice items only
        productSelect.innerHTML = '<option value="">اختر المنتج</option>';

        if (invoiceItems.length === 0) {
            productSelect.innerHTML = '<option value="">لا توجد منتجات في هذه الفاتورة</option>';
            return;
        }

        // Get product details for each invoice item
        for (const item of invoiceItems) {
            let product = null;
            
            if (window.electronAPI && window.electronAPI.dbGet) {
                try {
                    product = await window.electronAPI.dbGet('products', item.productId);
                } catch (error) {
                    console.error('Error loading product:', error);
                    product = products.find(p => p.id === item.productId);
                }
            } else {
                product = products.find(p => p.id === item.productId);
            }

            if (product) {
                const option = document.createElement('option');
                option.value = product.id;
                const productName = product.name || product.productName || item.productName || 'غير معروف';
                const productCode = product.code || product.productCode || '';
                option.textContent = `${productName}${productCode ? ' - ' + productCode : ''} (الكمية في الفاتورة: ${item.quantity})`;
                option.dataset.product = JSON.stringify(product);
                option.dataset.invoiceQuantity = item.quantity || 0;
                option.dataset.invoicePrice = item.price || 0;
                productSelect.appendChild(option);
            }
        }

    } catch (error) {
        console.error('Error loading invoice items:', error);
        productSelect.innerHTML = '<option value="">خطأ في تحميل منتجات الفاتورة</option>';
    }
}

// On Product Change (for returns)
function onProductChangeForReturn() {
    const productId = document.getElementById('productSelect').value;
    const returnQuantityField = document.getElementById('returnQuantity');
    const maxReturnQuantitySpan = document.getElementById('maxReturnQuantity');
    const unitPriceField = document.getElementById('unitPrice');

    if (!productId) {
        returnQuantityField.value = '';
        maxReturnQuantitySpan.textContent = '0';
        unitPriceField.value = '';
        return;
    }

    const selectedOption = document.getElementById('productSelect').options[document.getElementById('productSelect').selectedIndex];
    if (selectedOption && selectedOption.dataset.invoiceQuantity) {
        const maxQuantity = parseFloat(selectedOption.dataset.invoiceQuantity) || 0;
        const invoicePrice = parseFloat(selectedOption.dataset.invoicePrice) || 0;
        
        maxReturnQuantitySpan.textContent = maxQuantity.toFixed(2);
        returnQuantityField.setAttribute('max', maxQuantity);
        returnQuantityField.value = '';
        
        // Set unit price from invoice
        if (invoicePrice > 0) {
            unitPriceField.value = invoicePrice.toFixed(2);
        }
    }

    // Also show current stock
    const productData = JSON.parse(selectedOption.dataset.product);
    const product = products.find(p => p.id === productId);
    
    if (product) {
        document.getElementById('currentStock').textContent = (product.stock || 0).toFixed(2);
        document.getElementById('productUnit').textContent = product.smallestUnit;
        document.getElementById('productInfo').classList.remove('hidden');
    }
}

// On Return Reason Change
function onReturnReasonChange() {
    const returnReason = document.getElementById('returnReason').value;
    const returnReasonHint = document.getElementById('returnReasonHint');
    const returnType = document.getElementById('returnType')?.value;
    
    if (!returnReasonHint) return;
    
    if (returnReason === 'damaged' || returnReason === 'expired') {
        const reasonText = returnReason === 'damaged' ? 'تالف' : 'منتهي الصلاحية';
        returnReasonHint.textContent = `⚠️ إذا كان السبب "${reasonText}" لن يتم إعادة الكمية للمخزون`;
        returnReasonHint.style.color = '#e74c3c';
        returnReasonHint.style.fontWeight = 'bold';
        returnReasonHint.style.display = 'block';
    } else if (returnReason) {
        // Get entity type for better message
        let entityType = '';
        if (returnType === 'from_customer') {
            entityType = 'العميل';
        } else if (returnType === 'to_supplier') {
            entityType = 'المورد';
        }
        
        if (entityType) {
            returnReasonHint.textContent = `✅ سيتم إعادة الكمية للمخزون. يمكنك خصم المبلغ من رصيد ${entityType} من خلال تحديد "استعادة الرصيد" أدناه`;
    } else {
            returnReasonHint.textContent = '✅ سيتم إعادة الكمية للمخزون. يمكنك خصم المبلغ من الرصيد من خلال تحديد "استعادة الرصيد" أدناه';
        }
        returnReasonHint.style.color = '#27ae60';
        returnReasonHint.style.fontWeight = 'bold';
        returnReasonHint.style.display = 'block';
    } else {
        returnReasonHint.textContent = 'إذا كان السبب "تالف" أو "منتهي الصلاحية" لن يتم إعادة الكمية للمخزون';
        returnReasonHint.style.color = '#666';
        returnReasonHint.style.fontWeight = 'normal';
        returnReasonHint.style.display = 'block';
    }
}

// Calculate Return Total
function calculateReturnTotal() {
    const quantity = parseFloat(document.getElementById('adjustmentAmount').value) || 0;
    const unitPrice = parseFloat(document.getElementById('unitPrice').value) || 0;
    const total = quantity * unitPrice;
    
    // Display total (you can add a display field if needed)
}

// On Adjustment Type Change
function onAdjustmentTypeChange() {
    const adjustmentType = document.getElementById('adjustmentType')?.value;
    const amountHint = document.getElementById('adjustmentAmountHint');
    const newStockRow = document.getElementById('adjustmentNewStockRow');

    if (!adjustmentType) return;
    
    if (!amountHint || !newStockRow) {
        // Elements might not be loaded yet, skip silently
        return;
    }

    if (adjustmentType === 'increase') {
        if (amountHint) amountHint.textContent = 'كمية الزيادة في المخزون';
        if (newStockRow) newStockRow.style.display = 'flex';
    } else if (adjustmentType === 'decrease') {
        if (amountHint) amountHint.textContent = 'كمية النقصان من المخزون';
        if (newStockRow) newStockRow.style.display = 'flex';
    } else if (adjustmentType === 'set') {
        if (amountHint) amountHint.textContent = 'المخزون الجديد (سيتم استبدال القيمة الحالية)';
        if (newStockRow) newStockRow.style.display = 'flex';
    }

    // Only calculate if elements are available
    try {
        calculateNewStock();
    } catch (error) {
        // Silently ignore if elements not ready
    }
}

// Calculate New Stock
function calculateNewStock() {
    const productSelect = document.getElementById('adjustmentProductSelect');
    const adjustmentTypeEl = document.getElementById('adjustmentType');
    const adjustmentAmountEl = document.getElementById('adjustmentAmount');
    const newStockEl = document.getElementById('adjustmentNewStock');
    
    if (!productSelect || !adjustmentTypeEl || !adjustmentAmountEl || !newStockEl) {
        return; // Elements not loaded yet
    }
    
    const productId = productSelect.value;
    const adjustmentType = adjustmentTypeEl.value;
    const adjustmentAmount = parseFloat(adjustmentAmountEl.value) || 0;

    if (!productId) return;

    const product = products.find(p => p.id === productId);
    if (!product) return;

    const currentStock = product.stock || 0;
    let newStock = currentStock;

    if (adjustmentType === 'increase') {
        newStock = currentStock + adjustmentAmount;
    } else if (adjustmentType === 'decrease') {
        newStock = Math.max(0, currentStock - adjustmentAmount);
    } else if (adjustmentType === 'set') {
        newStock = adjustmentAmount;
    }

    newStockEl.value = newStock.toFixed(2);
}

// Handle Form Submit
// Handle Adjustment Form Submit
async function handleAdjustmentSubmit(e) {
    e.preventDefault();

    try {
        
        const productId = document.getElementById('adjustmentProductSelect').value;
        const date = document.getElementById('adjustmentDate').value;
        const adjustmentType = document.getElementById('adjustmentType').value;
        const adjustmentAmount = parseFloat(document.getElementById('adjustmentAmount').value) || 0;
        const reasonElement = document.getElementById('adjustmentReason');
        const notesElement = document.getElementById('adjustmentNotes');
        const reason = reasonElement ? reasonElement.value.trim() : '';
        const notes = notesElement ? notesElement.value.trim() : '';

        if (!productId) {
            if (window.showToast) {
                window.showToast('يرجى اختيار المنتج', 'error');
            } else {
            if (window.showToast) {
                window.showToast('يرجى اختيار المنتج', 'error');
            }
            }
            return;
        }

        if (!adjustmentAmount || adjustmentAmount <= 0) {
            if (window.showToast) {
                window.showToast('يرجى إدخال كمية صحيحة', 'error');
            } else {
            if (window.showToast) {
                window.showToast('يرجى إدخال كمية صحيحة', 'error');
            }
            }
            return;
        }

        if (!reason) {
            if (window.showToast) {
                window.showToast('يرجى إدخال سبب التعديل', 'error');
            }
            return;
        }

        // Get product from database first to ensure we have latest stock
        let product = null;
        if (window.electronAPI && window.electronAPI.dbGet) {
            try {
                product = await window.electronAPI.dbGet('products', productId);
            } catch (error) {
                console.error('[Inventory] Error loading product from database:', error);
                // Fallback to local array
                product = products.find(p => p.id === productId);
            }
        } else {
            // Fallback to local array
            product = products.find(p => p.id === productId);
        }

        if (!product) {
            if (window.showToast) {
            window.showToast('المنتج غير موجود', 'error');
        }
            return;
        }

        const currentStock = parseFloat(product.stock || 0);
        let newStock = currentStock;

        if (adjustmentType === 'increase') {
            newStock = currentStock + adjustmentAmount;
        } else if (adjustmentType === 'decrease') {
            newStock = Math.max(0, currentStock - adjustmentAmount);
        } else if (adjustmentType === 'set') {
            newStock = adjustmentAmount;
        }

        // Create adjustment data
        const adjustmentData = {
            productId,
            date,
            type: adjustmentType,
            quantity: adjustmentAmount,
            reason,
            notes,
            oldStock: currentStock,
            newStock: newStock
        };


        // Save to database
        await saveAdjustmentToDatabase(adjustmentData);
    } catch (error) {
        console.error('[Inventory] Error in handleAdjustmentSubmit:', error);
        if (window.showToast) {
            window.showToast('خطأ في حفظ العملية: ' + error.message, 'error');
        }
    }
}

// Save Adjustment to Database
async function saveAdjustmentToDatabase(adjustmentData) {
    const { productId, date, type, quantity, reason, notes, oldStock, newStock } = adjustmentData;

    try {
        // CRITICAL: Get the LATEST product from database right before updating
        // This ensures we have the most current stock value, accounting for any concurrent updates
        let dbProduct = await window.electronAPI.dbGet('products', productId);
        if (!dbProduct) {
            throw new Error(`Product ${productId} not found in database`);
        }

        const actualCurrentStock = parseFloat(dbProduct.stock || 0);
        // Recalculate newStock based on ACTUAL current stock from database
        // This handles cases where stock was changed by another operation between form submission and now
        let recalculatedNewStock = newStock;
        const stockDifference = newStock - oldStock; // The change amount (could be positive or negative)
        
        // Apply the same change to the actual current stock
        recalculatedNewStock = actualCurrentStock + stockDifference;
        
        // For 'set' type, use the exact value
        if (type === 'set') {
            recalculatedNewStock = parseFloat(quantity);
        }
        
        // Update product stock with recalculated value
        let stockValue = parseFloat(recalculatedNewStock);
        if (isNaN(stockValue)) {
            throw new Error(`Invalid stock value: ${recalculatedNewStock}`);
        }
        
        dbProduct.stock = stockValue;
        dbProduct.lastInventoryDate = date;
        dbProduct.updatedAt = new Date().toISOString();

        // Update product stock - simplified approach for better performance
        // Get fresh product data and update directly
        const currentProduct = await window.electronAPI.dbGet('products', productId);
        if (!currentProduct) {
            throw new Error(`Product ${productId} not found in database`);
        }
        
        // Update product with target stock
        currentProduct.stock = stockValue;
        currentProduct.lastInventoryDate = date;
        currentProduct.updatedAt = new Date().toISOString();
        
        await window.electronAPI.dbUpdate('products', currentProduct.id, currentProduct);
        
        // Wait briefly to ensure database update is committed
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Verify the update (quick check)
        const verifyProduct = await window.electronAPI.dbGet('products', productId);
        const actualStock = parseFloat(verifyProduct?.stock || 0);
        const stockDiff = Math.abs(actualStock - stockValue);
        
        let finalStockValue = stockValue;
        if (stockDiff > 0.01) {
            // If mismatch, try one more time
            verifyProduct.stock = stockValue;
            verifyProduct.updatedAt = new Date().toISOString();
            await window.electronAPI.dbUpdate('products', verifyProduct.id, verifyProduct);
            finalStockValue = stockValue;
        } else {
            finalStockValue = actualStock;
        }
        
        // Update adjustmentData with final values for consistency
        // Note: actualCurrentStock was captured at the start, finalStockValue is the verified result
        adjustmentData.oldStock = actualCurrentStock;
        adjustmentData.newStock = finalStockValue;
        
        // Update stockValue for use in rest of function
        stockValue = finalStockValue;

        // Generate adjustment number
        const adjustmentNumber = generateInventoryNumber();
        const currentUserId = localStorage.getItem('asel_userId') || '';

        // Create adjustment record (matching database schema)
        // Use actualCurrentStock as oldStock to reflect the real state before adjustment
        // ⚠️ مهم: هذه القيم تظل ثابتة ولا تتغير (لقطة تاريخية)
        const adjustmentRecord = {
            id: Date.now().toString(),
            adjustmentNumber,
            productId,
            date,
            type,
            quantity,
            reason: reason || '',
            notes: notes || '',
            // المخزون القديم يُحفظ في عمود oldStock في جدول inventory_adjustments
            // المخزون القديم = المخزون الحالي من قاعدة البيانات (قبل عملية الجرد)
            // ⚠️ هذه القيمة تظل ثابتة ولا تتغير (لقطة تاريخية)
            oldStock: actualCurrentStock,
            // المخزون الجديد يُحفظ في عمود newStock
            // المخزون الجديد = المخزون بعد عملية الجرد
            // ⚠️ هذه القيمة تظل ثابتة ولا تتغير (لقطة تاريخية)
            newStock: finalStockValue,
            createdAt: new Date().toISOString()
        };

        // Save to database
        try {
            const insertResult = await window.electronAPI.dbInsert('inventory_adjustments', adjustmentRecord);
            
            if (!insertResult) {
                throw new Error('لم يتم إرجاع نتيجة من قاعدة البيانات');
            }
            
            // Check if insert was successful - better-sqlite3 returns { changes: number, lastInsertRowid: number }
            if (insertResult.changes === 0 && !insertResult.lastInsertRowid) {
                // Try to verify by querying the database
                const verifyRecord = await window.electronAPI.dbGet('inventory_adjustments', adjustmentRecord.id);
                if (!verifyRecord) {
                    throw new Error('فشل حفظ العملية في قاعدة البيانات - السجل غير موجود بعد الحفظ');
                }
            }
        } catch (insertError) {
            console.error('[Inventory] Error inserting adjustment record:', insertError);
            throw new Error('فشل حفظ عملية الجرد في قاعدة البيانات: ' + insertError.message);
        }
        
        // Wait briefly to ensure database insert is committed
        await new Promise(resolve => setTimeout(resolve, 200));

        // Verify the record was saved before reloading
        const savedRecord = await window.electronAPI.dbGet('inventory_adjustments', adjustmentRecord.id);
        if (!savedRecord) {
            console.error('[Inventory] CRITICAL: Record not found in database after insert!');
            throw new Error('فشل التحقق من حفظ العملية في قاعدة البيانات');
        }

        // Reload data - IMPORTANT: This reloads products and inventory operations from database
        try {
            await loadData();
            // Force refresh of adjustments table
            await applyAdjustmentFilters();
        } catch (loadError) {
            console.error('[Inventory] Error reloading data:', loadError);
            // Try to reload just the adjustments
            try {
                const rawInventoryOperations = await window.electronAPI.dbGetAll('inventory_adjustments', '', []) || [];
                const sortedOperations = [...rawInventoryOperations].sort((a, b) => {
                    const dateA = new Date(a.date);
                    const dateB = new Date(b.date);
                    if (dateA.getTime() === dateB.getTime()) {
                        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
                    }
                    return dateA - dateB;
                });
                
                inventoryOperations = sortedOperations.map((op, index) => {
                    const product = products.find(p => p.id === op.productId);
                    if (!product) return null;
                    
                    const quantity = parseFloat(op.quantity || 0);
                    let oldStock, newStock, change;
                    
                    if (op.oldStock !== undefined && op.oldStock !== null && 
                        op.newStock !== undefined && op.newStock !== null) {
                        oldStock = parseFloat(op.oldStock || 0);
                        newStock = parseFloat(op.newStock || 0);
                        change = newStock - oldStock;
                    } else {
                        // Fallback calculation
                        let calculatedStock = parseFloat(product.stock || 0);
                        for (let i = sortedOperations.length - 1; i > index; i--) {
                            const laterOp = sortedOperations[i];
                            if (laterOp.productId === op.productId) {
                                const laterQuantity = parseFloat(laterOp.quantity || 0);
                                if (laterOp.type === 'increase') {
                                    calculatedStock = calculatedStock - laterQuantity;
                                } else if (laterOp.type === 'decrease') {
                                    calculatedStock = calculatedStock + laterQuantity;
                                } else if (laterOp.type === 'set') {
                                    calculatedStock = parseFloat(laterOp.quantity || 0);
                                }
                            }
                        }
                        oldStock = Math.max(0, calculatedStock);
                        if (op.type === 'increase') {
                            newStock = oldStock + quantity;
                            change = quantity;
                        } else if (op.type === 'decrease') {
                            newStock = Math.max(0, oldStock - quantity);
                            change = -quantity;
                        } else {
                            newStock = quantity;
                            change = newStock - oldStock;
                        }
                    }
                    
                    return {
                        id: op.id,
                        operationNumber: op.adjustmentNumber || op.operationNumber,
                        adjustmentNumber: op.adjustmentNumber,
                        productId: op.productId,
                        productName: product.name || 'غير معروف',
                        productCode: product.code || '',
                        date: op.date,
                        adjustmentType: op.type,
                        type: op.type,
                        adjustmentAmount: quantity,
                        quantity: quantity,
                        oldStock: oldStock,
                        newStock: newStock,
                        change: change,
                        reason: op.reason || '',
                        notes: op.notes || '',
                        createdAt: op.createdAt,
                        updatedAt: op.updatedAt || op.createdAt
                    };
                }).filter(op => op !== null);
                
                inventoryOperations.sort((a, b) => new Date(b.date) - new Date(a.date));
                applyAdjustmentFilters();
            } catch (reloadError) {
                console.error('[Inventory] Error reloading adjustments:', reloadError);
            }
        }
        
        // Update UI immediately
        renderProducts();
        renderCategories();
        closeAdjustmentModal();
        
        // Show success message immediately
        if (window.showToast) {
            window.showToast('تم حفظ عملية الجرد بنجاح', 'success');
        }
        
        // Dispatch event to notify other screens (especially products screen) about stock change
        // Use BroadcastChannel if available for cross-window communication
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                const channel = new BroadcastChannel('product-stock-updates');
                channel.postMessage({
                    type: 'productStockUpdated',
                    productId: productId,
                    newStock: finalStockValue,
                    timestamp: Date.now()
                });
                channel.close();
            } catch (error) {
                console.error('[Inventory] Error using BroadcastChannel:', error);
            }
        }
        
        // Dispatch event to notify other screens about stock change
        window.dispatchEvent(new CustomEvent('productStockUpdated', { 
            detail: { productId: productId, newStock: finalStockValue },
            bubbles: true,
            cancelable: true
        }));
        
        // Also dispatch a global refresh event
        window.dispatchEvent(new CustomEvent('productsNeedRefresh', { 
            detail: { source: 'inventory' },
            bubbles: true 
        }));
        
        // Also try using localStorage as a fallback mechanism
        try {
            const updateMarker = {
                productId: productId,
                newStock: finalStockValue,
                timestamp: Date.now()
            };
            localStorage.setItem('last_product_stock_update', JSON.stringify(updateMarker));
        } catch (error) {
            console.error('[Inventory] Error setting localStorage update marker:', error);
        }
    } catch (error) {
        console.error('[Inventory] Error saving adjustment:', error);
        if (window.showToast) {
            window.showToast('خطأ في حفظ البيانات: ' + error.message, 'error');
        }
    }
}

// Handle Return Form Submit
async function handleReturnFormSubmit(e) {
    e.preventDefault();
    e.stopPropagation();
    

    try {
        const productId = document.getElementById('returnProductSelect').value;
        const date = document.getElementById('returnDate').value;
        const returnType = document.getElementById('returnType').value;
        const entityId = document.getElementById('returnEntitySelect').value;
        const returnQuantity = parseFloat(document.getElementById('returnQuantity').value) || 0;
        const unitPrice = parseFloat(document.getElementById('returnUnitPrice').value) || 0;
        const returnReason = document.getElementById('returnReason').value;
        const notes = document.getElementById('returnNotes').value.trim();

        // Validation
        if (!productId) {
            if (window.showToast) {
                window.showToast('يرجى اختيار المنتج', 'error');
            } else {
            if (window.showToast) {
                window.showToast('يرجى اختيار المنتج', 'error');
            }
            }
            return;
        }
        if (!date) {
            if (window.showToast) {
                window.showToast('يرجى اختيار التاريخ', 'error');
            }
            return;
        }
        if (!returnType) {
            if (window.showToast) {
                window.showToast('يرجى اختيار نوع المرتجع', 'error');
            }
            return;
        }
        if (!entityId) {
            if (window.showToast) {
                window.showToast('يرجى اختيار ' + (returnType === 'from_customer' ? 'العميل' : 'المورد'), 'error');
            }
            return;
        }
        if (!returnQuantity || returnQuantity <= 0) {
            if (window.showToast) {
                window.showToast('يرجى إدخال كمية صحيحة', 'error');
            } else {
            if (window.showToast) {
                window.showToast('يرجى إدخال كمية صحيحة', 'error');
            }
            }
            return;
        }
        if (!unitPrice || unitPrice <= 0) {
            if (window.showToast) {
                window.showToast('يرجى إدخال سعر الوحدة', 'error');
            }
            return;
        }
        if (!returnReason) {
            if (window.showToast) {
                window.showToast('يرجى اختيار سبب المرتجع', 'error');
            }
            return;
        }

        
        // Disable submit button to prevent double submission
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn ? submitBtn.textContent : 'حفظ المرتجع';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'جاري الحفظ...';
            submitBtn.style.opacity = '0.6';
            submitBtn.style.cursor = 'not-allowed';
        }
        
        try {
            // Call existing handleReturnSubmit function (without invoice)
            const result = await handleReturnSubmit(productId, date, returnReason, notes, returnType, entityId, null, returnQuantity, unitPrice);
            
            
            // Show success message
            if (window.showToast) {
                window.showToast('تم حفظ المرتجع بنجاح', 'success');
            }
            
            // Close modal and reload data
            closeReturnModal();
            await loadData();
            await applyReturnFilters();
        } catch (error) {
            console.error('[Return] Error in handleReturnSubmit:', error);
            console.error('[Return] Error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            if (window.showToast) {
                window.showToast('خطأ في حفظ المرتجع: ' + error.message, 'error');
            }
            throw error; // Re-throw to be caught by outer try-catch
        } finally {
            // Re-enable submit button
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
                submitBtn.style.opacity = '1';
                submitBtn.style.cursor = 'pointer';
            }
        }
    } catch (error) {
        console.error('[Return] Error in handleReturnFormSubmit:', error);
        console.error('[Return] Error stack:', error.stack);
        if (window.showToast) {
            window.showToast('خطأ في حفظ المرتجع: ' + error.message, 'error');
        }
        
        // Re-enable submit button on error
        const submitBtn = e.target.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'حفظ المرتجع';
        }
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const operationType = document.getElementById('operationType').value;
    const productId = document.getElementById('productSelect').value;
    const date = document.getElementById('inventoryDate').value;
    const reason = document.getElementById('reason').value.trim();
    const notes = document.getElementById('notes').value.trim();

    if (!productId) {
        if (window.showToast) {
            window.showToast('يرجى اختيار المنتج', 'error');
        } else {
        if (window.showToast) {
            window.showToast('يرجى اختيار المنتج', 'error');
        }
        }
        return;
    }

    // Handle Returns
    if (operationType === 'return') {
        await handleReturnSubmit(productId, date, reason, notes);
        return;
    }

    // Handle Inventory Adjustments
    const adjustmentType = document.getElementById('adjustmentType').value;
    const adjustmentAmount = parseFloat(document.getElementById('adjustmentAmount').value);

    if (!adjustmentType) {
        if (window.showToast) {
            window.showToast('يرجى اختيار نوع التعديل', 'error');
        }
        return;
    }

    if (!adjustmentAmount || adjustmentAmount <= 0) {
        if (window.showToast) {
            window.showToast('يرجى إدخال كمية صحيحة', 'error');
        } else {
        if (window.showToast) {
            window.showToast('يرجى إدخال كمية صحيحة', 'error');
        }
        }
        return;
    }

    if (!reason) {
        if (window.showToast) {
            window.showToast('يرجى إدخال سبب التعديل', 'error');
        } else {
        if (window.showToast) {
            window.showToast('يرجى إدخال سبب التعديل', 'error');
        }
        }
        return;
    }

    // Get product from database first to ensure we have latest stock
    let product = null;
    if (window.electronAPI && window.electronAPI.dbGet) {
        try {
            product = await window.electronAPI.dbGet('products', productId);
        } catch (error) {
            console.error('Error loading product from database:', error);
            // Fallback to local array
            product = products.find(p => p.id === productId);
        }
    } else {
        // Fallback to local array
        product = products.find(p => p.id === productId);
    }
    
    if (!product) {
        if (window.showToast) {
            window.showToast('المنتج غير موجود', 'error');
        } else {
        if (window.showToast) {
            window.showToast('المنتج غير موجود', 'error');
        }
        }
        return;
    }

    const oldStock = parseFloat(product.stock) || 0;
    let newStock = oldStock;
    let change = 0;

    if (adjustmentType === 'increase') {
        newStock = oldStock + adjustmentAmount;
        change = adjustmentAmount;
    } else if (adjustmentType === 'decrease') {
        newStock = Math.max(0, oldStock - adjustmentAmount);
        change = -adjustmentAmount;
    } else if (adjustmentType === 'set') {
        newStock = adjustmentAmount;
        change = newStock - oldStock;
    }

    // Prepare data for database (matching table schema)
    const adjustmentNumber = document.getElementById('inventoryId').value ? 
        inventoryOperations.find(op => op.id === document.getElementById('inventoryId').value)?.adjustmentNumber || 
        inventoryOperations.find(op => op.id === document.getElementById('inventoryId').value)?.operationNumber : 
        generateInventoryNumber();
    
    // Get current user ID
    const currentUserId = localStorage.getItem('asel_userId') || '';

    const inventoryDataForDB = {
        id: document.getElementById('inventoryId').value || Date.now().toString(),
        adjustmentNumber: adjustmentNumber,
        productId: productId,
        date: date,
        type: adjustmentType,
        quantity: adjustmentAmount,
        reason: reason,
        notes: notes,
        userId: currentUserId,
        createdAt: document.getElementById('inventoryId').value ? 
            inventoryOperations.find(op => op.id === document.getElementById('inventoryId').value)?.createdAt : 
            new Date().toISOString()
    };

    // Also keep full data for local use
    const inventoryData = {
        ...inventoryDataForDB,
        operationNumber: adjustmentNumber,
        productName: product.name,
        productCode: product.code,
        adjustmentType: adjustmentType,
        adjustmentAmount: adjustmentAmount,
        oldStock: oldStock,
        newStock: newStock,
        change: change,
        updatedAt: new Date().toISOString()
    };

    // Update product in database FIRST
    if (window.electronAPI && window.electronAPI.dbUpdate && window.electronAPI.dbInsert) {
        try {
            // If editing, revert old change first
            if (document.getElementById('isEdit').value === 'true') {
                const oldOperation = inventoryOperations.find(op => op.id === inventoryData.id);
                if (oldOperation && oldOperation.productId) {
                    // Get old product from database
                    const oldProduct = await window.electronAPI.dbGet('products', oldOperation.productId);
                    if (oldProduct) {
                        // Revert to old stock
                        oldProduct.stock = oldOperation.oldStock;
                        oldProduct.updatedAt = new Date().toISOString();
                        await window.electronAPI.dbUpdate('products', oldProduct.id, oldProduct);
                        
                        // Update local array
                        const localOldProduct = products.find(p => p.id === oldProduct.id);
                        if (localOldProduct) {
                            localOldProduct.stock = oldOperation.oldStock;
                        }
                    }
                }
            }
            
            // Get latest product data from database before updating
            // If editing and product changed, get the new product
            let dbProduct = null;
            if (document.getElementById('isEdit').value === 'true') {
                const oldOperation = inventoryOperations.find(op => op.id === inventoryData.id);
                // If product changed, get the new product, otherwise get the old product
                if (oldOperation && oldOperation.productId !== productId) {
                    // Product changed, get new product
                    dbProduct = await window.electronAPI.dbGet('products', productId);
                } else {
                    // Same product, get it again to ensure latest stock
                    dbProduct = await window.electronAPI.dbGet('products', productId);
                }
            } else {
                // New operation, get product normally
                dbProduct = await window.electronAPI.dbGet('products', productId);
            }
            
            if (!dbProduct) {
                throw new Error(`Product ${productId} not found in database`);
            }
            
            // Apply new stock change to database
            // Ensure stock is a number, not a string
            dbProduct.stock = parseFloat(newStock);
            dbProduct.lastInventoryDate = date;
            dbProduct.updatedAt = new Date().toISOString();
            
            // Verify stock value is set correctly
            if (typeof dbProduct.stock !== 'number' || isNaN(dbProduct.stock)) {
                console.error(`[Inventory] ERROR: stock is not a valid number! Value: ${dbProduct.stock}, Type: ${typeof dbProduct.stock}`);
                dbProduct.stock = parseFloat(newStock) || 0;
            }
            
            const updateResult = await window.electronAPI.dbUpdate('products', dbProduct.id, dbProduct);
            
            // Verify immediately after update - with multiple attempts (silently, only log errors)
            let verified = false;
            let verifyAttempts = 0;
            const maxVerifyAttempts = 5;
            
            while (!verified && verifyAttempts < maxVerifyAttempts) {
                verifyAttempts++;
                await new Promise(resolve => setTimeout(resolve, 100));
                
                const verifyProduct = await window.electronAPI.dbGet('products', dbProduct.id);
                
                if (verifyProduct && Math.abs(parseFloat(verifyProduct.stock || 0) - newStock) < 0.01) {
                    verified = true;
                } else if (verifyProduct && verifyAttempts === maxVerifyAttempts) {
                    const actualStock = parseFloat(verifyProduct.stock || 0);
                    console.error(`[Inventory] CRITICAL: Stock mismatch after update! Expected: ${newStock}, Got: ${actualStock}`);
                    
                    // Try updating again with the exact newStock value
                    const fixProduct = await window.electronAPI.dbGet('products', dbProduct.id);
                    if (fixProduct) {
                        fixProduct.stock = newStock;
                        await window.electronAPI.dbUpdate('products', fixProduct.id, fixProduct);
                    }
                }
            }
            
            // Update local product object
            const localProduct = products.find(p => p.id === productId);
            if (localProduct) {
                localProduct.stock = newStock;
                localProduct.lastInventoryDate = date;
            }
            
            // Save inventory operation to database (use inventoryDataForDB which matches table schema)
            if (document.getElementById('isEdit').value === 'true') {
                const updateResult = await window.electronAPI.dbUpdate('inventory_adjustments', inventoryDataForDB.id, inventoryDataForDB);
            } else {
                const insertResult = await window.electronAPI.dbInsert('inventory_adjustments', inventoryDataForDB);
                
                // Verify the insert worked by trying to get the record
                if (insertResult && insertResult.lastInsertRowid !== undefined) {
                }
            }
        } catch (error) {
            console.error('[Inventory] Error saving to database:', error);
            console.error('[Inventory] Error details:', error.message, error.stack);
            if (window.showToast) {
                window.showToast('خطأ في حفظ البيانات في قاعدة البيانات: ' + error.message, 'error');
            } else {
            if (window.showToast) {
                window.showToast('خطأ في حفظ البيانات في قاعدة البيانات: ' + error.message, 'error');
            }
            }
            return; // Stop execution if database update fails
        }
    } else {
        console.error('[Inventory] electronAPI or dbUpdate/dbInsert not available!');
        console.error('[Inventory] window.electronAPI:', window.electronAPI);
        console.error('[Inventory] dbUpdate available:', window.electronAPI && window.electronAPI.dbUpdate);
        console.error('[Inventory] dbInsert available:', window.electronAPI && window.electronAPI.dbInsert);
    }
    
    // Reload data from database to ensure consistency
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            // Reload products first to ensure we have latest data
            products = await window.electronAPI.dbGetAll('products', '', []) || [];
            
            // Reload raw inventory operations and convert to display format
            const rawInventoryOperations = await window.electronAPI.dbGetAll('inventory_adjustments', '', []) || [];
            
            // Convert database format to display format (same as loadData)
            inventoryOperations = rawInventoryOperations.map(op => {
                const product = products.find(p => p.id === op.productId);
                const oldStock = parseFloat(product?.stock || 0);
                let newStock = oldStock;
                let change = 0;
                
                // Calculate stock changes based on type
                if (op.type === 'increase') {
                    newStock = oldStock + parseFloat(op.quantity || 0);
                    change = parseFloat(op.quantity || 0);
                } else if (op.type === 'decrease') {
                    newStock = Math.max(0, oldStock - parseFloat(op.quantity || 0));
                    change = -parseFloat(op.quantity || 0);
                } else if (op.type === 'set') {
                    newStock = parseFloat(op.quantity || 0);
                    change = newStock - oldStock;
                }
                
                return {
                    id: op.id,
                    operationNumber: op.adjustmentNumber || op.operationNumber,
                    adjustmentNumber: op.adjustmentNumber,
                    productId: op.productId,
                    productName: product?.name || product?.productName || 'غير معروف',
                    productCode: product?.code || product?.productCode || '',
                    date: op.date,
                    adjustmentType: op.type,
                    type: op.type,
                    adjustmentAmount: parseFloat(op.quantity || 0),
                    quantity: parseFloat(op.quantity || 0),
                    oldStock: oldStock,
                    newStock: newStock,
                    change: change,
                    reason: op.reason,
                    notes: op.notes,
                    createdAt: op.createdAt,
                    updatedAt: op.updatedAt || op.createdAt
                };
            });
            
        } catch (error) {
            console.error('[Inventory] Error reloading data after save:', error);
            // Fallback to local array update
            if (document.getElementById('isEdit').value === 'true') {
                const index = inventoryOperations.findIndex(op => op.id === inventoryData.id);
                if (index !== -1) {
                    inventoryOperations[index] = inventoryData;
                }
            } else {
                inventoryOperations.push(inventoryData);
            }
            
            const localProduct = products.find(p => p.id === productId);
            if (localProduct) {
                localProduct.stock = newStock;
                localProduct.lastInventoryDate = date;
            }
        }
    } else {
        // Update local arrays as fallback
        if (document.getElementById('isEdit').value === 'true') {
            const index = inventoryOperations.findIndex(op => op.id === inventoryData.id);
            if (index !== -1) {
                inventoryOperations[index] = inventoryData;
            }
        } else {
            inventoryOperations.push(inventoryData);
        }
        
        const localProduct = products.find(p => p.id === productId);
        if (localProduct) {
            localProduct.stock = newStock;
            localProduct.lastInventoryDate = date;
        }
        
        // Save to localStorage as backup
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
        saveInventoryOperations();
    }
    
    currentPage = 1;
    await applyFilters();
    closeModal();
    // Show success message with toast (replaces alert to avoid Electron focus issues)
    if (window.showToast) {
        window.showToast('تم حفظ عملية الجرد بنجاح', 'success');
    } else {
    if (window.showToast) {
        window.showToast('تم حفظ عملية الجرد بنجاح', 'success');
    }
    }
    
    // Wait for database updates to be fully committed before dispatching events
    // Use multiple attempts to verify the update
    let verified = false;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (!verified && attempts < maxAttempts) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Verify the product was actually updated in the database
        if (window.electronAPI && window.electronAPI.dbGet) {
            try {
                const updatedProduct = await window.electronAPI.dbGet('products', productId);
                if (updatedProduct && Math.abs(parseFloat(updatedProduct.stock || 0) - newStock) < 0.01) {
                    verified = true;
                } else {
                }
            } catch (error) {
                console.error(`[Inventory] Error verifying product update (attempt ${attempts}):`, error);
            }
        }
    }
    
    if (!verified) {
        console.warn('[Inventory] Could not verify product stock update after', maxAttempts, 'attempts');
    }
    
    // Dispatch event to notify other screens about stock change
    // Use BroadcastChannel if available for cross-window communication
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const channel = new BroadcastChannel('product-stock-updates');
            channel.postMessage({
                type: 'productStockUpdated',
                productId: productId,
                newStock: newStock,
                timestamp: Date.now()
            });
            channel.close();
        } catch (error) {
            console.error('[Inventory] Error using BroadcastChannel:', error);
        }
    }
    
    // Dispatch event to notify other screens about stock change
    window.dispatchEvent(new CustomEvent('productStockUpdated', { 
        detail: { productId: productId, newStock: newStock },
        bubbles: true,
        cancelable: true
    }));
    
    // Also dispatch a global refresh event
    window.dispatchEvent(new CustomEvent('productsNeedRefresh', { 
        detail: { source: 'inventory' },
        bubbles: true 
    }));
    
    // Also try using localStorage as a fallback mechanism
    try {
        const updateMarker = {
            productId: productId,
            newStock: newStock,
            timestamp: Date.now()
        };
        localStorage.setItem('last_product_stock_update', JSON.stringify(updateMarker));
    } catch (error) {
        console.error('[Inventory] Error setting localStorage update marker:', error);
        console.error('[Inventory] Error stack:', error.stack);
    }
}

// Handle Return Submit
async function handleReturnSubmit(productId, date, reason, notes, returnType = null, entityId = null, invoiceId = null, quantity = null, unitPrice = null) {
    // If parameters are not provided, get from form (for backward compatibility)
    if (!returnType) returnType = document.getElementById('returnType')?.value;
    if (!entityId) entityId = document.getElementById('returnEntitySelect')?.value || document.getElementById('entitySelect')?.value;
    if (!invoiceId) invoiceId = document.getElementById('returnInvoiceSelect')?.value || document.getElementById('invoiceSelect')?.value || null;
    if (!quantity) quantity = parseFloat(document.getElementById('returnQuantity')?.value || 0);
    if (!unitPrice) unitPrice = parseFloat(document.getElementById('returnUnitPrice')?.value || document.getElementById('unitPrice')?.value || 0);
    const returnReason = reason || document.getElementById('returnReason')?.value;

    // Validation

    if (!returnType) {
        const error = new Error('يرجى اختيار نوع المرتجع');
        console.error('[Return] Validation error:', error);
        if (window.showToast) {
            window.showToast(error.message, 'error');
        }
        throw error;
    }

    if (!entityId) {
        const error = new Error('يرجى اختيار ' + (returnType === 'from_customer' ? 'العميل' : 'المورد'));
        console.error('[Return] Validation error:', error);
        if (window.showToast) {
            window.showToast(error.message, 'error');
        }
        throw error;
    }

    if (!productId) {
        const error = new Error('يرجى اختيار المنتج');
        console.error('[Return] Validation error:', error);
        if (window.showToast) {
            window.showToast(error.message, 'error');
        }
        throw error;
    }

    if (!quantity || quantity <= 0) {
        const error = new Error('يرجى إدخال كمية صحيحة');
        console.error('[Return] Validation error:', error);
        if (window.showToast) {
            window.showToast(error.message, 'error');
        }
        throw error;
    }

    if (!unitPrice || unitPrice <= 0) {
        const error = new Error('يرجى إدخال سعر الوحدة');
        console.error('[Return] Validation error:', error);
        if (window.showToast) {
            window.showToast(error.message, 'error');
        }
        throw error;
    }

    if (!returnReason) {
        const error = new Error('يرجى اختيار سبب المرتجع');
        console.error('[Return] Validation error:', error);
        if (window.showToast) {
            window.showToast(error.message, 'error');
        }
        throw error;
    }

    if (!date) {
        const error = new Error('يرجى اختيار التاريخ');
        console.error('[Return] Validation error:', error);
        if (window.showToast) {
            window.showToast(error.message, 'error');
        }
        throw error;
    }


    // Get invoice data (optional - only if invoiceId is provided)
    let invoice = null;
    let invoiceType = returnType === 'from_customer' ? 'sales' : 'purchase';
    let invoiceNumber = '';

    if (invoiceId && window.electronAPI && window.electronAPI.dbGet) {
        try {
            const tableName = returnType === 'from_customer' ? 'sales_invoices' : 'purchase_invoices';
            invoice = await window.electronAPI.dbGet(tableName, invoiceId);
            if (invoice) {
                invoiceNumber = invoice.invoiceNumber || invoice.id;
            }
        } catch (error) {
            console.error('Error loading invoice:', error);
            // Continue without invoice if it doesn't exist
        }
    }

    // Calculate total amount and check if should restore to stock
    const totalAmount = quantity * unitPrice;
    
    // Don't restore to stock if damaged or expired
    const isDamaged = returnReason === 'damaged' ? 'true' : 'false';
    const isExpired = returnReason === 'expired' ? 'true' : 'false';
    const restoredToStock = (returnReason === 'damaged' || returnReason === 'expired') ? 'false' : 'true';

    // Get product
    let product = null;
    if (window.electronAPI && window.electronAPI.dbGet) {
        try {
            product = await window.electronAPI.dbGet('products', productId);
        } catch (error) {
            console.error('Error loading product:', error);
            product = products.find(p => p.id === productId);
        }
    } else {
        product = products.find(p => p.id === productId);
    }

    if (!product) {
        if (window.showToast) {
            window.showToast('المنتج غير موجود', 'error');
        } else {
        if (window.showToast) {
            window.showToast('المنتج غير موجود', 'error');
        }
        }
        return;
    }

    const oldStock = parseFloat(product.stock) || 0;
    let newStock = oldStock;

    // Update stock based on return type and if not damaged
    // For returns from customer: add to stock (we get the product back)
    // For returns to supplier: subtract from stock (we return the product to supplier)
    if (restoredToStock === 'true') {
        if (returnType === 'from_customer') {
            newStock = oldStock + quantity; // Add to stock (we get it back from customer)
            console.log('[Return] Customer return: adding', quantity, 'to stock. Old:', oldStock, 'New:', newStock);
        } else if (returnType === 'to_supplier') {
            newStock = Math.max(0, oldStock - quantity); // Subtract from stock (we return it to supplier)
            console.log('[Return] Supplier return: subtracting', quantity, 'from stock. Old:', oldStock, 'New:', newStock);
        }
    }

    // Get entity (customer or supplier) - MUST exist in database for foreign key constraint
    let entity = null;
    let entityType = returnType === 'from_customer' ? 'customer' : 'supplier';
    const tableName = returnType === 'from_customer' ? 'customers' : 'suppliers';
    
    if (window.electronAPI && window.electronAPI.dbGet) {
        try {
            entity = await window.electronAPI.dbGet(tableName, entityId);
            if (!entity) {
                // Try to find in local array
                if (returnType === 'from_customer') {
                    entity = customers.find(c => c.id === entityId);
                } else {
                    entity = suppliers.find(s => s.id === entityId);
                }
            }
        } catch (error) {
            console.error('[Return] Error loading entity from database:', error);
            if (returnType === 'from_customer') {
                entity = customers.find(c => c.id === entityId);
            } else {
                entity = suppliers.find(s => s.id === entityId);
            }
        }
    } else {
        if (returnType === 'from_customer') {
            entity = customers.find(c => c.id === entityId);
        } else {
            entity = suppliers.find(s => s.id === entityId);
        }
    }

    if (!entity) {
        const error = new Error((returnType === 'from_customer' ? 'العميل' : 'المورد') + ' غير موجود - يرجى التأكد من أنه موجود في قاعدة البيانات');
        console.error('[Return] Error: Entity not found. EntityId:', entityId, 'Type:', returnType);
        if (returnType === 'from_customer') {
            console.error('[Return] Available customers:', customers.map(c => ({ id: c.id, name: c.name || c.customerName })));
        } else {
            console.error('[Return] Available suppliers:', suppliers.map(s => ({ id: s.id, name: s.name || s.supplierName })));
        }
        if (window.showToast) {
            window.showToast(error.message, 'error');
        }
        throw error;
    }
    
    // Verify entity exists in database (critical for foreign key)
    // Also reload entity from database to ensure we have the latest balance
    if (window.electronAPI && window.electronAPI.dbGet) {
        try {
            const dbEntity = await window.electronAPI.dbGet(tableName, entityId);
            if (!dbEntity) {
                const error = new Error((returnType === 'from_customer' ? 'العميل' : 'المورد') + ' غير موجود في قاعدة البيانات - يرجى إضافته أولاً');
                console.error('[Return] Error: Entity not in database. EntityId:', entityId, 'Table:', tableName);
                if (window.showToast) {
                    window.showToast(error.message, 'error');
                }
                throw error;
            }
            // Use the entity from database to ensure we have the latest balance
            entity = dbEntity;
            console.log('[Return] Entity loaded from database:', entity);
            console.log('[Return] Entity balance from database:', entity.balance);
        } catch (error) {
            if (error.message.includes('غير موجود')) {
                throw error;
            }
            console.error('[Return] Error verifying entity in database:', error);
            // Continue with local entity if database load fails
        }
    }

    // Get restoreBalance option (for both customer and supplier returns)
    const restoreBalanceCheckbox = document.getElementById('restoreBalance');
    const restoreBalance = restoreBalanceCheckbox && restoreBalanceCheckbox.checked;
    
    console.log('[Return] restoreBalance checkbox:', restoreBalanceCheckbox);
    console.log('[Return] restoreBalance checked:', restoreBalance);
    console.log('[Return] returnType:', returnType);
    console.log('[Return] totalAmount:', totalAmount);
    
    // الرصيد القديم = الرصيد الحالي من قاعدة البيانات مباشرة (تم إعادة تحميله أعلاه)
    const oldBalance = parseFloat(entity.balance || 0);
    let newBalance = oldBalance;
    
    console.log('[Return] Old balance from database:', oldBalance);
    
    // حساب الرصيد الجديد بناءً على restoreBalance
    // Update entity balance only if restoreBalance is true
    // For returns from customer: subtract from customer balance (debit - we take money back) only if restoreBalance is true
    // For returns to supplier: subtract from supplier balance (debit - we return money) - always restore for suppliers
    if (returnType === 'from_customer') {
        // Only update balance if restoreBalance is checked
        if (restoreBalance) {
            newBalance = oldBalance - totalAmount; // Debit customer (subtract from balance - we take money back)
            console.log('[Return] Updating customer balance. New balance:', newBalance);
        } else {
            newBalance = oldBalance; // Keep balance unchanged
            console.log('[Return] restoreBalance not checked, keeping balance unchanged');
        }
    } else if (returnType === 'to_supplier') {
        // Only update balance if restoreBalance is checked
        if (restoreBalance) {
            newBalance = oldBalance - totalAmount; // Debit supplier (subtract from balance - we return money)
            console.log('[Return] Updating supplier balance. New balance:', newBalance);
        } else {
            newBalance = oldBalance; // Keep balance unchanged
            console.log('[Return] restoreBalance not checked, keeping balance unchanged');
        }
    }
    
    // الرصيد يُحفظ بالجنيه المصري مباشرة في قاعدة البيانات
    const oldBalanceToSave = oldBalance;
    const newBalanceToSave = newBalance;
    
    console.log('[Return] Balance calculations to save in return:', {
        oldBalance,
        oldBalanceToSave,
        totalAmount,
        newBalance,
        newBalanceToSave,
        restoreBalance
    });

    // Always update entity balance if restoreBalance is checked (for both customers and suppliers)
    const shouldUpdateBalance = restoreBalance;
    
    console.log('[Return] shouldUpdateBalance:', shouldUpdateBalance);
    console.log('[Return] newBalance !== oldBalance:', newBalance !== oldBalance);
    
    if (shouldUpdateBalance && window.electronAPI && window.electronAPI.dbUpdate) {
        try {
            const tableName = returnType === 'from_customer' ? 'customers' : 'suppliers';
            console.log('[Return] Updating balance in table:', tableName, 'for entity:', entity.id);
            console.log('[Return] Entity before update:', JSON.stringify(entity, null, 2));
            console.log('[Return] Old balance:', oldBalance, 'New balance:', newBalance, 'Difference:', (newBalance - oldBalance));
            
            // Create a new object with updated balance to ensure all fields are preserved
            // Note: Don't include currentBalance if it doesn't exist in the table
            const updatedEntity = {
                ...entity,
                balance: newBalance,
                updatedAt: new Date().toISOString()
            };
            
            // Only add currentBalance if it exists in the entity (some tables might have it)
            if (entity.hasOwnProperty('currentBalance')) {
                updatedEntity.currentBalance = newBalance;
            }
            
            console.log('[Return] Entity after update:', JSON.stringify(updatedEntity, null, 2));
            
            const updateResult = await window.electronAPI.dbUpdate(tableName, entity.id, updatedEntity);
            console.log('[Return] Balance update result:', updateResult);
            
            // Verify the update by reloading the entity
            const verifyEntity = await window.electronAPI.dbGet(tableName, entity.id);
            console.log('[Return] Entity after update (verified):', JSON.stringify(verifyEntity, null, 2));
            console.log('[Return] Verified balance:', verifyEntity?.balance);
            
            if (window.showToast) {
                window.showToast(`تم تحديث رصيد ${returnType === 'from_customer' ? 'العميل' : 'المورد'} من ${oldBalance.toFixed(2)} إلى ${newBalance.toFixed(2)}`, 'success');
            }
            
            // Dispatch event to notify other screens about balance change
            if (returnType === 'from_customer') {
                window.dispatchEvent(new CustomEvent('customerBalanceUpdated', {
                    detail: { 
                        customerId: entity.id,
                        oldBalance: oldBalance,
                        newBalance: newBalance,
                        change: newBalance - oldBalance
                    },
                    bubbles: true,
                    cancelable: true
                }));
            } else {
                window.dispatchEvent(new CustomEvent('supplierBalanceUpdated', {
                    detail: { 
                        supplierId: entity.id,
                        oldBalance: oldBalance,
                        newBalance: newBalance,
                        change: newBalance - oldBalance
                    },
                    bubbles: true,
                    cancelable: true
                }));
            }
        } catch (error) {
            console.error('[Return] Error updating entity balance:', error);
            console.error('[Return] Error stack:', error.stack);
            const errorMsg = 'خطأ في تحديث رصيد ' + (returnType === 'from_customer' ? 'العميل' : 'المورد') + ': ' + error.message;
            if (window.showToast) {
                window.showToast(errorMsg, 'error');
            }
            throw new Error(errorMsg);
        }
    } else if (!shouldUpdateBalance) {
        console.log('[Return] Balance update skipped - restoreBalance not checked for customer return');
        if (restoreBalance && returnType === 'from_customer') {
            console.warn('[Return] WARNING: restoreBalance is checked but shouldUpdateBalance is false!');
        }
    } else if (!window.electronAPI || !window.electronAPI.dbUpdate) {
        const errorMsg = 'لا يمكن الوصول إلى قاعدة البيانات - electronAPI أو dbUpdate غير متاح';
        console.error('[Return]', errorMsg);
        if (window.showToast) {
            window.showToast(errorMsg, 'error');
        }
        throw new Error(errorMsg);
    }

    // Update product stock
    if (restoredToStock === 'true' && window.electronAPI && window.electronAPI.dbUpdate) {
        try {
            product.stock = newStock;
            product.updatedAt = new Date().toISOString();
            await window.electronAPI.dbUpdate('products', product.id, product);
        } catch (error) {
            console.error('[Return] Error updating product stock:', error);
            if (window.showToast) {
                window.showToast('خطأ في تحديث المخزون: ' + error.message, 'error');
            } else {
            if (window.showToast) {
                window.showToast('خطأ في تحديث المخزون: ' + error.message, 'error');
            }
            }
            // Don't return here, continue with saving the return
        }
    } else {
    }

    // Ensure restoreBalance column exists in database
    if (window.electronAPI && window.electronAPI.dbQuery) {
        try {
            await window.electronAPI.dbQuery('ALTER TABLE returns ADD COLUMN restoreBalance TEXT DEFAULT \'false\'', []);
        } catch (alterError) {
            // Column might already exist, ignore
            if (alterError.message && !alterError.message.includes('duplicate column') && !alterError.message.includes('already exists')) {
                console.warn('[Return] Could not add restoreBalance column (may already exist):', alterError.message);
            }
        }
    }

    // Generate return number
    const returnNumber = generateReturnNumber();

    // Get current user ID
    const currentUserId = localStorage.getItem('asel_userId') || '';
    
    // Get restoreBalance option (only for customer returns) - reuse the variable already declared above
    // restoreBalanceCheckbox is already declared earlier in the function, so we just use it here
    const restoreBalanceValue = returnType === 'from_customer' && restoreBalanceCheckbox && restoreBalanceCheckbox.checked;

    // Create return record
    // Note: invoiceId, invoiceType, invoiceNumber are optional (can be null)
    const returnData = {
        id: Date.now().toString(),
        returnNumber: returnNumber,
        productId: productId,
        date: date,
        operationType: 'return',
        returnType: returnType,
        entityId: entityId || null,
        entityType: entityType || null,
        invoiceId: invoiceId || null,
        invoiceType: invoiceId ? invoiceType : null,
        invoiceNumber: invoiceId ? invoiceNumber : null,
        quantity: quantity,
        unitPrice: unitPrice,
        totalAmount: totalAmount,
        returnReason: returnReason,
        isDamaged: isDamaged,
        restoredToStock: restoredToStock,
        restoreBalance: restoreBalanceValue ? 'true' : 'false',
        notes: notes || '',
        userId: currentUserId || null,
        // الرصيد القديم يُحفظ في عمود oldBalance في جدول returns
        // الرصيد القديم = الرصيد الحالي من قاعدة البيانات (قبل خصم هذا المرتجع)
        // ⚠️ مهم: هذه القيم تظل ثابتة ولا تتغير حتى بعد إنشاء فواتير جديدة أو سندات
        // لأنها تمثل "لقطة تاريخية" (snapshot) من الرصيد في وقت إنشاء المرتجع
        oldBalance: oldBalanceToSave,
        // الرصيد الجديد يُحفظ في عمود newBalance
        // الرصيد الجديد = الرصيد القديم - المبلغ (إذا كان restoreBalance = true)
        // ⚠️ هذه القيمة تظل ثابتة ولا تتغير
        newBalance: newBalanceToSave,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    // Save return to database
    
    if (window.electronAPI && window.electronAPI.dbInsert) {
        try {
            
            const insertResult = await window.electronAPI.dbInsert('returns', returnData);
            
            
            // Check if insert was successful
            if (insertResult && insertResult.success === false) {
                const errorMsg = insertResult.error || 'خطأ غير معروف في حفظ البيانات';
                console.error('[Return] Database insert failed:', errorMsg);
                if (window.showToast) {
                    window.showToast('خطأ في حفظ المرتجع: ' + errorMsg, 'error');
                } else {
                if (window.showToast) {
                    window.showToast('خطأ في حفظ المرتجع: ' + errorMsg, 'error');
                }
                }
                throw new Error(errorMsg);
            }
            
            // Check for lastInsertRowid or changes (SQLite result format)
            if (insertResult && (insertResult.lastInsertRowid !== undefined || insertResult.changes !== undefined)) {
            } else if (insertResult && insertResult.changes === 0) {
                console.warn('[Return] ⚠️ Insert returned 0 changes - may not have inserted');
                if (window.showToast) {
                    window.showToast('قد لا يكون تم حفظ المرتجع - يرجى التحقق من قاعدة البيانات', 'error');
                } else {
                if (window.showToast) {
                    window.showToast('قد لا يكون تم حفظ المرتجع - يرجى التحقق من قاعدة البيانات', 'error');
                }
                }
            } else {
                console.warn('[Return] ⚠️ Insert result format unexpected:', insertResult);
                // Still consider it success if we got a result object
            }
            
            
            // Return success indicator
            return { success: true, insertResult };
        } catch (error) {
            console.error('[Return] ===== ERROR SAVING TO DATABASE =====');
            console.error('[Return] Error name:', error.name);
            console.error('[Return] Error message:', error.message);
            console.error('[Return] Error stack:', error.stack);
            console.error('[Return] Full error object:', error);
            const errorMsg = 'خطأ في حفظ المرتجع في قاعدة البيانات: ' + (error.message || 'خطأ غير معروف');
            if (window.showToast) {
                window.showToast(errorMsg, 'error');
            }
            throw error; // Throw error instead of returning
        }
    } else {
        const errorMsg = 'لا يمكن الوصول إلى قاعدة البيانات - electronAPI أو dbInsert غير متاح';
        console.error('[Return]', errorMsg);
        console.error('[Return] window.electronAPI:', window.electronAPI);
        console.error('[Return] dbInsert available:', window.electronAPI && window.electronAPI.dbInsert);
        if (window.showToast) {
            window.showToast(errorMsg, 'error');
        }
        throw new Error(errorMsg); // Throw error instead of returning
    }

    // Success message - don't show alert here as it's handled in handleReturnFormSubmit
    
    // Reload data from database to ensure consistency
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            // Reload all data to ensure consistency
            products = await window.electronAPI.dbGetAll('products', '', []) || [];
            returns = await window.electronAPI.dbGetAll('returns', '', []) || [];
            if (returnType === 'from_customer') {
                customers = await window.electronAPI.dbGetAll('customers', '', []) || [];
            } else {
                suppliers = await window.electronAPI.dbGetAll('suppliers', '', []) || [];
            }
        } catch (error) {
            console.error('[Inventory] Error reloading data after save:', error);
            // On error, still update local arrays to show the data
            returns.push(returnData);
            const localProduct = products.find(p => p.id === productId);
            if (localProduct && restoredToStock === 'true') {
                localProduct.stock = newStock;
            }
        }
    } else {
        // Update local arrays as fallback
        returns.push(returnData);
        if (returnType === 'from_customer') {
            const localCustomer = customers.find(c => c.id === entityId);
            if (localCustomer) {
                localCustomer.balance = newBalance;
                localCustomer.currentBalance = newBalance;
            }
        } else {
            const localSupplier = suppliers.find(s => s.id === entityId);
            if (localSupplier) {
                localSupplier.balance = newBalance;
                localSupplier.currentBalance = newBalance;
            }
        }

        const localProduct = products.find(p => p.id === productId);
        if (localProduct && restoredToStock === 'true') {
            localProduct.stock = newStock;
        }
    }

    // Note: Don't refresh display here - it's handled in handleReturnFormSubmit
    // The calling function will handle closing modal and refreshing
    // Also, don't call applyReturnFilters() here as it tries to access DOM elements
    // that might not be available yet
}

// Generate Return Number
function generateReturnNumber() {
    let counter = parseInt(localStorage.getItem('asel_return_counter') || '0');
    counter++;
    localStorage.setItem('asel_return_counter', counter.toString());
    
    const year = new Date().getFullYear();
    return `RET-${year}-${String(counter).padStart(3, '0')}`;
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

// Delete Inventory Operation
async function deleteInventoryOperation(operationId) {
    // Use custom confirmation dialog instead of confirm()
    showConfirmDialog(
        'هل أنت متأكد من حذف هذه العملية؟ سيتم استعادة المخزون القديم.',
        () => {
            // User confirmed - proceed with deletion
            proceedWithInventoryOperationDeletion(operationId);
        },
        () => {
            // User cancelled - do nothing
        }
    );
}

// Proceed with inventory operation deletion
async function proceedWithInventoryOperationDeletion(operationId) {

    const operation = inventoryOperations.find(op => op.id === operationId);
    if (operation) {
        // Revert stock change in database
        if (window.electronAPI && window.electronAPI.dbGet && window.electronAPI.dbUpdate) {
            try {
                const product = await window.electronAPI.dbGet('products', operation.productId);
                if (product) {
                    product.stock = operation.oldStock;
                    await window.electronAPI.dbUpdate('products', product.id, product);
                }
                
                // Delete from database
                await window.electronAPI.dbDelete('inventory_adjustments', operationId);
                
                
                // Wait for database updates to be fully committed before dispatching events
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // Verify the product was actually updated in the database before dispatching
                if (window.electronAPI && window.electronAPI.dbGet) {
                    try {
                        const updatedProduct = await window.electronAPI.dbGet('products', operation.productId);
                    } catch (error) {
                        console.error('[Inventory] Error verifying product revert:', error);
                    }
                }
                
                // Dispatch event to notify products screen
                window.dispatchEvent(new CustomEvent('productStockUpdated', { 
                    detail: { productId: operation.productId, newStock: operation.oldStock },
                    bubbles: true,
                    cancelable: true
                }));
                
                // Also dispatch a global refresh event
                window.dispatchEvent(new CustomEvent('productsNeedRefresh', { 
                    detail: { source: 'inventory' },
                    bubbles: true 
                }));
            } catch (error) {
                console.error('[Inventory] Error reverting stock in database:', error);
                if (window.showToast) {
                    window.showToast('خطأ في استعادة المخزون: ' + error.message, 'error');
                }
                return;
            }
        }
        
        // Revert stock change locally
        const product = products.find(p => p.id === operation.productId);
        if (product) {
            product.stock = operation.oldStock;
            localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
        }
    }

    inventoryOperations = inventoryOperations.filter(op => op.id !== operationId);
    saveInventoryOperations();
    renderInventoryOperations();
    if (window.showToast) {
        window.showToast('تم حذف العملية واستعادة المخزون القديم', 'success');
    }
}

// View Inventory Operation
function viewInventoryOperation(operationId) {
    const operation = inventoryOperations.find(op => op.id === operationId);
    if (!operation) return;

    const typeText = {
        'increase': 'زيادة',
        'decrease': 'نقصان',
        'set': 'تحديد قيمة معينة'
    };

    if (window.showToast) {
        const message = `عملية جرد رقم: ${operation.operationNumber} - التاريخ: ${new Date(operation.date).toLocaleDateString('ar-EG')} - المنتج: ${operation.productName} (${operation.productCode}) - المخزون قبل: ${operation.oldStock.toFixed(2)} - نوع التعديل: ${typeText[operation.adjustmentType]} - الكمية: ${operation.adjustmentAmount.toFixed(2)} - المخزون بعد: ${operation.newStock.toFixed(2)} - السبب: ${operation.reason}${operation.notes ? ` - ملاحظات: ${operation.notes}` : ''}`;
        window.showToast(message, 'info');
    }
}

// Render Inventory Operations
// Apply Filters
async function applyFilters() {
    // Get filters
    const searchTerm = document.getElementById('searchInput')?.value?.toLowerCase() || '';
    const categoryFilter = document.getElementById('categoryFilter')?.value || '';
    const statusFilter = document.getElementById('statusFilter')?.value || '';
    
    // Get date filters (if they exist in the UI)
    const dateFromInput = document.getElementById('dateFrom');
    const dateToInput = document.getElementById('dateTo');
    let dateFrom = dateFromInput?.value || '';
    let dateTo = dateToInput?.value || '';
    
    // If no date filters are set and no search query, default to current month
    let effectiveDateFrom = dateFrom;
    let effectiveDateTo = dateTo;
    
    if (!dateFrom && !dateTo && !searchTerm) {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        effectiveDateFrom = firstDayOfMonth.toISOString().split('T')[0];
        effectiveDateTo = lastDayOfMonth.toISOString().split('T')[0];
        
        // Update date inputs to show current month (if they exist)
        if (dateFromInput && !dateFromInput.value) {
            dateFromInput.value = effectiveDateFrom;
        }
        if (dateToInput && !dateToInput.value) {
            dateToInput.value = effectiveDateTo;
        }
    }

    // Combine inventory operations and returns
    let allOperations = [];
    
    // Add inventory adjustments
    inventoryOperations.forEach(op => {
        allOperations.push({
            ...op,
            operationType: 'adjustment',
            type: 'adjustment'
        });
    });
    
    // Add returns
    returns.forEach(ret => {
        const product = products.find(p => p.id === ret.productId);
        if (product) {
            allOperations.push({
                id: ret.id,
                operationNumber: ret.returnNumber,
                productId: ret.productId,
                productName: product.name || product.productName,
                productCode: product.code || product.productCode,
                date: ret.date,
                operationType: 'return',
                type: 'return',
                returnType: ret.returnType,
                entityId: ret.entityId,
                entityType: ret.entityType,
                quantity: ret.quantity,
                unitPrice: ret.unitPrice,
                totalAmount: ret.totalAmount,
                returnReason: ret.returnReason,
                isDamaged: ret.isDamaged,
                restoredToStock: ret.restoredToStock,
                oldStock: parseFloat(product.stock || 0) - (ret.restoredToStock === 'true' ? ret.quantity : 0),
                newStock: parseFloat(product.stock || 0),
                change: ret.restoredToStock === 'true' ? ret.quantity : 0,
                reason: ret.returnReason,
                notes: ret.notes,
                createdAt: ret.createdAt,
                updatedAt: ret.updatedAt
            });
        }
    });

    // Filter operations by products and date
    let operations = allOperations.filter(operation => {
        const product = products.find(p => p.id === operation.productId);
        if (!product) return false;

        const matchSearch = !searchTerm || 
            operation.productName.toLowerCase().includes(searchTerm) ||
            operation.productCode.toLowerCase().includes(searchTerm) ||
            operation.operationNumber.toLowerCase().includes(searchTerm);
        
        const matchCategory = !categoryFilter || product.category === categoryFilter;
        const matchStatus = !statusFilter || product.status === statusFilter;
        
        // Apply date filter
        let matchDate = true;
        if (effectiveDateFrom) {
            const operationDate = new Date(operation.date || 0);
            const fromDate = new Date(effectiveDateFrom);
            if (operationDate < fromDate) {
                matchDate = false;
            }
        }
        if (effectiveDateTo && matchDate) {
            const operationDate = new Date(operation.date || 0);
            const toDate = new Date(effectiveDateTo);
            toDate.setHours(23, 59, 59, 999); // Include entire day
            if (operationDate > toDate) {
                matchDate = false;
            }
        }

        return matchSearch && matchCategory && matchStatus && matchDate;
    });

    // Apply sorting
    filteredOperations = [...operations].sort((a, b) => {
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
    
    // Render paginated operations
    await renderInventoryOperations();
}

async function renderInventoryOperations() {
    const tbody = document.getElementById('inventoryTableBody');
    const emptyState = document.getElementById('emptyState');
    const paginationContainer = document.getElementById('paginationContainer');
    
    tbody.innerHTML = '';
    
    if (filteredOperations.length === 0) {
        emptyState.classList.remove('hidden');
        paginationContainer.classList.add('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    paginationContainer.classList.remove('hidden');

    // Calculate pagination
    const totalPages = Math.ceil(filteredOperations.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredOperations.length);
    const paginatedOperations = filteredOperations.slice(startIndex, endIndex);
    
    // Update pagination info
    document.getElementById('paginationInfo').textContent = 
        `عرض ${startIndex + 1} - ${endIndex} من ${filteredOperations.length}`;
    
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
    
    // Get current logged-in user type
    const currentUserType = localStorage.getItem('asel_userType') || '';
    const canDeleteOperations = currentUserType === 'manager' || currentUserType === 'system_engineer';
    
    for (const operation of paginatedOperations) {
        const typeText = {
            'increase': 'زيادة',
            'decrease': 'نقصان',
            'set': 'تحديد'
        };
        
        const row = document.createElement('tr');
        
        // Operation number cell
        const opNumberCell = document.createElement('td');
        opNumberCell.textContent = operation.operationNumber;
        row.appendChild(opNumberCell);
        
        // Date cell
        const dateCell = document.createElement('td');
        dateCell.textContent = new Date(operation.date).toLocaleDateString('ar-EG');
        row.appendChild(dateCell);
        
        // Operation type cell
        const operationTypeCell = document.createElement('td');
        if (operation.operationType === 'return') {
            const returnTypeText = operation.returnType === 'from_customer' ? 'مرتجع من عميل' : 'مرتجع إلى مورد';
            operationTypeCell.innerHTML = `<span class="badge badge-return">${returnTypeText}</span>`;
        } else {
            operationTypeCell.innerHTML = `<span class="badge badge-adjustment">جرد</span>`;
        }
        row.appendChild(operationTypeCell);
        
        // Product name cell with strong tag
        const productNameCell = document.createElement('td');
        productNameCell.className = 'product-name-cell';
        productNameCell.innerHTML = `<strong>${operation.productName} (${operation.productCode})</strong>`;
        row.appendChild(productNameCell);
        
        // Old stock cell with strong tag
        const oldStockCell = document.createElement('td');
        oldStockCell.className = 'old-stock-cell';
        oldStockCell.innerHTML = `<strong>${operation.oldStock.toFixed(2)}</strong>`;
        row.appendChild(oldStockCell);
        
        // Adjustment cell
        const adjustmentCell = document.createElement('td');
        if (operation.operationType === 'return') {
            adjustmentCell.innerHTML = `
                <span class="adjustment-badge increase">
                    ${operation.change >= 0 ? '+' : ''}${operation.change.toFixed(2)}
                </span>
                <small style="display: block; margin-top: 5px; color: #999;">
                    ${operation.restoredToStock === 'true' ? 'إعادة للمخزون' : 'تالف - لا يعاد للمخزون'}
                </small>
            `;
        } else {
            adjustmentCell.innerHTML = `
                <span class="adjustment-badge ${operation.adjustmentType || 'increase'}">
                    ${operation.change >= 0 ? '+' : ''}${operation.change.toFixed(2)}
                </span>
                <small style="display: block; margin-top: 5px; color: #999;">
                    ${typeText[operation.adjustmentType] || 'تعديل'}
                </small>
            `;
        }
        row.appendChild(adjustmentCell);
        
        // New stock cell with strong tag
        const newStockCell = document.createElement('td');
        newStockCell.className = 'new-stock-cell';
        newStockCell.innerHTML = `<strong>${operation.newStock.toFixed(2)}</strong>`;
        row.appendChild(newStockCell);
        
        // Reason cell with strong tag
        const reasonCell = document.createElement('td');
        reasonCell.className = 'reason-cell';
        reasonCell.innerHTML = `<strong>${operation.reason}</strong>`;
        row.appendChild(reasonCell);
        
        // Actions cell
        const actionsCell = document.createElement('td');
        actionsCell.innerHTML = `
            <div class="actions-buttons">
                <button class="action-btn view" data-operation-id="${operation.id}" title="عرض">👁️</button>
            </div>
        `;
        
        // Add event listeners to buttons
        const viewBtn = actionsCell.querySelector('.action-btn.view');
        const actionsDiv = actionsCell.querySelector('.actions-buttons');
        
        if (viewBtn) {
            viewBtn.addEventListener('click', () => viewInventoryOperation(operation.id));
        }
        
        // Cancel button removed - operations cannot be cancelled
        
        row.appendChild(actionsCell);
        
        tbody.appendChild(row);
    }
}

// Close Modal
// Apply Adjustment Filters
async function applyAdjustmentFilters() {
    const searchTerm = document.getElementById('adjustmentSearchInput')?.value.toLowerCase() || '';
    const categoryFilter = document.getElementById('adjustmentCategoryFilter')?.value || '';
    const statusFilter = document.getElementById('adjustmentStatusFilter')?.value || '';
    
    // Get date filters (if they exist in the UI)
    const dateFromInput = document.getElementById('adjustmentDateFrom') || document.getElementById('dateFrom');
    const dateToInput = document.getElementById('adjustmentDateTo') || document.getElementById('dateTo');
    let dateFrom = dateFromInput?.value || '';
    let dateTo = dateToInput?.value || '';
    
    // If no date filters are set and no search query, default to current month
    let effectiveDateFrom = dateFrom;
    let effectiveDateTo = dateTo;
    
    if (!dateFrom && !dateTo && !searchTerm) {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        effectiveDateFrom = firstDayOfMonth.toISOString().split('T')[0];
        effectiveDateTo = lastDayOfMonth.toISOString().split('T')[0];
        
        // Update date inputs to show current month (if they exist)
        if (dateFromInput && !dateFromInput.value) {
            dateFromInput.value = effectiveDateFrom;
        }
        if (dateToInput && !dateToInput.value) {
            dateToInput.value = effectiveDateTo;
        }
    }

    filteredAdjustments = inventoryOperations.filter(operation => {
        const product = products.find(p => p.id === operation.productId);
        if (!product) return false;

        const matchSearch = !searchTerm || 
            operation.productName.toLowerCase().includes(searchTerm) ||
            operation.productCode.toLowerCase().includes(searchTerm) ||
            operation.operationNumber.toLowerCase().includes(searchTerm);
        
        const matchCategory = !categoryFilter || product.category === categoryFilter;
        const matchStatus = !statusFilter || product.status === statusFilter;
        
        // Apply date filter
        let matchDate = true;
        if (effectiveDateFrom) {
            const operationDate = new Date(operation.date || 0);
            const fromDate = new Date(effectiveDateFrom);
            if (operationDate < fromDate) {
                matchDate = false;
            }
        }
        if (effectiveDateTo && matchDate) {
            const operationDate = new Date(operation.date || 0);
            const toDate = new Date(effectiveDateTo);
            toDate.setHours(23, 59, 59, 999); // Include entire day
            if (operationDate > toDate) {
                matchDate = false;
            }
        }

        return matchSearch && matchCategory && matchStatus && matchDate;
    }).sort((a, b) => {
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

    await renderAdjustments();
}

// Render Adjustments
async function renderAdjustments() {
    const tbody = document.getElementById('adjustmentTableBody');
    const emptyState = document.getElementById('adjustmentEmptyState');
    const paginationContainer = document.getElementById('adjustmentPaginationContainer');

    if (!tbody) return;

    tbody.innerHTML = '';

    if (filteredAdjustments.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (paginationContainer) paginationContainer.classList.add('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (paginationContainer) paginationContainer.classList.remove('hidden');

    const totalPages = Math.ceil(filteredAdjustments.length / itemsPerPage);
    const startIndex = (adjustmentCurrentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredAdjustments.length);
    const paginatedAdjustments = filteredAdjustments.slice(startIndex, endIndex);

    if (document.getElementById('adjustmentPaginationInfo')) {
        document.getElementById('adjustmentPaginationInfo').textContent = 
            `عرض ${startIndex + 1} - ${endIndex} من ${filteredAdjustments.length}`;
    }

    if (document.getElementById('adjustmentPrevPageBtn')) {
        document.getElementById('adjustmentPrevPageBtn').disabled = adjustmentCurrentPage === 1;
    }
    if (document.getElementById('adjustmentNextPageBtn')) {
        document.getElementById('adjustmentNextPageBtn').disabled = adjustmentCurrentPage >= totalPages;
    }

    // Get current logged-in user type
    const currentUserType = localStorage.getItem('asel_userType') || '';
    const canDeleteAdjustments = currentUserType === 'manager' || currentUserType === 'system_engineer';
    
    for (const operation of paginatedAdjustments) {
        const row = document.createElement('tr');
        const typeText = {
            'increase': 'زيادة',
            'decrease': 'نقصان',
            'set': 'تحديد قيمة معينة'
        };

        row.innerHTML = `
            <td>${operation.operationNumber || operation.adjustmentNumber}</td>
            <td>${new Date(operation.date).toLocaleDateString('ar-EG')}</td>
            <td>${operation.productName} (${operation.productCode})</td>
            <td>${operation.oldStock.toFixed(2)}</td>
            <td>${typeText[operation.adjustmentType] || operation.type}</td>
            <td>${operation.adjustmentAmount.toFixed(2)}</td>
            <td>${operation.newStock.toFixed(2)}</td>
            <td>${operation.reason || ''}</td>
            <td>
                <div class="actions-buttons">
                    <button class="action-btn view" data-adjustment-id="${operation.id}" title="عرض">👁️</button>
                </div>
            </td>
        `;
        
        // Add event listeners to buttons
        const viewBtn = row.querySelector('.action-btn.view');
        const actionsDiv = row.querySelector('.actions-buttons');
        
        if (viewBtn) {
            viewBtn.addEventListener('click', () => viewAdjustment(operation.id));
        }
        
        // Cancel button removed - operations cannot be cancelled
        tbody.appendChild(row);
    }
}

// Apply Return Filters
async function applyReturnFilters() {
    try {
        const searchInput = document.getElementById('returnSearchInput');
        const categoryFilterEl = document.getElementById('returnCategoryFilter');
        const statusFilterEl = document.getElementById('returnStatusFilter');
        
        if (!searchInput || !categoryFilterEl || !statusFilterEl) {
            console.warn('[Inventory] Return filter elements not found, skipping filter application');
            return;
        }
        
        const searchTerm = searchInput.value?.toLowerCase() || '';
        const categoryFilter = categoryFilterEl.value || '';
        const statusFilter = statusFilterEl.value || '';
        
        // Get date filters (if they exist in the UI)
        const dateFromInput = document.getElementById('returnDateFrom') || document.getElementById('dateFrom');
        const dateToInput = document.getElementById('returnDateTo') || document.getElementById('dateTo');
        let dateFrom = dateFromInput?.value || '';
        let dateTo = dateToInput?.value || '';
        
        // If no date filters are set and no search query, default to current month
        let effectiveDateFrom = dateFrom;
        let effectiveDateTo = dateTo;
        
        if (!dateFrom && !dateTo && !searchTerm) {
            const now = new Date();
            const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            
            effectiveDateFrom = firstDayOfMonth.toISOString().split('T')[0];
            effectiveDateTo = lastDayOfMonth.toISOString().split('T')[0];
            
            // Update date inputs to show current month (if they exist)
            if (dateFromInput && !dateFromInput.value) {
                dateFromInput.value = effectiveDateFrom;
            }
            if (dateToInput && !dateToInput.value) {
                dateToInput.value = effectiveDateTo;
            }
        }

        filteredReturns = returns.filter(ret => {
            const product = products.find(p => p.id === ret.productId);
            if (!product) return false;

            const matchSearch = !searchTerm || 
                (product.name || product.productName || '').toLowerCase().includes(searchTerm) ||
                (product.code || product.productCode || '').toLowerCase().includes(searchTerm) ||
                (ret.returnNumber || '').toLowerCase().includes(searchTerm);
            
            const matchCategory = !categoryFilter || product.category === categoryFilter;
            const matchStatus = !statusFilter || product.status === statusFilter;
            
            // Apply date filter
            let matchDate = true;
            if (effectiveDateFrom) {
                const returnDate = new Date(ret.date || 0);
                const fromDate = new Date(effectiveDateFrom);
                if (returnDate < fromDate) {
                    matchDate = false;
                }
            }
            if (effectiveDateTo && matchDate) {
                const returnDate = new Date(ret.date || 0);
                const toDate = new Date(effectiveDateTo);
                toDate.setHours(23, 59, 59, 999); // Include entire day
                if (returnDate > toDate) {
                    matchDate = false;
                }
            }

            return matchSearch && matchCategory && matchStatus && matchDate;
        }).sort((a, b) => {
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

        await renderReturns();
    } catch (error) {
        console.error('[Inventory] Error in applyReturnFilters:', error);
    }
}

// Render Returns
async function renderReturns() {
    const tbody = document.getElementById('returnTableBody');
    const emptyState = document.getElementById('returnEmptyState');
    const paginationContainer = document.getElementById('returnPaginationContainer');

    if (!tbody) return;

    tbody.innerHTML = '';

    if (filteredReturns.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (paginationContainer) paginationContainer.classList.add('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (paginationContainer) paginationContainer.classList.remove('hidden');

    const totalPages = Math.ceil(filteredReturns.length / itemsPerPage);
    const startIndex = (returnCurrentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredReturns.length);
    const paginatedReturns = filteredReturns.slice(startIndex, endIndex);

    if (document.getElementById('returnPaginationInfo')) {
        document.getElementById('returnPaginationInfo').textContent = 
            `عرض ${startIndex + 1} - ${endIndex} من ${filteredReturns.length}`;
    }

    if (document.getElementById('returnPrevPageBtn')) {
        document.getElementById('returnPrevPageBtn').disabled = returnCurrentPage === 1;
    }
    if (document.getElementById('returnNextPageBtn')) {
        document.getElementById('returnNextPageBtn').disabled = returnCurrentPage >= totalPages;
    }

    // Get current logged-in user type
    const currentUserType = localStorage.getItem('asel_userType') || '';
    const canDeleteReturns = currentUserType === 'manager' || currentUserType === 'system_engineer';
    
    for (const ret of paginatedReturns) {
        const row = document.createElement('tr');
        const product = products.find(p => p.id === ret.productId);
        const returnTypeText = ret.returnType === 'from_customer' ? 'من عميل' : 'إلى مورد';
        const reasonText = {
            'damaged': 'تالف',
            'defective': 'معيب',
            'wrong_item': 'صنف خاطئ',
            'expired': 'منتهي الصلاحية',
            'customer_request': 'طلب العميل',
            'other': 'أخرى'
        };

        row.innerHTML = `
            <td>${ret.returnNumber || ret.id}</td>
            <td>${new Date(ret.date).toLocaleDateString('ar-EG')}</td>
            <td>${returnTypeText}</td>
            <td>${product?.name || product?.productName || 'غير معروف'}</td>
            <td>${ret.quantity.toFixed(2)}</td>
            <td>${ret.unitPrice.toFixed(2)}</td>
            <td>${ret.totalAmount.toFixed(2)}</td>
            <td>${reasonText[ret.returnReason] || ret.returnReason || ''}</td>
            <td>
                <div class="actions-buttons">
                    <button class="action-btn view" data-return-id="${ret.id}" title="عرض">👁️</button>
                </div>
            </td>
        `;
        
        // Add event listeners to buttons
        const viewBtn = row.querySelector('.action-btn.view');
        const actionsDiv = row.querySelector('.actions-buttons');
        
        if (viewBtn) {
            viewBtn.addEventListener('click', () => viewReturn(ret.id));
        }
        
        // Cancel button removed - returns cannot be cancelled
        tbody.appendChild(row);
    }
}

function closeModal() {
    document.getElementById('inventoryModal')?.classList.remove('active');
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

// View Adjustment
function viewAdjustment(operationId) {
    const operation = inventoryOperations.find(op => op.id === operationId);
    if (!operation) return;

    const typeText = {
        'increase': 'زيادة',
        'decrease': 'نقصان',
        'set': 'تحديد قيمة معينة'
    };

    if (window.showToast) {
        const message = `عملية جرد رقم: ${operation.operationNumber} - التاريخ: ${new Date(operation.date).toLocaleDateString('ar-EG')} - المنتج: ${operation.productName} (${operation.productCode}) - المخزون قبل: ${operation.oldStock.toFixed(2)} - نوع التعديل: ${typeText[operation.adjustmentType]} - الكمية: ${operation.adjustmentAmount.toFixed(2)} - المخزون بعد: ${operation.newStock.toFixed(2)} - السبب: ${operation.reason}${operation.notes ? ` - ملاحظات: ${operation.notes}` : ''}`;
        window.showToast(message, 'info');
    }
}

// Delete Adjustment
async function deleteAdjustment(operationId) {
    // Use custom confirmation dialog instead of confirm()
    showConfirmDialog(
        'هل أنت متأكد من حذف هذه العملية؟ سيتم استعادة المخزون القديم.',
        () => {
            // User confirmed - proceed with deletion
            proceedWithAdjustmentDeletion(operationId);
        },
        () => {
            // User cancelled - do nothing
        }
    );
}

// Proceed with adjustment deletion
async function proceedWithAdjustmentDeletion(operationId) {

    const operation = inventoryOperations.find(op => op.id === operationId);
    if (operation) {
        // Revert stock change in database
        if (window.electronAPI && window.electronAPI.dbGet && window.electronAPI.dbUpdate) {
            try {
                const product = await window.electronAPI.dbGet('products', operation.productId);
                if (product) {
                    product.stock = operation.oldStock;
                    await window.electronAPI.dbUpdate('products', product.id, product);
                }
                
                // Delete from database
                await window.electronAPI.dbDelete('inventory_adjustments', operationId);
            } catch (error) {
                console.error('[Inventory] Error reverting stock:', error);
                if (window.showToast) {
                    window.showToast('خطأ في استعادة المخزون: ' + error.message, 'error');
                } else {
                if (window.showToast) {
                    window.showToast('خطأ في استعادة المخزون: ' + error.message, 'error');
                }
                }
                return;
            }
        }
        
        // Revert stock change locally
        const product = products.find(p => p.id === operation.productId);
        if (product) {
            product.stock = operation.oldStock;
        }
    }

    await loadData();
    await applyAdjustmentFilters();
    if (window.showToast) {
        window.showToast('تم حذف العملية واستعادة المخزون القديم', 'success');
    }
}

// View Return
function viewReturn(returnId) {
    const ret = returns.find(r => r.id === returnId);
    if (!ret) return;

    const product = products.find(p => p.id === ret.productId);
    const returnTypeText = ret.returnType === 'from_customer' ? 'من عميل' : 'إلى مورد';
    const reasonText = {
        'damaged': 'تالف',
        'defective': 'معيب',
        'wrong_item': 'صنف خاطئ',
        'expired': 'منتهي الصلاحية',
        'customer_request': 'طلب العميل',
        'other': 'أخرى'
    };

    if (window.showToast) {
        const message = `مرتجع رقم: ${ret.returnNumber} - التاريخ: ${new Date(ret.date).toLocaleDateString('ar-EG')} - نوع المرتجع: ${returnTypeText} - المنتج: ${product?.name || product?.productName || 'غير معروف'} - الكمية: ${ret.quantity.toFixed(2)} - سعر الوحدة: ${ret.unitPrice.toFixed(2)} - المبلغ الإجمالي: ${ret.totalAmount.toFixed(2)} - سبب المرتجع: ${reasonText[ret.returnReason] || ret.returnReason} - ${ret.restoredToStock === 'true' ? 'تم إعادة الكمية للمخزون' : 'لم يتم إعادة الكمية للمخزون'}${ret.notes ? ` - ملاحظات: ${ret.notes}` : ''}`;
        window.showToast(message, 'info');
    }
}

// Delete Return
async function deleteReturn(returnId) {
    // Use custom confirmation dialog instead of confirm()
    showConfirmDialog(
        'هل أنت متأكد من حذف هذا المرتجع؟ سيتم استعادة الرصيد والمخزون.',
        () => {
            // User confirmed - proceed with deletion
            proceedWithReturnDeletion(returnId);
        },
        () => {
            // User cancelled - do nothing
        }
    );
}

// Proceed with return deletion
async function proceedWithReturnDeletion(returnId) {

    const ret = returns.find(r => r.id === returnId);
    if (!ret) return;

    try {
        // Revert entity balance only if restoreBalance was true
        // When deleting a return, we need to reverse the balance change only if it was applied
        // For both customers and suppliers: we subtracted only if restoreBalance was true, so we add back only if it was true
        const tableName = ret.returnType === 'from_customer' ? 'customers' : 'suppliers';
        const shouldRevertBalance = (ret.restoreBalance === 'true' || ret.restoreBalance === true);
        
        if (shouldRevertBalance) {
            const entity = await window.electronAPI.dbGet(tableName, ret.entityId);
            if (entity) {
                const updatedEntity = {
                    ...entity,
                    balance: parseFloat(entity.balance || 0) + ret.totalAmount, // Add back (reverse the subtraction)
                    updatedAt: new Date().toISOString()
                };
                // Only add currentBalance if it exists in the entity
                if (entity.hasOwnProperty('currentBalance')) {
                    updatedEntity.currentBalance = updatedEntity.balance;
                }
                await window.electronAPI.dbUpdate(tableName, entity.id, updatedEntity);
            }
        }

        // Revert product stock if it was restored
        // For returns from customer: we added to stock, so subtract (reverse)
        // For returns to supplier: we subtracted from stock, so add back (reverse)
        if (ret.restoredToStock === 'true') {
            const product = await window.electronAPI.dbGet('products', ret.productId);
            if (product) {
                const currentStock = parseFloat(product.stock || 0);
                let newStock = currentStock;
                
                if (ret.returnType === 'from_customer') {
                    // We added to stock, so subtract (reverse)
                    newStock = Math.max(0, currentStock - ret.quantity);
                    console.log('[Return] Reverting customer return: subtracting', ret.quantity, 'from stock. Old:', currentStock, 'New:', newStock);
                } else if (ret.returnType === 'to_supplier') {
                    // We subtracted from stock, so add back (reverse)
                    newStock = currentStock + ret.quantity;
                    console.log('[Return] Reverting supplier return: adding', ret.quantity, 'to stock. Old:', currentStock, 'New:', newStock);
                }
                
                product.stock = newStock;
                await window.electronAPI.dbUpdate('products', product.id, product);
            }
        }

        // Delete from database
        await window.electronAPI.dbDelete('returns', returnId);

        await loadData();
        await applyReturnFilters();
        if (window.showToast) {
            window.showToast('تم حذف المرتجع واستعادة الرصيد والمخزون', 'success');
        }
    } catch (error) {
        console.error('[Inventory] Error deleting return:', error);
        if (window.showToast) {
            window.showToast('خطأ في حذف المرتجع: ' + error.message, 'error');
        }
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

// Check if operation is cancelled (always returns false - cancellations table removed)
async function checkIfOperationCancelled(operationId) {
    return false;
}

// Cancel inventory operation (reverse operation)
async function cancelInventoryOperation(operationId) {
    const operation = allOperations.find(op => op.id === operationId);
    if (!operation) {
        showMessage('العملية غير موجودة', 'error');
        return;
    }
    
    // Check if already cancelled
    const isCancelled = await checkIfOperationCancelled(operationId);
    if (isCancelled) {
        showMessage('العملية ملغاة بالفعل', 'error');
        return;
    }
    
    // Confirm cancellation using showConfirmDialog
    showConfirmDialog(
        `هل أنت متأكد من إلغاء العملية ${operation.operationNumber}؟\n\nسيتم عكس جميع العمليات المرتبطة بهذه العملية.`,
        async () => {
            try {
                // Reverse operation: restore old stock
                if (window.electronAPI && window.electronAPI.dbGet && window.electronAPI.dbUpdate) {
                    const product = await window.electronAPI.dbGet('products', operation.productId);
                    if (product) {
                        // Restore old stock
                        product.stock = operation.oldStock;
                        await window.electronAPI.dbUpdate('products', product.id, product);
                        
                        // Update in local array
                        const localProduct = products.find(p => p.id === product.id);
                        if (localProduct) {
                            localProduct.stock = operation.oldStock;
                        }
                    }
                }
                
                // Show success toast
                if (window.showToast) {
                    window.showToast(`تم إلغاء العملية ${operation.operationNumber} بنجاح`, 'success');
                } else {
                    showMessage(`تم إلغاء العملية ${operation.operationNumber} بنجاح`, 'success');
                }
                
                // Reload operations
                await loadData();
                await applyFilters();
                
                // Dispatch event to notify other modules
                window.dispatchEvent(new CustomEvent('operationCancelled', {
                    detail: { operationId },
                    bubbles: true
                }));
            } catch (error) {
                console.error('[Inventory] Error cancelling operation:', error);
                if (window.showToast) {
                    window.showToast('خطأ في إلغاء العملية: ' + error.message, 'error');
                } else {
                    showMessage('خطأ في إلغاء العملية: ' + error.message, 'error');
                }
            }
        },
        () => {
            // User cancelled - do nothing
            if (window.showToast) {
                window.showToast('تم إلغاء العملية', 'info');
            }
        }
    );
}

// Check if adjustment is cancelled (always returns false - cancellations table removed)
async function checkIfAdjustmentCancelled(adjustmentId) {
    return false;
}

// Cancel adjustment (reverse operation)
async function cancelAdjustment(adjustmentId) {
    const adjustment = filteredAdjustments.find(adj => adj.id === adjustmentId);
    if (!adjustment) {
        showMessage('عملية الجرد غير موجودة', 'error');
        return;
    }
    
    // Check if already cancelled
    const isCancelled = await checkIfAdjustmentCancelled(adjustmentId);
    if (isCancelled) {
        showMessage('عملية الجرد ملغاة بالفعل', 'error');
        return;
    }
    
    // Confirm cancellation using showConfirmDialog
    showConfirmDialog(
        `هل أنت متأكد من إلغاء عملية الجرد ${adjustment.operationNumber || adjustment.adjustmentNumber}؟\n\nسيتم عكس جميع العمليات المرتبطة بهذه العملية.`,
        async () => {
            try {
                // Reverse adjustment: restore old stock
                if (window.electronAPI && window.electronAPI.dbGet && window.electronAPI.dbUpdate) {
                    const product = await window.electronAPI.dbGet('products', adjustment.productId);
                    if (product) {
                        // Restore old stock
                        product.stock = adjustment.oldStock;
                        await window.electronAPI.dbUpdate('products', product.id, product);
                        
                        // Update in local array
                        const localProduct = products.find(p => p.id === product.id);
                        if (localProduct) {
                            localProduct.stock = adjustment.oldStock;
                        }
                    }
                }
                
                // Show success toast
                if (window.showToast) {
                    window.showToast(`تم إلغاء عملية الجرد ${adjustment.operationNumber || adjustment.adjustmentNumber} بنجاح`, 'success');
                } else {
                    showMessage(`تم إلغاء عملية الجرد ${adjustment.operationNumber || adjustment.adjustmentNumber} بنجاح`, 'success');
                }
                
                // Reload adjustments
                await loadData();
                await applyAdjustmentFilters();
                
                // Dispatch event to notify other modules
                window.dispatchEvent(new CustomEvent('adjustmentCancelled', {
                    detail: { adjustmentId },
                    bubbles: true
                }));
            } catch (error) {
                console.error('[Inventory] Error cancelling adjustment:', error);
                if (window.showToast) {
                    window.showToast('خطأ في إلغاء عملية الجرد: ' + error.message, 'error');
                } else {
                    showMessage('خطأ في إلغاء عملية الجرد: ' + error.message, 'error');
                }
            }
        },
        () => {
            // User cancelled - do nothing
            if (window.showToast) {
                window.showToast('تم إلغاء العملية', 'info');
            }
        }
    );
}

// Check if return is cancelled (always returns false - cancellations table removed)
async function checkIfReturnCancelled(returnId) {
    return false;
}

// Cancel return (reverse operation)
async function cancelReturn(returnId) {
    const ret = returns.find(r => r.id === returnId);
    if (!ret) {
        showMessage('المرتجع غير موجود', 'error');
        return;
    }
    
    // Check if already cancelled
    const isCancelled = await checkIfReturnCancelled(returnId);
    if (isCancelled) {
        showMessage('المرتجع ملغي بالفعل', 'error');
        return;
    }
    
    // Confirm cancellation using showConfirmDialog
    showConfirmDialog(
        `هل أنت متأكد من إلغاء المرتجع ${ret.returnNumber || ret.id}؟\n\nسيتم عكس جميع العمليات المرتبطة بهذا المرتجع.`,
        async () => {
            try {
                // Reverse return operations:
                // 1. Reverse stock changes (if restored to stock, subtract it; if not, no change needed)
                if (ret.restoredToStock === 'true' && window.electronAPI && window.electronAPI.dbGet && window.electronAPI.dbUpdate) {
                    const product = await window.electronAPI.dbGet('products', ret.productId);
                    if (product) {
                        // Subtract the returned quantity from stock
                        product.stock = Math.max(0, (product.stock || 0) - (ret.quantity || 0));
                        await window.electronAPI.dbUpdate('products', product.id, product);
                        
                        // Update in local array
                        const localProduct = products.find(p => p.id === product.id);
                        if (localProduct) {
                            localProduct.stock = product.stock;
                        }
                    }
                }
                
                // 2. Reverse customer/supplier balance changes
                if (ret.returnType === 'from_customer' && ret.entityId && window.electronAPI && window.electronAPI.dbGet && window.electronAPI.dbUpdate) {
                    // Reverse customer balance (subtract the amount that was added)
                    const customer = await window.electronAPI.dbGet('customers', ret.entityId);
                    if (customer) {
                        customer.balance = (customer.balance || 0) - (ret.totalAmount || 0);
                        await window.electronAPI.dbUpdate('customers', customer.id, customer);
                        
                        // Recalculate customer balance
                        if (window.recalculateCustomerBalance && typeof window.recalculateCustomerBalance === 'function') {
                            await window.recalculateCustomerBalance(customer.id);
                        }
                    }
                } else if (ret.returnType === 'to_supplier' && ret.entityId && window.electronAPI && window.electronAPI.dbGet && window.electronAPI.dbUpdate) {
                    // Reverse supplier balance (add the amount that was subtracted)
                    const supplier = await window.electronAPI.dbGet('suppliers', ret.entityId);
                    if (supplier) {
                        supplier.balance = (supplier.balance || 0) + (ret.totalAmount || 0);
                        await window.electronAPI.dbUpdate('suppliers', supplier.id, supplier);
                        
                        // Recalculate supplier balance
                        if (window.recalculateSupplierBalance && typeof window.recalculateSupplierBalance === 'function') {
                            await window.recalculateSupplierBalance(supplier.id);
                        }
                    }
                }
                
                // Show success toast
                if (window.showToast) {
                    window.showToast(`تم إلغاء المرتجع ${ret.returnNumber || ret.id} بنجاح`, 'success');
                } else {
                    showMessage(`تم إلغاء المرتجع ${ret.returnNumber || ret.id} بنجاح`, 'success');
                }
                
                // Reload returns
                await loadData();
                await applyReturnFilters();
                
                // Dispatch event to notify other modules
                window.dispatchEvent(new CustomEvent('returnCancelled', {
                    detail: { returnId },
                    bubbles: true
                }));
            } catch (error) {
                console.error('[Inventory] Error cancelling return:', error);
                if (window.showToast) {
                    window.showToast('خطأ في إلغاء المرتجع: ' + error.message, 'error');
                } else {
                    showMessage('خطأ في إلغاء المرتجع: ' + error.message, 'error');
                }
            }
        },
        () => {
            // User cancelled - do nothing
            if (window.showToast) {
                window.showToast('تم إلغاء العملية', 'info');
            }
        }
    );
}

// Make functions global
window.viewInventoryOperation = viewInventoryOperation;
window.cancelInventoryOperation = cancelInventoryOperation;
window.viewAdjustment = viewAdjustment;
window.cancelAdjustment = cancelAdjustment;
window.viewReturn = viewReturn;
window.cancelReturn = cancelReturn;

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
                    email: companyInfo.email || ''
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

// Generate Blank Return Voucher Print Content
async function generateBlankReturnVoucherPrintContent() {
    const companySettings = await getCompanySettings();
    const currentYear = new Date().getFullYear();

    // Generate single return voucher HTML
    const singleReturnHTML = `
        <div class="voucher-container">
            <div class="watermark">${companySettings.name || 'شركة أسيل'}</div>
            <div class="header">
                <div class="company-name">${companySettings.name || 'شركة أسيل'}</div>
                <div>${companySettings.address || ''}</div>
                <div>${companySettings.phone || ''}</div>
            </div>
            <div class="voucher-title">
                <div>محضر استلام مرتجعات</div>
            </div>
            <div class="voucher-info">
                <table>
                    <tr>
                        <td>رقم المرتجع:</td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>التاريخ:</td>
                        <td>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; / &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; / ${currentYear}</td>
                    </tr>
                    <tr>
                        <td>نوع المرتجع:</td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>من/إلى:</td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>المنتج:</td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>الكمية:</td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>سعر الوحدة:</td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>المبلغ الإجمالي:</td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>سبب المرتجع:</td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>ملاحظات:</td>
                        <td></td>
                    </tr>
                </table>
            </div>
            <div class="signature">
                <div class="signature-box">
                    <div>توقيع المستلم</div>
                </div>
                <div class="signature-box">
                    <div>توقيع المندوب</div>
                </div>
            </div>
        </div>
    `;

    return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>محضر استلام مرتجعات</title>
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
            text-align: center;
            margin-bottom: 4px;
            border-bottom: 1.5px solid #333;
            padding-bottom: 3px;
            margin-top: 0;
            flex-shrink: 0;
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
            width: 80px;
        }
        .voucher-info td:last-child {
            border-bottom: 1px dotted #333;
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
    <div class="receipt-wrapper">${singleReturnHTML}</div>
    <div class="receipt-wrapper">${singleReturnHTML}</div>
    <div class="receipt-wrapper">${singleReturnHTML}</div>
    <div class="receipt-wrapper">${singleReturnHTML}</div>
</body>
    </html>
    `;
}

// View Blank Return Voucher
async function viewBlankReturnVoucher() {
    try {
        // Generate print content
        const printContent = await generateBlankReturnVoucherPrintContent();
        
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
        console.error('Error in viewBlankReturnVoucher:', error);
        if (window.showToast) {
            window.showToast('خطأ في عرض مستند الإرجاع الفارغ: ' + error.message, 'error');
        }
    }
}

// Print Blank Return Voucher
async function printBlankReturnVoucher() {
    try {
        // Generate print content
        const printContent = await generateBlankReturnVoucherPrintContent();
        
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
                    window.showToast('تم طباعة مستند الإرجاع الفارغ بنجاح', 'success');
                }
            } catch (printError) {
                console.error('Error calling print():', printError);
                if (window.showToast) {
                    window.showToast('تم فتح نافذة الطباعة. يرجى استخدام زر الطباعة في المتصفح', 'info');
                }
            }
        }, 500);
    } catch (error) {
        console.error('Error in printBlankReturnVoucher:', error);
        if (window.showToast) {
            window.showToast('خطأ في طباعة مستند الإرجاع الفارغ: ' + error.message, 'error');
        }
    }
}

