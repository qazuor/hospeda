/**
 * Global error handler middleware
 * Catches and formats all unhandled errors
 */
import { logger } from '@repo/logger';
import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { env } from '../utils/env';

/**
 * Global error handler for the application
 * Formats errors into consistent API responses
 *
 * @param error - The caught error
 * @param c - Hono context
 * @returns JSON error response
 */
export const errorHandler: ErrorHandler = (error, c) => {
    logger.error(`Unhandled error: ${error.message}`);
    logger.error(`Stack: ${error.stack}`);
    logger.error(
        `Path: ${c.req.path} | Method: ${c.req.method} | Time: ${new Date().toISOString()}`
    );

    // Zod validation error
    if (error instanceof ZodError) {
        return c.json(
            {
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid input data',
                    details: error.errors.map((err) => ({
                        field: err.path.join('.'),
                        message: err.message,
                        code: err.code
                    }))
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
                    message: error.message
                }
            },
            error.status
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
                ...(env.NODE_ENV === 'development' && { stack: error.stack })
            }
        },
        500
    );
};
