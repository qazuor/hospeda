import type { UserId, UserType } from '@repo/types';
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
