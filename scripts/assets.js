// Fixed Assets Management System

const STORAGE_KEYS = {
    ASSETS: 'asel_fixed_assets',
    ASSET_COUNTER: 'asel_asset_counter'
};

// Category mapping
const CATEGORY_NAMES = {
    computers: 'أجهزة كمبيوتر',
    vehicles: 'مركبات',
    equipment: 'معدات',
    furniture: 'أثاث',
    machinery: 'آلات',
    buildings: 'مباني',
    other: 'أخرى'
};

// Status mapping
const STATUS_NAMES = {
    acquired: 'تم الشراء',
    active: 'نشط',
    maintenance: 'صيانة',
    suspended: 'موقوف مؤقتًا',
    disposed: 'تم التخلص / تم البيع',
    writtenoff: 'تالف / إعدام'
};


let assets = [];
let suppliers = [];

// Pagination & Filter State
let currentPage = 1;
const itemsPerPage = 20;
let filteredAssets = [];

// Load data on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    initializeEventListeners();
    renderSuppliers();
    applyFilters();
    
    // Set today's date as default for purchase date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('purchaseDate').value = today;
});

// Initialize Event Listeners
function initializeEventListeners() {
    // Add Asset Button
    document.getElementById('addAssetBtn').addEventListener('click', async () => {
        await openAddModal();
    });
    
    // Empty state button
    const emptyStateBtn = document.getElementById('emptyStateAddBtn');
    if (emptyStateBtn) {
        emptyStateBtn.addEventListener('click', () => {
            document.getElementById('addAssetBtn').click();
        });
    }

    // Show Total Assets Button
    document.getElementById('showTotalBtn').addEventListener('click', showTotalAssets);

    // Save Report Button
    document.getElementById('saveReportBtn').addEventListener('click', saveReportAsPDF);

    // Print Report Button
    document.getElementById('printReportBtn').addEventListener('click', printReport);

    // Modal Close Buttons
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('closeDetailsModal').addEventListener('click', closeDetailsModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);

    // Form Submit
    document.getElementById('assetForm').addEventListener('submit', handleFormSubmit);

    // Search and Filters
    document.getElementById('searchInput').addEventListener('input', () => {
        currentPage = 1;
        applyFilters();
    });
    document.getElementById('categoryFilter').addEventListener('change', () => {
        currentPage = 1;
        applyFilters();
    });
    document.getElementById('statusFilter').addEventListener('change', () => {
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
        const totalPages = Math.ceil(filteredAssets.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            applyFilters();
        }
    });

    // Close modal on backdrop click
    document.getElementById('assetModal').addEventListener('click', (e) => {
        if (e.target.id === 'assetModal') {
            closeModal();
        }
    });

    document.getElementById('detailsModal').addEventListener('click', (e) => {
        if (e.target.id === 'detailsModal') {
            closeDetailsModal();
        }
    });

    // Auto-calculate current value based on depreciation
    document.getElementById('purchasePrice').addEventListener('input', calculateCurrentValue);
    document.getElementById('depreciationRate').addEventListener('input', calculateCurrentValue);
    document.getElementById('purchaseDate').addEventListener('change', calculateCurrentValue);
}

// Load Data from Database
async function loadData() {
    // Try to load from database first
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            assets = await window.electronAPI.dbGetAll('fixed_assets', '', []);
            suppliers = await window.electronAPI.dbGetAll('suppliers', '', []);
            
            // Ensure arrays
            assets = Array.isArray(assets) ? assets : [];
            suppliers = Array.isArray(suppliers) ? suppliers : [];
            
        } catch (error) {
            console.error('[Assets] Error loading data from database:', error);
            // Fallback to localStorage
            const assetsData = localStorage.getItem(STORAGE_KEYS.ASSETS);
            assets = assetsData ? JSON.parse(assetsData) : [];
            suppliers = [];
        }
    } else {
        console.warn('[Assets] electronAPI not available, using localStorage');
        // Fallback to localStorage
        const assetsData = localStorage.getItem(STORAGE_KEYS.ASSETS);
        assets = assetsData ? JSON.parse(assetsData) : [];
        suppliers = [];
    }
}

