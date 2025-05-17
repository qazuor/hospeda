import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * Standard success response with data
 */
export function successResponse<T>(c: Context, data: T, status = 200) {
    return c.json(
        {
            success: true,
            data
        },
        status as ContentfulStatusCode
    );
}

/**
 * Success response for collections with pagination
 */
export function paginatedResponse<T>(
    c: Context,
    data: T[],
    {
        page = 1,
        limit = 20,
        total
    }: {
        page: number;
        limit: number;
        total: number;
    }
) {
    return c.json({
        success: true,
        data,
        meta: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
            hasMore: page * limit < total
        }
    });
}

/**
 * Error response
 */
export function errorResponse(
    c: Context,
    {
        code = 'ERROR',
        message = 'An error occurred',
        status = 400,
        details
    }: {
        code?: string;
        message?: string;
        status?: number;
        details?: unknown;
    }
) {
    return c.json(
        {
            success: false,
            error: {
                code,
                message,
                ...(details ? { details } : {})
            }
        },
        status as ContentfulStatusCode
    );
}

/**
 * Not found response
 */
export function notFoundResponse(c: Context, message = 'Resource not found') {
    return errorResponse(c, {
        code: 'NOT_FOUND',
        message,
        status: 404
    });
}

/**
 * Unauthorized response
 */
export function unauthorizedResponse(c: Context, message = 'Authentication required') {
    return errorResponse(c, {
        code: 'UNAUTHORIZED',
        message,
        status: 401
    });
}

/**
 * Forbidden response
 */
export function forbiddenResponse(
    c: Context,
    message = 'You do not have permission to access this resource'
) {
    return errorResponse(c, {
        code: 'FORBIDDEN',
        message,
        status: 403
    });
}
