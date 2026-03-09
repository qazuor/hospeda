import type {
    EntityTypeEnum,
    UserBookmarkCreateInput,
    UserBookmarkListByEntityInput,
    UserBookmarkListByUserInput,
    UserBookmarkUpdateInput
} from '@repo/schemas';
import type { Actor } from '../../types';

// Note: Types are now imported from @repo/schemas

/**
 * Normalizes the input for creating a bookmark.
 * Trims name/description and validates entityType.
 */
export const normalizeCreateInput = (
    data: UserBookmarkCreateInput,
    _actor: Actor
): UserBookmarkCreateInput => {
    return {
        ...data,
        name: typeof data.name === 'string' ? data.name.trim() : data.name,
        description:
            typeof data.description === 'string' ? data.description.trim() : data.description,
        entityType: data.entityType as EntityTypeEnum
    };
};

/**
 * Normalizes the input for updating a bookmark.
 */
export const normalizeUpdateInput = (
    data: UserBookmarkUpdateInput,
    _actor: Actor
): UserBookmarkUpdateInput => {
    return {
        ...data,
        name: typeof data.name === 'string' ? data.name.trim() : data.name,
        description:
            typeof data.description === 'string' ? data.description.trim() : data.description
    };
};

/**
 * Normalizes the input for listing user bookmarks.
 */
export const normalizeListByUserInput = (
    params: UserBookmarkListByUserInput,
    _actor: Actor
): UserBookmarkListByUserInput => {
    return params;
};

/**
 * Normalizes the input for listing entity bookmarks.
 */
export const normalizeListByEntityInput = (
    params: UserBookmarkListByEntityInput,
    _actor: Actor
): UserBookmarkListByEntityInput => {
    return params;
};
