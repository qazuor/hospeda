import { PermissionEnum, RoleEnum } from '@repo/types';
import { z } from 'zod';

/**
 * Zod schema for the assignment of a permission to a role.
 * Both role and permission are referenced by their enums.
 */
export const RolePermissionAssignmentSchema = z.object({
    role: z.nativeEnum(RoleEnum, { required_error: 'zodError.rolePermission.role.required' }),
    permission: z.nativeEnum(PermissionEnum, {
        required_error: 'zodError.rolePermission.permission.required'
    })
});
