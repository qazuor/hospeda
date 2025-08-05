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
 */
export const paginationMetadataSchema = z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative()
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
 * Standard API response types
 */
export type ApiResponse<T = unknown> =
    | {
          success: true;
          data: T;
          metadata?: {
              timestamp: string;
              version?: string;
              requestId?: string;
              pagination?: {
                  page: number;
                  limit: number;
                  total: number;
                  totalPages: number;
              };
          };
      }
    | {
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
 * Pagination data type
 */
export type PaginationData = {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
};

/**
 * Helper function to create a success response
 */
export const createSuccessResponse = <T>(data: T, pagination?: PaginationData): ApiResponse<T> => {
    const response: ApiResponse<T> = {
        success: true,
        data
    };

    if (pagination) {
        response.metadata = {
            timestamp: new Date().toISOString(),
            pagination
        };
    }

    return response;
};

/**
 * Helper function to create an error response
 */
export const createErrorResponse = (
    code: string,
    message: string,
    details?: unknown
): ApiResponse => {
    return {
        success: false,
        error: {
            code,
            message,
            ...(details ? { details } : {})
        },
        metadata: {
            timestamp: new Date().toISOString()
        }
    };
};
