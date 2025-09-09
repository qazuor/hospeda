import { z } from 'zod';
import { UserIdSchema } from '../../common/id.schema.js';
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
 * Omits auto-generated fields and makes all fields partial
 */
export const UserUpdateInputSchema = UserSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
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
 * Requires current and new password
 */
export const UserPasswordChangeInputSchema = z.object({
    id: UserIdSchema,
    currentPassword: z
        .string({
            message: 'zodError.user.passwordChange.currentPassword.required'
        })
        .min(1, { message: 'zodError.user.passwordChange.currentPassword.min' }),
    newPassword: z
        .string({
            message: 'zodError.user.passwordChange.newPassword.required'
        })
        .min(8, { message: 'zodError.user.passwordChange.newPassword.min' })
        .max(128, { message: 'zodError.user.passwordChange.newPassword.max' })
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
            message: 'zodError.user.passwordChange.newPassword.pattern'
        })
});

/**
 * Schema for password reset input
 * Requires only user ID (admin operation)
 */
export const UserPasswordResetInputSchema = z.object({
    id: UserIdSchema,
    newPassword: z
        .string({
            message: 'zodError.user.passwordReset.newPassword.required'
        })
        .min(8, { message: 'zodError.user.passwordReset.newPassword.min' })
        .max(128, { message: 'zodError.user.passwordReset.newPassword.max' })
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
            message: 'zodError.user.passwordReset.newPassword.pattern'
        })
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
