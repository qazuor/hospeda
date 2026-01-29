/**
 * Tests for Error Reporter utility
 *
 * Note: These tests focus on function behavior rather than environment-specific
 * logging, as the logging behavior depends on import.meta.env which is hard
 * to mock reliably in tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../src/lib/errors/api-error';
import {
    reportApiError,
    reportComponentError,
    reportError,
    reportNetworkError
} from '../../../src/lib/errors/error-reporter';

describe('Error Reporter', () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        // Suppress console output during tests
        consoleSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
        vi.spyOn(console, 'debug').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('reportError', () => {
        it('should not throw when called with an error', () => {
            expect(() => {
                reportError({ error: new Error('Test error') });
            }).not.toThrow();
        });

        it('should not throw when called with context', () => {
            expect(() => {
                reportError({
                    error: new Error('Test error'),
                    context: { userId: '123', action: 'save' }
                });
            }).not.toThrow();
        });

        it('should not throw when called with all options', () => {
            expect(() => {
                reportError({
                    error: new Error('Test error'),
                    context: { userId: '123' },
                    severity: 'error',
                    source: 'TestComponent',
                    tags: { feature: 'test' }
                });
            }).not.toThrow();
        });

        it('should not report abort errors', () => {
            const abortError = new Error('The operation was aborted');
            abortError.name = 'AbortError';

            // Reset the spy count before calling
            consoleSpy.mockClear();

            reportError({ error: abortError });

            // Abort errors should not be logged
            expect(consoleSpy).not.toHaveBeenCalled();
        });
    });

    describe('reportApiError', () => {
        it('should not throw when called with an ApiError', () => {
            const apiError = new ApiError('Not found', {
                status: 404,
                code: 'NOT_FOUND',
                url: '/api/test',
                method: 'GET'
            });

            expect(() => {
                reportApiError(apiError);
            }).not.toThrow();
        });

        it('should not throw when called with additional context', () => {
            const apiError = new ApiError('Server error', { status: 500 });

            expect(() => {
                reportApiError(apiError, { userId: '123', endpoint: '/api/test' });
            }).not.toThrow();
        });
    });

    describe('reportNetworkError', () => {
        it('should not throw when called with a network error', () => {
            const networkError = new TypeError('Failed to fetch');

            expect(() => {
                reportNetworkError(networkError);
            }).not.toThrow();
        });

        it('should not throw when called with a non-network error', () => {
            const regularError = new Error('Regular error');

            expect(() => {
                reportNetworkError(regularError);
            }).not.toThrow();
        });

        it('should not throw when called with context', () => {
            const networkError = new TypeError('Failed to fetch');

            expect(() => {
                reportNetworkError(networkError, { url: '/api/test' });
            }).not.toThrow();
        });
    });

    describe('reportComponentError', () => {
        it('should not throw when called with error and component info', () => {
            const error = new Error('Render error');
            const componentStack = 'at MyComponent\nat App';

            expect(() => {
                reportComponentError(error, componentStack, 'MyComponent');
            }).not.toThrow();
        });

        it('should not throw when called with minimal arguments', () => {
            const error = new Error('Render error');

            expect(() => {
                reportComponentError(error, undefined, undefined);
            }).not.toThrow();
        });
    });
});
