import { LifecycleStatusEnum, RoleEnum, type UserId, type UserType } from '@repo/types';
import { z } from 'zod';

/**
 * Zod schema for getById input.
 * Note: UserId is a branded type, but for validation we use string. The service should cast to UserId as needed.
 * @example { id: 'user-123' }
 */
export const UserGetByIdInputSchema = z.object({
    id: z.string()
});

/**
 * Type for getById input (RO-RO pattern).
 * @property id - The unique user ID (UserId branded type).
 */
export type UserGetByIdInput = {
    id: UserId;
};

/**
 * Zod schema for getById output.
 * Note: The user schema is a placeholder; replace with the actual UserType schema if available.
 * @example { user: { id: 'user-123', ... } } or { user: null }
 */
export const UserGetByIdOutputSchema = z.object({
    user: z.object({}).nullable() // Placeholder, replace with UserType schema if available
});

/**
 * Type for getById output (RO-RO pattern).
 * @property user - The user object if found and accessible, or null otherwise.
 */
export type UserGetByIdOutput = {
    user: UserType | null;
};

/**
 * Zod schema for createUser input.
 * Only admin or system can create users.
 * @example { userName: 'newuser', password: 'secret', role: 'USER' }
 */
export const UserCreateInputSchema = z.object({
    userName: z.string().min(3, 'User name must be at least 3 characters'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    role: z.nativeEnum(RoleEnum),
    email: z.string().email('Invalid email').optional(),
    lifecycleState: z.nativeEnum(LifecycleStatusEnum).optional()
});

/**
 * Type for createUser input (RO-RO pattern).
 */
export type UserCreateInput = z.infer<typeof UserCreateInputSchema>;

/**
 * Zod schema for createUser output.
 * Returns the created user (without password).
 * @example { user: { id: 'user-123', userName: 'newuser', ... } }
 */
export const UserCreateOutputSchema = z.object({
    user: z.object({
        id: z.string(),
        userName: z.string(),
        role: z.nativeEnum(RoleEnum),
        email: z.string().email().optional(),
        lifecycleState: z.nativeEnum(LifecycleStatusEnum),
        createdAt: z.date(),
        updatedAt: z.date(),
        createdById: z.string(),
        updatedById: z.string()
    })
});

/**
 * Type for createUser output (RO-RO pattern).
 */
export type UserCreateOutput = z.infer<typeof UserCreateOutputSchema>;

/**
 * Zod schema for updateUser input.
 * Only admin or the user themselves can update.
 * @example { id: 'user-123', userName: 'newname', email: 'new@email.com' }
 */
export const UserUpdateInputSchema = z.object({
    id: z.string(),
    userName: z.string().min(3).optional(),
    password: z.string().min(8).optional(),
    email: z.string().email().optional(),
    role: z.nativeEnum(RoleEnum).optional(),
    lifecycleState: z.nativeEnum(LifecycleStatusEnum).optional()
});

/**
 * Type for updateUser input (RO-RO pattern).
 */
export type UserUpdateInput = z.infer<typeof UserUpdateInputSchema>;

/**
 * Zod schema for updateUser output.
 * Returns the updated user (without password).
 * @example { user: { id: 'user-123', userName: 'newname', ... } }
 */
export const UserUpdateOutputSchema = z.object({
    user: z.object({
        id: z.string(),
        userName: z.string(),
        role: z.nativeEnum(RoleEnum),
        email: z.string().email().optional(),
        lifecycleState: z.nativeEnum(LifecycleStatusEnum),
        createdAt: z.date(),
        updatedAt: z.date(),
        createdById: z.string(),
        updatedById: z.string()
    })
});

/**
 * Type for updateUser output (RO-RO pattern).
 */
export type UserUpdateOutput = z.infer<typeof UserUpdateOutputSchema>;

/**
 * Zod schema for softDeleteUser input.
 * Only admin can soft-delete users.
 * @example { id: 'user-123' }
 */
export const UserSoftDeleteInputSchema = z.object({
    id: z.string()
});

/**
 * Type for softDeleteUser input (RO-RO pattern).
 */
export type UserSoftDeleteInput = z.infer<typeof UserSoftDeleteInputSchema>;

/**
 * Zod schema for softDeleteUser output.
 * Returns the disabled user (without password).
 * @example { user: { id: 'user-123', lifecycleState: 'INACTIVE', ... } }
 */
export const UserSoftDeleteOutputSchema = z.object({
    user: z.object({
        id: z.string(),
        userName: z.string(),
        role: z.nativeEnum(RoleEnum),
        email: z.string().email().optional(),
        lifecycleState: z.nativeEnum(LifecycleStatusEnum),
        createdAt: z.date(),
        updatedAt: z.date(),
        createdById: z.string(),
        updatedById: z.string()
    })
});

/**
 * Type for softDeleteUser output (RO-RO pattern).
 */
export type UserSoftDeleteOutput = z.infer<typeof UserSoftDeleteOutputSchema>;

/**
 * Zod schema for restoreUser input.
 * Only admin can restore users.
 * @example { id: 'user-123' }
 */
export const UserRestoreInputSchema = z.object({
    id: z.string()
});

/**
 * Type for restoreUser input (RO-RO pattern).
 */
export type UserRestoreInput = z.infer<typeof UserRestoreInputSchema>;

/**
 * Zod schema for restoreUser output.
 * Returns the restored user (without password).
 * @example { user: { id: 'user-123', lifecycleState: 'ACTIVE', ... } }
 */
export const UserRestoreOutputSchema = z.object({
    user: z.object({
        id: z.string(),
        userName: z.string(),
        role: z.nativeEnum(RoleEnum),
        email: z.string().email().optional(),
        lifecycleState: z.nativeEnum(LifecycleStatusEnum),
        createdAt: z.date(),
        updatedAt: z.date(),
        createdById: z.string(),
        updatedById: z.string()
    })
});

/**
 * Type for restoreUser output (RO-RO pattern).
 */
export type UserRestoreOutput = z.infer<typeof UserRestoreOutputSchema>;

/**
 * Zod schema for hardDeleteUser input.
 * Only admin can hard-delete users.
 * @example { id: 'user-123' }
 */
export const UserHardDeleteInputSchema = z.object({
    id: z.string() // UserId as string
});

/**
 * Type for hardDeleteUser input (RO-RO pattern).
 * @property id - The unique user ID (UserId branded type).
 */
export type UserHardDeleteInput = z.infer<typeof UserHardDeleteInputSchema>;

/**
 * Type for hardDeleteUser output (RO-RO pattern).
 * @property user - The deleted user object (without password), or null if not found.
 */
export type UserHardDeleteOutput = {
    user: Omit<UserType, 'password'> | null;
};
