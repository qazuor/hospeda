/**
 * Response utilities with internationalization support
 */
import type { Context } from 'hono';

/**
 * Generic success response structure
 */
export interface SuccessResponse<T> {
    success: true;
    data: T;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasMore: boolean;
    hasPrev: boolean;
}

/**
 * Paginated response structure
 */
export interface PaginatedResponse<T> {
    success: true;
    data: T[];
    meta: PaginationMeta;
}

/**
 * Error response structure
 */
export interface ErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: unknown[];
    };
}

/**
 * Create success response with typed data
 * @template T - Type of the response data
 * @param data - Response data of type T
 * @returns {SuccessResponse<T>} Typed success response
 */
export const success = <T>(data: T): SuccessResponse<T> => ({
    success: true as const,
    data
});

/**
 * Create paginated response with metadata
 * @template T - Type of the response data items
 * @param data - Array of items
 * @param meta - Pagination metadata
 * @returns {PaginatedResponse<T>} Typed paginated response
 */
export const paginated = <T>(
    data: T[],
    meta: {
        page: number;
        limit: number;
        total: number;
    }
): PaginatedResponse<T> => ({
    success: true as const,
    data,
    meta: {
        ...meta,
        pages: Math.ceil(meta.total / meta.limit),
        hasMore: meta.page * meta.limit < meta.total,
        hasPrev: meta.page > 1
    }
});

/**
 * Create error response with internationalization
 * @param code - Error code
 * @param messageKey - Translation key for error message
 * @param details - Optional error details
 * @returns {ErrorResponse} Typed error response
 */
export const error = (code: string, messageKey: string, details?: unknown[]): ErrorResponse => ({
    success: false as const,
    error: {
        code,
        message: messageKey, // Will be translated by frontend
        ...(details && { details })
    }
});

/**
 * Send success response with context
 * @template T - Type of the response data
 * @param c - Hono context
 * @param data - Response data
 * @param status - HTTP status code
 * @returns JSON response
 */
export const sendSuccess = <T>(c: Context, data: T, status = 200) => {
    // biome-ignore lint/suspicious/noExplicitAny: Hono status type issue
    return c.json(success(data), status as any);
};

/**
 * Send paginated response with context
 * @template T - Type of the response data items
 * @param c - Hono context
 * @param data - Array of items
 * @param meta - Pagination metadata
 * @returns JSON response
 */
export const sendPaginated = <T>(
    c: Context,
    data: T[],
    meta: { page: number; limit: number; total: number }
) => {
    return c.json(paginated(data, meta));
};

/**
 * Send error response with internationalization
 * @param c - Hono context
 * @param code - Error code
 * @param messageKey - Translation key
 * @param status - HTTP status code
 * @param details - Optional error details
 * @returns JSON response
 */
export const sendError = (
    c: Context,
    code: string,
    messageKey: string,
    status = 400,
    details?: unknown[]
) => {
    // Frontend will handle translation based on locale and messageKey
    // biome-ignore lint/suspicious/noExplicitAny: Hono status type issue
    return c.json(error(code, messageKey, details), status as any);
};
