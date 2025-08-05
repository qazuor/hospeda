/**
 * Sanitization utilities for API requests
 * Protects against XSS, HTML tags, JS protocol, etc.
 */

/**
 * Sanitizes a string: trims, normalizes spaces, removes HTML tags and JS protocol
 */
export const sanitizeString = (input: string): string => {
    if (!input || typeof input !== 'string') {
        return '';
    }

    const lowerInput = input.toLowerCase();

    if (/^(javascript|vbscript|data):/.test(lowerInput.trim())) {
        // If input is just a dangerous protocol, return empty string immediately
        return '';
    }

    let sanitized = input;

    // Remove <script> tags and their content
    sanitized = sanitized.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

    // Remove tags with dangerous protocols
    sanitized = sanitized.replace(/<[^>]+(?:javascript:|vbscript:|data:)[^>]*>/gi, '');

    // Remove all HTML tags
    sanitized = sanitized.replace(/<\/?[a-z][^>]*>/gi, '');

    // Remove dangerous protocols in remaining plain text
    sanitized = sanitized.replace(/\b(?:javascript|vbscript|data):/gi, '');

    // Remove any remaining angle brackets
    sanitized = sanitized.replace(/[<>]/g, '');

    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    return sanitized.slice(0, 1000);
};

/**
 * Sanitizes an email (lowercase, trim)
 */
export const sanitizeEmail = (email: string): string => {
    if (!email || typeof email !== 'string') {
        return '';
    }
    return email.toLowerCase().trim();
};

/**
 * Sanitizes a search query (lowercase, trim, replace special chars with spaces, limit length)
 */
export const sanitizeSearchQuery = (query: string): string => {
    if (!query || typeof query !== 'string') {
        return '';
    }

    return query
        .trim()
        .toLowerCase()
        .replace(/[^a-zA-Z0-9\s-]/g, ' ') // Replace special characters with spaces, keep alphanumeric, spaces, and hyphens
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim() // Trim again after replacement
        .slice(0, 100);
};

/**
 * Sanitizes all string values in an object (shallow)
 */
export const sanitizeObjectStrings = <T extends Record<string, unknown>>(obj: T): T => {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }

    const result: Record<string, unknown> = {};
    for (const key in obj) {
        const value = obj[key];
        if (typeof value === 'string') {
            // Use sanitizeEmail for email-like fields, sanitizeString for others
            if (key.toLowerCase().includes('email')) {
                result[key] = sanitizeEmail(value);
            } else {
                result[key] = sanitizeString(value);
            }
        } else {
            result[key] = value;
        }
    }
    return result as T;
};

/**
 * Sanitizes all string values in query params (URLSearchParams)
 */
export const sanitizeQueryParams = (params: URLSearchParams): URLSearchParams => {
    if (!params) {
        return new URLSearchParams();
    }

    const sanitized = new URLSearchParams();
    const processedKeys = new Set<string>();

    for (const [key, value] of params.entries()) {
        if (processedKeys.has(key)) {
            continue; // Skip if we've already processed this key
        }

        const values = params.getAll(key);
        if (values.length > 1) {
            // Handle multiple values for the same key
            for (const val of values) {
                // Use appropriate sanitization based on key type
                if (key.toLowerCase().includes('email')) {
                    sanitized.append(key, sanitizeEmail(val));
                } else if (key.toLowerCase().includes('search')) {
                    sanitized.append(key, sanitizeSearchQuery(val));
                } else {
                    sanitized.append(key, sanitizeString(val));
                }
            }
        } else {
            // Use appropriate sanitization based on key type
            if (key.toLowerCase().includes('email')) {
                sanitized.set(key, sanitizeEmail(value));
            } else if (key.toLowerCase().includes('search')) {
                sanitized.set(key, sanitizeSearchQuery(value));
            } else {
                sanitized.set(key, sanitizeString(value));
            }
        }
        processedKeys.add(key);
    }
    return sanitized;
};

/**
 * Sanitizes headers (shallow, only string values)
 */
export const sanitizeHeaders = (headers: Record<string, unknown>): Record<string, unknown> => {
    if (!headers || typeof headers !== 'object') {
        return headers;
    }

    const result: Record<string, unknown> = {};
    for (const key in headers) {
        const value = headers[key];
        if (typeof value === 'string') {
            // Check if this is a custom header (starts with x-)
            if (key.startsWith('x-')) {
                // For custom headers, preserve original key and use sanitizeSearchQuery for special chars
                result[key] = sanitizeSearchQuery(value);
            } else {
                // For standard headers, use sanitizeString
                result[key] = sanitizeString(value);
            }
        } else {
            // For non-string values, preserve the original key format
            result[key] = value;
        }
    }
    return result;
};