// Save Assets
async function saveAssets() {
    if (window.electronAPI && window.electronAPI.dbInsert) {
        // Data is already saved in handleFormSubmit
        return;
    } else {
        localStorage.setItem(STORAGE_KEYS.ASSETS, JSON.stringify(assets));
    }
}

// Generate Asset Code
async function generateAssetCode() {
    const year = new Date().getFullYear();
    const prefix = `AST-${year}-`;
    
    // Try to get counter from database first (more reliable)
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            // Get all assets from database
            const allAssets = await window.electronAPI.dbGetAll('fixed_assets', '', []);
            
            if (allAssets && allAssets.length > 0) {
                // Filter assets with codes matching current year pattern
                const currentYearCodes = allAssets
                    .map(asset => asset.code)
                    .filter(code => code && code.startsWith(prefix));
                
                // Extract numbers from codes (e.g., "AST-2025-001" -> 1)
                const numbers = currentYearCodes.map(code => {
                    const match = code.match(new RegExp(`${prefix}(\\d+)`));
                    return match ? parseInt(match[1]) : 0;
                });
                
                // Get maximum number
                const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
                const counter = maxNumber + 1;
                
                // Save to localStorage as backup
                localStorage.setItem(STORAGE_KEYS.ASSET_COUNTER, counter.toString());
                
                return `${prefix}${String(counter).padStart(3, '0')}`;
            }
        } catch (error) {
            console.error('Error generating asset code from database:', error);
            // Fallback to localStorage
        }
    }
    
    // Fallback: use localStorage counter
    let counter = parseInt(localStorage.getItem(STORAGE_KEYS.ASSET_COUNTER) || '0');
    counter++;
    localStorage.setItem(STORAGE_KEYS.ASSET_COUNTER, counter.toString());
    
    return `${prefix}${String(counter).padStart(3, '0')}`;
}

// Render Suppliers
function renderSuppliers() {
    const select = document.getElementById('supplierSelect');
    select.innerHTML = '<option value="">اختر المورد (اختياري)</option>';
    
    suppliers.forEach(supplier => {
        const option = document.createElement('option');
        option.value = supplier.id;
        option.textContent = `${supplier.name} - ${supplier.code}`;
        select.appendChild(option);
    });
}

// Calculate Current Value based on depreciation
function calculateCurrentValue() {
    const purchasePrice = parseFloat(document.getElementById('purchasePrice').value) || 0;
    const depreciationRate = parseFloat(document.getElementById('depreciationRate').value) || 0;
    const purchaseDate = document.getElementById('purchaseDate').value;
    
    if (!purchaseDate || purchasePrice === 0) {
        // Set current value equal to purchase price initially
        document.getElementById('currentValue').value = purchasePrice;
        return;
    }
    
    // Calculate years since purchase
    const purchase = new Date(purchaseDate);
    const today = new Date();
    const yearsDiff = (today - purchase) / (1000 * 60 * 60 * 24 * 365);
    
    if (depreciationRate > 0 && yearsDiff > 0) {
        // Calculate depreciated value
        const depreciatedValue = purchasePrice * (1 - (depreciationRate / 100) * yearsDiff);
        document.getElementById('currentValue').value = Math.max(0, depreciatedValue.toFixed(2));
    } else {
        // If no depreciation or future date, set to purchase price
        document.getElementById('currentValue').value = purchasePrice;
    }
}

