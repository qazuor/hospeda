import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
/**
 * Response formatting middleware
 * Ensures consistent response format across the API
 */
import type { Context, MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type {
    ApiErrorResponse,
    ApiResponse,
    ApiSuccessResponse,
    PaginationData
} from '../schemas/response-schemas';
import { env, getResponseConfig } from '../utils/env';
import { apiLogger } from '../utils/logger';

/**
 * Centralized mapping from ServiceErrorCode to HTTP status codes
 * This ensures consistent HTTP responses across the API
 */
const ERROR_CODE_TO_HTTP: Record<ServiceErrorCode, number> = {
    [ServiceErrorCode.VALIDATION_ERROR]: 400,
    [ServiceErrorCode.INVALID_PAGINATION_PARAMS]: 400,
    [ServiceErrorCode.UNAUTHORIZED]: 401,
    [ServiceErrorCode.FORBIDDEN]: 403,
    [ServiceErrorCode.NOT_FOUND]: 404,
    [ServiceErrorCode.ALREADY_EXISTS]: 409,
    [ServiceErrorCode.INTERNAL_ERROR]: 500,
    [ServiceErrorCode.NOT_IMPLEMENTED]: 501,
    [ServiceErrorCode.SERVICE_UNAVAILABLE]: 503,
    [ServiceErrorCode.CONFIGURATION_ERROR]: 500
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
    const responseConfig = getResponseConfig();
    const response: ApiResponse<T> = {
        success: true,
        data
    };

    // Add metadata if enabled
    if (responseConfig.includeMetadata) {
        response.metadata = {
            timestamp: new Date().toISOString()
        };

        if (responseConfig.includeVersion) {
            response.metadata.version = responseConfig.apiVersion;
        }

        if (requestId && responseConfig.includeRequestId) {
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
    const responseConfig = getResponseConfig();
    const response: ApiResponse = {
        success: false,
        error: {
            code,
            message,
            ...(details ? { details: details } : {})
        }
    };

    // Add metadata if enabled
    if (responseConfig.includeMetadata) {
        response.metadata = {
            timestamp: new Date().toISOString()
        };

        if (responseConfig.includeVersion) {
            response.metadata.version = responseConfig.apiVersion;
        }

        if (requestId && responseConfig.includeRequestId) {
            response.metadata.requestId = requestId;
        }
    }

    return response;
};

/**
 * Helper function to add headers to responses
 */
const addResponseHeaders = (c: Context): Record<string, string> => {
    const responseConfig = getResponseConfig();
    const headers: Record<string, string> = {};

    if (responseConfig.includeVersion) {
        headers['X-API-Version'] = responseConfig.apiVersion;
    }

    if (responseConfig.includeRequestId) {
        const requestId = c.get('requestId');
        if (requestId) {
            headers['X-Request-ID'] = requestId;
        }
    }

    // Preserve existing CORS headers
    const existingCorsHeaders = [
        'Access-Control-Allow-Origin',
        'Access-Control-Allow-Methods',
        'Access-Control-Allow-Headers',
        'Access-Control-Allow-Credentials',
        'Access-Control-Max-Age'
    ];

    for (const corsHeader of existingCorsHeaders) {
        const existingValue = c.res.headers.get(corsHeader);
        if (existingValue) {
            headers[corsHeader] = existingValue;
        }
    }

    return headers;
};

/**
 * Response formatting middleware
 * Ensures all API responses follow a consistent format
 */
export const responseFormattingMiddleware: MiddlewareHandler = async (c, next) => {
    const responseConfig = getResponseConfig();
    if (!responseConfig.formatEnabled) {
        await next();
        return;
    }

    // Skip response formatting for documentation routes
    // These routes need to return raw content (HTML, JSON spec, etc.)
    if (c.req.path.startsWith('/docs/')) {
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
 * Helper function to create formatted error responses
 * Can be used directly in route handlers
 */
export const createErrorResponse = (
    code: string,
    message: string,
    status = 500,
    details?: unknown
): ApiErrorResponse => {
    return formatErrorResponse(code, message, status, details) as ApiErrorResponse;
};

/**
 * Helper function to create formatted success responses
 * Can be used directly in route handlers
 */
export const createSuccessResponse = <T>(
    data: T,
    status = 200,
    pagination?: PaginationData
): ApiSuccessResponse<T> => {
    return formatSuccessResponse(data, status, pagination) as ApiSuccessResponse<T>;
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

    return c.json(response, status as ContentfulStatusCode, headers);
};

/**
 * Gets HTTP status code from ServiceErrorCode using the centralized mapping
 * @param code - The ServiceErrorCode
 * @returns The corresponding HTTP status code
 */
const getHttpStatusFromErrorCode = (code: ServiceErrorCode): number => {
    return ERROR_CODE_TO_HTTP[code] ?? 500;
};

/**
 * Creates an error handler for Hono app.onError()
 * This is the preferred way to handle errors in Hono
 *
 * Error handling priority:
 * 1. ServiceError (from @repo/service-core) - uses code property for HTTP status
 * 2. HTTPException (from Hono) - uses status property
 * 3. SyntaxError (JSON parsing) - returns 400
 * 4. All other errors - returns 500
 */
export const createErrorHandler = () => {
    return (error: Error, c: Context) => {
        // Get response configuration
        const responseConfig = getResponseConfig();

        // Log the error for debugging with full details
        apiLogger.error(
            `🚨 Caught error in ${c.req.method} ${c.req.path}: [${error.name}] ${error.message}`
        );
        if (error.stack) {
            apiLogger.error(`📋 Stack: ${error.stack}`);
        }

        if (!responseConfig.formatEnabled) {
            throw error; // Let Hono handle it
        }

        let errorCode: ServiceErrorCode;
        let errorMessage: string;
        let statusCode: number;
        let errorDetails: unknown;

        // Priority 1: ServiceError from service layer (preferred)
        // Use instanceof for type-safe error detection
        if (error instanceof ServiceError) {
            errorCode = error.code;
            errorMessage = error.message;
            statusCode = getHttpStatusFromErrorCode(error.code);
            errorDetails = error.details;
        }
        // Priority 2: Hono HTTPException
        else if (error instanceof HTTPException) {
            statusCode = error.status;
            errorMessage = error.message;

            // Map HTTP status to ServiceErrorCode
            if (statusCode === 400) {
                errorCode = ServiceErrorCode.VALIDATION_ERROR;
            } else if (statusCode === 401) {
                errorCode = ServiceErrorCode.UNAUTHORIZED;
            } else if (statusCode === 403) {
                errorCode = ServiceErrorCode.FORBIDDEN;
            } else if (statusCode === 404) {
                errorCode = ServiceErrorCode.NOT_FOUND;
            } else if (statusCode === 409) {
                errorCode = ServiceErrorCode.ALREADY_EXISTS;
            } else {
                errorCode = ServiceErrorCode.INTERNAL_ERROR;
            }
        }
        // Priority 3: JSON parsing errors
        else if (
            error instanceof SyntaxError &&
            (error.message.includes('JSON') || error.message.includes('Unexpected'))
        ) {
            errorCode = ServiceErrorCode.VALIDATION_ERROR;
            errorMessage = 'Invalid JSON format in request body';
            statusCode = 400;
        }
        // Priority 4: Legacy error.name based detection (for backwards compatibility)
        else if (error.name === 'ValidationError') {
            errorCode = ServiceErrorCode.VALIDATION_ERROR;
            errorMessage = error.message;
            statusCode = 400;
        } else if (error.name === 'UnauthorizedError') {
            errorCode = ServiceErrorCode.UNAUTHORIZED;
            errorMessage = error.message;
            statusCode = 401;
        } else if (error.name === 'ForbiddenError') {
            errorCode = ServiceErrorCode.FORBIDDEN;
            errorMessage = error.message;
            statusCode = 403;
        } else if (error.name === 'NotFoundError') {
            errorCode = ServiceErrorCode.NOT_FOUND;
            errorMessage = error.message;
            statusCode = 404;
        }
        // Priority 5: Default to internal error
        else {
            errorCode = ServiceErrorCode.INTERNAL_ERROR;
            errorMessage = responseConfig.errorMessage;
            statusCode = 500;
        }

        // Strip error details from 5xx responses in production to prevent information leakage.
        // HOSPEDA_API_DEBUG_ERRORS=true overrides this to show full details for production debugging.
        const isProduction = env.NODE_ENV === 'production';
        const debugErrors = env.HOSPEDA_API_DEBUG_ERRORS;
        const hideDetails = isProduction && !debugErrors && statusCode >= 500;
        const safeDetails = hideDetails ? undefined : errorDetails;
        const safeMessage = hideDetails ? responseConfig.errorMessage : errorMessage;

        const requestId = c.get('requestId');
        const formattedError = formatErrorResponse(
            errorCode,
            safeMessage,
            statusCode,
            safeDetails,
            requestId
        );

        // Add response headers (includes preserved CORS headers)
        const headers = addResponseHeaders(c);

        return c.json(formattedError, statusCode as ContentfulStatusCode, headers);
    };
};
