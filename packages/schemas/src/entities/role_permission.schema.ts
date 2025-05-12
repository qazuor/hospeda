import type { RolePermissionType } from '@repo/types';
import { z } from 'zod';

/**
 * Zod schema for role-permission relation (many-to-many).
 */
export const RolePermissionSchema: z.ZodType<RolePermissionType> = z.object({
    roleId: z.string().uuid({ message: 'error:rolePermission.roleIdInvalid' }),
    permissionId: z.string().uuid({ message: 'error:rolePermission.permissionIdInvalid' })
});
