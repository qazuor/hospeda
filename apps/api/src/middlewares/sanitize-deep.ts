/**
 * Deep recursive sanitization utility.
 *
 * Extracted from `sanitization.ts` to keep that module under 500 lines.
 *
 * @module api/middlewares/sanitize-deep
 */

import { SanitizationLevel, sanitizeString } from './sanitization.js';

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
