import { z } from 'zod';

/**
 * Zod schema for user-permission relation (many-to-many).
 */
export const UserPermissionSchema = z.object({
    userId: z.string().uuid({ message: 'error:userPermission.userIdInvalid' }),
    permissionId: z.string().uuid({ message: 'error:userPermission.permissionIdInvalid' })
});
