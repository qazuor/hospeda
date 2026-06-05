/**
 * Response helpers for creating standardized API responses
 * Provides helper functions to create consistent responses across endpoints
 */

import { DbError } from '@repo/db/utils';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core/types';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ZodIssue, ZodTypeAny } from 'zod';
import { env } from './env';
import { apiLogger } from './logger';

/**
 * Interface for pagination metadata
 * Uses pageSize for consistency with standard pagination patterns
 * Includes hasNextPage and hasPreviousPage for enhanced navigation
 */
export interface PaginationMetadata {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}

/**
 * Interface for paginated result structure
 */
export interface PaginatedResult {
    items: unknown[];
    pagination: PaginationMetadata;
}

/**
 * Interface for API response structure
 */
export interface ApiResponse<T = unknown> {
    success: true;
    data: T;
    metadata: {
        timestamp: string;
        requestId: string;
        total?: number;
        count?: number;
    };
}

/**
 * Interface for error response structure
 */
export interface ErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: unknown;
        /** Optional machine-readable reason identifier. Emitted unconditionally. */
        reason?: string;
    };
    metadata: {
        timestamp: string;
        requestId: string;
    };
}

/**
 * Strips a payload down to the fields declared in `responseSchema`.
 *
 * Behavior (strict mode — SPEC-087):
 * - If `responseSchema` is not provided, returns the data unchanged (no-op).
 * - If `responseSchema.safeParse(data)` succeeds, returns the parsed (stripped) data.
 * - If parsing fails, logs the structured issues server-side and throws a
 *   `ServiceError(INTERNAL_ERROR)` so the global error handler returns 500. A
 *   drift between the declared response contract and the actual handler payload
 *   is treated as a server bug, not a runtime fallback. The caller never sees
 *   the unstripped payload, so admin-only fields cannot leak silently.
 *
 * Used by {@link createResponse} and {@link createPaginatedResponse} to enforce
 * tier-appropriate field exposure at runtime (SPEC-062, SPEC-087).
 *
 * @param data - The data to strip
 * @param responseSchema - Optional Zod schema describing the response contract
 * @param c - Optional Hono context to enrich diagnostic logs with method, path, requestId
 * @returns Stripped data on success
 * @throws ServiceError(INTERNAL_ERROR) when the schema rejects the payload
 */
export const stripWithSchema = <T>(data: T, responseSchema?: ZodTypeAny, c?: Context): T => {
    if (!responseSchema) {
        return data;
    }

    const parsed = responseSchema.safeParse(data);
    if (parsed.success) {
        return parsed.data as T;
    }

    logStripFailure(parsed.error.issues, c);
    throw new ServiceError(
        ServiceErrorCode.INTERNAL_ERROR,
        'Response payload does not match declared schema'
    );
};

/**
 * Maximum length for the JSON-serialized issue list embedded in the log entry.
 * Prevents pathological cases (huge payloads, deeply nested arrays) from blowing
 * up log volume while still providing enough detail to diagnose the drift.
 */
const STRIP_FAIL_ISSUES_MAX_BYTES = 4000;

/**
 * Logs a response-schema strip failure with full diagnostic detail.
 *
 * Structured fields are pre-formatted so they survive any logger configuration
 * (the API logger does not expand nested objects by default — passing the raw
 * `issues` array would render as `[Object]`). Production log aggregators
 * receive: a one-line human-readable summary, the full issue list as JSON
 * (truncated at {@link STRIP_FAIL_ISSUES_MAX_BYTES}), and request metadata
 * (method, path, requestId) for cross-referencing with traces.
 */