// Open Add Modal
async function openAddModal() {
    document.getElementById('isEdit').value = 'false';
    document.getElementById('assetId').value = '';
    document.getElementById('modalTitle').textContent = 'إضافة أصل جديد';
    document.getElementById('assetForm').reset();
    
    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('purchaseDate').value = today;
    
    // Auto-generate code if not editing
    const assetCodeInput = document.getElementById('assetCode');
    try {
        const generatedCode = await generateAssetCode();
        assetCodeInput.value = generatedCode;
    } catch (error) {
        console.error('Error generating asset code:', error);
        // Fallback: generate a simple code
        const year = new Date().getFullYear();
        const timestamp = Date.now().toString().slice(-3);
        assetCodeInput.value = `AST-${year}-${timestamp}`;
    }
    // Make code readonly (cannot be changed)
    assetCodeInput.readOnly = true;
    assetCodeInput.style.background = '#f8fafc';
    assetCodeInput.style.cursor = 'not-allowed';
    
    document.getElementById('assetModal').classList.add('active');
    
    // Ensure focus is restored after opening modal
    setTimeout(() => {
        window.focus();
        // Try to focus on first input field
        const firstInput = document.querySelector('#assetModal input:not([type="hidden"]), #assetModal select, #assetModal textarea');
        if (firstInput) {
            setTimeout(() => {
                firstInput.focus();
            }, 50);
        }
    }, 100);
}

// Open Edit Modal
function openEditModal(assetId) {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;
    
    document.getElementById('isEdit').value = 'true';
    document.getElementById('assetId').value = asset.id;
    document.getElementById('modalTitle').textContent = 'تعديل الأصل';
    
    // Populate form
    const assetCodeInput = document.getElementById('assetCode');
    assetCodeInput.value = asset.code || '';
    // Make code readonly when editing (cannot be changed after creation)
    assetCodeInput.readOnly = true;
    assetCodeInput.style.background = '#f8fafc';
    assetCodeInput.style.cursor = 'not-allowed';
    document.getElementById('assetName').value = asset.name || '';
    document.getElementById('category').value = asset.category || '';
    document.getElementById('purchaseDate').value = asset.purchaseDate || '';
    document.getElementById('purchasePrice').value = asset.purchasePrice || 0;
    document.getElementById('currentValue').value = asset.currentValue || asset.purchasePrice || 0;
    document.getElementById('depreciationRate').value = asset.depreciationRate || 0;
    document.getElementById('status').value = asset.status || 'active';
    document.getElementById('location').value = asset.location || '';
    document.getElementById('department').value = asset.department || '';
    document.getElementById('supplierSelect').value = asset.supplierId || '';
    document.getElementById('warrantyExpiryDate').value = asset.warrantyExpiryDate || '';
    document.getElementById('description').value = asset.description || '';
    document.getElementById('notes').value = asset.notes || '';
    
    document.getElementById('assetModal').classList.add('active');
}

