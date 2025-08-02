import { PermissionEnum, RoleEnum } from '@repo/types';
import { z } from 'zod';

/**
 * Zod schema for the assignment of a permission to a role.
 * Both role and permission are referenced by their enums.
 */
export const RolePermissionAssignmentSchema = z.object({
    role: z.nativeEnum(RoleEnum, { message: 'zodError.rolePermission.role.required' }),
    permission: z.nativeEnum(PermissionEnum, {
        message: 'zodError.rolePermission.permission.required'
    })
});
