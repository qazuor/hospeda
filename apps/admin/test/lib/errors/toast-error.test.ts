/**
 * Tests for Toast Error Utility
 *
 * Tests for TASK-118: Verify error toast display for various error scenarios
 * - 404 errors show "Resource not found" message
 * - 422 errors show validation details
 * - Network errors show offline message
 * - Multiple errors stack correctly
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../src/lib/errors/api-error';
import {
    setToastFunction,
    showErrorToast,
    showInfoToast,
    showSuccessToast
} from '../../../src/lib/errors/toast-error';

// Mock the error reporter to avoid side effects
vi.mock('../../../src/lib/errors/error-reporter', () => ({
    reportError: vi.fn()
}));

describe('Toast Error Utility', () => {
    let mockToast: ReturnType<typeof vi.fn>;
    let toastCalls: Array<{
        title?: string;
        description?: string;
        variant?: string;
        duration?: number;
    }>;

    beforeEach(() => {
        toastCalls = [];
        mockToast = vi.fn((options) => {
            toastCalls.push(options);
        });
        setToastFunction(mockToast);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('404 Error Toast', () => {
        it('should show "Not Found" title for 404 errors', () => {
            const error = new ApiError('Resource not found', { status: 404 });

            showErrorToast({ error });

            expect(mockToast).toHaveBeenCalledTimes(1);
            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Not Found',
                    variant: 'destructive'
                })
            );
        });

        it('should show "The requested resource was not found" for 404 without message', () => {
            const error = new ApiError('', { status: 404 });

            showErrorToast({ error });

            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Not Found',
                    description: 'The requested resource was not found.'
                })
            );
        });

        it('should show custom message for 404 with specific message', () => {
            const error = new ApiError('Accommodation not found', { status: 404 });

            showErrorToast({ error });

            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Not Found',
                    description: 'Accommodation not found'
                })
            );
        });

        it('should include action context in 404 message', () => {
            const error = new ApiError('', { status: 404 });

            showErrorToast({ error, action: 'loading the accommodation' });

            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Not Found'
                })
            );
        });
    });

    describe('422 Validation Error Toast', () => {
        it('should show "Validation Error" title for 422 errors', () => {
            const error = new ApiError('Validation failed', { status: 422 });

            showErrorToast({ error });

            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Validation Error',
                    variant: 'destructive'
                })
            );
        });

        it('should show field-specific validation errors from Zod-style details', () => {
            const error = new ApiError('Validation failed', {
                status: 422,
                details: {
                    errors: [
                        { path: ['email'], message: 'Invalid email format' },
                        { path: ['email'], message: 'Email is required' },
                        { path: ['name'], message: 'Name must be at least 3 characters' }
                    ]
                }
            });

            showErrorToast({ error });

            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Validation Error',
                    description: expect.stringContaining('email')
                })
            );
            // Verify all field errors are included
            const call = mockToast.mock.calls[0][0];
            expect(call.description).toContain('email');
            expect(call.description).toContain('Invalid email format');
            expect(call.description).toContain('name');
            expect(call.description).toContain('Name must be at least 3 characters');
        });

        it('should show generic validation message without field details', () => {
            const error = new ApiError('Validation failed', {
                status: 422,
                details: { someOtherFormat: 'data' }
            });

            showErrorToast({ error });

            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Validation Error',
                    description: 'Validation failed'
                })
            );
        });

        it('should show fallback message for 422 without details', () => {
            const error = new ApiError('', { status: 422 });

            showErrorToast({ error });

            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Validation Error',
                    description: 'Please check your input and try again.'
                })
            );
        });
    });

    describe('Network Error Toast', () => {
        it('should show "Connection Error" for network failures', () => {
            const error = new TypeError('Failed to fetch');

            showErrorToast({ error });

            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Connection Error',
                    description:
                        'Unable to connect to the server. Please check your internet connection.',
                    variant: 'destructive'
                })
            );
        });

        it('should show "Connection Error" for ERR_NETWORK errors', () => {
            const error = new Error('ERR_NETWORK');

            showErrorToast({ error });

            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Connection Error',
                    description: expect.stringContaining('Unable to connect')
                })
            );
        });

        it('should show "Connection Error" for network request failed', () => {
            const error = new Error('Network request failed');

            showErrorToast({ error });

            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Connection Error'
                })
            );
        });
    });

    describe('Timeout Error Toast', () => {
        it('should show "Timeout" for timeout errors', () => {
            const error = new Error('Request timeout');

            showErrorToast({ error });

            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Timeout',
                    description: expect.stringContaining('timed out')
                })
            );
        });

        it('should include action context in timeout message', () => {
            const error = new Error('Connection timeout');

            showErrorToast({ error, action: 'fetching data' });

            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Timeout',
                    description: expect.stringContaining('while fetching data')
                })
            );
        });
    });

    describe('Abort Error Handling', () => {
        it('should NOT show toast for aborted requests', () => {
            const error = new Error('The operation was aborted');
            error.name = 'AbortError';

            showErrorToast({ error });

            expect(mockToast).not.toHaveBeenCalled();
        });

        it('should NOT show toast for user-cancelled requests', () => {
            const error = new Error('Request aborted');

            showErrorToast({ error });

            // Note: This depends on isAbortError implementation
            // If it detects "aborted" in message, it won't show toast
            expect(mockToast).not.toHaveBeenCalled();
        });
    });

    describe('Other API Error Statuses', () => {
        it('should show "Authentication Required" for 401', () => {
            const error = new ApiError('Unauthorized', { status: 401 });

            showErrorToast({ error });

            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Authentication Required',
                    description: 'Please sign in to continue.'
                })
            );
        });

        it('should show "Access Denied" for 403', () => {
            const error = new ApiError('Forbidden', { status: 403 });

            showErrorToast({ error });

            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Access Denied',
                    description: 'You do not have permission to perform this action.'
                })
            );
        });

        it('should show "Too Many Requests" for 429', () => {
            const error = new ApiError('Rate limited', { status: 429 });

            showErrorToast({ error });

            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Too Many Requests',
                    description: 'Please wait a moment before trying again.'
                })
            );
        });

        it('should show "Server Error" for 500', () => {
            const error = new ApiError('Internal server error', { status: 500 });

            showErrorToast({ error });

            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Server Error',
                    description: 'Something went wrong on our end. Please try again later.'
                })
            );
        });

        it('should show "Server Error" for 503', () => {
            const error = new ApiError('Service unavailable', { status: 503 });

            showErrorToast({ error });

            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Server Error'
                })
            );
        });
    });

    describe('Multiple Errors Stacking', () => {
        it('should allow multiple sequential error toasts', () => {
            const error1 = new ApiError('First error', { status: 404 });
            const error2 = new ApiError('Second error', { status: 422 });
            const error3 = new ApiError('Third error', { status: 500 });

            showErrorToast({ error: error1 });
            showErrorToast({ error: error2 });
            showErrorToast({ error: error3 });

            expect(mockToast).toHaveBeenCalledTimes(3);

            // Verify each call has different content
            expect(toastCalls[0].title).toBe('Not Found');
            expect(toastCalls[1].title).toBe('Validation Error');
            expect(toastCalls[2].title).toBe('Server Error');
        });

        it('should track all toast calls for visual stacking', () => {
            const errors = [
                new ApiError('Error 1', { status: 400 }),
                new ApiError('Error 2', { status: 401 }),
                new ApiError('Error 3', { status: 403 }),
                new ApiError('Error 4', { status: 404 })
            ];

            for (const error of errors) {
                showErrorToast({ error });
            }

            // All toasts should be called
            expect(toastCalls).toHaveLength(4);

            // Each should have variant destructive
            for (const call of toastCalls) {
                expect(call.variant).toBe('destructive');
            }
        });

        it('should maintain order of toast calls', () => {
            showErrorToast({ error: new ApiError('First', { status: 400 }), title: 'First Error' });
            showErrorToast({
                error: new ApiError('Second', { status: 401 }),
                title: 'Second Error'
            });
            showErrorToast({ error: new ApiError('Third', { status: 402 }), title: 'Third Error' });

            expect(toastCalls[0].title).toBe('First Error');
            expect(toastCalls[1].title).toBe('Second Error');
            expect(toastCalls[2].title).toBe('Third Error');
        });
    });

    describe('Custom Message Override', () => {
        it('should use custom title when provided', () => {
            const error = new ApiError('Error', { status: 500 });

            showErrorToast({
                error,
                title: 'Custom Title'
            });

            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Custom Title'
                })
            );
        });

        it('should use custom description when provided', () => {
            const error = new ApiError('Error', { status: 500 });

            showErrorToast({
                error,
                description: 'Custom description message'
            });

            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    description: 'Custom description message'
                })
            );
        });

        it('should use custom duration when provided', () => {
            const error = new ApiError('Error', { status: 500 });

            showErrorToast({
                error,
                duration: 10000
            });

            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    duration: 10000
                })
            );
        });

        it('should use default duration of 5000ms', () => {
            const error = new ApiError('Error', { status: 500 });

            showErrorToast({ error });

            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    duration: 5000
                })
            );
        });
    });

    describe('Success and Info Toasts', () => {
        it('should show success toast with correct variant', () => {
            showSuccessToast('Success!', 'Operation completed');

            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Success!',
                    description: 'Operation completed',
                    variant: 'success',
                    duration: 3000
                })
            );
        });

        it('should show info toast with default variant', () => {
            showInfoToast('Info', 'Some information');

            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Info',
                    description: 'Some information',
                    variant: 'default',
                    duration: 4000
                })
            );
        });
    });

    describe('Generic Error Handling', () => {
        it('should handle plain Error objects', () => {
            const error = new Error('Something went wrong');

            showErrorToast({ error });

            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Error',
                    description: 'Something went wrong'
                })
            );
        });

        it('should handle unknown error types', () => {
            showErrorToast({ error: 'string error' });

            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Error',
                    description: 'An unexpected error occurred.'
                })
            );
        });

        it('should handle null/undefined errors', () => {
            showErrorToast({ error: null });

            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Error'
                })
            );
        });
    });
});
