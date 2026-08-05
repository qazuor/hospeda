import { z } from 'zod';
import { UserIdSchema } from '../../common/id.schema.js';
import { StrongPasswordSchema } from '../../common/password.schema.js';
import { PermissionEnumSchema } from '../../enums/index.js';
import { ModerationStatusEnumSchema } from '../../enums/moderation-status.schema.js';
import { stripShapeDefaults } from '../../utils/utils.js';
import { UserReadSchema, UserSchema } from './user.schema.js';
import { UserSettingsPatchSchema } from './user.settings.schema.js';
import { AssignableRoleEnumSchema } from './user-role.schema.js';

/**
 * User CRUD Schemas
 *
 * This file contains all schemas related to CRUD operations for users:
 * - Create (input/output)
 * - Update (input/output)
 * - Patch (input)
 * - Delete (input/output)
 * - Restore (input/output)
 *
 * HOS-302 direction rule: `*InputSchema` derives from the strict `UserSchema`
 * (it gates persistence and MUST keep its bounds); `*OutputSchema` derives from
 * `UserReadSchema`, because an output schema describes a row that already exists
 * — including rows Better Auth wrote without ever passing the write bounds.
 *
 * HOS-375 slug format rule — where it is NOT enforced, and why: these
 * create/update schemas are PUBLISHED, so adding a `regex` to `slug` here is a
 * narrowing, which the package's additive-only compatibility policy forbids
 * (`docs/guides/schema-compat-policy.md`). A caller that has been sending a
 * legal-but-non-conforming slug — a legacy row being re-saved, an admin form
 * round-tripping a value it read — would start getting a 400 on a field it did
 * not touch. The slug is also **derived**, not typed by a user, so rejecting is
 * the wrong response to a malformed one anyway.
 *
 * The pattern therefore lives in the SERVICE NORMALIZER
 * (`packages/service-core/src/services/user/user.normalizers.ts`), where a
 * non-conforming value is REPAIRED through `toSlug` instead of refused. Two
 * further layers already back that up: `apps/api/src/routes/user/public/getBySlug.ts`
 * validates the `:slug` PATH PARAM with the same regex, and
 * `packages/seed/src/data-migrations/0038-transliterate-user-slugs.ts` backfills
 * the rows that predate it.
 *
 * `UserSchema.slug` stays `.min(1)` for the separate reason that it is also the
 * READ shape (`UserAuthorPublicResponseSchema` reuses `UserSchema.shape.slug`
 * verbatim) and that route's `stripWithSchema` FAIL-CLOSES to HTTP 500 — a
 * tightened read shape would turn a legacy row's 404 into a 500 on a public page.
 */

// ============================================================================
// CREATE SCHEMAS
// ============================================================================

/**
 * Schema for creating a new user
 * Omits auto-generated fields like id and audit fields
 */
export const UserCreateInputSchema = UserSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

/**
 * Schema for user creation response
 * Returns the complete user object
 */
export const UserCreateOutputSchema = UserReadSchema;

// ============================================================================
// UPDATE SCHEMAS
// ============================================================================

