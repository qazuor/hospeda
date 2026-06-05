/**
 * Integration tests for the Checkout API endpoint
 *
 * Tests the POST /api/v1/protected/billing/checkout flow covering:
 * - Happy path: authenticated user POSTs with valid planId
 * - Unauthenticated request returns 401
 * - Missing planId body returns 422
 * - Wrong HTTP method returns 404/405
 * - Response content-type is JSON
 *
 * The endpoint is provided by @qazuor/qzpay-hono via createBillingRoutes.
 * MercadoPago / QZPay adapter is mocked — no real payment calls are made.
 *
 * Endpoint contract (from apps/api/src/routes/billing/index.ts line 97-98 and
 * T-016 description from SPEC-091):
 *   POST /api/v1/protected/billing/checkout
 *   Request body: { planId: string }
 *   Response: { checkoutUrl: string, orderId?: string, amount?: number,
 *               currency?: string, expiresAt?: string }
 *
 * Auth middleware (billingAuthMiddleware in src/routes/billing/index.ts)
 * requires c.get('user').id to be present; returns 401 otherwise.
 * The endpoint is explicitly NOT admin-only (billing-admin-guard.middleware.ts
 * comment: "POST /checkout (self-service checkout)").
 *
 * @module test/routes/billing/checkout.integration
 */

// ---------------------------------------------------------------------------
// Environment setup — must run before any module imports
// ---------------------------------------------------------------------------

process.env.NODE_ENV = 'test';
process.env.HOSPEDA_DISABLE_AUTH = 'true';
process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
process.env.PORT = '3001';
process.env.HOSPEDA_DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.HOSPEDA_BETTER_AUTH_SECRET = 'test_better_auth_secret_key_32chars!';
process.env.API_VALIDATION_AUTH_ENABLED = 'false';
process.env.HOSPEDA_EXCHANGE_RATE_API_KEY = 'test_exchange_rate_api_key';

// ---------------------------------------------------------------------------
// Module mocks — must be hoisted before imports
// ---------------------------------------------------------------------------

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@repo/logger', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();

    const createMockedLogger = () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerLogMethod: vi.fn().mockReturnThis(),
        permission: vi.fn()
    });

    const mockedLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerCategory: vi.fn(() => createMockedLogger()),
        configure: vi.fn(),
        resetConfig: vi.fn(),
        createLogger: vi.fn(() => createMockedLogger()),
        registerLogMethod: vi.fn().mockReturnThis()
    };

    return {
        ...actual,
        default: mockedLogger,
        logger: mockedLogger,
        createLogger: mockedLogger.createLogger
    };
});

vi.mock('@repo/service-core');

// ---------------------------------------------------------------------------
// Billing module mock — controls billing availability + checkout behaviour
// ---------------------------------------------------------------------------

const { mockGetQZPayBilling, mockBillingEnabled, mockCheckoutCreate } = vi.hoisted(() => {
    const checkoutCreate = vi.fn();
    const checkoutGet = vi.fn();

    const billingInstance = {
        subscriptions: {
            get: vi.fn(),
            list: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            cancel: vi.fn()
        },
        invoices: { get: vi.fn(), list: vi.fn(), create: vi.fn(), pay: vi.fn(), void: vi.fn() },
        payments: { get: vi.fn(), list: vi.fn(), process: vi.fn(), refund: vi.fn() },
        entitlements: { get: vi.fn(), list: vi.fn(), grant: vi.fn(), revoke: vi.fn() },
        customers: {
            get: vi.fn(),
            list: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn()
        },
        plans: { get: vi.fn(), list: vi.fn().mockResolvedValue([]) },
        checkout: { create: checkoutCreate, get: checkoutGet }
    };

    return {
        mockGetQZPayBilling: vi.fn(() => billingInstance),
        mockBillingEnabled: vi.fn(() => true),
        mockCheckoutCreate: checkoutCreate
    };
});

