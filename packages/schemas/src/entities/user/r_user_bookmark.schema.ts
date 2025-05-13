import { z } from 'zod';

/**
 * Zod schema for user/bookmark relationship.
 */
export const UserBookmarkRelationSchema = z.object({
    permissionId: z.string().uuid({ message: 'error:user.user_permission.permissionId.invalid' }),
    userId: z.string().uuid({ message: 'error:user.user_permission.userId.invalid' })
});

export type UserBookmarkRelationInput = z.infer<typeof UserBookmarkRelationSchema>;