const logStripFailure = (issues: readonly ZodIssue[], c?: Context): void => {
    const summary = issues
        .slice(0, 5)
        .map((issue) => {
            const path = issue.path.length > 0 ? issue.path.map(String).join('.') : '<root>';
            const expected = 'expected' in issue ? ` expected=${String(issue.expected)}` : '';
            return `${path}: ${issue.message} (${issue.code}${expected})`;
        })
        .join('; ');
    const issuesJson = JSON.stringify(issues).slice(0, STRIP_FAIL_ISSUES_MAX_BYTES);

    apiLogger.error(
        {
            issuesCount: issues.length,
            summary,
            issuesJson,
            method: c?.req.method,
            path: c?.req.path,
            requestId: (c?.get('requestId') as string | undefined) ?? 'unknown'
        },
        'Response schema stripping failed',
        // Per-call override: expand the structured payload fully and skip text
        // truncation so the issuesJson and summary survive in stdout regardless
        // of the API logger's category-level config (default expandObjectLevels=0
        // would render the payload as `[Object]`). This is critical so production
        // log aggregators capture actionable diagnostic data, not opaque markers.
        { expandObjectLevels: -1, truncateLongText: false }
    );
};

/**
 * Helper function to create standardized API responses
 * Reduces boilerplate and ensures consistency across endpoints
 *
 * @param data - Payload to include in the response envelope
 * @param c - Hono context
 * @param statusCode - HTTP status code (default 200)
 * @param responseSchema - Optional Zod schema used to strip sensitive fields
 *   from `data` via {@link stripWithSchema}. When omitted, the data is sent
 *   as-is and no runtime field enforcement is performed.
 */
export const createResponse = <T = unknown>(
    data: T,
    c: Context,
    statusCode = 200,
    responseSchema?: ZodTypeAny
) => {
    const stripped = stripWithSchema(data, responseSchema, c);
    const response: ApiResponse<T> = {
        success: true,
        data: stripped,
        metadata: {
            timestamp: new Date().toISOString(),
            requestId: c.get('requestId') || 'unknown'
        }
    };

    return c.json(response, statusCode as 200 | 201);
};

/**
 * Helper function to create error responses.
 *
 * The `reason` field, when present on the error object, is included
 * unconditionally in the JSON payload regardless of `HOSPEDA_API_DEBUG_ERRORS`.
 * It is a machine-readable identifier that clients may use for branching without
 * requiring debug mode to be enabled.
 *
 * Standardizes error response format across all endpoints.
 */
export const createErrorResponse = (
    error: { code: string; message: string; details?: unknown; reason?: string },
    c: Context,
    statusCode = 400
) => {
    const response: ErrorResponse = {
        success: false,
        error: {
            code: error.code,
            message: error.message,
            details: error.details,
            ...(error.reason !== undefined ? { reason: error.reason } : {})
        },
        metadata: {
            timestamp: new Date().toISOString(),
            requestId: c.get('requestId') || 'unknown'
        }
    };

    return c.json(response, statusCode as 400 | 500);
};

/**
 * Helper function to create paginated responses for list/search endpoints
 * Handles the specific structure required by paginatedListResponseSchema
 *
 * @param items - Array of result items for the current page
 * @param pagination - Pagination metadata (untouched by schema stripping)
 * @param c - Hono context
 * @param statusCode - HTTP status code (default 200)
 * @param responseSchema - Optional Zod schema applied to EACH item via
 *   {@link stripWithSchema} to enforce tier-appropriate field exposure at
 *   runtime (SPEC-062). Pagination metadata is never stripped.
 */
export const createPaginatedResponse = (
    items: unknown[],
    pagination: PaginationMetadata,
    c: Context,
    statusCode = 200,
    responseSchema?: ZodTypeAny
) => {
    const strippedItems = responseSchema
        ? items.map((item) => stripWithSchema(item, responseSchema, c))
        : items;

    const response: ApiResponse<{ items: unknown[]; pagination: PaginationMetadata }> = {
        success: true,
        data: {
            items: strippedItems,
            pagination
        },
        metadata: {
            timestamp: new Date().toISOString(),
            requestId: c.get('requestId') || 'unknown'
            // Note: total and count are available in data.pagination
            // Removed from metadata to avoid duplication
        }
    };

    return c.json(response, statusCode as 200);
};

