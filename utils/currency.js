/**
 * Currency Utility Functions
 * Helper functions for converting between EGP and cents (after REAL to INTEGER migration)
 */

/**
 * Convert EGP (Egyptian Pounds) to cents
 * @param {number} egp - Amount in EGP
 * @returns {number} Amount in cents
 */
function egpToCents(egp) {
    if (egp === null || egp === undefined || isNaN(egp)) {
        return 0;
    }
    return Math.round(egp * 100);
}

/**
 * Convert cents to EGP (Egyptian Pounds)
 * @param {number} cents - Amount in cents
 * @returns {number} Amount in EGP
 */
function centsToEgp(cents) {
    if (cents === null || cents === undefined || isNaN(cents)) {
        return 0;
    }
    return cents / 100;
}

/**
 * Format currency for display
 * @param {number} amount - Amount in EGP (not cents!)
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) {
        return '0.00 ج.م';
    }
    return new Intl.NumberFormat('ar-EG', {
        style: 'currency',
        currency: 'EGP',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount).replace('EGP', 'ج.م');
}

/**
 * Format currency from cents
 * @param {number} cents - Amount in cents
 * @returns {string} Formatted currency string
 */
function formatCurrencyFromCents(cents) {
    return formatCurrency(centsToEgp(cents));
}

/**
 * Format Arabic currency (legacy function for compatibility)
 * @param {number} amount - Amount in EGP
 * @returns {string} Formatted currency string
 */
function formatArabicCurrency(amount) {
    return formatCurrency(amount);
}

module.exports = {
    egpToCents,
    centsToEgp,
    formatCurrency,
    formatCurrencyFromCents,
    formatArabicCurrency
};