// Close Modal
function closeModal() {
    document.getElementById('assetModal').classList.remove('active');
    document.getElementById('assetForm').reset();
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

// Close Details Modal
function closeDetailsModal() {
    document.getElementById('detailsModal').classList.remove('active');
}

// Handle Form Submit
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const isEdit = formData.get('isEdit') === 'true';
    const assetId = formData.get('assetId');
    
    const assetData = {
        code: formData.get('assetCode'),
        name: formData.get('assetName'),
        category: formData.get('category'),
        purchaseDate: formData.get('purchaseDate'),
        purchasePrice: parseFloat(formData.get('purchasePrice')) || 0,
        currentValue: parseFloat(formData.get('currentValue')) || parseFloat(formData.get('purchasePrice')) || 0,
        depreciationRate: parseFloat(formData.get('depreciationRate')) || 0,
        status: formData.get('status'),
        location: formData.get('location') || null,
        department: formData.get('department') || null,
        supplierId: formData.get('supplierSelect') || null,
        warrantyExpiryDate: formData.get('warrantyExpiryDate') || null,
        description: formData.get('description') || null,
        notes: formData.get('notes') || null,
        updatedAt: new Date().toISOString()
    };
    
    if (isEdit) {
        // Update existing asset
        assetData.id = assetId;
        assetData.createdAt = assets.find(a => a.id === assetId).createdAt;
        
        if (window.electronAPI && window.electronAPI.dbUpdate) {
            try {
                const updateResult = await window.electronAPI.dbUpdate('fixed_assets', assetId, assetData);
                
                // Check if update was successful
                if (!updateResult || !updateResult.success) {
                    const errorMsg = updateResult?.error || 'خطأ غير معروف';
                    console.error('Failed to update asset in database:', errorMsg);
                    if (window.showToast) {
                        window.showToast('فشل تحديث الأصل في قاعدة البيانات: ' + errorMsg, 'error');
                    } else {
                        alert('فشل تحديث الأصل في قاعدة البيانات: ' + errorMsg);
                    }
                    return;
                }
                
                const index = assets.findIndex(a => a.id === assetId);
                if (index !== -1) {
                    assets[index] = assetData;
                }
            } catch (error) {
                console.error('Error updating asset:', error);
                if (window.showToast) {
                    window.showToast('حدث خطأ أثناء تحديث الأصل', 'error');
                } else {
                    alert('حدث خطأ أثناء تحديث الأصل');
                }
                return;
            }
        } else {
            const index = assets.findIndex(a => a.id === assetId);
            if (index !== -1) {
                assets[index] = assetData;
            }
            await saveAssets();
        }
    } else {
        // Create new asset
        assetData.id = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
        assetData.createdAt = new Date().toISOString();
        
        if (window.electronAPI && window.electronAPI.dbInsert) {
            try {
                const insertResult = await window.electronAPI.dbInsert('fixed_assets', assetData);
                
                // Check if insert was successful
                if (!insertResult || !insertResult.success) {
                    const errorMsg = insertResult?.error || 'خطأ غير معروف';
                    console.error('Failed to insert asset to database:', errorMsg);
                    if (window.showToast) {
                        window.showToast('فشل حفظ الأصل في قاعدة البيانات: ' + errorMsg, 'error');
                    } else {
                        alert('فشل حفظ الأصل في قاعدة البيانات: ' + errorMsg);
                    }
                    return;
                }
                
                assets.push(assetData);
            } catch (error) {
                console.error('Error creating asset:', error);
                if (error.message && error.message.includes('UNIQUE constraint')) {
                    if (window.showToast) {
                        window.showToast('كود الأصل موجود بالفعل. يرجى استخدام كود آخر.', 'error');
                    } else {
                        alert('كود الأصل موجود بالفعل. يرجى استخدام كود آخر.');
                    }
                } else {
                    if (window.showToast) {
                        window.showToast('حدث خطأ أثناء إضافة الأصل', 'error');
                    } else {
                        alert('حدث خطأ أثناء إضافة الأصل');
                    }
                }
                return;
            }
        } else {
            assets.push(assetData);
            await saveAssets();
        }
    }
    
    currentPage = 1;
    applyFilters();
    closeModal();
}

