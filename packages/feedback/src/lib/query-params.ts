/**
 * @repo/feedback - Query param serialization and parsing utilities.
 *
 * Allows pre-filling the feedback form via URL query string parameters.
 * All parsed values are sanitized to prevent XSS injection.
 */
import type { ReportTypeId } from '../schemas/feedback.schema.js';

/**
 * Parameters that can be pre-filled via URL query string.
 */
export interface FeedbackQueryParams {
    /** Report type ID to pre-select */
    type?: ReportTypeId;
    /** Pre-filled title (5-200 characters) */
    title?: string;
    /** Pre-filled description (10-5000 characters) */
    description?: string;
    /** URL where the error occurred */
    url?: string;
    /** Error message to pre-fill */
    error?: string;
    /** Stack trace to pre-fill */
    stack?: string;
    /** Source identifier (e.g., 'error-boundary') */
    source?: string;
}

/**
 * Serializes feedback params to a URL query string.
 *
 * Encodes all defined values using `URLSearchParams` and omits keys
 * whose value is `undefined` or an empty string.
 *
 * @param params - Feedback query params to serialize
 * @returns URL-encoded query string without leading `?`
 *
 * @example
 * ```ts
 * const qs = serializeFeedbackParams({ type: 'bug-js', title: 'App crash' });
 * // 'type=bug-js&title=App+crash'
 * ```
 */
export function serializeFeedbackParams(params: FeedbackQueryParams): string {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') {
            searchParams.set(key, value);
        }
    }

    return searchParams.toString();
}

/**
 * Parses and sanitizes feedback params from a URL query string.
 *
 * Reads each recognized key from the search string and runs every value
 * through {@link sanitize} to strip HTML tags and dangerous patterns before
 * returning them. Unknown keys are ignored. Returns `undefined` for any key
 * that is absent or whose sanitized value is empty.
 *
 * @param search - Raw query string (with or without leading `?`)
 * @returns Sanitized `FeedbackQueryParams` object
 *
 * @example
 * ```ts
 * const params = parseFeedbackParams('?type=bug-js&title=Crash');
 * // { type: 'bug-js', title: 'Crash', ... }
 * ```
 */
export function parseFeedbackParams(search: string): FeedbackQueryParams {
    const params = new URLSearchParams(search);

    return {
        type: sanitize(params.get('type')) as ReportTypeId | undefined,
        title: sanitize(params.get('title')),
        description: sanitize(params.get('description')),
        url: sanitize(params.get('url')),
        error: sanitize(params.get('error')),
        stack: sanitize(params.get('stack')),
        source: sanitize(params.get('source'))
    };
}

/**
 * Sanitizes a raw string value to prevent XSS.
 *
 * Removes HTML tags, `javascript:` protocol references, and inline event
 * handler attributes. Returns `undefined` when the input is null/empty or
 * when the sanitized result is an empty string.
 *
 * @param value - Raw string from URL params (or null when absent)
 * @returns Sanitized string, or `undefined` if the result is empty
 */
function sanitize(value: string | null): string | undefined {
    if (!value) return undefined;
    const cleaned = value
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+\s*=/gi, '') // Remove event handlers
        .trim();
    return cleaned || undefined;
}
