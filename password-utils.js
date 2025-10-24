const bcrypt = require('bcryptjs');

// Salt rounds for password hashing (10 is recommended)
const SALT_ROUNDS = 10;

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
async function hashPassword(password) {
    try {
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        return hashedPassword;
    } catch (error) {
        console.error('Error hashing password:', error);
        throw new Error('فشل في تشفير كلمة المرور');
    }
}

/**
 * Hash a password synchronously (for use in synchronous contexts)
 * @param {string} password - Plain text password
 * @returns {string} - Hashed password
 */
function hashPasswordSync(password) {
    try {
        const hashedPassword = bcrypt.hashSync(password, SALT_ROUNDS);
        return hashedPassword;
    } catch (error) {
        console.error('Error hashing password synchronously:', error);
        throw new Error('فشل في تشفير كلمة المرور');
    }
}

/**
 * Compare a plain text password with a hashed password
 * @param {string} password - Plain text password
 * @param {string} hashedPassword - Hashed password from database
 * @returns {Promise<boolean>} - True if password matches
 */
async function comparePassword(password, hashedPassword) {
    try {
        // Validate inputs
        if (!password || !hashedPassword) {
            return false;
        }
        
        // Check if hashedPassword is a bcrypt hash (60 chars and starts with $2)
        // bcrypt hashes are always 60 characters long and start with $2a$, $2b$, or $2y$
        const isBcryptHash = hashedPassword.length === 60 && hashedPassword.startsWith('$2');
        
        if (!isBcryptHash) {
            // If it's not a bcrypt hash, it might be an old plain text password
            // Only allow direct comparison for the CORRECT default password
            console.warn('Password in database is not hashed. Please update user password to use hashed password.');
            
            // SECURITY: Only allow direct comparison for the correct default system engineer password
            // This is: 'BashMohndesadmin' (NOT 'BashMohndes' alone)
            // This prevents security issues where partial passwords might work
            const correctDefaultPassword = 'BashMohndesadmin';
            if (hashedPassword === correctDefaultPassword && password === correctDefaultPassword) {
                console.warn('Using plain text password for default user. Password will be hashed on next login.');
                return true;
            }
            
            // Reject any other plain text passwords, including 'BashMohndes' without 'admin'
            console.error('Rejected login: Password in database is not properly hashed and does not match default password.');
            return false;
        }
        
        // Use bcrypt comparison for hashed passwords
        const isMatch = await bcrypt.compare(password, hashedPassword);
        return isMatch;
    } catch (error) {
        console.error('Error comparing password:', error);
        // Don't allow login on error - security first
        return false;
    }
}

/**
 * Compare a plain text password with a hashed password synchronously
 * @param {string} password - Plain text password
 * @param {string} hashedPassword - Hashed password from database
 * @returns {boolean} - True if password matches
 */
function comparePasswordSync(password, hashedPassword) {
    try {
        // Validate inputs
        if (!password || !hashedPassword) {
            return false;
        }
        
        // Check if hashedPassword is a bcrypt hash (60 chars and starts with $2)
        const isBcryptHash = hashedPassword.length === 60 && hashedPassword.startsWith('$2');
        
        if (!isBcryptHash) {
            // If it's not a bcrypt hash, only allow direct comparison for the CORRECT default password
            console.warn('Password in database is not hashed. Please update user password to use hashed password.');
            
            // SECURITY: Only allow direct comparison for the correct default system engineer password
            // This is: 'BashMohndesadmin' (NOT 'BashMohndes' alone)
            const correctDefaultPassword = 'BashMohndesadmin';
            if (hashedPassword === correctDefaultPassword && password === correctDefaultPassword) {
                console.warn('Using plain text password for default user. Password will be hashed on next login.');
                return true;
            }
            
            // Reject any other plain text passwords, including 'BashMohndes' without 'admin'
            console.error('Rejected login: Password in database is not properly hashed and does not match default password.');
            return false;
        }
        
        // Use bcrypt comparison for hashed passwords
        const isMatch = bcrypt.compareSync(password, hashedPassword);
        return isMatch;
    } catch (error) {
        console.error('Error comparing password synchronously:', error);
        // Don't allow login on error - security first
        return false;
    }
}

/**
 * Check if a string is a bcrypt hash (for migration purposes)
 * @param {string} password - Password string to check
 * @returns {boolean} - True if it looks like a bcrypt hash
 */
function isHashed(password) {
    // bcrypt hashes start with $2a$, $2b$, or $2y$ and are 60 characters long
    return password && password.length === 60 && password.startsWith('$2');
}

module.exports = {
    hashPassword,
    hashPasswordSync,
    comparePassword,
    comparePasswordSync,
    isHashed,
    SALT_ROUNDS
};