// View Asset Details
async function viewAssetDetails(assetId) {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;
    
    const supplier = asset.supplierId ? suppliers.find(s => s.id === asset.supplierId) : null;
    
    const detailsHtml = `
        <div class="detail-section">
            <h3>معلومات أساسية</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="label">كود الأصل:</span>
                    <span class="value">${asset.code}</span>
                </div>
                <div class="detail-item">
                    <span class="label">اسم الأصل:</span>
                    <span class="value">${asset.name}</span>
                </div>
                <div class="detail-item">
                    <span class="label">الصنف:</span>
                    <span class="value badge category-badge">${CATEGORY_NAMES[asset.category] || asset.category}</span>
                </div>
                <div class="detail-item">
                    <span class="label">الحالة:</span>
                    <span class="value badge status-badge ${asset.status}">${STATUS_NAMES[asset.status] || asset.status}</span>
                </div>
            </div>
        </div>
        
        <div class="detail-section">
            <h3>معلومات الشراء</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="label">تاريخ الشراء:</span>
                    <span class="value">${formatDate(asset.purchaseDate)}</span>
                </div>
                <div class="detail-item">
                    <span class="label">سعر الشراء:</span>
                    <span class="value">${formatCurrency(asset.purchasePrice)}</span>
                </div>
                <div class="detail-item">
                    <span class="label">القيمة الحالية:</span>
                    <span class="value">${formatCurrency(asset.currentValue || asset.purchasePrice)}</span>
                </div>
                <div class="detail-item">
                    <span class="label">معدل الاستهلاك:</span>
                    <span class="value">${asset.depreciationRate || 0}%</span>
                </div>
                ${supplier ? `
                <div class="detail-item">
                    <span class="label">المورد:</span>
                    <span class="value">${supplier.name} (${supplier.code})</span>
                </div>
                ` : ''}
                ${asset.warrantyExpiryDate ? `
                <div class="detail-item">
                    <span class="label">انتهاء الضمان:</span>
                    <span class="value">${formatDate(asset.warrantyExpiryDate)}</span>
                </div>
                ` : ''}
            </div>
        </div>
        
        ${asset.location || asset.department ? `
        <div class="detail-section">
            <h3>الموقع والقسم</h3>
            <div class="detail-grid">
                ${asset.location ? `
                <div class="detail-item">
                    <span class="label">الموقع:</span>
                    <span class="value">${asset.location}</span>
                </div>
                ` : ''}
                ${asset.department ? `
                <div class="detail-item">
                    <span class="label">القسم:</span>
                    <span class="value">${asset.department}</span>
                </div>
                ` : ''}
            </div>
        </div>
        ` : ''}
        
        ${asset.description || asset.notes ? `
        <div class="detail-section">
            <h3>وصف وملاحظات</h3>
            <div class="detail-grid">
                ${asset.description ? `
                <div class="detail-item">
                    <span class="label">الوصف:</span>
                    <span class="value">${asset.description}</span>
                </div>
                ` : ''}
                ${asset.notes ? `
                <div class="detail-item">
                    <span class="label">ملاحظات:</span>
                    <span class="value">${asset.notes}</span>
                </div>
                ` : ''}
            </div>
        </div>
        ` : ''}
    `;
    
    document.getElementById('assetDetails').innerHTML = detailsHtml;
    document.getElementById('detailsModal').classList.add('active');
}

// Delete Asset
async function deleteAsset(assetId) {
    if (!confirm('هل أنت متأكد من حذف هذا الأصل؟')) {
        return;
    }
    
    if (window.electronAPI && window.electronAPI.dbDelete) {
        try {
            await window.electronAPI.dbDelete('fixed_assets', assetId);
            assets = assets.filter(a => a.id !== assetId);
        } catch (error) {
            console.error('Error deleting asset:', error);
            if (window.showToast) {
                window.showToast('حدث خطأ أثناء حذف الأصل', 'error');
            } else {
                alert('حدث خطأ أثناء حذف الأصل');
            }
            return;
        }
    } else {
        assets = assets.filter(a => a.id !== assetId);
        await saveAssets();
    }
    
    currentPage = 1;
    applyFilters();
}

// Render Assets
// Apply Filters
function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const categoryFilter = document.getElementById('categoryFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    
    filteredAssets = assets.filter(asset => {
        const matchesSearch = !searchTerm || 
            asset.code.toLowerCase().includes(searchTerm) ||
            asset.name.toLowerCase().includes(searchTerm);
        
        const matchesCategory = !categoryFilter || asset.category === categoryFilter;
        const matchesStatus = !statusFilter || asset.status === statusFilter;
        
        return matchesSearch && matchesCategory && matchesStatus;
    });
    
    // Render paginated assets
    renderAssets();
}

