/**
 * String utility functions
 * @module utils/string
 */

import logger from '@repo/logger';
import slugify from 'slugify';

type SlugifyOptions = {
    replacement?: string;
    remove?: RegExp;
    lower?: boolean;
    strict?: boolean;
    locale?: string;
    trim?: boolean;
};

/**
 * Capitalize the first letter of a string
 * @param str - String to capitalize
 * @returns Capitalized string
 */
export function capitalize(str: string): string {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert a string to title case
 * @param str - String to convert
 * @returns Title case string
 */
export function titleCase(str: string): string {
    if (!str) return str;
    return str
        .toLowerCase()
        .split(' ')
        .map((word) => capitalize(word))
        .join(' ');
}

/**
 * Truncate a string to a specified length
 * @param str - String to truncate
 * @param length - Maximum length
 * @param suffix - Suffix to add if truncated (default: '...')
 * @returns Truncated string
 */
export function truncate(str: string, length: number, suffix = '...'): string {
    if (!str) return str;
    if (str.length <= length) return str;
    return str.substring(0, length - suffix.length) + suffix;
}

/**
 * Generate a URL-friendly slug from a string
 * @param str - String to convert to slug
 * @param options - Slugify options
 * @returns URL-friendly slug
 */
export function toSlug(str: string, options?: SlugifyOptions): string {
    if (!str) return '';
    try {
        return slugify(str, {
            lower: true,
            strict: true,
            ...options
        });
    } catch (error) {
        logger.error(error, `Utils:String | Failed to generate slug for string: ${str}`);
        return '';
    }
}

/**
 * Truncates a slug down to `maxLength` characters, then strips any trailing
 * hyphen left dangling by the cut (e.g. `'foo-bar-'` -> `'foo-bar'`) so the
 * result never ends in a stray separator.
 *
 * @param slug - Slug to truncate.
 * @param maxLength - Maximum allowed length. Values <= 0 yield an empty string.
 * @returns The truncated slug, without a trailing hyphen.
 */
function truncateSlugToMaxLength(slug: string, maxLength: number): string {
    if (maxLength <= 0) return '';
    if (slug.length <= maxLength) return slug;
    return slug.slice(0, maxLength).replace(/-+$/, '');
}

/**
 * Generates a unique slug from a string by checking for its existence.
 * If the initial slug exists, it appends a numeric suffix until a unique slug is found.
 *
 * @param initialString - The string to be converted into a slug.
 * @param checkExists - An async function that takes a slug string and returns `true` if it exists, `false` otherwise.
 * @param maxLength - Optional maximum length for the resulting slug. When provided, the
 * returned slug (including any `-N` uniqueness suffix) never exceeds this length, and any
 * trailing hyphen left by truncation is stripped. When omitted, behavior is unchanged
 * (no length limit is applied) — this keeps the function backward-compatible for every
 * existing caller that does not pass it.
 * @returns A promise that resolves to a unique slug string.
 * @example
 * const uniqueSlug = await createUniqueSlug('My Post', async (slug) => {
 *   return !!(await db.post.findUnique({ where: { slug } }));
 * });
 * @example
 * // Cap the result at 50 chars (e.g. to match a DB column's max length constraint)
 * const uniqueSlug = await createUniqueSlug(
 *   'A Very Long Accommodation Name That Exceeds The Column Limit',
 *   async (slug) => !!(await db.accommodation.findUnique({ where: { slug } })),
 *   50
 * );
 */
export async function createUniqueSlug(
    initialString: string,
    checkExists: (slug: string) => Promise<boolean>,
    maxLength?: number
): Promise<string> {
    if (!initialString) {
        // Return a random string or handle as an error, depending on requirements
        return randomString(12);
    }

    const rawSlug = toSlug(initialString);
    const baseSlug =
        maxLength === undefined ? rawSlug : truncateSlugToMaxLength(rawSlug, maxLength);
    let potentialSlug = baseSlug;
    let counter = 2;

    while (await checkExists(potentialSlug)) {
        const suffix = `-${counter}`;
        potentialSlug =
            maxLength === undefined
                ? `${baseSlug}${suffix}`
                : `${truncateSlugToMaxLength(baseSlug, maxLength - suffix.length)}${suffix}`;
        counter++;
    }

    return potentialSlug;
}

/**
 * Maximum input length accepted by {@link stripHtml}.
 *
 * Applied as a secondary depth-of-defence guard: the primary fix is the
 * `/<[^<>]*>/g` regex (which excludes `<` from the character class, making
 * each match attempt O(1) rather than O(n), so the full scan stays O(n)).
 * The cap ensures even the per-character scanning cost stays bounded for
 * content that is far larger than any realistic HTML excerpt or plain-text
 * sanitisation target. 100 000 chars is a generous upper bound; real markup
 * used in this codebase (accommodation descriptions, review text) is well
 * under 10 000 chars.
 */
const MAX_STRIP_HTML_LENGTH = 100_000;

/**
 * Remove HTML tags from a string
 * @param html - HTML string
 * @returns Plain text string
 */
export function stripHtml(html: string): string {
    if (!html) return html;
    // Cap length before running the regex. See MAX_STRIP_HTML_LENGTH for rationale.
    const input = html.length > MAX_STRIP_HTML_LENGTH ? html.slice(0, MAX_STRIP_HTML_LENGTH) : html;
    // `/<[^<>]*>/g` — excluding `<` from the character class means each match
    // attempt stops immediately at the next `<` instead of scanning forward
    // to the end of a long run of characters. This makes the worst-case cost
    // O(n) instead of O(n²), fixing the CodeQL js/polynomial-redos finding.
    // The original `/<[^>]*>/g` was super-linear on inputs containing many
    // consecutive `<` with no closing `>`.
    //
    // Loop until no more tags are removed: a single pass can leave a residual
    // tag when markup is nested (e.g. '<sc<ript>' -> first pass removes '<ript>',
    // second pass removes the remaining '<sc').
    let result = input;
    let prev: string;
    do {
        prev = result;
        result = result.replace(/<[^<>]*>/g, '');
    } while (result !== prev);
    return result;
}

/**
 * Check if a string is empty or contains only whitespace
 * @param str - String to check
 * @returns Whether the string is empty
 */
export function isEmpty(str?: string | null): boolean {
    return !str || str.trim() === '';
}

/**
 * Generate a cryptographically secure random string of specified length.
 *
 * Uses `crypto.getRandomValues` instead of `Math.random()` to ensure
 * the output is suitable for security-sensitive use cases (tokens, slugs, IDs).
 *
 * @param length - Length of the random string (default: 8)
 * @param chars - Characters to use (default: alphanumeric)
 * @returns Cryptographically secure random string
 */
export function randomString(
    length = 8,
    chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
): string {
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, (v) => chars[v % chars.length]).join('');
}
