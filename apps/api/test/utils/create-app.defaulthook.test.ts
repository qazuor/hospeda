/**
 * Tests for createRouter defaultHook validation behavior.
 *
 * These tests exercise the real OpenAPIHono instance (no mocks of the Hono
 * internals) to verify that the defaultHook transforms Zod validation errors
 * into the standard API error envelope on HTTP 400 responses.
 *
 * All middleware modules that trigger environment validation at import-time are
 * mocked so they do not call process.exit in the test environment.
 */

import { createRoute, z } from '@hono/zod-openapi';
import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock every middleware that performs top-level side effects (env validation,
// external connections, etc.). We must mock these before importing create-app.
// ---------------------------------------------------------------------------

vi.mock('../../src/middlewares/actor', () => ({
    actorMiddleware: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => next())
}));

vi.mock('../../src/middlewares/auth', () => ({
    authMiddleware: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => next())
}));

vi.mock('../../src/middlewares/billing', () => ({
    billingMiddleware: async (_c: unknown, next: () => Promise<void>) => next()
}));

vi.mock('../../src/middlewares/billing-customer', () => ({
    billingCustomerMiddleware: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => next())
}));

vi.mock('../../src/middlewares/cache', () => ({
    cacheMiddleware: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => next())
}));

vi.mock('../../src/middlewares/compression', () => ({
    compressionMiddleware: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => next())
}));

vi.mock('../../src/middlewares/cors', () => ({
    corsMiddleware: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => next())
}));

vi.mock('../../src/middlewares/entitlement', () => ({
    entitlementMiddleware: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => next())
}));

vi.mock('../../src/middlewares/logger', () => ({
    loggerMiddleware: async (_c: unknown, next: () => Promise<void>) => next()
}));

vi.mock('../../src/middlewares/metrics', () => ({
    metricsMiddleware: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => next())
}));

vi.mock('../../src/middlewares/rate-limit', () => ({
    rateLimitMiddleware: async (_c: unknown, next: () => Promise<void>) => next()
}));

vi.mock('../../src/middlewares/response', () => ({
    responseFormattingMiddleware: async (_c: unknown, next: () => Promise<void>) => next(),
    createErrorHandler: vi.fn(
        () => (_err: unknown, c: { json: (b: unknown, s: number) => unknown }) =>
            c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'error' } }, 500)
    )
}));

vi.mock('../../src/middlewares/response-validator', () => ({
    responseValidatorMiddleware: async (_c: unknown, next: () => Promise<void>) => next()
}));

vi.mock('../../src/middlewares/security', () => ({
    securityHeadersMiddleware: async (_c: unknown, next: () => Promise<void>) => next(),
    originVerificationMiddleware: async (_c: unknown, next: () => Promise<void>) => next()
}));

vi.mock('../../src/middlewares/sentry', () => ({
    sentryMiddleware: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => next())
}));

vi.mock('../../src/middlewares/trial', () => ({
    trialMiddleware: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => next())
}));

vi.mock('../../src/middlewares/validation', () => ({
    validationMiddleware: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => next())
}));

vi.mock('hono/request-id', () => ({
    requestId: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => next())
}));

// ---------------------------------------------------------------------------
// Now it is safe to import createRouter — env validation will not run.
// ---------------------------------------------------------------------------

import { createRouter } from '../../src/utils/create-app';

// ---------------------------------------------------------------------------
// Shared test route definition
// ---------------------------------------------------------------------------

const bodySchema = z.object({
    name: z.string().min(2, 'zodError.test.name.min')
});

const testRoute = createRoute({
    method: 'post',
    path: '/test',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: bodySchema
                }
            }
        }
    },
    responses: {
        200: { description: 'OK' }
    }
});

/**
 * Creates a fresh router with the standard test route registered.
 * Using a factory avoids state leakage between test cases.
 */
function buildRouter() {
    const router = createRouter();
    router.openapi(testRoute, (c) => {
        return c.json({ success: true, data: 'ok' }, 200);
    });
    return router;
}

/**
 * Helper that sends a POST /test request and returns the parsed JSON body
 * along with the HTTP status code.
 */
