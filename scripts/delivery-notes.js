// Delivery Notes Management System (نظام إدارة أذون الصرف)

// Storage Keys
const STORAGE_KEYS = {
    DELIVERY_NOTES: 'asel_delivery_notes',
    PRODUCTS: 'asel_products',
    DELIVERY_NOTE_COUNTER: 'asel_delivery_note_counter'
};

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
let deliveryNotes = [];
let products = [];
let noteProducts = [];
let currentNote = null;

// Pagination & Filter State
let currentPage = 1;
const itemsPerPage = 20;
let filteredNotes = [];
let searchQuery = '';
let dateFrom = '';
let dateTo = '';
let statusFilter = '';
let sortBy = 'date-desc';

// Load data on page load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Delivery Notes] DOMContentLoaded - Starting initialization');
    try {
        await loadProductsOnly(); // Only load products, not delivery notes
        initializeEventListeners();
        renderProducts();
        console.log('[Delivery Notes] DOMContentLoaded - Initialization complete');
    } catch (error) {
        console.error('[Delivery Notes] Error during initialization:', error);
    }
});

// Initialize Event Listeners
function initializeEventListeners() {
    // Load Products Button
    const loadProductsBtn = document.getElementById('loadProductsBtn');
    const selectedDateForLoad = document.getElementById('selectedDateForLoad');
    
    if (loadProductsBtn) {
        loadProductsBtn.addEventListener('click', async () => {
            if (!selectedDateForLoad || !selectedDateForLoad.value) {
                showMessage('يرجى اختيار التاريخ أولاً', 'error');
                return;
            }
            await openNewNoteWithDate(selectedDateForLoad.value);
        });
    }
    
    // Set today as default date
    if (selectedDateForLoad) {
        const today = new Date().toISOString().split('T')[0];
        selectedDateForLoad.value = today;
    }

    // Modal Close
    const closeModal = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    if (closeModal) closeModal.addEventListener('click', closeModalHandler);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModalHandler);

    // Close modal on backdrop click
    const noteModal = document.getElementById('noteModal');
    if (noteModal) {
        noteModal.addEventListener('click', (e) => {
            if (e.target.id === 'noteModal') {
                closeModalHandler();
            }
        });
    }

    // Form Submit
    const noteForm = document.getElementById('noteForm');
    if (noteForm) {
        noteForm.addEventListener('submit', handleFormSubmit);
    }

    // Load from Invoices Button (inside modal)
    const loadFromInvoicesBtn = document.getElementById('loadFromInvoicesBtn');
    if (loadFromInvoicesBtn) {
        loadFromInvoicesBtn.addEventListener('click', async () => {
            const dateInput = document.getElementById('noteDate');
            if (dateInput && dateInput.value) {
                await loadProductsFromDate(dateInput.value);
            } else {
                const today = new Date().toISOString().split('T')[0];
                await loadProductsFromDate(today);
            }
        });
    }
    
    // Print Note Button
    const printNoteBtn = document.getElementById('printNoteBtn');
    if (printNoteBtn) {
        printNoteBtn.addEventListener('click', printCurrentNote);
    }
    
    // Save Note as PDF Button
    const saveNoteAsPDFBtn = document.getElementById('saveNoteAsPDFBtn');
    if (saveNoteAsPDFBtn) {
        saveNoteAsPDFBtn.addEventListener('click', saveCurrentNoteAsPDF);
    }
}

// Load Products Only (no need to load delivery notes list)
async function loadProductsOnly() {
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            products = await window.electronAPI.dbGetAll('products', '', []);
            products = Array.isArray(products) ? products : [];
            console.log('[Delivery Notes] Loaded', products.length, 'products from database');
        } catch (error) {
            console.error('[Delivery Notes] Error loading products:', error);
            products = [];
        }
    } else {
        products = [];
    }
}

// Load Data (kept for backward compatibility)
async function loadData() {
    await loadProductsOnly();
}

// Generate Delivery Note Number
async function generateDeliveryNoteNumber() {
    const year = new Date().getFullYear();
    const prefix = `DN-${year}-`;
    
    // Try to get counter from database first (more reliable)
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            // Get all delivery notes from database
            const allNotes = await window.electronAPI.dbGetAll('delivery_notes', '', []);
            
            if (allNotes && allNotes.length > 0) {
                // Filter notes with numbers matching current year pattern
                const currentYearNumbers = allNotes
                    .map(note => note.deliveryNoteNumber)
                    .filter(number => number && number.startsWith(prefix));
                
                // Extract numbers from note numbers (e.g., "DN-2025-001" -> 1)
                const numbers = currentYearNumbers.map(number => {
                    const match = number.match(new RegExp(`${prefix}(\\d+)`));
                    return match ? parseInt(match[1]) : 0;
                });
                
                // Get maximum number
                const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
                const counter = maxNumber + 1;
                
                // Save to localStorage as backup
                localStorage.setItem(STORAGE_KEYS.DELIVERY_NOTE_COUNTER, counter.toString());
                
                return `${prefix}${String(counter).padStart(3, '0')}`;
            }
        } catch (error) {
            console.error('Error generating delivery note number from database:', error);
            // Fallback to localStorage
        }
    }
    
    // Fallback: use localStorage counter
    let counter = parseInt(localStorage.getItem(STORAGE_KEYS.DELIVERY_NOTE_COUNTER) || '0');
    counter++;
    localStorage.setItem(STORAGE_KEYS.DELIVERY_NOTE_COUNTER, counter.toString());
    
    return `${prefix}${String(counter).padStart(3, '0')}`;
}

// Render Products (for searchable dropdown)
function renderProducts() {
    setupProductSearch();
}

// Setup Product Search - Disabled: Products are loaded from invoices only
function setupProductSearch() {
    // Product search functionality removed - products are loaded from invoices only
    return;
}

// Open New Note with Selected Date
async function openNewNoteWithDate(selectedDate) {
    noteProducts = [];
    const isEdit = document.getElementById('isEdit');
    const noteId = document.getElementById('noteId');
    const modalTitle = document.getElementById('modalTitle');
    const noteForm = document.getElementById('noteForm');
    
    // Check if there's an existing delivery note for this date
    let existingNote = null;
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        const notesForDate = await window.electronAPI.dbGetAll('delivery_notes', 'date = ?', [selectedDate]);
        if (notesForDate && notesForDate.length > 0) {
            existingNote = notesForDate[0]; // Use the first note found for this date
            currentNote = existingNote;
            console.log(`[Delivery Notes] Found existing delivery note for date ${selectedDate}:`, existingNote.id);
        } else {
            currentNote = null;
        }
    } else {
        currentNote = null;
    }
    
    if (existingNote) {
        // Edit mode - load existing note
        isEdit.value = 'true';
        noteId.value = existingNote.id;
        modalTitle.textContent = `إذن صرف - ${new Date(selectedDate).toLocaleDateString('ar-EG')} (تعديل)`;
    } else {
        // New note mode
        isEdit.value = 'false';
        noteId.value = '';
        modalTitle.textContent = `إذن صرف - ${new Date(selectedDate).toLocaleDateString('ar-EG')}`;
    }
    
    if (noteForm) noteForm.reset();
    
    const noteProductsBody = document.getElementById('noteProductsBody');
    if (noteProductsBody) noteProductsBody.innerHTML = '';
    
    // Set selected date
    const dateInput = document.getElementById('noteDate');
    if (dateInput) dateInput.value = selectedDate;
    
    // Load warehouse keeper name (from existing note or company settings)
    const warehouseKeeperNameInput = document.getElementById('warehouseKeeperName');
    if (warehouseKeeperNameInput) {
        if (existingNote && existingNote.warehouseKeeperName) {
            warehouseKeeperNameInput.value = existingNote.warehouseKeeperName;
        } else {
            try {
                const companySettings = await getCompanySettings();
                warehouseKeeperNameInput.value = companySettings.warehouseKeeperName || '';
            } catch (error) {
                console.error('Error loading warehouse keeper name:', error);
                warehouseKeeperNameInput.value = '';
            }
        }
    }
    
    // Load notes if existing
    const notesInput = document.getElementById('notes');
    if (notesInput && existingNote) {
        notesInput.value = existingNote.notes || '';
    }
    
    // Open modal
    const noteModal = document.getElementById('noteModal');
    if (noteModal) noteModal.classList.add('active');
    
    // Re-attach event listeners for print and save buttons (in case modal was recreated)
    const printNoteBtn = document.getElementById('printNoteBtn');
    if (printNoteBtn) {
        // Remove existing listener if any
        const newPrintBtn = printNoteBtn.cloneNode(true);
        printNoteBtn.parentNode.replaceChild(newPrintBtn, printNoteBtn);
        newPrintBtn.addEventListener('click', printCurrentNote);
        console.log('[Delivery Notes] Print button listener attached');
    }
    
    const saveNoteAsPDFBtn = document.getElementById('saveNoteAsPDFBtn');
    if (saveNoteAsPDFBtn) {
        // Remove existing listener if any
        const newSaveBtn = saveNoteAsPDFBtn.cloneNode(true);
        saveNoteAsPDFBtn.parentNode.replaceChild(newSaveBtn, saveNoteAsPDFBtn);
        newSaveBtn.addEventListener('click', saveCurrentNoteAsPDF);
        console.log('[Delivery Notes] Save PDF button listener attached');
    }
    
    // Load products: from existing note items if exists, otherwise from invoices
    if (existingNote) {
        // Load existing note items
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            const noteItems = await window.electronAPI.dbGetAll('delivery_note_items', 'deliveryNoteId = ?', [existingNote.id]);
            if (noteItems && noteItems.length > 0) {
                noteProducts = noteItems.map(item => ({
                    productId: item.productId,
                    productName: item.productName,
                    productCode: item.productCode || '',
                    productCategory: item.productCategory || '',
                    quantity: item.quantity || 0,
                    unit: item.unit || '',
                    unitName: item.unitName || item.unit || '',
                    reservedQuantity: item.reservedQuantity || 0,
                    availableQuantity: item.availableQuantity || 0
                }));
                renderNoteProducts();
                showMessage('تم تحميل إذن الصرف الموجود', 'info');
            } else {
                // No items in existing note, load from invoices
                await loadProductsFromDate(selectedDate);
            }
        } else {
            // Fallback: load from invoices
            await loadProductsFromDate(selectedDate);
        }
    } else {
        // New note: automatically load products from invoices for the selected date
        await loadProductsFromDate(selectedDate);
    }
}

