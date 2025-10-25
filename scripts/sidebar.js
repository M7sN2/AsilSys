// Sidebar Toggle Functionality
(function() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSidebar);
    } else {
        initSidebar();
    }
    
    function initSidebar() {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;
        
        // Add ID if it doesn't exist
        if (!sidebar.id) {
            sidebar.id = 'sidebar';
        }
        
        // Get the scrollable menu element (not the sidebar itself)
        const sidebarMenu = sidebar.querySelector('.sidebar-menu');
        
        // Save sidebar scroll position when scrolling
        if (sidebarMenu) {
            sidebarMenu.addEventListener('scroll', () => {
                localStorage.setItem('sidebarScroll', sidebarMenu.scrollTop.toString());
            });
        }
        
        // Restore or reset sidebar scroll position on page load
        function restoreOrResetScroll() {
            if (!sidebarMenu) return;
            
            // Check if this is a fresh login (just logged in)
            const isFreshLogin = sessionStorage.getItem('freshLogin') === 'true';
            
            if (isFreshLogin) {
                // Fresh login - always start at top (show الشاشة الرئيسية first)
                sidebarMenu.scrollTop = 0;
                localStorage.removeItem('sidebarScroll');
                sessionStorage.removeItem('freshLogin');
            } else {
                // Normal navigation - scroll to active element with 5px offset from top
                const activeLink = sidebarMenu.querySelector('a.active');
                if (activeLink) {
                    // Calculate position of active element and scroll to it with 5px offset
                    const activeLi = activeLink.closest('li');
                    if (activeLi) {
                        const activePosition = activeLi.offsetTop;
                        sidebarMenu.scrollTop = Math.max(0, activePosition - 5);
                    } else {
                        sidebarMenu.scrollTop = 5;
                    }
                } else {
                    // No active element - start at 5px from top
                    sidebarMenu.scrollTop = 5;
                }
            }
        }
        
        // Restore scroll position on page load
        window.addEventListener('load', () => {
            restoreOrResetScroll();
        });
        
        // Also restore after DOM is ready (in case load event already fired)
        if (document.readyState === 'complete') {
            restoreOrResetScroll();
            // Also restore after a short delay to ensure DOM is fully rendered
            setTimeout(restoreOrResetScroll, 50);
            setTimeout(restoreOrResetScroll, 150);
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                restoreOrResetScroll();
                setTimeout(restoreOrResetScroll, 50);
                setTimeout(restoreOrResetScroll, 150);
            });
        }
        
        // No need to create toggle button - we use the one in top bar
        let toggleButton = null;
        
        // CRITICAL: Clear saved state and force sidebar visible
        localStorage.removeItem('sidebarState');
        
        // Force sidebar visible immediately - remove hidden class and inline styles
        sidebar.classList.remove('hidden');
        sidebar.style.cssText = sidebar.style.cssText.replace(/transform[^;]*;?/g, '').replace(/width[^;]*;?/g, '').replace(/min-width[^;]*;?/g, '');
        
        let isHidden = false;
        
        // Update button position based on sidebar state
        function updateButtonPosition() {
            // Button is now inside sidebar header, CSS handles positioning
            // No need to update position manually
        }
        
        // The toggle button is now in the top bar, handled by header.js
        // This script only manages sidebar state
        
        // Function to hide sidebar (called from top bar button via header.js)
        window.hideSidebar = function() {
            if (!isHidden) {
                isHidden = true;
                sidebar.classList.add('hidden');
                // Save state
                localStorage.setItem('sidebarState', JSON.stringify({
                    isHidden: isHidden
                }));
            }
        };
        
        // Function to show sidebar (called from top bar button via header.js)
        window.showSidebar = function() {
            if (isHidden) {
                isHidden = false;
                sidebar.classList.remove('hidden');
                // Force remove any inline styles that might interfere
                sidebar.style.transform = '';
                sidebar.style.width = '';
                sidebar.style.minWidth = '';
                // Save state
                localStorage.setItem('sidebarState', JSON.stringify({
                    isHidden: isHidden
                }));
            }
        };
        
        // Toggle button is now in top bar, no need for event listeners here
        
        // Close sidebar when clicking on menu items (smooth close)
        if (sidebarMenu) {
            sidebarMenu.addEventListener('click', (e) => {
                // Check if click is on a menu link
                const menuLink = e.target.closest('a');
                if (menuLink && !isHidden && sidebar && !sidebar.classList.contains('hidden')) {
                    // Close sidebar smoothly after a short delay to allow navigation
                    setTimeout(() => {
                        window.hideSidebar();
                        // Update top bar padding if function exists
                        if (typeof updateTopBarPadding === 'function') {
                            updateTopBarPadding();
                        }
                    }, 150); // Small delay to allow navigation to start
                }
            });
        }
        
        // Close sidebar when clicking outside of it
        document.addEventListener('click', (e) => {
            // Check if sidebar is visible
            if (!isHidden && sidebar && !sidebar.classList.contains('hidden')) {
                // Check if click is outside sidebar
                const clickedInsideSidebar = sidebar.contains(e.target);
                const clickedOnToggleButton = e.target.closest('#topBarSidebarToggle');
                
                // If clicked outside sidebar and not on toggle button, hide sidebar
                if (!clickedInsideSidebar && !clickedOnToggleButton) {
                    window.hideSidebar();
                    // Update top bar padding if function exists
                    if (typeof updateTopBarPadding === 'function') {
                        updateTopBarPadding();
                    }
                }
            }
        });
        
        // Force visible multiple times on page load
        [0, 50, 100, 200].forEach(delay => {
            setTimeout(() => {
                sidebar.classList.remove('hidden');
                sidebar.style.transform = '';
                sidebar.style.width = '';
                sidebar.style.minWidth = '';
            }, delay);
        });
        
        // Check saved state and restore button position if needed
        const savedState = localStorage.getItem('sidebarState');
        if (savedState) {
            try {
                const state = JSON.parse(savedState);
                if (state.isHidden && toggleButton && sidebarHeader) {
                    // Sidebar is hidden, move button to body
                    if (toggleButton.parentElement === sidebarHeader) {
                        document.body.appendChild(toggleButton);
                    }
                } else if (!state.isHidden && toggleButton && sidebarHeader) {
                    // Sidebar is visible, ensure button is in header
                    if (toggleButton.parentElement === document.body) {
                        sidebarHeader.appendChild(toggleButton);
                    }
                }
            } catch (e) {
                console.error('Error parsing sidebar state:', e);
            }
        }
    }
})();

