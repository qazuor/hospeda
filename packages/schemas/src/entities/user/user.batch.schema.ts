import { z } from 'zod';
import { UserPublicSchema } from './user.access.schema.js';
import { UserSchema } from './user.schema.js';

/**
 * Batch request schema for user operations
 * Used for retrieving multiple users by their IDs
 *
 * @example
 * ```typescript
 * const request = {
 *   ids: ['user_123', 'user_456', 'user_789'],
 *   fields: ['id', 'firstName', 'lastName', 'displayName'] // Optional field selection
 * };
 * ```
 */
export const UserBatchRequestSchema = z.object({
    /**
     * Array of user IDs to retrieve
     * Limited to 100 IDs per request for performance
     */
    ids: z
        .array(z.string().min(1, 'User ID cannot be empty'))
        .min(1, 'At least one user ID is required')
        .max(100, 'Maximum 100 user IDs allowed per request'),

    /**
     * Optional array of field names to include in the response
     * If not provided, all fields will be returned
     * Always includes 'id' and basic user info for entity selectors to work
     */
    fields: z
        .array(z.string())
        .optional()
        .describe('Optional field selection for response optimization')
});

/**
 * Public batch response schema for user operations
 * Returns an array of public user data or null for missing/inaccessible users.
 * Only exposes safe public fields (id, displayName, firstName, lastName, slug, avatarUrl, role).
 */
export const UserPublicBatchResponseSchema = z.array(
    UserPublicSchema.nullable().describe('Public user data or null if not found/accessible')
);

/**
 * Admin batch response schema for user operations
 * Returns full user data including sensitive fields. Only for admin endpoints.
 */
export const UserBatchResponseSchema = z.array(
    UserSchema.nullable().describe('User data or null if not found/accessible')
);

// Type exports for TypeScript usage
export type UserBatchRequest = z.infer<typeof UserBatchRequestSchema>;
export type UserPublicBatchResponse = z.infer<typeof UserPublicBatchResponseSchema>;
export type UserBatchResponse = z.infer<typeof UserBatchResponseSchema>;
