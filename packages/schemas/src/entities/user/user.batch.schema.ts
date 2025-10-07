import { z } from 'zod';
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
 * Batch response schema for user operations
 * Returns an array of users or null for missing/inaccessible users
 *
 * @example
 * ```typescript
 * const response = [
 *   { id: 'user_123', firstName: 'John', lastName: 'Doe' },
 *   null, // user not found or not accessible
 *   { id: 'user_789', firstName: 'Jane', lastName: 'Smith' }
 * ];
 * ```
 */
export const UserBatchResponseSchema = z.array(
    UserSchema.nullable().describe('User data or null if not found/accessible')
);

// Type exports for TypeScript usage
export type UserBatchRequest = z.infer<typeof UserBatchRequestSchema>;
export type UserBatchResponse = z.infer<typeof UserBatchResponseSchema>;
