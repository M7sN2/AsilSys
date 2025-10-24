// Login functionality
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const errorMessage = document.getElementById('errorMessage');
const spinner = document.getElementById('spinner');
const rememberMe = document.getElementById('rememberMe');

// Check if there's saved username
window.addEventListener('DOMContentLoaded', () => {
    // Ensure input fields are enabled and writable
    if (usernameInput) {
        usernameInput.disabled = false;
        usernameInput.readOnly = false;
    }
    if (passwordInput) {
        passwordInput.disabled = false;
        passwordInput.readOnly = false;
    }
    
    const savedUsername = localStorage.getItem('asel_username');
    const savedRememberMe = localStorage.getItem('asel_rememberMe');
    
    if (savedUsername && savedRememberMe === 'true') {
        usernameInput.value = savedUsername;
        rememberMe.checked = true;
    }
    
    // Focus on username input after page load
    setTimeout(() => {
        if (usernameInput) {
            usernameInput.focus();
        }
    }, 100);
});

// Form submission
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    
    if (!username || !password) {
        showError('يرجى إدخال اسم المستخدم وكلمة المرور');
        return;
    }
    
    // Show loading state
    loginBtn.disabled = true;
    loginBtn.querySelector('span').classList.add('hidden');
    spinner.classList.remove('hidden');
    errorMessage.classList.add('hidden');
    
    try {
        // Authenticate user from database
        const loginResult = await simulateLogin(username, password);
        
        if (!loginResult.success) {
            showError('اسم المستخدم أو كلمة المرور غير صحيحة');
            resetLoginButton();
            return;
        }
        
        const user = loginResult.user;
        
        // Save username if remember me is checked
        if (rememberMe.checked) {
            localStorage.setItem('asel_username', username);
            localStorage.setItem('asel_rememberMe', 'true');
        } else {
            localStorage.removeItem('asel_username');
            localStorage.removeItem('asel_rememberMe');
        }
        
        // Save user session with permissions
        console.log('💾 Saving user session to localStorage');
        console.log('💾 User permissions to save:', user.permissions);
        
        localStorage.setItem('asel_loggedIn', 'true');
        localStorage.setItem('asel_user', user.username);
        localStorage.setItem('asel_userId', user.id || '');
        localStorage.setItem('asel_userType', user.type || 'sales');
        localStorage.setItem('asel_userPermissions', JSON.stringify(user.permissions || []));
        
        // Verify what was saved
        const savedPerms = localStorage.getItem('asel_userPermissions');
        console.log('💾 Saved permissions in localStorage:', savedPerms);
        console.log('💾 Parsed saved permissions:', JSON.parse(savedPerms || '[]'));
        
        // Dispatch custom event to notify permissions system
        window.dispatchEvent(new Event('permissionsUpdated'));
        
        // Reset sidebar scroll position to top (show الشاشة الرئيسية first)
        localStorage.removeItem('sidebarScroll');
        sessionStorage.setItem('freshLogin', 'true'); // Flag to reset sidebar scroll on next page load
        
        // Send login success event to main process
        if (window.electronAPI) {
            window.electronAPI.sendLoginSuccess({
                username: user.username,
                userId: user.id,
                userType: user.type,
                timestamp: new Date().toISOString()
            });
        } else {
            // Fallback for testing without Electron
            console.log('Login successful:', user);
            if (window.showToast) {
                window.showToast('تم تسجيل الدخول بنجاح! (وضع الاختبار)', 'success');
            }
        }
        
    } catch (error) {
        showError(error.message || 'حدث خطأ أثناء تسجيل الدخول');
        resetLoginButton();
    }
});

