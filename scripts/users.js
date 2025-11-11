// Users Management System

const USERS_STORAGE_KEYS = {
    USERS: 'asel_users',
    CURRENT_USER: 'asel_loggedIn'
};

let users = [];

// Load data on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadUsers();
    initializeUsersEventListeners();
    setupSearchAndFilters();
    renderUsers();
    
    // Show/hide add user button based on permissions
    updateAddUserButtonVisibility();
    
    // Re-initialize when users tab becomes visible
    setupUsersTabListener();
});

// Update Add User Button Visibility
function updateAddUserButtonVisibility() {
    const addUserBtn = document.getElementById('addUserBtn');
    if (!addUserBtn) return;
    
    const currentUserType = localStorage.getItem('asel_userType') || '';
    if (currentUserType === 'system_engineer') {
        addUserBtn.style.display = '';
    } else {
        addUserBtn.style.display = 'none';
    }
}

// Initialize Event Listeners for Users Management
function initializeUsersEventListeners() {
    // Add User Button (with safety check)
    const addUserBtn = document.getElementById('addUserBtn');
    if (addUserBtn) {
        // Remove existing listener if any
        const newBtn = addUserBtn.cloneNode(true);
        addUserBtn.parentNode.replaceChild(newBtn, addUserBtn);
        
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openAddUserModal();
        });
    }

    // Modal Close Buttons (with safety checks)
    const closeUserModalBtn = document.getElementById('closeUserModal');
    if (closeUserModalBtn) {
        closeUserModalBtn.addEventListener('click', closeUserModal);
    }

    const cancelUserBtn = document.getElementById('cancelUserBtn');
    if (cancelUserBtn) {
        cancelUserBtn.addEventListener('click', closeUserModal);
    }

    // Form Submit (with safety check)
    const userForm = document.getElementById('userForm');
    if (userForm) {
        userForm.addEventListener('submit', handleUserFormSubmit);
    }

    // User Type Change - Auto set permissions based on user type (with safety check)
    const userType = document.getElementById('userType');
    if (userType) {
        userType.addEventListener('change', (e) => {
            // Prevent selecting system_engineer type (even if somehow selected)
            if (userType.value === 'system_engineer') {
                if (window.showToast) {
                    window.showToast('لا يمكن اختيار نوع مهندس النظام', 'error');
                } else {
                    alert('⚠️ لا يمكن اختيار نوع مهندس النظام');
                }
                userType.value = 'manager'; // Reset to manager
                e.preventDefault();
                return;
            }
            onUserTypeChange();
        });
    }

    // Close modal on backdrop click (with safety check)
    const userModal = document.getElementById('userModal');
    if (userModal) {
        userModal.addEventListener('click', (e) => {
            if (e.target.id === 'userModal') {
                closeUserModal();
            }
        });
    }

    // Select All Permissions Button
    const selectAllPermissionsBtn = document.getElementById('selectAllPermissions');
    if (selectAllPermissionsBtn) {
        selectAllPermissionsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            selectAllPermissions();
        });
    }

    // Deselect All Permissions Button
    const deselectAllPermissionsBtn = document.getElementById('deselectAllPermissions');
    if (deselectAllPermissionsBtn) {
        deselectAllPermissionsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            deselectAllPermissions();
        });
    }
    
    // Empty state button
    const emptyStateAddUserBtn = document.getElementById('emptyStateAddUserBtn');
    if (emptyStateAddUserBtn) {
        emptyStateAddUserBtn.addEventListener('click', () => {
            const addUserBtn = document.getElementById('addUserBtn');
            if (addUserBtn && addUserBtn.style.display !== 'none') {
                addUserBtn.click();
            } else {
                openAddUserModal();
            }
        });
    }
}

// Select All Permissions
function selectAllPermissions() {
    const checkboxes = document.querySelectorAll('input[name="permissions"]:not([disabled])');
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
}

// Deselect All Permissions
function deselectAllPermissions() {
    const checkboxes = document.querySelectorAll('input[name="permissions"]:not([disabled])');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
}

// Setup listener for users tab to re-initialize when tab is clicked
function setupUsersTabListener() {
    // Find users tab button
    const usersTabBtn = document.querySelector('.tab-btn[data-tab="users"]');
    if (usersTabBtn) {
        // Add click listener that runs after the tab switch
        usersTabBtn.addEventListener('click', () => {
            setTimeout(() => {
                initializeUsersEventListeners();
                if (window.PermissionsManager) {
                    window.PermissionsManager.applyPermissions();
                }
            }, 100);
        });
    }
}