// Open New Note (kept for backward compatibility)
async function openNewNote() {
    const today = new Date().toISOString().split('T')[0];
    await openNewNoteWithDate(today);
}

// Load Products from Date
async function loadProductsFromDate(noteDate) {
    try {
        console.log('[Delivery Notes] loadProductsFromDate called for date:', noteDate);
        
        if (!noteDate) {
            const dateInput = document.getElementById('noteDate');
            if (!dateInput || !dateInput.value) {
                showMessage('يرجى تحديد تاريخ إذن الصرف أولاً', 'error');
                return;
            }
            noteDate = dateInput.value;
        }
        console.log('[Delivery Notes] Loading products for date:', noteDate);
        
        // Get all invoices for today
        if (!window.electronAPI || !window.electronAPI.dbGetAll) {
            showMessage('خطأ في الاتصال بقاعدة البيانات', 'error');
            return;
        }
        
        // Get all invoices for the selected date
        console.log('[Delivery Notes] Fetching invoices for date:', noteDate);
        const allInvoices = await window.electronAPI.dbGetAll('sales_invoices', 'date = ?', [noteDate]);
        console.log('[Delivery Notes] Found invoices:', allInvoices ? allInvoices.length : 0);
        
        if (!allInvoices || allInvoices.length === 0) {
            showMessage('لا توجد فواتير مبيعات في هذا التاريخ', 'info');
            return;
        }
        
        // Filter out cash customer invoices
        const todayInvoices = [];
        for (const invoice of allInvoices) {
            if (!invoice.customerId) {
                continue; // Skip invoices without customer
            }
            
            const customer = await window.electronAPI.dbGet('customers', invoice.customerId);
            if (!customer) {
                continue; // Skip if customer not found
            }
            
            // Check if customer is cash customer (by code)
            const customerCode = (customer.code || '').trim().toUpperCase();
            const isCashCustomer = customerCode === 'CASH';
            
            // Exclude cash customer invoices and their products
            if (!isCashCustomer) {
                todayInvoices.push(invoice);
            }
        }
        
        console.log('[Delivery Notes] Invoices after filtering (excluding cash customer):', todayInvoices.length);
        
        if (todayInvoices.length === 0) {
            showMessage('لا توجد فواتير مبيعات (باستثناء عميل نقدي) في هذا التاريخ', 'info');
            return;
        }
        
        // Collect all products from today's invoices (excluding cash customer)
        const productsMap = new Map(); // key: productId_unit, value: {productId, productName, unit, quantity, ...}
        
        for (const invoice of todayInvoices) {
            console.log('[Delivery Notes] Processing invoice:', invoice.id);
            const invoiceItems = await window.electronAPI.dbGetAll('sales_invoice_items', 'invoiceId = ?', [invoice.id]);
            console.log('[Delivery Notes] Invoice items:', invoiceItems ? invoiceItems.length : 0);
            
            for (const item of invoiceItems || []) {
                if (!item.productId) {
                    console.warn('[Delivery Notes] Skipping item without productId:', item);
                    continue;
                }
                
                const key = `${item.productId}_${item.unit}`;
                
                if (productsMap.has(key)) {
                    // Add to existing quantity
                    const existing = productsMap.get(key);
                    existing.quantity += (item.quantity || 0);
                } else {
                    // Create new entry
                    const product = products.find(p => p.id === item.productId);
                    productsMap.set(key, {
                        productId: item.productId,
                        productName: item.productName || (product ? product.name : ''),
                        productCode: product ? product.code : '',
                        productCategory: product ? product.category : '',
                        quantity: item.quantity || 0,
                        unit: item.unit || 'smallest',
                        unitName: product ? (item.unit === 'largest' ? product.largestUnit : product.smallestUnit) : ''
                    });
                }
            }
        }
        
        console.log('[Delivery Notes] Total unique products found:', productsMap.size);
        
        if (productsMap.size === 0) {
            showMessage('لا توجد منتجات في فواتير هذا التاريخ', 'info');
            return;
        }
        
        // Clear existing products
        noteProducts = [];
        
        // Add all products from map to noteProducts
        for (const [key, productData] of productsMap.entries()) {
            noteProducts.push({
                ...productData,
                reservedQuantity: 0,
                availableQuantity: productData.quantity
            });
        }
        
        // Render products
        renderNoteProducts();
        
        showMessage(`تم تحميل ${productsMap.size} منتج من فواتير التاريخ المحدد`, 'success');
        console.log('[Delivery Notes] Products loaded successfully');
    } catch (error) {
        console.error('[Delivery Notes] Error loading products from invoices:', error);
        showMessage('خطأ في تحميل المنتجات من الفواتير: ' + error.message, 'error');
    }
}

// Add Product to Note - Disabled: Products are loaded from invoices only
function addProductToNote() {
    showMessage('يتم تحميل المنتجات فقط من فواتير المبيعات', 'info');
    return;
}

// Remove Product from Note - Disabled: Products cannot be removed, only loaded from invoices
function removeProduct(index) {
    showMessage('لا يمكن حذف المنتجات. يتم تحميل المنتجات فقط من فواتير المبيعات', 'info');
    return;
}

