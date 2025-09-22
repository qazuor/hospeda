import { z } from 'zod';
import { PermissionEnumSchema } from '../../enums/permission.schema.js';
import { RoleEnumSchema } from '../../enums/role.schema.js';

/**
 * Zod schema for the assignment of a permission to a role.
 * Both role and permission are referenced by their enums.
 */
export const RolePermissionAssignmentSchema = z.object({
    role: RoleEnumSchema,
    permission: PermissionEnumSchema
});

/**
 * Type export for role-permission assignments
 */
export type RolePermissionAssignment = z.infer<typeof RolePermissionAssignmentSchema>;