// Load Users from Database
async function loadUsers() {
    try {
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            const allUsers = await window.electronAPI.dbGetAll('users');
            users = allUsers || [];
            
            // Filter out system_engineer users from the list (they should not be visible)
            users = users.filter(u => u.type !== 'system_engineer');
            
            // Parse permissions JSON strings
            users = users.map(user => {
                try {
                    let permissions = [];
                    
                    if (typeof user.permissions === 'string') {
                        const permStr = user.permissions.trim();
                        // Handle special case: "*" as a string (not JSON array)
                        if (permStr === '*') {
                            permissions = ['*'];
                        } else if (permStr === '' || permStr === 'null' || permStr === 'undefined') {
                            permissions = [];
                        } else {
                            // Try to parse as JSON
                            try {
                                permissions = JSON.parse(permStr);
                                if (!Array.isArray(permissions)) {
                                    permissions = [];
                                }
                            } catch (parseErr) {
                                console.warn(`Invalid JSON for user ${user.username}: ${permStr}`, parseErr);
                                // If it's just "*", treat as admin
                                if (permStr.includes('*')) {
                                    permissions = ['*'];
                                } else {
                                    permissions = [];
                                }
                            }
                        }
                    } else if (Array.isArray(user.permissions)) {
                        permissions = user.permissions;
                    } else {
                        permissions = [];
                    }
                    
                    return {
                        ...user,
                        permissions: permissions
                    };
                } catch (parseError) {
                    console.error('Error parsing permissions for user:', user.username, parseError);
                    return {
                        ...user,
                        permissions: []
                    };
                }
            });
        } else {
            // Fallback to localStorage for testing
            const usersData = localStorage.getItem(USERS_STORAGE_KEYS.USERS);
            users = usersData ? JSON.parse(usersData) : [];
            
            // Filter out system_engineer users from the list (they should not be visible)
            users = users.filter(u => u.type !== 'system_engineer');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        users = [];
    }
}

// Save Users to Database
async function saveUsers() {
    try {
        if (window.electronAPI && window.electronAPI.dbInsert && window.electronAPI.dbUpdate) {
            // Users are saved individually when added/edited
            // This function is kept for compatibility
            return;
        } else {
            // Fallback to localStorage
            localStorage.setItem(USERS_STORAGE_KEYS.USERS, JSON.stringify(users));
        }
    } catch (error) {
        console.error('Error saving users:', error);
    }
}

// On User Type Change
function onUserTypeChange() {
    const userType = document.getElementById('userType').value;
    const permissions = getDefaultPermissions(userType);
    
    // Clear all checkboxes
    document.querySelectorAll('input[name="permissions"]').forEach(cb => {
        cb.checked = false;
    });

    // Set default permissions
    permissions.forEach(permission => {
        const checkbox = document.querySelector(`input[name="permissions"][value="${permission}"]`);
        if (checkbox) {
            checkbox.checked = true;
        }
    });
}

// Get Default Permissions based on user type
function getDefaultPermissions(userType) {
    const defaultPermissions = {
        'admin': ['*'], // All permissions
        'manager': ['*'], // All permissions - manager has full access
        'system_engineer': ['*'], // All permissions - system engineer has full access
        'accountant': [
            'products_view',
            'customers_view', 'customers_add', 'customers_edit',
            'sales_view', 'sales_add', 'sales_edit', 'sales_print',
            'reports_view', 'reports_export',
            'settings_view'
        ],
        'sales': [
            'products_view',
            'customers_view', 'customers_add', 'customers_edit',
            'sales_view', 'sales_add', 'sales_edit', 'sales_print'
        ],
        'warehouse': [
            'products_view', 'products_add', 'products_edit',
            'customers_view'
        ]
    };

    return defaultPermissions[userType] || [];
}

// Open Add User Modal
function openAddUserModal() {
    // Check if current user can add users (only system_engineer)
    const currentUserType = localStorage.getItem('asel_userType') || '';
    if (currentUserType !== 'system_engineer') {
        if (window.showToast) {
            window.showToast('ليس لديك صلاحية لإضافة مستخدمين. فقط مهندس النظام يمكنه إضافة المستخدمين.', 'error');
        } else {
            alert('⚠️ ليس لديك صلاحية لإضافة مستخدمين. فقط مهندس النظام يمكنه إضافة المستخدمين.');
        }
        return;
    }
    
    const modal = document.getElementById('userModal');
    if (!modal) {
        console.error('userModal not found');
        return;
    }
    
    const form = document.getElementById('userForm');
    const title = document.getElementById('userModalTitle');
    const isEditUser = document.getElementById('isEditUser');
    const userId = document.getElementById('userId');
    const passwordRequired = document.getElementById('passwordRequired');
    const passwordHint = document.getElementById('passwordHint');
    const userPassword = document.getElementById('userPassword');
    const userName = document.getElementById('userName');

    // Reset form
    if (form) {
        form.reset();
    }
    
    // Set form mode to "add"
    if (isEditUser) isEditUser.value = 'false';
    if (userId) userId.value = '';
    
    // Show password field as required
    if (passwordRequired) passwordRequired.style.display = 'inline';
    if (passwordHint) passwordHint.style.display = 'none';
    if (userPassword) {
        userPassword.required = true;
        userPassword.value = '';
        userPassword.disabled = false;
    }
    
    // Set default values
    const userType = document.getElementById('userType');
    if (userType) {
        userType.value = 'sales'; // Default type
        userType.disabled = false;
        userType.style.opacity = '1';
        userType.style.cursor = '';
        userType.title = '';
    }
    
    const userStatus = document.getElementById('userStatus');
    if (userStatus) {
        userStatus.value = 'active'; // Default status
        userStatus.disabled = false;
        userStatus.style.opacity = '1';
        userStatus.style.cursor = '';
        userStatus.title = '';
    }
    
    // Enable all permission checkboxes
    document.querySelectorAll('input[name="permissions"]').forEach(cb => {
        cb.disabled = false;
        cb.style.opacity = '1';
        cb.style.cursor = '';
        if (cb.parentElement) {
            cb.parentElement.style.opacity = '1';
            cb.parentElement.style.cursor = '';
        }
    });
    
    // Remove warning if exists
    const warningDiv = document.getElementById('adminWarning');
    if (warningDiv) {
        warningDiv.remove();
    }
    
    if (title) title.textContent = 'إضافة مستخدم جديد';
    
    // Set default permissions based on selected type
    // Use setTimeout to ensure form is reset first
    setTimeout(() => {
        if (typeof onUserTypeChange === 'function') {
            onUserTypeChange();
        }
    }, 50);
    
    // Show modal
    modal.classList.add('active');
    modal.style.display = 'flex';
    
    // Focus on username field
    if (userName) {
        setTimeout(() => userName.focus(), 150);
    }
}

