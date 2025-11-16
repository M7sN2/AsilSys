// Company Settings Management

let companyInfo = null;

// Load data on page load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadCompanyInfo();
        initializeEventListeners();
        populateForm();
    } catch (error) {
        console.error('[Settings] Error during initialization:', error);
    }
});

// Initialize Event Listeners
function initializeEventListeners() {
    // Form Submit
    const form = document.getElementById('companySettingsForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
        
        // Also add click listener to submit button as backup
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.addEventListener('click', (e) => {
                // Let the form submit handler take over
            });
        }
    } else {
        console.error('[Settings] Form not found!');
        if (window.showToast) {
            window.showToast('خطأ: لم يتم العثور على النموذج!', 'error');
        }
    }

    // Reset Button
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            showResetConfirmDialog(
                'هل أنت متأكد من إعادة تعيين جميع الحقول؟',
                async () => {
                    // User confirmed - proceed with reset
                    await loadCompanyInfo();
                    populateForm();
                    if (window.showToast) {
                        window.showToast('تم إعادة تعيين النموذج', 'success');
                    } else {
                        showMessage('تم إعادة تعيين النموذج', 'success');
                    }
                },
                () => {
                    // User cancelled - do nothing
                }
            );
        });
    } else {
        console.error('[Settings] Reset button not found!');
    }
}

