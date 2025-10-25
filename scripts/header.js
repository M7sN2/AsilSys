// Top Bar Component - Sticky Header for all pages
// Includes: Clock, Notifications, Calculator, User Greeting, Logout

// ===================================
// Clock Functionality
// ===================================

function updateTime() {
    const timeElement = document.getElementById('topBarTime');
    if (!timeElement) {
        return;
    }
    
    try {
        const now = new Date();
        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const ampm = hours >= 12 ? 'مساءً' : 'صباحاً';
        
        // Convert to 12-hour format
        hours = hours % 12;
        hours = hours ? hours : 12; // 0 should be 12
        hours = String(hours).padStart(2, '0');
        
        // Get date in Arabic format
        const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
        const dayName = dayNames[now.getDay()];
        const day = now.getDate();
        const month = monthNames[now.getMonth()];
        const year = now.getFullYear();
        
        timeElement.innerHTML = `<span style="margin-left: 8px;">${dayName} ${day} ${month} ${year}</span> 🕒 ${hours}:${minutes}:${seconds} ${ampm}`;
    } catch (error) {
        console.error('Error updating time:', error);
    }
}

// ===================================
// Notifications System
// ===================================

// Toggle notifications popup
function toggleNotificationsPopup() {
    const popup = document.getElementById('notificationsPopup');
    if (popup) {
        popup.classList.toggle('active');
        if (popup.classList.contains('active')) {
            loadNotifications();
        }
    }
}

// Close notifications popup
function closeNotificationsPopup() {
    const popup = document.getElementById('notificationsPopup');
    if (popup) {
        popup.classList.remove('active');
    }
}

