import { z } from 'zod';
import { ClientAccessRightSchema } from './client-access-right.schema.js';

/**
 * Batch request schema for client access right operations
 * Used for retrieving multiple client access rights by their IDs
 */
export const ClientAccessRightBatchRequestSchema = z.object({
    /**
     * Array of client access right IDs to retrieve
     * Limited to 100 IDs per request for performance
     */
    ids: z
        .array(z.string().uuid('Invalid client access right ID format'))
        .min(1, 'At least one client access right ID is required')
        .max(100, 'Maximum 100 client access right IDs allowed per request'),

    /**
     * Optional array of field names to include in the response
     * If not provided, all fields will be returned
     */
    fields: z.array(z.string().min(1, 'Field name cannot be empty')).optional(),

    /**
     * Optional relations to include in the response
     */
    includeClient: z.boolean().default(false),
    includeSubscriptionItem: z.boolean().default(false),
    includeSubscription: z.boolean().default(false),
    includeAuditInfo: z.boolean().default(false),

    /**
     * Validity filtering options
     */
    onlyActive: z.boolean().default(false), // Only return currently valid access rights
    includeExpired: z.boolean().default(true) // Include expired access rights
});

/**
 * Batch response schema for client access right operations
 * Returns an array of client access rights or null for not found items
 */
export const ClientAccessRightBatchResponseSchema = z.array(ClientAccessRightSchema.nullable());

/**
 * Batch create request schema for client access right operations
 * Used for creating multiple client access rights in a single request
 */
export const ClientAccessRightBatchCreateRequestSchema = z.object({
    /**
     * Array of client access right creation data
     * Limited to 50 access rights per request for performance
     */
    clientAccessRights: z
        .array(
            ClientAccessRightSchema.omit({
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
        .min(1, 'At least one client access right is required')
        .max(50, 'Maximum 50 client access rights allowed per batch create request'),

    /**
     * Optional batch settings
     */
    continueOnError: z.boolean().default(false), // Whether to continue processing if one fails
    validateOnly: z.boolean().default(false), // Only validate without creating
    skipDuplicates: z.boolean().default(false) // Skip if similar access right exists
});

/**
 * Batch create response schema for client access right operations
 */
export const ClientAccessRightBatchCreateResponseSchema = z.object({
    /**
     * Array of created client access rights or error objects
     */
    results: z.array(
        z.union([
            ClientAccessRightSchema, // Successfully created access right
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
        failed: z.number().int().min(0),
        skipped: z.number().int().min(0) // Due to duplicates
    })
});

/**
 * Batch update request schema for client access right operations
 * Used for updating multiple client access rights in a single request
 */
export const ClientAccessRightBatchUpdateRequestSchema = z.object({
    /**
     * Array of client access right update operations
     * Limited to 50 updates per request for performance
     */
    updates: z
        .array(
            z.object({
                id: z.string().uuid('Invalid client access right ID format'),
                data: ClientAccessRightSchema.omit({
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
 * Batch update response schema for client access right operations
 */
export const ClientAccessRightBatchUpdateResponseSchema = z.object({
    /**
     * Array of updated client access rights or error objects
     */
    results: z.array(
        z.union([
            ClientAccessRightSchema, // Successfully updated access right
            z.object({
                error: z.string(),
                id: z.string().uuid(), // The access right ID that failed to update
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
 * Batch delete request schema for client access right operations
 * Used for soft-deleting multiple client access rights in a single request
 */
export const ClientAccessRightBatchDeleteRequestSchema = z.object({
    /**
     * Array of client access right IDs to delete
     * Limited to 50 IDs per request for performance
     */
    ids: z
        .array(z.string().uuid('Invalid client access right ID format'))
        .min(1, 'At least one client access right ID is required')
        .max(50, 'Maximum 50 client access right IDs allowed per batch delete request'),

    /**
     * Optional batch settings
     */
    continueOnError: z.boolean().default(false), // Whether to continue processing if one delete fails
    hardDelete: z.boolean().default(false), // Whether to hard delete (permanent) or soft delete
    reason: z.string().min(5).max(500).optional() // Reason for deletion
});

/**
 * Batch delete response schema for client access right operations
 */
export const ClientAccessRightBatchDeleteResponseSchema = z.object({
    /**
     * Array of deletion results
     */
    results: z.array(
        z.union([
            z.object({
                id: z.string().uuid(),
                success: z.literal(true),
                deletedAt: z.date(),
                hardDeleted: z.boolean()
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
 * Batch revoke request schema for client access right operations
 * Used for revoking multiple client access rights (sets validTo to current date)
 */
export const ClientAccessRightBatchRevokeRequestSchema = z.object({
    /**
     * Array of client access right IDs to revoke
     * Limited to 50 IDs per request for performance
     */
    ids: z
        .array(z.string().uuid('Invalid client access right ID format'))
        .min(1, 'At least one client access right ID is required')
        .max(50, 'Maximum 50 client access right IDs allowed per batch revoke request'),

    /**
     * Optional settings
     */
    reason: z.string().min(5).max(500).optional(), // Reason for revocation
    effectiveDate: z.coerce.date().optional(), // When the revocation takes effect (defaults to now)
    continueOnError: z.boolean().default(false)
});

/**
 * Batch revoke response schema for client access right operations
 */
export const ClientAccessRightBatchRevokeResponseSchema = z.object({
    /**
     * Array of revocation results
     */
    results: z.array(
        z.union([
            z.object({
                id: z.string().uuid(),
                success: z.literal(true),
                revokedAt: z.date(),
                newValidTo: z.date()
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
export type ClientAccessRightBatchRequest = z.infer<typeof ClientAccessRightBatchRequestSchema>;
export type ClientAccessRightBatchResponse = z.infer<typeof ClientAccessRightBatchResponseSchema>;
export type ClientAccessRightBatchCreateRequest = z.infer<
    typeof ClientAccessRightBatchCreateRequestSchema
>;
export type ClientAccessRightBatchCreateResponse = z.infer<
    typeof ClientAccessRightBatchCreateResponseSchema
>;
export type ClientAccessRightBatchUpdateRequest = z.infer<
    typeof ClientAccessRightBatchUpdateRequestSchema
>;
export type ClientAccessRightBatchUpdateResponse = z.infer<
    typeof ClientAccessRightBatchUpdateResponseSchema
>;
export type ClientAccessRightBatchDeleteRequest = z.infer<
    typeof ClientAccessRightBatchDeleteRequestSchema
>;
export type ClientAccessRightBatchDeleteResponse = z.infer<
    typeof ClientAccessRightBatchDeleteResponseSchema
>;
export type ClientAccessRightBatchRevokeRequest = z.infer<
    typeof ClientAccessRightBatchRevokeRequestSchema
>;
export type ClientAccessRightBatchRevokeResponse = z.infer<
    typeof ClientAccessRightBatchRevokeResponseSchema
>;
