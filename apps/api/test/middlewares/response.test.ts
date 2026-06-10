/**
 * Response Middleware Tests
 * Tests the response formatting functionality
 */
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createErrorHandler,
    createErrorResponse,
    createSuccessResponse,
    responseFormattingMiddleware,
    sendFormattedResponse
} from '../../src/middlewares/response';
import { env } from '../../src/utils/env';

// Mock environment
vi.mock('../../src/utils/env', () => {
    const mockEnv = {
        API_RESPONSE_FORMAT_ENABLED: true,
        API_RESPONSE_INCLUDE_METADATA: true,
        API_RESPONSE_INCLUDE_REQUEST_ID: true,
        API_RESPONSE_API_VERSION: '1.0.0',
        API_RESPONSE_ERROR_MESSAGE: 'Internal server error'
    };

    const mockModule = {
        env: mockEnv,
        validateApiEnv: vi.fn(),
        getResponseConfig: () => ({
            formatEnabled: mockModule.env.API_RESPONSE_FORMAT_ENABLED ?? true,
            includeMetadata: mockModule.env.API_RESPONSE_INCLUDE_METADATA ?? true,
            // Version inclusion is derived: empty string disables, any non-empty string enables.
            includeVersion: (mockModule.env.API_RESPONSE_API_VERSION ?? '').length > 0,
            includeRequestId: mockModule.env.API_RESPONSE_INCLUDE_REQUEST_ID ?? true,
            apiVersion: mockModule.env.API_RESPONSE_API_VERSION ?? '1.0.0',
            errorMessage: mockModule.env.API_RESPONSE_ERROR_MESSAGE ?? 'Internal server error',
            includeTimestamp: mockModule.env.API_RESPONSE_INCLUDE_METADATA ?? true,
            successMessage: 'Success'
        })
    };

    return mockModule;
});

// Mock @repo/service-core to include ServiceError
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual
    };
});

