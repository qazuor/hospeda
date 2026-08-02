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
    // Guard against ReDoS: RFC 5321 caps addresses at 254 chars, so longer
    // inputs are invalid anyway and must not reach the backtracking regex.
    if (email.length > 254) {
        return false;
    }
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
 * The all-zero UUID (RFC 9562 "Nil UUID"). Syntactically a valid UUID, so
 * `z.string().uuid()` accepts it, but it can never identify a real row.
 */
export const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * Check whether a value is a usable entity id: a non-blank string that is not
 * the {@link NIL_UUID}.
 *
 * Exists because "passes UUID validation" and "can identify a row" are not the
 * same thing. An LLM asked for an id it does not have will happily answer with
 * the nil UUID as a placeholder, and a schema built on `z.string().uuid()` will
 * wave it through — the filter then matches nothing and the user gets zero
 * results for a constraint they never expressed (HOS-298).
 *
 * Takes `unknown` rather than `string | undefined` so it can also guard values
 * coming out of loosely-typed bags (a `Record<string, unknown>` of applied query
 * params, a parsed JSON body); as a type guard it narrows to `string` either way.
 *
 * @param value - Candidate id.
 * @returns Whether the id can be used as a real filter value.
 */
export function isUsableEntityId(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0 && value !== NIL_UUID;
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
