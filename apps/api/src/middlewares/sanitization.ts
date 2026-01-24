/**
 * Sanitization utilities for API requests
 * Uses sanitize-html library for robust protection against XSS, HTML injection, etc.
 *
 * @module api/middlewares/sanitization
 */

import sanitizeHtml from 'sanitize-html';

/**
 * Sanitization level presets
 */
export enum SanitizationLevel {
    /** Remove all HTML - for plain text fields */
    STRICT = 'strict',
    /** Allow basic formatting (bold, italic, lists) - for rich text */
    MODERATE = 'moderate',
    /** Allow more tags including links and images - for content fields */
    PERMISSIVE = 'permissive'
}

/**
 * Dangerous protocols that should be removed from text
 */
const DANGEROUS_PROTOCOLS = /^(javascript|vbscript|data):/i;

/**
 * Common HTML entities to decode
 */
const HTML_ENTITIES: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#47;': '/'
};

/**
 * Decode HTML entities in a string
 */
const decodeHtmlEntities = (str: string): string => {
    return str.replace(/&(?:amp|lt|gt|quot|apos|#39|#x27|#x2F|#47);/gi, (match) => {
        return HTML_ENTITIES[match.toLowerCase()] || match;
    });
};

/**
 * Configuration options for strict sanitization (no HTML allowed)
 * Note: decodeHtmlEntities is applied manually after sanitization
 */
const STRICT_OPTIONS: sanitizeHtml.IOptions = {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
    nonBooleanAttributes: [],
    selfClosing: [],
    parseStyleAttributes: false
};

/**
 * Configuration options for moderate sanitization (basic formatting)
 */
const MODERATE_OPTIONS: sanitizeHtml.IOptions = {
    allowedTags: ['b', 'i', 'em', 'strong', 'u', 'br', 'p', 'ul', 'ol', 'li'],
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
    parseStyleAttributes: false
};

/**
 * Configuration options for permissive sanitization (content fields)
 */
const PERMISSIVE_OPTIONS: sanitizeHtml.IOptions = {
    allowedTags: [
        'b',
        'i',
        'em',
        'strong',
        'u',
        'br',
        'p',
        'ul',
        'ol',
        'li',
        'a',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'blockquote',
        'code',
        'pre'
    ],
    allowedAttributes: {
        a: ['href', 'title', 'target', 'rel']
    },
    // Only allow safe protocols in URLs
    allowedSchemes: ['http', 'https', 'mailto'],
    // Force rel="noopener noreferrer" on links
    transformTags: {
        a: (tagName, attribs) => {
            return {
                tagName,
                attribs: {
                    ...attribs,
                    target: '_blank',
                    rel: 'noopener noreferrer'
                }
            };
        }
    },
    disallowedTagsMode: 'discard',
    parseStyleAttributes: false
};

/**
 * Get sanitization options based on level
 */
const getOptions = (level: SanitizationLevel): sanitizeHtml.IOptions => {
    switch (level) {
        case SanitizationLevel.MODERATE:
            return MODERATE_OPTIONS;
        case SanitizationLevel.PERMISSIVE:
            return PERMISSIVE_OPTIONS;
        default:
            return STRICT_OPTIONS;
    }
};

/**
 * Sanitizes a string using sanitize-html library
 *
 * @param input - The string to sanitize
 * @param level - The sanitization level (default: STRICT)
 * @param maxLength - Maximum length of output (default: 1000)
 * @returns Sanitized string
 */
export const sanitizeString = (
    input: string,
    level: SanitizationLevel = SanitizationLevel.STRICT,
    maxLength = 1000
): string => {
    if (!input || typeof input !== 'string') {
        return '';
    }

    // Check for dangerous protocols in plain text (before any HTML processing)
    const trimmedInput = input.trim();
    if (DANGEROUS_PROTOCOLS.test(trimmedInput)) {
        return '';
    }

    // First pass: sanitize HTML (removes tags but may encode entities)
    let sanitized = sanitizeHtml(input, getOptions(level));

    // Decode any HTML entities that were created
    sanitized = decodeHtmlEntities(sanitized);

    // Second pass: remove any remaining dangerous protocols (could be obfuscated)
    sanitized = sanitized.replace(/\b(javascript|vbscript|data):/gi, '');

    // Remove stray angle brackets that might remain after decoding
    sanitized = sanitized.replace(/[<>]/g, '');

    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    // Truncate if needed
    return sanitized.slice(0, maxLength);
};