/**
 * Helper function to handle errors in route handlers
 * Provides consistent error handling across all endpoints
 */
export const handleRouteError = (error: unknown, c: Context) => {
    apiLogger.error({ message: 'Route error', error });

    // Check for ServiceError first (most specific)
    if (error instanceof ServiceError) {
        // Map ServiceErrorCode to HTTP status codes
        let statusCode = 500;

        // Keep this switch aligned with `ERROR_CODE_TO_HTTP` in
        // `middlewares/response.ts` — that table is the source of truth for the
        // global onError handler. Routes throwing ServiceError from inside
        // `createCRUDRoute`'s try/catch land here, while routes that let the
        // throw bubble up land in the global handler. Both paths MUST agree on
        // status, otherwise the same error code yields different HTTP statuses
        // depending on where in the stack the catch happens (the upload route's
        // LIMIT_REACHED → 500 regression in SPEC-143 Block 1 smoke A.2 came
        // from `LIMIT_REACHED`/`ENTITLEMENT_REQUIRED`/`QUOTA_EXCEEDED` falling
        // through to the default 500 here while the global table mapped them
        // to 403/403/429 correctly).
        switch (error.code) {
            case ServiceErrorCode.NOT_FOUND:
                statusCode = 404;
                break;
            case ServiceErrorCode.VALIDATION_ERROR:
            case ServiceErrorCode.INVALID_PAGINATION_PARAMS:
                statusCode = 400;
                break;
            case ServiceErrorCode.ALREADY_EXISTS:
                statusCode = 409;
                break;
            case ServiceErrorCode.UNAUTHORIZED:
                statusCode = 401;
                break;
            case ServiceErrorCode.FORBIDDEN:
            case ServiceErrorCode.LIMIT_REACHED:
            case ServiceErrorCode.ENTITLEMENT_REQUIRED:
                statusCode = 403;
                break;
            case ServiceErrorCode.QUOTA_EXCEEDED:
                statusCode = 429;
                break;
            case ServiceErrorCode.NOT_IMPLEMENTED:
                statusCode = 501;
                break;
            case ServiceErrorCode.CONFIGURATION_ERROR:
                statusCode = 500;
                break;
            case ServiceErrorCode.SERVICE_UNAVAILABLE:
                statusCode = 503;
                break;
            case ServiceErrorCode.PROVIDER_ERROR:
                statusCode = 502;
                break;
            case ServiceErrorCode.PROVIDER_RATE_LIMITED:
                statusCode = 503;
                break;
            case ServiceErrorCode.PROVIDER_TIMEOUT:
                statusCode = 504;
                break;
            default:
                statusCode = 500;
                break;
        }

        return createErrorResponse(
            {
                code: error.code,
                message: error.message,
                details: env.HOSPEDA_API_DEBUG_ERRORS ? error.details : undefined,
                reason: error.reason
            },
            c,
            statusCode
        );
    }

    // Check for Hono HTTPException (thrown by route handlers for known errors)
    if (error instanceof HTTPException) {
        const statusCode = error.status;
        const message = error.message;

        // Map HTTP status to error code
        const httpStatusToCode: Record<number, string> = {
            400: ServiceErrorCode.VALIDATION_ERROR,
            401: ServiceErrorCode.UNAUTHORIZED,
            403: ServiceErrorCode.FORBIDDEN,
            404: ServiceErrorCode.NOT_FOUND,
            409: ServiceErrorCode.ALREADY_EXISTS
        };
        const code = httpStatusToCode[statusCode] ?? ServiceErrorCode.INTERNAL_ERROR;

        return createErrorResponse(
            {
                code,
                message,
                details: undefined
            },
            c,
            statusCode
        );
    }

    // Check for DbError (database errors from models)
    if (error instanceof DbError) {
        // Check for foreign key constraint violations
        if (error.message.includes('violates foreign key constraint')) {
            return createErrorResponse(
                {
                    code: 'INVALID_REFERENCE',
                    message: 'Invalid reference: The specified resource does not exist',
                    details: env.HOSPEDA_API_DEBUG_ERRORS ? error.message : undefined
                },
                c,
                400
            );
        }

        // Other database errors are server errors
        return createErrorResponse(
            {
                code: 'DATABASE_ERROR',
                message: 'A database error occurred',
                details: env.HOSPEDA_API_DEBUG_ERRORS ? error.message : undefined
            },
            c,
            500
        );
    }

    if (error instanceof Error) {
        // Check for ServiceErrorCode prefix in message (e.g., "NOT_FOUND: Resource not found")
        // This handles errors thrown with format `throw new Error(`${result.error.code}: ${result.error.message}`)`
        const errorCodeMatch = error.message.match(/^([A-Z_]+):\s*(.+)$/);
        if (errorCodeMatch?.[1] && errorCodeMatch[2]) {
            const codeStr = errorCodeMatch[1];
            const message = errorCodeMatch[2];
            const code = codeStr as ServiceErrorCode;

            // Map ServiceErrorCode to HTTP status codes
            const statusCodeMap: Record<string, number> = {
                [ServiceErrorCode.NOT_FOUND]: 404,
                [ServiceErrorCode.VALIDATION_ERROR]: 400,
                [ServiceErrorCode.INVALID_PAGINATION_PARAMS]: 400,
                [ServiceErrorCode.ALREADY_EXISTS]: 409,
                [ServiceErrorCode.UNAUTHORIZED]: 401,
                [ServiceErrorCode.FORBIDDEN]: 403,
                [ServiceErrorCode.NOT_IMPLEMENTED]: 501,
                [ServiceErrorCode.INTERNAL_ERROR]: 500,
                [ServiceErrorCode.CONFIGURATION_ERROR]: 500,
                [ServiceErrorCode.SERVICE_UNAVAILABLE]: 503,
                [ServiceErrorCode.PROVIDER_ERROR]: 502,
                [ServiceErrorCode.PROVIDER_RATE_LIMITED]: 503,
                [ServiceErrorCode.PROVIDER_TIMEOUT]: 504
            };

            const statusCode = statusCodeMap[code] ?? 500;
            return createErrorResponse(
                {
                    code,
                    message,
                    details: env.HOSPEDA_API_DEBUG_ERRORS ? error.message : undefined
                },
                c,
                statusCode
            );
        }

        // Check for foreign key constraint violations (client errors, not server errors)
        if (error.message.includes('violates foreign key constraint')) {
            return createErrorResponse(
                {
                    code: 'INVALID_REFERENCE',
                    message: 'Invalid reference: The specified resource does not exist',
                    details: env.HOSPEDA_API_DEBUG_ERRORS ? error.message : undefined
                },
                c,
                400
            );
        }

        // Check for validation errors
        if (error.message.includes('validation') || error.message.includes('Invalid')) {
            return createErrorResponse(
                {
                    code: 'VALIDATION_ERROR',
                    message: error.message,
                    details: env.HOSPEDA_API_DEBUG_ERRORS ? error.message : undefined
                },
                c,
                400
            );
        }

        return createErrorResponse(
            {
                code: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred',
                details: env.HOSPEDA_API_DEBUG_ERRORS ? error.message : undefined
            },
            c,
            500
        );
    }

    // Handle errors that are objects but not Error instances (e.g., DbError)
    if (error && typeof error === 'object' && 'message' in error) {
        const errorMessage = String(error.message);

        // Check for foreign key constraint violations
        if (errorMessage.includes('violates foreign key constraint')) {
            return createErrorResponse(
                {
                    code: 'INVALID_REFERENCE',
                    message: 'Invalid reference: The specified resource does not exist',
                    details: env.HOSPEDA_API_DEBUG_ERRORS ? errorMessage : undefined
                },
                c,
                400
            );
        }

        // Check for validation errors
        if (errorMessage.includes('validation') || errorMessage.includes('Invalid')) {
            return createErrorResponse(
                {
                    code: 'VALIDATION_ERROR',
                    message: errorMessage,
                    details: env.HOSPEDA_API_DEBUG_ERRORS ? errorMessage : undefined
                },
                c,
                400
            );
        }
    }

    return createErrorResponse(
        {
            code: 'UNKNOWN_ERROR',
            message: 'An unknown error occurred'
        },
        c,
        500
    );
};