async function simulateLogin(username, password) {
    // Check database for user authentication
    return new Promise(async (resolve, reject) => {
        try {
            if (window.electronAPI && window.electronAPI.dbGetAll) {
                // Get all users from database
                const allUsers = await window.electronAPI.dbGetAll('users');
                
                // If no users exist, create default system engineer user
                if (!allUsers || allUsers.length === 0) {
                    console.log('No users found, creating default system engineer (BashMohndes)...');
                    if (username === 'BashMohndes' && password === 'BashMohndesadmin') {
                        // Create system engineer user
                        const systemEngineerUser = {
                            id: 'system_engineer_' + Date.now().toString(),
                            username: 'BashMohndes',
                            password: 'BashMohndesadmin',
                            email: '',
                            type: 'system_engineer',
                            status: 'active',
                            permissions: JSON.stringify(['*']),
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                            lastLogin: null
                        };
                        
                        try {
                            if (window.electronAPI.dbInsert) {
                                const insertResult = await window.electronAPI.dbInsert('users', systemEngineerUser);
                                console.log('System engineer user insert result:', insertResult);
                                
                                // Check if insert failed
                                if (insertResult && insertResult.success === false) {
                                    console.error('Failed to insert system engineer user:', insertResult.error);
                                } else if (insertResult && insertResult.changes === 1) {
                                    console.log('✅ System engineer user created successfully in database');
                                }
                            }
                        } catch (error) {
                            console.error('Error creating system engineer user during login:', error);
                        }
                        
                        resolve({ 
                            success: true, 
                            user: { 
                                id: systemEngineerUser.id,
                                username: 'BashMohndes', 
                                type: 'system_engineer', 
                                permissions: ['*'] 
                            } 
                        });
                        return;
                    }
                    reject(new Error('اسم المستخدم أو كلمة المرور غير صحيحة'));
                    return;
                }
                
                // Find user by username (case-insensitive)
                let user = allUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
                
                // If user not found and trying to login as BashMohndes, check if we need to create it
                if (!user && username === 'BashMohndes' && password === 'BashMohndesadmin') {
                    console.log('System engineer user not found, creating default system engineer...');
                    const systemEngineerUser = {
                        id: 'system_engineer_' + Date.now().toString(),
                        username: 'BashMohndes',
                        password: 'BashMohndesadmin',
                        email: '',
                        type: 'system_engineer',
                        status: 'active',
                        permissions: JSON.stringify(['*']),
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        lastLogin: null
                    };
                    
                    try {
                        if (window.electronAPI.dbInsert) {
                            const insertResult = await window.electronAPI.dbInsert('users', systemEngineerUser);
                            console.log('System engineer user insert result:', insertResult);
                            
                            // Check if insert failed
                            if (insertResult && insertResult.success === false) {
                                console.error('Failed to insert system engineer user:', insertResult.error);
                                throw new Error(insertResult.error || 'Failed to create system engineer user');
                            }
                            
                            // Reload users to include the new system engineer
                            const updatedUsers = await window.electronAPI.dbGetAll('users');
                            console.log('Users after insert:', updatedUsers);
                            user = updatedUsers.find(u => u.username === 'BashMohndes' && u.type === 'system_engineer');
                            
                            if (user) {
                                // Parse permissions - handle "*" as string
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
                                        } catch (parseErr) {
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
                                
                                // Update last login
                                if (window.electronAPI.dbUpdate) {
                                    await window.electronAPI.dbUpdate('users', user.id, {
                                        lastLogin: new Date().toISOString()
                                    });
                                }
                                
                                resolve({ 
                                    success: true, 
                                    user: {
                                        id: user.id,
                                        username: user.username,
                                        type: user.type,
                                        permissions: permissions,
                                        email: user.email
                                    }
                                });
                                return;
                            }
                        }
                    } catch (error) {
                        console.error('Error creating system engineer user during login:', error);
                        // Still allow login if insert fails
                        resolve({ 
                            success: true, 
                            user: { 
                                id: systemEngineerUser.id,
                                username: 'BashMohndes', 
                                type: 'system_engineer', 
                                permissions: ['*'] 
                            } 
                        });
                        return;
                    }
                }
                
                // If still no user found, reject
                if (!user) {
                    reject(new Error('اسم المستخدم أو كلمة المرور غير صحيحة'));
                    return;
                }
                
                // Check if user is active
                if (user.status !== 'active') {
                    reject(new Error('حسابك غير نشط. يرجى التواصل مع المدير'));
                    return;
                }
                
                // Check password using bcrypt comparison
                let passwordMatch = false;
                if (window.electronAPI && window.electronAPI.comparePassword) {
                    try {
                        const compareResult = await window.electronAPI.comparePassword(password, user.password);
                        if (compareResult.success) {
                            passwordMatch = compareResult.isMatch;
                        } else {
                            // If comparison failed, reject login for security
                            console.error('Password comparison failed:', compareResult.error);
                            passwordMatch = false;
                        }
                    } catch (error) {
                        console.error('Error comparing password:', error);
                        // Don't allow login on error - security first
                        passwordMatch = false;
                    }
                } else {
                    // If IPC not available, reject login for security
                    console.error('IPC not available for password comparison');
                    passwordMatch = false;
                }
                
                if (!passwordMatch) {
                    reject(new Error('اسم المستخدم أو كلمة المرور غير صحيحة'));
                    return;
                }
                
                // If password is plain text (not hashed), update it to hashed version
                // This ensures all passwords are properly hashed
                if (user.password && user.password.length < 60) {
                    console.warn('User password is not hashed. Updating to hashed version...');
                    try {
                        if (window.electronAPI && window.electronAPI.hashPassword && window.electronAPI.dbUpdate) {
                            const hashResult = await window.electronAPI.hashPassword(password);
                            if (hashResult.success) {
                                await window.electronAPI.dbUpdate('users', user.id, {
                                    password: hashResult.hashedPassword
                                });
                                console.log('✅ User password updated to hashed version');
                            }
                        }
                    } catch (updateError) {
                        console.error('Error updating password to hashed version:', updateError);
                        // Don't fail login if update fails
                    }
                }
                
                // Parse permissions - handle "*" as string
                console.log('🔍 Reading permissions from DB for user:', user.username);
                console.log('🔍 Raw permissions from DB:', user.permissions);
                console.log('🔍 Type of permissions:', typeof user.permissions);
                
                let permissions = [];
                if (typeof user.permissions === 'string') {
                    const permStr = user.permissions.trim();
                    if (permStr === '*') {
                        permissions = ['*'];
                    } else if (permStr === '' || permStr === 'null' || permStr === 'undefined') {
                        permissions = [];
                    } else {
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
                
                console.log('✅ Parsed permissions array:', permissions);
                
                // Update last login
                if (window.electronAPI.dbUpdate) {
                    await window.electronAPI.dbUpdate('users', user.id, {
                        lastLogin: new Date().toISOString()
                    });
                }
                
                resolve({ 
                    success: true, 
                    user: {
                        id: user.id,
                        username: user.username,
                        type: user.type,
                        permissions: permissions,
                        email: user.email
                    }
                });
            } else {
                // Fallback to hardcoded credentials for testing
                setTimeout(() => {
                    if (username === 'BashMohndes' && password === 'BashMohndesadmin') {
                        resolve({ 
                            success: true, 
                            user: { 
                                username, 
                                type: 'system_engineer', 
                                permissions: ['*'] 
                            } 
                        });
                    } else {
                        reject(new Error('اسم المستخدم أو كلمة المرور غير صحيحة'));
                    }
                }, 1000);
            }
        } catch (error) {
            console.error('Login error:', error);
            reject(new Error('حدث خطأ أثناء تسجيل الدخول'));
        }
    });
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
}

function resetLoginButton() {
    loginBtn.disabled = false;
    loginBtn.querySelector('span').classList.remove('hidden');
    spinner.classList.add('hidden');
}

// Enter key to submit
passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        loginForm.dispatchEvent(new Event('submit'));
    }
});

// Focus first input on load
usernameInput.focus();