// Open Edit User Modal
function openEditUserModal(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    // Prevent editing system_engineer users
    if (user.type === 'system_engineer') {
        alert('⚠️ لا يمكن تعديل مستخدم مهندس النظام');
        return;
    }

    const modal = document.getElementById('userModal');
    const form = document.getElementById('userForm');
    const title = document.getElementById('userModalTitle');
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const userType = document.getElementById('userType');
    const userStatus = document.getElementById('userStatus');
    const userPassword = document.getElementById('userPassword');
    const passwordRequired = document.getElementById('passwordRequired');
    const passwordHint = document.getElementById('passwordHint');
    
    // Check if this is a manager user - manager can only edit username and password
    const isManager = user.type === 'manager';
    
    // Check if this is the default admin user (deprecated - now using system_engineer)
    // Default admin is identified by: type === 'admin' AND permissions === ['*']
    // We don't check username because user might have changed it
    let isDefaultAdmin = false;
    if (user.type === 'admin') {
        try {
            let perms = [];
            if (typeof user.permissions === 'string') {
                const permStr = user.permissions.trim();
                if (permStr === '*') {
                    perms = ['*'];
                } else if (permStr && permStr !== '' && permStr !== 'null') {
                    try {
                        perms = JSON.parse(permStr);
                        if (!Array.isArray(perms)) perms = [];
                    } catch (e) {
                        if (permStr.includes('*')) perms = ['*'];
                    }
                }
            } else if (Array.isArray(user.permissions)) {
                perms = user.permissions;
            }
            
            // Check if has full permissions (*) - this identifies default admin
            isDefaultAdmin = perms.includes('*');
        } catch (e) {
            isDefaultAdmin = false;
        }
    }

    // Fill form - make sure userId and isEditUser are set correctly
    const userIdEl = document.getElementById('userId');
    const isEditUserEl = document.getElementById('isEditUser');
    
    if (userIdEl) {
        userIdEl.value = user.id;
    } else {
        console.error('userId element not found!');
    }
    
    if (isEditUserEl) {
        isEditUserEl.value = 'true';
    } else {
        console.error('isEditUser element not found!');
    }
    
    if (userName) {
        userName.value = user.username;
        userName.disabled = false; // Allow editing username for manager
    }
    if (userEmail) userEmail.value = user.email || '';
    if (userType) {
        userType.value = user.type;
        // Prevent selecting system_engineer for manager
        if (isManager && userType.value === 'system_engineer') {
            userType.value = 'manager'; // Reset to manager if somehow system_engineer is selected
        }
    }
    if (userStatus) userStatus.value = user.status || 'active';
    
    // Password is optional when editing
    if (passwordRequired) passwordRequired.style.display = 'none';
    if (passwordHint) passwordHint.style.display = 'block';
    if (userPassword) {
        userPassword.required = false;
        userPassword.value = '';
    }
    
    // For manager users - allow editing only username and password
    if (isManager) {
        if (userType) {
            userType.disabled = true;
            userType.style.opacity = '0.6';
            userType.style.cursor = 'not-allowed';
            userType.title = 'لا يمكن تعديل نوع المستخدم - المدير';
        }
        
        if (userStatus) {
            userStatus.disabled = true;
            userStatus.style.opacity = '0.6';
            userStatus.style.cursor = 'not-allowed';
            userStatus.title = 'لا يمكن تعديل حالة المستخدم - المدير';
        }
        
        // Disable all permission checkboxes for manager
        document.querySelectorAll('input[name="permissions"]').forEach(cb => {
            cb.disabled = true;
            cb.style.opacity = '0.6';
            cb.style.cursor = 'not-allowed';
            cb.parentElement.style.opacity = '0.6';
            cb.parentElement.style.cursor = 'not-allowed';
        });
        
        // Show warning message for manager
        const warningDiv = document.createElement('div');
        warningDiv.id = 'managerWarning';
        warningDiv.style.cssText = 'background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 12px; margin-bottom: 20px; color: #856404; font-size: 0.875rem;';
        warningDiv.innerHTML = '⚠️ <strong>ملاحظة:</strong> المستخدم المدير - يمكنك تعديل اسم المستخدم وكلمة المرور فقط. النوع والصلاحيات والحالة محمية.';
        
        // Insert warning before permissions section
        const permissionsSection = document.querySelector('.permissions-section');
        if (permissionsSection && !document.getElementById('managerWarning')) {
            permissionsSection.parentElement.insertBefore(warningDiv, permissionsSection);
        }
    }
    
    // Protect default admin - disable type, status, and permissions
    if (isDefaultAdmin) {
        if (userType) {
            userType.disabled = true;
            userType.style.opacity = '0.6';
            userType.style.cursor = 'not-allowed';
            userType.title = 'لا يمكن تعديل نوع المستخدم الافتراضي admin';
        }
        
        if (userStatus) {
            userStatus.disabled = true;
            userStatus.style.opacity = '0.6';
            userStatus.style.cursor = 'not-allowed';
            userStatus.title = 'لا يمكن تعديل حالة المستخدم الافتراضي admin';
        }
        
        // Disable all permission checkboxes
        document.querySelectorAll('input[name="permissions"]').forEach(cb => {
            cb.disabled = true;
            cb.style.opacity = '0.6';
            cb.style.cursor = 'not-allowed';
            cb.parentElement.style.opacity = '0.6';
            cb.parentElement.style.cursor = 'not-allowed';
        });
        
        // Show warning message
        const warningDiv = document.createElement('div');
        warningDiv.id = 'adminWarning';
        warningDiv.style.cssText = 'background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 12px; margin-bottom: 20px; color: #856404; font-size: 0.875rem;';
        warningDiv.innerHTML = '⚠️ <strong>ملاحظة:</strong> المستخدم الافتراضي admin - يمكنك تعديل اسم المستخدم وكلمة المرور فقط. النوع والصلاحيات والحالة محمية.';
        
        // Insert warning before permissions section
        const permissionsSection = document.querySelector('.permissions-section');
        if (permissionsSection && !document.getElementById('adminWarning')) {
            permissionsSection.parentElement.insertBefore(warningDiv, permissionsSection);
        }
    } else if (!isManager) {
        // Enable all fields for non-admin users
        if (userType) {
            userType.disabled = false;
            userType.style.opacity = '1';
            userType.style.cursor = '';
            userType.title = '';
        }
        
        if (userStatus) {
            userStatus.disabled = false;
            userStatus.style.opacity = '1';
            userStatus.style.cursor = '';
            userStatus.title = '';
        }
        
        document.querySelectorAll('input[name="permissions"]').forEach(cb => {
            cb.disabled = false;
            cb.style.opacity = '1';
            cb.style.cursor = '';
            cb.parentElement.style.opacity = '1';
            cb.parentElement.style.cursor = '';
        });
        
        // Remove warnings if exist
        const adminWarning = document.getElementById('adminWarning');
        if (adminWarning) {
            adminWarning.remove();
        }
        const managerWarning = document.getElementById('managerWarning');
        if (managerWarning) {
            managerWarning.remove();
        }
    }
    
    // Set permissions
    document.querySelectorAll('input[name="permissions"]').forEach(cb => {
        cb.checked = false;
    });
    
    // Parse permissions if it's a string - handle "*" as string
    let permissions = [];
    if (typeof user.permissions === 'string') {
        const permStr = user.permissions.trim();
        if (permStr === '*') {
            permissions = ['*'];
        } else if (permStr === '' || permStr === 'null') {
            permissions = [];
        } else {
            try {
                permissions = JSON.parse(permStr);
                if (!Array.isArray(permissions)) {
                    permissions = [];
                }
            } catch (e) {
                if (permStr.includes('*')) {
                    permissions = ['*'];
                } else {
                    permissions = [];
                }
            }
        }
    } else if (Array.isArray(user.permissions)) {
        permissions = user.permissions;
    } else {
        permissions = [];
    }
    
    if (permissions && permissions.includes('*')) {
        // Admin has all permissions
        document.querySelectorAll('input[name="permissions"]').forEach(cb => {
            cb.checked = true;
        });
    } else if (permissions && Array.isArray(permissions)) {
        permissions.forEach(permission => {
            const checkbox = document.querySelector(`input[name="permissions"][value="${permission}"]`);
            if (checkbox) {
                checkbox.checked = true;
            }
        });
    }
    
    if (title) title.textContent = 'تعديل المستخدم';
    
    // Show modal
    modal.classList.add('active');
    modal.style.display = 'flex';
    
    // Focus on username field
    if (userName) {
        setTimeout(() => userName.focus(), 100);
    }
}

