/**
 * Tests for ApiError class and type guards
 */
import { describe, expect, it } from 'vitest';
import {
    ApiError,
    createApiError,
    isAbortError,
    isApiError,
    isNetworkError,
    isTimeoutError
} from '../../../src/lib/errors/api-error';

describe('ApiError', () => {
    describe('constructor', () => {
        it('should create an ApiError with message and config', () => {
            const error = new ApiError('Not found', { status: 404 });
            expect(error.message).toBe('Not found');
            expect(error.status).toBe(404);
            expect(error.name).toBe('ApiError');
            expect(error.code).toBe('NOT_FOUND'); // Auto-mapped from status
        });

        it('should set optional properties from config', () => {
            const error = new ApiError('Validation failed', {
                status: 422,
                code: 'VALIDATION_ERROR',
                details: { field: 'email', error: 'Invalid format' },
                url: '/api/users',
                method: 'POST'
            });
            expect(error.code).toBe('VALIDATION_ERROR');
            expect(error.details).toEqual({ field: 'email', error: 'Invalid format' });
            expect(error.url).toBe('/api/users');
            expect(error.method).toBe('POST');
        });

        it('should have a valid stack trace', () => {
            const error = new ApiError('Test error', { status: 500 });
            expect(error.stack).toBeDefined();
            expect(error.stack).toContain('ApiError');
        });

        it('should have a timestamp', () => {
            const beforeCreate = new Date();
            const error = new ApiError('Test error', { status: 500 });
            const afterCreate = new Date();

            expect(error.timestamp).toBeInstanceOf(Date);
            expect(error.timestamp.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
            expect(error.timestamp.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
        });

        it('should map status codes to error codes automatically', () => {
            expect(new ApiError('Bad request', { status: 400 }).code).toBe('BAD_REQUEST');
            expect(new ApiError('Unauthorized', { status: 401 }).code).toBe('UNAUTHORIZED');
            expect(new ApiError('Forbidden', { status: 403 }).code).toBe('FORBIDDEN');
            expect(new ApiError('Not found', { status: 404 }).code).toBe('NOT_FOUND');
            expect(new ApiError('Conflict', { status: 409 }).code).toBe('CONFLICT');
            expect(new ApiError('Validation', { status: 422 }).code).toBe('VALIDATION_ERROR');
            expect(new ApiError('Rate limited', { status: 429 }).code).toBe('RATE_LIMITED');
            expect(new ApiError('Server error', { status: 500 }).code).toBe('INTERNAL_ERROR');
            expect(new ApiError('Service unavailable', { status: 503 }).code).toBe(
                'SERVICE_UNAVAILABLE'
            );
        });
    });

    describe('status classification methods', () => {
        it('isClientError should return true for 4xx status codes', () => {
            expect(new ApiError('Bad request', { status: 400 }).isClientError()).toBe(true);
            expect(new ApiError('Unauthorized', { status: 401 }).isClientError()).toBe(true);
            expect(new ApiError('Not found', { status: 404 }).isClientError()).toBe(true);
            expect(new ApiError('Unprocessable', { status: 422 }).isClientError()).toBe(true);
            expect(new ApiError('Server error', { status: 500 }).isClientError()).toBe(false);
            expect(new ApiError('OK', { status: 200 }).isClientError()).toBe(false);
        });

        it('isServerError should return true for 5xx status codes', () => {
            expect(new ApiError('Server error', { status: 500 }).isServerError()).toBe(true);
            expect(new ApiError('Bad gateway', { status: 502 }).isServerError()).toBe(true);
            expect(new ApiError('Gateway timeout', { status: 504 }).isServerError()).toBe(true);
            expect(new ApiError('Client error', { status: 400 }).isServerError()).toBe(false);
        });

        it('isNotFoundError should return true for 404 status', () => {
            expect(new ApiError('Not found', { status: 404 }).isNotFoundError()).toBe(true);
            expect(new ApiError('Other error', { status: 400 }).isNotFoundError()).toBe(false);
        });

        it('isAuthError should return true for 401 status', () => {
            expect(new ApiError('Unauthorized', { status: 401 }).isAuthError()).toBe(true);
            expect(new ApiError('Forbidden', { status: 403 }).isAuthError()).toBe(false);
        });

        it('isForbiddenError should return true for 403 status', () => {
            expect(new ApiError('Forbidden', { status: 403 }).isForbiddenError()).toBe(true);
            expect(new ApiError('Unauthorized', { status: 401 }).isForbiddenError()).toBe(false);
        });

        it('isValidationError should return true for 422 status', () => {
            expect(new ApiError('Validation error', { status: 422 }).isValidationError()).toBe(
                true
            );
            expect(new ApiError('Bad request', { status: 400 }).isValidationError()).toBe(false);
        });
    });

    describe('getValidationErrors', () => {
        it('should extract validation errors from Zod-style details', () => {
            const error = new ApiError('Validation failed', {
                status: 422,
                details: {
                    errors: [
                        { path: ['email'], message: 'Invalid format' },
                        { path: ['email'], message: 'Required' },
                        { path: ['name'], message: 'Too short' }
                    ]
                }
            });

            const validationErrors = error.getValidationErrors();
            expect(validationErrors).toEqual({
                email: ['Invalid format', 'Required'],
                name: ['Too short']
            });
        });

        it('should return null if no validation errors', () => {
            const error = new ApiError('Server error', { status: 500 });
            expect(error.getValidationErrors()).toBeNull();
        });

        it('should return null for validation error without Zod-style details', () => {
            const error = new ApiError('Validation error', {
                status: 422,
                details: { someOtherFormat: 'data' }
            });
            expect(error.getValidationErrors()).toBeNull();
        });
    });

    describe('getUserMessage', () => {
        it('should return user-friendly messages for common status codes', () => {
            expect(new ApiError('', { status: 400 }).getUserMessage()).toBe(
                'Invalid request. Please check your input.'
            );
            expect(new ApiError('', { status: 401 }).getUserMessage()).toBe(
                'Please sign in to continue.'
            );
            expect(new ApiError('', { status: 403 }).getUserMessage()).toBe(
                'You do not have permission to perform this action.'
            );
            expect(new ApiError('', { status: 404 }).getUserMessage()).toBe(
                'The requested resource was not found.'
            );
            expect(new ApiError('', { status: 500 }).getUserMessage()).toBe(
                'Server error. Please try again later.'
            );
        });

        it('should return original message for unknown status', () => {
            expect(new ApiError('Custom message', { status: 418 }).getUserMessage()).toBe(
                'Custom message'
            );
        });
    });

    describe('toJSON', () => {
        it('should serialize error to JSON', () => {
            const error = new ApiError('Test error', {
                status: 400,
                code: 'BAD_REQUEST',
                details: { test: true },
                url: '/api/test',
                method: 'GET'
            });

            const json = error.toJSON();
            expect(json).toMatchObject({
                name: 'ApiError',
                message: 'Test error',
                status: 400,
                code: 'BAD_REQUEST',
                details: { test: true },
                url: '/api/test',
                method: 'GET'
            });
            expect(json.timestamp).toBeDefined();
        });
    });
});

describe('Type Guards', () => {
    describe('isApiError', () => {
        it('should return true for ApiError instances', () => {
            expect(isApiError(new ApiError('Test', { status: 400 }))).toBe(true);
        });

        it('should return false for regular Error', () => {
            expect(isApiError(new Error('Test'))).toBe(false);
        });

        it('should return false for non-Error objects', () => {
            expect(isApiError({ message: 'test', status: 400 })).toBe(false);
            expect(isApiError('error string')).toBe(false);
            expect(isApiError(null)).toBe(false);
            expect(isApiError(undefined)).toBe(false);
        });
    });

    describe('isNetworkError', () => {
        it('should return true for TypeError with fetch message', () => {
            expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
        });

        it('should return true for Error with network message', () => {
            expect(isNetworkError(new Error('Network request failed'))).toBe(true);
            expect(isNetworkError(new Error('ERR_NETWORK'))).toBe(true);
        });

        it('should return false for non-network errors', () => {
            expect(isNetworkError(new Error('Regular error'))).toBe(false);
            expect(isNetworkError(new ApiError('Not found', { status: 404 }))).toBe(false);
        });
    });

    describe('isAbortError', () => {
        it('should return true for errors with AbortError name', () => {
            const abortError = new Error('The operation was aborted');
            abortError.name = 'AbortError';
            expect(isAbortError(abortError)).toBe(true);
        });

        it('should return true for errors with abort in message', () => {
            expect(isAbortError(new Error('Request aborted'))).toBe(true);
        });

        it('should return false for non-abort errors', () => {
            expect(isAbortError(new Error('Regular error'))).toBe(false);
        });
    });

    describe('isTimeoutError', () => {
        it('should return true for errors with TimeoutError name', () => {
            const timeoutError = new Error('Request timed out');
            timeoutError.name = 'TimeoutError';
            expect(isTimeoutError(timeoutError)).toBe(true);
        });

        it('should return true for errors with timeout in message', () => {
            expect(isTimeoutError(new Error('Request timeout'))).toBe(true);
            expect(isTimeoutError(new Error('Connection timeout'))).toBe(true);
        });

        it('should return false for non-timeout errors', () => {
            expect(isTimeoutError(new Error('Regular error'))).toBe(false);
        });
    });
});

describe('createApiError', () => {
    it('should return the same error if already an ApiError', () => {
        const original = new ApiError('Test', { status: 400 });
        const result = createApiError(original);
        expect(result).toBe(original);
    });

    it('should convert Error with status to ApiError', () => {
        const legacyError = new Error('Not found') as Error & { status: number };
        legacyError.status = 404;

        const result = createApiError(legacyError);
        expect(result).toBeInstanceOf(ApiError);
        expect(result.status).toBe(404);
        expect(result.message).toBe('Not found');
    });

    it('should convert plain Error to ApiError with status 0', () => {
        const error = new Error('Some error');
        const result = createApiError(error);

        expect(result).toBeInstanceOf(ApiError);
        expect(result.status).toBe(0);
        expect(result.code).toBe('UNKNOWN');
        expect(result.message).toBe('Some error');
    });

    it('should handle unknown error types', () => {
        const result = createApiError('string error');

        expect(result).toBeInstanceOf(ApiError);
        expect(result.status).toBe(0);
        expect(result.message).toBe('An unknown error occurred');
    });
});
