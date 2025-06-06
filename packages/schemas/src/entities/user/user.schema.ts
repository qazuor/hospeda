import { PermissionEnum, RoleEnum } from '@repo/types';
import { z } from 'zod';
import {
    ContactInfoSchema,
    LocationSchema,
    SocialNetworkSchema,
    WithAdminInfoSchema,
    WithAuditSchema,
    WithIdSchema,
    WithLifecycleStateSchema
} from '../../common/index.js';
import { StrongPasswordRegex } from '../../utils/utils.js';
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
    .extend({
        /** Username, 3-50 characters */
        userName: z
            .string()
            .min(3, { message: 'zodError.user.userName.min' })
            .max(50, { message: 'zodError.user.userName.max' }),
        /**
         * User password (input only, not stored as plain text).
         * Must be 8-20 characters, include uppercase, lowercase, number, and special character.
         */
        password: z
            .string()
            .min(8, { message: 'zodError.user.password.min' })
            .max(20, { message: 'zodError.user.password.max' })
            .regex(StrongPasswordRegex, { message: 'zodError.user.password.strong' }),
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
        birthDate: z.string().optional(),
        /** Email verification status, optional */
        emailVerified: z.boolean().optional(),
        /** Phone verification status, optional */
        phoneVerified: z.boolean().optional(),
        /** Contact info, optional */
        contactInfo: ContactInfoSchema.optional(),
        /** User location, optional */
        location: LocationSchema.optional(),
        /** Social networks, optional */
        socialNetworks: SocialNetworkSchema.optional(),
        /** User role (required) */
        role: z.nativeEnum(RoleEnum, {
            required_error: 'zodError.user.role.required',
            invalid_type_error: 'zodError.user.role.invalidType'
        }),
        /** List of permissions, optional */
        permissions: z
            .array(
                z.nativeEnum(PermissionEnum, {
                    required_error: 'zodError.user.permissions.required',
                    invalid_type_error: 'zodError.user.permissions.invalidType'
                })
            )
            .optional(),
        /** User profile information */
        profile: UserProfileSchema.optional(),
        /** User settings, optional */
        settings: UserSettingsSchema.optional()
    });

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
    role: z.nativeEnum(RoleEnum).optional(),
    q: z.string().optional() // búsqueda libre
});

// Input para ordenamiento de resultados
export const UserSortInputSchema = z.object({
    sortBy: z.enum(['userName', 'createdAt', 'firstName', 'lastName']).optional(),
    order: z.enum(['asc', 'desc']).optional()
});