function renderAssets() {
    const tbody = document.getElementById('assetsTableBody');
    const emptyState = document.getElementById('emptyState');
    const paginationContainer = document.getElementById('paginationContainer');
    
    tbody.innerHTML = '';
    
    if (filteredAssets.length === 0) {
        emptyState.classList.remove('hidden');
        paginationContainer.classList.add('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    paginationContainer.classList.remove('hidden');

    // Calculate pagination
    const totalPages = Math.ceil(filteredAssets.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredAssets.length);
    const paginatedAssets = filteredAssets.slice(startIndex, endIndex);
    
    // Update pagination info
    document.getElementById('paginationInfo').textContent = 
        `عرض ${startIndex + 1} - ${endIndex} من ${filteredAssets.length}`;
    
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
    
    tbody.innerHTML = '';
    paginatedAssets.forEach(asset => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${asset.code}</td>
            <td class="asset-name-cell"><strong>${asset.name}</strong></td>
            <td><span class="category-badge">${CATEGORY_NAMES[asset.category] || asset.category}</span></td>
            <td>${formatDate(asset.purchaseDate)}</td>
            <td>${formatCurrency(asset.purchasePrice)}</td>
            <td>${formatCurrency(asset.currentValue || asset.purchasePrice)}</td>
            <td>${asset.depreciationRate || 0}%</td>
            <td>${asset.location || '-'}${asset.department ? ` / ${asset.department}` : ''}</td>
            <td><span class="status-badge ${asset.status}">${STATUS_NAMES[asset.status] || asset.status}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn-action view" data-asset-id="${asset.id}">
                        👁️
                    </button>
                    <button class="btn-action edit" data-asset-id="${asset.id}">
                        ✏️
                    </button>
                    <button class="btn-action delete" data-asset-id="${asset.id}">
                        🗑️
                    </button>
                </div>
            </td>
        `;
        
        // Add event listeners to buttons
        const viewBtn = row.querySelector('.btn-action.view');
        const editBtn = row.querySelector('.btn-action.edit');
        const deleteBtn = row.querySelector('.btn-action.delete');
        
        if (viewBtn) {
            viewBtn.addEventListener('click', () => viewAssetDetails(asset.id));
        }
        if (editBtn) {
            editBtn.addEventListener('click', () => openEditModal(asset.id));
        }
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => deleteAsset(asset.id));
        }
        
        tbody.appendChild(row);
    });
}

// Format Date
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

// Format Currency
function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '0.00 ج.م';
    return parseFloat(amount).toFixed(2) + ' ج.م';
}

// Show Total Assets
function showTotalAssets() {
    const totalPurchasePrice = assets.reduce((sum, asset) => {
        return sum + (parseFloat(asset.purchasePrice) || 0);
    }, 0);
    
    const totalCurrentValue = assets.reduce((sum, asset) => {
        return sum + (parseFloat(asset.currentValue || asset.purchasePrice) || 0);
    }, 0);
    
    const totalDepreciation = totalPurchasePrice - totalCurrentValue;
    const depreciationPercentage = totalPurchasePrice > 0 
        ? ((totalDepreciation / totalPurchasePrice) * 100).toFixed(2) 
        : 0;
    
    const message = `
        <div style="text-align: right; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 20px;">
            <h2 style="color: #8b4513; margin-bottom: 20px; font-size: 1.5rem;">📊 ملخص أصول الشركة</h2>
            <div style="background: #f8fafc; padding: 20px; border-radius: 12px; margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 1.1rem;">
                    <span style="font-weight: 600; color: #1e293b;">إجمالي سعر الشراء:</span>
                    <span style="font-weight: 700; color: #8b4513;">${formatCurrency(totalPurchasePrice)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 1.1rem;">
                    <span style="font-weight: 600; color: #1e293b;">إجمالي القيمة الحالية:</span>
                    <span style="font-weight: 700; color: #10b981;">${formatCurrency(totalCurrentValue)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 1.1rem;">
                    <span style="font-weight: 600; color: #1e293b;">إجمالي الاستهلاك:</span>
                    <span style="font-weight: 700; color: #f59e0b;">${formatCurrency(totalDepreciation)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 1.1rem;">
                    <span style="font-weight: 600; color: #1e293b;">نسبة الاستهلاك:</span>
                    <span style="font-weight: 700; color: #ef4444;">${depreciationPercentage}%</span>
                </div>
            </div>
            <div style="background: #e0e7ff; padding: 15px; border-radius: 12px; text-align: center;">
                <span style="font-weight: 600; color: #3730a3;">عدد الأصول: <strong>${assets.length}</strong></span>
            </div>
        </div>
    `;
    
    // Create a modal-like alert
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        border-radius: 16px;
        max-width: 500px;
        width: 100%;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        position: relative;
    `;
    
    content.innerHTML = message + `
        <div style="padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
            <button id="closeTotalModal" style="
                padding: 12px 30px;
                background: linear-gradient(135deg, #8b4513 0%, #cd853f 50%, #dc2626 100%);
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
            ">إغلاق</button>
        </div>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    document.getElementById('closeTotalModal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
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
                    email: companyInfo.email || ''
                };
            }
        }
    } catch (error) {
        console.error('Error getting company settings:', error);
    }
    return {
        name: 'شركة أسيل',
        address: '',
        phone: '',
        email: ''
    };
}

// Generate Assets Report HTML
async function generateAssetsReportHTML() {
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
    
    const totalPurchasePrice = assets.reduce((sum, asset) => {
        return sum + (parseFloat(asset.purchasePrice) || 0);
    }, 0);
    
    const totalCurrentValue = assets.reduce((sum, asset) => {
        return sum + (parseFloat(asset.currentValue || asset.purchasePrice) || 0);
    }, 0);
    
    const totalDepreciation = totalPurchasePrice - totalCurrentValue;
    const depreciationPercentage = totalPurchasePrice > 0 
        ? ((totalDepreciation / totalPurchasePrice) * 100).toFixed(2) 
        : 0;
    
    // Group assets by category
    const assetsByCategory = {};
    assets.forEach(asset => {
        const category = CATEGORY_NAMES[asset.category] || asset.category;
        if (!assetsByCategory[category]) {
            assetsByCategory[category] = [];
        }
        assetsByCategory[category].push(asset);
    });
    
    const today = new Date().toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    let assetsTableRows = '';
    assets.forEach((asset, index) => {
        assetsTableRows += `
            <tr>
                <td style="text-align: center; padding: 10px; border: 1px solid #e2e8f0;">${index + 1}</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0;">${asset.code || '-'}</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0;">${asset.name || '-'}</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0;">${CATEGORY_NAMES[asset.category] || asset.category || '-'}</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0;">${formatDate(asset.purchaseDate)}</td>
                <td style="text-align: left; padding: 10px; border: 1px solid #e2e8f0;">${formatCurrency(asset.purchasePrice)}</td>
                <td style="text-align: left; padding: 10px; border: 1px solid #e2e8f0;">${formatCurrency(asset.currentValue || asset.purchasePrice)}</td>
                <td style="text-align: center; padding: 10px; border: 1px solid #e2e8f0;">${asset.depreciationRate || 0}%</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0;">${STATUS_NAMES[asset.status] || asset.status || '-'}</td>
            </tr>
        `;
    });
    
    const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>تقرير أصول الشركة</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Cairo', sans-serif;
            padding: 40px;
            background: #f8fafc;
            color: #1e293b;
            line-height: 1.6;
        }
        .report-container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            max-width: 1200px;
            margin: 0 auto;
        }
        .report-header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 3px solid #8b4513;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;
        }
        .company-logo {
            width: 80px;
            height: 80px;
            object-fit: contain;
            flex-shrink: 0;
        }
        .report-header-content {
            flex: 1;
        }
        .report-header h1 {
            color: #8b4513;
            font-size: 2rem;
            margin-bottom: 10px;
            font-weight: 700;
        }
        .report-header p {
            color: #64748b;
            font-size: 1rem;
        }
        .summary-section {
            background: #f8fafc;
            padding: 25px;
            border-radius: 12px;
            margin-bottom: 30px;
            border: 2px solid #e2e8f0;
        }
        .summary-section h2 {
            color: #8b4513;
            font-size: 1.5rem;
            margin-bottom: 20px;
            font-weight: 700;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
        }
        .summary-item {
            background: white;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
        }
        .summary-item label {
            display: block;
            color: #64748b;
            font-size: 0.875rem;
            margin-bottom: 8px;
            font-weight: 600;
        }
        .summary-item .value {
            color: #1e293b;
            font-size: 1.25rem;
            font-weight: 700;
        }
        .assets-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 30px;
            font-size: 0.875rem;
        }
        .assets-table thead {
            background: linear-gradient(135deg, #8b4513 0%, #cd853f 100%);
            color: white;
        }
        .assets-table th {
            padding: 15px;
            text-align: right;
            font-weight: 700;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .assets-table td {
            padding: 10px;
            border: 1px solid #e2e8f0;
        }
        .assets-table tbody tr:nth-child(even) {
            background: #f8fafc;
        }
        .assets-table tbody tr:hover {
            background: #f1f5f9;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #e2e8f0;
            text-align: center;
            color: #64748b;
            font-size: 0.875rem;
        }
        @media print {
            body {
                background: white;
                padding: 20px;
            }
            .report-container {
                box-shadow: none;
            }
        }
    </style>
</head>
<body>
    <div class="report-container">
        <div class="report-header">
            <img src="${logoBase64 || logoPath}" alt="Logo" class="company-logo" />
            <div class="report-header-content">
                <h1>🏛️ تقرير أصول الشركة</h1>
                <p>${companySettings.name || 'شركة أسيل'}</p>
                <p>تاريخ التقرير: ${today}</p>
            </div>
        </div>
        
        <div class="summary-section">
            <h2>📊 الملخص الإجمالي</h2>
            <div class="summary-grid">
                <div class="summary-item">
                    <label>إجمالي سعر الشراء</label>
                    <div class="value" style="color: #8b4513;">${formatCurrency(totalPurchasePrice)}</div>
                </div>
                <div class="summary-item">
                    <label>إجمالي القيمة الحالية</label>
                    <div class="value" style="color: #10b981;">${formatCurrency(totalCurrentValue)}</div>
                </div>
                <div class="summary-item">
                    <label>إجمالي الاستهلاك</label>
                    <div class="value" style="color: #f59e0b;">${formatCurrency(totalDepreciation)}</div>
                </div>
                <div class="summary-item">
                    <label>نسبة الاستهلاك</label>
                    <div class="value" style="color: #ef4444;">${depreciationPercentage}%</div>
                </div>
                <div class="summary-item">
                    <label>عدد الأصول</label>
                    <div class="value" style="color: #3b82f6;">${assets.length}</div>
                </div>
            </div>
        </div>
        
        <h2 style="color: #8b4513; margin-bottom: 20px; font-size: 1.5rem; font-weight: 700;">📋 تفاصيل الأصول</h2>
        <table class="assets-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>كود الأصل</th>
                    <th>اسم الأصل</th>
                    <th>الصنف</th>
                    <th>تاريخ الشراء</th>
                    <th>سعر الشراء</th>
                    <th>القيمة الحالية</th>
                    <th>معدل الاستهلاك</th>
                    <th>الحالة</th>
                </tr>
            </thead>
            <tbody>
                ${assetsTableRows}
            </tbody>
        </table>
        
        <div class="footer">
            <p>تم إنشاء هذا التقرير تلقائياً بواسطة نظام أسيل لإدارة الشركة</p>
            <p>© 2025 نظام أسيل — تم التطوير بواسطة المهندس محمد محسن. جميع الحقوق محفوظة.</p>
        </div>
    </div>
</body>
</html>
    `;
    
    return html;
}

// Save Report as PDF
async function saveReportAsPDF() {
    try {
        const htmlContent = await generateAssetsReportHTML();
        const filename = `تقرير_أصول_الشركة_${new Date().toISOString().split('T')[0]}.pdf`;
        
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
                window.showToast('وظيفة حفظ PDF غير متاحة في المتصفح. يرجى استخدام المتصفح لإلغاء الإلغاء والضغط على "حفظ كـ PDF"', 'error');
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

// Print Report (print only)
async function printReport() {
    try {
        const htmlContent = await generateAssetsReportHTML();
        
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
            window.showToast('حدث خطأ أثناء الطباعة: ' + error.message, 'error');
        } else {
            alert('❌ حدث خطأ أثناء الطباعة: ' + error.message);
        }
    }
}

