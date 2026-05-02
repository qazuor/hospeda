import type {
    UserBookmarkCollectionCreateInput,
    UserBookmarkCollectionUpdateInput
} from '@repo/schemas';
import type { Actor } from '../../types';

/**
 * Normalizes the input for creating a bookmark collection.
 *
 * - Trims whitespace from `name` and `description`.
 * - Normalizes hex `color` to uppercase (e.g. `#e57373` → `#E57373`).
 * - Leaves `icon` unchanged (icon names are case-sensitive identifiers).
 *
 * @param data - The raw create input
 * @param _actor - The actor performing the action (unused, kept for interface consistency)
 * @returns Normalized create input
 */
export const normalizeCreateInput = (
    data: UserBookmarkCollectionCreateInput,
    _actor: Actor
): UserBookmarkCollectionCreateInput => {
    return {
        ...data,
        name: typeof data.name === 'string' ? data.name.trim() : data.name,
        description:
            typeof data.description === 'string' ? data.description.trim() : data.description,
        color: typeof data.color === 'string' ? data.color.toUpperCase() : data.color
    };
};

/**
 * Normalizes the input for updating a bookmark collection.
 *
 * - Trims whitespace from `name` and `description` when present.
 * - Normalizes hex `color` to uppercase when present.
 * - Leaves `icon` unchanged.
 *
 * @param data - The raw update input (all fields optional)
 * @param _actor - The actor performing the action (unused, kept for interface consistency)
 * @returns Normalized update input
 */
export const normalizeUpdateInput = (
    data: UserBookmarkCollectionUpdateInput,
    _actor: Actor
): UserBookmarkCollectionUpdateInput => {
    return {
        ...data,
        name: typeof data.name === 'string' ? data.name.trim() : data.name,
        description:
            typeof data.description === 'string' ? data.description.trim() : data.description,
        color: typeof data.color === 'string' ? data.color.toUpperCase() : data.color
    };
};