// Zod 4 .partial() keeps .default(); strip them so absent keys = no change (SPEC-217).
/**
 * Schema for updating a user (PUT - complete replacement)
 * Omits auto-generated fields and makes all fields partial.
 *
 * SYSTEM FLAGS are also omitted. Several of these declare a Zod
 * `.default(false)` / `.default([])` on `UserSchema`; because the generic
 * `BaseCrudService.update` re-parses the input through this schema, a
 * `.partial()` update that omits them would have Zod RE-INJECT the default and
 * persist it — silently resetting `emailVerified`, `profileCompleted`,
 * `serviceSuspended`, etc. on every unrelated edit (e.g. a user changing their
 * display name would lose email verification and bounce back to onboarding).
 * None of these flags are written through the generic update path: each has a
 * dedicated writer — Better Auth (`emailVerified`, `banned`, `banReason`,
 * `banExpires`), `UserService.completeProfile` (`profileCompleted`),
 * `UserService.skip/markSetPassword` (`setPasswordPrompted`),
 * `setOwnerServiceSuspension` (`serviceSuspended`), and `PermissionService`
 * (`permissions`, which has no column on `users` anyway).
 *
 * `isSystemAccount` (HOS-375) joins the list for the same reason and with a
 * concrete failure of its own: it is written by the required user fixtures and
 * a one-off data-migration, never by a user edit, so leaving it settable here
 * would let an unrelated profile save re-inject `false` and quietly turn a
 * staff account back into a publicly indexable author page.
 *
 * `role` is not in this list because it is no longer on `UserSchema` at all
 * (HOS-296 G-8). It used to be explicitly KEPT here so the admin PUT/PATCH
 * routes could change it; role changes now go through the dedicated
 * grant/revoke endpoints, which are additive and audited. A scalar `role` on a
 * generic update is exactly the "replace the hat" write the multi-role model
 * exists to remove.
 *
 * `settings` is overridden with {@link UserSettingsPatchSchema} (HOS-375).
 * `stripShapeDefaults` walks only the TOP level of the shape, and `settings`
 * itself declares no default — the defaults live on its FIELDS, one level down,
 * where neither the strip nor `.partial()` reaches them. Read that schema's
 * JSDoc for the full failure it closes and for why removing a `.default()` from
 * a write-path patch shape is a widening, not a narrowing.
 */
export const UserUpdateInputSchema = z
    .object(
        // Zod 4 .partial() keeps .default(); strip them so absent keys = no change
        // (SPEC-217). This removes the remaining defaulted fields (lifecycleState,
        // visibility); the system flags below are omitted outright (see JSDoc).
        stripShapeDefaults(
            UserSchema.omit({
                id: true,
                createdAt: true,
                updatedAt: true,
                createdById: true,
                updatedById: true,
                deletedAt: true,
                deletedById: true,
                // System flags — never settable via a generic user update (see JSDoc).
                emailVerified: true,
                profileCompleted: true,
                setPasswordPrompted: true,
                serviceSuspended: true,
                isSystemAccount: true,
                permissions: true,
                banned: true,
                banReason: true,
                banExpires: true
            }).shape
        )
    )
    .extend({
        // `stripShapeDefaults` only walks the TOP level, and `settings` itself
        // carries no default — its FIELDS do. Left as `UserSettingsSchema`, a
        // one-key `settings` patch was expanded by Zod into all seven defaulted
        // keys before it ever reached the model, so the JSONB merge faithfully
        // overwrote every sibling (HOS-375). See `UserSettingsPatchSchema`.
        settings: UserSettingsPatchSchema.optional()
    })
    .partial();

/**
 * Schema for partial user updates (PATCH)
 * Same as update but explicitly named for clarity
 */
export const UserPatchInputSchema = UserUpdateInputSchema;

/**
 * Schema for user update response
 * Returns the complete updated user object
 */
export const UserUpdateOutputSchema = UserReadSchema;

// ============================================================================
// HTTP-LAYER FIELD OVERRIDES
// ============================================================================

/**
 * HTTP-layer override for `birthDate` on user write endpoints (BETA-34).
 *
 * The domain `UserSchema.birthDate` is `z.date().nullish()`. Left as-is on a
 * request body schema, the API route-factory's automatic `z.date()` →
 * `z.string().datetime()` OpenAPI conversion (`convertDateField` in
 * `apps/api/src/utils/openapi-schema.ts`) turns it into a full ISO-8601
 * datetime validator — which rejects the plain `YYYY-MM-DD` string every
 * `<input type="date">` submits (e.g. `"1990-05-15"` failed with
 * `Invalid ISO datetime`).
 *
 * Write routes that accept `birthDate` in the request body should override
 * the field with this schema (`.extend({ birthDate: BirthDateHttpInputSchema
 * })`) so Hono validates the wire format the client actually sends, then
 * convert the parsed value to a domain `Date` before calling the service —
 * see `withDomainBirthDate()` in `apps/api/src/utils/user-birth-date.ts`.
 *
 * Accepts:
 *   - `'YYYY-MM-DD'` — a valid calendar date string
 *   - `''` — the empty string, used by the web app to clear the field
 *   - `null` / `undefined` — no value / field not submitted
 */