// Load Company Info from Database
async function loadCompanyInfo() {
    try {
        if (window.electronAPI && window.electronAPI.dbGet) {
            // First, ensure columns exist in database (for existing databases)
            try {
                await window.electronAPI.dbQuery('ALTER TABLE company_info ADD COLUMN warehouseKeeperName TEXT', []);
            } catch (e) {
                // Column already exists, ignore
            }
            try {
                await window.electronAPI.dbQuery('ALTER TABLE company_info ADD COLUMN warehouseKeeperPhone TEXT', []);
            } catch (e) {
                // Column already exists, ignore
            }
            try {
                await window.electronAPI.dbQuery('ALTER TABLE company_info ADD COLUMN marketingWhatsApp TEXT', []);
            } catch (e) {
                // Column already exists, ignore
            }
            try {
                await window.electronAPI.dbQuery('ALTER TABLE company_info ADD COLUMN marketingMobile TEXT', []);
            } catch (e) {
                // Column already exists, ignore
            }
            try {
                await window.electronAPI.dbQuery('ALTER TABLE company_info ADD COLUMN marketingWorkingHours TEXT', []);
            } catch (e) {
                // Column already exists, ignore
            }
            try {
                await window.electronAPI.dbQuery('ALTER TABLE company_info ADD COLUMN managerName TEXT', []);
            } catch (e) {
                // Column already exists, ignore
            }
            try {
                await window.electronAPI.dbQuery('ALTER TABLE company_info ADD COLUMN managerMobile TEXT', []);
            } catch (e) {
                // Column already exists, ignore
            }
            
            companyInfo = await window.electronAPI.dbGet('company_info', 'company_001');
            
            if (!companyInfo || companyInfo === null) {
                // If no company info exists, create default
                companyInfo = {
                    id: 'company_001',
                    name: 'شركة أسيل',
                    address: '',
                    taxId: '',
                    commercialRegister: '',
                    phone: '',
                    mobile: '',
                    email: '',
                    taxRate: null,
                    commitmentText: 'أقر بأنني قد استلمت البضاعة/الخدمة المبينة أعلاه بحالة جيدة وبمواصفات مطابقة، وأتعهد بالسداد وفق الشروط المذكورة.',
                    salesRepName: '',
                    salesRepPhone: '',
                    accountantName: '',
                    accountantPhone: '',
                    warehouseKeeperName: '',
                    warehouseKeeperPhone: '',
                    marketingWhatsApp: '01XXXXXXXXX',
                    marketingMobile: '01XXXXXXXXX',
                    marketingWorkingHours: 'السبت - الخميس | 9 صباحًا - 11 مساءً',
                    managerName: '',
                    managerMobile: '',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                
                // Save default to database
                try {
                    await window.electronAPI.dbInsert('company_info', companyInfo);
                } catch (insertError) {
                    console.error('[Settings] Error saving default company info:', insertError);
                }
            } else {
                // Ensure all fields exist (handle null values)
                companyInfo = {
                    id: companyInfo.id || 'company_001',
                    name: companyInfo.name || 'شركة أسيل',
                    address: companyInfo.address || '',
                    taxId: companyInfo.taxId || '',
                    commercialRegister: companyInfo.commercialRegister || '',
                    phone: companyInfo.phone || '',
                    mobile: companyInfo.mobile || '',
                    email: companyInfo.email || '',
                    taxRate: companyInfo.taxRate !== null && companyInfo.taxRate !== undefined ? companyInfo.taxRate : null,
                    commitmentText: companyInfo.commitmentText || 'أقر بأنني قد استلمت البضاعة/الخدمة المبينة أعلاه بحالة جيدة وبمواصفات مطابقة، وأتعهد بالسداد وفق الشروط المذكورة.',
                    salesRepName: companyInfo.salesRepName || '',
                    salesRepPhone: companyInfo.salesRepPhone || '',
                    accountantName: companyInfo.accountantName || '',
                    accountantPhone: companyInfo.accountantPhone || '',
                    warehouseKeeperName: companyInfo.warehouseKeeperName || '',
                    warehouseKeeperPhone: companyInfo.warehouseKeeperPhone || '',
                    marketingWhatsApp: companyInfo.marketingWhatsApp || '01XXXXXXXXX',
                    marketingMobile: companyInfo.marketingMobile || '01XXXXXXXXX',
                    marketingWorkingHours: companyInfo.marketingWorkingHours || 'السبت - الخميس | 9 صباحًا - 11 مساءً',
                    managerName: companyInfo.managerName || '',
                    managerMobile: companyInfo.managerMobile || '',
                    createdAt: companyInfo.createdAt || new Date().toISOString(),
                    updatedAt: companyInfo.updatedAt || new Date().toISOString()
                };
            }
        } else {
            // Fallback to localStorage if electronAPI not available
            const stored = localStorage.getItem('asel_company_settings');
            if (stored) {
                companyInfo = JSON.parse(stored);
            } else {
                companyInfo = {
                    id: 'company_001',
                    name: 'شركة أسيل',
                    address: '',
                    taxId: '',
                    commercialRegister: '',
                    phone: '',
                    mobile: '',
                    email: '',
                    commitmentText: 'أقر بأنني قد استلمت البضاعة/الخدمة المبينة أعلاه بحالة جيدة وبمواصفات مطابقة، وأتعهد بالسداد وفق الشروط المذكورة.',
                    salesRepName: '',
                    salesRepPhone: '',
                    accountantName: '',
                    accountantPhone: '',
                    warehouseKeeperName: '',
                    warehouseKeeperPhone: '',
                    marketingWhatsApp: '01XXXXXXXXX',
                    marketingMobile: '01XXXXXXXXX',
                    marketingWorkingHours: 'السبت - الخميس | 9 صباحًا - 11 مساءً',
                    managerName: '',
                    managerMobile: ''
                };
            }
        }
    } catch (error) {
        console.error('[Settings] Error loading company info:', error);
        showMessage('خطأ في تحميل معلومات الشركة: ' + error.message, 'error');
        companyInfo = {
            id: 'company_001',
            name: 'شركة أسيل',
            address: '',
            taxId: '',
            commercialRegister: '',
            phone: '',
            mobile: '',
            email: '',
            taxRate: 0,
            commitmentText: 'أقر بأنني قد استلمت البضاعة/الخدمة المبينة أعلاه بحالة جيدة وبمواصفات مطابقة، وأتعهد بالسداد وفق الشروط المذكورة.',
            salesRepName: '',
            salesRepPhone: '',
            accountantName: '',
            accountantPhone: '',
            warehouseKeeperName: '',
            warehouseKeeperPhone: '',
            managerName: '',
            managerMobile: ''
        };
    }
}

// Populate Form with Company Info
function populateForm() {
    if (!companyInfo) {
        console.warn('[Settings] No company info to populate form');
        return;
    }

    try {
        const nameField = document.getElementById('companyName');
        const addressField = document.getElementById('companyAddress');
        const taxIdField = document.getElementById('taxId');
        const commercialRegisterField = document.getElementById('commercialRegister');
        const phoneField = document.getElementById('phone');
        const mobileField = document.getElementById('mobile');
        const emailField = document.getElementById('email');
        const taxRateField = document.getElementById('taxRate');
        const commitmentTextField = document.getElementById('commitmentText');
        const salesRepNameField = document.getElementById('salesRepName');
        const salesRepPhoneField = document.getElementById('salesRepPhone');
        const accountantNameField = document.getElementById('accountantName');
        const accountantPhoneField = document.getElementById('accountantPhone');
        const warehouseKeeperNameField = document.getElementById('warehouseKeeperName');
        const warehouseKeeperPhoneField = document.getElementById('warehouseKeeperPhone');
        const marketingWhatsAppField = document.getElementById('marketingWhatsApp');
        const marketingMobileField = document.getElementById('marketingMobile');
        const marketingWorkingHoursField = document.getElementById('marketingWorkingHours');
        const managerNameField = document.getElementById('managerName');
        const managerMobileField = document.getElementById('managerMobile');

        // Use nullish coalescing and explicit null checks
        if (nameField) nameField.value = (companyInfo.name !== null && companyInfo.name !== undefined) ? companyInfo.name : '';
        if (addressField) addressField.value = (companyInfo.address !== null && companyInfo.address !== undefined) ? companyInfo.address : '';
        if (taxIdField) taxIdField.value = (companyInfo.taxId !== null && companyInfo.taxId !== undefined) ? companyInfo.taxId : '';
        if (commercialRegisterField) commercialRegisterField.value = (companyInfo.commercialRegister !== null && companyInfo.commercialRegister !== undefined) ? companyInfo.commercialRegister : '';
        if (phoneField) phoneField.value = (companyInfo.phone !== null && companyInfo.phone !== undefined) ? companyInfo.phone : '';
        if (mobileField) mobileField.value = (companyInfo.mobile !== null && companyInfo.mobile !== undefined) ? companyInfo.mobile : '';
        if (emailField) emailField.value = (companyInfo.email !== null && companyInfo.email !== undefined) ? companyInfo.email : '';
        if (taxRateField) {
            if (companyInfo.taxRate !== null && companyInfo.taxRate !== undefined) {
                taxRateField.value = companyInfo.taxRate;
            } else {
                taxRateField.value = '0'; // Default to 0 if not set
            }
        }
        if (commitmentTextField) commitmentTextField.value = (companyInfo.commitmentText !== null && companyInfo.commitmentText !== undefined) ? companyInfo.commitmentText : '';
        if (salesRepNameField) salesRepNameField.value = (companyInfo.salesRepName !== null && companyInfo.salesRepName !== undefined) ? companyInfo.salesRepName : '';
        if (salesRepPhoneField) salesRepPhoneField.value = (companyInfo.salesRepPhone !== null && companyInfo.salesRepPhone !== undefined) ? companyInfo.salesRepPhone : '';
        if (accountantNameField) accountantNameField.value = (companyInfo.accountantName !== null && companyInfo.accountantName !== undefined) ? companyInfo.accountantName : '';
        if (accountantPhoneField) accountantPhoneField.value = (companyInfo.accountantPhone !== null && companyInfo.accountantPhone !== undefined) ? companyInfo.accountantPhone : '';
        if (warehouseKeeperNameField) warehouseKeeperNameField.value = (companyInfo.warehouseKeeperName !== null && companyInfo.warehouseKeeperName !== undefined) ? companyInfo.warehouseKeeperName : '';
        if (warehouseKeeperPhoneField) warehouseKeeperPhoneField.value = (companyInfo.warehouseKeeperPhone !== null && companyInfo.warehouseKeeperPhone !== undefined) ? companyInfo.warehouseKeeperPhone : '';
        if (marketingWhatsAppField) marketingWhatsAppField.value = (companyInfo.marketingWhatsApp !== null && companyInfo.marketingWhatsApp !== undefined) ? companyInfo.marketingWhatsApp : '01XXXXXXXXX';
        if (marketingMobileField) marketingMobileField.value = (companyInfo.marketingMobile !== null && companyInfo.marketingMobile !== undefined) ? companyInfo.marketingMobile : '01XXXXXXXXX';
        if (marketingWorkingHoursField) marketingWorkingHoursField.value = (companyInfo.marketingWorkingHours !== null && companyInfo.marketingWorkingHours !== undefined) ? companyInfo.marketingWorkingHours : 'السبت - الخميس | 9 صباحًا - 11 مساءً';
        if (managerNameField) managerNameField.value = (companyInfo.managerName !== null && companyInfo.managerName !== undefined) ? companyInfo.managerName : '';
        if (managerMobileField) managerMobileField.value = (companyInfo.managerMobile !== null && companyInfo.managerMobile !== undefined) ? companyInfo.managerMobile : '';
    } catch (error) {
        console.error('[Settings] Error populating form:', error);
    }
}

// Handle Form Submit
async function handleFormSubmit(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Get submit button and disable it to prevent double submission
    const form = e.currentTarget || document.getElementById('companySettingsForm');
    const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
    const originalText = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>⏳</span> جاري الحفظ...';
    }

    const formData = {
        id: 'company_001',
        name: document.getElementById('companyName').value.trim(),
        address: document.getElementById('companyAddress').value.trim(),
        taxId: document.getElementById('taxId').value.trim(),
        commercialRegister: document.getElementById('commercialRegister').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        mobile: document.getElementById('mobile').value.trim(),
        email: document.getElementById('email').value.trim(),
        taxRate: document.getElementById('taxRate').value === '' ? null : (parseFloat(document.getElementById('taxRate').value) || 0),
        commitmentText: document.getElementById('commitmentText').value.trim(),
        salesRepName: document.getElementById('salesRepName').value.trim(),
        salesRepPhone: document.getElementById('salesRepPhone').value.trim(),
        accountantName: document.getElementById('accountantName').value.trim(),
        accountantPhone: document.getElementById('accountantPhone').value.trim(),
        warehouseKeeperName: document.getElementById('warehouseKeeperName').value.trim(),
        warehouseKeeperPhone: document.getElementById('warehouseKeeperPhone').value.trim(),
        marketingWhatsApp: document.getElementById('marketingWhatsApp').value.trim(),
        marketingMobile: document.getElementById('marketingMobile').value.trim(),
        marketingWorkingHours: document.getElementById('marketingWorkingHours').value.trim(),
        managerName: document.getElementById('managerName').value.trim(),
        managerMobile: document.getElementById('managerMobile').value.trim(),
        updatedAt: new Date().toISOString()
    };

    // Preserve createdAt if it exists
    if (companyInfo && companyInfo.createdAt) {
        formData.createdAt = companyInfo.createdAt;
    } else {
        formData.createdAt = new Date().toISOString();
    }

    // Validate required fields
    if (!formData.name) {
        showMessage('يرجى إدخال اسم الشركة', 'error');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
        return;
    }

    try {
        if (window.electronAPI && window.electronAPI.dbUpdate) {
            // First, ensure columns exist in database (for existing databases)
            try {
                await window.electronAPI.dbQuery('ALTER TABLE company_info ADD COLUMN warehouseKeeperName TEXT', []);
            } catch (e) {
                // Column already exists, ignore
            }
            try {
                await window.electronAPI.dbQuery('ALTER TABLE company_info ADD COLUMN warehouseKeeperPhone TEXT', []);
            } catch (e) {
                // Column already exists, ignore
            }
            try {
                await window.electronAPI.dbQuery('ALTER TABLE company_info ADD COLUMN marketingWhatsApp TEXT', []);
            } catch (e) {
                // Column already exists, ignore
            }
            try {
                await window.electronAPI.dbQuery('ALTER TABLE company_info ADD COLUMN marketingMobile TEXT', []);
            } catch (e) {
                // Column already exists, ignore
            }
            try {
                await window.electronAPI.dbQuery('ALTER TABLE company_info ADD COLUMN marketingWorkingHours TEXT', []);
            } catch (e) {
                // Column already exists, ignore
            }
            
            // First check if record exists
            const existing = await window.electronAPI.dbGet('company_info', 'company_001');
            
            if (existing) {
                // Ensure all fields are included in formData (merge with existing to preserve any missing fields)
                // But prioritize formData values over existing values
                const mergedData = {
                    ...existing,
                    ...formData,
                    // Explicitly set new fields even if they're empty strings
                    warehouseKeeperName: formData.warehouseKeeperName !== undefined ? formData.warehouseKeeperName : (existing.warehouseKeeperName || ''),
                    warehouseKeeperPhone: formData.warehouseKeeperPhone !== undefined ? formData.warehouseKeeperPhone : (existing.warehouseKeeperPhone || ''),
                    marketingWhatsApp: formData.marketingWhatsApp !== undefined ? formData.marketingWhatsApp : (existing.marketingWhatsApp || '01XXXXXXXXX'),
                    marketingMobile: formData.marketingMobile !== undefined ? formData.marketingMobile : (existing.marketingMobile || '01XXXXXXXXX'),
                    marketingWorkingHours: formData.marketingWorkingHours !== undefined ? formData.marketingWorkingHours : (existing.marketingWorkingHours || 'السبت - الخميس | 9 صباحًا - 11 مساءً'),
                    managerName: formData.managerName !== undefined ? formData.managerName : (existing.managerName || ''),
                    managerMobile: formData.managerMobile !== undefined ? formData.managerMobile : (existing.managerMobile || '')
                };
                
                // Log for debugging
                console.log('[Settings] Updating company_info with mergedData:', mergedData);
                
                // Update in database
                const result = await window.electronAPI.dbUpdate('company_info', 'company_001', mergedData);
                
                // Log result
                console.log('[Settings] Update result:', result);
                
                // Check if update was successful (result.changes > 0 or no error thrown)
                if (result && result.changes !== undefined) {
                    if (result.changes > 0) {
                        // Update successful
                        // Reload from database to ensure we have the latest data
                        companyInfo = await window.electronAPI.dbGet('company_info', 'company_001');
                        
                        // Log reloaded data for debugging
                        console.log('[Settings] Reloaded company_info after update:', companyInfo);
                        
                        showToastNextToButton('تم حفظ التغييرات بنجاح', 'success');
                        
                        // Dispatch event to notify other pages
                        window.dispatchEvent(new CustomEvent('companyInfoUpdated', { bubbles: true }));
                    } else {
                        // No changes made, but still verify by reloading
                        companyInfo = await window.electronAPI.dbGet('company_info', 'company_001');
                        if (companyInfo && companyInfo.name === formData.name) {
                            showToastNextToButton('تم حفظ التغييرات بنجاح', 'success');
                            window.dispatchEvent(new CustomEvent('companyInfoUpdated', { bubbles: true }));
                        } else {
                            // Data might not have been saved, try insert
                            await window.electronAPI.dbInsert('company_info', formData);
                            companyInfo = await window.electronAPI.dbGet('company_info', 'company_001');
                            showToastNextToButton('تم حفظ التغييرات بنجاح', 'success');
                            window.dispatchEvent(new CustomEvent('companyInfoUpdated', { bubbles: true }));
                        }
                    }
                } else {
                    // Update might have succeeded even if changes is undefined
                    // Try to reload from database to verify
                    try {
                        companyInfo = await window.electronAPI.dbGet('company_info', 'company_001');
                        if (companyInfo && companyInfo.name === formData.name) {
                            showToastNextToButton('تم حفظ التغييرات بنجاح', 'success');
                            window.dispatchEvent(new CustomEvent('companyInfoUpdated', { bubbles: true }));
                        } else {
                            // Data might not have been saved, try insert
                            await window.electronAPI.dbInsert('company_info', formData);
                            companyInfo = await window.electronAPI.dbGet('company_info', 'company_001');
                            showToastNextToButton('تم حفظ التغييرات بنجاح', 'success');
                            window.dispatchEvent(new CustomEvent('companyInfoUpdated', { bubbles: true }));
                        }
                    } catch (reloadError) {
                        console.error('[Settings] Error reloading after update:', reloadError);
                        throw new Error('فشل التحديث في قاعدة البيانات: ' + reloadError.message);
                    }
                }
            } else {
                // If record doesn't exist, insert it
                await window.electronAPI.dbInsert('company_info', formData);
                companyInfo = formData;
                
                // Reload from database to ensure we have the latest data
                companyInfo = await window.electronAPI.dbGet('company_info', 'company_001');
                
                showToastNextToButton('تم حفظ التغييرات بنجاح', 'success');
                window.dispatchEvent(new CustomEvent('companyInfoUpdated', { bubbles: true }));
            }
        } else {
            // Fallback to localStorage
            localStorage.setItem('asel_company_settings', JSON.stringify(formData));
            companyInfo = formData;
            showToastNextToButton('تم حفظ التغييرات بنجاح', 'success');
        }
    } catch (error) {
        console.error('[Settings] Error saving company info:', error);
        showMessage('خطأ في حفظ معلومات الشركة: ' + error.message, 'error');
    } finally {
        // Re-enable submit button
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }
}

