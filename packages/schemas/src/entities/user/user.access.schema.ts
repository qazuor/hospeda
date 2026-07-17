import { z } from 'zod';
import { UserIdSchema } from '../../common/id.schema.js';
import { AuthProviderEnumSchema } from '../../enums/auth-provider.schema.js';
import {
    PermissionEnumSchema,
    PreferredContactEnumSchema,
    RoleEnumSchema
} from '../../enums/index.js';
import { UserSettingsSchema } from './user.settings.schema.js';

// ============================================================================
// READ⊇WRITE LENIENT SHAPES (HOS-190)
// ============================================================================
//
// These access schemas are RESPONSE contracts: `stripWithSchema`
// (apps/api/src/utils/response-helpers.ts) parses the stored row against them
// and FAIL-CLOSES to HTTP 500 on any mismatch. The user profile columns
// (`display_name`/`first_name`/`last_name` `text`; `profile`/`location`/
// `contact_info`/`social_networks` JSONB) are unbounded, so a legacy/imported
// value stricter than today's WRITE bounds used to 500 the profile GET and lock
// the owner out of editing. These lenient shapes assert TYPE + PRESENCE only for
// the free-form fields; content bounds (length, phone/URL format) stay enforced
// on the WRITE path (`UserProfileSchema`, `UserLocationSchema`,
// `ContactInfoSchema`, `SocialNetworkSchema` — from which the user
// create/update schemas derive). This mirrors the accommodation access-schema
// overlay and never touches the shared base/write schemas.

/** Profile read shape — drops bio/occupation length bounds; keeps avatar/website as URLs (read == write there). */
const UserProfileReadSchema = z.object({
    avatar: z.string().url({ message: 'zodError.user.profile.avatar.url' }).optional(),
    bio: z.string().optional(),
    website: z.string().url({ message: 'zodError.user.profile.website.url' }).optional(),
    occupation: z.string().optional()
});

/** Location read shape — postal string fields as plain strings (legacy 1-char country / over-length postal must not 500). */
const UserLocationReadSchema = z.object({
    country: z.string().optional(),
    region: z.string().optional(),
    city: z.string().optional(),
    addressLine1: z.string().optional(),
    postalCode: z.string().optional()
});

/** Contact read shape — phones/emails/website as plain strings (legacy AR local-format phones like `0223-155-1234` lack the `+` the write regex requires). */
const ContactInfoReadSchema = z.object({
    personalEmail: z.string().optional(),
    workEmail: z.string().optional(),
    homePhone: z.string().optional(),
    workPhone: z.string().optional(),
    mobilePhone: z.string().optional(),
    whatsapp: z.string().optional(),
    website: z.string().optional(),
    preferredEmail: PreferredContactEnumSchema.optional(),
    preferredPhone: PreferredContactEnumSchema.optional()
});

/** Social read shape — plain strings (legacy variant URLs fail the platform regex). */
const SocialNetworkReadSchema = z.object({
    facebook: z.string().optional(),
    instagram: z.string().optional(),
    twitter: z.string().optional(),
    linkedIn: z.string().optional(),
    tiktok: z.string().optional(),
    youtube: z.string().optional()
});

/**
 * User Public Schema
 * Minimal fields accessible by anyone (guests and authenticated users)
 * Used for public listings, author info, etc.
 */
export const UserPublicSchema = z.object({
    id: UserIdSchema,
    // HOS-190 read⊇write: names are unbounded `text` columns; a legacy 1-char or
    // over-length value must not 500 the response. Bounds stay on the write path.
    displayName: z.string().nullish(),
    firstName: z.string().nullish(),
    lastName: z.string().nullish(),
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
    // `profile` uses the lenient read shape (HOS-190) so a legacy short bio never 500s.
    profile: UserProfileReadSchema.nullish(),
    settings: UserSettingsSchema.nullish(),

    // Permissions (user can see their own permissions)
    permissions: z.array(PermissionEnumSchema).default([])
});

/**
 * User Self Schema
 * Response contract for SELF-SCOPED profile routes only
 * (`/protected/users/:id` GET/PUT/PATCH, where ownership is enforced).
 *
 * Extends UserProtectedSchema with the JSONB columns where the onboarding
 * and edit-profile flows actually persist data: `contactInfo.mobilePhone`,
 * `location.{country,region,city,...}` and `socialNetworks.*`. Without these
 * fields the response strip (`stripWithSchema`, SPEC-087) silently dropped
 * them and the web edit-profile form always rehydrated empty.
 *
 * Do NOT use this schema for embedded user relations (`owner`, `author`,
 * reviewer `user`, `sponsorUser`, ...) — those reach users other than the
 * profile owner and must keep using UserProtectedSchema, which strips the
 * PII-bearing JSONB blobs.
 *
 * `contactInfo`/`location`/`socialNetworks` use the lenient READ shapes
 * (HOS-190): the write schemas enforce phone/URL format and field length, but a
 * stored row may legitimately hold a legacy value that predates those bounds (an
 * AR local-format phone without `+`, a 1-char country, a non-canonical social
 * URL). A strip failure would turn the whole profile GET into a 500 and lock the
 * owner out of editing every field — so the response asserts type + presence
 * only here, while the write path stays strict.
 */
export const UserSelfSchema = UserProtectedSchema.extend({
    contactInfo: ContactInfoReadSchema.nullish(),
    location: UserLocationReadSchema.nullish(),
    socialNetworks: SocialNetworkReadSchema.nullish()
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
export type UserSelf = z.infer<typeof UserSelfSchema>;
export type UserAdmin = z.infer<typeof UserAdminSchema>;
