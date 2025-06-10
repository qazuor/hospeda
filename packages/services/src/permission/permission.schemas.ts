import { PermissionEnum, type UserType } from '@repo/types';
import { z } from 'zod';

/**
 * Zod schema for addPermissionToUser input.
 * Only admin can add permissions to users.
 * @example { id: 'user-123', permission: 'USER_CREATE' }
 */
export const addPermissionToUserInputSchema = z.object({
    id: z.string(), // UserId as string
    permission: z.nativeEnum(PermissionEnum)
});

/**
 * Type for addPermissionToUser input (RO-RO pattern).
 * @property id - The unique user ID (UserId branded type).
 * @property permission - The permission to add (PermissionEnum).
 */
export type AddPermissionToUserInput = z.infer<typeof addPermissionToUserInputSchema>;

/**
 * Type for addPermissionToUser output (RO-RO pattern).
 * @property user - The updated user object (without password), or null if not found.
 */
export type AddPermissionToUserOutput = {
    user: Omit<UserType, 'password'> | null;
};
