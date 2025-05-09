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
        logger.error(`Failed to generate slug for string: ${str}`, 'Utils:String', error);
        return '';
    }
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
