import { LifecycleStatusEnum, RoleEnum, type UserId, type UserType } from '@repo/types';
import { z } from 'zod';

/**
 * Zod schema for getById input.
 * Note: UserId is a branded type, but for validation we use string. The service should cast to UserId as needed.
 * @example { id: 'user-123' }
 */
export const getByIdInputSchema = z.object({
    id: z.string()
});

/**
 * Type for getById input (RO-RO pattern).
 * @property id - The unique user ID (UserId branded type).
 */
export type GetByIdInput = {
    id: UserId;
};

/**
 * Zod schema for getById output.
 * Note: The user schema is a placeholder; replace with the actual UserType schema if available.
 * @example { user: { id: 'user-123', ... } } or { user: null }
 */
export const getByIdOutputSchema = z.object({
    user: z.object({}).nullable() // Placeholder, replace with UserType schema if available
});

/**
 * Type for getById output (RO-RO pattern).
 * @property user - The user object if found and accessible, or null otherwise.
 */
export type GetByIdOutput = {
    user: UserType | null;
};

/**
 * Zod schema for createUser input.
 * Only admin or system can create users.
 * @example { userName: 'newuser', password: 'secret', role: 'USER' }
 */
export const createUserInputSchema = z.object({
    userName: z.string().min(3, 'User name must be at least 3 characters'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    role: z.nativeEnum(RoleEnum),
    email: z.string().email('Invalid email').optional(),
    lifecycleState: z.nativeEnum(LifecycleStatusEnum).optional()
});

/**
 * Type for createUser input (RO-RO pattern).
 */
export type CreateUserInput = z.infer<typeof createUserInputSchema>;

/**
 * Zod schema for createUser output.
 * Returns the created user (without password).
 * @example { user: { id: 'user-123', userName: 'newuser', ... } }
 */
export const createUserOutputSchema = z.object({
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
export type CreateUserOutput = z.infer<typeof createUserOutputSchema>;

/**
 * Zod schema for updateUser input.
 * Only admin or the user themselves can update.
 * @example { id: 'user-123', userName: 'newname', email: 'new@email.com' }
 */
export const updateUserInputSchema = z.object({
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
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

/**
 * Zod schema for updateUser output.
 * Returns the updated user (without password).
 * @example { user: { id: 'user-123', userName: 'newname', ... } }
 */
export const updateUserOutputSchema = z.object({
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
export type UpdateUserOutput = z.infer<typeof updateUserOutputSchema>;
