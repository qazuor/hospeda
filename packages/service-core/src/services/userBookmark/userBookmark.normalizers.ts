import type {
    UserBookmarkCreateInput,
    UserBookmarkListByEntityInput,
    UserBookmarkListByUserInput,
    UserBookmarkUpdateInput
} from '@repo/schemas';
import type { EntityTypeEnum } from '@repo/types';
import type { Actor } from '../../types';

// Note: Types are now imported from @repo/schemas

/**
 * Normaliza el input para crear un bookmark.
 * Trimea name/description y valida entityType.
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
 * Normaliza el input para actualizar un bookmark.
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
 * Normaliza el input para listar bookmarks de usuario.
 */
export const normalizeListByUserInput = (
    params: UserBookmarkListByUserInput,
    _actor: Actor
): UserBookmarkListByUserInput => {
    return params;
};

/**
 * Normaliza el input para listar bookmarks de entidad.
 */
export const normalizeListByEntityInput = (
    params: UserBookmarkListByEntityInput,
    _actor: Actor
): UserBookmarkListByEntityInput => {
    return params;
};
