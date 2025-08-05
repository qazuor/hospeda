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
vi.mock('../../src/utils/env', () => ({
    env: {
        RESPONSE_FORMAT_ENABLED: true,
        RESPONSE_INCLUDE_METADATA: true,
        RESPONSE_INCLUDE_VERSION: true,
        RESPONSE_INCLUDE_REQUEST_ID: true,
        RESPONSE_API_VERSION: '1.0.0',
        RESPONSE_ERROR_MESSAGE: 'Internal server error'
    }
}));

// Note: ServiceErrorCode is now imported directly via alias, no mock needed

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
            const originalIncludeMetadata = env.RESPONSE_INCLUDE_METADATA;
            const originalIncludeVersion = env.RESPONSE_INCLUDE_VERSION;
            const originalIncludeRequestId = env.RESPONSE_INCLUDE_REQUEST_ID;

            // Temporarily disable metadata
            (env as any).RESPONSE_INCLUDE_METADATA = false;
            (env as any).RESPONSE_INCLUDE_VERSION = false;
            (env as any).RESPONSE_INCLUDE_REQUEST_ID = false;

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
                (env as any).RESPONSE_INCLUDE_METADATA = originalIncludeMetadata;
                (env as any).RESPONSE_INCLUDE_VERSION = originalIncludeVersion;
                (env as any).RESPONSE_INCLUDE_REQUEST_ID = originalIncludeRequestId;
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

        it('should format conflict errors correctly', async () => {
            app.get('/conflict', () => {
                const error = new Error('Already exists');
                error.name = 'ConflictError';
                throw error;
            });

            const res = await app.request('/conflict');

            expect(res.status).toBe(409);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('ALREADY_EXISTS');
            expect(data.error.message).toBe('Already exists');
        });

        it('should format not implemented errors correctly', async () => {
            app.get('/not-implemented', () => {
                const error = new Error('Not implemented');
                error.name = 'NotImplementedError';
                throw error;
            });

            const res = await app.request('/not-implemented');

            expect(res.status).toBe(501);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_IMPLEMENTED');
            expect(data.error.message).toBe('Not implemented');
        });

        it('should format generic errors as internal server error', async () => {
            app.get('/generic-error', () => {
                throw new Error('Something went wrong');
            });

            const res = await app.request('/generic-error');

            expect(res.status).toBe(500);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
            expect(data.error.message).toBe('Something went wrong');
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
            const originalEnabled = env.RESPONSE_FORMAT_ENABLED;

            // Temporarily disable formatting
            (env as any).RESPONSE_FORMAT_ENABLED = false;

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
                (env as any).RESPONSE_FORMAT_ENABLED = originalEnabled;
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
                limit: 10,
                total: 100,
                totalPages: 10
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

            expect(res.status).toBe(500);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
            expect(data.error.message).toBe('Generic error without specific name');
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
                limit: 25,
                total: 1000,
                totalPages: 40
            };
            const response = createSuccessResponse([], 200, pagination);

            expect(response.metadata?.pagination).toEqual(pagination);
        });
    });
});
