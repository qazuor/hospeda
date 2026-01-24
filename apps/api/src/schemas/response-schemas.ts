import { z } from '@hono/zod-openapi';

/**
 * Standard API response schemas
 * These schemas define the consistent response format across the API
 */

/**
 * Base success response schema
 */
export const successResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
    z.object({
        success: z.literal(true),
        data: dataSchema,
        metadata: z
            .object({
                timestamp: z.string().datetime(),
                version: z.string().optional(),
                requestId: z.string().optional()
            })
            .optional()
    });

/**
 * Base error response schema
 */
export const errorResponseSchema = z.object({
    success: z.literal(false),
    error: z.object({
        code: z.string(),
        message: z.string(),
        details: z.unknown().optional()
    }),
    metadata: z
        .object({
            timestamp: z.string().datetime(),
            version: z.string().optional(),
            requestId: z.string().optional()
        })
        .optional()
});

/**
 * Pagination metadata schema
 * Enhanced with hasNextPage/hasPreviousPage for better navigation
 */
export const paginationMetadataSchema = z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean()
});

/**
 * Paginated list response schema
 */
export const paginatedListResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
    z.object({
        success: z.literal(true),
        data: z.object({
            items: z.array(itemSchema),
            pagination: paginationMetadataSchema
        }),
        metadata: z
            .object({
                timestamp: z.string().datetime(),
                version: z.string().optional(),
                requestId: z.string().optional()
            })
            .optional()
    });

/**
 * Common HTTP status codes for responses
 */
export const httpStatusCodes = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
} as const;

/**
 * Common error codes for API responses
 */
export const apiErrorCodes = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    CONFLICT: 'CONFLICT',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
} as const;

/**
 * Success response type
 */
export type ApiSuccessResponse<T = unknown> = {
    success: true;
    data: T;
    metadata?: {
        timestamp: string;
        version?: string;
        requestId?: string;
        pagination?: PaginationData;
    };
};

/**
 * Error response type
 */
export type ApiErrorResponse = {
    success: false;
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
    metadata?: {
        timestamp: string;
        version?: string;
        requestId?: string;
    };
};

/**
 * Standard API response types (union of success and error)
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Pagination data type
 * Unified pagination type used across the API
 * Inferred from paginationMetadataSchema
 */
export type PaginationData = z.infer<typeof paginationMetadataSchema>;

/**
 * ============================================================================
 * RUNTIME HELPER FUNCTIONS
 * ============================================================================
 * For runtime response helpers that return c.json(), use:
 * - import { createResponse, createErrorResponse, createPaginatedResponse, ... } from '../utils/response-helpers';
 *
 * This file (response-schemas.ts) is for:
 * - Zod schemas for OpenAPI documentation
 * - Type definitions inferred from schemas
 * - HTTP status codes and error code constants
 * ============================================================================
 */