vi.mock('../../../src/middlewares/billing', async (importOriginal) => {
    const original = await importOriginal<typeof import('../../../src/middlewares/billing')>();
    return {
        ...original,
        getQZPayBilling: mockGetQZPayBilling,
        requireBilling: vi.fn(async (_c: unknown, next: () => Promise<void>) => {
            await next();
        }),
        billingMiddleware: vi.fn(
            async (
                c: { set: (key: string, value: unknown) => void },
                next: () => Promise<void>
            ) => {
                c.set('billingEnabled', mockBillingEnabled());
                c.set('qzpay', mockGetQZPayBilling());
                await next();
            }
        )
    };
});

// Billing customer middleware — no customer lookup needed for checkout creation
vi.mock('../../../src/middlewares/billing-customer', () => ({
    billingCustomerMiddleware: () => {
        return async (_c: unknown, next: () => Promise<void>) => {
            await next();
        };
    }
}));

// Pass-through middlewares that are not under test.
// requireEntitlement and requireLimit added here (SPEC-145 T-026) — they
// are now used in routes that are transitively imported by this test.
vi.mock('../../../src/middlewares/entitlement', () => ({
    entitlementMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    },
    requireEntitlement: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    },
    requireLimit: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    }
}));

vi.mock('../../../src/middlewares/trial', () => ({
    trialMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    }
}));

vi.mock('../../../src/middlewares/past-due-grace.middleware', () => ({
    pastDueGraceMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    }
}));

vi.mock('../../../src/middlewares/sentry', () => ({
    sentryMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    },
    sentryBillingMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    }
}));

vi.mock('../../../src/services/billing-metrics.service', () => ({
    getBillingMetricsService: vi.fn(() => ({
        getOverviewMetrics: vi.fn().mockResolvedValue({ success: true, data: {} }),
        getRevenueTimeSeries: vi.fn().mockResolvedValue({ success: true, data: [] }),
        getSubscriptionBreakdown: vi.fn().mockResolvedValue({ success: true, data: [] }),
        getRecentActivity: vi.fn().mockResolvedValue({ success: true, data: [] })
    }))
}));

vi.mock('../../../src/services/billing-usage.service', () => ({
    getSystemUsage: vi.fn().mockResolvedValue({ success: true, data: {} }),
    getApproachingLimits: vi.fn().mockResolvedValue({ success: true, data: [] })
}));

// ---------------------------------------------------------------------------
// QZPay Hono mock — registers a real /checkout route so the middleware stack
// is exercised. The checkout.create() call inside is delegated to
// mockCheckoutCreate so tests control the response.
// ---------------------------------------------------------------------------

vi.mock('@qazuor/qzpay-hono', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OpenAPIHono } = require('@hono/zod-openapi');

    return {
        createBillingRoutes: vi.fn(
            ({
                authMiddleware,
                billing
            }: {
                authMiddleware: unknown;
                billing: {
                    checkout: { create: (body: unknown) => Promise<unknown> };
                };
            }) => {
                const router = new OpenAPIHono({ strict: false });

                // Apply auth middleware injected by createBillingRoutesHandler
                if (authMiddleware) {
                    router.use('*', authMiddleware);
                }

                /**
                 * POST /checkout
                 *
                 * Self-service checkout endpoint allowed for all authenticated users
                 * (billing-admin-guard.middleware.ts exempts POST /checkout).
                 *
                 * Accepts: { planId: string }
                 * Returns: checkout session object from QZPay billing.checkout.create()
                 *
                 * Validation:
                 * - Missing planId → 422 Unprocessable Entity
                 * - Plan not found → 404 (billing.checkout.create throws with code 'NOT_FOUND')
                 */
                router.post(
                    '/checkout',
                    async (c: {
                        req: { json: () => Promise<Record<string, unknown>> };
                        json: (data: unknown, status?: number) => Response;
                    }) => {
                        let body: Record<string, unknown>;
                        try {
                            body = await c.req.json();
                        } catch {
                            return c.json(
                                { error: 'INVALID_JSON', message: 'Invalid request body' },
                                422
                            );
                        }

                        // Validate required planId field
                        if (!body.planId || typeof body.planId !== 'string') {
                            return c.json(
                                {
                                    error: 'VALIDATION_ERROR',
                                    message: 'planId is required'
                                },
                                422
                            );
                        }

                        try {
                            const session = await billing.checkout.create({ planId: body.planId });
                            return c.json(session);
                        } catch (err: unknown) {
                            if (
                                err instanceof Error &&
                                (err.message.includes('not found') ||
                                    err.message.includes('NOT_FOUND') ||
                                    (err as { code?: string }).code === 'NOT_FOUND')
                            ) {
                                return c.json(
                                    { error: 'NOT_FOUND', message: 'Plan not found' },
                                    404
                                );
                            }

                            return c.json(
                                { error: 'INTERNAL_ERROR', message: 'Checkout failed' },
                                500
                            );
                        }
                    }
                );

                // Minimal stubs for other QZPay routes referenced by ownership middleware
                router.get(
                    '/customers/:id',
                    (c: {
                        json: (d: unknown) => Response;
                        req: { param: (n: string) => string };
                    }) => c.json({ id: c.req.param('id'), name: 'Test' })
                );

                router.get(
                    '/subscriptions/:id',
                    (c: {
                        json: (d: unknown) => Response;
                        req: { param: (n: string) => string };
                    }) => c.json({ id: c.req.param('id'), status: 'active' })
                );

                return router;
            }
        )
    };
});

