/**
 * Validation utility functions
 * @module utils/validation
 */

/**
 * Check if a value is defined (not undefined or null)
 * @param value - Value to check
 * @returns Whether the value is defined
 */
export function isDefined<T>(value: T | undefined | null): value is T {
    return value !== undefined && value !== null;
}

/**
 * Check if a string is a valid email
 * @param email - Email to validate
 * @returns Whether the email is valid
 */
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Check if a string is a valid URL
 * @param url - URL to validate
 * @returns Whether the URL is valid
 */
export function isValidUrl(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch (_error) {
        return false;
    }
}

/**
 * Check if a string is a valid phone number
 * @param phone - Phone number to validate
 * @returns Whether the phone number is valid
 */
export function isValidPhone(phone: string): boolean {
    // This is a simple validation, consider using a library for more complex validation
    const phoneRegex = /^\+?[0-9]{10,15}$/;
    return phoneRegex.test(phone);
}

/**
 * Check if a string is a valid password
 * @param password - Password to validate
 * @param options - Validation options
 * @returns Whether the password is valid
 */
export function isValidPassword(
    password: string,
    options: {
        minLength?: number;
        requireUppercase?: boolean;
        requireLowercase?: boolean;
        requireNumbers?: boolean;
        requireSpecialChars?: boolean;
    } = {}
): boolean {
    const {
        minLength = 8,
        requireUppercase = true,
        requireLowercase = true,
        requireNumbers = true,
        requireSpecialChars = true
    } = options;

    if (password.length < minLength) return false;
    if (requireUppercase && !/[A-Z]/.test(password)) return false;
    if (requireLowercase && !/[a-z]/.test(password)) return false;
    if (requireNumbers && !/[0-9]/.test(password)) return false;
    if (requireSpecialChars && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) return false;

    return true;
}

/**
 * Check if a value is a number
 * @param value - Value to check
 * @returns Whether the value is a number
 */
export function isNumber(value: unknown): boolean {
    return typeof value === 'number' && !Number.isNaN(value);
}

/**
 * Check if a value is a string
 * @param value - Value to check
 * @returns Whether the value is a string
 */
export function isString(value: unknown): boolean {
    return typeof value === 'string';
}

/**
 * Check if a value is a boolean
 * @param value - Value to check
 * @returns Whether the value is a boolean
 */
export function isBoolean(value: unknown): boolean {
    return typeof value === 'boolean';
}

/**
 * Check if a value is a function
 * @param value - Value to check
 * @returns Whether the value is a function
 */
export function isFunction(value: unknown): boolean {
    return typeof value === 'function';
}