/**
 * Interface for bulk operation result
 */
export interface BulkResultItem {
    id: string;
    success: boolean;
    error?: {
        code: string;
        message: string;
    };
}

/**
 * Interface for bulk response structure
 */
export interface BulkResponse {
    success: true;
    data: {
        results: BulkResultItem[];
        summary: {
            total: number;
            succeeded: number;
            failed: number;
        };
    };
    metadata: {
        timestamp: string;
        requestId: string;
    };
}

/**
 * Helper function to create bulk operation responses
 * Used for batch create/update/delete operations
 * @param results - Array of bulk operation results
 * @param c - Hono context
 * @param statusCode - HTTP status code (default 200)
 */
export const createBulkResponse = (results: BulkResultItem[], c: Context, statusCode = 200) => {
    const succeeded = results.filter((r) => r.success).length;
    const failed = results.length - succeeded;

    const response: BulkResponse = {
        success: true,
        data: {
            results,
            summary: {
                total: results.length,
                succeeded,
                failed
            }
        },
        metadata: {
            timestamp: new Date().toISOString(),
            requestId: c.get('requestId') || 'unknown'
        }
    };

    return c.json(response, statusCode as 200 | 207);
};

/**
 * Interface for accepted (async) response structure
 */
export interface AcceptedResponse {
    success: true;
    data: {
        taskId: string;
        status: 'pending';
        message: string;
    };
    metadata: {
        timestamp: string;
        requestId: string;
    };
}

