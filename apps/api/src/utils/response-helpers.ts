/**
 * Response helpers for creating standardized API responses
 * Provides helper functions to create consistent responses across endpoints
 */

import type { Context } from 'hono';

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
    console.error('Route error:', error);

    if (error instanceof Error) {
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

    return createErrorResponse(
        {
            code: 'UNKNOWN_ERROR',
            message: 'An unknown error occurred'
        },
        c,
        500
    );
};