/**
 * Sanitizes HTML content for rich text fields
 * Allows basic formatting but removes dangerous elements
 *
 * @param input - The HTML content to sanitize
 * @param maxLength - Maximum length of output (default: 10000)
 * @returns Sanitized HTML
 */
export const sanitizeHtmlContent = (input: string, maxLength = 10000): string => {
    if (!input || typeof input !== 'string') {
        return '';
    }

    return sanitizeHtml(input, PERMISSIVE_OPTIONS).slice(0, maxLength);
};

/**
 * Sanitizes an email (lowercase, trim, validate format)
 *
 * @param email - The email to sanitize
 * @returns Sanitized email or empty string if invalid
 */
export const sanitizeEmail = (email: string): string => {
    if (!email || typeof email !== 'string') {
        return '';
    }

    // Basic sanitization
    const sanitized = email.toLowerCase().trim();

    // Remove any HTML/script attempts
    const cleaned = sanitizeHtml(sanitized, STRICT_OPTIONS);

    // Basic email format validation (not comprehensive, Zod handles full validation)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(cleaned) ? cleaned : '';
};

/**
 * Sanitizes a URL
 *
 * @param url - The URL to sanitize
 * @returns Sanitized URL or empty string if dangerous
 */
export const sanitizeUrl = (url: string): string => {
    if (!url || typeof url !== 'string') {
        return '';
    }

    const trimmed = url.trim();

    // Check for dangerous protocols
    const lowerUrl = trimmed.toLowerCase();
    if (
        lowerUrl.startsWith('javascript:') ||
        lowerUrl.startsWith('vbscript:') ||
        lowerUrl.startsWith('data:')
    ) {
        return '';
    }

    // Allow only http, https, mailto protocols or relative URLs
    if (
        !lowerUrl.startsWith('http://') &&
        !lowerUrl.startsWith('https://') &&
        !lowerUrl.startsWith('mailto:') &&
        !lowerUrl.startsWith('/')
    ) {
        // Might be a relative URL without leading slash or invalid
        // For safety, prefix with /
        if (!lowerUrl.includes(':')) {
            return `/${trimmed}`;
        }
        return '';
    }

    return trimmed;
};

/**
 * Sanitizes a search query (lowercase, trim, remove special chars, limit length)
 *
 * @param query - The search query to sanitize
 * @returns Sanitized query
 */
export const sanitizeSearchQuery = (query: string): string => {
    if (!query || typeof query !== 'string') {
        return '';
    }

    // Remove HTML first
    let noHtml = sanitizeHtml(query, STRICT_OPTIONS);

    // Decode entities before character filtering
    noHtml = decodeHtmlEntities(noHtml);

    return noHtml
        .trim()
        .toLowerCase()
        .replace(/[^a-zA-Z0-9\sáéíóúñüÁÉÍÓÚÑÜ-]/g, ' ') // Allow Spanish characters
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100);
};

/**
 * Sanitizes a slug (lowercase, trim, only alphanumeric and hyphens)
 *
 * @param slug - The slug to sanitize
 * @returns Sanitized slug
 */
export const sanitizeSlug = (slug: string): string => {
    if (!slug || typeof slug !== 'string') {
        return '';
    }

    return slug
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 200);
};

/**
 * Sanitizes all string values in an object (shallow)
 *
 * @param obj - The object to sanitize
 * @param level - The sanitization level for string fields
 * @returns Sanitized object
 */
