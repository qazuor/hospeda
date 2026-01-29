import { z } from 'zod';
import { UserIdSchema } from '../../common/id.schema.js';
import { AuthProviderEnumSchema } from '../../enums/auth-provider.schema.js';
import { PermissionEnumSchema, RoleEnumSchema } from '../../enums/index.js';
import { UserProfileSchema } from './user.profile.schema.js';
import { UserSettingsSchema } from './user.settings.schema.js';

/**
 * User Public Schema
 * Minimal fields accessible by anyone (guests and authenticated users)
 * Used for public listings, author info, etc.
 */
export const UserPublicSchema = z.object({
    id: UserIdSchema,
    displayName: z.string().min(2).max(50).optional(),
    firstName: z.string().min(2).max(50).optional(),
    lastName: z.string().min(2).max(50).optional(),
    slug: z.string().min(1),
    avatarUrl: z.string().url().optional(),
    role: RoleEnumSchema
});

/**
 * User Protected Schema
 * Fields accessible by the user themselves
 * Includes personal information, settings, contact details
 */
export const UserProtectedSchema = UserPublicSchema.extend({
    // Contact information
    email: z.string().email().optional(),
    phone: z.string().optional(),
    phoneSecondary: z.string().optional(),
    website: z.string().url().optional(),

    // Personal information
    birthDate: z.date().optional(),

    // Location
    addressLine1: z.string().optional(),
    addressLine2: z.string().optional(),
    city: z.string().optional(),
    province: z.string().optional(),
    country: z.string().optional(),
    postalCode: z.string().optional(),

    // Social networks
    facebookUrl: z.string().url().optional(),
    instagramUrl: z.string().url().optional(),
    twitterUrl: z.string().url().optional(),
    linkedinUrl: z.string().url().optional(),
    youtubeUrl: z.string().url().optional(),

    // User-specific objects
    profile: UserProfileSchema.optional(),
    settings: UserSettingsSchema.optional(),

    // Permissions (user can see their own permissions)
    permissions: z.array(PermissionEnumSchema).default([])
});

/**
 * User Admin Schema
 * Full access to all fields including audit, lifecycle, and admin-specific data
 * Only accessible by admins
 */
export const UserAdminSchema = UserProtectedSchema.extend({
    // Authentication
    authProvider: AuthProviderEnumSchema.optional(),
    authProviderUserId: z.string().min(1).optional(),

    // Lifecycle
    lifecycleState: z.string(),

    // Visibility
    visibility: z.string(),

    // Audit fields
    createdAt: z.date(),
    updatedAt: z.date(),
    deletedAt: z.date().nullable(),
    createdById: z.string().uuid().nullable(),
    updatedById: z.string().uuid().nullable(),

    // Admin fields
    notes: z.string().optional(),
    internalTags: z.array(z.string()).default([])
});

/**
 * Type exports
 */
export type UserPublic = z.infer<typeof UserPublicSchema>;
export type UserProtected = z.infer<typeof UserProtectedSchema>;
export type UserAdmin = z.infer<typeof UserAdminSchema>;