// Render Note Products
function renderNoteProducts() {
    const tbody = document.getElementById('noteProductsBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (noteProducts.length === 0) {
        // Show empty state message in table
        const emptyRow = document.createElement('tr');
        emptyRow.className = 'empty-products-row';
        emptyRow.innerHTML = `
            <td colspan="3" style="text-align: center; padding: 40px 20px; color: #94a3b8; font-size: 0.875rem;">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                    <span style="font-size: 2rem;">📦</span>
                    <span>لا توجد منتجات مضافة</span>
                </div>
            </td>
        `;
        tbody.appendChild(emptyRow);
        return;
    }
    
    noteProducts.forEach((product, index) => {
        // Load category from product if not available
        let productCategory = product.productCategory;
        if (!productCategory && product.productId) {
            const productData = products.find(p => p.id === product.productId);
            if (productData && productData.category) {
                productCategory = productData.category;
                product.productCategory = productCategory; // Update in array
            }
        }
        
        // Check if product is used in invoices
        const reservedQty = product.reservedQuantity || 0;
        const isUsed = reservedQty > 0;
        const availableQty = product.availableQuantity || 0;
        
        // Create row with different styling if product is used
        const row = document.createElement('tr');
        row.className = 'product-row';
        if (isUsed) {
            row.classList.add('product-used');
        }
        
        // Build quantity display with reserved info if used
        let quantityDisplay = formatArabicNumber(product.quantity);
        let quantityCellClass = 'quantity-cell';
        if (isUsed) {
            quantityCellClass += ' quantity-reserved';
            quantityDisplay = `
                <span class="quantity-value">${formatArabicNumber(product.quantity)}</span>
                <span class="reserved-badge">محجوز: ${formatArabicNumber(reservedQty)}</span>
            `;
        } else {
            quantityDisplay = `<span class="quantity-value">${formatArabicNumber(product.quantity)}</span>`;
        }
        
        row.innerHTML = `
            <td class="product-name-cell">
                <div class="product-name-wrapper">
                    <strong class="product-name">${product.productName}</strong>
                    ${productCategory ? `<span class="product-category-badge">${productCategory}</span>` : ''}
                    ${product.productCode ? `<span class="product-code">(${product.productCode})</span>` : ''}
                    ${isUsed ? '<span class="locked-icon" title="منتج مستخدم في فاتورة">🔒</span>' : ''}
                </div>
            </td>
            <td class="${quantityCellClass}">
                ${quantityDisplay}
            </td>
            <td class="unit-cell">
                <span class="unit-badge">${product.unitName || ''}</span>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Handle Form Submit
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const warehouseKeeperName = document.getElementById('warehouseKeeperName').value;
    const date = document.getElementById('noteDate').value;
    
    if (!warehouseKeeperName || !warehouseKeeperName.trim()) {
        showMessage('يرجى إدخال اسم أمين المخزن أو التلاجة', 'error');
        return;
    }
    
    if (!date) {
        showMessage('يرجى إدخال تاريخ إذن الصرف', 'error');
        return;
    }
    
    if (noteProducts.length === 0) {
        showMessage('يرجى إضافة منتجات لإذن الصرف', 'error');
        return;
    }
    
    try {
        // Check if there's an existing delivery note with the same date
        let existingNote = null;
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            const notesForDate = await window.electronAPI.dbGetAll('delivery_notes', 'date = ?', [date]);
            if (notesForDate && notesForDate.length > 0) {
                // Use the first note found for this date (or currentNote if editing)
                existingNote = currentNote || notesForDate[0];
            }
        }
        
        const noteId = existingNote ? existingNote.id : (currentNote ? currentNote.id : Date.now().toString());
        const isUpdate = existingNote !== null;
        
        const noteData = {
            id: noteId,
            deliveryNoteNumber: existingNote ? existingNote.deliveryNoteNumber : (currentNote ? currentNote.deliveryNoteNumber : await generateDeliveryNoteNumber()),
            date: date,
            warehouseKeeperName: warehouseKeeperName.trim(),
            salesRepName: existingNote ? (existingNote.salesRepName || '') : '', // Preserve existing salesRepName
            status: existingNote ? existingNote.status : 'issued', // Preserve existing status
            totalProducts: noteProducts.length,
            notes: document.getElementById('notes').value || '',
            createdAt: existingNote ? existingNote.createdAt : (currentNote ? currentNote.createdAt : new Date().toISOString()),
            updatedAt: new Date().toISOString()
        };
        
        // Save to database
        if (window.electronAPI && window.electronAPI.dbInsert && window.electronAPI.dbUpdate) {
            const noteDbData = { ...noteData };
            delete noteDbData.items;
            
            if (isUpdate) {
                // Update existing note (same date)
                console.log(`[Delivery Notes] Updating existing delivery note for date: ${date}`);
                const updateResult = await window.electronAPI.dbUpdate('delivery_notes', noteId, noteDbData);
                
                // Check if update was successful
                if (!updateResult || !updateResult.success) {
                    const errorMsg = updateResult?.error || 'خطأ غير معروف';
                    console.error('Failed to update delivery note in database:', errorMsg);
                    throw new Error('فشل تحديث إيصال التسليم في قاعدة البيانات: ' + errorMsg);
                }
                
                // Load existing items from database to preserve reservedQuantity
                const existingItems = await window.electronAPI.dbGetAll('delivery_note_items', 'deliveryNoteId = ?', [noteId]);
                const existingItemsMap = new Map();
                if (existingItems) {
                    existingItems.forEach(item => {
                        const key = `${item.productId}_${item.unit}`;
                        existingItemsMap.set(key, item);
                    });
                }
                
                // Process each product in noteProducts
                for (const product of noteProducts) {
                    const key = `${product.productId}_${product.unit}`;
                    const existingItem = existingItemsMap.get(key);
                    
                    if (existingItem) {
                        // Product exists - update it while preserving reservedQuantity
                        const reservedQty = existingItem.reservedQuantity || 0;
                        const oldQuantity = existingItem.quantity || 0;
                        const newQuantity = product.quantity || 0;
                        
                        // Validate: new quantity must be >= reservedQuantity
                        // Only check if quantity is actually being reduced (not just unchanged or increased)
                        if (reservedQty > 0 && newQuantity < oldQuantity && newQuantity < reservedQty) {
                            throw new Error(`لا يمكن تقليل كمية "${product.productName}" عن ${formatArabicNumber(reservedQty)} لأنها مستخدمة في فاتورة/فواتير`);
                        }
                        
                        // Calculate new availableQuantity
                        // availableQuantity = totalQuantity - reservedQuantity
                        const newAvailableQty = Math.max(0, newQuantity - reservedQty);
                        
                        const updateData = {
                            id: existingItem.id,
                            deliveryNoteId: noteId,
                            productId: product.productId,
                            productName: product.productName,
                            productCode: product.productCode || '',
                            productCategory: product.productCategory || '',
                            quantity: newQuantity,
                            unit: product.unit || '',
                            unitName: product.unitName || '',
                            reservedQuantity: reservedQty, // Preserve reserved quantity
                            availableQuantity: newAvailableQty
                        };
                        
                        const itemUpdateResult = await window.electronAPI.dbUpdate('delivery_note_items', existingItem.id, updateData);
                        if (!itemUpdateResult || !itemUpdateResult.success) {
                            const errorMsg = itemUpdateResult?.error || 'خطأ غير معروف';
                            throw new Error(`فشل تحديث منتج في إذن الصرف: ${errorMsg}`);
                        }
                        
                        // No need to handle stock changes - products come from invoices where stock was already deducted
                        
                        // Mark as processed
                        existingItemsMap.delete(key);
                    } else {
                        // New product - insert it
                        const itemData = {
                            id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
                            deliveryNoteId: noteId,
                            productId: product.productId,
                            productName: product.productName,
                            productCode: product.productCode || '',
                            productCategory: product.productCategory || '',
                            quantity: product.quantity || 0,
                            unit: product.unit || '',
                            unitName: product.unitName || '',
                            reservedQuantity: 0,
                            availableQuantity: product.quantity || 0
                        };
                        
                        const itemInsertResult = await window.electronAPI.dbInsert('delivery_note_items', itemData);
                        if (!itemInsertResult || !itemInsertResult.success) {
                            const errorMsg = itemInsertResult?.error || 'خطأ غير معروف';
                            throw new Error(`فشل إضافة منتج في إذن الصرف: ${errorMsg}`);
                        }
                        
                        // No need to deduct stock - products come from invoices where stock was already deducted
                    }
                }
                
                // Delete items that were removed (but only if not reserved)
                for (const [key, existingItem] of existingItemsMap.entries()) {
                    const reservedQty = existingItem.reservedQuantity || 0;
                    if (reservedQty > 0) {
                        // Cannot delete reserved items - this shouldn't happen if UI is correct
                        console.warn(`[Delivery Notes] Attempted to delete reserved item: ${existingItem.productName} (reserved: ${reservedQty})`);
                        continue;
                    }
                    
                    // No need to restore stock - products come from invoices where stock was already deducted
                    
                    await window.electronAPI.dbDelete('delivery_note_items', existingItem.id);
                }
                
                // NO stock reversion needed for updated items - stock was never deducted when note was created
            } else {
                // Insert new note
                // Add createdBy to track who created this delivery note
                if (!noteDbData.createdBy) {
                    if (typeof addCreatedBy === 'function') {
                        addCreatedBy(noteDbData);
                    } else {
                        const currentUser = localStorage.getItem('asel_user') || localStorage.getItem('asel_userId') || '';
                        if (currentUser) {
                            noteDbData.createdBy = currentUser;
                        }
                    }
                }
                
                const insertResult = await window.electronAPI.dbInsert('delivery_notes', noteDbData);
                
                // Check if insert was successful
                if (!insertResult || !insertResult.success) {
                    const errorMsg = insertResult?.error || 'خطأ غير معروف';
                    console.error('Failed to insert delivery note to database:', errorMsg);
                    throw new Error('فشل حفظ إيصال التسليم في قاعدة البيانات: ' + errorMsg);
                }
                
                // Save note items and deduct stock from warehouse (only for new notes)
                for (const product of noteProducts) {
                    const itemData = {
                        id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
                        deliveryNoteId: noteId,
                        productId: product.productId,
                        productName: product.productName,
                        productCode: product.productCode || '',
                        productCategory: product.productCategory || '',
                        quantity: product.quantity || 0,
                        unit: product.unit || '',
                        unitName: product.unitName || '',
                        reservedQuantity: 0,
                        availableQuantity: product.quantity || 0
                    };
                    const itemInsertResult = await window.electronAPI.dbInsert('delivery_note_items', itemData);
                    
                    // Check if item insert was successful
                    if (!itemInsertResult || !itemInsertResult.success) {
                        const errorMsg = itemInsertResult?.error || 'خطأ غير معروف';
                        console.error('Failed to insert delivery note item to database:', errorMsg);
                        throw new Error('فشل حفظ عنصر إيصال التسليم في قاعدة البيانات: ' + errorMsg);
                    }
                    
                    // No need to deduct stock - products come from invoices where stock was already deducted
                }
            }
        }
        
        // Update local array
        if (isUpdate || currentNote) {
            const noteIdToFind = existingNote ? existingNote.id : (currentNote ? currentNote.id : noteId);
            const index = deliveryNotes.findIndex(n => n.id === noteIdToFind);
            if (index !== -1) {
                deliveryNotes[index] = { ...noteData, items: noteProducts };
            } else {
                // If not found in local array, add it
                deliveryNotes.push({ ...noteData, items: noteProducts });
            }
        } else {
            deliveryNotes.push({ ...noteData, items: noteProducts });
        }
        
        // Update currentNote to reflect the saved note
        currentNote = { ...noteData, items: noteProducts };
        
        // Clear noteProducts after save
        noteProducts = [];
        
        // Close modal
        closeModalHandler();
        const message = isUpdate ? 'تم تحديث إذن الصرف بنجاح' : 'تم حفظ إذن الصرف بنجاح';
        showMessage(message, 'success');
    } catch (error) {
        console.error('Error saving delivery note:', error);
        showMessage('خطأ في حفظ إذن الصرف: ' + error.message, 'error');
    }
}

// Update Product Stock from Note
// Deduct stock from warehouse when delivery note is created
async function updateProductStockFromNote(noteProduct) {
    try {
        let product = null;
        if (window.electronAPI && window.electronAPI.dbGet) {
            product = await window.electronAPI.dbGet('products', noteProduct.productId);
        }
        
        if (!product) {
            console.error('Product not found:', noteProduct.productId);
            return;
        }
        
        // Calculate quantity to subtract in smallest unit
        let quantityToSubtract = noteProduct.quantity || 0;
        
        // If unit is largest, convert to smallest
        if (noteProduct.unit === 'largest') {
            const conversionFactor = product.conversionFactor || 1;
            quantityToSubtract = noteProduct.quantity * conversionFactor;
        }
        
        // Update stock
        const currentStock = parseFloat(product.stock) || 0;
        const newStock = Math.max(0, currentStock - quantityToSubtract);
        
        product.stock = newStock;
        product.updatedAt = new Date().toISOString();
        
        // Update product in database
        if (window.electronAPI && window.electronAPI.dbUpdate) {
            await window.electronAPI.dbUpdate('products', product.id, product);
            console.log(`[Delivery Notes] Deducted product ${product.name} stock: ${currentStock} -> ${newStock} (-${quantityToSubtract})`);
        }
    } catch (error) {
        console.error('Error updating product stock from delivery note:', error);
    }
}

// Revert Product Stock from Note (for editing)
// Restore stock when delivery note is deleted or edited
async function revertProductStockFromNote(noteItem) {
    try {
        let product = null;
        if (window.electronAPI && window.electronAPI.dbGet) {
            product = await window.electronAPI.dbGet('products', noteItem.productId);
        }
        
        if (!product) {
            console.error('Product not found:', noteItem.productId);
            return;
        }
        
        // Calculate quantity to add back in smallest unit
        // Use availableQuantity if available, otherwise use quantity
        let quantityToAdd = noteItem.availableQuantity || noteItem.quantity || 0;
        
        // If unit is largest, convert to smallest
        if (noteItem.unit === 'largest') {
            const conversionFactor = product.conversionFactor || 1;
            quantityToAdd = (noteItem.availableQuantity || noteItem.quantity || 0) * conversionFactor;
        }
        
        // Restore stock
        const currentStock = parseFloat(product.stock) || 0;
        const newStock = currentStock + quantityToAdd;
        
        product.stock = newStock;
        product.updatedAt = new Date().toISOString();
        
        // Update product in database
        if (window.electronAPI && window.electronAPI.dbUpdate) {
            await window.electronAPI.dbUpdate('products', product.id, product);
            console.log(`[Delivery Notes] Restored product ${product.name} stock: ${currentStock} -> ${newStock} (+${quantityToAdd})`);
        }
    } catch (error) {
        console.error('Error reverting product stock from delivery note:', error);
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
    
    // Start with all notes
    filteredNotes = [...deliveryNotes];
    
    console.log('[Delivery Notes] applyFilters - deliveryNotes:', deliveryNotes.length, 'filteredNotes:', filteredNotes.length);
    
    // Apply search filter
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredNotes = filteredNotes.filter(note => {
            // Search by delivery note number
            const noteNumber = (note.deliveryNoteNumber || '').toLowerCase();
            if (noteNumber.includes(query)) return true;
            
            // Search by warehouse keeper name
            const keeperName = (note.warehouseKeeperName || note.salesRepName || '').toLowerCase();
            if (keeperName.includes(query)) return true;
            
            return false;
        });
    }
    
    // Apply date range filter (use effectiveDateFrom and effectiveDateTo)
    if (effectiveDateFrom) {
        filteredNotes = filteredNotes.filter(note => {
            return new Date(note.date) >= new Date(effectiveDateFrom);
        });
    }
    
    if (effectiveDateTo) {
        filteredNotes = filteredNotes.filter(note => {
            const noteDate = new Date(note.date);
            const toDate = new Date(effectiveDateTo);
            toDate.setHours(23, 59, 59, 999); // Include entire day
            return noteDate <= toDate;
        });
    }
    
    // Apply status filter
    if (statusFilter) {
        filteredNotes = filteredNotes.filter(note => {
            return note.status === statusFilter;
        });
    }
    
    // Apply sorting
    filteredNotes.sort((a, b) => {
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
                return (b.noteNumber || '').localeCompare(a.noteNumber || '');
            case 'number-asc':
                return (a.noteNumber || '').localeCompare(b.noteNumber || '');
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
    const totalPages = Math.ceil(filteredNotes.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
        currentPage = 1;
    }

    renderNotes();
}

// Render Notes
function renderNotes() {
    const tbody = document.getElementById('notesTableBody');
    const emptyState = document.getElementById('emptyState');
    const paginationContainer = document.getElementById('paginationContainer');
    
    console.log('[Delivery Notes] renderNotes - tbody:', tbody, 'filteredNotes:', filteredNotes.length);
    
    if (!tbody) {
        console.error('[Delivery Notes] notesTableBody not found!');
        return;
    }
    
    tbody.innerHTML = '';
    
    if (filteredNotes.length === 0) {
        console.log('[Delivery Notes] No notes to display, showing empty state');
        if (emptyState) emptyState.classList.remove('hidden');
        if (paginationContainer) paginationContainer.classList.add('hidden');
        return;
    }
    
    if (emptyState) emptyState.classList.add('hidden');
    if (paginationContainer) paginationContainer.classList.remove('hidden');
    
    const totalPages = Math.ceil(filteredNotes.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredNotes.length);
    const paginatedNotes = filteredNotes.slice(startIndex, endIndex);
    
    // Get current logged-in user type
    const currentUserType = localStorage.getItem('asel_userType') || '';
    const canDeleteSettledNotes = currentUserType === 'manager' || currentUserType === 'system_engineer';
    
    const paginationInfo = document.getElementById('paginationInfo');
    if (paginationInfo) {
        paginationInfo.textContent = `عرض ${startIndex + 1} - ${endIndex} من ${filteredNotes.length}`;
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
    
    paginatedNotes.forEach(note => {
        const statusText = note.status === 'issued' ? 'صادر' : note.status === 'returned' ? 'راجع' : 'تم التسوية';
        const isSettled = note.status === 'settled';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${note.deliveryNoteNumber}</td>
            <td>${new Date(note.date).toLocaleDateString('ar-EG')}</td>
            <td><strong>${note.warehouseKeeperName || note.salesRepName || ''}</strong></td>
            <td>${note.totalProducts || 0}</td>
            <td><span class="status-badge status-${note.status}"><strong>${statusText}</strong></span></td>
            <td class="created-by-cell">${note.createdBy || '-'}</td>
            <td>
                <div class="actions-buttons">
                    <button class="action-btn view" data-note-id="${note.id}" title="عرض">👁️</button>
                    ${note.status === 'issued' ? `<button class="action-btn edit" data-note-id="${note.id}" title="تعديل">✏️</button>` : ''}
                    <button class="action-btn print" data-note-id="${note.id}" title="طباعة">🖨️</button>
                    <button class="action-btn save" data-note-id="${note.id}" title="حفظ">💾</button>
                </div>
            </td>
        `;
        
        // Add event listeners to buttons
        const viewBtn = row.querySelector('.action-btn.view');
        const editBtn = row.querySelector('.action-btn.edit');
        const printBtn = row.querySelector('.action-btn.print');
        const saveBtn = row.querySelector('.action-btn.save');
        const actionsDiv = row.querySelector('.actions-buttons');
        
        if (viewBtn) {
            viewBtn.addEventListener('click', () => viewNote(note.id));
        }
        if (editBtn) {
            editBtn.addEventListener('click', () => editNote(note.id));
        }
        if (printBtn) {
            printBtn.addEventListener('click', () => printNoteById(note.id));
        }
        if (saveBtn) {
            saveBtn.addEventListener('click', () => saveNoteAsPDF(note.id));
        }
        
        // Add delete button only if note status is 'issued' (صادر) - prevent deletion if status is 'settled' (تم التسوية)
        if (note.status === 'issued') {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'action-btn delete';
            deleteBtn.textContent = '🗑️';
            deleteBtn.type = 'button';
            deleteBtn.title = 'حذف';
            deleteBtn.setAttribute('data-note-id', note.id);
            deleteBtn.addEventListener('click', () => deleteNote(note.id));
            if (actionsDiv) {
                actionsDiv.appendChild(deleteBtn);
            }
        }
        
        tbody.appendChild(row);
    });
}