export const BirthDateHttpInputSchema = z.union([z.literal(''), z.string().date()]).nullish();

// ============================================================================
// DELETE SCHEMAS
// ============================================================================

/**
 * Schema for user deletion input
 * Requires ID and optional force flag for hard delete
 */
export const UserDeleteInputSchema = z.object({
    id: UserIdSchema,
    force: z
        .boolean({
            message: 'zodError.user.delete.force.invalidType'
        })
        .optional()
        .default(false)
});

/**
 * Schema for user deletion response
 * Returns success status and deletion timestamp
 */
export const UserDeleteOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.user.delete.success.required'
        })
        .default(true),
    deletedAt: z
        .date({
            message: 'zodError.user.delete.deletedAt.invalidType'
        })
        .optional()
});

// ============================================================================
// RESTORE SCHEMAS
// ============================================================================

/**
 * Schema for user restoration input
 * Requires only the user ID
 */
export const UserRestoreInputSchema = z.object({
    id: UserIdSchema
});

/**
 * Schema for user restoration response
 * Returns the complete restored user object
 */
export const UserRestoreOutputSchema = UserReadSchema;

// ============================================================================
// ACTIVATION/DEACTIVATION SCHEMAS
// ============================================================================

/**
 * Schema for user activation input
 * Requires only the user ID
 */
export const UserActivateInputSchema = z.object({
    id: UserIdSchema
});

/**
 * Schema for user deactivation input
 * Requires user ID and optional reason
 */
export const UserDeactivateInputSchema = z.object({
    id: UserIdSchema,
    reason: z
        .string({
            message: 'zodError.user.deactivate.reason.invalidType'
        })
        .min(1, { message: 'zodError.user.deactivate.reason.min' })
        .max(500, { message: 'zodError.user.deactivate.reason.max' })
        .optional()
});

/**
 * Schema for user activation/deactivation response
 * Returns the updated user object
 */
export const UserActivationOutputSchema = UserReadSchema;

// ============================================================================
// PASSWORD SCHEMAS
// ============================================================================

/**
 * Schema for password change input
 * Requires current and new password.
 *
 * Uses `StrongPasswordSchema` as the single source of truth for password
 * complexity rules (min 8, max 128, uppercase, lowercase, digit, special char).
 */
export const UserPasswordChangeInputSchema = z.object({
    id: UserIdSchema,
    currentPassword: z
        .string({
            message: 'zodError.user.passwordChange.currentPassword.required'
        })
        .min(1, { message: 'zodError.user.passwordChange.currentPassword.min' }),
    newPassword: StrongPasswordSchema
});

/**
 * Schema for password reset input
 * Requires only user ID (admin operation).
 *
 * Uses `StrongPasswordSchema` as the single source of truth for password
 * complexity rules (min 8, max 128, uppercase, lowercase, digit, special char).
 */
export const UserPasswordResetInputSchema = z.object({
    id: UserIdSchema,
    newPassword: StrongPasswordSchema
});

/**
 * Schema for password operation response
 * Returns success status
 */
export const UserPasswordOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.user.password.success.required'
        })
        .default(true),
    message: z
        .string({
            message: 'zodError.user.password.message.invalidType'
        })
        .optional()
});

// ============================================================================
// AVATAR UPDATE SCHEMAS
// ============================================================================

/**
 * Schema for updating a user avatar with Cloudinary satellite metadata.
 * Used by UserService.updateAvatar to atomically set the image URL and
 * the three satellite columns (imagePublicId, imageModerationState, imageCaption).
 */
export const UserUpdateAvatarInputSchema = z.object({
    /** User whose avatar is being updated. */
    userId: UserIdSchema,
    /** Public URL of the new avatar (stored in the `image` column). */
    imageUrl: z.string().url({ message: 'zodError.user.image.invalidUrl' }),
    /** Cloudinary public_id for the uploaded asset (used for direct deletion). */
    imagePublicId: z.string().min(1, { message: 'zodError.user.imagePublicId.min' }),
    /** Moderation state returned by Cloudinary after upload. */
    imageModerationState: ModerationStatusEnumSchema,
    /** Optional human-readable caption for the avatar. */
    imageCaption: z.string().max(500, { message: 'zodError.user.imageCaption.max' }).optional()
});

