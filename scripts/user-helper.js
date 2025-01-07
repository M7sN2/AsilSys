// Helper functions to get current logged in user
// This file provides utilities for getting current user information

/**
 * Get current logged in user ID
 * @returns {string} User ID or empty string if not logged in
 */
function getCurrentUserId() {
    try {
        return localStorage.getItem('asel_userId') || '';
    } catch (error) {
        console.error('Error getting current user ID:', error);
        return '';
    }
}

/**
 * Get current logged in username
 * @returns {string} Username or empty string if not logged in
 */
function getCurrentUsername() {
    try {
        return localStorage.getItem('asel_user') || '';
    } catch (error) {
        console.error('Error getting current username:', error);
        return '';
    }
}

/**
 * Get current logged in user info (both ID and username)
 * @returns {Object} {id: string, username: string}
 */
function getCurrentUser() {
    return {
        id: getCurrentUserId(),
        username: getCurrentUsername()
    };
}

/**
 * Add createdBy to data object if not already present
 * Uses username as createdBy (more readable than ID)
 * @param {Object} data - Data object to add createdBy to
 * @returns {Object} Data object with createdBy added
 */
function addCreatedBy(data) {
    if (!data) return;
    
    // If createdBy is already set, don't override
    if (data.createdBy) {
        return;
    }
    
    // Get current user
    const currentUser = getCurrentUser();
    
    // Use username if available, otherwise use ID, otherwise empty string
    data.createdBy = currentUser.username || currentUser.id || '';
}

