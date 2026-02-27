import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { BaseContactFields } from '../../common/contact.schema.js';
import { UserIdSchema } from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import { FullLocationFields } from '../../common/location.schema.js';
import { SocialNetworkFields } from '../../common/social.schema.js';
import { BaseVisibilityFields } from '../../common/visibility.schema.js';
import { AuthProviderEnumSchema } from '../../enums/auth-provider.schema.js';
import { PermissionEnumSchema, RoleEnumSchema } from '../../enums/index.js';
import { UserBookmarkSchema } from '../userBookmark/userBookmark.schema.js';
import { UserProfileSchema } from './user.profile.schema.js';
import { UserSettingsSchema } from './user.settings.schema.js';

/**
 * User Schema - Main Entity Schema
 *
 * This schema defines the complete structure of a User entity
 * using base field objects for consistency and maintainability.
 */
export const UserSchema = z.object({
    // Base fields
    id: UserIdSchema,
    ...BaseAuditFields,
    ...BaseLifecycleFields,
    ...BaseAdminFields,
    ...BaseVisibilityFields,

    // User-specific core fields
    slug: z
        .string({
            message: 'zodError.user.slug.required'
        })
        .min(1, { message: 'zodError.common.slug.min' }),

    /** Better Auth required: user email address */
    email: z
        .string({
            message: 'zodError.user.email.required'
        })
        .email({ message: 'zodError.user.email.invalid' })
        .min(1, { message: 'zodError.user.email.min' }),

    /** Better Auth required: email verification status */
    emailVerified: z
        .boolean({
            message: 'zodError.user.emailVerified.invalid'
        })
        .default(false),

    /** Better Auth required: avatar/profile image URL */
    image: z.string().url({ message: 'zodError.user.image.invalidUrl' }).nullish(),

    /** Better Auth Admin plugin: whether user is banned */
    banned: z.boolean().default(false).optional(),

    /** Better Auth Admin plugin: reason for ban */
    banReason: z.string().nullish(),

    /** Better Auth Admin plugin: ban expiration date */
    banExpires: z.date().nullish(),

    // Authentication fields
    authProvider: AuthProviderEnumSchema.optional(),

    authProviderUserId: z
        .string()
        .min(1, { message: 'zodError.user.authProviderUserId.min' })
        .optional(),

    // Personal information
    displayName: z
        .string({
            message: 'zodError.user.displayName.required'
        })
        .min(2, { message: 'zodError.user.displayName.min' })
        .max(50, { message: 'zodError.user.displayName.max' })
        .optional(),

    firstName: z
        .string({
            message: 'zodError.user.firstName.required'
        })
        .min(2, { message: 'zodError.user.firstName.min' })
        .max(50, { message: 'zodError.user.firstName.max' })
        .nullish(),

    lastName: z
        .string({
            message: 'zodError.user.lastName.required'
        })
        .min(2, { message: 'zodError.user.lastName.min' })
        .max(50, { message: 'zodError.user.lastName.max' })
        .nullish(),

    birthDate: z
        .date({
            message: 'zodError.user.birthDate.invalid'
        })
        .nullish(),

    // Contact and location (using base objects)
    ...BaseContactFields,

    // Location (using base object but making it optional for users)
    ...FullLocationFields,

    // Social networks
    ...SocialNetworkFields,

    // Role and permissions
    role: RoleEnumSchema,
    permissions: z.array(PermissionEnumSchema).default([]),

    // User-specific nested objects
    profile: UserProfileSchema.nullish(),
    settings: UserSettingsSchema.optional(),
    bookmarks: z.array(UserBookmarkSchema).optional()
});

/**
 * Type export for the main User entity
 */
export type User = z.infer<typeof UserSchema>;