// View Note
async function viewNote(noteId) {
    const note = deliveryNotes.find(n => n.id === noteId);
    if (!note) {
        showMessage('إذن الصرف غير موجود', 'error');
        return;
    }
    
    try {
        const viewContent = await generatePrintContent(note);
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
        console.error('Error viewing note:', error);
        showMessage('خطأ في عرض إذن الصرف: ' + error.message, 'error');
    }
}

// Edit Note
async function editNote(noteId) {
    const note = deliveryNotes.find(n => n.id === noteId);
    if (!note) {
        showMessage('إذن الصرف غير موجود', 'error');
        return;
    }
    
    // Check if note is settled (closed)
    if (note.status === 'settled') {
        showMessage('لا يمكن تعديل إذن الصرف لأنه تمت تسويته (مقفل)', 'error');
        return;
    }
    
    // Allow editing even if note has linked invoices
    // But products used in invoices (reservedQuantity > 0) cannot be deleted
    // and their quantities cannot be reduced below reservedQuantity
    
    currentNote = note;
    
    // Load note items with reservedQuantity and availableQuantity from database
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            const noteItems = await window.electronAPI.dbGetAll('delivery_note_items', 'deliveryNoteId = ?', [noteId]);
            if (noteItems && noteItems.length > 0) {
                noteProducts = noteItems.map(item => ({
                    productId: item.productId,
                    productName: item.productName,
                    productCode: item.productCode || '',
                    productCategory: item.productCategory || '',
                    quantity: item.quantity || 0,
                    unit: item.unit || '',
                    unitName: item.unitName || item.unit || '',
                    reservedQuantity: item.reservedQuantity || 0,
                    availableQuantity: item.availableQuantity || 0
                }));
            } else {
                noteProducts = [...(note.items || [])];
            }
        } catch (error) {
            console.error('Error loading note items:', error);
            noteProducts = [...(note.items || [])];
        }
    } else {
        noteProducts = [...(note.items || [])];
    }
    
    const isEdit = document.getElementById('isEdit');
    const noteIdInput = document.getElementById('noteId');
    const modalTitle = document.getElementById('modalTitle');
    
    if (isEdit) isEdit.value = 'true';
    if (noteIdInput) noteIdInput.value = note.id;
    if (modalTitle) modalTitle.textContent = `تعديل إذن صرف ${note.deliveryNoteNumber}`;
    
    const warehouseKeeperName = document.getElementById('warehouseKeeperName');
    const noteDate = document.getElementById('noteDate');
    const notes = document.getElementById('notes');
    
    if (warehouseKeeperName) warehouseKeeperName.value = note.warehouseKeeperName || note.salesRepName || '';
    if (noteDate) noteDate.value = note.date || '';
    if (notes) notes.value = note.notes || '';
    
    renderNoteProducts();
    
    const noteModal = document.getElementById('noteModal');
    if (noteModal) noteModal.classList.add('active');
    
    // Re-attach event listeners for print and save buttons (in case modal was recreated)
    const printNoteBtn = document.getElementById('printNoteBtn');
    if (printNoteBtn) {
        // Remove existing listener if any
        const newPrintBtn = printNoteBtn.cloneNode(true);
        printNoteBtn.parentNode.replaceChild(newPrintBtn, printNoteBtn);
        newPrintBtn.addEventListener('click', printCurrentNote);
        console.log('[Delivery Notes] Print button listener attached in editNote');
    }
    
    const saveNoteAsPDFBtn = document.getElementById('saveNoteAsPDFBtn');
    if (saveNoteAsPDFBtn) {
        // Remove existing listener if any
        const newSaveBtn = saveNoteAsPDFBtn.cloneNode(true);
        saveNoteAsPDFBtn.parentNode.replaceChild(newSaveBtn, saveNoteAsPDFBtn);
        newSaveBtn.addEventListener('click', saveCurrentNoteAsPDF);
        console.log('[Delivery Notes] Save PDF button listener attached in editNote');
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

// Delete Note
async function deleteNote(noteId) {
    const note = deliveryNotes.find(n => n.id === noteId);
    if (!note) {
        showMessage('إذن الصرف غير موجود', 'error');
        return;
    }
    
    // Check if note is settled (closed) - prevent deletion for all users
    if (note.status === 'settled') {
        if (window.showToast) {
            window.showToast('لا يمكن حذف إذن الصرف لأنه في حالة "تم التسوية"', 'error', 5000);
        } else {
            showMessage('لا يمكن حذف إذن الصرف لأنه في حالة "تم التسوية"', 'error');
        }
        return;
    }
    
    // Allow all users to delete issued (صادر) notes
    // Only manager/system_engineer can delete settled notes (checked above)
    
    // Check if note has linked invoices
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        const linkedInvoices = await window.electronAPI.dbGetAll('sales_invoices', 'deliveryNoteId = ?', [noteId]);
        if (linkedInvoices && linkedInvoices.length > 0) {
            showMessage('لا يمكن حذف إذن الصرف لأنه مرتبط بفاتورة/فواتير', 'error');
            return;
        }
    }
    
    // Use custom confirmation dialog instead of confirm()
    showConfirmDialog(
        'هل أنت متأكد من حذف إذن الصرف؟',
        () => {
            // User confirmed - proceed with deletion
            proceedWithNoteDeletion(noteId);
        },
        () => {
            // User cancelled - do nothing
        }
    );
}