// Close User Modal
function closeUserModal() {
    const modal = document.getElementById('userModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
}

// Handle User Form Submit
async function handleUserFormSubmit(e) {
    e.preventDefault();

    // Check if current user can add/edit users (only system_engineer)
    const currentUserType = localStorage.getItem('asel_userType') || '';
    if (currentUserType !== 'system_engineer') {
        if (window.showToast) {
            window.showToast('ليس لديك صلاحية لإضافة أو تعديل المستخدمين. فقط مهندس النظام يمكنه إدارة المستخدمين.', 'error');
        } else {
            alert('⚠️ ليس لديك صلاحية لإضافة أو تعديل المستخدمين. فقط مهندس النظام يمكنه إدارة المستخدمين.');
        }
        return;
    }

    const isEditUserEl = document.getElementById('isEditUser');
    const userIdEl = document.getElementById('userId');
    
    const isEdit = isEditUserEl && isEditUserEl.value === 'true';
    const userId = userIdEl ? userIdEl.value : '';

    const userName = document.getElementById('userName').value.trim();
    const userEmail = document.getElementById('userEmail').value.trim();
    const userPassword = document.getElementById('userPassword').value;
    const userType = document.getElementById('userType').value;
    const userStatus = document.getElementById('userStatus').value;

    // Validation
    if (!userName) {
        if (window.showToast) {
            window.showToast('يرجى إدخال اسم المستخدم', 'error');
        } else {
            alert('⚠️ يرجى إدخال اسم المستخدم');
        }
        document.getElementById('userName').focus();
        return;
    }

    if (userName.length < 3) {
        if (window.showToast) {
            window.showToast('اسم المستخدم يجب أن يكون على الأقل 3 أحرف', 'error');
        } else {
            alert('⚠️ اسم المستخدم يجب أن يكون على الأقل 3 أحرف');
        }
        document.getElementById('userName').focus();
        return;
    }

    // Check for duplicate username (only for new users or if username changed)
    // Exclude current user from duplicate check when editing
    if (!isEdit) {
        // New user - check if username exists
        const duplicateUser = users.find(u => u.username.toLowerCase() === userName.toLowerCase());
        if (duplicateUser) {
            if (window.showToast) {
                window.showToast('اسم المستخدم موجود بالفعل', 'error');
            } else {
                alert('⚠️ اسم المستخدم موجود بالفعل');
            }
            document.getElementById('userName').focus();
            return;
        }
    } else {
        // Editing existing user - check if username changed and if new username exists
        const currentUser = users.find(u => u.id === userId);
        if (currentUser && userName.toLowerCase() !== currentUser.username.toLowerCase()) {
            // Username changed - check for duplicates excluding current user
            const duplicateUser = users.find(u => 
                u.id !== userId && 
                u.username.toLowerCase() === userName.toLowerCase()
            );
            if (duplicateUser) {
                if (window.showToast) {
                window.showToast('اسم المستخدم موجود بالفعل', 'error');
            } else {
                alert('⚠️ اسم المستخدم موجود بالفعل');
            }
                document.getElementById('userName').focus();
                return;
            }
        }
    }

    // Email validation (optional field but if provided should be valid)
    if (userEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
        if (window.showToast) {
            window.showToast('يرجى إدخال بريد إلكتروني صحيح', 'error');
        } else {
            alert('⚠️ يرجى إدخال بريد إلكتروني صحيح');
        }
        document.getElementById('userEmail').focus();
        return;
    }

    // Password validation for new users
    if (!isEdit && !userPassword) {
        if (window.showToast) {
            window.showToast('يرجى إدخال كلمة المرور', 'error');
        } else {
            alert('⚠️ يرجى إدخال كلمة المرور');
        }
        document.getElementById('userPassword').focus();
        return;
    }

    if (!isEdit && userPassword.length < 4) {
        if (window.showToast) {
            window.showToast('كلمة المرور يجب أن تكون على الأقل 4 أحرف', 'error');
        } else {
            alert('⚠️ كلمة المرور يجب أن تكون على الأقل 4 أحرف');
        }
        document.getElementById('userPassword').focus();
        return;
    }

    // Get selected permissions
    const selectedPermissions = [];
    document.querySelectorAll('input[name="permissions"]:checked').forEach(cb => {
        selectedPermissions.push(cb.value);
    });

    // Prevent selecting system_engineer type (only system_engineer can have this type)
    if (userType === 'system_engineer') {
        const currentUserType = localStorage.getItem('asel_userType') || '';
        if (currentUserType !== 'system_engineer') {
            if (window.showToast) {
                window.showToast('لا يمكن اختيار نوع مهندس النظام. فقط مهندس النظام يمكنه إنشاء مستخدمين من هذا النوع.', 'error');
            } else {
                alert('⚠️ لا يمكن اختيار نوع مهندس النظام. فقط مهندس النظام يمكنه إنشاء مستخدمين من هذا النوع.');
            }
            return;
        }
    }

    // Manager and system_engineer always have full permissions (*)
    let finalPermissions;
    if (userType === 'manager' || userType === 'system_engineer') {
        finalPermissions = ['*'];
    } else if (userType === 'admin') {
        // Admin also has full permissions
        finalPermissions = ['*'];
    } else {
        // For other types, use selected permissions or all if all selected
        const totalPermissions = document.querySelectorAll('input[name="permissions"]').length;
        finalPermissions = (selectedPermissions.length === totalPermissions && totalPermissions > 0)
            ? ['*'] 
            : selectedPermissions;
        
        // Ensure at least one permission is selected for non-admin/manager types
        if (finalPermissions.length === 0) {
            if (window.showToast) {
                window.showToast('يرجى تحديد صلاحية واحدة على الأقل للمستخدم', 'error');
            } else {
                alert('⚠️ يرجى تحديد صلاحية واحدة على الأقل للمستخدم');
            }
            return;
        }
    }

    // Prepare user data - only include email if provided
    const userData = {
        username: userName,
        type: userType,
        status: userStatus,
        permissions: JSON.stringify(finalPermissions), // Store as JSON string in DB
        updatedAt: new Date().toISOString()
    };
    
    // Only add email if it's provided and not empty
    if (userEmail && userEmail.trim() !== '') {
        userData.email = userEmail.trim();
    }

    try {
        if (isEdit && userId) {
            // Edit existing user - MUST have userId
            const existingUser = users.find(u => u.id === userId);
            
            if (!existingUser) {
                if (window.showToast) {
                    window.showToast('المستخدم غير موجود', 'error');
                } else {
                    alert('⚠️ المستخدم غير موجود');
                }
                console.error('User not found in users array. Available IDs:', users.map(u => u.id));
                return;
            }

            // Prevent editing system_engineer users
            if (existingUser.type === 'system_engineer') {
                alert('⚠️ لا يمكن تعديل مستخدم مهندس النظام');
                return;
            }
            
            // Check if this is a manager user - manager can only edit username and password
            const isManager = existingUser.type === 'manager';
            
            // Check if this is the default admin user (deprecated - now using system_engineer)
            // Default admin is identified by: type === 'admin' AND permissions === ['*']
            // We don't check username because user might have changed it
            let isDefaultAdmin = false;
            if (existingUser.type === 'admin') {
                try {
                    let perms = [];
                    if (typeof existingUser.permissions === 'string') {
                        const permStr = existingUser.permissions.trim();
                        if (permStr === '*') {
                            perms = ['*'];
                        } else if (permStr && permStr !== '' && permStr !== 'null') {
                            try {
                                perms = JSON.parse(permStr);
                                if (!Array.isArray(perms)) perms = [];
                            } catch (e) {
                                if (permStr.includes('*')) perms = ['*'];
                            }
                        }
                    } else if (Array.isArray(existingUser.permissions)) {
                        perms = existingUser.permissions;
                    }
                    
                    // Check if has full permissions (*) - this identifies default admin
                    isDefaultAdmin = perms.includes('*');
                } catch (e) {
                    isDefaultAdmin = false;
                }
            }
            
            // For manager users - only allow username and password changes
            if (isManager) {
                // Keep original values for protected fields
                userData.type = existingUser.type; // Keep as manager
                userData.status = existingUser.status || 'active'; // Keep original status
                userData.permissions = existingUser.permissions; // Keep original permissions (full permissions)
                
                // Parse permissions correctly - handle "*" as string
                let parsedPerms = ['*'];
                if (typeof existingUser.permissions === 'string') {
                    const permStr = existingUser.permissions.trim();
                    if (permStr === '*') {
                        parsedPerms = ['*'];
                    } else if (permStr === '' || permStr === 'null') {
                        parsedPerms = ['*'];
                    } else {
                        try {
                            parsedPerms = JSON.parse(permStr);
                            if (!Array.isArray(parsedPerms)) {
                                parsedPerms = ['*'];
                            }
                        } catch (e) {
                            if (permStr.includes('*')) {
                                parsedPerms = ['*'];
                            } else {
                                parsedPerms = ['*'];
                            }
                        }
                    }
                } else if (Array.isArray(existingUser.permissions)) {
                    parsedPerms = existingUser.permissions;
                }
                finalPermissions = parsedPerms;
            }
            
            // Protect default admin - only allow username and password changes
            if (isDefaultAdmin) {
                // Keep original values for protected fields
                userData.type = existingUser.type; // Keep as admin
                userData.status = existingUser.status || 'active'; // Keep original status
                userData.permissions = existingUser.permissions; // Keep original permissions
                
                // Parse permissions correctly - handle "*" as string
                let parsedPerms = ['*'];
                if (typeof existingUser.permissions === 'string') {
                    const permStr = existingUser.permissions.trim();
                    if (permStr === '*') {
                        parsedPerms = ['*'];
                    } else if (permStr === '' || permStr === 'null') {
                        parsedPerms = ['*'];
                    } else {
                        try {
                            parsedPerms = JSON.parse(permStr);
                            if (!Array.isArray(parsedPerms)) {
                                parsedPerms = ['*'];
                            }
                        } catch (e) {
                            if (permStr.includes('*')) {
                                parsedPerms = ['*'];
                            } else {
                                parsedPerms = ['*'];
                            }
                        }
                    }
                } else if (Array.isArray(existingUser.permissions)) {
                    parsedPerms = existingUser.permissions;
                }
                finalPermissions = parsedPerms;
            }

            userData.id = existingUser.id;
            userData.createdAt = existingUser.createdAt;
            userData.lastLogin = existingUser.lastLogin;
            
            // Only update password if provided
            if (userPassword && userPassword.trim() !== '') {
                if (userPassword.length < 4) {
                    if (window.showToast) {
            window.showToast('كلمة المرور يجب أن تكون على الأقل 4 أحرف', 'error');
        } else {
            alert('⚠️ كلمة المرور يجب أن تكون على الأقل 4 أحرف');
        }
                    document.getElementById('userPassword').focus();
                    return;
                }
                userData.password = userPassword; // Will be automatically hashed by database.js
            } else {
                userData.password = existingUser.password;
            }

            // Save to database - UPDATE existing user
            if (window.electronAPI && window.electronAPI.dbUpdate) {
                const updateResult = await window.electronAPI.dbUpdate('users', userId, userData);
                
                // Check if update was successful
                if (!updateResult || !updateResult.success) {
                    const errorMsg = updateResult?.error || 'خطأ غير معروف';
                    console.error('Failed to update user in database:', errorMsg);
                    if (window.showToast) {
                        window.showToast('فشل تحديث المستخدم في قاعدة البيانات: ' + errorMsg, 'error');
                    } else {
                        alert('فشل تحديث المستخدم في قاعدة البيانات: ' + errorMsg);
                    }
                    return;
                }
            } else {
                // Fallback to localStorage
                const index = users.findIndex(u => u.id === userId);
                if (index !== -1) {
                    users[index] = {
                        ...userData,
                        permissions: finalPermissions
                    };
                    saveUsers();
                } else {
                    console.error('User not found in array for update');
                }
            }
        } else {
            // Add new user - only if NOT editing
            userData.id = Date.now().toString();
            userData.password = userPassword; // Will be automatically hashed by database.js
            userData.createdAt = new Date().toISOString();
            userData.lastLogin = null;

            // Save to database
            if (window.electronAPI && window.electronAPI.dbInsert) {
                try {
                    const result = await window.electronAPI.dbInsert('users', userData);
                    
                    // Check if insert was successful
                    if (result && result.success === false) {
                        console.error('Database insert failed:', result.error);
                        if (result.error && (result.error.includes('UNIQUE') || result.error.includes('duplicate'))) {
                            if (window.showToast) {
                window.showToast('اسم المستخدم موجود بالفعل', 'error');
            } else {
                alert('⚠️ اسم المستخدم موجود بالفعل');
            }
                            document.getElementById('userName').focus();
                            return;
                        }
                        throw new Error(result.error || 'فشل حفظ المستخدم في قاعدة البيانات');
                    }
                } catch (dbError) {
                    console.error('Database insert error:', dbError);
                    // Check if it's a duplicate key error
                    const errorMessage = dbError.message || dbError.toString() || '';
                    if (errorMessage.includes('UNIQUE') || errorMessage.includes('duplicate')) {
                        if (window.showToast) {
                window.showToast('اسم المستخدم موجود بالفعل', 'error');
            } else {
                alert('⚠️ اسم المستخدم موجود بالفعل');
            }
                        document.getElementById('userName').focus();
                        return;
                    }
                    throw dbError;
                }
            } else {
                // Fallback to localStorage
                users.push({
                    ...userData,
                    permissions: finalPermissions
                });
                saveUsers();
            }
        }

        // Reload users from database to verify save
        await loadUsers();
        
        // Verify the user was actually saved
        const savedUser = users.find(u => u.username === userName);
        if (!savedUser) {
            // Try reloading again
            await loadUsers();
            const retryUser = users.find(u => u.username === userName);
            if (!retryUser) {
                if (window.showToast) {
                    window.showToast('تم حفظ المستخدم لكن لم يظهر في القائمة. يرجى تحديث الصفحة.', 'error');
                } else {
                    alert('⚠️ تم حفظ المستخدم لكن لم يظهر في القائمة. يرجى تحديث الصفحة.');
                }
                console.error('User still not found after reload');
            }
        }
        
        renderUsers();
        closeUserModal();
        if (window.showToast) {
            window.showToast('تم حفظ المستخدم بنجاح', 'success');
        } else {
            alert('✓ تم حفظ المستخدم بنجاح');
        }
    } catch (error) {
        console.error('Error saving user:', error);
        let errorMessage = '⚠️ حدث خطأ أثناء حفظ المستخدم';
        
        if (error.message) {
            if (error.message.includes('UNIQUE') || error.message.includes('duplicate')) {
                errorMessage = '⚠️ اسم المستخدم موجود بالفعل';
            } else {
                errorMessage = '⚠️ ' + error.message;
            }
        }
        
        if (window.showToast) {
            window.showToast(errorMessage, 'error');
        } else {
            alert(errorMessage);
        }
    }
}

// Delete User
async function deleteUser(userId) {
    console.log('🗑️ deleteUser called with userId:', userId);
    const user = users.find(u => u.id === userId);
    if (!user) {
        console.log('❌ User not found:', userId);
        return;
    }
    console.log('✅ User found:', user.username, user.type);

    // Get current logged-in user ID and username
    const currentUserId = localStorage.getItem('asel_userId') || '';
    const currentUsername = localStorage.getItem('asel_user') || '';
    const currentUserType = localStorage.getItem('asel_userType') || '';
    
    // Allow deletion for users with type "system_engineer" only
    const canDeleteUsers = currentUserType === 'system_engineer';
    
    // Only allow deletion if current user is "system_engineer"
    if (!canDeleteUsers) {
        if (window.showToast) {
            window.showToast('لا يمكنك حذف المستخدمين. فقط المستخدمون من نوع "مهندس النظام" يمكنهم حذف المستخدمين', 'error');
        }
        return;
    }
    
    // Prevent deleting yourself
    const isCurrentUser = (user.id === currentUserId) || (user.username === currentUsername);
    if (isCurrentUser) {
        if (window.showToast) {
            window.showToast('لا يمكنك حذف حسابك الخاص', 'error');
        }
        return;
    }

    // Prevent deleting system_engineer users
    if (user.type === 'system_engineer') {
        if (window.showToast) {
            window.showToast('لا يمكن حذف مستخدم مهندس النظام', 'error');
        }
        return;
    }

    if (user.type === 'admin' && users.filter(u => u.type === 'admin').length === 1) {
        if (window.showToast) {
            window.showToast('لا يمكن حذف آخر مدير نظام', 'error');
        }
        return;
    }

    // Use custom confirmation dialog instead of confirm()
    showConfirmDialog(
        `هل أنت متأكد من حذف المستخدم "${user.username}"؟`,
        async () => {
            // User confirmed - proceed with deletion
            try {
                if (window.electronAPI && window.electronAPI.dbDelete) {
                    await window.electronAPI.dbDelete('users', userId);
                } else {
                    // Fallback to localStorage
                    users = users.filter(u => u.id !== userId);
                    saveUsers();
                }

                await loadUsers();
                renderUsers();
                if (window.showToast) {
                    window.showToast('تم حذف المستخدم بنجاح', 'success');
                }
            } catch (error) {
                console.error('Error deleting user:', error);
                if (window.showToast) {
                    window.showToast('حدث خطأ أثناء حذف المستخدم', 'error');
                }
            }
        },
        () => {
            // User cancelled - do nothing
        }
    );
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
    
    // Close function
    const closeModal = () => {
        modal.classList.remove('active');
        setTimeout(() => {
            document.body.removeChild(modal);
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

// Render Users
function renderUsers() {
    const tbody = document.getElementById('usersTableBody');
    const emptyState = document.getElementById('usersEmptyState');
    
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Get filtered users
    const filteredUsers = getFilteredUsers();
    
    if (filteredUsers.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }
    
    if (emptyState) emptyState.classList.add('hidden');
    
    // Get current logged-in user ID
    const currentUserId = localStorage.getItem('asel_userId') || '';
    const currentUsername = localStorage.getItem('asel_user') || '';
    const currentUserType = localStorage.getItem('asel_userType') || '';
    
    // Allow actions (edit/delete) for users with type "system_engineer" only
    const canDeleteUsers = currentUserType === 'system_engineer';
    const canEditUsers = currentUserType === 'system_engineer';
    
    
    filteredUsers.forEach(user => {
        const row = document.createElement('tr');
        const userTypeText = {
            'admin': 'مدير النظام',
            'manager': 'مدير',
            'accountant': 'محاسب',
            'sales': 'مندوب مبيعات',
            'warehouse': 'مخزن',
            'system_engineer': 'مهندس النظام'
        };
        
        // Parse permissions if it's a string
        const permissions = typeof user.permissions === 'string' 
            ? JSON.parse(user.permissions || '[]') 
            : user.permissions || [];
        
        // Check if this is the current logged-in user
        const isCurrentUser = (user.id === currentUserId) || (user.username === currentUsername);
        
        // Determine if delete button should be shown
        // Show delete button only if:
        // 1. Current user is "system_engineer"
        // 2. This is not the current logged-in user (can't delete yourself)
        // 3. System engineer can delete anyone (except themselves)
        // 4. User is not admin or is not the last admin
        let canDeleteThisUser = false;
        if (currentUserType === 'system_engineer') {
            // System engineer can delete anyone except themselves
            canDeleteThisUser = !isCurrentUser;
        }
        
        const showDeleteButton = canDeleteUsers && 
                                  canDeleteThisUser && 
                                  !(user.type === 'admin' && users.filter(u => u.type === 'admin').length === 1);
        
        // Create delete button HTML
        const deleteButtonHTML = showDeleteButton ? 
            `<button class="action-btn delete" data-user-id="${user.id}" title="حذف">🗑️</button>` 
            : '';
        
        row.innerHTML = `
            <td>${user.username}</td>
            <td>${user.email || '-'}</td>
            <td><span class="user-type-badge ${user.type}">${userTypeText[user.type] || user.type}</span></td>
            <td><span class="status-badge ${user.status}">${user.status === 'active' ? 'نشط' : 'غير نشط'}</span></td>
            <td>${user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('ar-EG') : '---'}</td>
            <td>
                <div class="actions-buttons">
                </div>
            </td>
        `;
        
        // Add edit button only for system_engineer
        const actionsDiv = row.querySelector('.actions-buttons');
        if (canEditUsers && actionsDiv) {
            const editBtn = document.createElement('button');
            editBtn.className = 'action-btn edit';
            editBtn.setAttribute('data-user-id', user.id);
            editBtn.setAttribute('title', 'تعديل');
            editBtn.textContent = '✏️';
            editBtn.addEventListener('click', () => openEditUserModal(user.id));
            actionsDiv.appendChild(editBtn);
        }
        
        // Add delete button if needed
        if (showDeleteButton && actionsDiv) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'action-btn delete';
            deleteBtn.setAttribute('data-user-id', user.id);
            deleteBtn.setAttribute('title', 'حذف');
            deleteBtn.textContent = '🗑️';
            deleteBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🗑️ Delete button clicked for user:', user.id, user.username);
                await deleteUser(user.id);
            });
            actionsDiv.appendChild(deleteBtn);
        }
        
        tbody.appendChild(row);
    });
}

// Setup Search and Filters
function setupSearchAndFilters() {
    const searchInput = document.getElementById('searchInput');
    const typeFilter = document.getElementById('typeFilter');
    const statusFilter = document.getElementById('statusFilter');
    
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderUsers();
        });
    }
    
    if (typeFilter) {
        typeFilter.addEventListener('change', () => {
            renderUsers();
        });
    }
    
    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            renderUsers();
        });
    }
}

// Filter users based on search and filters
function getFilteredUsers() {
    let filtered = [...users];
    
    // Search filter
    const searchInput = document.getElementById('searchInput');
    if (searchInput && searchInput.value.trim()) {
        const searchTerm = searchInput.value.trim().toLowerCase();
        filtered = filtered.filter(user => 
            user.username.toLowerCase().includes(searchTerm) ||
            (user.email && user.email.toLowerCase().includes(searchTerm))
        );
    }
    
    // Type filter
    const typeFilter = document.getElementById('typeFilter');
    if (typeFilter && typeFilter.value) {
        filtered = filtered.filter(user => user.type === typeFilter.value);
    }
    
    // Status filter
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter && statusFilter.value) {
        filtered = filtered.filter(user => user.status === statusFilter.value);
    }
    
    return filtered;
}

// Make functions global
window.openAddUserModal = openAddUserModal;
window.openEditUserModal = openEditUserModal;
window.deleteUser = deleteUser;
window.closeUserModal = closeUserModal;

