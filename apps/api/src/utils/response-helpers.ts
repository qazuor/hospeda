/**
 * Response helpers for creating standardized API responses
 * Provides helper functions to create consistent responses across endpoints
 */

import { DbError } from '@repo/db/utils';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core/types';
import type { Context } from 'hono';
import { apiLogger } from './logger';

/**
 * Interface for pagination metadata
 * Uses pageSize for consistency with standard pagination patterns
 * Includes hasNextPage and hasPreviousPage for enhanced navigation
 */
export interface PaginationMetadata {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}

/**
 * Interface for paginated result structure
 */
export interface PaginatedResult {
    items: unknown[];
    pagination: PaginationMetadata;
}

/**
 * Interface for API response structure
 */
export interface ApiResponse<T = unknown> {
    success: true;
    data: T;
    metadata: {
        timestamp: string;
        requestId: string;
        total?: number;
        count?: number;
    };
}

/**
 * Interface for error response structure
 */
export interface ErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
    metadata: {
        timestamp: string;
        requestId: string;
    };
}

/**
 * Helper function to create standardized API responses
 * Reduces boilerplate and ensures consistency across endpoints
 */
export const createResponse = <T = unknown>(data: T, c: Context, statusCode = 200) => {
    const response: ApiResponse<T> = {
        success: true,
        data,
        metadata: {
            timestamp: new Date().toISOString(),
            requestId: c.get('requestId') || 'unknown'
        }
    };

    return c.json(response, statusCode as 200 | 201);
};

/**
 * Helper function to create error responses
 * Standardizes error response format across all endpoints
 */
export const createErrorResponse = (
    error: { code: string; message: string; details?: unknown },
    c: Context,
    statusCode = 400
) => {
    const response: ErrorResponse = {
        success: false,
        error,
        metadata: {
            timestamp: new Date().toISOString(),
            requestId: c.get('requestId') || 'unknown'
        }
    };

    return c.json(response, statusCode as 400 | 500);
};

/**
 * Helper function to create paginated responses for list/search endpoints
 * Handles the specific structure required by paginatedListResponseSchema
 */
export const createPaginatedResponse = (
    items: unknown[],
    pagination: PaginationMetadata,
    c: Context,
    statusCode = 200
) => {
    const response: ApiResponse<{ items: unknown[]; pagination: PaginationMetadata }> = {
        success: true,
        data: {
            items,
            pagination
        },
        metadata: {
            timestamp: new Date().toISOString(),
            requestId: c.get('requestId') || 'unknown'
            // Note: total and count are available in data.pagination
            // Removed from metadata to avoid duplication
        }
    };

    return c.json(response, statusCode as 200);
};

/**
 * Helper function to handle errors in route handlers
 * Provides consistent error handling across all endpoints
 */
export const handleRouteError = (error: unknown, c: Context) => {
    apiLogger.error({ message: 'Route error', error });

    // Check for ServiceError first (most specific)
    if (error instanceof ServiceError) {
        // Map ServiceErrorCode to HTTP status codes
        let statusCode = 500;

        switch (error.code) {
            case ServiceErrorCode.NOT_FOUND:
                statusCode = 404;
                break;
            case ServiceErrorCode.VALIDATION_ERROR:
            case ServiceErrorCode.INVALID_PAGINATION_PARAMS:
            case ServiceErrorCode.ALREADY_EXISTS:
                statusCode = 400;
                break;
            case ServiceErrorCode.UNAUTHORIZED:
                statusCode = 401;
                break;
            case ServiceErrorCode.FORBIDDEN:
                statusCode = 403;
                break;
            case ServiceErrorCode.NOT_IMPLEMENTED:
                statusCode = 501;
                break;
            default:
                statusCode = 500;
                break;
        }

        return createErrorResponse(
            {
                code: error.code,
                message: error.message,
                details: process.env.NODE_ENV === 'development' ? error.details : undefined
            },
            c,
            statusCode
        );
    }

    // Check for DbError (database errors from models)
    if (error instanceof DbError) {
        // Check for foreign key constraint violations
        if (error.message.includes('violates foreign key constraint')) {
            return createErrorResponse(
                {
                    code: 'INVALID_REFERENCE',
                    message: 'Invalid reference: The specified resource does not exist',
                    details: process.env.NODE_ENV === 'development' ? error.message : undefined
                },
                c,
                400
            );
        }

        // Other database errors are server errors
        return createErrorResponse(
            {
                code: 'DATABASE_ERROR',
                message: 'A database error occurred',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            },
            c,
            500
        );
    }

    if (error instanceof Error) {
        // Check for ServiceErrorCode prefix in message (e.g., "NOT_FOUND: Resource not found")
        // This handles errors thrown with format `throw new Error(`${result.error.code}: ${result.error.message}`)`
        const errorCodeMatch = error.message.match(/^([A-Z_]+):\s*(.+)$/);
        if (errorCodeMatch?.[1] && errorCodeMatch[2]) {
            const codeStr = errorCodeMatch[1];
            const message = errorCodeMatch[2];
            const code = codeStr as ServiceErrorCode;

            // Map ServiceErrorCode to HTTP status codes
            const statusCodeMap: Record<string, number> = {
                [ServiceErrorCode.NOT_FOUND]: 404,
                [ServiceErrorCode.VALIDATION_ERROR]: 400,
                [ServiceErrorCode.INVALID_PAGINATION_PARAMS]: 400,
                [ServiceErrorCode.ALREADY_EXISTS]: 409,
                [ServiceErrorCode.UNAUTHORIZED]: 401,
                [ServiceErrorCode.FORBIDDEN]: 403,
                [ServiceErrorCode.NOT_IMPLEMENTED]: 501,
                [ServiceErrorCode.INTERNAL_ERROR]: 500
            };

            const statusCode = statusCodeMap[code] ?? 500;
            return createErrorResponse(
                {
                    code,
                    message,
                    details: process.env.NODE_ENV === 'development' ? error.message : undefined
                },
                c,
                statusCode
            );
        }

        // Check for foreign key constraint violations (client errors, not server errors)
        if (error.message.includes('violates foreign key constraint')) {
            return createErrorResponse(
                {
                    code: 'INVALID_REFERENCE',
                    message: 'Invalid reference: The specified resource does not exist',
                    details: process.env.NODE_ENV === 'development' ? error.message : undefined
                },
                c,
                400
            );
        }

        // Check for validation errors
        if (error.message.includes('validation') || error.message.includes('Invalid')) {
            return createErrorResponse(
                {
                    code: 'VALIDATION_ERROR',
                    message: error.message,
                    details: process.env.NODE_ENV === 'development' ? error.message : undefined
                },
                c,
                400
            );
        }

        return createErrorResponse(
            {
                code: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            },
            c,
            500
        );
    }

    // Handle errors that are objects but not Error instances (e.g., DbError)
    if (error && typeof error === 'object' && 'message' in error) {
        const errorMessage = String(error.message);

        // Check for foreign key constraint violations
        if (errorMessage.includes('violates foreign key constraint')) {
            return createErrorResponse(
                {
                    code: 'INVALID_REFERENCE',
                    message: 'Invalid reference: The specified resource does not exist',
                    details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
                },
                c,
                400
            );
        }

        // Check for validation errors
        if (errorMessage.includes('validation') || errorMessage.includes('Invalid')) {
            return createErrorResponse(
                {
                    code: 'VALIDATION_ERROR',
                    message: errorMessage,
                    details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
                },
                c,
                400
            );
        }
    }

    return createErrorResponse(
        {
            code: 'UNKNOWN_ERROR',
            message: 'An unknown error occurred'
        },
        c,
        500
    );
};

