import { AuthProviderEnum, RoleEnum } from '@repo/types';
import { z } from 'zod';
import { UserIdSchema } from '../../common/id.schema.js';
import {
    ContactInfoSchema,
    LocationSchema,
    SocialNetworkSchema,
    WithAdminInfoSchema,
    WithAuditSchema,
    WithIdSchema,
    WithLifecycleStateSchema,
    WithVisibilitySchema
} from '../../common/index.js';
import { BaseSearchSchema } from '../../common/search.schemas.js';
import { PermissionEnumSchema, RoleEnumSchema } from '../../enums/index.js';
import { UserBookmarkSchema } from './user.bookmark.schema.js';
import { UserProfileSchema } from './user.profile.schema.js';
import { UserSettingsSchema } from './user.settings.schema.js';

/**
 * User schema definition using Zod for validation.
 * Includes profile, settings, direct permissions (by enum), and role (by enum).
 * Password validation is for user input, not for storage.
 */
export const UserSchema = WithIdSchema.merge(WithAuditSchema)
    .merge(WithLifecycleStateSchema)
    .merge(WithAdminInfoSchema)
    .merge(WithVisibilitySchema)
    .extend({
        id: UserIdSchema,
        slug: z.string().min(1, { message: 'zodError.common.slug.min' }),
        /** Primary authentication provider and provider user id (optional) */
        authProvider: z.nativeEnum(AuthProviderEnum).optional(),
        authProviderUserId: z.string().min(1).optional(),
        /** Display name, optional */
        displayName: z
            .string()
            .min(2, { message: 'zodError.user.displayName.min' })
            .max(50, { message: 'zodError.user.displayName.max' })
            .optional(),
        /** First name, optional */
        firstName: z
            .string()
            .min(2, { message: 'zodError.user.firstName.min' })
            .max(50, { message: 'zodError.user.firstName.max' })
            .optional(),
        /** Last name, optional */
        lastName: z
            .string()
            .min(2, { message: 'zodError.user.lastName.min' })
            .max(50, { message: 'zodError.user.lastName.max' })
            .optional(),
        /** Birth date as string, optional */
        birthDate: z.date().optional(),
        /** Contact info, optional */
        contactInfo: ContactInfoSchema.optional(),
        /** User location, optional */
        location: LocationSchema.optional(),
        /** Social networks, optional */
        socialNetworks: SocialNetworkSchema.optional(),
        /** User role (required) */
        role: RoleEnumSchema,
        /** List of permissions, required (default: empty array) */
        permissions: z.array(PermissionEnumSchema).default([]),
        /** User profile information */
        profile: UserProfileSchema.optional(),
        /** User settings, optional */
        settings: UserSettingsSchema.optional(),
        bookmarks: z.array(UserBookmarkSchema).optional()
    });

/**
 * Schema for creating a new user.
 * Omits server-generated fields like id, audit fields, etc.
 */
export const CreateUserSchema = UserSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    createdById: true,
    updatedById: true,
    deletedById: true,
    bookmarks: true
}).strict();

// Input para filtros de búsqueda de usuarios
export const UserFilterInputSchema = BaseSearchSchema.extend({
    filters: z
        .object({
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
            role: z.nativeEnum(RoleEnum).optional(),
            q: z.string().optional() // free text search
        })
        .optional()
}).strict();

// Input para ordenamiento de resultados
export const UserSortInputSchema = z.object({
    sortBy: z.enum(['createdAt', 'firstName', 'lastName']).optional(),
    order: z.enum(['asc', 'desc']).optional()
});

/**
 * UpdateUserSchema: all fields optional except id (required for update).
 */
export const UpdateUserSchema = UserSchema.partial().extend({
    id: UserIdSchema
});

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