async function postTest(
    router: ReturnType<typeof buildRouter>,
    payload: unknown
): Promise<{ status: number; body: Record<string, unknown> }> {
    const res = await router.request('/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const body = (await res.json()) as Record<string, unknown>;
    return { status: res.status, body };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('createRouter defaultHook', () => {
    describe('when request body fails validation', () => {
        it('should return HTTP 400 for an empty body object', async () => {
            // Arrange
            const router = buildRouter();

            // Act
            const { status } = await postTest(router, {});

            // Assert
            expect(status).toBe(400);
        });

        it('should return HTTP 400 when name is an empty string', async () => {
            // Arrange
            const router = buildRouter();

            // Act
            const { status } = await postTest(router, { name: '' });

            // Assert
            expect(status).toBe(400);
        });

        it('should return HTTP 400 when name is too short (1 character)', async () => {
            // Arrange
            const router = buildRouter();

            // Act
            const { status } = await postTest(router, { name: 'x' });

            // Assert
            expect(status).toBe(400);
        });

        it('should set success: false in the response envelope', async () => {
            // Arrange
            const router = buildRouter();

            // Act
            const { body } = await postTest(router, {});

            // Assert
            expect(body.success).toBe(false);
        });

        it('should include error.code === "VALIDATION_ERROR"', async () => {
            // Arrange
            const router = buildRouter();

            // Act
            const { body } = await postTest(router, {});

            // Assert
            const error = body.error as Record<string, unknown>;
            expect(error).toBeDefined();
            expect(error.code).toBe('VALIDATION_ERROR');
        });

        it('should include error.details as a non-empty array', async () => {
            // Arrange
            const router = buildRouter();

            // Act
            const { body } = await postTest(router, {});

            // Assert
            const error = body.error as Record<string, unknown>;
            expect(Array.isArray(error.details)).toBe(true);
            expect((error.details as unknown[]).length).toBeGreaterThan(0);
        });

        it('should include field-level info in each details entry', async () => {
            // Arrange
            const router = buildRouter();

            // Act
            const { body } = await postTest(router, {});

            // Assert
            const error = body.error as Record<string, unknown>;
            const firstEntry = (error.details as Record<string, unknown>[])[0];
            expect(firstEntry).toBeDefined();
            expect(typeof firstEntry?.field).toBe('string');
            expect(typeof firstEntry?.messageKey).toBe('string');
            expect(typeof firstEntry?.code).toBe('string');
        });

        it('should include error.summary with totalErrors and fieldCount', async () => {
            // Arrange
            const router = buildRouter();

            // Act
            const { body } = await postTest(router, {});

            // Assert
            const error = body.error as Record<string, unknown>;
            const summary = error.summary as Record<string, unknown>;
            expect(summary).toBeDefined();
            expect(typeof summary.totalErrors).toBe('number');
            expect(typeof summary.fieldCount).toBe('number');
            expect(summary.totalErrors).toBeGreaterThan(0);
            expect(summary.fieldCount).toBeGreaterThan(0);
        });

        it('should include summary.errorsByField as an object', async () => {
            // Arrange
            const router = buildRouter();

            // Act
            const { body } = await postTest(router, {});

            // Assert
            const error = body.error as Record<string, unknown>;
            const summary = error.summary as Record<string, unknown>;
            expect(typeof summary.errorsByField).toBe('object');
            expect(summary.errorsByField).not.toBeNull();
        });

        it('should include a metadata object with timestamp', async () => {
            // Arrange
            const router = buildRouter();

            // Act
            const { body } = await postTest(router, {});

            // Assert
            const metadata = body.metadata as Record<string, unknown>;
            expect(metadata).toBeDefined();
            expect(typeof metadata.timestamp).toBe('string');
        });
    });

    describe('when request body is valid', () => {
        it('should return HTTP 200 for a valid name (2+ characters)', async () => {
            // Arrange
            const router = buildRouter();

            // Act
            const { status } = await postTest(router, { name: 'ab' });

            // Assert
            expect(status).toBe(200);
        });

        it('should return success: true for a valid request', async () => {
            // Arrange
            const router = buildRouter();

            // Act
            const { body } = await postTest(router, { name: 'test' });

            // Assert
            expect(body.success).toBe(true);
        });

        it('should return the handler data for a valid request', async () => {
            // Arrange
            const router = buildRouter();

            // Act
            const { body } = await postTest(router, { name: 'hello' });

            // Assert
            expect(body.data).toBe('ok');
        });
    });

    describe('per-route hook override', () => {
        it('should use the per-route hook instead of defaultHook when provided', async () => {
            // Arrange - build a route with its own hook that returns a custom 422 response
            const routeWithHook = createRoute({
                method: 'post',
                path: '/custom',
                request: {
                    body: {
                        content: {
                            'application/json': {
                                schema: z.object({ value: z.number() })
                            }
                        }
                    }
                },
                responses: {
                    200: { description: 'OK' },
                    422: { description: 'Custom validation error' }
                }
            });

            const router = createRouter();
            router.openapi(
                routeWithHook,
                (c) => {
                    return c.json({ success: true, data: 'ok' }, 200);
                },
                // Per-route hook: returns a custom 422 instead of the default 400
                (_result, c) => {
                    return c.json(
                        {
                            success: false,
                            error: { code: 'CUSTOM_HOOK_ERROR', message: 'custom hook fired' }
                        },
                        422
                    );
                }
            );

            // Act - send an invalid payload (value is not a number)
            const res = await router.request('/custom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: 'not-a-number' })
            });
            const body = (await res.json()) as Record<string, unknown>;

            // Assert - the per-route hook 422 should be used, NOT the defaultHook 400
            expect(res.status).toBe(422);
            expect(body.success).toBe(false);
            const error = body.error as Record<string, unknown>;
            expect(error.code).toBe('CUSTOM_HOOK_ERROR');
        });

        it('should not interfere with defaultHook on other routes in the same router', async () => {
            // Arrange - register both a per-route hook route and the standard route
            const routeWithHook = createRoute({
                method: 'post',
                path: '/custom',
                request: {
                    body: {
                        content: {
                            'application/json': {
                                schema: z.object({ value: z.number() })
                            }
                        }
                    }
                },
                responses: {
                    200: { description: 'OK' }
                }
            });

            const router = createRouter();

            // Register a per-route hook on /custom
            router.openapi(
                routeWithHook,
                (c) => c.json({ success: true, data: 'ok' }, 200),
                (_result, c) =>
                    c.json(
                        {
                            success: false,
                            error: { code: 'CUSTOM_HOOK_ERROR', message: 'custom hook' }
                        },
                        422
                    )
            );

            // Register the standard /test route (uses defaultHook)
            router.openapi(testRoute, (c) => {
                return c.json({ success: true, data: 'ok' }, 200);
            });

            // Act - hit the standard /test route with an invalid payload
            const { status, body } = await postTest(router, {});

            // Assert - defaultHook still fires for the /test route and returns 400
            expect(status).toBe(400);
            const error = body.error as Record<string, unknown>;
            expect(error.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('query param validation (GAP-023)', () => {
        const queryRoute = createRoute({
            method: 'get',
            path: '/search',
            request: {
                query: z.object({
                    q: z.string().min(2, 'zodError.test.q.min'),
                    page: z.coerce.number().min(1).optional()
                })
            },
            responses: {
                200: { description: 'OK' }
            }
        });

        it('should return HTTP 200 when query params are valid', async () => {
            // Arrange
            const router = createRouter();
            router.openapi(queryRoute, (c) => c.json({ success: true, data: 'ok' }, 200));

            // Act
            const res = await router.request('/search?q=ab&page=1');

            // Assert
            expect(res.status).toBe(200);
        });

        it('should return HTTP 400 with field errors when query params are invalid', async () => {
            // Arrange
            const router = createRouter();
            router.openapi(queryRoute, (c) => c.json({ success: true, data: 'ok' }, 200));

            // Act - 'q' is too short (1 char < min 2)
            const res = await router.request('/search?q=x');
            const body = (await res.json()) as Record<string, unknown>;

            // Assert
            expect(res.status).toBe(400);
            expect(body.success).toBe(false);
            const error = body.error as Record<string, unknown>;
            expect(error.code).toBe('VALIDATION_ERROR');
            expect(Array.isArray(error.details)).toBe(true);
            expect((error.details as unknown[]).length).toBeGreaterThan(0);
        });
    });

    describe('path param validation (GAP-023)', () => {
        const paramRoute = createRoute({
            method: 'get',
            path: '/items/{id}',
            request: {
                params: z.object({
                    id: z.string().uuid('zodError.test.id.uuid')
                })
            },
            responses: {
                200: { description: 'OK' }
            }
        });

        it('should return HTTP 400 when path param fails validation', async () => {
            // Arrange
            const router = createRouter();
            router.openapi(paramRoute, (c) => c.json({ success: true, data: 'ok' }, 200));

            // Act - 'not-a-uuid' is not a valid UUID
            const res = await router.request('/items/not-a-uuid');
            const body = (await res.json()) as Record<string, unknown>;

            // Assert
            expect(res.status).toBe(400);
            expect(body.success).toBe(false);
            const error = body.error as Record<string, unknown>;
            expect(error.code).toBe('VALIDATION_ERROR');
        });
    });
});
