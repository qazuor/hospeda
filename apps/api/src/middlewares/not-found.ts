/**
 * 404 Not Found handler
 * Returns consistent response for non-existent routes
 */
import type { NotFoundHandler } from 'hono';

/**
 * Handle 404 Not Found responses
 * Returns a consistent error format for missing routes
 *
 * @param c - Hono context
 * @returns JSON 404 response
 */
export const notFoundHandler: NotFoundHandler = (c) => {
    return c.json(
        {
            success: false,
            error: {
                code: 'NOT_FOUND',
                message: `Route ${c.req.method} ${c.req.path} not found`,
                suggestion: 'Check the API documentation at /docs for available endpoints'
            }
        },
        404
    );
};
