import { Hono } from 'hono';
/**
 * Validation Middleware Tests
 * Tests the request validation functionality including headers, content-type, body size, and sanitization
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createValidationMiddleware } from '../../src/middlewares/validation';
import { ValidationErrorCode } from '../../src/types/validation-errors.enum';

// Mock environment
vi.mock('../../src/utils/env', () => ({
    env: {
        VALIDATION_MAX_BODY_SIZE: 10485760, // 10MB
        VALIDATION_MAX_REQUEST_TIME: 30000,
        VALIDATION_ALLOWED_CONTENT_TYPES: 'application/json,multipart/form-data',
        VALIDATION_REQUIRED_HEADERS: 'user-agent',
        VALIDATION_SANITIZE_REMOVE_HTML_TAGS: true,
        VALIDATION_SANITIZE_MAX_STRING_LENGTH: 1000,
        VALIDATION_SANITIZE_ALLOWED_CHARS: '/[\\w\\s\\-.,!?@#$%&*()+=]/g',
        VALIDATION_CLERK_AUTH_ENABLED: true,
        VALIDATION_CLERK_AUTH_HEADERS: 'authorization'
    }
}));

// Mock sanitization functions
vi.mock('../../src/middlewares/sanitization', () => ({
    sanitizeHeaders: vi.fn((headers) => headers),
    sanitizeObjectStrings: vi.fn((obj) => obj),
    sanitizeQueryParams: vi.fn((params) => params)
}));

// Mock zod error transformer
vi.mock('../../src/utils/zod-error-transformer', () => ({
    transformZodError: vi.fn((error) => ({
        code: 'ZOD_VALIDATION_FAILED',
        message: 'Validation failed',
        details: error.errors
    }))
}));

describe('Validation Middleware', () => {
    let app: Hono;

    beforeEach(() => {
        app = new Hono();
        app.use(createValidationMiddleware());
        app.get('/test', (c) => c.json({ message: 'success' }));
        app.post('/test', (c) => c.json({ message: 'posted' }));
        app.put('/test', (c) => c.json({ message: 'updated' }));
        app.delete('/test', (c) => c.json({ message: 'deleted' }));
    });

    describe('Content-Type Validation', () => {
        it('should allow valid content types', async () => {
            const res = await app.request('/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'test-agent'
                },
                body: JSON.stringify({ data: 'test' })
            });

            expect(res.status).toBe(200);
        });

        it('should reject invalid content types', async () => {
            const res = await app.request('/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain',
                    'User-Agent': 'test-agent'
                },
                body: 'invalid content type'
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe(ValidationErrorCode.INVALID_CONTENT_TYPE);
        });

        it('should allow multipart/form-data', async () => {
            const res = await app.request('/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'multipart/form-data; boundary=test',
                    'User-Agent': 'test-agent'
                }
            });

            expect(res.status).toBe(200);
        });

        it('should allow requests without content-type for GET requests', async () => {
            const res = await app.request('/test', {
                headers: {
                    'User-Agent': 'test-agent'
                }
            });

            expect(res.status).toBe(200);
        });
    });

    describe('Accept Header Validation', () => {
        it('should allow requests with valid Accept header', async () => {
            const res = await app.request('/test', {
                headers: {
                    'User-Agent': 'test-agent',
                    Accept: 'application/json'
                }
            });

            expect(res.status).toBe(200);
        });

        it('should allow requests with wildcard Accept header', async () => {
            const res = await app.request('/test', {
                headers: {
                    'User-Agent': 'test-agent',
                    Accept: '*/*'
                }
            });

            expect(res.status).toBe(200);
        });

        it('should reject requests with invalid Accept header', async () => {
            const res = await app.request('/test', {
                headers: {
                    'User-Agent': 'test-agent',
                    Accept: 'text/html'
                }
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe(ValidationErrorCode.INVALID_ACCEPT_HEADER);
        });

        it('should allow requests without Accept header', async () => {
            const res = await app.request('/test', {
                headers: {
                    'User-Agent': 'test-agent'
                }
            });

            expect(res.status).toBe(200);
        });
    });

    describe('Required Headers Validation', () => {
        it('should require user-agent header', async () => {
            const res = await app.request('/test');

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe(ValidationErrorCode.MISSING_REQUIRED_HEADER);
        });

        it('should accept requests with user-agent header', async () => {
            const res = await app.request('/test', {
                headers: {
                    'User-Agent': 'test-agent'
                }
            });

            expect(res.status).toBe(200);
        });

        it('should be case insensitive for header names', async () => {
            const res = await app.request('/test', {
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            expect(res.status).toBe(200);
        });
    });

    describe('Authorization Header Validation', () => {
        it('should validate Bearer token format', async () => {
            const res = await app.request('/test', {
                headers: {
                    'User-Agent': 'test-agent',
                    Authorization: 'Bearer valid-token-123456789'
                }
            });

            expect(res.status).toBe(200);
        });

        it('should reject invalid authorization format', async () => {
            const res = await app.request('/test', {
                headers: {
                    'User-Agent': 'test-agent',
                    Authorization: 'Basic dXNlcjpwYXNz'
                }
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe(ValidationErrorCode.INVALID_AUTHORIZATION_FORMAT);
        });

        it('should reject short tokens', async () => {
            const res = await app.request('/test', {
                headers: {
                    'User-Agent': 'test-agent',
                    Authorization: 'Bearer short'
                }
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe(ValidationErrorCode.INVALID_AUTHORIZATION_FORMAT);
        });

        it('should allow requests without authorization header', async () => {
            const res = await app.request('/test', {
                headers: {
                    'User-Agent': 'test-agent'
                }
            });

            expect(res.status).toBe(200);
        });
    });

    describe('Body Size Validation', () => {
        it('should allow requests within size limit', async () => {
            const smallBody = JSON.stringify({ data: 'small' });
            const res = await app.request('/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'test-agent',
                    'Content-Length': smallBody.length.toString()
                },
                body: smallBody
            });

            expect(res.status).toBe(200);
        });

        it('should reject requests exceeding size limit', async () => {
            const res = await app.request('/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'test-agent',
                    'Content-Length': '20000000' // 20MB, exceeds 10MB limit
                },
                body: 'x'.repeat(20000000)
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe(ValidationErrorCode.REQUEST_TOO_LARGE);
        });

        it('should allow requests without content-length header', async () => {
            const res = await app.request('/test', {
                headers: {
                    'User-Agent': 'test-agent'
                }
            });

            expect(res.status).toBe(200);
        });
    });

    describe('Manual Zod Validation', () => {
        const testSchema = z.object({
            name: z.string().min(1),
            email: z.string().email(),
            age: z.number().min(18)
        });

        it('should validate request body with Zod schema', async () => {
            const appWithSchema = new Hono();
            appWithSchema.use(
                createValidationMiddleware({
                    manualZodSchema: testSchema
                })
            );
            appWithSchema.post('/test', (c) => c.json({ message: 'success' }));

            const res = await appWithSchema.request('/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'test-agent'
                },
                body: JSON.stringify({
                    name: 'John Doe',
                    email: 'john@example.com',
                    age: 25
                })
            });

            expect(res.status).toBe(200);
        });

        it('should reject invalid request body with Zod schema', async () => {
            const appWithSchema = new Hono();
            appWithSchema.use(
                createValidationMiddleware({
                    manualZodSchema: testSchema
                })
            );
            appWithSchema.post('/test', (c) => c.json({ message: 'success' }));

            const res = await appWithSchema.request('/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'test-agent'
                },
                body: JSON.stringify({
                    name: '',
                    email: 'invalid-email',
                    age: 15
                })
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('ZOD_VALIDATION_FAILED');
        });

        it('should handle malformed JSON with Zod schema', async () => {
            const appWithSchema = new Hono();
            // Add global error handler to catch JSON parsing errors
            appWithSchema.onError((error, c) => {
                if (error instanceof SyntaxError && error.message.includes('JSON')) {
                    return c.json(
                        {
                            success: false,
                            error: {
                                code: 'INVALID_JSON',
                                message: 'validationError.json.invalid',
                                translatedMessage: 'Invalid JSON format'
                            },
                            metadata: {
                                timestamp: new Date().toISOString(),
                                requestId: c.req.header('x-request-id') || 'unknown'
                            }
                        },
                        400
                    );
                }
                throw error;
            });
            appWithSchema.use(
                createValidationMiddleware({
                    manualZodSchema: testSchema
                })
            );
            appWithSchema.post('/test', (c) => c.json({ message: 'success' }));

            const res = await appWithSchema.request('/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'test-agent'
                },
                body: 'invalid json'
            });

            // Malformed JSON should now return 400 with INVALID_JSON code
            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INVALID_JSON');
        });
    });

    describe('Sanitization', () => {
        it('should sanitize headers when enabled', async () => {
            const { sanitizeHeaders } = await import('../../src/middlewares/sanitization');
            const mockSanitizeHeaders = vi.mocked(sanitizeHeaders);

            const res = await app.request('/test', {
                headers: {
                    'User-Agent': 'test-agent',
                    'X-Custom-Header': 'test-value'
                }
            });

            expect(res.status).toBe(200);
            expect(mockSanitizeHeaders).toHaveBeenCalled();
        });

        it('should sanitize query parameters when enabled', async () => {
            const { sanitizeQueryParams } = await import('../../src/middlewares/sanitization');
            const mockSanitizeQueryParams = vi.mocked(sanitizeQueryParams);

            const res = await app.request('/test?param=value&other=123', {
                headers: {
                    'User-Agent': 'test-agent'
                }
            });

            expect(res.status).toBe(200);
            expect(mockSanitizeQueryParams).toHaveBeenCalled();
        });

        it('should skip sanitization when disabled', async () => {
            const appWithoutSanitization = new Hono();
            appWithoutSanitization.use(
                createValidationMiddleware({
                    skipSanitization: true
                })
            );
            appWithoutSanitization.get('/test', (c) => c.json({ message: 'success' }));

            const { sanitizeHeaders, sanitizeQueryParams } = await import(
                '../../src/middlewares/sanitization'
            );
            const mockSanitizeHeaders = vi.mocked(sanitizeHeaders);
            const mockSanitizeQueryParams = vi.mocked(sanitizeQueryParams);

            // Clear previous calls
            mockSanitizeHeaders.mockClear();
            mockSanitizeQueryParams.mockClear();

            const res = await appWithoutSanitization.request('/test?param=value', {
                headers: {
                    'User-Agent': 'test-agent'
                }
            });

            expect(res.status).toBe(200);
            expect(mockSanitizeHeaders).not.toHaveBeenCalled();
            expect(mockSanitizeQueryParams).not.toHaveBeenCalled();
        });
    });

    describe('Custom Configuration', () => {
        it('should use custom validation configuration', async () => {
            const customApp = new Hono();
            customApp.use(
                createValidationMiddleware({
                    config: {
                        requiredHeaders: ['user-agent', 'x-custom-header'],
                        maxBodySize: 1024 // 1KB
                    }
                })
            );
            customApp.post('/test', (c) => c.json({ message: 'success' }));

            // Should fail without custom header
            const res1 = await customApp.request('/test', {
                method: 'POST',
                headers: {
                    'User-Agent': 'test-agent'
                }
            });

            expect(res1.status).toBe(400);

            // Should pass with custom header
            const res2 = await customApp.request('/test', {
                method: 'POST',
                headers: {
                    'User-Agent': 'test-agent',
                    'X-Custom-Header': 'test-value'
                }
            });

            expect(res2.status).toBe(200);
        });

        it('should merge custom config with defaults', async () => {
            const customApp = new Hono();
            customApp.use(
                createValidationMiddleware({
                    config: {
                        maxBodySize: 1024 // Override only body size
                    }
                })
            );
            customApp.post('/test', (c) => c.json({ message: 'success' }));

            // Should still require user-agent (default)
            const res = await customApp.request('/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            expect(res.status).toBe(400);
        });
    });

    describe('Error Handling', () => {
        it('should return standardized error format', async () => {
            const res = await app.request('/test', {
                headers: {
                    'Content-Type': 'text/plain'
                }
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error).toHaveProperty('code');
            expect(data.error).toHaveProperty('message');
            expect(data.metadata).toHaveProperty('timestamp');
            expect(data.metadata).toHaveProperty('requestId');
        });

        it('should include request ID in error response', async () => {
            const res = await app.request('/test', {
                headers: {
                    'X-Request-ID': 'test-request-123'
                }
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.metadata.requestId).toBe('test-request-123');
        });

        it('should use unknown for request ID when not provided', async () => {
            const res = await app.request('/test', {
                headers: {
                    'Content-Type': 'text/plain'
                }
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.metadata.requestId).toBe('unknown');
        });

        it('should re-throw non-validation errors', async () => {
            const appWithError = new Hono();
            appWithError.use(createValidationMiddleware());
            appWithError.get('/error', () => {
                throw new Error('Internal server error');
            });

            // Hono handles errors automatically, so we get a 500 response
            const res = await appWithError.request('/error', {
                headers: {
                    'User-Agent': 'test-agent'
                }
            });

            expect(res.status).toBe(500);
        });
    });

    describe('HTTP Methods', () => {
        it('should validate POST requests', async () => {
            const res = await app.request('/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'test-agent'
                },
                body: JSON.stringify({ data: 'test' })
            });

            expect(res.status).toBe(200);
        });

        it('should validate PUT requests', async () => {
            const res = await app.request('/test', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'test-agent'
                },
                body: JSON.stringify({ data: 'test' })
            });

            expect(res.status).toBe(200);
        });

        it('should validate DELETE requests', async () => {
            const res = await app.request('/test', {
                method: 'DELETE',
                headers: {
                    'User-Agent': 'test-agent'
                }
            });

            expect(res.status).toBe(200);
        });
    });
});
