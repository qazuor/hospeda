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
 */
export interface PaginationMetadata {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
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
            requestId: c.get('requestId') || 'unknown',
            total: pagination.total,
            count: items.length
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