// Load notifications (low stock products and high balance customers)
async function loadNotifications() {
    try {
        await loadLowStockNotifications();
        await loadHighBalanceNotifications();
        updateNotificationBadge();
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

// Load low stock products
async function loadLowStockNotifications() {
    const container = document.getElementById('lowStockNotifications');
    if (!container) return;
    
    try {
        container.innerHTML = '<div class="notification-item loading">جارٍ التحميل...</div>';
        
        let products = [];
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            try {
                const result = await window.electronAPI.dbGetAll('products', '', []);
                products = Array.isArray(result) ? result : (result ? [result] : []);
            } catch (err) {
                try {
                    const queryResult = await window.electronAPI.dbQuery('SELECT * FROM products', []);
                    products = Array.isArray(queryResult) ? queryResult : (queryResult ? [queryResult] : []);
                } catch (queryErr) {
                    products = [];
                }
            }
        }
        
        const lowStockProducts = products.filter(p => {
            if (!p || !p.id) return false;
            const stock = parseFloat(p.stock);
            if (isNaN(stock)) return false;
            return stock === 0 || stock < 150;
        }).sort((a, b) => {
            const stockA = parseFloat(a.stock) || 0;
            const stockB = parseFloat(b.stock) || 0;
            return stockA - stockB;
        });
        
        if (lowStockProducts.length === 0) {
            container.innerHTML = '<div class="notification-item empty">لا توجد منتجات بمخزون منخفض</div>';
            return;
        }
        
        container.innerHTML = lowStockProducts.map(product => {
            const stock = parseFloat(product.stock) || 0;
            const unit = product.unit || 'قطعة';
            let stockIcon = '✅';
            let stockStatus = '';
            if (stock === 0) {
                stockIcon = '🔴';
                stockStatus = 'نفد المخزون';
            } else if (stock < 150) {
                stockIcon = '⚠️';
                stockStatus = 'مخزون منخفض';
            }
            
            return `
                <div class="notification-item" onclick="window.location.href='products.html'">
                    <div class="notification-item-title">${stockIcon} ${product.name || 'غير معروف'}</div>
                    <div class="notification-item-details">${stockStatus}: ${stock.toLocaleString('ar-EG')} ${unit}</div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading low stock notifications:', error);
        container.innerHTML = '<div class="notification-item empty">حدث خطأ أثناء تحميل البيانات</div>';
    }
}

// Load high balance customers
async function loadHighBalanceNotifications() {
    const container = document.getElementById('highBalanceNotifications');
    if (!container) return;
    
    try {
        container.innerHTML = '<div class="notification-item loading">جارٍ التحميل...</div>';
        
        let customers = [];
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            try {
                const result = await window.electronAPI.dbGetAll('customers', '', []);
                customers = Array.isArray(result) ? result : (result ? [result] : []);
            } catch (err) {
                try {
                    const queryResult = await window.electronAPI.dbQuery('SELECT * FROM customers', []);
                    customers = Array.isArray(queryResult) ? queryResult : (queryResult ? [queryResult] : []);
                } catch (queryErr) {
                    customers = [];
                }
            }
        }
        
        const highBalanceCustomers = customers.filter(c => {
            if (!c || !c.id) return false;
            // Exclude cash customer
            const customerCode = (c.code || '').trim().toUpperCase();
            if (customerCode === 'CASH') return false;
            const balance = parseFloat(c.balance);
            if (isNaN(balance)) return false;
            return balance > 10000;
        }).sort((a, b) => {
            const balanceA = parseFloat(a.balance) || 0;
            const balanceB = parseFloat(b.balance) || 0;
            return balanceB - balanceA;
        });
        
        if (highBalanceCustomers.length === 0) {
            container.innerHTML = '<div class="notification-item empty">لا توجد عملاء برصيد يتخطى 10,000 ج.م</div>';
            return;
        }
        
        container.innerHTML = highBalanceCustomers.map(customer => {
            const balance = parseFloat(customer.balance) || 0;
            return `
                <div class="notification-item" onclick="window.location.href='customers.html'">
                    <div class="notification-item-title">${customer.name || 'غير معروف'}</div>
                    <div class="notification-item-details">الرصيد: ${balance.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م</div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading high balance notifications:', error);
        container.innerHTML = '<div class="notification-item empty">حدث خطأ أثناء تحميل البيانات</div>';
    }
}

// Update notification badge count
async function updateNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    if (!badge) return;
    
    try {
        let products = [];
        let customers = [];
        
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            try {
                const result = await window.electronAPI.dbGetAll('products', '', []);
                products = Array.isArray(result) ? result : (result ? [result] : []);
            } catch (err) {
                try {
                    const queryResult = await window.electronAPI.dbQuery('SELECT * FROM products', []);
                    products = Array.isArray(queryResult) ? queryResult : (queryResult ? [queryResult] : []);
                } catch (queryErr) {
                    products = [];
                }
            }
            
            try {
                const result = await window.electronAPI.dbGetAll('customers', '', []);
                customers = Array.isArray(result) ? result : (result ? [result] : []);
            } catch (err) {
                try {
                    const queryResult = await window.electronAPI.dbQuery('SELECT * FROM customers', []);
                    customers = Array.isArray(queryResult) ? queryResult : (queryResult ? [queryResult] : []);
                } catch (queryErr) {
                    customers = [];
                }
            }
        }
        
        const lowStockCount = products.filter(p => {
            if (!p || !p.id) return false;
            const stock = parseFloat(p.stock);
            if (isNaN(stock)) return false;
            return stock === 0 || stock < 150;
        }).length;
        
        const highBalanceCount = customers.filter(c => {
            if (!c || !c.id) return false;
            // Exclude cash customer
            const customerCode = (c.code || '').trim().toUpperCase();
            if (customerCode === 'CASH') return false;
            const balance = parseFloat(c.balance);
            if (isNaN(balance)) return false;
            return balance > 10000;
        }).length;
        
        const totalCount = lowStockCount + highBalanceCount;
        
        if (totalCount > 0) {
            badge.textContent = totalCount > 99 ? '99+' : totalCount.toString();
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    } catch (error) {
        console.error('Error updating notification badge:', error);
        if (badge) {
            badge.style.display = 'none';
        }
    }
}

// ===================================
// User Greeting
// ===================================

function updateUserGreeting() {
    const userGreetingElement = document.getElementById('topBarUserGreeting');
    const usernameElement = document.getElementById('topBarUsername');
    
    if (!userGreetingElement) {
        console.warn('topBarUserGreeting element not found');
        return;
    }
    
    try {
        const isLoggedIn = localStorage.getItem('asel_loggedIn') === 'true';
        let username = localStorage.getItem('asel_user') || localStorage.getItem('username');
        
        // إذا لم يكن هناك مستخدم مسجل دخول، إخفاء العنصر
        if (!isLoggedIn || !username || username === 'null' || username === 'undefined') {
            userGreetingElement.style.display = 'none';
            return;
        }
        
        // عرض اسم المستخدم
        if (usernameElement) {
            usernameElement.textContent = username;
        } else {
            // إذا لم يكن هناك عنصر username منفصل، نستخدم innerHTML
            userGreetingElement.innerHTML = `<img src="assets/user_10542498.ico" alt="User" class="user-icon" /><span class="greeting-text">مرحبًا، <strong>${username}</strong></span>`;
        }
        userGreetingElement.style.display = 'flex';
    } catch (error) {
        console.error('Error updating user greeting:', error);
        userGreetingElement.style.display = 'none';
    }
}

// ===================================
// Sidebar Toggle Functionality
// ===================================

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    
    const isHidden = sidebar.classList.contains('hidden');
    
    if (isHidden) {
        // Show sidebar - use the global function from sidebar.js if available
        if (typeof window.showSidebar === 'function') {
            window.showSidebar();
        } else {
            sidebar.classList.remove('hidden');
            localStorage.setItem('sidebarState', 'visible');
        }
    } else {
        // Hide sidebar - use the global function from sidebar.js if available
        if (typeof window.hideSidebar === 'function') {
            window.hideSidebar();
        } else {
            sidebar.classList.add('hidden');
            localStorage.setItem('sidebarState', 'hidden');
        }
    }
    
    // Update top bar padding
    updateTopBarPadding();
    
    // Update toggle button state for compatibility
    updateToggleButtonStateCompat();
}

// Cached references for performance
let cachedToggleBtn = null;
let cachedSidebar = null;
let cachedTopBar = null;

// Cache DOM elements
function getCachedElements() {
    if (!cachedToggleBtn) {
        cachedToggleBtn = document.getElementById('topBarSidebarToggle');
    }
    if (!cachedSidebar) {
        cachedSidebar = document.querySelector('.sidebar');
    }
    if (!cachedTopBar) {
        cachedTopBar = document.querySelector('.top-bar');
    }
    return { toggleBtn: cachedToggleBtn, sidebar: cachedSidebar, topBar: cachedTopBar };
}

// Update toggle button state for cross-browser compatibility
function updateToggleButtonStateCompat() {
    const { toggleBtn, sidebar } = getCachedElements();
    if (!toggleBtn || !sidebar) return;
    
    const isHidden = sidebar.classList.contains('hidden');
    // Use classList.toggle for better performance (avoids unnecessary DOM operations)
    toggleBtn.classList.toggle('sidebar-hidden', isHidden);
    toggleBtn.classList.toggle('sidebar-visible', !isHidden);
}

// Debounce helper for performance
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Performance detection for low-end devices
// Safe detection that works offline and on very old devices
let isLowEndDevice = false;
try {
    // Method 1: Check hardware concurrency (may not exist on very old browsers)
    if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency !== undefined) {
        if (navigator.hardwareConcurrency <= 2) {
            isLowEndDevice = true;
        }
    }
    
    // Method 2: Check for reduced motion preference (may not exist on old browsers)
    if (typeof window !== 'undefined' && window.matchMedia) {
        try {
            const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
            if (reducedMotion && reducedMotion.matches) {
                isLowEndDevice = true;
            }
        } catch (mediaError) {
            // matchMedia failed, continue with other checks
        }
    }
    
    // Method 3: Detect very old browsers (assume low-end for safety)
    // Check for basic modern features - if missing, assume low-end
    if (typeof requestAnimationFrame === 'undefined' || 
        typeof Promise === 'undefined' ||
        typeof document.querySelector === 'undefined') {
        isLowEndDevice = true;
    }
} catch (e) {
    // Any error means we should default to low-end mode for safety
    // This ensures the code works even on broken/old environments
    isLowEndDevice = true;
}

// Final fallback: If we can't detect, assume low-end for maximum compatibility
if (typeof isLowEndDevice === 'undefined') {
    isLowEndDevice = true;
}

function updateTopBarPadding() {
    const { topBar, sidebar } = getCachedElements();
    if (!topBar || !sidebar) return;
    
    // Direct update for low-end devices, RAF for capable devices
    const update = () => {
        if (sidebar.classList.contains('hidden')) {
            topBar.style.right = '0';
            topBar.style.width = '100%';
        } else if (sidebar.classList.contains('collapsed')) {
            topBar.style.right = 'var(--sidebar-collapsed-width)';
            topBar.style.width = 'calc(100% - var(--sidebar-collapsed-width))';
        } else {
            topBar.style.right = 'var(--sidebar-width)';
            topBar.style.width = 'calc(100% - var(--sidebar-width))';
        }
    };
    
    if (isLowEndDevice) {
        // Direct update on low-end devices (no RAF overhead)
        update();
    } else if (typeof requestAnimationFrame !== 'undefined') {
        // Use requestAnimationFrame for smoother updates on capable devices
        // Check if RAF exists (may not on very old browsers)
        requestAnimationFrame(update);
    } else {
        // Fallback: direct update if RAF doesn't exist
        update();
    }
}

// Debounced version for MutationObserver - longer delay on low-end devices
const debounceDelay = isLowEndDevice ? 50 : 10;
const debouncedUpdateTopBar = debounce(updateTopBarPadding, debounceDelay);
const debouncedUpdateToggleState = debounce(updateToggleButtonStateCompat, debounceDelay);

// ===================================
// Initialize Top Bar on Page Load
// ===================================

// Initialize Top Bar
function initTopBar() {
    // Check if elements exist
    const timeElement = document.getElementById('topBarTime');
    const userGreetingElement = document.getElementById('topBarUserGreeting');
    
    // Initialize clock immediately
    updateTime();
    
    // Update every second
    const clockInterval = setInterval(updateTime, 1000);
    
    // Initialize user greeting immediately
    updateUserGreeting();
    
    // Try again after delays
    setTimeout(updateUserGreeting, 100);
    setTimeout(updateUserGreeting, 300);
    setTimeout(updateUserGreeting, 500);
    
    // Update user greeting on storage changes
    window.addEventListener('storage', (e) => {
        if (e.key === 'asel_user' || e.key === 'asel_loggedIn' || e.key === 'username') {
            updateUserGreeting();
        }
    });
    
    // Listen for custom events
    window.addEventListener('permissionsUpdated', () => {
        updateUserGreeting();
    });
    window.addEventListener('userLoggedIn', () => {
        updateUserGreeting();
    });
    
    // Check periodically
    setInterval(() => {
        const userGreetingElement = document.getElementById('topBarUserGreeting');
        if (!userGreetingElement) return;
        
        const currentDisplay = userGreetingElement.style.display;
        const isLoggedIn = localStorage.getItem('asel_loggedIn') === 'true';
        const username = localStorage.getItem('asel_user') || localStorage.getItem('username');
        
        if ((isLoggedIn && username && username !== 'null' && currentDisplay === 'none') || 
            (!isLoggedIn && currentDisplay !== 'none')) {
            updateUserGreeting();
        }
    }, 3000);
    
    // Sidebar toggle button - use cached reference
    const { toggleBtn } = getCachedElements();
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Direct call on low-end devices, RAF on capable devices
            if (isLowEndDevice) {
                toggleSidebar();
            } else if (typeof requestAnimationFrame !== 'undefined') {
                requestAnimationFrame(() => {
                    toggleSidebar();
                });
            } else {
                // Fallback: direct call if RAF doesn't exist
                toggleSidebar();
            }
        });
    }
    
    // Listen for sidebar state changes
    const { sidebar } = getCachedElements();
    if (sidebar) {
        // Use MutationObserver if available, fallback to polling on old browsers
        if (typeof MutationObserver !== 'undefined') {
            // Use debounced updates for better performance
            const observer = new MutationObserver(() => {
                debouncedUpdateTopBar();
                debouncedUpdateToggleState();
            });
            observer.observe(sidebar, {
                attributes: true,
                attributeFilter: ['class']
            });
        } else {
            // Fallback for very old browsers: poll every 500ms
            // This works offline and doesn't require modern APIs
            setInterval(() => {
                updateTopBarPadding();
                updateToggleButtonStateCompat();
            }, 500);
        }
        
        // Initial update
        updateTopBarPadding();
        updateToggleButtonStateCompat();
    }
    
    // Notifications button
    const notificationsBtn = document.getElementById('topBarNotificationsBtn');
    if (notificationsBtn) {
        notificationsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleNotificationsPopup();
        });
    }
    
    // Close notifications button
    const closeNotificationsBtn = document.getElementById('closeNotificationsBtn');
    if (closeNotificationsBtn) {
        closeNotificationsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeNotificationsPopup();
        });
    }
    
    // Close popup when clicking outside
    document.addEventListener('click', (e) => {
        const popup = document.getElementById('notificationsPopup');
        const btn = document.getElementById('topBarNotificationsBtn');
        if (popup && btn && !popup.contains(e.target) && !btn.contains(e.target)) {
            closeNotificationsPopup();
        }
    });
    
    // Top Bar Logout Button
    const topBarLogoutBtn = document.getElementById('topBarLogoutBtn');
    if (topBarLogoutBtn) {
        topBarLogoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Try to use the global logout function if available
            if (typeof window.logout === 'function') {
                window.logout();
            } else {
                // Manual logout with confirmation
                const confirmed = confirm('هل أنت متأكد من تسجيل الخروج؟');
                if (confirmed) {
                    localStorage.removeItem('asel_loggedIn');
                    localStorage.removeItem('asel_user');
                    localStorage.removeItem('asel_userId');
                    localStorage.removeItem('asel_userType');
                    localStorage.removeItem('asel_userPermissions');
                    
                    // Keep username if "remember me" was checked
                    const rememberMe = localStorage.getItem('asel_rememberMe');
                    if (!rememberMe || rememberMe !== 'true') {
                        localStorage.removeItem('asel_username');
                        localStorage.removeItem('asel_rememberMe');
                    }
                    
                    window.location.href = 'login.html';
                }
        }
    });
    } else {
        console.warn('Top bar logout button not found');
    }
    
    // Update notification badge on load
    setTimeout(() => {
        updateNotificationBadge();
    }, 500);
    
    // Update notification badge every 30 seconds
    setInterval(updateNotificationBadge, 30000);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTopBar);
} else {
    // DOM is already loaded
    initTopBar();
}

// Also initialize on window load as a fallback
window.addEventListener('load', () => {
    const timeElement = document.getElementById('topBarTime');
    if (timeElement) {
        if (timeElement.textContent === '🕒 --:--:--' || timeElement.textContent.includes('--')) {
            updateTime();
            updateUserGreeting();
        }
    }
});