/**
 * Interface for bulk operation result
 */
export interface BulkResultItem {
    id: string;
    success: boolean;
    error?: {
        code: string;
        message: string;
    };
}

/**
 * Interface for bulk response structure
 */
export interface BulkResponse {
    success: true;
    data: {
        results: BulkResultItem[];
        summary: {
            total: number;
            succeeded: number;
            failed: number;
        };
    };
    metadata: {
        timestamp: string;
        requestId: string;
    };
}

/**
 * Helper function to create bulk operation responses
 * Used for batch create/update/delete operations
 * @param results - Array of bulk operation results
 * @param c - Hono context
 * @param statusCode - HTTP status code (default 200)
 */
export const createBulkResponse = (results: BulkResultItem[], c: Context, statusCode = 200) => {
    const succeeded = results.filter((r) => r.success).length;
    const failed = results.length - succeeded;

    const response: BulkResponse = {
        success: true,
        data: {
            results,
            summary: {
                total: results.length,
                succeeded,
                failed
            }
        },
        metadata: {
            timestamp: new Date().toISOString(),
            requestId: c.get('requestId') || 'unknown'
        }
    };

    return c.json(response, statusCode as 200 | 207);
};

/**
 * Interface for accepted (async) response structure
 */
export interface AcceptedResponse {
    success: true;
    data: {
        taskId: string;
        status: 'pending';
        message: string;
    };
    metadata: {
        timestamp: string;
        requestId: string;
    };
}

/**
 * Helper function to create accepted responses for async operations
 * Returns HTTP 202 Accepted with a task ID for tracking
 * @param taskId - Unique identifier for the async task
 * @param c - Hono context
 * @param message - Optional message describing the async operation
 */
export const createAcceptedResponse = (
    taskId: string,
    c: Context,
    message = 'Request accepted for processing'
) => {
    const response: AcceptedResponse = {
        success: true,
        data: {
            taskId,
            status: 'pending',
            message
        },
        metadata: {
            timestamp: new Date().toISOString(),
            requestId: c.get('requestId') || 'unknown'
        }
    };

    return c.json(response, 202);
};

/**
 * Helper function to create no content responses
 * Returns HTTP 204 No Content
 * Used for successful delete operations or updates that don't return data
 * @param c - Hono context
 */
export const createNoContentResponse = (c: Context) => {
    return c.body(null, 204);
};

/**
 * Helper function to throw ServiceError from service result
 * Provides a clean, consistent way to handle service errors in route handlers
 *
 * @example
 * ```ts
 * const result = await service.findById(id);
 * throwIfError(result);
 * return result.data;
 * ```
 *
 * @param result - Service result with potential error
 * @throws ServiceError if result contains an error
 */
export const throwIfError = <T>(result: {
    error?: { code: ServiceErrorCode; message: string };
    data?: T;
}): asserts result is { data: T; error?: undefined } => {
    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }
};

/**
 * Helper function to throw ServiceError from service result, with custom error message
 *
 * @example
 * ```ts
 * const result = await service.findById(id);
 * throwIfErrorWithMessage(result, 'Accommodation not found');
 * return result.data;
 * ```
 *
 * @param result - Service result with potential error
 * @param customMessage - Custom message to use in the error
 * @throws ServiceError if result contains an error
 */
export const throwIfErrorWithMessage = <T>(
    result: { error?: { code: ServiceErrorCode; message: string }; data?: T },
    customMessage: string
): asserts result is { data: T; error?: undefined } => {
    if (result.error) {
        throw new ServiceError(result.error.code, customMessage);
    }
};
