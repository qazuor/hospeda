/**
 * Standardized API response schemas
 * Provides consistent response structure across all endpoints
 */
import { z } from 'zod';

/**
 * Standard response metadata included in all API responses
 * Provides tracing and versioning information
 */
export const ResponseMetadataSchema = z.object({
    timestamp: z.string().datetime().describe('ISO 8601 timestamp when the response was generated'),
    requestId: z.string().optional().describe('Unique request identifier for tracing'),
    version: z.string().optional().describe('API version that handled the request')
});

export type ResponseMetadata = z.infer<typeof ResponseMetadataSchema>;

/**
 * Pagination metadata for list responses
 * Provides comprehensive pagination state information
 */
export const PaginationMetadataSchema = z.object({
    page: z.number().int().positive().describe('Current page number (1-based)'),
    pageSize: z.number().int().positive().describe('Number of items per page'),
    total: z.number().int().nonnegative().describe('Total number of items available'),
    totalPages: z.number().int().nonnegative().describe('Total number of pages available'),
    hasNextPage: z.boolean().describe('Whether there is a next page available'),
    hasPreviousPage: z.boolean().describe('Whether there is a previous page available')
});

export type PaginationMetadata = z.infer<typeof PaginationMetadataSchema>;

/**
 * Factory function for creating paginated response schemas
 * Ensures consistent paginated response structure across all entities
 *
 * @param itemSchema - The schema for individual items in the list
 * @returns A schema for paginated responses containing the specified items
 */
export const createPaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
    z.object({
        success: z.literal(true),
        data: z.object({
            items: z.array(itemSchema),
            pagination: PaginationMetadataSchema
        }),
        metadata: ResponseMetadataSchema.optional()
    });

/**
 * Factory function for creating single item response schemas
 * Standard wrapper for individual entity responses
 *
 * @param itemSchema - The schema for the response data
 * @returns A schema for single item responses
 */
export const createSingleItemResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
    z.object({
        success: z.literal(true),
        data: itemSchema,
        metadata: ResponseMetadataSchema.optional()
    });

/**
 * Standard error response schema
 * Consistent error structure for all API endpoints
 */
export const ErrorResponseSchema = z.object({
    success: z.literal(false),
    error: z.object({
        code: z.string().describe('Machine-readable error code'),
        message: z.string().describe('Human-readable error message'),
        details: z.unknown().optional().describe('Additional error context and details')
    }),
    metadata: ResponseMetadataSchema.optional()
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Factory for creating operation result schemas
 * Used for create/update/delete operations that return counts or IDs
 *
 * @param resultSchema - Schema for the operation result data
 * @returns Schema for operation result responses
 */
export const createOperationResultSchema = <T extends z.ZodTypeAny>(resultSchema: T) =>
    z.object({
        success: z.literal(true),
        data: resultSchema,
        metadata: ResponseMetadataSchema.optional()
    });

/**
 * Standard success response for operations without data
 * Used for delete operations, status changes, etc.
 */
export const SuccessResponseSchema = z.object({
    success: z.literal(true),
    message: z.string().optional().describe('Optional success message'),
    metadata: ResponseMetadataSchema.optional()
});

export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;

/**
 * Factory for creating data response schemas with metadata
 * Used for health checks, metrics, and other endpoints that return data with metadata
 *
 * @param dataSchema - Schema for the response data
 * @returns Schema for responses with success, data, and metadata
 */
export const createDataResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
    z.object({
        success: z.boolean(),
        data: dataSchema,
        metadata: ResponseMetadataSchema
    });

/**
 * Factory for creating simple data response schemas
 * Used for endpoints that return structured data without complex metadata
 *
 * @param dataSchema - Schema for the response data
 * @returns Schema for responses with success and data
 */
export const createSimpleDataResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
    z.object({
        success: z.boolean(),
        data: dataSchema
    });
