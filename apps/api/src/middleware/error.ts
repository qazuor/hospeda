import { apiLogger } from '@/utils/logger';
import type { Context, Next } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ZodError } from 'zod';

export async function errorMiddleware(c: Context, next: Next) {
    try {
        await next();
    } catch (error) {
        apiLogger.error(error as Error, 'API:Error - Unhandled error in request');

        // Handle ZodError (validation errors)
        if (error instanceof ZodError) {
            const formattedErrors = error.errors.map((err) => ({
                path: err.path.join('.'),
                message: err.message,
                code: err.code
            }));

            return c.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Validation error',
                        details: formattedErrors
                    }
                },
                400
            );
        }

        // Handle standard errors with .status property (Hono and other HTTP errors)
        if (error instanceof Error && 'status' in error && typeof error.status === 'number') {
            const status = error.status as number;

            return c.json(
                {
                    success: false,
                    error: {
                        code: status === 404 ? 'NOT_FOUND' : 'REQUEST_ERROR',
                        message: error.message || 'An error occurred processing your request'
                    }
                },
                status as ContentfulStatusCode
            );
        }

        // Generic error handling
        return c.json(
            {
                success: false,
                error: {
                    code: 'SERVER_ERROR',
                    message: 'An unexpected error occurred'
                }
            },
            500
        );
    }
}