// Proceed with note deletion
async function proceedWithNoteDeletion(noteId) {
    
    try {
        // Get the note to check its status
        let note = deliveryNotes.find(n => n.id === noteId);
        if (!note && window.electronAPI && window.electronAPI.dbGet) {
            note = await window.electronAPI.dbGet('delivery_notes', noteId);
        }
        
        console.log(`[Delivery Notes] Starting deletion of note ${noteId}`);
        console.log(`[Delivery Notes] Note status: ${note ? note.status : 'unknown'}`);
        
        // No need to restore stock - products come from invoices where stock was already deducted
        
        // Check for linked settlements first (must be deleted before delivery note)
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            const linkedSettlements = await window.electronAPI.dbGetAll('delivery_settlements', 'deliveryNoteId = ?', [noteId]);
            if (linkedSettlements && linkedSettlements.length > 0) {
                console.log(`[Delivery Notes] Found ${linkedSettlements.length} settlements linked to this note. Deleting settlements first...`);
                
                // Delete settlement items first (foreign key constraint)
                for (const settlement of linkedSettlements) {
                    if (window.electronAPI.dbQuery) {
                        await window.electronAPI.dbQuery('DELETE FROM settlement_items WHERE settlementId = ?', [settlement.id]);
                    } else if (window.electronAPI.dbGetAll && window.electronAPI.dbDelete) {
                        const settlementItems = await window.electronAPI.dbGetAll('settlement_items', 'settlementId = ?', [settlement.id]);
                        if (settlementItems && settlementItems.length > 0) {
                            for (const item of settlementItems) {
                                await window.electronAPI.dbDelete('settlement_items', item.id);
                            }
                        }
                    }
                    
                    // Delete settlement
                    if (window.electronAPI.dbDelete) {
                        await window.electronAPI.dbDelete('delivery_settlements', settlement.id);
                        console.log(`[Delivery Notes] Deleted settlement ${settlement.id}`);
                    }
                }
            }
        }
        
        // Delete note items from database (foreign key constraint - has ON DELETE CASCADE but we delete manually to be safe)
        if (window.electronAPI && window.electronAPI.dbQuery) {
            const itemsDeleteResult = await window.electronAPI.dbQuery('DELETE FROM delivery_note_items WHERE deliveryNoteId = ?', [noteId]);
            console.log(`[Delivery Notes] Deleted note items:`, itemsDeleteResult);
        } else if (window.electronAPI && window.electronAPI.dbGetAll && window.electronAPI.dbDelete) {
            const noteItems = await window.electronAPI.dbGetAll('delivery_note_items', 'deliveryNoteId = ?', [noteId]);
            if (noteItems && noteItems.length > 0) {
                console.log(`[Delivery Notes] Found ${noteItems.length} note items to delete`);
                for (const item of noteItems) {
                    const itemDeleteResult = await window.electronAPI.dbDelete('delivery_note_items', item.id);
                    console.log(`[Delivery Notes] Deleted item ${item.id}:`, itemDeleteResult);
                }
            }
        }
        
        // Delete note from database
        if (window.electronAPI && window.electronAPI.dbDelete) {
            console.log(`[Delivery Notes] Deleting note ${noteId} from database...`);
            const deleteResult = await window.electronAPI.dbDelete('delivery_notes', noteId);
            console.log(`[Delivery Notes] Delete result:`, deleteResult);
            
            // Check if deletion failed
            if (deleteResult && deleteResult.success === false) {
                throw new Error(deleteResult.error || 'فشل حذف إذن الصرف من قاعدة البيانات');
            }
            // Check if no rows were deleted (note doesn't exist or already deleted)
            if (deleteResult && deleteResult.changes !== undefined && deleteResult.changes === 0) {
                console.warn(`[Delivery Notes] Note ${noteId} was not found in database or already deleted`);
            } else {
                console.log(`[Delivery Notes] Successfully deleted note ${noteId} from database`);
            }
        } else {
            // Fallback to localStorage if database API is not available
            console.log(`[Delivery Notes] Database API not available, using localStorage fallback`);
            deliveryNotes = deliveryNotes.filter(n => n.id !== noteId);
            localStorage.setItem(STORAGE_KEYS.DELIVERY_NOTES, JSON.stringify(deliveryNotes));
        }
        
        // Reload from database (this will update deliveryNotes array)
        console.log(`[Delivery Notes] Reloading data from database...`);
        await loadData();
        console.log(`[Delivery Notes] Data reloaded. Total notes: ${deliveryNotes.length}`);
        
        // Apply filters and re-render the table
        currentPage = 1;
        applyFilters(); // This will call renderNotes() at the end
        
        showMessage('تم حذف إذن الصرف بنجاح', 'success');
    } catch (error) {
        console.error('Error deleting delivery note:', error);
        showMessage('خطأ في حذف إذن الصرف: ' + error.message, 'error');
    }
}

// Print Current Note (from modal)
async function printCurrentNote() {
    try {
        // Check if we have products loaded
        if (!noteProducts || noteProducts.length === 0) {
            showMessage('لا توجد منتجات للطباعة. يرجى تحميل المنتجات أولاً', 'error');
            return;
        }
        
        // Get form data
        const dateInput = document.getElementById('noteDate');
        const warehouseKeeperNameInput = document.getElementById('warehouseKeeperName');
        const notesInput = document.getElementById('notes');
        
        if (!dateInput || !dateInput.value) {
            showMessage('يرجى تحديد التاريخ', 'error');
            return;
        }
        
        if (!warehouseKeeperNameInput || !warehouseKeeperNameInput.value.trim()) {
            showMessage('يرجى إدخال اسم أمين المخزن', 'error');
            return;
        }
        
        // Create a temporary note object for printing
        const tempNote = {
            id: currentNote ? currentNote.id : Date.now().toString(),
            deliveryNoteNumber: currentNote ? currentNote.deliveryNoteNumber : `DN-TEMP-${Date.now()}`,
            date: dateInput.value,
            warehouseKeeperName: warehouseKeeperNameInput.value.trim(),
            salesRepName: '',
            status: 'issued',
            totalProducts: noteProducts.length,
            notes: notesInput ? (notesInput.value || '') : '',
            createdAt: currentNote ? currentNote.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            items: noteProducts.map(p => ({
                productId: p.productId,
                productName: p.productName,
                productCode: p.productCode || '',
                productCategory: p.productCategory || '',
                quantity: p.quantity || 0,
                unit: p.unit || '',
                unitName: p.unitName || p.unit || '',
                reservedQuantity: p.reservedQuantity || 0,
                availableQuantity: p.availableQuantity || 0
            }))
        };
        
        // Print the note
        await openPrintWindow(tempNote);
    } catch (error) {
        console.error('Error printing note:', error);
        showMessage('خطأ في الطباعة: ' + error.message, 'error');
    }
}

// Save Current Note as PDF (from modal)
async function saveCurrentNoteAsPDF() {
    try {
        // Check if we have products loaded
        if (!noteProducts || noteProducts.length === 0) {
            showMessage('لا توجد منتجات للحفظ. يرجى تحميل المنتجات أولاً', 'error');
            return;
        }
        
        // Get form data
        const dateInput = document.getElementById('noteDate');
        const warehouseKeeperNameInput = document.getElementById('warehouseKeeperName');
        const notesInput = document.getElementById('notes');
        
        if (!dateInput || !dateInput.value) {
            showMessage('يرجى تحديد التاريخ', 'error');
            return;
        }
        
        if (!warehouseKeeperNameInput || !warehouseKeeperNameInput.value.trim()) {
            showMessage('يرجى إدخال اسم أمين المخزن', 'error');
            return;
        }
        
        // Create a temporary note object for saving
        const tempNote = {
            id: currentNote ? currentNote.id : Date.now().toString(),
            deliveryNoteNumber: currentNote ? currentNote.deliveryNoteNumber : `DN-TEMP-${Date.now()}`,
            date: dateInput.value,
            warehouseKeeperName: warehouseKeeperNameInput.value.trim(),
            salesRepName: '',
            status: 'issued',
            totalProducts: noteProducts.length,
            notes: notesInput ? (notesInput.value || '') : '',
            createdAt: currentNote ? currentNote.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            items: noteProducts.map(p => ({
                productId: p.productId,
                productName: p.productName,
                productCode: p.productCode || '',
                productCategory: p.productCategory || '',
                quantity: p.quantity || 0,
                unit: p.unit || '',
                unitName: p.unitName || p.unit || '',
                reservedQuantity: p.reservedQuantity || 0,
                availableQuantity: p.availableQuantity || 0
            }))
        };
        
        // Save as PDF
        const printContent = await generatePrintContent(tempNote);
        const dateStr = new Date(tempNote.date).toISOString().split('T')[0];
        const fileName = `اذن_صرف_${tempNote.deliveryNoteNumber}_${dateStr}.pdf`;
        
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
            showMessage('وظيفة حفظ PDF غير متاحة. يرجى استخدام الطباعة وحفظ كـ PDF', 'error');
        }
    } catch (error) {
        console.error('Error saving PDF:', error);
        showMessage('خطأ في حفظ PDF: ' + error.message, 'error');
    }
}