// ---------------------------------------------------------------------------
// Imports — after all vi.mock() calls
// ---------------------------------------------------------------------------

import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { createAuthenticatedRequest, createMockUserActor } from '../../helpers/auth';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHECKOUT_URL = '/api/v1/protected/billing/checkout';

/** A valid plan ID used in happy-path tests */
const VALID_PLAN_ID = 'plan_owner_basico';

/** The mock checkout session returned by billing.checkout.create() */
const MOCK_CHECKOUT_SESSION = {
    checkoutUrl: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=123456789',
    orderId: 'order_abc123',
    amount: 5000,
    currency: 'ARS',
    expiresAt: '2026-04-22T00:00:00.000Z'
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns headers for an authenticated user request against the billing API.
 */
function authenticatedHeaders(extra: Record<string, string> = {}): Record<string, string> {
    const actor = createMockUserActor();
    const req = createAuthenticatedRequest(actor, {
        authorization: 'Bearer test-valid-token',
        ...extra
    });
    return req.headers;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/v1/protected/billing/checkout', () => {
    let app: ReturnType<typeof initApp>;

    const originalEnv = { ...process.env };

    beforeAll(() => {
        validateApiEnv();
    });

    afterAll(() => {
        // Restore original env vars
        for (const key of Object.keys(process.env)) {
            if (!(key in originalEnv)) {
                delete process.env[key];
            }
        }
        Object.assign(process.env, originalEnv);
    });

    beforeEach(() => {
        vi.clearAllMocks();
        mockBillingEnabled.mockReturnValue(true);
        app = initApp();
    });

    // -------------------------------------------------------------------------
    // TC-001: Happy path — authenticated user with valid planId
    // -------------------------------------------------------------------------

    describe('TC-001: Happy path — authenticated user, valid planId', () => {
        it('should return 200 with checkout session data', async () => {
            // Arrange
            (mockCheckoutCreate as Mock).mockResolvedValue(MOCK_CHECKOUT_SESSION);

            const headers = authenticatedHeaders({ 'content-type': 'application/json' });

            // Act
            const res = await app.request(CHECKOUT_URL, {
                method: 'POST',
                headers,
                body: JSON.stringify({ planId: VALID_PLAN_ID })
            });

            // Assert
            expect(res.status).toBe(200);
            const body = await res.json();
            // The response-validator middleware wraps the QZPay response in
            // { success: true, data: <checkout session> }.
            // Extract the checkout session from wherever it lives.
            const session = body.data ?? body;
            expect(session.checkoutUrl).toBe(MOCK_CHECKOUT_SESSION.checkoutUrl);
        });

        it('should forward planId to billing.checkout.create()', async () => {
            // Arrange
            (mockCheckoutCreate as Mock).mockResolvedValue(MOCK_CHECKOUT_SESSION);

            const headers = authenticatedHeaders({ 'content-type': 'application/json' });

            // Act
            await app.request(CHECKOUT_URL, {
                method: 'POST',
                headers,
                body: JSON.stringify({ planId: VALID_PLAN_ID })
            });

            // Assert
            expect(mockCheckoutCreate).toHaveBeenCalledWith({ planId: VALID_PLAN_ID });
            expect(mockCheckoutCreate).toHaveBeenCalledTimes(1);
        });

        it('should include checkoutUrl in the response body', async () => {
            // Arrange
            (mockCheckoutCreate as Mock).mockResolvedValue(MOCK_CHECKOUT_SESSION);

            const headers = authenticatedHeaders({ 'content-type': 'application/json' });

            // Act
            const res = await app.request(CHECKOUT_URL, {
                method: 'POST',
                headers,
                body: JSON.stringify({ planId: VALID_PLAN_ID })
            });

            // Assert — response may be wrapped as { success, data } by response-validator
            const body = await res.json();
            const session = body.data ?? body;
            expect(typeof session.checkoutUrl).toBe('string');
            expect(session.checkoutUrl.startsWith('https://')).toBe(true);
        });

        it('should return JSON content-type header', async () => {
            // Arrange
            (mockCheckoutCreate as Mock).mockResolvedValue(MOCK_CHECKOUT_SESSION);

            const headers = authenticatedHeaders({ 'content-type': 'application/json' });

            // Act
            const res = await app.request(CHECKOUT_URL, {
                method: 'POST',
                headers,
                body: JSON.stringify({ planId: VALID_PLAN_ID })
            });

            // Assert
            const contentType = res.headers.get('content-type');
            expect(contentType).toMatch(/application\/json/);
        });
    });

    // -------------------------------------------------------------------------
    // TC-002: Unauthenticated — no session headers
    // -------------------------------------------------------------------------

    describe('TC-002: Unauthenticated request', () => {
        it('should return 401 when no auth headers are provided', async () => {
            // Arrange — no x-mock-actor-* headers, no authorization header
            // Act
            const res = await app.request(CHECKOUT_URL, {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
                body: JSON.stringify({ planId: VALID_PLAN_ID })
            });

            // Assert
            expect(res.status).toBe(401);
        });

        it('should NOT call billing.checkout.create when unauthenticated', async () => {
            // Act
            await app.request(CHECKOUT_URL, {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
                body: JSON.stringify({ planId: VALID_PLAN_ID })
            });

            // Assert
            expect(mockCheckoutCreate).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // TC-003: Malformed body — missing planId
    // -------------------------------------------------------------------------

    describe('TC-003: Malformed body — missing planId', () => {
        it('should return 422 when planId is missing from body', async () => {
            // Arrange
            const headers = authenticatedHeaders({ 'content-type': 'application/json' });

            // Act
            const res = await app.request(CHECKOUT_URL, {
                method: 'POST',
                headers,
                body: JSON.stringify({ somethingElse: 'value' })
            });

            // Assert
            expect(res.status).toBe(422);
        });

        it('should return 422 when body is completely empty JSON object', async () => {
            // Arrange
            const headers = authenticatedHeaders({ 'content-type': 'application/json' });

            // Act
            const res = await app.request(CHECKOUT_URL, {
                method: 'POST',
                headers,
                body: JSON.stringify({})
            });

            // Assert
            expect(res.status).toBe(422);
        });

        it('should return 422 when planId is empty string', async () => {
            // Arrange
            const headers = authenticatedHeaders({ 'content-type': 'application/json' });

            // Act
            const res = await app.request(CHECKOUT_URL, {
                method: 'POST',
                headers,
                body: JSON.stringify({ planId: '' })
            });

            // Assert
            expect(res.status).toBe(422);
        });

        it('should return 422 when planId is not a string', async () => {
            // Arrange
            const headers = authenticatedHeaders({ 'content-type': 'application/json' });

            // Act
            const res = await app.request(CHECKOUT_URL, {
                method: 'POST',
                headers,
                body: JSON.stringify({ planId: 12345 })
            });

            // Assert
            expect(res.status).toBe(422);
        });

        it('should NOT call billing.checkout.create when planId is missing', async () => {
            // Arrange
            const headers = authenticatedHeaders({ 'content-type': 'application/json' });

            // Act
            await app.request(CHECKOUT_URL, {
                method: 'POST',
                headers,
                body: JSON.stringify({})
            });

            // Assert
            expect(mockCheckoutCreate).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // TC-004: Invalid planId — plan not found
    // -------------------------------------------------------------------------

    describe('TC-004: Invalid planId — plan not found', () => {
        it('should return 404 when billing.checkout.create throws NOT_FOUND', async () => {
            // Arrange
            const notFoundError = new Error('Plan not found: plan_nonexistent');
            (notFoundError as Error & { code?: string }).code = 'NOT_FOUND';
            (mockCheckoutCreate as Mock).mockRejectedValue(notFoundError);

            const headers = authenticatedHeaders({ 'content-type': 'application/json' });

            // Act
            const res = await app.request(CHECKOUT_URL, {
                method: 'POST',
                headers,
                body: JSON.stringify({ planId: 'plan_nonexistent' })
            });

            // Assert
            expect(res.status).toBe(404);
        });

        it('should return 404 when billing.checkout.create throws "not found" message', async () => {
            // Arrange
            (mockCheckoutCreate as Mock).mockRejectedValue(
                new Error('Plan plan_xyz not found in catalog')
            );

            const headers = authenticatedHeaders({ 'content-type': 'application/json' });

            // Act
            const res = await app.request(CHECKOUT_URL, {
                method: 'POST',
                headers,
                body: JSON.stringify({ planId: 'plan_xyz' })
            });

            // Assert
            expect(res.status).toBe(404);
        });
    });

    // -------------------------------------------------------------------------
    // TC-005: Wrong HTTP method
    // -------------------------------------------------------------------------

    describe('TC-005: Wrong HTTP method', () => {
        it('should return 404 or 405 for GET /checkout', async () => {
            // Arrange
            const headers = authenticatedHeaders();

            // Act
            const res = await app.request(CHECKOUT_URL, {
                method: 'GET',
                headers
            });

            // Assert — Hono returns 404 for unregistered method/path combinations
            expect([404, 405]).toContain(res.status);
        });

        it('should return 404 or 405 for PUT /checkout', async () => {
            // Arrange
            const headers = authenticatedHeaders({ 'content-type': 'application/json' });

            // Act
            const res = await app.request(CHECKOUT_URL, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ planId: VALID_PLAN_ID })
            });

            // Assert
            expect([404, 405]).toContain(res.status);
        });

        it('should return 404 or 405 for DELETE /checkout', async () => {
            // Arrange
            const headers = authenticatedHeaders();

            // Act
            const res = await app.request(CHECKOUT_URL, {
                method: 'DELETE',
                headers
            });

            // Assert
            expect([404, 405]).toContain(res.status);
        });
    });

    // -------------------------------------------------------------------------
    // TC-006: Billing not configured — 503
    // -------------------------------------------------------------------------

    describe('TC-006: Billing service unavailable', () => {
        it('should return 503 when billing is not configured', async () => {
            // Arrange — override requireBilling to reject as 503
            const { requireBilling } = await import('../../../src/middlewares/billing');
            (requireBilling as Mock).mockImplementationOnce(
                async (
                    c: { json: (d: unknown, s: number) => Response },
                    _next: () => Promise<void>
                ) => {
                    return c.json(
                        {
                            success: false,
                            error: {
                                code: 'SERVICE_UNAVAILABLE',
                                message: 'Billing service is not configured'
                            }
                        },
                        503
                    );
                }
            );

            const localApp = initApp();
            const headers = authenticatedHeaders({ 'content-type': 'application/json' });

            // Act
            const res = await localApp.request(CHECKOUT_URL, {
                method: 'POST',
                headers,
                body: JSON.stringify({ planId: VALID_PLAN_ID })
            });

            // Assert
            expect(res.status).toBe(503);
        });
    });
});