// User Greeting - Display logged in user name
(function() {
    function updateUserGreeting() {
        // Check if user is logged in
        const isLoggedIn = localStorage.getItem('asel_loggedIn') === 'true';
        const userGreetingBadge = document.getElementById('userGreetingBadge');
        const userGreetingName = document.getElementById('userGreetingName');
        
        if (!userGreetingBadge) return;
        
        if (!isLoggedIn) {
            userGreetingBadge.style.display = 'none';
            return;
        }
        
        // Get username from localStorage
        const username = localStorage.getItem('asel_user') || 'مستخدم';
        
        // Show badge and update name
        userGreetingBadge.style.display = 'flex';
        if (userGreetingName) {
            userGreetingName.textContent = username;
        }
    }
    
    // Update on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateUserGreeting);
    } else {
        updateUserGreeting();
    }
    
    // Update on storage changes
    window.addEventListener('storage', (e) => {
        if (e.key === 'asel_user' || e.key === 'asel_loggedIn') {
            updateUserGreeting();
        }
    });
    
    // Update when permissions are updated
    window.addEventListener('permissionsUpdated', updateUserGreeting);
})();

// Update Inactive Customers Badge
(async function() {
    async function updateInactiveCustomersBadge() {
        const badge = document.getElementById('inactiveCustomersBadge');
        if (!badge) return;
        
        try {
            // Get customers from database
            let customers = [];
            if (window.electronAPI && window.electronAPI.dbGetAll) {
                customers = await window.electronAPI.dbGetAll('customers', '', []);
            } else {
                // Fallback to localStorage
                customers = JSON.parse(localStorage.getItem('asel_customers') || '[]');
            }
            
            // Filter valid customers (not deleted)
            const validCustomers = (customers || []).filter(c => {
                if (!c || !c.id) return false;
                if (c.deleted === true || c.deleted === 1) return false;
                return true;
            });
            
            // Count inactive customers
            const inactiveCustomers = validCustomers.filter(c => {
                if (!c) return false;
                const status = c.status;
                return status === 'inactive';
            }).length;
            
            // Update badge
            if (inactiveCustomers > 0) {
                badge.textContent = inactiveCustomers > 99 ? '99+' : inactiveCustomers.toString();
                badge.style.display = 'inline-flex';
            } else {
                badge.style.display = 'none';
            }
        } catch (error) {
            console.error('Error updating inactive customers badge:', error);
            badge.style.display = 'none';
        }
    }
    
    // Update on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateInactiveCustomersBadge);
    } else {
        updateInactiveCustomersBadge();
    }
    
    // Update badge every 30 seconds
    setInterval(updateInactiveCustomersBadge, 30000);
    
    // Export function to global scope so it can be called from other scripts
    window.updateInactiveCustomersBadge = updateInactiveCustomersBadge;
})();