// Print Note by ID
function printNoteById(noteId) {
    const note = deliveryNotes.find(n => n.id === noteId);
    if (note) {
        openPrintWindow(note);
    } else {
        // Try to load from database
        if (window.electronAPI && window.electronAPI.dbGet) {
            window.electronAPI.dbGet('delivery_notes', noteId).then(note => {
                if (note) {
                    openPrintWindow(note);
                } else {
                    showMessage('إذن الصرف غير موجود', 'error');
                }
            }).catch(error => {
                console.error('Error loading note for print:', error);
                showMessage('خطأ في تحميل إذن الصرف', 'error');
            });
        } else {
            showMessage('إذن الصرف غير موجود', 'error');
        }
    }
}

// Save Note as PDF
async function saveNoteAsPDF(noteId) {
    const note = deliveryNotes.find(n => n.id === noteId);
    if (!note) {
        showMessage('إذن الصرف غير موجود', 'error');
        return;
    }
    
    try {
        const printContent = await generatePrintContent(note);
        const fileName = `اذن_صرف_${note.deliveryNoteNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
        
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
            printNoteById(noteId);
        }
    } catch (error) {
        console.error('Error saving PDF:', error);
        showMessage('خطأ في حفظ PDF: ' + error.message, 'error');
        // Fallback to print
        printNoteById(noteId);
    }
}

// Open Print Window
async function openPrintWindow(note) {
    try {
        const printContent = await generatePrintContent(note);
        
        // Try to open window - use a visible size first to avoid popup blockers
        let printWindow = window.open('', '_blank', 'width=800,height=600');
        
        // If blocked, try with blob URL as fallback
        if (!printWindow || printWindow.closed || typeof printWindow.closed === 'undefined') {
            console.log('Window.open blocked, trying blob URL...');
            const blob = new Blob([printContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            printWindow = window.open(url, '_blank', 'width=800,height=600');
            URL.revokeObjectURL(url);
            
            if (!printWindow || printWindow.closed || typeof printWindow.closed === 'undefined') {
                console.error('Failed to open print window - may be blocked');
                showMessage('فشل فتح نافذة الطباعة. يرجى التحقق من إعدادات منع النوافذ المنبثقة', 'error');
                return;
            }
        }
        
        printWindow.document.write(printContent);
        printWindow.document.close();
        
        // Wait for content to load, then print directly
        printWindow.onload = () => {
            setTimeout(() => {
                try {
                    // Print directly - this will open print dialog
                    printWindow.print();
                } catch (printError) {
                    console.error('Error calling print():', printError);
                    showMessage('تم فتح نافذة الطباعة. يرجى استخدام زر الطباعة في المتصفح (Ctrl+P)', 'info');
                }
            }, 300);
        };
        
        // Fallback timeout in case onload doesn't fire
        setTimeout(() => {
            try {
                if (printWindow && !printWindow.closed) {
                    printWindow.print();
                }
            } catch (printError) {
                console.error('Error calling print() in timeout:', printError);
                showMessage('تم فتح نافذة الطباعة. يرجى استخدام زر الطباعة في المتصفح (Ctrl+P)', 'info');
            }
        }, 1000);
    } catch (error) {
        console.error('Error in openPrintWindow:', error);
        showMessage('خطأ في طباعة إذن الصرف: ' + error.message, 'error');
    }
}

// Generate Print Content
async function generatePrintContent(note) {
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
    
    const companyName = companySettings.name && companySettings.name.trim() ? companySettings.name : 'شركة أسيل';
    const companyAddress = companySettings.address && companySettings.address.trim() ? companySettings.address : '';
    const companyPhone = companySettings.phone && companySettings.phone.trim() ? companySettings.phone : (companySettings.mobile && companySettings.mobile.trim() ? companySettings.mobile : '');
    const defaultSalesRepName = companySettings.salesRepName || '';
    const defaultSalesRepPhone = companySettings.salesRepPhone || '';
    const defaultWarehouseKeeperName = companySettings.warehouseKeeperName || '';
    const defaultWarehouseKeeperPhone = companySettings.warehouseKeeperPhone || '';
    
    const statusText = note.status === 'issued' ? 'صادر' : note.status === 'returned' ? 'راجع' : 'تم التسوية';
    
    // Load note items if not loaded
    let noteItems = note.items || [];
    if (!noteItems || noteItems.length === 0) {
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            const items = await window.electronAPI.dbGetAll('delivery_note_items', 'deliveryNoteId = ?', [note.id]);
            noteItems = (items || []).map(item => ({
                productId: item.productId,
                productName: item.productName,
                productCode: item.productCode || '',
                quantity: item.quantity || 0,
                unit: item.unit || '',
                unitName: item.unitName || item.unit || ''
            }));
        }
    }
    
    // Load product categories for each item
    if (window.electronAPI && window.electronAPI.dbGet) {
        for (let item of noteItems) {
            if (item.productId && !item.productCategory) {
                try {
                    const product = await window.electronAPI.dbGet('products', item.productId);
                    if (product) {
                        item.productCategory = product.category || 'غير محدد';
                    } else {
                        item.productCategory = 'غير محدد';
                    }
                } catch (error) {
                    console.error('Error loading product category:', error);
                    item.productCategory = 'غير محدد';
                }
            } else if (!item.productCategory) {
                item.productCategory = 'غير محدد';
            }
        }
    }
    
    // Calculate estimated height to determine if we need to split the table
    // A4 height: 297mm, margins: 8mm top + 8mm bottom = 16mm, available: 281mm
    // Strategy: Always keep both copies on one page, split table if content exceeds A4
    const itemsCount = noteItems.length;
    const hasNotes = note.notes && note.notes.trim();
    const notesText = hasNotes ? note.notes.trim() : '';
    const notesLines = hasNotes ? Math.ceil(notesText.length / 50) : 0; // Approximate 50 chars per line
    const notesHeight = notesLines > 0 ? (notesLines * 8) + 12 : 0; // 8mm per line + 12mm for padding/border
    const commitmentHeight = 45; // Commitment text is ~45mm (only in salesrep copy)
    // Base height breakdown: header (20mm) + title (10mm) + info (12mm) + signatures (60mm) + footer (8mm) = ~110mm
    const baseHeight = 110; 
    const tableHeaderHeight = 7; // Table header height
    const cutLineHeight = 2; // Cut line height
    const A4_AVAILABLE_HEIGHT = 281; // A4 available height in mm
    
    // Fixed content height (without table)
    // Base content appears twice (warehouse + salesrep) + commitment (salesrep only) + cut line
    const fixedContentHeight = (baseHeight * 2) + commitmentHeight + cutLineHeight + (notesHeight * 2);
    // Available height for table (appears in both copies)
    // If fixed content exceeds A4, we still try to fit table (will be compressed)
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
    const warehouseCopyHeight = baseHeight + tableHeight + notesHeight;
    const salesrepCopyHeight = baseHeight + tableHeight + commitmentHeight + notesHeight;
    const totalEstimatedHeight = warehouseCopyHeight + salesrepCopyHeight + cutLineHeight;
    
    // Split pages if items count > 20 (each copy on separate page, enlarged to fill page)
    const shouldSplitPages = itemsCount > 20;
    
    // Log decision for debugging
    console.log(`[Delivery Note] Items: ${itemsCount}, Fixed content: ${fixedContentHeight.toFixed(1)}mm, ` +
        `Available for table: ${availableHeightForTable.toFixed(1)}mm, ` +
        `Single table: ${singleTableTotalHeight.toFixed(1)}mm, Split table: ${splitTableTotalHeight.toFixed(1)}mm, ` +
        `Table split: ${shouldSplitTable}, Pages split: ${shouldSplitPages}, Total: ${totalEstimatedHeight.toFixed(1)}mm, Notes: ${notesLines} lines`);
    
    // Helper function to generate a single copy content
    const generateCopyContent = (copyType, copyTitle) => {
        return `
    <div class="delivery-note-container">
        <div class="copy-label">${copyTitle}</div>
        <div class="header">
            <img src="${logoBase64 || logoPath}" alt="Logo" class="company-logo" />
            <div>
                <div class="company-name">${companyName}</div>
                ${companyAddress || companyPhone ? `<div class="company-info">${companyAddress ? companyAddress : ''}${companyAddress && companyPhone ? ' - ' : ''}${companyPhone ? companyPhone : ''}</div>` : ''}
            </div>
        </div>
        <div class="invoice-title">إذن صرف</div>
        <div class="info-section">
            <div class="info-line info-line-main">
                <div class="info-line-left">
                    <span class="info-label">رقم الإذن:</span>
                    <span class="info-value info-value-important">${note.deliveryNoteNumber}</span>
                    <span class="info-separator">|</span>
                    <span class="info-label">التاريخ:</span>
                    <span class="info-value">${new Date(note.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    <span class="info-separator">|</span>
                    <span class="info-label">الحالة:</span>
                    <span class="info-value info-value-important">${statusText}</span>
                    <span class="info-separator">|</span>
                    <span class="info-label">عدد المنتجات:</span>
                    <span class="info-value info-value-important">${noteItems.length}</span>
                </div>
                <div class="info-line-right">
                    <span class="info-label">${copyType === 'warehouse' ? 'أمين المخزن / التلاجة:' : 'المندوب:'}</span>
                    <span class="info-value info-value-important">${copyType === 'warehouse' ? (note.warehouseKeeperName || defaultWarehouseKeeperName || '') : (note.salesRepName || defaultSalesRepName || '')}</span>
                    ${copyType === 'warehouse' && defaultWarehouseKeeperPhone ? `<span class="info-separator">|</span><span class="info-label">رقم التليفون:</span><span class="info-value">${defaultWarehouseKeeperPhone}</span>` : ''}
                    ${copyType === 'salesrep' && defaultSalesRepPhone ? `<span class="info-separator">|</span><span class="info-label">رقم التليفون:</span><span class="info-value">${defaultSalesRepPhone}</span>` : ''}
                </div>
            </div>
        </div>
        <div class="products-section">
            <h4>المنتجات المطلوب استخراجها</h4>
            ${(() => {
                // Use shouldSplitTable from outer scope (calculated based on A4 height)
                const halfCount = Math.ceil(itemsCount / 2);
                
                if (shouldSplitTable) {
                    const firstHalf = noteItems.slice(0, halfCount);
                    const secondHalf = noteItems.slice(halfCount);
                    
                    const generateTable = (items, startIndex) => `
                        <table class="products-table products-table-split">
                            <thead>
                                <tr>
                                    <th style="width: 25px;">#</th>
                                    <th>اسم المنتج</th>
                                    <th style="width: 60px;">نوع</th>
                                    <th style="width: 60px;">الكود</th>
                                    <th style="width: 50px;">الكمية</th>
                                    <th style="width: 50px;">الوحدة</th>
                                    <th style="width: 55px;">تم الاستخراج</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${items.map((item, idx) => `
                                <tr>
                                    <td style="text-align: center; font-weight: bold;">${startIndex + idx + 1}</td>
                                    <td style="font-size: 10px !important; font-weight: bold !important; padding: 3px 2px !important;"><strong>${item.productName}</strong></td>
                                    <td style="text-align: center; font-size: 9px !important; font-weight: bold !important; padding: 3px 2px !important;">${item.productCategory || 'غير محدد'}</td>
                                    <td style="text-align: center;">${item.productCode || '-'}</td>
                                    <td style="text-align: center; font-weight: bold; font-size: 14px !important;">${formatArabicNumber(item.quantity)}</td>
                                    <td style="text-align: center;">${item.unitName || item.unit || ''}</td>
                                    <td style="text-align: center;">
                                        <div style="border: 1px solid #333; height: 16px; width: 100%; margin: 0 auto;"></div>
                                    </td>
                                </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `;
                    
                    return `
                        <div class="products-tables-container">
                            ${generateTable(firstHalf, 0)}
                            ${generateTable(secondHalf, halfCount)}
                        </div>
                    `;
                } else {
                    return `
                        <table class="products-table">
                            <thead>
                                <tr>
                                    <th style="width: 30px;">#</th>
                                    <th>اسم المنتج</th>
                                    <th style="width: 80px;">نوع المنتج</th>
                                    <th style="width: 80px;">الكود</th>
                                    <th style="width: 60px;">الكمية</th>
                                    <th style="width: 60px;">الوحدة</th>
                                    <th style="width: 70px;">تم الاستخراج</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${noteItems.map((item, index) => `
                                <tr>
                                    <td style="text-align: center; font-weight: bold;">${index + 1}</td>
                                    <td style="font-size: 11px !important; font-weight: bold !important; padding: 4px 3px !important;"><strong>${item.productName}</strong></td>
                                    <td style="text-align: center; font-size: 10px !important; font-weight: bold !important; padding: 4px 3px !important;">${item.productCategory || 'غير محدد'}</td>
                                    <td style="text-align: center;">${item.productCode || '-'}</td>
                                    <td style="text-align: center; font-weight: bold; font-size: 14px !important;">${formatArabicNumber(item.quantity)}</td>
                                    <td style="text-align: center;">${item.unitName || item.unit || ''}</td>
                                    <td style="text-align: center;">
                                        <div style="border: 1px solid #333; height: 18px; width: 100%; margin: 0 auto;"></div>
                                    </td>
                                </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `;
                }
            })()}
        </div>
        ${note.notes && note.notes.trim() ? `
        <div class="notes-section">
            <h4>ملاحظات:</h4>
            <p>${note.notes}</p>
        </div>
        ` : ''}
        ${copyType === 'salesrep' ? `
        <div class="commitment-text">
            <p><strong>أقرّ أنا المندوب المذكور اسمي أعلاه</strong> بأني استلمت من أمين المخزن الأصناف الموضحة في هذا الإذن، سواء كانت مرتبطة بفواتير مبيعات أو عهدة احتياطية، وذلك بحالة سليمة وكاملة حسب البيانات الموضحة.</p>
            <p>وأتعهد بالمحافظة عليها وبالتصرف فيها وفق تعليمات الإدارة، على أن أقدّم ما يثبت تصريفها (فواتير مبيعات أو تسوية عهدة) خلال الفترة المحددة، أو إعادة ما لم يُصرَّف منها إلى المخزن.</p>
            <p>وتُبرّأ ذمة أمين المخزن من هذه الأصناف اعتبارًا من تاريخ هذا الإذن، وتنتقل المسؤولية عنها إلى المندوب حتى إتمام التسوية النهائية.</p>
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
            <p>تم إنشاء هذا الإذن بتاريخ: ${new Date(note.createdAt || new Date()).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p style="margin-top: 3px;">يرجى التأكد من مطابقة جميع العناصر قبل التوقيع</p>
        </div>
    </div>
        `;
    };

    // Load today's invoices for daily collection sheet (excluding cash customer and their products)
    let todayInvoices = [];
    let customersData = {};
    try {
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            // Get all invoices for the note's date
            const allInvoices = await window.electronAPI.dbGetAll('sales_invoices', 'date = ?', [note.date]) || [];
            
            // Filter out cash customer invoices - exclude ALL invoices for cash customer
            for (const invoice of allInvoices) {
                // Skip invoices without customer ID
                if (!invoice.customerId) {
                    continue;
                }
                
                const customer = await window.electronAPI.dbGet('customers', invoice.customerId);
                if (!customer) {
                    continue; // Skip if customer not found
                }
                
                // Check if customer is cash customer (by code)
                const customerCode = (customer.code || '').trim().toUpperCase();
                const isCashCustomer = customerCode === 'CASH';
                
                // Exclude cash customer invoices and their products from daily collection sheet
                if (!isCashCustomer) {
                    todayInvoices.push(invoice);
                    if (!customersData[invoice.customerId]) {
                        customersData[invoice.customerId] = customer;
                    }
                }
                // If cash customer, skip this invoice completely (already excluded)
            }
        }
    } catch (error) {
        console.error('Error loading invoices for daily collection sheet:', error);
    }
    
    // Generate daily collection sheet HTML
    const generateDailyCollectionSheet = () => {
        if (!todayInvoices || todayInvoices.length === 0) {
            return '';
        }
        
        let totalAmount = 0;
        let totalOldBalance = 0;
        let totalCombined = 0;
        
        // Split invoices into pages (25 customers per page for flexible layout)
        const customersPerPage = 25;
        const pages = [];
        for (let i = 0; i < todayInvoices.length; i += customersPerPage) {
            pages.push(todayInvoices.slice(i, i + customersPerPage));
        }
        
        const generatePage = (invoices, pageNumber, totalPages) => {
            const invoiceRows = invoices.map(invoice => {
                const customer = customersData[invoice.customerId] || {};
                const customerName = customer.name || customer.customerName || 'غير معروف';
                const customerPhone = customer.phone || customer.mobile || '-';
                const invoiceAmount = parseFloat(invoice.total || 0);
                const oldBalance = parseFloat(invoice.oldBalance || 0);
                const combined = invoiceAmount + oldBalance;
                
                return `
                    <tr>
                        <td style="text-align: center; padding: 6px 4px; font-size: 11px;">${customerName}</td>
                        <td style="text-align: center; padding: 6px 4px; font-size: 11px;">${customerPhone}</td>
                        <td style="text-align: center; font-weight: bold; padding: 6px 4px; font-size: 11px;">${formatCurrency(invoiceAmount)}</td>
                        <td style="text-align: center; font-weight: bold; padding: 6px 4px; font-size: 11px;">${formatCurrency(oldBalance)}</td>
                        <td style="text-align: center; font-weight: bold; padding: 6px 4px; font-size: 11px;">${formatCurrency(combined)}</td>
                        <td style="text-align: center; padding: 6px 3px; font-size: 10px;">
                            <div style="display: flex; justify-content: center; align-items: center; gap: 8px; flex-wrap: nowrap;">
                                <div style="display: flex; align-items: center; gap: 3px;">
                                    <div style="width: 14px; height: 14px; border: 2px solid #333; display: inline-block; border-radius: 2px; background: white; flex-shrink: 0;"></div>
                                    <span style="font-size: 9px; white-space: nowrap;">نقدي</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 3px;">
                                    <div style="width: 14px; height: 14px; border: 2px solid #333; display: inline-block; border-radius: 2px; background: white; flex-shrink: 0;"></div>
                                    <span style="font-size: 9px; white-space: nowrap;">محفظة</span>
                                </div>
                            </div>
                        </td>
                        <td style="text-align: center; min-height: 25px; border: 2px solid #333; padding: 6px 4px;">
                            &nbsp;
                        </td>
                    </tr>
                `;
            }).join('');
            
            // Calculate totals for this page
            const pageTotalAmount = invoices.reduce((sum, inv) => sum + parseFloat(inv.total || 0), 0);
            const pageTotalOldBalance = invoices.reduce((sum, inv) => sum + parseFloat(inv.oldBalance || 0), 0);
            const pageTotalCombined = pageTotalAmount + pageTotalOldBalance;
            
            return `
    <div class="daily-collection-sheet" style="page-break-before: ${pageNumber === 1 ? 'always' : 'always'};">
        <div class="collection-header">
            <img src="${logoBase64 || logoPath}" alt="Logo" class="company-logo" />
            <div>
                <div class="company-name">${companyName}</div>
                ${companyAddress || companyPhone ? `<div class="company-info">${companyAddress ? companyAddress : ''}${companyAddress && companyPhone ? ' - ' : ''}${companyPhone ? companyPhone : ''}</div>` : ''}
            </div>
        </div>
        <div class="collection-title">ورقة التحصيل اليومي ${totalPages > 1 ? `(صفحة ${pageNumber} من ${totalPages})` : ''}</div>
        <div class="collection-info">
            <div class="info-line">
                <span class="info-label">التاريخ:</span>
                <span class="info-value">${new Date(note.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            <div class="info-line">
                <span class="info-label">عدد العملاء:</span>
                <span class="info-value">${invoices.length} ${totalPages > 1 ? `(من إجمالي ${todayInvoices.length})` : ''}</span>
            </div>
        </div>
        <div class="collection-table-section">
            <table class="collection-table">
                <thead>
                    <tr>
                        <th style="width: 20%;">اسم العميل</th>
                        <th style="width: 13%;">رقم التليفون</th>
                        <th style="width: 13%;">إجمالي الفاتورة</th>
                        <th style="width: 13%;">الرصيد القديم</th>
                        <th style="width: 14%;">إجمالي الفاتورة + الرصيد القديم</th>
                        <th style="width: 12%;">طريقة الدفع</th>
                        <th style="width: 15%;">المبلغ المستلم</th>
                    </tr>
                </thead>
                <tbody>
                    ${invoiceRows}
                </tbody>
                <tfoot>
                    <tr class="total-row">
                        <td colspan="2" style="text-align: left; font-weight: bold; font-size: 12px;">إجمالي الصفحة:</td>
                        <td style="text-align: center; font-weight: bold; font-size: 12px;">${formatCurrency(pageTotalAmount)}</td>
                        <td style="text-align: center; font-weight: bold; font-size: 12px;">${formatCurrency(pageTotalOldBalance)}</td>
                        <td style="text-align: center; font-weight: bold; font-size: 13px;">${formatCurrency(pageTotalCombined)}</td>
                        <td colspan="2" style="text-align: center; font-weight: bold; font-size: 12px;">-</td>
                    </tr>
                </tfoot>
            </table>
        </div>
        ${pageNumber === totalPages ? `
        <div class="collection-footer">
            <div class="signature-box">
                <div style="margin-top: 30px; font-size: 12px;">
                    توقيع المحصل: _________________________
                </div>
            </div>
            <div class="signature-box">
                <div style="margin-top: 30px; font-size: 12px;">
                    توقيع المراجع: _________________________
                </div>
            </div>
        </div>
        ` : ''}
    </div>
            `;
        };
        
        // Generate all pages
        const pagesHTML = pages.map((pageInvoices, index) => generatePage(pageInvoices, index + 1, pages.length)).join('');
        
        return pagesHTML;
    };
    
    return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>إذن صرف ${note.deliveryNoteNumber}</title>
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
        .delivery-notes-wrapper {
            display: block;
            width: 100%;
        }
        .delivery-note-container {
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
        .delivery-note-container:first-of-type {
            page-break-after: always;
            margin-bottom: 20px;
        }
        .cut-line {
            display: none; /* Hide cut line when splitting pages */
        }
        ` : `
        /* When not splitting pages: keep both copies on one page */
        .delivery-note-container:first-of-type {
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
        .products-tables-container {
            display: flex;
            gap: 4px;
            width: 100%;
        }
        .products-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 3px 0; 
            border: 1px solid #333;
            font-size: 7px;
        }
        .products-table-split {
            width: calc(50% - 2px);
            margin: 0;
            font-size: 6px;
        }
        .products-table th, .products-table td { 
            border: 1px solid #ddd; 
            padding: 2px 1px; 
            text-align: right; 
            line-height: 1.2;
        }
        .products-table-split th, .products-table-split td {
            padding: 1px;
            font-size: 6px;
        }
        .products-table th { 
            background: #8b4513; 
            color: white;
            font-weight: bold; 
            font-size: 8px;
            padding: 3px 1px;
        }
        .products-table-split th {
            font-size: 7px;
            padding: 2px 1px;
        }
        .products-table td {
            font-size: 7px;
        }
        .products-table td:nth-child(5),
        .products-table-split td:nth-child(5) {
            font-size: 14px !important;
            font-weight: bold !important;
        }
        .products-table tbody tr:nth-child(even) {
            background: #f9f9f9;
        }
        .notes-section {
            margin: 6px 0;
            padding: 5px;
            background: #fff9e6;
            border: 1px solid #ffd700;
            border-radius: 4px;
            font-size: 8px;
        }
        .notes-section h4 {
            font-size: 9px;
            margin-bottom: 3px;
            color: #856404;
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
        .delivery-note-container {
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
        .products-table {
            font-size: 10px !important;
            margin: 2px 0 !important;
        }
        .products-table th, .products-table td {
            padding: 6px 4px !important;
            font-size: 10px !important;
        }
        .products-table th {
            font-size: 11px !important;
            padding: 5px 3px !important;
        }
        .products-table-split {
            font-size: 9px !important;
        }
        .products-table-split th, .products-table-split td {
            padding: 4px 3px !important;
            font-size: 9px !important;
        }
        .products-table-split th {
            font-size: 10px !important;
            padding: 4px 3px !important;
        }
        .products-table td:nth-child(5),
        .products-table-split td:nth-child(5) {
            font-size: 13px !important;
        }
        .notes-section {
            font-size: 10px !important;
            padding: 6px !important;
            margin: 4px 0 !important;
        }
        .notes-section h4 {
            font-size: 11px !important;
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
        /* Daily Collection Sheet Styles */
        .daily-collection-sheet {
            width: 100%;
            min-height: calc(100vh - 16mm);
            background: white;
            padding: 10mm;
            box-sizing: border-box;
            page-break-before: always;
            page-break-inside: avoid;
        }
        .collection-header {
            text-align: center;
            margin-bottom: 15px;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }
        .collection-title {
            font-size: 20px;
            font-weight: bold;
            margin: 15px 0;
            text-align: center;
            color: #8b4513;
            border: 2px solid #8b4513;
            padding: 10px;
            border-radius: 5px;
        }
        .collection-info {
            margin-bottom: 20px;
            padding: 10px;
            background: #f9f9f9;
            border: 1px solid #ddd;
            border-radius: 5px;
            display: flex;
            justify-content: space-around;
            flex-wrap: wrap;
            gap: 15px;
        }
        .collection-info .info-line {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
        }
        .collection-table-section {
            margin: 20px 0;
        }
        .collection-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            border: 2px solid #333;
        }
        .collection-table thead {
            background: linear-gradient(135deg, #8b4513 0%, #5a2a12 100%);
            color: white;
        }
        .collection-table th {
            padding: 10px 6px;
            text-align: center;
            font-weight: bold;
            font-size: 12px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .collection-table td {
            padding: 6px 4px;
            text-align: center;
            border: 1px solid #ddd;
            font-size: 11px;
            vertical-align: middle;
        }
        .collection-table td:nth-child(6) {
            padding: 6px 3px;
            font-size: 10px;
        }
        .collection-table td:nth-child(7) {
            min-height: 25px;
            border: 2px solid #333;
            padding: 6px 4px;
        }
        .collection-table {
            font-size: 11px;
        }
        .collection-table tbody tr:nth-child(even) {
            background: #f9f9f9;
        }
        .collection-table tbody tr:hover {
            background: #f0f0f0;
        }
        .collection-table tfoot {
            background: #f5f5f5;
            font-weight: bold;
        }
        .collection-table tfoot td {
            padding: 12px 8px;
            border-top: 2px solid #333;
        }
        .collection-footer {
            margin-top: 30px;
            display: flex;
            justify-content: space-between;
            gap: 20px;
            padding-top: 20px;
            border-top: 2px solid #333;
        }
        .collection-footer .signature-box {
            flex: 1;
            text-align: center;
        }
        @media print {
            body {
                padding: 0;
            }
            .delivery-note-container {
                page-break-inside: avoid;
                break-inside: avoid;
            }
            ${shouldSplitPages ? `
            /* When splitting pages: each copy on separate page */
            .delivery-note-container:first-of-type {
                page-break-after: always;
                break-after: page;
            }
            .delivery-note-container:nth-of-type(2) {
                page-break-before: always;
                break-before: page;
            }
            .cut-line {
                display: none; /* Hide cut line when splitting pages */
            }
            ` : `
            /* When not splitting: keep both copies on one page */
            .delivery-note-container:first-of-type {
                page-break-after: never;
                break-after: avoid;
            }
            .delivery-note-container:nth-of-type(2) {
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
            .products-table {
                page-break-inside: avoid;
            }
            /* Allow table to split if absolutely necessary (when table is very long) */
            .products-table-split {
                page-break-inside: auto;
            }
            .daily-collection-sheet {
                page-break-before: always;
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="delivery-notes-wrapper">
        ${generateCopyContent('warehouse', 'نسخة أمين المخزن / التلاجة')}
        <div class="cut-line"></div>
        ${generateCopyContent('salesrep', 'نسخة المندوب')}
    </div>
    ${generateDailyCollectionSheet()}
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
                    salesRepName: companyInfo.salesRepName || '',
                    salesRepPhone: companyInfo.salesRepPhone || '',
                    warehouseKeeperName: companyInfo.warehouseKeeperName || '',
                    warehouseKeeperPhone: companyInfo.warehouseKeeperPhone || ''
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
    const noteModal = document.getElementById('noteModal');
    if (noteModal) noteModal.classList.remove('active');
    currentNote = null;
    noteProducts = [];
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
// Disabled: Products cannot be removed
window.removeProductFromNote = function() {
    showMessage('لا يمكن حذف المنتجات. يتم تحميل المنتجات فقط من فواتير المبيعات', 'info');
    return;
};
window.viewNote = viewNote;
window.editNote = editNote;
window.printNoteById = printNoteById;
window.saveNoteAsPDF = saveNoteAsPDF;
window.deleteNote = deleteNote;

