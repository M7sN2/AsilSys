// Logout Functionality

/**
 * Custom Confirmation Dialog for Logout (replaces confirm() to avoid Electron focus issues)
 * This is a local function to avoid conflicts with other showConfirmDialog functions
 */
function showLogoutConfirmDialog(message, onConfirm, onCancel) {
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
        <h2 style="margin: 0; font-size: 1.25rem;">تأكيد تسجيل الخروج</h2>
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
    confirmBtn.textContent = 'تسجيل الخروج';
    
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

/**
 * Logout user and redirect to login page
 */
function logout() {
    showLogoutConfirmDialog(
        'هل أنت متأكد من تسجيل الخروج؟',
        () => {
            // User confirmed - proceed with logout
            proceedWithLogout();
        },
        () => {
            // User cancelled - do nothing
        }
    );
}

/**
 * Proceed with logout after confirmation
 */
function proceedWithLogout() {
    // Clear all session data from localStorage
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
    
    // Redirect to login page
    window.location.href = 'login.html';
}

// Make logout function globally available
window.logout = logout;

// Initialize logout buttons on page load
document.addEventListener('DOMContentLoaded', () => {
    // Add event listeners to all logout buttons
    const logoutButtons = document.querySelectorAll('.logout-btn, .logout-quick-btn');
    logoutButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            logout();
        });
    });
});

