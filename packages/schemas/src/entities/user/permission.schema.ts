import { PermissionEnum } from '@repo/types';
import { z } from 'zod';
import { UserIdSchema } from '../../common/id.schema.js';

/**
 * Zod schema for the assignment of a permission to a user.
 * The permission is referenced by its enum.
 */
export const UserPermissionAssignmentSchema = z.object({
    userId: UserIdSchema,
    permission: z.nativeEnum(PermissionEnum, {
        message: 'zodError.userPermission.permission.required'
    })
});

export type UserPermissionAssignment = z.infer<typeof UserPermissionAssignmentSchema>;
