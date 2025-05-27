import { z } from 'zod';
import { UserBookmarkSchema } from './user.bookmark.schema';
import { UserSchema } from './user.schema';

/**
 * User Extras Input schema definition using Zod for validation.
 * Represents additional input data for a user.
 */

// Inputs para user
export const NewUserInputSchema = UserSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true
});
export const UpdateUserInputSchema = NewUserInputSchema.partial();

// Inputs para bookmarks
export const NewUserBookmarkInputSchema = UserBookmarkSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true
});
export const UpdateUserBookmarkInputSchema = NewUserBookmarkInputSchema.partial();

// Input para filtros de búsqueda de usuarios
export const UserFilterInputSchema = z.object({
    userName: z
        .string()
        .min(3, { message: 'zodError.user.userName.min' })
        .max(50, { message: 'zodError.user.userName.max' })
        .optional(),
    firstName: z
        .string()
        .min(2, { message: 'zodError.user.firstName.min' })
        .max(50, { message: 'zodError.user.firstName.max' })
        .optional(),
    lastName: z
        .string()
        .min(2, { message: 'zodError.user.lastName.min' })
        .max(50, { message: 'zodError.user.lastName.max' })
        .optional(),
    emailVerified: z.boolean().optional(),
    phoneVerified: z.boolean().optional(),
    roleId: z.string().optional(),
    q: z.string().optional() // búsqueda libre
});

// Input para ordenamiento de resultados
export const UserSortInputSchema = z.object({
    sortBy: z.enum(['userName', 'createdAt', 'firstName', 'lastName']).optional(),
    order: z.enum(['asc', 'desc']).optional()
});

// Input para acciones administrativas
export const UserSetRoleInputSchema = z.object({
    roleId: z.string({ required_error: 'zodError.user.roleId.required' })
});
