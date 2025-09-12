import { z } from 'zod';
import { UserIdSchema } from '../../common/id.schema.js';
import { PermissionEnumSchema, RoleEnumSchema } from '../../enums/index.js';
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
// AUTH PROVIDER SCHEMAS
// ============================================================================

/**
 * Schema for getting user by auth provider input
 * Used to find users by their external authentication provider mapping
 */
export const UserGetByAuthProviderInputSchema = z.object({
    provider: z
        .string({
            message: 'zodError.user.getByAuthProvider.provider.required'
        })
        .min(1, { message: 'zodError.user.getByAuthProvider.provider.min' }),
    providerUserId: z
        .string({
            message: 'zodError.user.getByAuthProvider.providerUserId.required'
        })
        .min(1, { message: 'zodError.user.getByAuthProvider.providerUserId.min' })
});

/**
 * Schema for getting user by auth provider output
 * Returns user or null if not found
 */
export const UserGetByAuthProviderOutputSchema = z.object({
    user: UserSchema.nullable()
});

/**
 * Schema for ensuring user from auth provider input
 * Creates or updates user based on auth provider data
 */
export const UserEnsureFromAuthProviderInputSchema = z.object({
    provider: z
        .string({
            message: 'zodError.user.ensureFromAuthProvider.provider.required'
        })
        .min(1, { message: 'zodError.user.ensureFromAuthProvider.provider.min' }),
    providerUserId: z
        .string({
            message: 'zodError.user.ensureFromAuthProvider.providerUserId.required'
        })
        .min(1, { message: 'zodError.user.ensureFromAuthProvider.providerUserId.min' }),
    profile: z
        .object({
            firstName: z.string().min(1).optional(),
            lastName: z.string().min(1).optional(),
            displayName: z.string().min(1).optional(),
            contactInfo: z
                .object({
                    personalEmail: z.string().email().optional(),
                    workEmail: z.string().email().optional(),
                    phone: z.string().optional(),
                    website: z.string().url().optional()
                })
                .optional(),
            profile: z
                .object({
                    avatar: z
                        .object({
                            url: z.string().url(),
                            alt: z.string().optional(),
                            width: z.number().int().positive().optional(),
                            height: z.number().int().positive().optional()
                        })
                        .optional(),
                    bio: z.string().max(500).optional(),
                    location: z.string().max(100).optional()
                })
                .optional()
        })
        .optional(),
    identities: z
        .array(
            z.object({
                provider: z.string().min(1),
                providerUserId: z.string().min(1),
                email: z.string().email().optional(),
                username: z.string().min(1).optional(),
                avatarUrl: z.string().url().optional(),
                raw: z.unknown().optional(),
                lastLoginAt: z.date().optional()
            })
        )
        .optional()
});

/**
 * Schema for ensuring user from auth provider output
 * Returns the created or updated user
 */
export const UserEnsureFromAuthProviderOutputSchema = z.object({
    user: UserSchema
});

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
export type UserGetByAuthProviderInput = z.infer<typeof UserGetByAuthProviderInputSchema>;
export type UserGetByAuthProviderOutput = z.infer<typeof UserGetByAuthProviderOutputSchema>;
export type UserEnsureFromAuthProviderInput = z.infer<typeof UserEnsureFromAuthProviderInputSchema>;
export type UserEnsureFromAuthProviderOutput = z.infer<
    typeof UserEnsureFromAuthProviderOutputSchema
>;
export type UserAssignRoleInput = z.infer<typeof UserAssignRoleInputSchema>;
export type UserAddPermissionInput = z.infer<typeof UserAddPermissionInputSchema>;
export type UserRemovePermissionInput = z.infer<typeof UserRemovePermissionInputSchema>;
export type UserSetPermissionsInput = z.infer<typeof UserSetPermissionsInputSchema>;
export type UserRolePermissionOutput = z.infer<typeof UserRolePermissionOutputSchema>;
