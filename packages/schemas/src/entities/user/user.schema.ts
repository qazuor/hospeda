import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { BaseContactFields } from '../../common/contact.schema.js';
import { UserIdSchema } from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import { UserLocationFields } from '../../common/location.schema.js';
import { SocialNetworkFields } from '../../common/social.schema.js';
import { BaseVisibilityFields } from '../../common/visibility.schema.js';
import { AuthProviderEnumSchema } from '../../enums/auth-provider.schema.js';
import { PermissionEnumSchema, RoleEnumSchema } from '../../enums/index.js';
import { ModerationStatusEnumSchema } from '../../enums/moderation-status.schema.js';
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

    // -------------------------------------------------------------------------
    // Image satellite columns (GAP-078-081 + GAP-078-197, SPEC-078-GAPS T-014)
    // These mirror Cloudinary metadata for efficient querying without URL parsing.
    // -------------------------------------------------------------------------

    /**
     * Cloudinary public_id for the user avatar.
     * Enables direct asset deletion in _afterHardDelete without URL parsing.
     * Null for users without an uploaded avatar or with legacy rows.
     */
    imagePublicId: z.string().nullish(),

    /**
     * Moderation state of the user avatar image.
     * Mirrors the moderationState returned by Cloudinary after upload.
     * Indexed for moderation-dashboard queries.
     */
    imageModerationState: ModerationStatusEnumSchema.nullish(),

    /**
     * Optional human-readable caption for the user avatar.
     */
    imageCaption: z.string().max(500).nullish(),

    /** Better Auth Admin plugin: whether user is banned */
    banned: z.boolean().default(false).optional(),

    /** Better Auth Admin plugin: reason for ban */
    banReason: z.string().nullish(),

    /** Better Auth Admin plugin: ban expiration date */
    banExpires: z.date().nullish(),

    // Authentication fields
    authProvider: AuthProviderEnumSchema.optional(),

    // Nullable in DB; an edit-mode form rehydrating from the API would otherwise
    // fail Zod validation with `expected string, received null` (SPEC-117 D-USERS.4).
    authProviderUserId: z
        .string()
        .min(1, { message: 'zodError.user.authProviderUserId.min' })
        .nullish(),

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

    // Location: dedicated user-profile location shape (all fields optional).
    // NOT FullLocationSchema — that requires street/number and uses
    // state/zipCode names, which rejected valid profile-location edits (BETA-34).
    // Field names match what onboarding stores + the edit form submits:
    // { country, region, city, addressLine1, postalCode }.
    ...UserLocationFields,

    // Social networks
    ...SocialNetworkFields,

    // Role and permissions
    role: RoleEnumSchema,
    permissions: z.array(PermissionEnumSchema).default([]),

    // SPEC-113: post-signup onboarding flags. Mirror the
    // `users.profile_completed` + `users.set_password_prompted` columns added
    // in Phase 0. Optional with default `false` so existing fixtures and
    // create/update inputs that don't mention them keep working.
    profileCompleted: z.boolean().default(false).optional(),
    setPasswordPrompted: z.boolean().default(false).optional(),

    /**
     * SPEC-143 #29 service-suspension flag. Canonical source for the pause
     * "service suspension" dimension; denormalized to
     * `accommodations.ownerSuspended` for the public hot path. Mirrors the
     * `users.service_suspended` column. Optional with default `false` so
     * existing fixtures and create/update inputs that omit it keep working.
     */
    serviceSuspended: z.boolean().default(false).optional(),

    // User-specific nested objects
    profile: UserProfileSchema.nullish(),
    settings: UserSettingsSchema.optional(),
    bookmarks: z.array(UserBookmarkSchema).optional()
});

/**
 * Type export for the main User entity
 */
export type User = z.infer<typeof UserSchema>;

/**
 * READ-side overlay for the user name fields (HOS-302).
 *
 * `display_name`, `first_name` and `last_name` are unbounded `text` columns, and
 * rows reach them without ever passing the create/update Zod schemas — Better
 * Auth signup writes the row directly, which is how production ended up with
 * users whose `display_name` is the empty string. `.optional()` does not rescue
 * that: the key is present, it is just empty, so `.min(2)` fires.
 *
 * Read schemas therefore validate the TYPE and leave the LENGTH to the write
 * path, keeping read ⊇ write. Bounds stay on {@link UserSchema}, which the
 * create/update schemas inherit.
 *
 * @see HOS-190, which introduced this same leniency inline on `UserPublicSchema`
 *   but only for the access family.
 * @see HOS-300 for the same two-read-family gap on event locations.
 */
export const UserNameReadFields = {
    displayName: z.string().nullish(),
    firstName: z.string().nullish(),
    lastName: z.string().nullish()
} as const;

/** Shape of {@link UserNameReadFields}, for consumers composing read schemas. */
export type UserNameReadFieldsType = typeof UserNameReadFields;

/**
 * READ-side variant of {@link UserSchema} (HOS-302).
 *
 * Identical shape, with the name-field length bounds dropped. Every read schema
 * derived from the full user entity — notably the query family consumed by the
 * admin entity-list client, whose `safeParse` is fail-closed and THROWS — must
 * derive from this rather than from `UserSchema`. Deriving a read schema from
 * the strict base is what took the admin users list down.
 */
export const UserReadSchema = UserSchema.extend({
    ...UserNameReadFields
});

/** Inferred type for the read-side user entity. */
export type UserRead = z.infer<typeof UserReadSchema>;