export const sanitizeObjectStrings = <T extends Record<string, unknown>>(
    obj: T,
    level: SanitizationLevel = SanitizationLevel.STRICT
): T => {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }

    const result: Record<string, unknown> = {};
    for (const key in obj) {
        const value = obj[key];
        if (typeof value === 'string') {
            // Use appropriate sanitization based on field name
            const lowerKey = key.toLowerCase();
            if (lowerKey.includes('email')) {
                result[key] = sanitizeEmail(value);
            } else if (
                lowerKey.includes('url') ||
                lowerKey.includes('link') ||
                lowerKey === 'href'
            ) {
                result[key] = sanitizeUrl(value);
            } else if (lowerKey.includes('slug')) {
                result[key] = sanitizeSlug(value);
            } else if (
                lowerKey.includes('content') ||
                lowerKey.includes('description') ||
                lowerKey.includes('body')
            ) {
                result[key] = sanitizeHtmlContent(value);
            } else {
                result[key] = sanitizeString(value, level);
            }
        } else {
            result[key] = value;
        }
    }
    return result as T;
};

/**
 * Sanitizes all string values in query params (URLSearchParams)
 *
 * @param params - The URLSearchParams to sanitize
 * @returns Sanitized URLSearchParams
 */
export const sanitizeQueryParams = (params: URLSearchParams): URLSearchParams => {
    if (!params) {
        return new URLSearchParams();
    }

    const sanitized = new URLSearchParams();
    const processedKeys = new Set<string>();

    for (const [key, _value] of params.entries()) {
        if (processedKeys.has(key)) {
            continue;
        }

        const values = params.getAll(key);
        const lowerKey = key.toLowerCase();

        for (const val of values) {
            let sanitizedValue: string;

            if (lowerKey.includes('email')) {
                sanitizedValue = sanitizeEmail(val);
            } else if (lowerKey.includes('search') || lowerKey === 'q' || lowerKey === 'query') {
                sanitizedValue = sanitizeSearchQuery(val);
            } else if (lowerKey.includes('url') || lowerKey.includes('link')) {
                sanitizedValue = sanitizeUrl(val);
            } else if (lowerKey.includes('slug')) {
                sanitizedValue = sanitizeSlug(val);
            } else {
                sanitizedValue = sanitizeString(val, SanitizationLevel.STRICT);
            }

            if (sanitizedValue) {
                sanitized.append(key, sanitizedValue);
            }
        }
        processedKeys.add(key);
    }
    return sanitized;
};

/**
 * Sanitizes headers (shallow, only string values)
 * Uses strict sanitization for all header values
 *
 * @param headers - The headers object to sanitize
 * @returns Sanitized headers
 */
export const sanitizeHeaders = (headers: Record<string, unknown>): Record<string, unknown> => {
    if (!headers || typeof headers !== 'object') {
        return headers;
    }

    const result: Record<string, unknown> = {};
    for (const key in headers) {
        const value = headers[key];
        if (typeof value === 'string') {
            // All headers get strict sanitization
            result[key] = sanitizeString(value, SanitizationLevel.STRICT, 500);
        } else {
            result[key] = value;
        }
    }
    return result;
};

/**
 * Deep sanitizes an object (recursive)
 * Use with caution on large objects
 *
 * @param obj - The object to sanitize
 * @param level - The sanitization level
 * @param maxDepth - Maximum recursion depth (default: 10)
 * @returns Deeply sanitized object
 */
export const sanitizeDeep = <T>(
    obj: T,
    level: SanitizationLevel = SanitizationLevel.STRICT,
    maxDepth = 10
): T => {
    if (maxDepth <= 0) {
        return obj;
    }

    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj === 'string') {
        return sanitizeString(obj, level) as T;
    }

    if (Array.isArray(obj)) {
        return obj.map((item) => sanitizeDeep(item, level, maxDepth - 1)) as T;
    }

    if (typeof obj === 'object') {
        const result: Record<string, unknown> = {};
        for (const key in obj) {
            result[key] = sanitizeDeep((obj as Record<string, unknown>)[key], level, maxDepth - 1);
        }
        return result as T;
    }

    return obj;
};
