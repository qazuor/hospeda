/**
 * Global error handler middleware
 * Catches and formats all unhandled errors using ServiceErrorCode from @repo/types
 */
import { logger } from '@repo/logger';
import { ServiceErrorCode } from '@repo/types';
import type { ErrorHandler, MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { env } from '../utils/env';

/**
 * Custom error types for different scenarios
 */
export class ValidationError extends Error {
    public readonly statusCode = 400;
    public readonly code = ServiceErrorCode.VALIDATION_ERROR;

    constructor(
        message: string,
        public readonly details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'ValidationError';
    }
}

export class AuthenticationError extends Error {
    public readonly statusCode = 401;
    public readonly code = ServiceErrorCode.UNAUTHORIZED;

    constructor(message = 'Authentication required') {
        super(message);
        this.name = 'AuthenticationError';
    }
}

export class AuthorizationError extends Error {
    public readonly statusCode = 403;
    public readonly code = ServiceErrorCode.FORBIDDEN;

    constructor(message = 'Insufficient permissions') {
        super(message);
        this.name = 'AuthorizationError';
    }
}

export class NotFoundError extends Error {
    public readonly statusCode = 404;
    public readonly code = ServiceErrorCode.NOT_FOUND;

    constructor(message = 'Resource not found') {
        super(message);
        this.name = 'NotFoundError';
    }
}

export class ConflictError extends Error {
    public readonly statusCode = 409;
    public readonly code = ServiceErrorCode.ALREADY_EXISTS;

    constructor(message = 'Resource conflict') {
        super(message);
        this.name = 'ConflictError';
    }
}

export class RateLimitError extends Error {
    public readonly statusCode = 429;
    public readonly code = 'RATE_LIMIT_ERROR';

    constructor(message = 'Rate limit exceeded') {
        super(message);
        this.name = 'RateLimitError';
    }
}

export class InternalServerError extends Error {
    public readonly statusCode = 500;
    public readonly code = ServiceErrorCode.INTERNAL_ERROR;

    constructor(message = 'Internal server error') {
        super(message);
        this.name = 'InternalServerError';
    }
}

/**
 * Global error handler for the application
 * Formats errors into consistent API responses
 *
 * @param error - The caught error
 * @param c - Hono context
 * @returns JSON error response
 */
export const errorHandler: ErrorHandler = (error, c) => {
    const requestId = c.get('requestId') || 'unknown';
    logger.error(
        `Error in ${c.req.method} ${c.req.path}: ${error.message} - Request ID: ${requestId}`
    );

    if (env.NODE_ENV !== 'production' && error.stack) {
        logger.error(`Stack: ${error.stack}`);
    }

    // Zod validation error
    if (error instanceof ZodError) {
        return c.json(
            {
                success: false,
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'Invalid input data',
                    details: error.errors.map((err) => ({
                        field: err.path.join('.'),
                        message: err.message,
                        code: err.code
                    })),
                    requestId,
                    timestamp: new Date().toISOString()
                }
            },
            400
        );
    }

    // HTTP Exception from Hono
    if (error instanceof HTTPException) {
        return c.json(
            {
                success: false,
                error: {
                    code: error.message.toUpperCase().replace(/ /g, '_'),
                    message: error.message,
                    requestId,
                    timestamp: new Date().toISOString()
                }
            },
            error.status
        );
    }

    // Custom error types
    if ('statusCode' in error && 'code' in error) {
        const customError = error as {
            statusCode: number;
            code: string;
            message: string;
            details?: unknown;
        };
        return c.json(
            {
                success: false,
                error: {
                    code: customError.code,
                    message: customError.message,
                    details: customError.details,
                    requestId,
                    timestamp: new Date().toISOString()
                }
            },
            customError.statusCode as 400 | 401 | 403 | 404 | 409 | 429 | 500
        );
    }

    // Service layer errors
    if (error.name === 'ServiceError') {
        // biome-ignore lint/suspicious/noExplicitAny: ServiceError type assertion needed
        const serviceError = error as any; // Type assertion for service errors
        const statusMap: Record<string, number> = {
            NOT_FOUND: 404,
            UNAUTHORIZED: 401,
            FORBIDDEN: 403,
            VALIDATION_ERROR: 400,
            CONFLICT: 409
        };

        return c.json(
            {
                success: false,
                error: {
                    code: serviceError.code,
                    message: serviceError.message,
                    requestId,
                    timestamp: new Date().toISOString(),
                    ...(serviceError.details && { details: serviceError.details })
                }
            },
            (statusMap[serviceError.code] || 500) as 400 | 401 | 403 | 404 | 409 | 500
        );
    }

    // Generic server error
    return c.json(
        {
            success: false,
            error: {
                code: 'SERVER_ERROR',
                message: env.NODE_ENV === 'development' ? error.message : 'Internal server error',
                requestId,
                timestamp: new Date().toISOString(),
                ...(env.NODE_ENV === 'development' && { stack: error.stack })
            }
        },
        500
    );
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (): MiddlewareHandler => {
    return async (c) => {
        throw new NotFoundError(`Route ${c.req.method} ${c.req.path} not found`);
    };
};
