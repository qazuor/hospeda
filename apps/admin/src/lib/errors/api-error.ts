/**
 * ApiError - Type-safe error class for API responses
 *
 * Provides structured error handling for API calls with proper TypeScript types.
 *
 * @example
 * ```typescript
 * import { ApiError, isApiError, isNetworkError } from '@/lib/errors';
 *
 * try {
 *   await fetchApi({ path: '/api/accommodations' });
 * } catch (error) {
 *   if (isApiError(error)) {
 *     console.log(error.status); // 404
 *     console.log(error.code);   // 'NOT_FOUND'
 *     console.log(error.details); // { field: 'id' }
 *   } else if (isNetworkError(error)) {
 *     console.log('Network error, please check your connection');
 *   }
 * }
 * ```
 */

import { defaultLocale, trans } from '@repo/i18n';

/**
 * Localized text shown instead of the API `message` on a server error.
 *
 * The API answers every 5xx with a fixed English generic message (HOS-2296)
 * that is not meant for people, so `ApiError.message` carries this text for
 * status >= 500 (HOS-2312). The original is kept in `serverMessage`.
 */
const SERVER_ERROR_MESSAGE_KEY = 'admin-common.toastErrors.api.serverError';

/**
 * Resolve the localized server-error text. Never throws: the catalog lookup is
 * guarded so a partially mocked or unavailable catalog degrades to English.
 */
function localizedServerErrorMessage(): string {
    try {
        return (
            trans[defaultLocale]?.[SERVER_ERROR_MESSAGE_KEY] ??
            'Something went wrong on our side. Please try again later.'
        );
    } catch {
        return 'Something went wrong on our side. Please try again later.';
    }
}

/**
 * Standard API error codes matching backend ServiceErrorCode
 */
export type ApiErrorCode =
    | 'VALIDATION_ERROR'
    | 'NOT_FOUND'
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'CONFLICT'
    | 'INTERNAL_ERROR'
    | 'BAD_REQUEST'
    | 'SERVICE_UNAVAILABLE'
    | 'RATE_LIMITED'
    | 'UNKNOWN';

/**
 * Configuration for creating an ApiError
 */
export interface ApiErrorConfig {
    /** HTTP status code */
    readonly status: number;
    /** Error code for programmatic handling */
    readonly code?: ApiErrorCode;
    /** Additional error details (validation errors, etc.) */
    readonly details?: Record<string, unknown> | null;
    /** Original response body for debugging */
    readonly body?: unknown;
    /** Request URL that caused the error */
    readonly url?: string;
    /** HTTP method used */
    readonly method?: string;
}

/**
 * Custom error class for API errors with full type safety
 */
export class ApiError extends Error {
    /** HTTP status code */
    public readonly status: number;
    /** Error code for programmatic handling */
    public readonly code: ApiErrorCode;
    /** Additional error details */
    public readonly details: Record<string, unknown> | null;
    /** Original response body */
    public readonly body: unknown;
    /** Request URL that caused the error */
    public readonly url?: string;
    /** HTTP method used */
    public readonly method?: string;
    /** Timestamp when error occurred */
    public readonly timestamp: Date;
    /**
     * The message the API sent, kept for logs and error reports when `message`
     * was replaced by the localized server-error text (status >= 500).
     */
    public readonly serverMessage?: string;