describe('Response Middleware', () => {
    let app: Hono;

    beforeEach(() => {
        app = new Hono();
        app.use(responseFormattingMiddleware);
        app.onError(createErrorHandler());
        vi.clearAllMocks();
    });

    describe('responseFormattingMiddleware', () => {
        it('should format successful responses with metadata', async () => {
            app.get('/test', (c) => {
                return sendFormattedResponse(c, { message: 'success' });
            });

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.data).toEqual({ message: 'success' });
            expect(data.metadata).toBeDefined();
            expect(data.metadata.timestamp).toBeDefined();
            expect(data.metadata.version).toBe('1.0.0');
        });

        it('should handle successful responses without metadata when disabled', async () => {
            // Mock env to disable metadata
            const originalIncludeMetadata = env.API_RESPONSE_INCLUDE_METADATA;
            const originalApiVersion = env.API_RESPONSE_API_VERSION;
            const originalIncludeRequestId = env.API_RESPONSE_INCLUDE_REQUEST_ID;

            // Temporarily disable metadata. API_RESPONSE_API_VERSION='' disables version inclusion.
            (env as any).API_RESPONSE_INCLUDE_METADATA = false;
            (env as any).API_RESPONSE_API_VERSION = '';
            (env as any).API_RESPONSE_INCLUDE_REQUEST_ID = false;

            try {
                app.get('/test-no-metadata', (c) => {
                    // Use a simple response to test the middleware formatting
                    return c.json({ message: 'success' });
                });

                const res = await app.request('/test-no-metadata');

                expect(res.status).toBe(200);
                const data = await res.json();
                expect(data.success).toBe(true);
                expect(data.data).toEqual({ message: 'success' });
                expect(data.metadata).toBeUndefined();
            } finally {
                // Restore original values
                (env as any).API_RESPONSE_INCLUDE_METADATA = originalIncludeMetadata;
                (env as any).API_RESPONSE_API_VERSION = originalApiVersion;
                (env as any).API_RESPONSE_INCLUDE_REQUEST_ID = originalIncludeRequestId;
            }
        });

        it('should format validation errors correctly', async () => {
            app.get('/validation-error', () => {
                const error = new Error('Validation failed');
                error.name = 'ValidationError';
                throw error;
            });

            const res = await app.request('/validation-error');

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toBe('Validation failed');
            expect(data.metadata).toBeDefined();
        });

        it('should format unauthorized errors correctly', async () => {
            app.get('/unauthorized', () => {
                const error = new Error('Access denied');
                error.name = 'UnauthorizedError';
                throw error;
            });

            const res = await app.request('/unauthorized');

            expect(res.status).toBe(401);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
            expect(data.error.message).toBe('Access denied');
        });

        it('should format forbidden errors correctly', async () => {
            app.get('/forbidden', () => {
                const error = new Error('Forbidden');
                error.name = 'ForbiddenError';
                throw error;
            });

            const res = await app.request('/forbidden');

            expect(res.status).toBe(403);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('FORBIDDEN');
            expect(data.error.message).toBe('Forbidden');
        });

        it('should format not found errors correctly', async () => {
            app.get('/not-found', () => {
                const error = new Error('Resource not found');
                error.name = 'NotFoundError';
                throw error;
            });

            const res = await app.request('/not-found');

            expect(res.status).toBe(404);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
            expect(data.error.message).toBe('Resource not found');
        });

        it('should format conflict errors correctly using ServiceError', async () => {
            // Import ServiceError for this test
            const { ServiceError } = await import('@repo/service-core');
            const { ServiceErrorCode } = await import('@repo/schemas');

            app.get('/conflict', () => {
                throw new ServiceError(ServiceErrorCode.ALREADY_EXISTS, 'Already exists');
            });

            const res = await app.request('/conflict');

            expect(res.status).toBe(409);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('ALREADY_EXISTS');
            expect(data.error.message).toBe('Already exists');
        });

        it('should format not implemented errors correctly using ServiceError', async () => {
            // Import ServiceError for this test
            const { ServiceError } = await import('@repo/service-core');
            const { ServiceErrorCode } = await import('@repo/schemas');

            app.get('/not-implemented', () => {
                throw new ServiceError(ServiceErrorCode.NOT_IMPLEMENTED, 'Not implemented');
            });

            const res = await app.request('/not-implemented');

            expect(res.status).toBe(501);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_IMPLEMENTED');
            expect(data.error.message).toBe('Not implemented');
        });

        it('should format LIMIT_REACHED ServiceError with details preserved (regression: SPEC-143 Finding #10)', async () => {
            const { ServiceError } = await import('@repo/service-core');
            const { ServiceErrorCode } = await import('@repo/schemas');

            app.get('/at-limit', () => {
                throw new ServiceError(
                    ServiceErrorCode.LIMIT_REACHED,
                    'Has alcanzado el límite de 1 alojamientos. Actualiza tu plan para obtener más.',
                    {
                        limitKey: 'max_accommodations',
                        currentCount: 1,
                        maxAllowed: 1,
                        usagePercent: 100,
                        upgradeAudience: 'host'
                    }
                );
            });

            const res = await app.request('/at-limit');

            expect(res.status).toBe(403);
            const data = await res.json();
            expect(data.success).toBe(false);
            // Code MUST be the structured LIMIT_REACHED, not a generic FORBIDDEN
            expect(data.error.code).toBe('LIMIT_REACHED');
            expect(data.error.message).toBe(
                'Has alcanzado el límite de 1 alojamientos. Actualiza tu plan para obtener más.'
            );
            // details MUST be a structured object at the top of the error envelope,
            // NOT a JSON-stringified payload nested inside `error.message`
            expect(data.error.details).toMatchObject({
                limitKey: 'max_accommodations',
                currentCount: 1,
                maxAllowed: 1,
                usagePercent: 100,
                upgradeAudience: 'host'
            });
        });

        it('should format ENTITLEMENT_REQUIRED ServiceError with details preserved', async () => {
            const { ServiceError } = await import('@repo/service-core');
            const { ServiceErrorCode } = await import('@repo/schemas');

            app.get('/no-entitlement', () => {
                throw new ServiceError(
                    ServiceErrorCode.ENTITLEMENT_REQUIRED,
                    'Tu plan no incluye esta funcionalidad.',
                    {
                        entitlement: 'can_use_rich_description',
                        upgradeUrl: '/billing/plans'
                    }
                );
            });

            const res = await app.request('/no-entitlement');

            expect(res.status).toBe(403);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('ENTITLEMENT_REQUIRED');
            expect(data.error.details).toMatchObject({
                entitlement: 'can_use_rich_description',
                upgradeUrl: '/billing/plans'
            });
        });

        it('should map PROVIDER_ERROR to HTTP 502 with correct code', async () => {
            const { ServiceError } = await import('@repo/service-core');
            const { ServiceErrorCode } = await import('@repo/schemas');

            app.get('/provider-error', () => {
                throw new ServiceError(
                    ServiceErrorCode.PROVIDER_ERROR,
                    'Payment provider returned an unexpected error',
                    { retryAfter: 30 }
                );
            });

            const res = await app.request('/provider-error');

            expect(res.status).toBe(502);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('PROVIDER_ERROR');
            expect(data.error.message).toBe('Payment provider returned an unexpected error');
        });

        it('should map PROVIDER_RATE_LIMITED to HTTP 503 with correct code', async () => {
            const { ServiceError } = await import('@repo/service-core');
            const { ServiceErrorCode } = await import('@repo/schemas');

            app.get('/provider-rate-limited', () => {
                throw new ServiceError(
                    ServiceErrorCode.PROVIDER_RATE_LIMITED,
                    'Payment provider is throttling requests',
                    { retryAfter: 60 }
                );
            });

            const res = await app.request('/provider-rate-limited');

            expect(res.status).toBe(503);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('PROVIDER_RATE_LIMITED');
            expect(data.error.message).toBe('Payment provider is throttling requests');
        });

        it('should emit Retry-After header for PROVIDER_RATE_LIMITED with retryAfter detail (SPEC-149)', async () => {
            const { ServiceError } = await import('@repo/service-core');
            const { ServiceErrorCode } = await import('@repo/schemas');

            app.get('/provider-rate-limited-header', () => {
                throw new ServiceError(
                    ServiceErrorCode.PROVIDER_RATE_LIMITED,
                    'Payment provider is throttling',
                    { provider: 'payment-provider', operation: 'checkout_create', retryAfter: 45 }
                );
            });

            const res = await app.request('/provider-rate-limited-header');

            expect(res.status).toBe(503);
            // Retry-After header must be present and equal the value from details
            expect(res.headers.get('Retry-After')).toBe('45');
        });

        it('should NOT emit Retry-After header for PROVIDER_RATE_LIMITED without retryAfter detail', async () => {
            const { ServiceError } = await import('@repo/service-core');
            const { ServiceErrorCode } = await import('@repo/schemas');

            app.get('/provider-rate-limited-no-retry', () => {
                throw new ServiceError(
                    ServiceErrorCode.PROVIDER_RATE_LIMITED,
                    'Payment provider is throttling (no retry hint)',
                    { provider: 'payment-provider', operation: 'checkout_create' }
                );
            });

            const res = await app.request('/provider-rate-limited-no-retry');

            expect(res.status).toBe(503);
            // No Retry-After when details.retryAfter is absent
            expect(res.headers.get('Retry-After')).toBeNull();
        });

        it('should NOT emit Retry-After header for non-rate-limited errors even with retryAfter detail', async () => {
            const { ServiceError } = await import('@repo/service-core');
            const { ServiceErrorCode } = await import('@repo/schemas');

            app.get('/provider-timeout-no-retry-header', () => {
                throw new ServiceError(
                    ServiceErrorCode.PROVIDER_TIMEOUT,
                    'Payment provider timed out',
                    { provider: 'payment-provider', operation: 'checkout_create', retryAfter: 10 }
                );
            });

            const res = await app.request('/provider-timeout-no-retry-header');

            expect(res.status).toBe(504);
            // PROVIDER_TIMEOUT should NOT emit Retry-After — only PROVIDER_RATE_LIMITED does
            expect(res.headers.get('Retry-After')).toBeNull();
        });

        it('should map PROVIDER_TIMEOUT to HTTP 504 with correct code', async () => {
            const { ServiceError } = await import('@repo/service-core');
            const { ServiceErrorCode } = await import('@repo/schemas');

            app.get('/provider-timeout', () => {
                throw new ServiceError(
                    ServiceErrorCode.PROVIDER_TIMEOUT,
                    'Payment provider did not respond in time',
                    { retryAfter: 10 }
                );
            });

            const res = await app.request('/provider-timeout');

            expect(res.status).toBe(504);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('PROVIDER_TIMEOUT');
            expect(data.error.message).toBe('Payment provider did not respond in time');
        });

        it('should map PLAN_DISABLED to HTTP 410 with correct code (SPEC-148 T-003)', async () => {
            const { ServiceError } = await import('@repo/service-core');
            const { ServiceErrorCode } = await import('@repo/schemas');

            app.get('/plan-disabled', () => {
                throw new ServiceError(
                    ServiceErrorCode.PLAN_DISABLED,
                    'The selected plan is no longer available'
                );
            });

            const res = await app.request('/plan-disabled');

            expect(res.status).toBe(410);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('PLAN_DISABLED');
            expect(data.error.message).toBe('The selected plan is no longer available');
        });

        it('should format generic errors as internal server error', async () => {
            app.get('/generic-error', () => {
                throw new Error('Something went wrong');
            });

            const res = await app.request('/generic-error');

            // Generic errors are hidden behind a generic message for security
            expect(res.status).toBe(500);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
            expect(data.error.message).toBe('Internal server error');
        });

        it('should include request ID in headers and metadata', async () => {
            app.get('/test', (c) => {
                c.set('requestId', 'test-request-123');
                return sendFormattedResponse(c, { message: 'success' });
            });

            const res = await app.request('/test');

            expect(res.headers.get('X-Request-ID')).toBe('test-request-123');
            const data = await res.json();
            expect(data.metadata.requestId).toBe('test-request-123');
        });

        it('should include API version in headers', async () => {
            app.get('/test', (c) => {
                return sendFormattedResponse(c, { message: 'success' });
            });

            const res = await app.request('/test');

            expect(res.headers.get('X-API-Version')).toBe('1.0.0');
        });

        it('should skip formatting when disabled', async () => {
            // Mock env to disable formatting
            const originalEnabled = env.API_RESPONSE_FORMAT_ENABLED;

            // Temporarily disable formatting
            (env as any).API_RESPONSE_FORMAT_ENABLED = false;

            try {
                app.get('/test-disabled', (c) => {
                    return c.json({ message: 'success' });
                });

                const res = await app.request('/test-disabled');

                expect(res.status).toBe(200);
                const data = await res.json();
                expect(data).toEqual({ message: 'success' });
                expect(data.success).toBeUndefined();
            } finally {
                // Restore original value
                (env as any).API_RESPONSE_FORMAT_ENABLED = originalEnabled;
            }
        });
    });

    describe('createErrorResponse', () => {
        it('should create formatted error response', () => {
            const response = createErrorResponse('CUSTOM_ERROR', 'Custom error message', 400, {
                field: 'test'
            });

            expect(response.success).toBe(false);
            expect(response.error?.code).toBe('CUSTOM_ERROR');
            expect(response.error?.message).toBe('Custom error message');
            expect(response.error?.details).toEqual({ field: 'test' });
            expect(response.metadata).toBeDefined();
            expect(response.metadata?.timestamp).toBeDefined();
        });

        it('should create error response without details', () => {
            const response = createErrorResponse('SIMPLE_ERROR', 'Simple error');

            expect(response.success).toBe(false);
            expect(response.error?.code).toBe('SIMPLE_ERROR');
            expect(response.error?.message).toBe('Simple error');
            expect(response.error?.details).toBeUndefined();
        });

        it('should use default status code', () => {
            const response = createErrorResponse('DEFAULT_ERROR', 'Default error');

            expect(response.success).toBe(false);
            expect(response.error?.code).toBe('DEFAULT_ERROR');
        });
    });

    describe('createSuccessResponse', () => {
        it('should create formatted success response', () => {
            const data = { id: 1, name: 'Test' };
            const response = createSuccessResponse(data);

            expect(response.success).toBe(true);
            expect(response.data).toEqual(data);
            expect(response.metadata).toBeDefined();
            expect(response.metadata?.timestamp).toBeDefined();
        });

        it('should create success response with pagination', () => {
            const data = [{ id: 1 }, { id: 2 }];
            const pagination = {
                page: 1,
                pageSize: 10,
                total: 100,
                totalPages: 10,
                hasNextPage: true,
                hasPreviousPage: false
            };
            const response = createSuccessResponse(data, 200, pagination);

            expect(response.success).toBe(true);
            expect(response.data).toEqual(data);
            expect(response.metadata?.pagination).toEqual(pagination);
        });

        it('should handle different data types', () => {
            const stringData = 'test string';
            const numberData = 42;
            const arrayData = [1, 2, 3];

            const stringResponse = createSuccessResponse(stringData);
            const numberResponse = createSuccessResponse(numberData);
            const arrayResponse = createSuccessResponse(arrayData);

            expect(stringResponse.data).toBe(stringData);
            expect(numberResponse.data).toBe(numberData);
            expect(arrayResponse.data).toEqual(arrayData);
        });
    });

    describe('Edge Cases', () => {
        it('should handle generic Error objects', async () => {
            app.get('/generic-error', () => {
                throw new Error('Generic error without specific name');
            });

            const res = await app.request('/generic-error');

            // Generic errors are hidden for security - actual message is masked
            expect(res.status).toBe(500);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
            expect(data.error.message).toBe('Internal server error');
        });

        it('should handle null and undefined data', () => {
            const nullResponse = createSuccessResponse(null);
            const undefinedResponse = createSuccessResponse(undefined);

            expect(nullResponse.data).toBeNull();
            expect(undefinedResponse.data).toBeUndefined();
        });

        it('should handle complex pagination data', () => {
            const pagination = {
                page: 5,
                pageSize: 25,
                total: 1000,
                totalPages: 40,
                hasNextPage: true,
                hasPreviousPage: true
            };
            const response = createSuccessResponse([], 200, pagination);

            expect(response.metadata?.pagination).toEqual(pagination);
        });
    });

    describe('DB pool exhaustion → 503 (isDbPoolExhausted)', () => {
        it('should map pg pool-timeout message to HTTP 503 with SERVICE_UNAVAILABLE code', async () => {
            // Arrange
            app.get('/db-pool-timeout', () => {
                throw new Error(
                    'timeout exceeded when trying to connect (node-postgres pool exhausted)'
                );
            });

            // Act
            const res = await app.request('/db-pool-timeout');

            // Assert
            expect(res.status).toBe(503);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('SERVICE_UNAVAILABLE');
            expect(data.error.message).toBe('Database temporarily unavailable — please retry');
        });

        it('should map postgres max_connections message to HTTP 503 with SERVICE_UNAVAILABLE code', async () => {
            // Arrange
            app.get('/db-too-many-clients', () => {
                throw new Error('sorry, too many clients already');
            });

            // Act
            const res = await app.request('/db-too-many-clients');

            // Assert
            expect(res.status).toBe(503);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('SERVICE_UNAVAILABLE');
            expect(data.error.message).toBe('Database temporarily unavailable — please retry');
        });

        it('should map "connection timeout" message to HTTP 503', async () => {
            // Arrange
            app.get('/db-conn-timeout', () => {
                throw new Error('connection timeout after 5000ms');
            });

            // Act
            const res = await app.request('/db-conn-timeout');

            // Assert
            expect(res.status).toBe(503);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('SERVICE_UNAVAILABLE');
        });

        it('should map "pool is draining" message to HTTP 503', async () => {
            // Arrange
            app.get('/db-pool-draining', () => {
                throw new Error('pool is draining and cannot accept work');
            });

            // Act
            const res = await app.request('/db-pool-draining');

            // Assert
            expect(res.status).toBe(503);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('SERVICE_UNAVAILABLE');
        });

        it('should match pool-exhaustion messages case-insensitively (uppercase variant)', async () => {
            // isDbPoolExhausted lowercases before matching — ensure uppercase input is caught
            app.get('/db-upper-case', () => {
                throw new Error('TIMEOUT EXCEEDED WHEN TRYING TO CONNECT');
            });

            const res = await app.request('/db-upper-case');

            expect(res.status).toBe(503);
            const data = await res.json();
            expect(data.error.code).toBe('SERVICE_UNAVAILABLE');
        });

        it('should NOT map an unrelated error message to 503 (regression guard)', async () => {
            // A plain Error that has nothing to do with pool exhaustion must still hit the 500 catch-all
            app.get('/unrelated-error', () => {
                throw new Error('something completely unrelated went wrong');
            });

            const res = await app.request('/unrelated-error');

            expect(res.status).toBe(500);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
            // The catch-all masks the real message with the generic error message from config
            expect(data.error.message).toBe('Internal server error');
        });
    });
});
