import type { UserBookmarkSchema } from '@repo/schemas';
import type { EntityTypeEnum } from '@repo/types';
import type { z } from 'zod';
import type { Actor } from '../../types';
import type {
    CreateUserBookmarkInput,
    ListBookmarksByEntityInput,
    ListBookmarksByUserInput,
    UpdateUserBookmarkInput
} from './userBookmark.schemas';

// Type for create/update input (without server-generated fields)
export type UserBookmarkCreateInput = Omit<
    z.infer<typeof UserBookmarkSchema>,
    | 'id'
    | 'createdAt'
    | 'updatedAt'
    | 'deletedAt'
    | 'createdById'
    | 'updatedById'
    | 'deletedById'
    | 'lifecycle'
    | 'adminInfo'
>;

/**
 * Normaliza el input para crear un bookmark.
 * Trimea name/description y valida entityType.
 */
export const normalizeCreateInput = (
    data: CreateUserBookmarkInput,
    _actor: Actor
): CreateUserBookmarkInput => {
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
    data: UpdateUserBookmarkInput,
    _actor: Actor
): UpdateUserBookmarkInput => {
    return {
        ...data,
        name: typeof data.name === 'string' ? data.name.trim() : data.name,
        description:
            typeof data.description === 'string' ? data.description.trim() : data.description
    };
};

export type { CreateUserBookmarkInput, UpdateUserBookmarkInput };

/**
 * Normaliza el input para listar bookmarks de usuario.
 */
export const normalizeListByUserInput = (
    params: ListBookmarksByUserInput,
    _actor: Actor
): ListBookmarksByUserInput => {
    return params;
};

/**
 * Normaliza el input para listar bookmarks de entidad.
 */
export const normalizeListByEntityInput = (
    params: ListBookmarksByEntityInput,
    _actor: Actor
): ListBookmarksByEntityInput => {
    return params;
};
