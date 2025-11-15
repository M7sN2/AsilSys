// Delivery Settlements Management System (نظام إدارة التسويات)

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

// Format currency with Arabic numerals
function formatCurrency(amount, currency = 'ج.م', decimals = 2) {
    return formatArabicNumber(amount, decimals) + ' ' + currency;
}

// Initialize
let settlements = [];
let deliveryNotes = [];
let currentSettlement = null;
let settlementItems = [];

// Pagination & Filter State
let currentPage = 1;
const itemsPerPage = 20;
let filteredSettlements = [];
let searchQuery = '';
let dateFrom = '';
let dateTo = '';
let sortBy = 'date-desc';

// Load data on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    initializeEventListeners();
    renderDeliveryNotes();
    applyFilters();
});

// Initialize Event Listeners
function initializeEventListeners() {
    // New Settlement Button
    const newSettlementBtn = document.getElementById('newSettlementBtn');
    if (newSettlementBtn) {
        newSettlementBtn.addEventListener('click', openNewSettlement);
    }
    
    // Empty state button
    const emptyStateBtn = document.getElementById('emptyStateAddBtn');
    if (emptyStateBtn) {
        emptyStateBtn.addEventListener('click', () => {
            if (newSettlementBtn) {
                newSettlementBtn.click();
            }
        });
    }

    // Modal Close
    const closeModal = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    if (closeModal) closeModal.addEventListener('click', closeModalHandler);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModalHandler);

    // Close modal on backdrop click
    const settlementModal = document.getElementById('settlementModal');
    if (settlementModal) {
        settlementModal.addEventListener('click', (e) => {
            if (e.target.id === 'settlementModal') {
                closeModalHandler();
            }
        });
    }

    // Form Submit
    const settlementForm = document.getElementById('settlementForm');
    if (settlementForm) {
        settlementForm.addEventListener('submit', handleFormSubmit);
    }

    // Setup Delivery Note Search
    setupDeliveryNoteSearch();

    // Set today's date as default
    const dateInput = document.getElementById('settlementDate');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    }

    // Pagination Event Listeners
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                applyFilters();
            }
        });
    }
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(filteredSettlements.length / itemsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                applyFilters();
            }
        });
    }

    // Search & Filter Event Listeners
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const dateFromInput = document.getElementById('dateFrom');
    const dateToInput = document.getElementById('dateTo');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            currentPage = 1;
            applyFilters();
        });
    }

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            searchQuery = '';
            currentPage = 1;
            applyFilters();
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

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (dateFromInput) dateFromInput.value = '';
            if (dateToInput) dateToInput.value = '';
            searchQuery = '';
            dateFrom = '';
            dateTo = '';
            currentPage = 1;
            applyFilters();
        });
    }
}

// Load Data
async function loadData() {
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            settlements = await window.electronAPI.dbGetAll('delivery_settlements', '', []);
            // Load all delivery notes (including settled ones for checking)
            deliveryNotes = await window.electronAPI.dbGetAll('delivery_notes', '', []);
            
            settlements = Array.isArray(settlements) ? settlements : [];
            deliveryNotes = Array.isArray(deliveryNotes) ? deliveryNotes : [];
            
            // Load settlement items for each settlement
            for (let settlement of settlements) {
                if (!settlement.items) {
                    const settlementItems = await window.electronAPI.dbGetAll('settlement_items', 'settlementId = ?', [settlement.id]);
                    settlement.items = (settlementItems || []).map(item => ({
                        productId: item.productId,
                        productName: item.productName,
                        productCode: item.productCode || '',
                        issuedQuantity: item.issuedQuantity || 0,
                        soldQuantity: item.soldQuantity || 0,
                        returnedQuantity: item.returnedQuantity || 0,
                        rejectedQuantity: item.rejectedQuantity || 0,
                        difference: item.difference || 0,
                        unit: item.unit || '',
                        notes: item.notes || ''
                    }));
                }
            }
            
            // Load note items for each delivery note
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
            console.error('Error loading from database:', error);
        }
    }
}

// Generate Settlement Number
async function generateSettlementNumber() {
    const year = new Date().getFullYear();
    const prefix = `STL-${year}-`;
    
    // Try to get counter from database first (more reliable)
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            // Get all settlements from database
            const allSettlements = await window.electronAPI.dbGetAll('delivery_settlements', '', []);
            
            if (allSettlements && allSettlements.length > 0) {
                // Filter settlements with numbers matching current year pattern
                const currentYearNumbers = allSettlements
                    .map(settlement => settlement.settlementNumber)
                    .filter(number => number && number.startsWith(prefix));
                
                // Extract numbers from settlement numbers (e.g., "STL-2025-001" -> 1)
                const numbers = currentYearNumbers.map(number => {
                    const match = number.match(new RegExp(`${prefix}(\\d+)`));
                    return match ? parseInt(match[1]) : 0;
                });
                
                // Get maximum number
                const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
                const counter = maxNumber + 1;
                
                // Save to localStorage as backup
                localStorage.setItem('asel_settlement_counter', counter.toString());
                
                return `${prefix}${String(counter).padStart(3, '0')}`;
            }
        } catch (error) {
            console.error('Error generating settlement number from database:', error);
            // Fallback to localStorage
        }
    }
    
    // Fallback: use localStorage counter
    let counter = parseInt(localStorage.getItem('asel_settlement_counter') || '0');
    counter++;
    localStorage.setItem('asel_settlement_counter', counter.toString());
    
    return `${prefix}${String(counter).padStart(3, '0')}`;
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

// Render Delivery Notes (for compatibility)
function renderDeliveryNotes() {
    // This function is kept for compatibility but search is handled by setupDeliveryNoteSearch
    const searchInput = document.getElementById('deliveryNoteSearch');
    const hiddenInput = document.getElementById('deliveryNoteSelect');
    
    if (searchInput && hiddenInput) {
        searchInput.value = '';
        hiddenInput.value = '';
    }
}