/**
 * Helper function to create accepted responses for async operations
 * Returns HTTP 202 Accepted with a task ID for tracking
 * @param taskId - Unique identifier for the async task
 * @param c - Hono context
 * @param message - Optional message describing the async operation
 */
export const createAcceptedResponse = (
    taskId: string,
    c: Context,
    message = 'Request accepted for processing'
) => {
    const response: AcceptedResponse = {
        success: true,
        data: {
            taskId,
            status: 'pending',
            message
        },
        metadata: {
            timestamp: new Date().toISOString(),
            requestId: c.get('requestId') || 'unknown'
        }
    };

    return c.json(response, 202);
};

/**
 * Helper function to create no content responses
 * Returns HTTP 204 No Content
 * Used for successful delete operations or updates that don't return data
 * @param c - Hono context
 */
export const createNoContentResponse = (c: Context) => {
    return c.body(null, 204);
};

/**
 * Helper function to throw ServiceError from service result
 * Provides a clean, consistent way to handle service errors in route handlers
 *
 * @example
 * ```ts
 * const result = await service.findById(id);
 * throwIfError(result);
 * return result.data;
 * ```
 *
 * @param result - Service result with potential error
 * @throws ServiceError if result contains an error
 */
export const throwIfError = <T>(result: {
    error?: { code: ServiceErrorCode; message: string };
    data?: T;
}): asserts result is { data: T; error?: undefined } => {
    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }
};

/**
 * Helper function to throw ServiceError from service result, with custom error message
 *
 * @example
 * ```ts
 * const result = await service.findById(id);
 * throwIfErrorWithMessage(result, 'Accommodation not found');
 * return result.data;
 * ```
 *
 * @param result - Service result with potential error
 * @param customMessage - Custom message to use in the error
 * @throws ServiceError if result contains an error
 */
export const throwIfErrorWithMessage = <T>(
    result: { error?: { code: ServiceErrorCode; message: string }; data?: T },
    customMessage: string
): asserts result is { data: T; error?: undefined } => {
    if (result.error) {
        throw new ServiceError(result.error.code, customMessage);
    }
};
