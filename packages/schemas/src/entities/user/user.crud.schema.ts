import { z } from 'zod';
import { UserIdSchema } from '../../common/id.schema.js';
import { StrongPasswordSchema } from '../../common/password.schema.js';
import { PermissionEnumSchema, RoleEnumSchema } from '../../enums/index.js';
import { ModerationStatusEnumSchema } from '../../enums/moderation-status.schema.js';
import { UserSchema } from './user.schema.js';

/**
 * User CRUD Schemas
 *
 * This file contains all schemas related to CRUD operations for users:
 * - Create (input/output)
 * - Update (input/output)
 * - Patch (input)
 * - Delete (input/output)
 * - Restore (input/output)
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
export const UserCreateOutputSchema = UserSchema;

// ============================================================================
// UPDATE SCHEMAS
// ============================================================================

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
 * (`permissions`, which has no column on `users` anyway). `role` is kept: it
 * has no default (so it is never re-injected) and the admin PUT/PATCH routes
 * legitimately change it through this schema.
 */
export const UserUpdateInputSchema = UserSchema.omit({
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
    permissions: true,
    banned: true,
    banReason: true,
    banExpires: true
}).partial();

/**
 * Schema for partial user updates (PATCH)
 * Same as update but explicitly named for clarity
 */
export const UserPatchInputSchema = UserUpdateInputSchema;

/**
 * Schema for user update response
 * Returns the complete updated user object
 */
export const UserUpdateOutputSchema = UserSchema;

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
export const UserRestoreOutputSchema = UserSchema;

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
export const UserActivationOutputSchema = UserSchema;

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
export const UserUpdateAvatarOutputSchema = UserSchema;

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
 */
export const UserAssignRoleInputSchema = z.object({
    userId: UserIdSchema,
    role: RoleEnumSchema
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
    user: UserSchema
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
