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
    displayName: z.string().min(2).max(50).nullish(),
    firstName: z.string().min(2).max(50).nullish(),
    lastName: z.string().min(2).max(50).nullish(),
    slug: z.string().min(1),
    // DB column is `image` on users. `avatarUrl` is kept as legacy alias for
    // consumers; the service may project either. Both nullable.
    avatarUrl: z.string().url().nullish(),
    image: z.string().url().nullish(),
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
    birthDate: z.date().nullish(),

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
    // Use .nullish() (not .optional()) because Drizzle returns `null` for empty JSONB columns,
    // and Zod's .optional() rejects null. The SYSTEM user (and any future user without a
    // populated profile/settings) has these as NULL in DB.
    profile: UserProfileSchema.nullish(),
    settings: UserSettingsSchema.nullish(),

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
    authProvider: AuthProviderEnumSchema.nullish(),
    authProviderUserId: z.string().min(1).nullish(),

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
