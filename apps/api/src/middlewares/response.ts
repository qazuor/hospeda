import { ServiceErrorCode } from '@repo/types';
/**
 * Response formatting middleware
 * Ensures consistent response format across the API
 */
import type { MiddlewareHandler } from 'hono';
import { env } from '../utils/env';

// Standard API response types
type ApiResponse<T = unknown> = {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: unknown;
    };
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
};

type PaginationData = {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
};

/**
 * Formats a successful response with consistent structure
 */
const formatSuccessResponse = <T>(
    data: T,
    _status = 200,
    pagination?: PaginationData
): ApiResponse<T> => {
    const response: ApiResponse<T> = {
        success: true,
        data
    };

    // Add metadata if enabled
    if (env.RESPONSE_INCLUDE_METADATA) {
        response.metadata = {
            timestamp: new Date().toISOString()
        };

        if (env.RESPONSE_INCLUDE_VERSION) {
            response.metadata.version = env.RESPONSE_API_VERSION;
        }

        if (pagination) {
            response.metadata.pagination = pagination;
        }
    }

    return response;
};

/**
 * Formats an error response with consistent structure
 */
const formatErrorResponse = (
    code: string,
    message: string,
    _status = 500,
    details?: unknown
): ApiResponse => {
    const response: ApiResponse = {
        success: false,
        error: {
            code,
            message,
            ...(details ? { details: details } : {})
        }
    };

    // Add metadata if enabled
    if (env.RESPONSE_INCLUDE_METADATA) {
        response.metadata = {
            timestamp: new Date().toISOString()
        };

        if (env.RESPONSE_INCLUDE_VERSION) {
            response.metadata.version = env.RESPONSE_API_VERSION;
        }
    }

    return response;
};

/**
 * Response formatting middleware
 * Ensures all API responses follow a consistent format
 */
export const responseFormattingMiddleware: MiddlewareHandler = async (c, next) => {
    if (!env.RESPONSE_FORMAT_ENABLED) {
        await next();
        return;
    }

    // Handle errors in the middleware chain
    try {
        await next();
    } catch (error) {
        // Format error responses
        let errorCode = 'INTERNAL_SERVER_ERROR';
        let errorMessage = env.RESPONSE_ERROR_MESSAGE;
        let statusCode = 500;

        // Handle different types of errors
        if (error instanceof Error) {
            errorMessage = error.message;

            // Map common error types to appropriate codes using ServiceErrorCode enum
            if (error.name === 'ValidationError') {
                errorCode = ServiceErrorCode.VALIDATION_ERROR;
                statusCode = 400;
            } else if (error.name === 'UnauthorizedError') {
                errorCode = ServiceErrorCode.UNAUTHORIZED;
                statusCode = 401;
            } else if (error.name === 'ForbiddenError') {
                errorCode = ServiceErrorCode.FORBIDDEN;
                statusCode = 403;
            } else if (error.name === 'NotFoundError') {
                errorCode = ServiceErrorCode.NOT_FOUND;
                statusCode = 404;
            } else if (error.name === 'ConflictError' || error.name === 'AlreadyExistsError') {
                errorCode = ServiceErrorCode.ALREADY_EXISTS;
                statusCode = 409;
            } else if (error.name === 'NotImplementedError') {
                errorCode = ServiceErrorCode.NOT_IMPLEMENTED;
                statusCode = 501;
            } else {
                errorCode = ServiceErrorCode.INTERNAL_ERROR;
                statusCode = 500;
            }
        }

        const formattedError = formatErrorResponse(errorCode, errorMessage, statusCode, error);

        // Add response headers
        const headers: Record<string, string> = {};

        if (env.RESPONSE_INCLUDE_VERSION) {
            headers['X-API-Version'] = env.RESPONSE_API_VERSION;
        }

        if (env.RESPONSE_INCLUDE_REQUEST_ID) {
            const requestId = c.get('requestId');
            if (requestId) {
                headers['X-Request-ID'] = requestId;
                if (formattedError.metadata) {
                    formattedError.metadata.requestId = requestId;
                }
            }
        }

        // biome-ignore lint/suspicious/noExplicitAny: Hono version compatibility issues
        return c.json(formattedError, statusCode as any, headers);
    }
};

/**
 * Helper function to create formatted error responses
 * Can be used directly in route handlers
 */
export const createErrorResponse = (
    code: ServiceErrorCode | string,
    message: string,
    status = 500,
    details?: unknown
): ApiResponse => {
    return formatErrorResponse(code, message, status, details);
};

/**
 * Helper function to create formatted success responses
 * Can be used directly in route handlers
 */
export const createSuccessResponse = <T>(
    data: T,
    status = 200,
    pagination?: PaginationData
): ApiResponse<T> => {
    return formatSuccessResponse(data, status, pagination);
};
