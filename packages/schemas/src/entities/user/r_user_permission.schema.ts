import { z } from 'zod';

/**
 * Zod schema for user/premission relationship.
 */
export const UserPermissionRelationSchema = z.object({
    permissionId: z.string().uuid({ message: 'error:user.user_permission.permissionId.invalid' }),
    userId: z.string().uuid({ message: 'error:user.user_permission.userId.invalid' })
});

export type UserPermissionRelationInput = z.infer<typeof UserPermissionRelationSchema>;
