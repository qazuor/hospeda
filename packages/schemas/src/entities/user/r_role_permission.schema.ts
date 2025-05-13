import { z } from 'zod';

/**
 * Zod schema role/premission relationship.
 */
export const RolePermissionRelationSchema = z.object({
    permissionId: z.string().uuid({ message: 'error:user.role_permission.permissionId.invalid' }),
    roleId: z.string().uuid({ message: 'error:user.role_permission.roleId.invalid' })
});

export type RolePermissionRelationInput = z.infer<typeof RolePermissionRelationSchema>;
