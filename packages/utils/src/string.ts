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
 * Generates a unique slug from a string by checking for its existence.
 * If the initial slug exists, it appends a numeric suffix until a unique slug is found.
 *
 * @param initialString - The string to be converted into a slug.
 * @param checkExists - An async function that takes a slug string and returns `true` if it exists, `false` otherwise.
 * @returns A promise that resolves to a unique slug string.
 * @example
 * const uniqueSlug = await createUniqueSlug('My Post', async (slug) => {
 *   return !!(await db.post.findUnique({ where: { slug } }));
 * });
 */
export async function createUniqueSlug(
    initialString: string,
    checkExists: (slug: string) => Promise<boolean>
): Promise<string> {
    if (!initialString) {
        // Return a random string or handle as an error, depending on requirements
        return randomString(12);
    }

    const baseSlug = toSlug(initialString);
    let potentialSlug = baseSlug;
    let counter = 2;

    while (await checkExists(potentialSlug)) {
        potentialSlug = `${baseSlug}-${counter}`;
        counter++;
    }

    return potentialSlug;
}

/**
 * Remove HTML tags from a string
 * @param html - HTML string
 * @returns Plain text string
 */
export function stripHtml(html: string): string {
    if (!html) return html;
    return html.replace(/<[^>]*>/g, '');
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
 * Generate a random string of specified length
 * @param length - Length of the random string (default: 8)
 * @param chars - Characters to use (default: alphanumeric)
 * @returns Random string
 */
export function randomString(
    length = 8,
    chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
): string {
    let result = '';
    const charsLength = chars.length;
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * charsLength));
    }
    return result;
}
