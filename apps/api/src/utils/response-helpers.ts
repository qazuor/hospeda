import { ServiceErrorCode } from '@repo/types';
/**
 * API Response Helpers
 * Consistent response formatting utilities using existing types and enums
 */
import type { Context } from 'hono';
import { HTTP_STATUS } from '../constants/http-status';

/**
 * Success response helper
 */
export const successResponse = <T>(c: Context, data: T, status = HTTP_STATUS.OK) => {
    return c.json({ success: true, data }, status as 200);
};

/**
 * Error response helpers using ServiceErrorCode enum
 */
export const errorResponses = {
    /**
     * Validation error response
     */
    validationError: (
        c: Context,
        message = 'Invalid input data',
        details?: Record<string, unknown>
    ) => {
        return c.json(
            {
                success: false,
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message,
                    ...(details && { details }),
                    requestId: c.get('requestId'),
                    timestamp: new Date().toISOString()
                }
            },
            HTTP_STATUS.BAD_REQUEST as 400
        );
    },

    /**
     * Not found error response
     */
    notFound: (c: Context, message = 'Resource not found') => {
        return c.json(
            {
                success: false,
                error: {
                    code: ServiceErrorCode.NOT_FOUND,
                    message,
                    requestId: c.get('requestId'),
                    timestamp: new Date().toISOString()
                }
            },
            HTTP_STATUS.NOT_FOUND as 404
        );
    },

    /**
     * Unauthorized error response
     */
    unauthorized: (c: Context, message = 'Authentication required') => {
        return c.json(
            {
                success: false,
                error: {
                    code: ServiceErrorCode.UNAUTHORIZED,
                    message,
                    requestId: c.get('requestId'),
                    timestamp: new Date().toISOString()
                }
            },
            HTTP_STATUS.UNAUTHORIZED as 401
        );
    },

    /**
     * Forbidden error response
     */
    forbidden: (c: Context, message = 'Insufficient permissions') => {
        return c.json(
            {
                success: false,
                error: {
                    code: ServiceErrorCode.FORBIDDEN,
                    message,
                    requestId: c.get('requestId'),
                    timestamp: new Date().toISOString()
                }
            },
            HTTP_STATUS.FORBIDDEN as 403
        );
    },

    /**
     * Already exists error response
     */
    alreadyExists: (c: Context, message = 'Resource already exists') => {
        return c.json(
            {
                success: false,
                error: {
                    code: ServiceErrorCode.ALREADY_EXISTS,
                    message,
                    requestId: c.get('requestId'),
                    timestamp: new Date().toISOString()
                }
            },
            HTTP_STATUS.CONFLICT as 409
        );
    },

    /**
     * Internal server error response
     */
    internalError: (c: Context, message = 'Internal server error') => {
        return c.json(
            {
                success: false,
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message,
                    requestId: c.get('requestId'),
                    timestamp: new Date().toISOString()
                }
            },
            HTTP_STATUS.INTERNAL_SERVER_ERROR as 500
        );
    }
};

/**
 * Combined response helpers for easier usage
 */
export const responses = {
    success: successResponse,
    ...errorResponses
};
