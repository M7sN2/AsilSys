// Permissions Management System
// This file handles permission checks across all pages

// Prevent duplicate declaration if file is loaded multiple times
if (typeof PermissionsManager === 'undefined') {
    var PermissionsManager = {
    // Cache permissions to avoid repeated localStorage reads
    _permissionsCache: null,
    _permissionsCacheTime: null,
    
    // Get current user permissions (with caching)
    getUserPermissions() {
        // Cache for 1 second to reduce localStorage reads
        const now = Date.now();
        if (this._permissionsCache && this._permissionsCacheTime && (now - this._permissionsCacheTime) < 1000) {
            return this._permissionsCache;
        }
        
        try {
            const permissionsJson = localStorage.getItem('asel_userPermissions');
            
            if (!permissionsJson) {
                this._permissionsCache = [];
                this._permissionsCacheTime = now;
                return [];
            }
            
            const permissions = JSON.parse(permissionsJson);
            const result = Array.isArray(permissions) ? permissions : [];
            
            // Cache the result
            this._permissionsCache = result;
            this._permissionsCacheTime = now;
            
            return result;
        } catch (error) {
            console.error('❌ Error getting user permissions:', error);
            this._permissionsCache = [];
            this._permissionsCacheTime = now;
            return [];
        }
    },

    // Get current user type
    getUserType() {
        return localStorage.getItem('asel_userType') || 'sales';
    },

    // Get current user ID
    getUserId() {
        return localStorage.getItem('asel_userId') || '';
    },

    // Check if user has a specific permission
    hasPermission(permission) {
        const permissions = this.getUserPermissions();
        
        // Admin has all permissions
        if (permissions.includes('*')) {
            return true;
        }
        
        // Check if user has the specific permission (exact match)
        if (permissions.includes(permission)) {
            return true;
        }
        
        // Also check without _view suffix (e.g., 'products' matches 'products_view')
        if (permission.endsWith('_view')) {
            const basePermission = permission.replace('_view', '');
            if (permissions.includes(basePermission)) {
                return true;
            }
        }
        
        // Also check with _view suffix (e.g., 'products_view' matches 'products')
        if (!permission.endsWith('_view')) {
            const viewPermission = permission + '_view';
            if (permissions.includes(viewPermission)) {
                return true;
            }
        }
        
        return false;
    },

    // Check if user has any of the provided permissions
    hasAnyPermission(permissionArray) {
        if (!Array.isArray(permissionArray)) return false;
        
        const permissions = this.getUserPermissions();
        
        // Admin has all permissions
        if (permissions.includes('*')) {
            return true;
        }
        
        // Check if user has any of the permissions
        return permissionArray.some(perm => permissions.includes(perm));
    },

    // Check if user has all of the provided permissions
    hasAllPermissions(permissionArray) {
        if (!Array.isArray(permissionArray)) return false;
        
        const permissions = this.getUserPermissions();
        
        // Admin has all permissions
        if (permissions.includes('*')) {
            return true;
        }
        
        // Check if user has all of the permissions
        return permissionArray.every(perm => permissions.includes(perm));
    },

    // Apply permissions to sidebar links
    // NOTE: We show ALL links - protection is handled by protectSidebarLinks()
    applySidebarPermissions() {
        const userPermissions = this.getUserPermissions();
        
        const sidebarLinks = {
            'products': 'a[href="products.html"]',
            'customers': 'a[href="customers.html"]',
            'suppliers': 'a[href="suppliers.html"]',
            'sales': 'a[href="sales.html"]',
            'delivery-notes': 'a[href="delivery-notes.html"]',
            'receipts': 'a[href="receipts.html"]',
            'payments': 'a[href="payments.html"]',
            'purchases': 'a[href="purchases.html"]',
            'inventory': 'a[href="inventory.html"]',
            'assets': 'a[href="assets.html"]',
            'reports': 'a[href="reports.html"]',
            'expenses': 'a[href="expenses.html"]',
            'backup': 'a[href="backup.html"]',
            'action_logs': 'a[href="action-logs.html"]',
            'users': 'a[href="users.html"]',
            'settings': 'a[href="settings.html"]'
        };
        
        // Show ALL links - don't hide any
        Object.keys(sidebarLinks).forEach(section => {
            const selector = sidebarLinks[section];
            const link = document.querySelector(selector);
            
            if (link) {
                const li = link.closest('li');
                if (li) {
                    li.style.display = '';
                    li.classList.remove('hidden');
                }
                link.style.display = '';
                link.classList.remove('hidden');
            }
        });
    },

    // Show/hide elements based on permissions
    // NOTE: We only control page-level access, not content-level permissions
    // If user has access to the page, they see all content
    applyPermissions() {
        // Apply sidebar permissions - show all links
        this.applySidebarPermissions();
        
        // Protect sidebar links with click handlers
        this.protectSidebarLinks();
        
        // NOTE: We removed all content-level permission checks
        // If user has access to the page, they can see all content
        // Page-level access is controlled by checkPageAccess()
    },

    // Toggle element visibility based on permission
    toggleElement(permission, selector) {
        const hasPerm = this.hasPermission(permission);
        const elements = document.querySelectorAll(selector);
        
        elements.forEach(element => {
            if (element) {
                if (hasPerm) {
                    element.style.display = '';
                    element.classList.remove('hidden');
                } else {
                    element.style.display = 'none';
                    element.classList.add('hidden');
                }
            }
        });
    },

    // Check if user can access a page/section
    canAccess(section) {
        // Special case: BashMohndes always has access to delivery-notes and settlements
        const userId = this.getUserId();
        if (userId === 'BashMohndes' && (section === 'delivery-notes' || section === 'settlements')) {
            return true;
        }
        
        // Each section requires its EXACT permission - no inheritance or fallback
        const sectionPermissions = {
            'products': ['products'], // Only 'products' permission
            'customers': ['customers'], // Only 'customers' permission
            'suppliers': ['suppliers'], // Only 'suppliers' permission
            'sales': ['sales'], // Only 'sales' permission
            'purchases': ['purchases'], // Only 'purchases' permission
            'receipts': ['receipts'], // Only 'receipts' permission
            'payments': ['payments'], // Only 'payments' permission
            'inventory': ['inventory'], // Only 'inventory' permission
            'assets': ['assets'], // Only 'assets' permission
            'reports': ['reports'], // Only 'reports' permission
            'expenses': ['expenses'], // Only 'expenses' permission
            'settings': ['settings'], // Only 'settings' permission
            'users': ['users'], // Only 'users' permission
            'action_logs': ['action_logs'], // Only 'action_logs' permission
            'delivery-notes': ['delivery-notes'], // Only 'delivery-notes' permission
            'settlements': ['settlements'] // Only 'settlements' permission
        };

        const requiredPermissions = sectionPermissions[section];
        if (!requiredPermissions) {
            return true; // Allow access if no permission required
        }

        // Check if user has any of the required permissions
        const hasAccess = requiredPermissions.some(perm => this.hasPermission(perm));
        
        return hasAccess;
    },

    // Redirect if user doesn't have permission
    requirePermission(permission, redirectUrl = 'index.html') {
        if (!this.hasPermission(permission)) {
            if (window.showToast) {
                window.showToast('ليس لديك صلاحية للوصول إلى هذه الصفحة', 'error');
            } else {
                alert('⚠️ ليس لديك صلاحية للوصول إلى هذه الصفحة');
            }
            window.location.href = redirectUrl;
            return false;
        }
        return true;
    },

    // Check page access based on current page URL
    checkPageAccess() {
        // Get current page name - try multiple methods
        let currentPage = '';
        
        // Method 1: from pathname
        if (window.location.pathname) {
            const pathParts = window.location.pathname.split('/');
            currentPage = pathParts[pathParts.length - 1] || '';
        }
        
        // Method 2: from href if pathname is empty
        if (!currentPage && window.location.href) {
            const urlParts = window.location.href.split('/');
            currentPage = urlParts[urlParts.length - 1] || '';
        }
        
        // Method 3: from window.location (for file:// protocol)
        if (!currentPage) {
            currentPage = window.location.pathname || window.location.href.split('/').pop() || '';
        }
        
        // Clean up - remove query string and hash
        currentPage = currentPage.split('?')[0].split('#')[0];
        
        // If still empty, default to index.html
        if (!currentPage || currentPage === '' || currentPage === '/') {
            currentPage = 'index.html';
        }
        
        // Special case: BashMohndes always has access to delivery-notes and settlements
        const userId = this.getUserId();
        if (userId === 'BashMohndes') {
            if (currentPage === 'delivery-notes.html' || currentPage === 'settlements.html') {
                return true;
            }
        }
        
        // Map pages to their required permissions - ALL pages must be checked
        // Each page requires its EXACT permission - no inheritance or fallback
        const pagePermissions = {
            'products.html': ['products'], // Only 'products' permission
            'customers.html': ['customers'], // Only 'customers' permission
            'suppliers.html': ['suppliers'], // Only 'suppliers' permission
            'sales.html': ['sales'], // Only 'sales' permission
            'delivery-notes.html': ['delivery-notes'], // Only 'delivery-notes' permission
            'settlements.html': ['settlements'], // Only 'settlements' permission
            'receipts.html': ['receipts'], // Only 'receipts' permission
            'payments.html': ['payments'], // Only 'payments' permission
            'purchases.html': ['purchases'], // Only 'purchases' permission
            'inventory.html': ['inventory'], // Only 'inventory' permission
            'assets.html': ['assets'], // Only 'assets' permission
            'reports.html': ['reports'], // Only 'reports' permission
            'expenses.html': ['expenses'], // Only 'expenses' permission
            'backup.html': ['backup'], // Only 'backup' permission
            'action-logs.html': ['action_logs'], // Only 'action_logs' permission
            'users.html': ['users'], // Only 'users' permission
            'settings.html': ['settings'], // Only 'settings' permission
            'calculator.html': [] // Calculator is always accessible (empty array means no permission required)
        };

        // Index page is always accessible
        if (currentPage === 'index.html' || currentPage === '' || currentPage === '/') {
            return true;
        }
        
        // Check if this page requires permissions
        const requiredPermissions = pagePermissions[currentPage];
        
        if (requiredPermissions === undefined) {
            // If page is not in our list, it might be a special page (like login.html)
            // But for safety, we should still check if it's a known page
            
            // Allow login page and index
            if (currentPage === 'login.html' || currentPage.includes('login')) {
                return true;
            }
            
            // For unknown pages, deny access by default (more secure)
            console.warn(`❌ Unknown page "${currentPage}" - denying access for security`);
            // Show toast notification if available, otherwise use alert as fallback
            // Try to load toast.js if not available
            if (window.showToast) {
                window.showToast('ليس لديك صلاحية للوصول إلى هذه الصفحة', 'error');
            } else {
                // Try to load toast.js dynamically
                const script = document.createElement('script');
                script.src = 'scripts/toast.js';
                script.onload = function() {
                    if (window.showToast) {
                        window.showToast('ليس لديك صلاحية للوصول إلى هذه الصفحة', 'error');
                    } else {
                        alert('⚠️ ليس لديك صلاحية للوصول إلى هذه الصفحة');
                    }
                };
                script.onerror = function() {
                    alert('⚠️ ليس لديك صلاحية للوصول إلى هذه الصفحة');
                };
                document.head.appendChild(script);
            }
            // Redirect immediately to prevent page from loading
            setTimeout(() => {
                window.location.replace('index.html');
            }, 100);
            return false;
        }
        
        // If page has empty array, it means no permission required (always accessible)
        if (Array.isArray(requiredPermissions) && requiredPermissions.length === 0) {
            return true;
        }

        // Get user permissions once
        const userPermissions = this.getUserPermissions();

        // Check if user has any of the required permissions
        let hasAccess = false;
        
        // Special case: BashMohndes always has access to delivery-notes and settlements
        if (userId === 'BashMohndes' && (currentPage === 'delivery-notes.html' || currentPage === 'settlements.html')) {
            hasAccess = true;
        } else {
            hasAccess = requiredPermissions.some(perm => this.hasPermission(perm));
        }
        
        if (!hasAccess) {
            console.warn('❌ Access denied - redirecting to index');
            // Show toast notification if available, otherwise use alert as fallback
            // Wait a bit for toast.js to load if needed
            if (window.showToast) {
                window.showToast('ليس لديك صلاحية للوصول إلى هذه الصفحة', 'error');
                setTimeout(() => {
                    window.location.replace('index.html');
                }, 1500);
            } else {
                // Try to load toast.js first
                const script = document.createElement('script');
                script.src = 'scripts/toast.js';
                script.onload = function() {
                    if (window.showToast) {
                        window.showToast('ليس لديك صلاحية للوصول إلى هذه الصفحة', 'error');
                        setTimeout(() => {
                            window.location.replace('index.html');
                        }, 1500);
                    } else {
                        // Final fallback - try to show toast even if not loaded yet
                        setTimeout(() => {
                            if (window.showToast) {
                                window.showToast('ليس لديك صلاحية للوصول إلى هذه الصفحة', 'error');
                            } else {
                                alert('⚠️ ليس لديك صلاحية للوصول إلى هذه الصفحة');
                            }
                        }, 100);
                        setTimeout(() => {
                            window.location.replace('index.html');
                        }, 500);
                    }
                };
                document.head.appendChild(script);
            }
            return false;
        }

        return true;
    },

    // Protect sidebar links with click handlers
    protectSidebarLinks() {
        const sidebarLinks = document.querySelectorAll('.sidebar-menu a[href]');
        
        // Special case: BashMohndes always has access to delivery-notes and settlements
        const userId = this.getUserId();
        
        // Map pages to their required permissions (shared with checkPageAccess)
        // Each page requires its EXACT permission - no inheritance or fallback
        const pagePermissions = {
            'products.html': ['products'], // Only 'products' permission
            'customers.html': ['customers'], // Only 'customers' permission
            'suppliers.html': ['suppliers'], // Only 'suppliers' permission
            'sales.html': ['sales'], // Only 'sales' permission
            'delivery-notes.html': ['delivery-notes'], // Only 'delivery-notes' permission
            'settlements.html': ['settlements'], // Only 'settlements' permission
            'receipts.html': ['receipts'], // Only 'receipts' permission
            'payments.html': ['payments'], // Only 'payments' permission
            'purchases.html': ['purchases'], // Only 'purchases' permission
            'inventory.html': ['inventory'], // Only 'inventory' permission
            'assets.html': ['assets'], // Only 'assets' permission
            'reports.html': ['reports'], // Only 'reports' permission
            'expenses.html': ['expenses'], // Only 'expenses' permission
            'backup.html': ['backup'], // Only 'backup' permission
            'action-logs.html': ['action_logs'], // Only 'action_logs' permission
            'users.html': ['users'], // Only 'users' permission
            'settings.html': ['settings'] // Only 'settings' permission
        };
        
        sidebarLinks.forEach((link, index) => {
            const href = link.getAttribute('href');
            
            // Skip index and login pages
            if (!href || href === 'index.html' || href === 'login.html') {
                return;
            }

            // Clean up href to get page name
            let pageName = href.split('/').pop() || href;
            pageName = pageName.split('?')[0].split('#')[0];
            
            const requiredPermissions = pagePermissions[pageName];
            
            if (requiredPermissions) {
                // Always add click handler to protect - don't hide links
                // Remove any existing handler first by cloning
                const newLink = link.cloneNode(true);
                link.parentNode.replaceChild(newLink, link);
                
                newLink.addEventListener('click', (e) => {
                    // Special case: BashMohndes always has access to delivery-notes and settlements
                    if (userId === 'BashMohndes' && (pageName === 'delivery-notes.html' || pageName === 'settlements.html')) {
                        return; // Allow navigation
                    }
                    
                    // Check if user has access BEFORE navigation
                    const hasAccessNow = requiredPermissions.some(perm => this.hasPermission(perm));
                    
                    if (!hasAccessNow) {
                        console.warn(`❌ Blocking access to ${pageName}`);
                        // Prevent navigation completely
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        
                        // Show toast notification instead of alert
                        // Try to load toast.js if not available
                        if (window.showToast) {
                            window.showToast('ليس لديك صلاحية للوصول إلى هذه الصفحة', 'error');
                        } else {
                            // Try to load toast.js dynamically
                            const script = document.createElement('script');
                            script.src = 'scripts/toast.js';
                            script.onload = function() {
                                if (window.showToast) {
                                    window.showToast('ليس لديك صلاحية للوصول إلى هذه الصفحة', 'error');
                                } else {
                                    alert('⚠️ ليس لديك صلاحية للوصول إلى هذه الصفحة');
                                }
                            };
                            script.onerror = function() {
                                alert('⚠️ ليس لديك صلاحية للوصول إلى هذه الصفحة');
                            };
                            document.head.appendChild(script);
                        }
                        
                        return false;
                    }
                }, true); // Capture phase - intercepts before other handlers
            }
        });
    }
};

    // Auto-apply permissions on page load
    function initializePermissions() {
    // Check if user is logged in
    const isLoggedIn = localStorage.getItem('asel_loggedIn') === 'true';
    if (!isLoggedIn) {
        // Don't block access if not logged in (will be handled by login page)
        // But if we're not on login page, redirect to login
        const currentPage = window.location.pathname.split('/').pop() || '';
        if (currentPage !== 'login.html' && !currentPage.includes('login')) {
            window.location.replace('login.html');
        }
        return;
    }
    
    // Always check page access first - this will redirect if no permission
    const hasAccess = PermissionsManager.checkPageAccess();
    
    if (hasAccess) {
        // Apply permissions to UI only if access is granted
        PermissionsManager.applyPermissions();
    }
}

// Protect sidebar links IMMEDIATELY (before page loads) to prevent navigation
// This must run as early as possible, even before DOM is ready
(function protectLinksEarly() {
    // Get sidebar links as soon as they exist
    function setupProtection() {
        const sidebarLinks = document.querySelectorAll('.sidebar-menu a[href]');
        if (sidebarLinks.length === 0) {
            // If links don't exist yet, try again after a short delay
            setTimeout(setupProtection, 50);
            return;
        }
        
        // Map pages to their required permissions
        const pagePermissions = {
            'products.html': ['products'],
            'customers.html': ['customers'],
            'suppliers.html': ['suppliers'],
            'sales.html': ['sales'],
            'delivery-notes.html': ['delivery-notes'],
            'settlements.html': ['settlements'],
            'receipts.html': ['receipts'],
            'payments.html': ['payments'],
            'purchases.html': ['purchases'],
            'inventory.html': ['inventory'],
            'assets.html': ['assets'],
            'reports.html': ['reports'],
            'expenses.html': ['expenses'],
            'backup.html': ['backup'],
            'action-logs.html': ['action_logs'],
            'users.html': ['users'],
            'settings.html': ['settings']
        };
        
        const userId = PermissionsManager.getUserId();
        
        sidebarLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (!href || href === 'index.html' || href === 'login.html' || href === 'about.html') {
                return;
            }
            
            let pageName = href.split('/').pop() || href;
            pageName = pageName.split('?')[0].split('#')[0];
            
            const requiredPermissions = pagePermissions[pageName];
            if (requiredPermissions) {
                // Remove existing handler by cloning
                const newLink = link.cloneNode(true);
                link.parentNode.replaceChild(newLink, link);
                
                // Add click handler with capture phase to intercept early
                newLink.addEventListener('click', (e) => {
                    // Special case: BashMohndes always has access
                    if (userId === 'BashMohndes' && (pageName === 'delivery-notes.html' || pageName === 'settlements.html')) {
                        return; // Allow navigation
                    }
                    
                    // Check permissions BEFORE navigation
                    const hasAccess = requiredPermissions.some(perm => PermissionsManager.hasPermission(perm));
                    
                    if (!hasAccess) {
                        // Prevent navigation completely
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        
                        // Show toast notification
                        // Try to load toast.js if not available
                        if (window.showToast) {
                            window.showToast('ليس لديك صلاحية للوصول إلى هذه الصفحة', 'error');
                        } else {
                            // Try to load toast.js dynamically
                            const script = document.createElement('script');
                            script.src = 'scripts/toast.js';
                            script.onload = function() {
                                if (window.showToast) {
                                    window.showToast('ليس لديك صلاحية للوصول إلى هذه الصفحة', 'error');
                                } else {
                                    alert('⚠️ ليس لديك صلاحية للوصول إلى هذه الصفحة');
                                }
                            };
                            script.onerror = function() {
                                alert('⚠️ ليس لديك صلاحية للوصول إلى هذه الصفحة');
                            };
                            document.head.appendChild(script);
                        }
                        
                        return false;
                    }
                }, true); // Capture phase - intercepts before other handlers
            }
        });
    }
    
    // Try to setup protection immediately
    if (document.readyState === 'loading') {
        // If DOM is still loading, wait for it
        document.addEventListener('DOMContentLoaded', setupProtection);
    } else {
        // DOM is ready, setup immediately
        setupProtection();
    }
    
    // Also try after a short delay to catch dynamically added links
    setTimeout(setupProtection, 100);
})();

    // Run initializePermissions normally
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePermissions);
    } else {
        // DOM is already loaded, run immediately
        initializePermissions();
    }

    // Also check on page show (for back/forward navigation)
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            // Page was loaded from cache (back/forward button)
            PermissionsManager._permissionsCache = null; // Clear cache
            PermissionsManager.checkPageAccess();
            PermissionsManager.applyPermissions();
        }
    });

    // Re-apply permissions when page becomes visible (e.g., after navigation)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            PermissionsManager.applyPermissions();
        }
    });

    // Re-apply permissions when storage changes (if permissions are updated in another tab)
    window.addEventListener('storage', (e) => {
        if (e.key === 'asel_userPermissions') {
            // Clear cache when permissions change
            PermissionsManager._permissionsCache = null;
            PermissionsManager._permissionsCacheTime = null;
            PermissionsManager.applyPermissions();
        }
    });

    // Also listen for custom event when permissions are updated in same tab
    window.addEventListener('permissionsUpdated', () => {
        PermissionsManager._permissionsCache = null;
        PermissionsManager._permissionsCacheTime = null;
        PermissionsManager.applyPermissions();
    });

    // Also clear cache when localStorage is updated directly (for same-tab updates)
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
        originalSetItem.apply(this, arguments);
        if (key === 'asel_userPermissions') {
            PermissionsManager._permissionsCache = null;
            PermissionsManager._permissionsCacheTime = null;
        }
    };

    // Make PermissionsManager globally available
    window.PermissionsManager = PermissionsManager;
} // End of if (typeof PermissionsManager === 'undefined')

