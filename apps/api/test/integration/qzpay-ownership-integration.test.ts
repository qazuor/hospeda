/**
 * Integration tests for QZPay resource ownership enforcement (SPEC-019)
 *
 * Complements billing-idor-prevention.test.ts with additional cross-resource
 * ownership scenarios:
 * - Entitlement access is fail-closed (no customer lookup path)
 * - User cannot access resources without a billing customer ID set
 * - Cross-resource type attacks (subscription ID in payment path)
 * - Ownership verification after billing customer ID mismatch
 *
 * @module test/integration/qzpay-ownership-integration
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Environment setup (before any module loads)
// ---------------------------------------------------------------------------

const originalEnv = { ...process.env };

process.env.NODE_ENV = 'test';
process.env.HOSPEDA_DISABLE_AUTH = 'true';
process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
process.env.PORT = '3001';
process.env.HOSPEDA_DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.HOSPEDA_BETTER_AUTH_SECRET = 'test_better_auth_secret_key_32chars!';
process.env.API_VALIDATION_AUTH_ENABLED = 'false';
process.env.HOSPEDA_EXCHANGE_RATE_API_KEY = 'test_exchange_rate_api_key';

// ---------------------------------------------------------------------------
// Module mocks (must be hoisted before imports)
// ---------------------------------------------------------------------------

vi.mock('@repo/logger', () => {
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

    const LoggerColors = {
        BLACK: 'BLACK',
        RED: 'RED',
        GREEN: 'GREEN',
        YELLOW: 'YELLOW',
        BLUE: 'BLUE',
        MAGENTA: 'MAGENTA',
        CYAN: 'CYAN',
        WHITE: 'WHITE',
        GRAY: 'GRAY',
        BLACK_BRIGHT: 'BLACK_BRIGHT',
        RED_BRIGHT: 'RED_BRIGHT',
        GREEN_BRIGHT: 'GREEN_BRIGHT',
        YELLOW_BRIGHT: 'YELLOW_BRIGHT',
        BLUE_BRIGHT: 'BLUE_BRIGHT',
        MAGENTA_BRIGHT: 'MAGENTA_BRIGHT',
        CYAN_BRIGHT: 'CYAN_BRIGHT',
        WHITE_BRIGHT: 'WHITE_BRIGHT'
    };

    const LogLevel = { LOG: 'LOG', INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR', DEBUG: 'DEBUG' };

    return {
        default: mockedLogger,
        logger: mockedLogger,
        createLogger: mockedLogger.createLogger,
        LoggerColors,
        LogLevel
    };
});

vi.mock('@repo/service-core');

vi.mock('@repo/notifications', async (importOriginal) => {
    try {
        const actual = await importOriginal<Record<string, unknown>>();
        return { ...actual };
    } catch {
        // Fallback if the module cannot be loaded
        return {
            NotificationType: {},
            NotificationService: vi.fn()
        };
    }
});

const { mockGetQZPayBilling, mockBillingEnabled, mockBillingInstance } = vi.hoisted(() => {
    const subscriptionsGet = vi.fn();
    const invoicesGet = vi.fn();
    const paymentsGet = vi.fn();
    const entitlementsGet = vi.fn();
    const customersGet = vi.fn();

    const billingInstance = {
        subscriptions: {
            get: subscriptionsGet,
            list: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            cancel: vi.fn()
        },
        invoices: {
            get: invoicesGet,
            list: vi.fn(),
            create: vi.fn(),
            pay: vi.fn(),
            void: vi.fn()
        },
        payments: {
            get: paymentsGet,
            list: vi.fn(),
            process: vi.fn(),
            refund: vi.fn()
        },
        entitlements: {
            get: entitlementsGet,
            list: vi.fn(),
            grant: vi.fn(),
            revoke: vi.fn()
        },
        customers: {
            get: customersGet,
            list: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn()
        },
        plans: {
            get: vi.fn(),
            list: vi.fn().mockResolvedValue([])
        },
        checkout: {
            create: vi.fn(),
            get: vi.fn()
        }
    };

    return {
        mockGetQZPayBilling: vi.fn(() => billingInstance),
        mockBillingEnabled: vi.fn(() => true),
        mockBillingInstance: billingInstance
    };
});

vi.mock('../../src/middlewares/billing', async (importOriginal) => {
    const original = await importOriginal<typeof import('../../src/middlewares/billing')>();
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

vi.mock('../../src/middlewares/billing-customer', () => ({
    billingCustomerMiddleware: () => {
        return async (
            c: {
                get: (key: string) => unknown;
                set: (key: string, value: unknown) => void;
                req: { header: (name: string) => string | undefined };
            },
            next: () => Promise<void>
        ) => {
            const mockBillingCustomerId = c.req.header('x-test-billing-customer-id');
            if (mockBillingCustomerId) {
                c.set('billingCustomerId', mockBillingCustomerId);
            }
            await next();
        };
    }
}));

vi.mock('../../src/middlewares/entitlement', () => ({
    entitlementMiddleware: () => {
        return async (_c: unknown, next: () => Promise<void>) => {
            await next();
        };
    }
}));

vi.mock('../../src/middlewares/trial', () => ({
    trialMiddleware: () => {
        return async (_c: unknown, next: () => Promise<void>) => {
            await next();
        };
    }
}));

vi.mock('../../src/middlewares/past-due-grace.middleware', () => ({
    pastDueGraceMiddleware: () => {
        return async (_c: unknown, next: () => Promise<void>) => {
            await next();
        };
    }
}));

vi.mock('../../src/middlewares/sentry', () => ({
    sentryMiddleware: () => {
        return async (_c: unknown, next: () => Promise<void>) => {
            await next();
        };
    },
    sentryBillingMiddleware: () => {
        return async (_c: unknown, next: () => Promise<void>) => {
            await next();
        };
    }
}));

vi.mock('../../src/services/billing-metrics.service', () => ({
    getBillingMetricsService: vi.fn(() => ({
        getOverviewMetrics: vi.fn().mockResolvedValue({ success: true, data: {} }),
        getRevenueTimeSeries: vi.fn().mockResolvedValue({ success: true, data: [] }),
        getSubscriptionBreakdown: vi.fn().mockResolvedValue({ success: true, data: [] }),
        getRecentActivity: vi.fn().mockResolvedValue({ success: true, data: [] })
    }))
}));

vi.mock('../../src/services/billing-usage.service', () => ({
    getSystemUsage: vi.fn().mockResolvedValue({ success: true, data: {} }),
    getApproachingLimits: vi.fn().mockResolvedValue({ success: true, data: [] })
}));

vi.mock('@qazuor/qzpay-hono', () => {
    const { OpenAPIHono } = require('@hono/zod-openapi');

    return {
        createBillingRoutes: vi.fn(({ authMiddleware }: { authMiddleware: unknown }) => {
            const router = new OpenAPIHono({ strict: false });

            if (authMiddleware) {
                router.use('*', authMiddleware);
            }

            router.get(
                '/customers/:id',
                (c: { json: (d: unknown) => Response; req: { param: (n: string) => string } }) =>
                    c.json({ id: c.req.param('id'), name: 'Test Customer' })
            );
            router.get(
                '/subscriptions/:id',
                (c: { json: (d: unknown) => Response; req: { param: (n: string) => string } }) =>
                    c.json({ id: c.req.param('id'), status: 'active' })
            );
            router.get(
                '/invoices/:id',
                (c: { json: (d: unknown) => Response; req: { param: (n: string) => string } }) =>
                    c.json({ id: c.req.param('id'), status: 'open' })
            );
            router.get(
                '/payments/:id',
                (c: { json: (d: unknown) => Response; req: { param: (n: string) => string } }) =>
                    c.json({ id: c.req.param('id'), amount: 100 })
            );
            router.post(
                '/payments/:id/refund',
                (c: { json: (d: unknown) => Response; req: { param: (n: string) => string } }) =>
                    c.json({ id: c.req.param('id'), refunded: true })
            );
            router.get(
                '/entitlements/:id',
                (c: { json: (d: unknown) => Response; req: { param: (n: string) => string } }) =>
                    c.json({ id: c.req.param('id'), feature: 'test' })
            );
            router.post('/entitlements', (c: { json: (d: unknown) => Response }) =>
                c.json({ created: true })
            );
            router.delete('/entitlements/:id', (c: { json: (d: unknown) => Response }) =>
                c.json({ deleted: true })
            );

            return router;
        })
    };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { initApp } from '../../src/app';
import { validateApiEnv } from '../../src/utils/env';
import {
    createAuthenticatedRequest,
    createMockAdminActor,
    createMockUserActor
} from '../helpers/auth';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_A_ID = '11111111-1111-4111-8111-111111111111';
const USER_B_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const USER_A_CUSTOMER_ID = 'cust_user_a_111';
const USER_B_CUSTOMER_ID = 'cust_user_b_222';

const USER_A_SUB_ID = 'sub_user_a_001';
const USER_A_INV_ID = 'inv_user_a_001';
const USER_A_PAY_ID = 'pay_user_a_001';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createBillingHeaders({
    actorId,
    role,
    billingCustomerId,
    permissions
}: {
    actorId: string;
    role: string;
    billingCustomerId?: string;
    permissions?: PermissionEnum[];
}): Record<string, string> {
    const actor =
        role === RoleEnum.ADMIN || role === RoleEnum.SUPER_ADMIN
            ? createMockAdminActor({
                  id: actorId,
                  role,
                  permissions: permissions ?? [
                      PermissionEnum.ACCESS_API_ADMIN,
                      PermissionEnum.ACCESS_PANEL_ADMIN
                  ]
              })
            : createMockUserActor({ id: actorId });

    const authReq = createAuthenticatedRequest(actor, {
        ...(billingCustomerId ? { 'x-test-billing-customer-id': billingCustomerId } : {}),
        authorization: 'Bearer test-valid-token'
    });

    return authReq.headers;
}

function setupOwnershipMocks(): void {
    (mockBillingInstance.subscriptions.get as Mock).mockImplementation(async (id: string) => {
        if (id === USER_A_SUB_ID) {
            return { id, customerId: USER_A_CUSTOMER_ID, status: 'active' };
        }
        return null;
    });

    (mockBillingInstance.invoices.get as Mock).mockImplementation(async (id: string) => {
        if (id === USER_A_INV_ID) {
            return { id, customerId: USER_A_CUSTOMER_ID, status: 'open' };
        }
        return null;
    });

    (mockBillingInstance.payments.get as Mock).mockImplementation(async (id: string) => {
        if (id === USER_A_PAY_ID) {
            return { id, customerId: USER_A_CUSTOMER_ID, amount: 5000 };
        }
        return null;
    });

    // Entitlements: no customer ID linkage (fail-closed by design)
    (mockBillingInstance.entitlements.get as Mock).mockImplementation(async () => null);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('QZPay Ownership Integration (SPEC-019)', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(() => {
        validateApiEnv();
    });

    afterAll(() => {
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
        setupOwnershipMocks();
        app = initApp();
    });

    // -----------------------------------------------------------------------
    // Cross-user subscription access
    // -----------------------------------------------------------------------

    describe('Cross-user subscription access', () => {
        it('should deny User B from GET-ting User A subscription -> 403', async () => {
            const headers = createBillingHeaders({
                actorId: USER_B_ID,
                role: RoleEnum.USER,
                billingCustomerId: USER_B_CUSTOMER_ID
            });

            const res = await app.request(
                `/api/v1/protected/billing/subscriptions/${USER_A_SUB_ID}`,
                {
                    method: 'GET',
                    headers
                }
            );

            expect(res.status).toBe(403);
        });

        it('should allow User A to GET own subscription -> 200', async () => {
            const headers = createBillingHeaders({
                actorId: USER_A_ID,
                role: RoleEnum.USER,
                billingCustomerId: USER_A_CUSTOMER_ID
            });

            const res = await app.request(
                `/api/v1/protected/billing/subscriptions/${USER_A_SUB_ID}`,
                {
                    method: 'GET',
                    headers
                }
            );

            expect(res.status).toBe(200);
        });
    });

    // -----------------------------------------------------------------------
    // Cross-user invoice access
    // -----------------------------------------------------------------------

    describe('Cross-user invoice access', () => {
        it('should deny User B from GET-ting User A invoice -> 403', async () => {
            const headers = createBillingHeaders({
                actorId: USER_B_ID,
                role: RoleEnum.USER,
                billingCustomerId: USER_B_CUSTOMER_ID
            });

            const res = await app.request(`/api/v1/protected/billing/invoices/${USER_A_INV_ID}`, {
                method: 'GET',
                headers
            });

            expect(res.status).toBe(403);
        });
    });

    // -----------------------------------------------------------------------
    // Cross-user payment access
    // -----------------------------------------------------------------------

    describe('Cross-user payment access', () => {
        it('should deny User B from GET-ting User A payment -> 403', async () => {
            const headers = createBillingHeaders({
                actorId: USER_B_ID,
                role: RoleEnum.USER,
                billingCustomerId: USER_B_CUSTOMER_ID
            });

            const res = await app.request(`/api/v1/protected/billing/payments/${USER_A_PAY_ID}`, {
                method: 'GET',
                headers
            });

            expect(res.status).toBe(403);
        });

        it('should deny User B from POST refund on User A payment -> 403', async () => {
            const headers = createBillingHeaders({
                actorId: USER_B_ID,
                role: RoleEnum.USER,
                billingCustomerId: USER_B_CUSTOMER_ID
            });

            const res = await app.request(
                `/api/v1/protected/billing/payments/${USER_A_PAY_ID}/refund`,
                {
                    method: 'POST',
                    headers
                }
            );

            // Either 403 from ownership or admin guard
            expect([403]).toContain(res.status);
        });
    });

    // -----------------------------------------------------------------------
    // Cross-user customer access
    // -----------------------------------------------------------------------

    describe('Cross-user customer access', () => {
        it('should deny User A from GET-ting User B customer -> 403', async () => {
            const headers = createBillingHeaders({
                actorId: USER_A_ID,
                role: RoleEnum.USER,
                billingCustomerId: USER_A_CUSTOMER_ID
            });

            const res = await app.request(
                `/api/v1/protected/billing/customers/${USER_B_CUSTOMER_ID}`,
                {
                    method: 'GET',
                    headers
                }
            );

            expect(res.status).toBe(403);
        });
    });

    // -----------------------------------------------------------------------
    // Admin access to any resource
    // -----------------------------------------------------------------------

    describe('Admin access on QZPay routes', () => {
        it('should deny admin with mismatched billingCustomerId (ownership enforced)', async () => {
            // On QZPay routes, admins still go through ownership middleware.
            // Admins should use /admin/* routes for cross-tenant access.
            const headers = createBillingHeaders({
                actorId: ADMIN_ID,
                role: RoleEnum.ADMIN,
                billingCustomerId: 'cust_admin_xxx'
            });

            const res = await app.request(
                `/api/v1/protected/billing/subscriptions/${USER_A_SUB_ID}`,
                {
                    method: 'GET',
                    headers
                }
            );

            expect(res.status).toBe(403);
        });

        it('should allow admin with matching billingCustomerId', async () => {
            // Admin with User A's billingCustomerId can access User A's resources
            const headers = createBillingHeaders({
                actorId: ADMIN_ID,
                role: RoleEnum.ADMIN,
                billingCustomerId: USER_A_CUSTOMER_ID
            });

            const res = await app.request(`/api/v1/protected/billing/payments/${USER_A_PAY_ID}`, {
                method: 'GET',
                headers
            });

            expect(res.status).toBe(200);
        });
    });

    // -----------------------------------------------------------------------
    // Entitlement access (fail-closed: no customer lookup path)
    // -----------------------------------------------------------------------

    describe('Entitlement access (fail-closed)', () => {
        it('should deny regular user from POST /entitlements -> 403', async () => {
            const headers = createBillingHeaders({
                actorId: USER_A_ID,
                role: RoleEnum.USER,
                billingCustomerId: USER_A_CUSTOMER_ID
            });

            const res = await app.request('/api/v1/protected/billing/entitlements', {
                method: 'POST',
                headers
            });

            expect(res.status).toBe(403);
        });

        it('should deny regular user from DELETE /entitlements/:id -> 403', async () => {
            const headers = createBillingHeaders({
                actorId: USER_A_ID,
                role: RoleEnum.USER,
                billingCustomerId: USER_A_CUSTOMER_ID
            });

            const res = await app.request('/api/v1/protected/billing/entitlements/ent_001', {
                method: 'DELETE',
                headers
            });

            expect(res.status).toBe(403);
        });
    });

    // -----------------------------------------------------------------------
    // Unauthenticated requests
    // -----------------------------------------------------------------------

    describe('Unauthenticated requests', () => {
        it('should deny unauthenticated billing subscription GET', async () => {
            const res = await app.request(
                `/api/v1/protected/billing/subscriptions/${USER_A_SUB_ID}`,
                {
                    method: 'GET'
                }
            );

            // Without auth, may return 400/401/403 depending on middleware chain
            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(res.status).toBeLessThan(500);
        });

        it('should deny unauthenticated billing payment GET', async () => {
            const res = await app.request(`/api/v1/protected/billing/payments/${USER_A_PAY_ID}`, {
                method: 'GET'
            });

            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(res.status).toBeLessThan(500);
        });

        it('should deny unauthenticated refund POST', async () => {
            const res = await app.request(
                `/api/v1/protected/billing/payments/${USER_A_PAY_ID}/refund`,
                {
                    method: 'POST'
                }
            );

            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(res.status).toBeLessThan(500);
        });
    });

    // -----------------------------------------------------------------------
    // User without billing customer ID
    // -----------------------------------------------------------------------

    describe('User without billing customer ID', () => {
        it('should return 403 for resource-specific route when no billing customer ID is set', async () => {
            // When no billingCustomerId is set in context and the path targets a
            // specific resource (e.g. /subscriptions/:id), the ownership middleware
            // now fails closed to prevent unauthenticated access to billing resources.
            const headers = createBillingHeaders({
                actorId: USER_A_ID,
                role: RoleEnum.USER
                // No billingCustomerId
            });

            const res = await app.request(
                `/api/v1/protected/billing/subscriptions/${USER_A_SUB_ID}`,
                {
                    method: 'GET',
                    headers
                }
            );

            // Fail-closed: resource-specific route without billing customer -> 403
            expect(res.status).toBe(403);
        });
    });
});
