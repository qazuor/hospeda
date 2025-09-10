/**
 * Utility functions for handling different types of identifiers (UUID, slug, etc.)
 */

/**
 * Regular expression to match UUID v4 format
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Determines if a given string is a UUID or a slug
 * @param value The string to check
 * @returns Object containing the field type and the value
 */
export function parseIdOrSlug(value: string): {
    field: 'id' | 'slug';
    value: string;
    isUuid: boolean;
} {
    const isUuid = UUID_REGEX.test(value);
    return {
        field: isUuid ? 'id' : 'slug',
        value,
        isUuid
    };
}

/**
 * Checks if a string is a valid UUID
 * @param value The string to check
 * @returns True if the string is a valid UUID, false otherwise
 */
export function isUuid(value: string): boolean {
    return UUID_REGEX.test(value);
}

/**
 * Checks if a string is a valid slug (not a UUID)
 * @param value The string to check
 * @returns True if the string is not a UUID (assumed to be a slug), false otherwise
 */
export function isSlug(value: string): boolean {
    return !UUID_REGEX.test(value);
}