/**
 * Output schema for the updateAvatar operation.
 * Returns the complete updated user.
 */
export const UserUpdateAvatarOutputSchema = UserReadSchema;

export type UserUpdateAvatarInput = z.infer<typeof UserUpdateAvatarInputSchema>;
export type UserUpdateAvatarOutput = z.infer<typeof UserUpdateAvatarOutputSchema>;

// ============================================================================
// AUTH PROVIDER SCHEMAS
// ============================================================================

// ============================================================================
// ROLE & PERMISSION MANAGEMENT SCHEMAS
// ============================================================================

/**
 * Schema for assigning role to user input
 * Requires user ID and new role
 *
 * HOS-296: `role` is an {@link AssignableRoleEnumSchema}, so `SYSTEM` and
 * `GUEST` are rejected — this is an HTTP-shaped input feeding
 * `UserService.assignRole`, which delegates straight to `grantRole`. The
 * primitive itself stays unrestricted because the seed needs to grant `SYSTEM`
 * to the reserved account, but it calls `grantRole` directly and never comes
 * through here.
 */
export const UserAssignRoleInputSchema = z.object({
    userId: UserIdSchema,
    role: AssignableRoleEnumSchema
});

/**
 * Schema for adding permission to user input
 * Requires user ID and permission to add
 */
export const UserAddPermissionInputSchema = z.object({
    userId: UserIdSchema,
    permission: PermissionEnumSchema
});

/**
 * Schema for removing permission from user input
 * Requires user ID and permission to remove
 */
export const UserRemovePermissionInputSchema = z.object({
    userId: UserIdSchema,
    permission: PermissionEnumSchema
});

/**
 * Schema for setting user permissions input
 * Requires user ID and array of permissions
 */
export const UserSetPermissionsInputSchema = z.object({
    userId: UserIdSchema,
    permissions: z
        .array(PermissionEnumSchema)
        .min(1, { message: 'zodError.user.setPermissions.permissions.min' })
});

/**
 * Schema for role and permission management output
 * Returns the updated user
 */
export const UserRolePermissionOutputSchema = z.object({
    user: UserReadSchema
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type UserCreateInput = z.infer<typeof UserCreateInputSchema>;
export type UserCreateOutput = z.infer<typeof UserCreateOutputSchema>;
export type UserUpdateInput = z.infer<typeof UserUpdateInputSchema>;
export type UserPatchInput = z.infer<typeof UserPatchInputSchema>;
export type UserUpdateOutput = z.infer<typeof UserUpdateOutputSchema>;
export type UserDeleteInput = z.infer<typeof UserDeleteInputSchema>;
export type UserDeleteOutput = z.infer<typeof UserDeleteOutputSchema>;
export type UserRestoreInput = z.infer<typeof UserRestoreInputSchema>;
export type UserRestoreOutput = z.infer<typeof UserRestoreOutputSchema>;
export type UserActivateInput = z.infer<typeof UserActivateInputSchema>;
export type UserDeactivateInput = z.infer<typeof UserDeactivateInputSchema>;
export type UserActivationOutput = z.infer<typeof UserActivationOutputSchema>;
export type UserPasswordChangeInput = z.infer<typeof UserPasswordChangeInputSchema>;
export type UserPasswordResetInput = z.infer<typeof UserPasswordResetInputSchema>;
export type UserPasswordOutput = z.infer<typeof UserPasswordOutputSchema>;
export type UserAssignRoleInput = z.infer<typeof UserAssignRoleInputSchema>;
export type UserAddPermissionInput = z.infer<typeof UserAddPermissionInputSchema>;
export type UserRemovePermissionInput = z.infer<typeof UserRemovePermissionInputSchema>;
export type UserSetPermissionsInput = z.infer<typeof UserSetPermissionsInputSchema>;
export type UserRolePermissionOutput = z.infer<typeof UserRolePermissionOutputSchema>;

// Avatar update types are already exported inline above the ROLE section.