// On Delivery Note Change
async function onDeliveryNoteChange() {
    const hiddenInput = document.getElementById('deliveryNoteSelect');
    const deliveryNoteId = hiddenInput ? hiddenInput.value : null;
    
    if (!deliveryNoteId) {
        settlementItems = [];
        renderSettlementItems();
        return;
    }
    
    const deliveryNote = deliveryNotes.find(n => n.id === deliveryNoteId);
    if (!deliveryNote) {
        showMessage('إذن الصرف غير موجود', 'error');
        return;
    }
    
    // Check if note is already settled
    if (deliveryNote.status === 'settled') {
        showMessage('لا يمكن عمل تسوية لإذن صرف تمت تسويته بالفعل', 'error');
        // Clear selection
        const searchInput = document.getElementById('deliveryNoteSearch');
        const hiddenInput = document.getElementById('deliveryNoteSelect');
        if (searchInput) searchInput.value = '';
        if (hiddenInput) hiddenInput.value = '';
        settlementItems = [];
        renderSettlementItems();
        return;
    }
    
    // Check if settlement already exists for this delivery note
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        const existingSettlements = await window.electronAPI.dbGetAll('delivery_settlements', 'deliveryNoteId = ?', [deliveryNoteId]);
        if (existingSettlements && existingSettlements.length > 0) {
            showMessage('تم عمل تسوية لهذا إذن الصرف بالفعل', 'error');
            // Clear selection
            const searchInput = document.getElementById('deliveryNoteSearch');
            const hiddenInput = document.getElementById('deliveryNoteSelect');
            if (searchInput) searchInput.value = '';
            if (hiddenInput) hiddenInput.value = '';
            settlementItems = [];
            renderSettlementItems();
            return;
        }
    }
    
    // Load note items if not loaded
    if (!deliveryNote.items) {
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            const noteItems = await window.electronAPI.dbGetAll('delivery_note_items', 'deliveryNoteId = ?', [deliveryNoteId]);
            deliveryNote.items = (noteItems || []).map(item => ({
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
    
    // Load all invoices linked to this delivery note
    let linkedInvoices = [];
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        linkedInvoices = await window.electronAPI.dbGetAll('sales_invoices', 'deliveryNoteId = ?', [deliveryNoteId]);
        
        // Check if all invoices are delivered (required for settlement)
        // Consider invoices without status as delivered (for backward compatibility)
        const pendingInvoices = linkedInvoices.filter(invoice => invoice.status && invoice.status !== 'delivered');
        if (pendingInvoices.length > 0) {
            const pendingInvoiceNumbers = pendingInvoices.map(inv => inv.invoiceNumber || inv.id).join(', ');
            showMessage(`لا يمكن عمل تسوية إلا بعد تغيير حالة جميع الفواتير إلى "تم التسليم". الفواتير المعلقة: ${pendingInvoiceNumbers}`, 'error');
            // Clear selection
            const searchInput = document.getElementById('deliveryNoteSearch');
            const hiddenInput = document.getElementById('deliveryNoteSelect');
            if (searchInput) searchInput.value = '';
            if (hiddenInput) hiddenInput.value = '';
            settlementItems = [];
            renderSettlementItems();
            return;
        }
        
        // Load invoice items for each invoice
        for (let invoice of linkedInvoices) {
            if (!invoice.items) {
                const invoiceItems = await window.electronAPI.dbGetAll('sales_invoice_items', 'invoiceId = ?', [invoice.id]);
                invoice.items = invoiceItems || [];
            }
        }
    }
    
    // Calculate sold quantities from invoices
    settlementItems = [];
    for (const noteItem of deliveryNote.items) {
        // Calculate sold quantity from all linked invoices
        let soldQuantity = 0;
        for (const invoice of linkedInvoices) {
            if (invoice.items) {
                const invoiceItem = invoice.items.find(item => 
                    item.productId === noteItem.productId && item.unit === noteItem.unit
                );
                if (invoiceItem) {
                    soldQuantity += invoiceItem.quantity || 0;
                }
            }
        }
        
        settlementItems.push({
            productId: noteItem.productId,
            productName: noteItem.productName,
            productCode: noteItem.productCode || '',
            issuedQuantity: noteItem.quantity || 0,
            soldQuantity: soldQuantity,
            returnedQuantity: 0,
            rejectedQuantity: 0,
            difference: 0,
            unit: noteItem.unit || '',
            unitName: noteItem.unitName || ''
        });
    }
    
    // Auto-calculate differences
    calculateDifferences();
    renderSettlementItems();
    
    // Set warehouse keeper name from delivery note (readonly)
    const warehouseKeeperNameInput = document.getElementById('warehouseKeeperName');
    if (warehouseKeeperNameInput) {
        warehouseKeeperNameInput.value = deliveryNote.warehouseKeeperName || deliveryNote.salesRepName || '';
    }
    
    // Load sales rep name from company_info as default (can be edited)
    const salesRepNameInput = document.getElementById('salesRepName');
    if (salesRepNameInput) {
        try {
            const companySettings = await getCompanySettings();
            salesRepNameInput.value = companySettings.salesRepName || '';
        } catch (error) {
            console.error('Error loading sales rep name:', error);
            salesRepNameInput.value = '';
        }
    }
}

// Calculate Differences
function calculateDifferences() {
    settlementItems.forEach(item => {
        // Calculate difference: issued - sold (without returned and rejected)
        item.difference = item.issuedQuantity - item.soldQuantity;
    });
    renderSettlementItems();
}

// Render Settlement Items
function renderSettlementItems() {
    const tbody = document.getElementById('settlementItemsBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    settlementItems.forEach((item, index) => {
        const row = document.createElement('tr');
        const differenceClass = item.difference > 0 ? 'warning' : item.difference < 0 ? 'error' : 'success';
        
        row.innerHTML = `
            <td>${item.productName} (${item.productCode})</td>
            <td>${formatArabicNumber(item.issuedQuantity)}</td>
            <td>${formatArabicNumber(item.soldQuantity)}</td>
            <td class="${differenceClass}">${formatArabicNumber(item.difference)}</td>
            <td>${item.unitName || item.unit}</td>
            <td>
                <button type="button" onclick="removeSettlementItem(${index})" 
                        class="btn btn-danger btn-sm" title="حذف الصف" 
                        style="padding: 4px 8px; font-size: 12px;">🗑️</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Update Returned Quantity
function updateReturnedQuantity(index, value, inputElement = null) {
    // Allow empty value (treat as 0)
    const quantity = value === '' || value === null || value === undefined ? 0 : parseFloat(value) || 0;
    if (quantity < 0) {
        showMessage('الكمية المرتجعة لا يمكن أن تكون سالبة', 'error');
        // Reset to 0 if negative
        if (inputElement) {
            inputElement.value = '';
            settlementItems[index].returnedQuantity = 0;
        }
        calculateDifferences();
        return;
    }
    settlementItems[index].returnedQuantity = quantity;
    calculateDifferences();
}

// Update Rejected Quantity
function updateRejectedQuantity(index, value, inputElement = null) {
    // Allow empty value (treat as 0)
    const quantity = value === '' || value === null || value === undefined ? 0 : parseFloat(value) || 0;
    if (quantity < 0) {
        showMessage('الكمية المرفوضة لا يمكن أن تكون سالبة', 'error');
        // Reset to 0 if negative
        if (inputElement) {
            inputElement.value = '';
            settlementItems[index].rejectedQuantity = 0;
        }
        calculateDifferences();
        return;
    }
    settlementItems[index].rejectedQuantity = quantity;
    calculateDifferences();
}

// Clear Returned Quantity
function clearReturnedQuantity(index) {
    settlementItems[index].returnedQuantity = 0;
    calculateDifferences();
}

// Clear Rejected Quantity
function clearRejectedQuantity(index) {
    settlementItems[index].rejectedQuantity = 0;
    calculateDifferences();
}

// Remove Settlement Item
function removeSettlementItem(index) {
    if (confirm('هل أنت متأكد من حذف هذا المنتج من التسوية؟')) {
        settlementItems.splice(index, 1);
        renderSettlementItems();
        calculateDifferences();
    }
}

// Open New Settlement
async function openNewSettlement() {
    currentSettlement = null;
    settlementItems = [];
    const isEdit = document.getElementById('isEdit');
    const settlementId = document.getElementById('settlementId');
    const modalTitle = document.getElementById('modalTitle');
    const settlementForm = document.getElementById('settlementForm');
    
    if (isEdit) isEdit.value = 'false';
    if (settlementId) settlementId.value = '';
    if (modalTitle) modalTitle.textContent = 'تسوية جديدة';
    if (settlementForm) settlementForm.reset();
    
    const settlementItemsBody = document.getElementById('settlementItemsBody');
    if (settlementItemsBody) settlementItemsBody.innerHTML = '';
    
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('settlementDate');
    if (dateInput) dateInput.value = today;
    
    const searchInput = document.getElementById('deliveryNoteSearch');
    const hiddenInput = document.getElementById('deliveryNoteSelect');
    if (searchInput) searchInput.value = '';
    if (hiddenInput) hiddenInput.value = '';
    
    // Load sales rep name from company_info as default (can be edited)
    const salesRepNameInput = document.getElementById('salesRepName');
    if (salesRepNameInput) {
        try {
            const companySettings = await getCompanySettings();
            salesRepNameInput.value = companySettings.salesRepName || '';
        } catch (error) {
            console.error('Error loading sales rep name:', error);
            salesRepNameInput.value = '';
        }
    }
    
    renderDeliveryNotes();
    setupDeliveryNoteSearch();
    
    const settlementModal = document.getElementById('settlementModal');
    if (settlementModal) settlementModal.classList.add('active');
}

// Handle Form Submit
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const hiddenInput = document.getElementById('deliveryNoteSelect');
    const deliveryNoteId = hiddenInput ? hiddenInput.value : null;
    const date = document.getElementById('settlementDate').value;
    const salesRepName = document.getElementById('salesRepName').value;
    
    if (!deliveryNoteId) {
        showMessage('يرجى اختيار إذن الصرف', 'error');
        return;
    }
    
    if (!date) {
        showMessage('يرجى إدخال تاريخ التسوية', 'error');
        return;
    }
    
    if (!salesRepName || !salesRepName.trim()) {
        showMessage('يرجى إدخال اسم المندوب', 'error');
        return;
    }
    
    if (settlementItems.length === 0) {
        showMessage('لا توجد عناصر للتسوية', 'error');
        return;
    }
    
    const deliveryNote = deliveryNotes.find(n => n.id === deliveryNoteId);
    if (!deliveryNote) {
        showMessage('إذن الصرف غير موجود', 'error');
        return;
    }
    
    // Check if note is already settled
    if (deliveryNote.status === 'settled') {
        showMessage('لا يمكن عمل تسوية لإذن صرف تمت تسويته بالفعل', 'error');
        return;
    }
    
    // Check if settlement already exists for this delivery note (if not editing)
    if (!currentSettlement) {
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            const existingSettlements = await window.electronAPI.dbGetAll('delivery_settlements', 'deliveryNoteId = ?', [deliveryNoteId]);
            if (existingSettlements && existingSettlements.length > 0) {
                showMessage('تم عمل تسوية لهذا إذن الصرف بالفعل', 'error');
                return;
            }
        }
    }
    
    // Check if all invoices linked to this delivery note are delivered (required for settlement)
    let linkedInvoices = [];
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        linkedInvoices = await window.electronAPI.dbGetAll('sales_invoices', 'deliveryNoteId = ?', [deliveryNoteId]);
        
        // Consider invoices without status as delivered (for backward compatibility)
        const pendingInvoices = linkedInvoices.filter(invoice => invoice.status && invoice.status !== 'delivered');
        if (pendingInvoices.length > 0) {
            const pendingInvoiceNumbers = pendingInvoices.map(inv => inv.invoiceNumber || inv.id).join(', ');
            showMessage(`لا يمكن عمل تسوية إلا بعد تغيير حالة جميع الفواتير إلى "تم التسليم". الفواتير المعلقة: ${pendingInvoiceNumbers}`, 'error');
            return;
        }
    }
    
    const settlementId = currentSettlement ? currentSettlement.id : Date.now().toString();
    
    const settlementData = {
        id: settlementId,
        settlementNumber: currentSettlement ? currentSettlement.settlementNumber : await generateSettlementNumber(),
        deliveryNoteId: deliveryNoteId,
        date: date,
        salesRepId: deliveryNote.salesRepId || '',
        salesRepName: salesRepName.trim(),
        warehouseKeeperName: deliveryNote.warehouseKeeperName || deliveryNote.salesRepName || '', // From delivery note
        status: 'completed',
        notes: document.getElementById('notes').value || '',
        createdAt: currentSettlement ? currentSettlement.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    try {
        // Save to database
        if (window.electronAPI && window.electronAPI.dbInsert && window.electronAPI.dbUpdate) {
            const settlementDbData = { ...settlementData };
            delete settlementDbData.items;
            
            if (currentSettlement) {
                // Update existing settlement
                const updateResult = await window.electronAPI.dbUpdate('delivery_settlements', settlementId, settlementDbData);
                
                // Check if update was successful
                if (!updateResult || !updateResult.success) {
                    const errorMsg = updateResult?.error || 'خطأ غير معروف';
                    console.error('Failed to update settlement in database:', errorMsg);
                    throw new Error('فشل تحديث التسوية في قاعدة البيانات: ' + errorMsg);
                }
                
                // Delete old items
                if (window.electronAPI.dbQuery) {
                    await window.electronAPI.dbQuery('DELETE FROM settlement_items WHERE settlementId = ?', [settlementId]);
                } else {
                    const oldItems = await window.electronAPI.dbGetAll('settlement_items', 'settlementId = ?', [settlementId]);
                    for (const item of oldItems) {
                        await window.electronAPI.dbDelete('settlement_items', item.id);
                    }
                }
            } else {
                // Insert new settlement
                // Add createdBy to track who created this settlement
                if (!settlementDbData.createdBy) {
                    if (typeof addCreatedBy === 'function') {
                        addCreatedBy(settlementDbData);
                    } else {
                        const currentUser = localStorage.getItem('asel_user') || localStorage.getItem('asel_userId') || '';
                        if (currentUser) {
                            settlementDbData.createdBy = currentUser;
                        }
                    }
                }
                
                const insertResult = await window.electronAPI.dbInsert('delivery_settlements', settlementDbData);
                
                // Check if insert was successful
                if (!insertResult || !insertResult.success) {
                    const errorMsg = insertResult?.error || 'خطأ غير معروف';
                    console.error('Failed to insert settlement to database:', errorMsg);
                    throw new Error('فشل حفظ التسوية في قاعدة البيانات: ' + errorMsg);
                }
            }
            
            // Save settlement items
            for (const item of settlementItems) {
                const itemData = {
                    id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
                    settlementId: settlementId,
                    productId: item.productId,
                    productName: item.productName,
                    productCode: item.productCode || '',
                    issuedQuantity: item.issuedQuantity || 0,
                    soldQuantity: item.soldQuantity || 0,
                    returnedQuantity: item.returnedQuantity || 0,
                    rejectedQuantity: item.rejectedQuantity || 0,
                    difference: item.difference || 0,
                    unit: item.unit || '',
                    notes: item.notes || ''
                };
                const itemInsertResult = await window.electronAPI.dbInsert('settlement_items', itemData);
                
                // Check if item insert was successful
                if (!itemInsertResult || !itemInsertResult.success) {
                    const errorMsg = itemInsertResult?.error || 'خطأ غير معروف';
                    console.error('Failed to insert settlement item to database:', errorMsg);
                    throw new Error('فشل حفظ عنصر التسوية في قاعدة البيانات: ' + errorMsg);
                }
                
                // Update product stock: deduct sold quantities (stock moves to sales rep's responsibility)
                // Add back returned and rejected quantities to stock
                await updateProductStockFromSettlement(item);
            }
            
            // Reload delivery note from database to get latest data before updating
            let deliveryNoteToUpdate = null;
            if (window.electronAPI && window.electronAPI.dbGet) {
                try {
                    deliveryNoteToUpdate = await window.electronAPI.dbGet('delivery_notes', deliveryNoteId);
                } catch (error) {
                    console.error('Error loading delivery note for update:', error);
                    // Fallback to local deliveryNote
                    deliveryNoteToUpdate = deliveryNote;
                }
            } else {
                deliveryNoteToUpdate = deliveryNote;
            }
            
            // Update delivery note status to 'settled'
            if (deliveryNoteToUpdate) {
                const updateData = {
                    ...deliveryNoteToUpdate,
                    status: 'settled',
                    updatedAt: new Date().toISOString()
                };
                
                const updateResult = await window.electronAPI.dbUpdate('delivery_notes', deliveryNoteId, updateData);
                
                // Check if update was successful
                if (updateResult && updateResult.success === false) {
                    console.error('Failed to update delivery note status:', updateResult);
                    throw new Error(`فشل تحديث حالة إذن الصرف: ${updateResult.error || 'خطأ غير معروف'}`);
                }
                
                // Update local array
                const localNoteIndex = deliveryNotes.findIndex(n => n.id === deliveryNoteId);
                if (localNoteIndex !== -1) {
                    deliveryNotes[localNoteIndex] = updateData;
                }
            }
        }
        
        // Update local array
        if (currentSettlement) {
            const index = settlements.findIndex(s => s.id === currentSettlement.id);
            if (index !== -1) {
                settlements[index] = { ...settlementData, items: settlementItems };
            }
        } else {
            settlements.push({ ...settlementData, items: settlementItems });
        }
        
        // Reload from database
        await loadData();
        
        currentPage = 1;
        applyFilters();
        
        closeModalHandler();
        showMessage('تم حفظ التسوية بنجاح', 'success');
    } catch (error) {
        console.error('Error saving settlement:', error);
        showMessage('خطأ في حفظ التسوية: ' + error.message, 'error');
    }
}

// Update Product Stock from Settlement
// Deduct sold quantities (stock moves to sales rep's responsibility)
// Add back returned and rejected quantities to stock
async function updateProductStockFromSettlement(settlementItem) {
    try {
        let product = null;
        if (window.electronAPI && window.electronAPI.dbGet) {
            product = await window.electronAPI.dbGet('products', settlementItem.productId);
        }
        
        if (!product) {
            console.error('Product not found:', settlementItem.productId);
            return;
        }
        
        // Calculate quantities in smallest unit
        let issuedQty = settlementItem.issuedQuantity || 0; // المصروف
        let soldQty = settlementItem.soldQuantity || 0;
        let returnedQty = settlementItem.returnedQuantity || 0;
        let rejectedQty = settlementItem.rejectedQuantity || 0;
        
        if (settlementItem.unit === 'largest') {
            const conversionFactor = product.conversionFactor || 1;
            issuedQty = issuedQty * conversionFactor;
            soldQty = soldQty * conversionFactor;
            returnedQty = returnedQty * conversionFactor;
            rejectedQty = rejectedQty * conversionFactor;
        }
        
        // Calculate remaining quantity (difference) = issued - sold - returned - rejected
        // This is the quantity that was not sold and should be returned to stock
        const remainingQty = issuedQty - soldQty - returnedQty - rejectedQty;
        
        // Net change: add back remaining quantity (difference) + returned + rejected
        // Note: Stock was already deducted when delivery note was created, so we only add back what wasn't sold
        const netChange = remainingQty + returnedQty + rejectedQty;
        
        if (netChange !== 0) {
            // Update stock
            const currentStock = parseFloat(product.stock) || 0;
            const newStock = Math.max(0, currentStock + netChange);
            
            product.stock = newStock;
            
            // Update product in database
            if (window.electronAPI && window.electronAPI.dbUpdate) {
                await window.electronAPI.dbUpdate('products', product.id, product);
                console.log(`Updated product ${product.name} stock: ${currentStock} -> ${newStock} (issued: ${issuedQty}, sold: ${soldQty}, returned: +${returnedQty}, rejected: +${rejectedQty}, remaining: +${remainingQty})`);
            }
        }
    } catch (error) {
        console.error('Error updating product stock from settlement:', error);
    }
}

// Apply Filters
function applyFilters() {
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
    
    // Start with all settlements
    filteredSettlements = [...settlements];
    
    // Apply search filter
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredSettlements = filteredSettlements.filter(settlement => {
            // Search by settlement number
            const settlementNumber = (settlement.settlementNumber || '').toLowerCase();
            if (settlementNumber.includes(query)) return true;
            
            // Search by sales rep name
            const salesRepName = (settlement.salesRepName || '').toLowerCase();
            if (salesRepName.includes(query)) return true;
            
            return false;
        });
    }
    
    // Apply date range filter (use effectiveDateFrom and effectiveDateTo)
    if (effectiveDateFrom) {
        filteredSettlements = filteredSettlements.filter(settlement => {
            return new Date(settlement.date) >= new Date(effectiveDateFrom);
        });
    }
    
    if (effectiveDateTo) {
        filteredSettlements = filteredSettlements.filter(settlement => {
            const settlementDate = new Date(settlement.date);
            const toDate = new Date(effectiveDateTo);
            toDate.setHours(23, 59, 59, 999); // Include entire day
            return settlementDate <= toDate;
        });
    }
    
    // Apply sorting
    filteredSettlements.sort((a, b) => {
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
            case 'number-desc':
                return (b.settlementNumber || '').localeCompare(a.settlementNumber || '');
            case 'number-asc':
                return (a.settlementNumber || '').localeCompare(b.settlementNumber || '');
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
    const totalPages = Math.ceil(filteredSettlements.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
        currentPage = 1;
    }

    renderSettlements();
}

// Render Settlements
function renderSettlements() {
    const tbody = document.getElementById('settlementsTableBody');
    const emptyState = document.getElementById('emptyState');
    const paginationContainer = document.getElementById('paginationContainer');
    
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (filteredSettlements.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (paginationContainer) paginationContainer.classList.add('hidden');
        return;
    }
    
    if (emptyState) emptyState.classList.add('hidden');
    if (paginationContainer) paginationContainer.classList.remove('hidden');
    
    const totalPages = Math.ceil(filteredSettlements.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredSettlements.length);
    const paginatedSettlements = filteredSettlements.slice(startIndex, endIndex);
    
    // Get current logged-in user type
    const currentUserType = localStorage.getItem('asel_userType') || '';
    const canDeleteSettlements = currentUserType === 'manager' || currentUserType === 'system_engineer';
    
    const paginationInfo = document.getElementById('paginationInfo');
    if (paginationInfo) {
        paginationInfo.textContent = `عرض ${startIndex + 1} - ${endIndex} من ${filteredSettlements.length}`;
    }
    
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages;
    
    const pageNumbersEl = document.getElementById('pageNumbers');
    if (pageNumbersEl) {
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
    }
    
    paginatedSettlements.forEach(settlement => {
        const statusText = settlement.status === 'pending' ? 'قيد المعالجة' : 'مكتملة';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${settlement.settlementNumber}</td>
            <td>${new Date(settlement.date).toLocaleDateString('ar-EG')}</td>
            <td><strong>${settlement.salesRepName || ''}</strong></td>
            <td>${settlement.warehouseKeeperName || ''}</td>
            <td><span class="status-badge status-${settlement.status}"><strong>${statusText}</strong></span></td>
            <td class="created-by-cell">${settlement.createdBy || '-'}</td>
            <td>
                <div class="actions-buttons">
                    <button class="action-btn view" data-settlement-id="${settlement.id}" title="عرض">👁️</button>
                    <button class="action-btn print" data-settlement-id="${settlement.id}" title="طباعة">🖨️</button>
                    <button class="action-btn save" data-settlement-id="${settlement.id}" title="حفظ">💾</button>
                </div>
            </td>
        `;
        
        // Add event listeners to buttons
        const viewBtn = row.querySelector('.action-btn.view');
        const printBtn = row.querySelector('.action-btn.print');
        const saveBtn = row.querySelector('.action-btn.save');
        const actionsDiv = row.querySelector('.actions-buttons');
        
        if (viewBtn) {
            viewBtn.addEventListener('click', () => viewSettlement(settlement.id));
        }
        if (printBtn) {
            printBtn.addEventListener('click', () => printSettlementById(settlement.id));
        }
        if (saveBtn) {
            saveBtn.addEventListener('click', () => saveSettlementAsPDF(settlement.id));
        }
        
        // Add delete button only for manager or system_engineer and if status is not 'completed' (مكتملة)
        const settlementStatus = settlement.status || 'pending';
        if (canDeleteSettlements && settlementStatus !== 'completed') {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'action-btn delete';
            deleteBtn.textContent = '🗑️';
            deleteBtn.type = 'button';
            deleteBtn.title = 'حذف';
            deleteBtn.setAttribute('data-settlement-id', settlement.id);
            deleteBtn.addEventListener('click', () => deleteSettlement(settlement.id));
            if (actionsDiv) {
                actionsDiv.appendChild(deleteBtn);
            }
        }
        
        tbody.appendChild(row);
    });
}

// View Settlement
async function viewSettlement(settlementId) {
    const settlement = settlements.find(s => s.id === settlementId);
    if (!settlement) {
        showMessage('التسوية غير موجودة', 'error');
        return;
    }
    
    try {
        const viewContent = await generatePrintContent(settlement);
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
        console.error('Error viewing settlement:', error);
        showMessage('خطأ في عرض التسوية: ' + error.message, 'error');
    }
}

// Delete Settlement
async function deleteSettlement(settlementId) {
    const settlement = settlements.find(s => s.id === settlementId);
    if (!settlement) {
        showMessage('التسوية غير موجودة', 'error');
        return;
    }
    
    // Check settlement status - prevent deletion if status is 'completed' (مكتملة)
    if (settlement.status === 'completed') {
        if (window.showToast) {
            window.showToast('لا يمكن حذف التسوية لأنها في حالة "مكتملة"', 'error', 5000);
        } else {
            showMessage('لا يمكن حذف التسوية لأنها في حالة "مكتملة"', 'error');
        }
        return;
    }
    
    // Confirm deletion
    if (!confirm(`هل أنت متأكد من حذف التسوية ${settlement.settlementNumber}؟\nسيتم إرجاع الكميات إلى المخزون وإعادة حالة إذن الصرف إلى "صادر".`)) {
        return;
    }
    
    try {
        // Load settlement items from database
        const settlementItems = await window.electronAPI.dbGetAll('settlement_items', 'settlementId = ?', [settlementId]);
        
        if (settlementItems && settlementItems.length > 0) {
            // Revert stock changes: add back sold quantities, subtract returned and rejected quantities
            for (const item of settlementItems) {
                await revertProductStockFromSettlement(item);
            }
        }
        
        // Update delivery note status back to 'issued' (if exists)
        if (settlement.deliveryNoteId && window.electronAPI && window.electronAPI.dbGet) {
            try {
                const deliveryNote = await window.electronAPI.dbGet('delivery_notes', settlement.deliveryNoteId);
                if (deliveryNote) {
                    await window.electronAPI.dbUpdate('delivery_notes', settlement.deliveryNoteId, {
                        ...deliveryNote,
                        status: 'issued'
                    });
                }
            } catch (error) {
                console.error('Error updating delivery note status:', error);
            }
        }
        
        // Delete settlement items
        if (window.electronAPI && window.electronAPI.dbQuery) {
            await window.electronAPI.dbQuery('DELETE FROM settlement_items WHERE settlementId = ?', [settlementId]);
        } else {
            const items = await window.electronAPI.dbGetAll('settlement_items', 'settlementId = ?', [settlementId]);
            for (const item of items) {
                await window.electronAPI.dbDelete('settlement_items', item.id);
            }
        }
        
        // Delete settlement
        await window.electronAPI.dbDelete('delivery_settlements', settlementId);
        
        // Reload data
        await loadData();
        applyFilters();
        
        showMessage('تم حذف التسوية وإرجاع الكميات إلى المخزون بنجاح', 'success');
    } catch (error) {
        console.error('Error deleting settlement:', error);
        showMessage('خطأ في حذف التسوية: ' + error.message, 'error');
    }
}

// Revert Product Stock from Settlement (opposite of updateProductStockFromSettlement)
// Add back sold quantities (stock was deducted), subtract returned and rejected quantities (stock was added)
async function revertProductStockFromSettlement(settlementItem) {
    try {
        let product = null;
        if (window.electronAPI && window.electronAPI.dbGet) {
            product = await window.electronAPI.dbGet('products', settlementItem.productId);
        }
        
        if (!product) {
            console.error('Product not found:', settlementItem.productId);
            return;
        }
        
        // Calculate quantities in smallest unit
        let soldQty = settlementItem.soldQuantity || 0;
        let returnedQty = settlementItem.returnedQuantity || 0;
        let rejectedQty = settlementItem.rejectedQuantity || 0;
        
        if (settlementItem.unit === 'largest') {
            const conversionFactor = product.conversionFactor || 1;
            soldQty = soldQty * conversionFactor;
            returnedQty = returnedQty * conversionFactor;
            rejectedQty = rejectedQty * conversionFactor;
        }
        
        // Calculate net change: add back sold (was deducted), subtract returned and rejected (was added)
        const netChange = soldQty - returnedQty - rejectedQty;
        
        if (netChange !== 0) {
            // Update stock
            const currentStock = parseFloat(product.stock) || 0;
            const newStock = Math.max(0, currentStock + netChange);
            
            product.stock = newStock;
            
            // Update product in database
            if (window.electronAPI && window.electronAPI.dbUpdate) {
                await window.electronAPI.dbUpdate('products', product.id, product);
                console.log(`Reverted product ${product.name} stock: ${currentStock} -> ${newStock} (sold: +${soldQty}, returned: -${returnedQty}, rejected: -${rejectedQty})`);
            }
        }
    } catch (error) {
        console.error('Error reverting product stock from settlement:', error);
    }
}

// Print Settlement
function printSettlementById(settlementId) {
    const settlement = settlements.find(s => s.id === settlementId);
    if (settlement) {
        openPrintWindow(settlement);
    }
}

// Save Settlement as PDF
async function saveSettlementAsPDF(settlementId) {
    const settlement = settlements.find(s => s.id === settlementId);
    if (!settlement) {
        showMessage('التسوية غير موجودة', 'error');
        return;
    }
    
    try {
        const printContent = await generatePrintContent(settlement);
        const fileName = `تسوية_${settlement.settlementNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
        
        // Check if Electron API is available
        if (window.electronAPI && window.electronAPI.saveInvoiceToFile) {
            const result = await window.electronAPI.saveInvoiceToFile(printContent, fileName);
            
            if (result.success) {
                showMessage('تم حفظ الملف بنجاح', 'success');
            } else if (result.cancelled) {
                // User cancelled, do nothing
            } else {
                showMessage('فشل حفظ الملف: ' + (result.error || 'خطأ غير معروف'), 'error');
            }
        } else {
            // Fallback: Use browser print with PDF option
            showMessage('وظيفة حفظ PDF غير متاحة في المتصفح. يرجى استخدام المتصفح لإلغاء الإلغاء والضغط على "حفظ كـ PDF"', 'error');
            printSettlementById(settlementId);
        }
    } catch (error) {
        console.error('Error saving PDF:', error);
        showMessage('خطأ في حفظ PDF: ' + error.message, 'error');
        // Fallback to print
        printSettlementById(settlementId);
    }
}

// Open Print Window
async function openPrintWindow(settlement) {
    try {
        const printContent = await generatePrintContent(settlement);
        
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
        showMessage('خطأ في طباعة التسوية: ' + error.message, 'error');
    }
}

// Generate Print Content
async function generatePrintContent(settlement) {
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
    
    const companyName = companySettings.name && companySettings.name.trim() ? companySettings.name : 'شركة أسيل';
    const companyAddress = companySettings.address && companySettings.address.trim() ? companySettings.address : '';
    const companyPhone = companySettings.phone && companySettings.phone.trim() ? companySettings.phone : (companySettings.mobile && companySettings.mobile.trim() ? companySettings.mobile : '');
    const defaultSalesRepName = companySettings.salesRepName || '';
    
    // Load delivery note
    let deliveryNote = null;
    if (window.electronAPI && window.electronAPI.dbGet) {
        deliveryNote = await window.electronAPI.dbGet('delivery_notes', settlement.deliveryNoteId);
    }
    
    // Load settlement items if not loaded
    let items = settlement.items || [];
    if (items.length === 0 && window.electronAPI && window.electronAPI.dbGetAll) {
        const settlementItems = await window.electronAPI.dbGetAll('settlement_items', 'settlementId = ?', [settlement.id]);
        items = settlementItems || [];
    }
    
    // Load product data to get smallest unit and category for each item
    if (window.electronAPI && window.electronAPI.dbGet) {
        for (let item of items) {
            if (item.productId) {
                try {
                    const productData = await window.electronAPI.dbGet('products', item.productId);
                    if (productData) {
                        if (!item.smallestUnit) {
                            item.smallestUnit = productData.smallestUnit || item.unit || '';
                        }
                        if (!item.productCategory) {
                            item.productCategory = productData.category || 'غير محدد';
                        }
                    } else {
                        if (!item.smallestUnit) {
                            item.smallestUnit = item.unit || '';
                        }
                        if (!item.productCategory) {
                            item.productCategory = 'غير محدد';
                        }
                    }
                } catch (error) {
                    console.error('Error loading product data:', error);
                    if (!item.smallestUnit) {
                        item.smallestUnit = item.unit || '';
                    }
                    if (!item.productCategory) {
                        item.productCategory = 'غير محدد';
                    }
                }
            } else {
                if (!item.smallestUnit) {
                    item.smallestUnit = item.unit || '';
                }
                if (!item.productCategory) {
                    item.productCategory = 'غير محدد';
                }
            }
        }
    }
    
    // Calculate estimated height to determine if we need to split the table
    // A4 height: 297mm, margins: 8mm top + 8mm bottom = 16mm, available: 281mm
    const itemsCount = items.length;
    const commitmentHeight = 45; // Commitment text is ~45mm (only in salesrep copy)
    // Base height breakdown: header (20mm) + title (10mm) + info (12mm) + signatures (60mm) + footer (8mm) = ~110mm
    const baseHeight = 110; 
    const tableHeaderHeight = 7; // Table header height
    const cutLineHeight = 2; // Cut line height
    const A4_AVAILABLE_HEIGHT = 281; // A4 available height in mm
    
    // Fixed content height (without table)
    // Base content appears twice (warehouse + salesrep) + commitment (salesrep only) + cut line
    const fixedContentHeight = (baseHeight * 2) + commitmentHeight + cutLineHeight;
    // Available height for table (appears in both copies)
    const availableHeightForTable = Math.max(0, A4_AVAILABLE_HEIGHT - fixedContentHeight);
    
    // Calculate if we need to split table based on actual height
    // Try with single table first
    const singleTableRowHeight = 4.5; // mm per row in single table
    const singleTableHeight = tableHeaderHeight + (itemsCount * singleTableRowHeight);
    // Table appears twice (once in each copy)
    const singleTableTotalHeight = singleTableHeight * 2;
    
    // Try with split table (two tables side by side)
    const splitTableRowHeight = 3.5; // mm per row in split table (smaller font)
    const splitTableHeight = tableHeaderHeight + (itemsCount * splitTableRowHeight);
    // Table appears twice (once in each copy)
    const splitTableTotalHeight = splitTableHeight * 2;
    
    // Decide if we need to split table
    // Split table if:
    // 1. Single table would exceed available height AND split table fits better, OR
    // 2. Items count > 8 (heuristic for better layout)
    // Always prefer split table if it uses less height
    const shouldSplitTable = (singleTableTotalHeight > availableHeightForTable && splitTableTotalHeight < singleTableTotalHeight) 
        || itemsCount > 8
        || (availableHeightForTable < 20 && itemsCount > 0); // If very little space, always split
    
    // Use the appropriate table height
    const tableHeight = shouldSplitTable ? splitTableHeight : singleTableHeight;
    const tableTotalHeight = shouldSplitTable ? splitTableTotalHeight : singleTableTotalHeight;
    
    // Calculate final heights
    const warehouseCopyHeight = baseHeight + tableHeight;
    const salesrepCopyHeight = baseHeight + tableHeight + commitmentHeight;
    const totalEstimatedHeight = warehouseCopyHeight + salesrepCopyHeight + cutLineHeight;
    
    // Split pages if items count > 20 (each copy on separate page, enlarged to fill page)
    const shouldSplitPages = itemsCount > 20;
    
    // Log decision for debugging
    console.log(`[Settlement] Items: ${itemsCount}, Fixed content: ${fixedContentHeight.toFixed(1)}mm, ` +
        `Available for table: ${availableHeightForTable.toFixed(1)}mm, ` +
        `Single table: ${singleTableTotalHeight.toFixed(1)}mm, Split table: ${splitTableTotalHeight.toFixed(1)}mm, ` +
        `Table split: ${shouldSplitTable}, Pages split: ${shouldSplitPages}, Total: ${totalEstimatedHeight.toFixed(1)}mm`);
    
    const defaultWarehouseKeeperName = companySettings.warehouseKeeperName || '';
    const defaultWarehouseKeeperPhone = companySettings.warehouseKeeperPhone || '';
    const defaultSalesRepPhone = companySettings.salesRepPhone || '';
    
    // Helper function to generate a single copy content
    const generateCopyContent = (copyType, copyTitle) => {
        const deliveryNoteNumber = deliveryNote ? deliveryNote.deliveryNoteNumber : '……';
        return `
    <div class="settlement-container">
        <div class="copy-label">${copyTitle}</div>
        <div class="header">
            <img src="${logoBase64 || logoPath}" alt="Logo" class="company-logo" />
            <div>
                <div class="company-name">${companyName}</div>
                ${companyAddress || companyPhone ? `<div class="company-info">${companyAddress ? companyAddress : ''}${companyAddress && companyPhone ? ' - ' : ''}${companyPhone ? companyPhone : ''}</div>` : ''}
            </div>
        </div>
        <div class="invoice-title">تسوية إذن الصرف</div>
        <div class="info-section">
            <div class="info-line info-line-main">
                <div class="info-line-left">
                    <span class="info-label">رقم التسوية:</span>
                    <span class="info-value info-value-important">${settlement.settlementNumber}</span>
                    <span class="info-separator">|</span>
                    <span class="info-label">التاريخ:</span>
                    <span class="info-value">${new Date(settlement.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    ${deliveryNote ? `<span class="info-separator">|</span>
                    <span class="info-label">رقم إذن الصرف:</span>
                    <span class="info-value info-value-important">${deliveryNote.deliveryNoteNumber}</span>` : ''}
                    <span class="info-separator">|</span>
                    <span class="info-label">عدد المنتجات:</span>
                    <span class="info-value info-value-important">${itemsCount}</span>
                </div>
                <div class="info-line-right">
                    <span class="info-label">${copyType === 'warehouse' ? 'أمين المخزن / التلاجة:' : 'المندوب:'}</span>
                    <span class="info-value info-value-important">${copyType === 'warehouse' ? (settlement.warehouseKeeperName || defaultWarehouseKeeperName || '') : (settlement.salesRepName || defaultSalesRepName || '')}</span>
                    ${copyType === 'warehouse' && defaultWarehouseKeeperPhone ? `<span class="info-separator">|</span><span class="info-label">رقم التليفون:</span><span class="info-value">${defaultWarehouseKeeperPhone}</span>` : ''}
                    ${copyType === 'salesrep' && defaultSalesRepPhone ? `<span class="info-separator">|</span><span class="info-label">رقم التليفون:</span><span class="info-value">${defaultSalesRepPhone}</span>` : ''}
                </div>
            </div>
        </div>
        <div class="products-section">
            <h4>جدول التسوية</h4>
            ${(() => {
                // Use shouldSplitTable from outer scope (calculated based on A4 height)
                const halfCount = Math.ceil(itemsCount / 2);
                
                if (shouldSplitTable) {
                    const firstHalf = items.slice(0, halfCount);
                    const secondHalf = items.slice(halfCount);
                    
                    const generateTable = (itemsList, startIndex) => `
                        <table class="items-table items-table-split">
                            <thead>
                                <tr>
                                    <th style="width: 25px;">#</th>
                                    <th>اسم المنتج</th>
                                    <th style="width: 50px;">نوع المنتج</th>
                                    <th style="width: 50px;">الكود</th>
                                    <th style="width: 45px;">المصروف</th>
                                    <th style="width: 45px;">المباع</th>
                                    <th style="width: 45px;">الفرق</th>
                                    <th style="width: 45px;">الوحدة</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsList.map((item, idx) => {
                                    return `
                                <tr>
                                    <td style="text-align: center; font-weight: bold;">${startIndex + idx + 1}</td>
                                    <td style="font-size: 10px !important; font-weight: bold !important; padding: 3px 2px !important;"><strong>${item.productName}</strong></td>
                                    <td style="text-align: center; font-size: 9px !important; font-weight: bold !important; padding: 3px 2px !important;">${item.productCategory || 'غير محدد'}</td>
                                    <td style="text-align: center;">${item.productCode || ''}</td>
                                    <td style="text-align: center; font-weight: bold; font-size: 14px !important;">${formatArabicNumber(item.issuedQuantity, 0)}</td>
                                    <td style="text-align: center; font-weight: bold; font-size: 14px !important;">${formatArabicNumber(item.soldQuantity, 0)}</td>
                                    <td style="text-align: center; font-weight: bold; font-size: 14px !important; color: #000 !important;">${formatArabicNumber(item.difference, 0)}</td>
                                    <td style="text-align: center; font-size: 9px !important; font-weight: bold !important;">${item.smallestUnit || item.unit || ''}</td>
                                </tr>
                                `;
                                }).join('')}
                            </tbody>
                        </table>
                    `;
                    
                    return `
                        <div class="items-tables-container">
                            ${generateTable(firstHalf, 0)}
                            ${generateTable(secondHalf, halfCount)}
                        </div>
                    `;
                } else {
                    return `
                        <table class="items-table">
                            <thead>
                                <tr>
                                    <th style="width: 30px;">#</th>
                                    <th>اسم المنتج</th>
                                    <th style="width: 70px;">نوع المنتج</th>
                                    <th style="width: 70px;">الكود</th>
                                    <th style="width: 55px;">المصروف</th>
                                    <th style="width: 55px;">المباع</th>
                                    <th style="width: 55px;">الفرق</th>
                                    <th style="width: 55px;">الوحدة</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${items.map((item, index) => {
                                    return `
                                <tr>
                                    <td style="text-align: center; font-weight: bold;">${index + 1}</td>
                                    <td style="font-size: 11px !important; font-weight: bold !important; padding: 4px 3px !important;"><strong>${item.productName}</strong></td>
                                    <td style="text-align: center; font-size: 10px !important; font-weight: bold !important; padding: 4px 3px !important;">${item.productCategory || 'غير محدد'}</td>
                                    <td style="text-align: center;">${item.productCode || ''}</td>
                                    <td style="text-align: center; font-weight: bold; font-size: 14px !important;">${formatArabicNumber(item.issuedQuantity, 0)}</td>
                                    <td style="text-align: center; font-weight: bold; font-size: 14px !important;">${formatArabicNumber(item.soldQuantity, 0)}</td>
                                    <td style="text-align: center; font-weight: bold; font-size: 14px !important; color: #000 !important;">${formatArabicNumber(item.difference, 0)}</td>
                                    <td style="text-align: center; font-size: 10px !important; font-weight: bold !important;">${item.smallestUnit || item.unit || ''}</td>
                                </tr>
                                `;
                                }).join('')}
                            </tbody>
                        </table>
                    `;
                }
            })()}
        </div>
        ${copyType === 'salesrep' ? `
        <div class="commitment-text">
            <p><strong>أقرّ أنا المندوب المذكور اسمي أعلاه</strong> بأنني قد قمت بتسوية كافة الأصناف الموضحة في هذا البيان، وذلك إمّا من خلال فواتير مبيعات أو بإعادة الأصناف المتبقية إلى المخزن حسب الأصول.</p>
            <p>وبناءً على ذلك، أُبرِّئ ذمتي تجاه ${companyName} عن الكميات المسلّمة سابقًا بموجب إذن الصرف رقم (${deliveryNoteNumber})، وذلك بعد مراجعة واعتماد أمين المخزن.</p>
        </div>
        ` : ''}
        <div class="signature">
            <div class="signature-box">
                <h4>توقيع أمين المخزن / التلاجة</h4>
                <div style="margin-top: 20px; font-size: 10px; color: #666;">
                    الاسم: _________________________
                </div>
            </div>
            <div class="signature-box">
                <h4>توقيع المستلم (المندوب)</h4>
                <div style="margin-top: 20px; font-size: 10px; color: #666;">
                    الاسم: _________________________
                </div>
            </div>
        </div>
        <div class="footer">
            <p>تم إنشاء هذه التسوية بتاريخ: ${new Date(settlement.createdAt || new Date()).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p style="margin-top: 3px;">يرجى التأكد من مطابقة جميع العناصر قبل التوقيع</p>
        </div>
    </div>
        `;
    };

    return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>تسوية ${settlement.settlementNumber}</title>
    <style>
        @page { 
            size: A4; 
            margin: 8mm;
        }
        * { 
            margin: 0; 
            padding: 0; 
            box-sizing: border-box; 
        }
        body { 
            font-family: 'Arial', 'Tahoma', sans-serif; 
            direction: rtl; 
            background: white; 
            padding: 0;
            font-size: 12px;
            line-height: 1.4;
        }
        .settlements-wrapper {
            display: block;
            width: 100%;
        }
        .settlement-container {
            width: 100%;
            min-height: auto;
            height: auto;
            margin: 0 auto 2mm auto;
            background: white;
            padding: 3mm;
            position: relative;
            box-sizing: border-box;
            border: 1px solid #ddd;
        }
        ${shouldSplitPages ? `
        /* When splitting pages: each copy on separate page */
        .settlement-container:first-of-type {
            page-break-after: always;
            margin-bottom: 20px;
        }
        .cut-line {
            display: none; /* Hide cut line when splitting pages */
        }
        ` : `
        /* When not splitting pages: keep both copies on one page */
        .settlement-container:first-of-type {
            page-break-after: never;
        }
        `}
        .copy-label {
            position: absolute;
            top: 3mm;
            left: 3mm;
            background: rgba(139, 69, 19, 0.8);
            color: white;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 9px;
            font-weight: bold;
        }
        .cut-line {
            margin: 0;
            padding: 0;
            text-align: center;
            border-top: 2px dashed #666;
            border-bottom: none;
            position: relative;
            height: 2px;
            overflow: visible;
            margin: 1mm 0;
        }
        .cut-line::before {
            content: '✂️ قص هنا';
            position: absolute;
            left: 50%;
            top: -8px;
            transform: translateX(-50%);
            background: white;
            padding: 0 8px;
            font-size: 9px;
            color: #666;
        }
        .header { 
            text-align: center; 
            margin-bottom: 8px; 
            border-bottom: 2px solid #333; 
            padding-bottom: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        .company-logo {
            width: 40px;
            height: 40px;
            object-fit: contain;
            flex-shrink: 0;
        }
        .company-name { 
            font-size: 16px; 
            font-weight: bold; 
            margin-bottom: 3px; 
            color: #333;
        }
        .company-info { 
            font-size: 9px; 
            color: #666; 
        }
        .invoice-title { 
            font-size: 16px; 
            font-weight: bold; 
            margin: 8px 0; 
            text-align: center; 
            color: #8b4513;
            border: 2px solid #8b4513;
            padding: 5px;
            border-radius: 5px;
        }
        .info-section { 
            margin-bottom: ${shouldSplitPages ? '2px' : '6px'}; 
            padding: 4px 0;
        }
        .info-line {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 4px;
            margin-bottom: 3px;
            font-size: 10px;
            line-height: 1.5;
        }
        .info-line-main {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
            margin-bottom: 0;
            width: 100%;
        }
        .info-line-left {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 4px;
            flex: 1;
            min-width: 0;
        }
        .info-line-right {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 4px;
            flex-shrink: 0;
            white-space: nowrap;
        }
        .info-label {
            font-weight: bold;
            color: #8b4513;
            font-size: 10px;
        }
        .info-value {
            color: #333;
            font-size: 10px;
        }
        .info-value-important {
            font-weight: bold !important;
            font-size: 12px !important;
            color: #000 !important;
        }
        .info-separator {
            color: #999;
            margin: 0 2px;
        }
        .products-section {
            margin: ${shouldSplitPages ? '2px 0' : '4px 0'};
        }
        .products-section h4 {
            font-size: 8px;
            margin-bottom: 2px;
            color: #333;
            text-align: center;
            padding: 1px;
            font-weight: bold;
        }
        .items-tables-container {
            display: flex;
            gap: 4px;
            width: 100%;
        }
        .items-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 3px 0; 
            border: 1px solid #333;
            font-size: 7px;
        }
        .items-table-split {
            width: calc(50% - 2px);
            margin: 0;
            font-size: 6px;
        }
        .items-table th, .items-table td { 
            border: 1px solid #ddd; 
            padding: 2px 1px; 
            text-align: right; 
            line-height: 1.2;
        }
        .items-table-split th, .items-table-split td {
            padding: 1px;
            font-size: 6px;
        }
        .items-table th { 
            background: #8b4513; 
            color: white;
            font-weight: bold; 
            font-size: 8px;
            padding: 3px 1px;
        }
        .items-table-split th {
            font-size: 7px;
            padding: 2px 1px;
        }
        .items-table td {
            font-size: 7px;
        }
        .items-table td:nth-child(5),
        .items-table td:nth-child(6),
        .items-table td:nth-child(7),
        .items-table-split td:nth-child(5),
        .items-table-split td:nth-child(6),
        .items-table-split td:nth-child(7) {
            font-size: 14px !important;
            font-weight: bold !important;
        }
        .items-table tbody tr:nth-child(even) {
            background: #f9f9f9;
        }
        .difference-positive { 
            color: #28a745; 
            font-weight: bold; 
        }
        .difference-negative { 
            color: #dc3545; 
            font-weight: bold; 
        }
        .difference-zero { 
            color: #007bff; 
            font-weight: bold; 
        }
        .commitment-text {
            margin-top: 6px;
            margin-bottom: 6px;
            padding: 6px;
            background: #f9f9f9;
            border: 1px solid #ddd;
            border-radius: 4px;
            text-align: right;
            line-height: 1.4;
            font-size: 8px;
        }
        .commitment-text p {
            margin: 3px 0;
        }
        .signature { 
            margin-top: 8px; 
            display: flex; 
            justify-content: space-between; 
            gap: 8px;
        }
        .signature-box { 
            width: 48%; 
            text-align: center; 
            border-top: 1px solid #333; 
            padding-top: 6px; 
            min-height: 45px;
        }
        .signature-box h4 {
            font-size: 9px;
            margin-bottom: 15px;
            color: #333;
        }
        .signature-box div {
            font-size: 8px;
            margin-top: 10px;
        }
        .footer {
            margin-top: 6px;
            text-align: center;
            font-size: 7px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 4px;
        }
        ${shouldSplitPages ? `
        /* Override styles when splitting pages - enlarge content to fill page */
        .settlement-container {
            min-height: calc(100vh - 16mm) !important;
            padding: 4mm !important;
            margin: 0 !important;
        }
        .header {
            margin-bottom: 8px !important;
            padding-bottom: 6px !important;
        }
        .company-logo {
            width: 45px !important;
            height: 45px !important;
        }
        .company-name {
            font-size: 18px !important;
            margin-bottom: 2px !important;
        }
        .company-info {
            font-size: 10px !important;
        }
        .invoice-title {
            font-size: 18px !important;
            margin: 6px 0 !important;
            padding: 6px !important;
        }
        .info-section {
            margin-bottom: 4px !important;
            padding: 3px 0 !important;
        }
        .info-label, .info-value {
            font-size: 11px !important;
        }
        .info-value-important {
            font-size: 13px !important;
        }
        .products-section {
            margin: 2px 0 !important;
        }
        .products-section h4 {
            font-size: 13px !important;
            margin-bottom: 4px !important;
        }
        .items-table {
            font-size: 10px !important;
            margin: 2px 0 !important;
        }
        .items-table th, .items-table td {
            padding: 6px 4px !important;
            font-size: 10px !important;
        }
        .items-table th {
            font-size: 11px !important;
            padding: 5px 3px !important;
        }
        .items-table-split {
            font-size: 9px !important;
        }
        .items-table-split th, .items-table-split td {
            padding: 4px 3px !important;
            font-size: 9px !important;
        }
        .items-table-split th {
            font-size: 10px !important;
            padding: 4px 3px !important;
        }
        .items-table td:nth-child(5),
        .items-table td:nth-child(6),
        .items-table td:nth-child(7),
        .items-table-split td:nth-child(5),
        .items-table-split td:nth-child(6),
        .items-table-split td:nth-child(7) {
            font-size: 13px !important;
        }
        .commitment-text {
            font-size: 10px !important;
            padding: 6px !important;
            margin: 4px 0 !important;
            line-height: 1.5 !important;
        }
        .commitment-text p {
            margin: 2px 0 !important;
        }
        .signature {
            margin-top: 6px !important;
        }
        .signature-box {
            min-height: 50px !important;
        }
        .signature-box h4 {
            font-size: 11px !important;
            margin-bottom: 12px !important;
        }
        .footer {
            font-size: 8px !important;
            margin-top: 6px !important;
        }
        ` : ''}
        @media print {
            body {
                padding: 0;
            }
            .settlement-container {
                page-break-inside: avoid;
                break-inside: avoid;
            }
            ${shouldSplitPages ? `
            /* When splitting pages: each copy on separate page */
            .settlement-container:first-of-type {
                page-break-after: always;
                break-after: page;
            }
            .settlement-container:nth-of-type(2) {
                page-break-before: always;
                break-before: page;
            }
            .cut-line {
                display: none; /* Hide cut line when splitting pages */
            }
            ` : `
            /* When not splitting: keep both copies on one page */
            .settlement-container:first-of-type {
                page-break-after: never;
                break-after: avoid;
            }
            .settlement-container:nth-of-type(2) {
                page-break-before: avoid;
                break-before: avoid;
            }
            .cut-line {
                page-break-after: never;
                page-break-before: never;
                break-after: avoid;
                break-before: avoid;
            }
            `}
            .header {
                page-break-after: avoid;
            }
            .items-table {
                page-break-inside: avoid;
            }
            /* Allow table to split if absolutely necessary (when table is very long) */
            .items-table-split {
                page-break-inside: auto;
            }
        }
    </style>
</head>
<body>
    <div class="settlements-wrapper">
        ${generateCopyContent('warehouse', 'نسخة أمين المخزن / التلاجة')}
        <div class="cut-line"></div>
        ${generateCopyContent('salesrep', 'نسخة المندوب')}
    </div>
</body>
</html>
    `;
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
                    phone: companyInfo.phone || '',
                    mobile: companyInfo.mobile || '',
                    salesRepName: companyInfo.salesRepName || ''
                };
            }
        }
        return {};
    } catch (error) {
        console.error('Error getting company settings:', error);
        return {};
    }
}

// Close Modal
function closeModalHandler() {
    const settlementModal = document.getElementById('settlementModal');
    if (settlementModal) settlementModal.classList.remove('active');
    currentSettlement = null;
    settlementItems = [];
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
        const modal = document.querySelector('.modal.active, [class*="modal"].active');
        if (modal) {
            const firstInput = modal.querySelector('input:not([type="hidden"]):not([readonly]), select, textarea');
            if (firstInput && !firstInput.disabled && !firstInput.readOnly) {
                firstInput.focus();
            }
        }
    }, 50);
}

// Make functions global
window.updateReturnedQuantity = updateReturnedQuantity;
window.updateRejectedQuantity = updateRejectedQuantity;
window.clearReturnedQuantity = clearReturnedQuantity;
window.clearRejectedQuantity = clearRejectedQuantity;
window.removeSettlementItem = removeSettlementItem;
window.viewSettlement = viewSettlement;
window.printSettlementById = printSettlementById;
window.saveSettlementAsPDF = saveSettlementAsPDF;
window.deleteSettlement = deleteSettlement;

