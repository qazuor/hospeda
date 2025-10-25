import { z } from 'zod';
import { ClientSchema } from './client.schema.js';

/**
 * Batch request schema for client operations
 * Used for retrieving multiple clients by their IDs
 *
 * @example
 * ```typescript
 * const request = {
 *   ids: ['client_123', 'client_456', 'client_789'],
 *   fields: ['id', 'name', 'billingEmail'] // Optional field selection
 * };
 * ```
 */
export const ClientBatchRequestSchema = z.object({
    /**
     * Array of client IDs to retrieve
     * Limited to 100 IDs per request for performance
     */
    ids: z
        .array(z.string().uuid('Invalid client ID format'))
        .min(1, 'At least one client ID is required')
        .max(100, 'Maximum 100 client IDs allowed per request'),

    /**
     * Optional array of field names to include in the response
     * If not provided, all fields will be returned
     * Always includes 'id' and 'name' for entity selectors to work
     */
    fields: z.array(z.string().min(1, 'Field name cannot be empty')).optional(),

    /**
     * Optional relations to include in the response
     */
    includeUser: z.boolean().default(false),
    includeSubscriptions: z.boolean().default(false),
    includeAccessRights: z.boolean().default(false)
});

/**
 * Batch response schema for client operations
 * Returns an array of clients or null for not found items
 *
 * @example
 * ```typescript
 * const response = [
 *   { id: 'client_123', name: 'ABC Corp', billingEmail: 'billing@abc.com', ... },
 *   null, // client_456 not found
 *   { id: 'client_789', name: 'XYZ Ltd', billingEmail: 'billing@xyz.com', ... }
 * ];
 * ```
 */
export const ClientBatchResponseSchema = z.array(ClientSchema.nullable());

/**
 * Batch create request schema for client operations
 * Used for creating multiple clients in a single request
 */
export const ClientBatchCreateRequestSchema = z.object({
    /**
     * Array of client creation data
     * Limited to 50 clients per request for performance
     */
    clients: z
        .array(
            ClientSchema.omit({
                id: true,
                createdAt: true,
                updatedAt: true,
                createdById: true,
                updatedById: true,
                deletedAt: true,
                deletedById: true,
                adminInfo: true
            })
        )
        .min(1, 'At least one client is required')
        .max(50, 'Maximum 50 clients allowed per batch create request'),

    /**
     * Optional batch settings
     */
    continueOnError: z.boolean().default(false), // Whether to continue processing if one client fails
    validateOnly: z.boolean().default(false) // Only validate without creating
});

/**
 * Batch create response schema for client operations
 */
export const ClientBatchCreateResponseSchema = z.object({
    /**
     * Array of created clients or error objects
     */
    results: z.array(
        z.union([
            ClientSchema, // Successfully created client
            z.object({
                error: z.string(),
                index: z.number().int().min(0), // Index in the original request array
                input: z.record(z.string(), z.any()) // The input data that failed
            })
        ])
    ),

    /**
     * Summary statistics
     */
    summary: z.object({
        total: z.number().int().min(0),
        successful: z.number().int().min(0),
        failed: z.number().int().min(0)
    })
});

/**
 * Batch update request schema for client operations
 * Used for updating multiple clients in a single request
 */
export const ClientBatchUpdateRequestSchema = z.object({
    /**
     * Array of client update operations
     * Limited to 50 updates per request for performance
     */
    updates: z
        .array(
            z.object({
                id: z.string().uuid('Invalid client ID format'),
                data: ClientSchema.omit({
                    id: true,
                    createdAt: true,
                    updatedAt: true,
                    createdById: true,
                    updatedById: true,
                    deletedAt: true,
                    deletedById: true,
                    adminInfo: true
                }).partial()
            })
        )
        .min(1, 'At least one update is required')
        .max(50, 'Maximum 50 updates allowed per batch request'),

    /**
     * Optional batch settings
     */
    continueOnError: z.boolean().default(false), // Whether to continue processing if one update fails
    validateOnly: z.boolean().default(false) // Only validate without updating
});

/**
 * Batch update response schema for client operations
 */
export const ClientBatchUpdateResponseSchema = z.object({
    /**
     * Array of updated clients or error objects
     */
    results: z.array(
        z.union([
            ClientSchema, // Successfully updated client
            z.object({
                error: z.string(),
                id: z.string().uuid(), // The client ID that failed to update
                input: z.record(z.string(), z.any()) // The input data that failed
            })
        ])
    ),

    /**
     * Summary statistics
     */
    summary: z.object({
        total: z.number().int().min(0),
        successful: z.number().int().min(0),
        failed: z.number().int().min(0)
    })
});

/**
 * Batch delete request schema for client operations
 * Used for soft-deleting multiple clients in a single request
 */
export const ClientBatchDeleteRequestSchema = z.object({
    /**
     * Array of client IDs to delete
     * Limited to 50 IDs per request for performance
     */
    ids: z
        .array(z.string().uuid('Invalid client ID format'))
        .min(1, 'At least one client ID is required')
        .max(50, 'Maximum 50 client IDs allowed per batch delete request'),

    /**
     * Optional batch settings
     */
    continueOnError: z.boolean().default(false), // Whether to continue processing if one delete fails
    hardDelete: z.boolean().default(false) // Whether to hard delete (permanent) or soft delete
});

/**
 * Batch delete response schema for client operations
 */
export const ClientBatchDeleteResponseSchema = z.object({
    /**
     * Array of deletion results
     */
    results: z.array(
        z.union([
            z.object({
                id: z.string().uuid(),
                success: z.literal(true),
                deletedAt: z.date()
            }),
            z.object({
                id: z.string().uuid(),
                success: z.literal(false),
                error: z.string()
            })
        ])
    ),

    /**
     * Summary statistics
     */
    summary: z.object({
        total: z.number().int().min(0),
        successful: z.number().int().min(0),
        failed: z.number().int().min(0)
    })
});

/**
 * Type definitions for batch operations
 */
export type ClientBatchRequest = z.infer<typeof ClientBatchRequestSchema>;
export type ClientBatchResponse = z.infer<typeof ClientBatchResponseSchema>;
export type ClientBatchCreateRequest = z.infer<typeof ClientBatchCreateRequestSchema>;
export type ClientBatchCreateResponse = z.infer<typeof ClientBatchCreateResponseSchema>;
export type ClientBatchUpdateRequest = z.infer<typeof ClientBatchUpdateRequestSchema>;
export type ClientBatchUpdateResponse = z.infer<typeof ClientBatchUpdateResponseSchema>;
export type ClientBatchDeleteRequest = z.infer<typeof ClientBatchDeleteRequestSchema>;
export type ClientBatchDeleteResponse = z.infer<typeof ClientBatchDeleteResponseSchema>;