// Custom Confirmation Dialog for Reset (replaces confirm() to avoid Electron focus issues)
function showResetConfirmDialog(message, onConfirm, onCancel) {
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
        <h2 style="margin: 0; font-size: 1.25rem;">تأكيد إعادة التعيين</h2>
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
    confirmBtn.textContent = 'إعادة تعيين';
    
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
    const closeModal = () => {
        modal.remove();
        if (onCancel) onCancel();
    };
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    confirmBtn.addEventListener('click', () => {
        modal.remove();
        if (onConfirm) onConfirm();
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Focus on confirm button
    setTimeout(() => {
        confirmBtn.focus();
    }, 100);
}

// Show Toast Next to Save Button
function showToastNextToButton(message, type = 'success') {
    const submitBtn = document.querySelector('#companySettingsForm button[type="submit"]');
    if (!submitBtn) {
        // Fallback to regular toast
        if (window.showToast) {
            window.showToast(message, type);
        }
        return;
    }

    // Get button position
    const rect = submitBtn.getBoundingClientRect();
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} toast-next-to-button`;
    toast.style.position = 'fixed';
    toast.style.top = `${rect.top}px`;
    toast.style.left = `${rect.left + rect.width + 12}px`; // 12px gap after button
    toast.style.zIndex = '10001';
    toast.style.minWidth = '200px';
    toast.style.maxWidth = '300px';
    
    // Set icon based on type
    const icon = type === 'error' ? '⚠️' : type === 'success' ? '✓' : type === 'warning' ? '⚠️' : 'ℹ️';
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;
    
    // Add toast to body
    document.body.appendChild(toast);
    
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
}

// Show Message
function showMessage(message, type = 'info') {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.message');
    existingMessages.forEach(msg => msg.remove());

    // Create message element
    const messageEl = document.createElement('div');
    messageEl.className = `message message-${type}`;
    messageEl.textContent = message;
    
    // Add to page
    const contentHeader = document.querySelector('.content-header');
    if (contentHeader) {
        contentHeader.insertAdjacentElement('afterend', messageEl);
    } else {
        document.body.insertBefore(messageEl, document.body.firstChild);
    }

    // Auto remove after 3 seconds
    setTimeout(() => {
        messageEl.remove();
    }, 3000);
}

