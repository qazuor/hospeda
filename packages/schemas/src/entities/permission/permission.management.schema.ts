import { z } from 'zod';
import { AssignmentResultSchema, RemovalResultSchema } from '../../api/result.schema.js';
import { UserIdSchema } from '../../common/id.schema.js';
import { PermissionEffectEnum } from '../../enums/permission-effect.enum.js';
import { PermissionEnumSchema } from '../../enums/permission.schema.js';
import { RoleEnumSchema } from '../../enums/role.schema.js';

// ============================================================================
// RESULT SCHEMAS - Permission-specific list responses
// ============================================================================

/**
 * Permissions list response schema
 * Use for endpoints that return a list of permissions.
 */
export const PermissionsListResultSchema = z.object({
    permissions: z.array(PermissionEnumSchema)
});

export type PermissionsListResult = z.infer<typeof PermissionsListResultSchema>;

/**
 * Roles list response schema
 * Use for endpoints that return a list of roles.
 */
export const RolesListResultSchema = z.object({
    roles: z.array(RoleEnumSchema)
});

export type RolesListResult = z.infer<typeof RolesListResultSchema>;

/**
 * Users list response schema
 * Use for endpoints that return a list of user IDs.
 */
export const UsersListResultSchema = z.object({
    users: z.array(UserIdSchema)
});

export type UsersListResult = z.infer<typeof UsersListResultSchema>;

// ============================================================================
// PERMISSION EFFECT
// ============================================================================

/**
 * Direction of a per-user permission override.
 *
 * - `grant`: adds the permission to the user on top of their role.
 * - `deny`: subtracts a role-granted permission from a single user
 *   (deny wins over grant at auth resolution; see `actor.ts`).
 *
 * Derived from {@link PermissionEffectEnum}, the single source of truth shared
 * with the `permission_effect_enum` pg enum (`@repo/db`) and the
 * `user_permission.effect` column (SPEC-170).
 */
export const PermissionEffectSchema = z.nativeEnum(PermissionEffectEnum, {
    error: () => ({ message: 'zodError.enums.permissionEffect.invalid' })
});

// ============================================================================
// PERMISSION ASSIGNMENT SCHEMAS
// ============================================================================

/**
 * Schema for assigning/removing permissions to/from roles
 * Used for role-permission management operations
 */
export const RolePermissionManagementInputSchema = z
    .object({
        role: RoleEnumSchema,
        permission: PermissionEnumSchema
    })
    .strict();

/**
 * Schema for assigning/removing permissions to/from users
 * Used for user-permission management operations.
 *
 * `effect` is optional and defaults to `'grant'` for backward compatibility
 * with callers that only manage additive overrides (SPEC-170).
 */
export const UserPermissionManagementInputSchema = z
    .object({
        userId: UserIdSchema,
        permission: PermissionEnumSchema,
        effect: PermissionEffectSchema.optional().default(PermissionEffectEnum.GRANT)
    })
    .strict();

// ============================================================================
// PERMISSION QUERY SCHEMAS
// ============================================================================

/**
 * Schema for querying permissions by role
 * Used to get all permissions assigned to a specific role
 */
export const PermissionsByRoleInputSchema = z
    .object({
        role: RoleEnumSchema
    })
    .strict();

/**
 * Schema for querying permissions by user
 * Used to get all permissions assigned to a specific user
 */
export const PermissionsByUserInputSchema = z
    .object({
        userId: UserIdSchema
    })
    .strict();

/**
 * Schema for querying roles by permission
 * Used to get all roles that have a specific permission
 */
export const RolesByPermissionInputSchema = z
    .object({
        permission: PermissionEnumSchema
    })
    .strict();

/**
 * Schema for querying users by permission
 * Used to get all users that have a specific permission
 */
export const UsersByPermissionInputSchema = z
    .object({
        permission: PermissionEnumSchema
    })
    .strict();

// ============================================================================
// OUTPUT SCHEMAS
// ============================================================================

/**
 * Schema for permission assignment operation results
 * Returns whether the assignment was successful
 */
export const PermissionAssignmentOutputSchema = AssignmentResultSchema;

/**
 * Schema for permission removal operation results
 * Returns whether the removal was successful
 */
export const PermissionRemovalOutputSchema = RemovalResultSchema;

/**
 * Schema for permissions list query results
 * Returns a list of permissions
 */
export const PermissionsQueryOutputSchema = PermissionsListResultSchema;

/**
 * Schema for roles list query results
 * Returns a list of roles
 */
export const RolesQueryOutputSchema = RolesListResultSchema;

/**
 * Schema for users list query results
 * Returns a list of user IDs
 */
export const UsersQueryOutputSchema = UsersListResultSchema;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type PermissionEffect = z.infer<typeof PermissionEffectSchema>;
export type RolePermissionManagementInput = z.infer<typeof RolePermissionManagementInputSchema>;
// Use the INPUT type so `effect` is optional for callers (it defaults to `'grant'`
// at validation time). The service `execute` still receives the parsed OUTPUT shape
// with `effect` always present. removePermissionFromUser reuses this and ignores effect.
export type UserPermissionManagementInput = z.input<typeof UserPermissionManagementInputSchema>;
export type PermissionsByRoleInput = z.infer<typeof PermissionsByRoleInputSchema>;
export type PermissionsByUserInput = z.infer<typeof PermissionsByUserInputSchema>;
export type RolesByPermissionInput = z.infer<typeof RolesByPermissionInputSchema>;
export type UsersByPermissionInput = z.infer<typeof UsersByPermissionInputSchema>;
export type PermissionAssignmentOutput = z.infer<typeof PermissionAssignmentOutputSchema>;
export type PermissionRemovalOutput = z.infer<typeof PermissionRemovalOutputSchema>;
export type PermissionsQueryOutput = z.infer<typeof PermissionsQueryOutputSchema>;
export type RolesQueryOutput = z.infer<typeof RolesQueryOutputSchema>;
export type UsersQueryOutput = z.infer<typeof UsersQueryOutputSchema>;
