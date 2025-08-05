import { ServiceErrorCode } from '@repo/types';
/**
 * Response formatting middleware
 * Ensures consistent response format across the API
 */
import type { Context, MiddlewareHandler } from 'hono';
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
    pagination?: PaginationData,
    requestId?: string
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

        if (requestId && env.RESPONSE_INCLUDE_REQUEST_ID) {
            response.metadata.requestId = requestId;
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
    details?: unknown,
    requestId?: string
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

        if (requestId && env.RESPONSE_INCLUDE_REQUEST_ID) {
            response.metadata.requestId = requestId;
        }
    }

    return response;
};

/**
 * Helper function to add headers to responses
 */
const addResponseHeaders = (c: Context): Record<string, string> => {
    const headers: Record<string, string> = {};

    if (env.RESPONSE_INCLUDE_VERSION) {
        headers['X-API-Version'] = env.RESPONSE_API_VERSION;
    }

    if (env.RESPONSE_INCLUDE_REQUEST_ID) {
        const requestId = c.get('requestId');
        if (requestId) {
            headers['X-Request-ID'] = requestId;
        }
    }

    return headers;
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

    // Store the original json method
    const originalJson = c.json.bind(c);

    // Override the json method to format responses
    // biome-ignore lint/suspicious/noExplicitAny: Middleware override requires any
    c.json = (data: any, status?: any, headers?: any) => {
        // If the response is already formatted (has success property), return as is
        if (data && typeof data === 'object' && 'success' in data) {
            return originalJson(data, status, headers);
        }

        // Only format successful responses (2xx status codes)
        const statusCode = status || 200;
        if (statusCode >= 400) {
            // Let error responses pass through without formatting
            return originalJson(data, status, headers);
        }

        // Format the response
        const requestId = c.get('requestId');
        const formattedResponse = formatSuccessResponse(data, statusCode, undefined, requestId);

        // Merge headers
        const responseHeaders = addResponseHeaders(c);
        const mergedHeaders = { ...responseHeaders, ...headers };

        return originalJson(formattedResponse, status, mergedHeaders);
    };

    await next();
};

/**
 * Error handling middleware
 * Should be used as the last middleware to catch all errors
 */
export const errorHandlingMiddleware: MiddlewareHandler = async (c, next) => {
    if (!env.RESPONSE_FORMAT_ENABLED) {
        await next();
        return;
    }

    try {
        await next();
    } catch (error) {
        // Format error responses
        let errorCode = ServiceErrorCode.INTERNAL_ERROR;
        let errorMessage = env.RESPONSE_ERROR_MESSAGE;
        let statusCode = 500;

        // Handle different types of errors
        if (error instanceof Error) {
            errorMessage = error.message;

            // Map common error types to appropriate codes
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
            } else if (
                error.constructor.name === 'HTTPException' &&
                error.message.includes('Malformed JSON')
            ) {
                errorCode = ServiceErrorCode.VALIDATION_ERROR;
                errorMessage = 'Invalid JSON format in request body';
                statusCode = 400;
            } else if (error instanceof SyntaxError && error.message.includes('JSON')) {
                errorCode = ServiceErrorCode.VALIDATION_ERROR;
                errorMessage = 'Invalid JSON format in request body';
                statusCode = 400;
            } else {
                errorCode = ServiceErrorCode.INTERNAL_ERROR;
                statusCode = 500;
            }
        }

        const requestId = c.get('requestId');
        const formattedError = formatErrorResponse(
            errorCode,
            errorMessage,
            statusCode,
            error,
            requestId
        );

        // Add response headers
        const headers = addResponseHeaders(c);

        // biome-ignore lint/suspicious/noExplicitAny: Hono version compatibility issues
        return c.json(formattedError, statusCode as any, headers);
    }
};

/**
 * Helper function to create formatted error responses
 * Can be used directly in route handlers
 */
export const createErrorResponse = (
    code: string,
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

/**
 * Helper function to send formatted responses with headers
 * Can be used directly in route handlers
 */
export const sendFormattedResponse = <T>(
    c: Context,
    data: T,
    status = 200,
    pagination?: PaginationData
) => {
    const requestId = c.get('requestId');
    const response = formatSuccessResponse(data, status, pagination, requestId);
    const headers = addResponseHeaders(c);

    // biome-ignore lint/suspicious/noExplicitAny: Hono version compatibility issues
    return c.json(response, status as any, headers);
};

/**
 * Creates an error handler for Hono app.onError()
 * This is the preferred way to handle errors in Hono
 */
export const createErrorHandler = () => {
    return (error: Error, c: Context) => {
        if (!env.RESPONSE_FORMAT_ENABLED) {
            throw error; // Let Hono handle it
        }

        // Format error responses
        let errorCode = ServiceErrorCode.INTERNAL_ERROR;
        let errorMessage = env.RESPONSE_ERROR_MESSAGE;
        let statusCode = 500;

        // Handle different types of errors
        if (error instanceof Error) {
            errorMessage = error.message;

            // Map common error types to appropriate codes
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
            } else if (
                error.constructor.name === 'HTTPException' &&
                error.message.includes('Malformed JSON')
            ) {
                errorCode = ServiceErrorCode.VALIDATION_ERROR;
                errorMessage = 'Invalid JSON format in request body';
                statusCode = 400;
            } else if (error instanceof SyntaxError && error.message.includes('JSON')) {
                errorCode = ServiceErrorCode.VALIDATION_ERROR;
                errorMessage = 'Invalid JSON format in request body';
                statusCode = 400;
            } else {
                errorCode = ServiceErrorCode.INTERNAL_ERROR;
                statusCode = 500;
            }
        }

        const requestId = c.get('requestId');
        const formattedError = formatErrorResponse(
            errorCode,
            errorMessage,
            statusCode,
            error,
            requestId
        );

        // Add response headers
        const headers = addResponseHeaders(c);

        // biome-ignore lint/suspicious/noExplicitAny: Hono version compatibility issues
        return c.json(formattedError, statusCode as any, headers);
    };
};