    constructor(message: string, config: ApiErrorConfig) {
        const masked = config.status >= 500;
        super(masked ? localizedServerErrorMessage() : message);
        if (masked) this.serverMessage = message;
        this.name = 'ApiError';
        this.status = config.status;
        this.code = config.code ?? mapStatusToCode(config.status);
        this.details = config.details ?? null;
        this.body = config.body;
        this.url = config.url;
        this.method = config.method;
        this.timestamp = new Date();

        // Maintain proper stack trace for V8 engines
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ApiError);
        }
    }

    /**
     * Check if this is a client error (4xx)
     */
    public isClientError(): boolean {
        return this.status >= 400 && this.status < 500;
    }

    /**
     * Check if this is a server error (5xx)
     */
    public isServerError(): boolean {
        return this.status >= 500;
    }

    /**
     * Check if this is a validation error
     */
    public isValidationError(): boolean {
        return this.status === 422 || this.code === 'VALIDATION_ERROR';
    }

    /**
     * Check if this is an authentication error
     */
    public isAuthError(): boolean {
        return this.status === 401 || this.code === 'UNAUTHORIZED';
    }

    /**
     * Check if this is a permission error
     */
    public isForbiddenError(): boolean {
        return this.status === 403 || this.code === 'FORBIDDEN';
    }

    /**
     * Check if this is a not found error
     */
    public isNotFoundError(): boolean {
        return this.status === 404 || this.code === 'NOT_FOUND';
    }

    /**
     * Get user-friendly error message based on error type
     */
    public getUserMessage(): string {
        switch (this.status) {
            case 400:
                return 'Invalid request. Please check your input.';
            case 401:
                return 'Please sign in to continue.';
            case 403:
                return 'You do not have permission to perform this action.';
            case 404:
                return 'The requested resource was not found.';
            case 409:
                return 'This operation conflicts with existing data.';
            case 422:
                return 'Please correct the validation errors.';
            case 429:
                return 'Too many requests. Please wait a moment.';
            case 500:
            case 502:
            case 503:
            case 504:
                return 'Server error. Please try again later.';
            default:
                return this.message || 'An unexpected error occurred.';
        }
    }

    /**
     * Get validation errors if this is a validation error
     */
    public getValidationErrors(): Record<string, string[]> | null {
        if (!this.isValidationError() || !this.details) {
            return null;
        }

        const errors: Record<string, string[]> = {};

        // Handle Zod-style validation errors
        if ('errors' in this.details && Array.isArray(this.details.errors)) {
            for (const err of this.details.errors as Array<{ path?: string[]; message?: string }>) {
                const field = err.path?.join('.') || '_root';
                if (!errors[field]) {
                    errors[field] = [];
                }
                if (err.message) {
                    errors[field].push(err.message);
                }
            }
        }

        return Object.keys(errors).length > 0 ? errors : null;
    }

    /**
     * Convert to plain object for logging/serialization
     */
    public toJSON(): Record<string, unknown> {
        return {
            name: this.name,
            message: this.message,
            serverMessage: this.serverMessage,
            status: this.status,
            code: this.code,
            details: this.details,
            url: this.url,
            method: this.method,
            timestamp: this.timestamp.toISOString()
        };
    }
}

/**
 * Map HTTP status code to ApiErrorCode
 */
function mapStatusToCode(status: number): ApiErrorCode {
    switch (status) {
        case 400:
            return 'BAD_REQUEST';
        case 401:
            return 'UNAUTHORIZED';
        case 403:
            return 'FORBIDDEN';
        case 404:
            return 'NOT_FOUND';
        case 409:
            return 'CONFLICT';
        case 422:
            return 'VALIDATION_ERROR';
        case 429:
            return 'RATE_LIMITED';
        case 503:
            return 'SERVICE_UNAVAILABLE';
        default:
            if (status >= 500) {
                return 'INTERNAL_ERROR';
            }
            return 'UNKNOWN';
    }
}

/**
 * Type guard to check if an error is an ApiError
 *
 * @example
 * ```typescript
 * try {
 *   await fetchApi({ path: '/api/data' });
 * } catch (error) {
 *   if (isApiError(error)) {
 *     // error is now typed as ApiError
 *     console.log(error.status, error.code);
 *   }
 * }
 * ```
 */
export function isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError;
}

/**
 * Type guard to check if an error is a network error (no response from server)
 */
export function isNetworkError(error: unknown): boolean {
    if (error instanceof TypeError) {
        return error.message.includes('fetch') || error.message.includes('network');
    }
    if (error instanceof Error) {
        return (
            error.name === 'TypeError' ||
            error.message.includes('Failed to fetch') ||
            error.message.includes('Network request failed') ||
            error.message.includes('ERR_NETWORK')
        );
    }
    return false;
}

/**
 * Type guard to check if an error is an abort error (request was cancelled)
 */
export function isAbortError(error: unknown): boolean {
    if (error instanceof Error) {
        return error.name === 'AbortError' || error.message.includes('aborted');
    }
    return false;
}

/**
 * Type guard to check if an error is a timeout error
 */
export function isTimeoutError(error: unknown): boolean {
    if (error instanceof Error) {
        return error.name === 'TimeoutError' || error.message.includes('timeout');
    }
    return false;
}

/**
 * Create an ApiError from a legacy error object (for backward compatibility)
 */
export function createApiError(error: unknown): ApiError {
    if (isApiError(error)) {
        return error;
    }

    if (error instanceof Error) {
        // Check if it has status property (legacy error pattern)
        const legacyError = error as Error & { status?: number; body?: unknown };
        if (typeof legacyError.status === 'number') {
            return new ApiError(error.message, {
                status: legacyError.status,
                body: legacyError.body
            });
        }

        // Network or other errors
        return new ApiError(error.message, {
            status: 0,
            code: 'UNKNOWN'
        });
    }

    // Unknown error type
    return new ApiError('An unknown error occurred', {
        status: 0,
        code: 'UNKNOWN'
    });
}
