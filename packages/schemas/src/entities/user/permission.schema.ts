import type { UserId } from '@repo/types';
import { PermissionEnum } from '@repo/types';
import { z } from 'zod';

/**
 * Zod schema for the assignment of a permission to a user.
 * The permission is referenced by its enum.
 */
export const UserPermissionAssignmentSchema = z.object({
    userId: z.custom<UserId>(),
    permission: z.nativeEnum(PermissionEnum, {
        required_error: 'zodError.userPermission.permission.required'
    })
});
