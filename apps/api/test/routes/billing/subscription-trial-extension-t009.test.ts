/**
 * T-009 Integration Tests: Admin apply-trial-extension route
 *
 * POST /api/v1/admin/billing/subscriptions/:subscriptionId/apply-trial-extension
 *
 * Covers SPEC-262 T-009 acceptance criteria:
 *   AC-3.1  trialing sub + valid trial_extension code → 200 + updated trial_end
 *   AC-3.4  active (non-trial) sub → 422 (VALIDATION_ERROR from service)
 *   AC-3.5  annual sub in trial → 200 (accept)
 *   AC-3.5  annual sub past trial → 422 (reject)
 *   AC-6.1  missing BILLING_PROMO_CODE_MANAGE → 403
 *   AC-6.2  (implicitly tested: admin ACCESS_API_ADMIN bypasses ownership guard)
 *
 * Additional cases:
 *   - non-trial-extension promo code → 422
 *   - subscription NOT_FOUND → 404
 *   - invalid subscriptionId format → 400 (schema validation)
 *   - invalid promoCodeId format → 400 (schema validation)
 *
 * @module test/routes/billing/subscription-trial-extension-t009
 */

// ---------------------------------------------------------------------------
// Environment — must precede ALL module imports
// ---------------------------------------------------------------------------
process.env.NODE_ENV = 'test';
process.env.HOSPEDA_DISABLE_AUTH = 'true';
process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
// Ensure CI is not 'true' so isMockActorAllowed() passes
process.env.CI = undefined as unknown as string;
process.env.PORT = '3001';
process.env.HOSPEDA_DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.HOSPEDA_BETTER_AUTH_SECRET = 'test_better_auth_secret_key_32chars!';
process.env.API_VALIDATION_AUTH_ENABLED = 'false';
process.env.HOSPEDA_EXCHANGE_RATE_API_KEY = 'test_exchange_rate_api_key';

// ---------------------------------------------------------------------------
// Vitest imports
// ---------------------------------------------------------------------------
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock state
// ---------------------------------------------------------------------------
const { mockExtendExistingSubscriptionTrial, mockAssertSubscriptionOwnership } = vi.hoisted(() => ({
    mockExtendExistingSubscriptionTrial: vi.fn(),
    mockAssertSubscriptionOwnership: vi.fn().mockResolvedValue({ success: true })
}));

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any import of the mocked module
// ---------------------------------------------------------------------------

vi.mock('@repo/logger', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    const noop = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerLogMethod: vi.fn().mockReturnThis(),
        permission: vi.fn()
    };
    const logger = {
        ...noop,
        registerCategory: vi.fn(() => noop),
        configure: vi.fn(),
        resetConfig: vi.fn(),
        createLogger: vi.fn(() => noop)
    };
    return { ...actual, default: logger, logger, createLogger: logger.createLogger };
});

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}));

vi.mock('../../../src/utils/audit-logger', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/utils/audit-logger')>();
    return { ...actual, auditLog: vi.fn() };
});

vi.mock('../../../src/utils/redis', () => ({
    getRedisClient: vi.fn().mockResolvedValue(undefined),
    disconnectRedis: vi.fn().mockResolvedValue(undefined),
    resetRedisState: vi.fn()
}));

// Mock service-core: extendExistingSubscriptionTrial and assertSubscriptionOwnership
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        extendExistingSubscriptionTrial: mockExtendExistingSubscriptionTrial,
        assertSubscriptionOwnership: mockAssertSubscriptionOwnership,
        // Other PromoCodeService methods needed by sibling routes in the same app
        PromoCodeService: vi.fn().mockImplementation(() => ({
            create: vi.fn(),
            getByCode: vi.fn(),
            apply: vi.fn(),
            validate: vi.fn().mockResolvedValue({ valid: true }),
            update: vi.fn(),
            getById: vi.fn(),
            list: vi.fn(),
            delete: vi.fn()
        }))
    };
});

vi.mock('../../../src/middlewares/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/middlewares/billing')>();
    return {
        ...actual,
        getQZPayBilling: vi.fn(() => null),
        requireBilling: vi.fn(async (_c: unknown, next: () => Promise<void>) => {
            await next();
        }),
        billingMiddleware: vi.fn(
            async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
                c.set('billingEnabled', true);
                c.set('qzpay', null);
                await next();
            }
        )
    };
});

vi.mock('../../../src/middlewares/billing-customer', () => ({
    billingCustomerMiddleware:
        () => async (_c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
            // No billing customer context by default for admin routes —
            // tests that need it can override via the mock actor's permissions
            await next();
        }
}));

vi.mock('../../../src/middlewares/billing-perm.middleware', () => ({
    billingPermMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    }
}));

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

// QZPay Hono — stub the admin routes factory so we don't need a live DB
vi.mock('@qazuor/qzpay-hono', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OpenAPIHono } = require('@hono/zod-openapi');
    return {
        createAdminRoutes: vi.fn(
            ({
                authMiddleware
            }: {
                authMiddleware?: unknown;
            }) => {
                const router = new OpenAPIHono({ strict: false });
                if (authMiddleware) {
                    router.use('*', authMiddleware);
                }
                return router;
            }
        ),
        createBillingRoutes: vi.fn(
            ({
                authMiddleware
            }: {
                authMiddleware?: unknown;
            }) => {
                const router = new OpenAPIHono({ strict: false });
                if (authMiddleware) {
                    router.use('*', authMiddleware);
                }
                return router;
            }
        )
    };
});

// ---------------------------------------------------------------------------
// Imports — after all vi.mock() calls
// ---------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const ROUTE_BASE = '/api/v1/admin/billing/subscriptions';

/**
 * Build request headers that carry a mock actor (processed by actorMiddleware
 * when HOSPEDA_ALLOW_MOCK_ACTOR=true / HOSPEDA_DISABLE_AUTH=true).
 */
function makeHeaders(actor: {
    readonly id: string;
    readonly role: string;
    readonly permissions: readonly string[];
}): Record<string, string> {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        accept: 'application/json',
        'x-mock-actor-id': actor.id,
        'x-mock-actor-role': actor.role,
        'x-mock-actor-permissions': JSON.stringify(actor.permissions)
    };
}

/**
 * Admin actor with full permissions required for the route (AC-6.1 pass).
 */
function makeAdminActor(id = randomUUID()) {
    return {
        id,
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.ACCESS_API_PUBLIC,
            PermissionEnum.ACCESS_API_PRIVATE,
            PermissionEnum.ACCESS_API_ADMIN,
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.BILLING_READ_ALL,
            PermissionEnum.BILLING_PROMO_CODE_READ,
            PermissionEnum.BILLING_PROMO_CODE_MANAGE
        ] as string[]
    } as const;
}

/** Build a canonical successful service result stub. */
function makeSuccessResult(
    overrides: Partial<{
        subscriptionId: string;
        newTrialEnd: Date;
        daysAdded: number;
        mpReconciliationPending: boolean;
        usageRecordId: string;
    }> = {}
) {
    return {
        success: true as const,
        data: {
            subscriptionId: overrides.subscriptionId ?? randomUUID(),
            newTrialEnd: overrides.newTrialEnd ?? new Date(Date.now() + 30 * 86_400_000),
            daysAdded: overrides.daysAdded ?? 30,
            mpReconciliationPending: overrides.mpReconciliationPending ?? true,
            usageRecordId: overrides.usageRecordId ?? randomUUID()
        }
    };
}

// ---------------------------------------------------------------------------
// Suite: POST /subscriptions/:subscriptionId/apply-trial-extension
// ---------------------------------------------------------------------------

describe('POST /api/v1/admin/billing/subscriptions/:id/apply-trial-extension', () => {
    let app: ReturnType<typeof initApp>;
    const SUBSCRIPTION_ID = randomUUID();
    const PROMO_CODE_ID = randomUUID();

    beforeAll(() => {
        validateApiEnv();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        // Default: ownership check passes (admin actor bypasses in route handler)
        mockAssertSubscriptionOwnership.mockResolvedValue({ success: true });
        app = initApp();
    });

    // ── AC-3.1: trialing sub + valid trial_extension code → 200 ────────────────

    it('AC-3.1 trialing sub + valid trial_extension code → 200 + updated trial_end', async () => {
        // Arrange
        const newTrialEnd = new Date(Date.now() + 30 * 86_400_000);
        const usageRecordId = randomUUID();
        mockExtendExistingSubscriptionTrial.mockResolvedValue(
            makeSuccessResult({
                subscriptionId: SUBSCRIPTION_ID,
                newTrialEnd,
                daysAdded: 30,
                mpReconciliationPending: true,
                usageRecordId
            })
        );

        // Act
        const res = await app.request(`${ROUTE_BASE}/${SUBSCRIPTION_ID}/apply-trial-extension`, {
            method: 'POST',
            headers: makeHeaders(makeAdminActor()),
            body: JSON.stringify({ promoCodeId: PROMO_CODE_ID })
        });

        // Assert
        expect(res.status).toBe(200);
        const body = (await res.json()) as { success: boolean; data?: Record<string, unknown> };
        expect(body.success).toBe(true);
        const data = body.data!;
        expect(data.subscriptionId).toBe(SUBSCRIPTION_ID);
        expect(data.daysAdded).toBe(30);
        expect(data.mpReconciliationPending).toBe(true);
        expect(typeof data.newTrialEnd).toBe('string');
        expect(typeof data.usageRecordId).toBe('string');
        expect(mockExtendExistingSubscriptionTrial).toHaveBeenCalledOnce();
        expect(mockExtendExistingSubscriptionTrial).toHaveBeenCalledWith(
            expect.objectContaining({
                subscriptionId: SUBSCRIPTION_ID,
                promoCodeId: PROMO_CODE_ID
            })
        );
    });

    // ── AC-3.4: active (non-trial) sub → 422 ───────────────────────────────────

    it('AC-3.4 active (non-trial) sub → 422 VALIDATION_ERROR', async () => {
        // Arrange: service returns VALIDATION_ERROR for non-trialing status
        mockExtendExistingSubscriptionTrial.mockResolvedValue({
            success: false as const,
            error: {
                code: 'VALIDATION_ERROR',
                message:
                    'Subscription is not in trialing status (current status: active). Trial extension can only be applied to a subscription in trialing status.'
            }
        });

        // Act
        const res = await app.request(`${ROUTE_BASE}/${SUBSCRIPTION_ID}/apply-trial-extension`, {
            method: 'POST',
            headers: makeHeaders(makeAdminActor()),
            body: JSON.stringify({ promoCodeId: PROMO_CODE_ID })
        });

        // Assert
        expect(res.status).toBe(422);
        const body = (await res.json()) as { success: boolean; error?: { message?: string } };
        expect(body.success).toBe(false);
    });

    // ── AC-3.5: annual sub in trial → 200 ──────────────────────────────────────

    it('AC-3.5 annual sub in trial → 200 (accepted)', async () => {
        // Arrange: annual sub (mpReconciliationPending=false since no preapproval)
        const newTrialEnd = new Date(Date.now() + 30 * 86_400_000);
        mockExtendExistingSubscriptionTrial.mockResolvedValue(
            makeSuccessResult({
                subscriptionId: SUBSCRIPTION_ID,
                newTrialEnd,
                daysAdded: 30,
                mpReconciliationPending: false, // annual — no MP preapproval
                usageRecordId: randomUUID()
            })
        );

        // Act
        const res = await app.request(`${ROUTE_BASE}/${SUBSCRIPTION_ID}/apply-trial-extension`, {
            method: 'POST',
            headers: makeHeaders(makeAdminActor()),
            body: JSON.stringify({ promoCodeId: PROMO_CODE_ID })
        });

        // Assert
        expect(res.status).toBe(200);
        const body = (await res.json()) as { success: boolean; data?: Record<string, unknown> };
        expect(body.success).toBe(true);
        expect(body.data?.mpReconciliationPending).toBe(false);
    });

    // ── AC-3.5: annual sub past trial → 422 ────────────────────────────────────

    it('AC-3.5 annual sub past trial → 422 VALIDATION_ERROR', async () => {
        // Arrange: service rejects because annual sub is not trialing
        mockExtendExistingSubscriptionTrial.mockResolvedValue({
            success: false as const,
            error: {
                code: 'VALIDATION_ERROR',
                message:
                    'Subscription is not in trialing status (current status: active). ' +
                    'Annual subscriptions outside their trial period cannot be extended.'
            }
        });

        // Act
        const res = await app.request(`${ROUTE_BASE}/${SUBSCRIPTION_ID}/apply-trial-extension`, {
            method: 'POST',
            headers: makeHeaders(makeAdminActor()),
            body: JSON.stringify({ promoCodeId: PROMO_CODE_ID })
        });

        // Assert
        expect(res.status).toBe(422);
    });

    // ── AC-6.1: missing BILLING_PROMO_CODE_MANAGE → 403 ────────────────────────

    it('AC-6.1 returns 403 when caller lacks BILLING_PROMO_CODE_MANAGE', async () => {
        // Arrange: admin without the specific manage permission
        const restrictedActor = {
            id: randomUUID(),
            role: RoleEnum.ADMIN,
            permissions: [
                PermissionEnum.ACCESS_API_PUBLIC,
                PermissionEnum.ACCESS_API_PRIVATE,
                PermissionEnum.ACCESS_API_ADMIN,
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.BILLING_READ_ALL,
                PermissionEnum.BILLING_PROMO_CODE_READ
                // BILLING_PROMO_CODE_MANAGE intentionally absent
            ] as string[]
        };

        // Act
        const res = await app.request(`${ROUTE_BASE}/${SUBSCRIPTION_ID}/apply-trial-extension`, {
            method: 'POST',
            headers: makeHeaders(restrictedActor),
            body: JSON.stringify({ promoCodeId: PROMO_CODE_ID })
        });

        // Assert
        expect(res.status).toBe(403);
        expect(mockExtendExistingSubscriptionTrial).not.toHaveBeenCalled();
    });

    // ── Non-trial-extension code → 422 ─────────────────────────────────────────

    it('non-trial-extension code → 422 VALIDATION_ERROR from service', async () => {
        // Arrange: service detects wrong effect kind
        mockExtendExistingSubscriptionTrial.mockResolvedValue({
            success: false as const,
            error: {
                code: 'VALIDATION_ERROR',
                message:
                    'Promo code does not have a trial_extension effect. ' +
                    'Only trial_extension codes can be applied to an existing subscription trial.'
            }
        });

        // Act
        const res = await app.request(`${ROUTE_BASE}/${SUBSCRIPTION_ID}/apply-trial-extension`, {
            method: 'POST',
            headers: makeHeaders(makeAdminActor()),
            body: JSON.stringify({ promoCodeId: PROMO_CODE_ID })
        });

        // Assert
        expect(res.status).toBe(422);
        expect(mockExtendExistingSubscriptionTrial).toHaveBeenCalledOnce();
    });

    // ── NOT_FOUND subscription → 404 ───────────────────────────────────────────

    it('subscription NOT_FOUND → 404', async () => {
        // Arrange
        mockExtendExistingSubscriptionTrial.mockResolvedValue({
            success: false as const,
            error: {
                code: 'NOT_FOUND',
                message: `Subscription not found: ${SUBSCRIPTION_ID}`
            }
        });

        // Act
        const res = await app.request(`${ROUTE_BASE}/${SUBSCRIPTION_ID}/apply-trial-extension`, {
            method: 'POST',
            headers: makeHeaders(makeAdminActor()),
            body: JSON.stringify({ promoCodeId: PROMO_CODE_ID })
        });

        // Assert
        expect(res.status).toBe(404);
    });

    // ── Schema validation: invalid UUID for subscriptionId → 400 ───────────────

    it('invalid subscriptionId format → 400 (schema validation)', async () => {
        // Act
        const res = await app.request(`${ROUTE_BASE}/not-a-valid-uuid/apply-trial-extension`, {
            method: 'POST',
            headers: makeHeaders(makeAdminActor()),
            body: JSON.stringify({ promoCodeId: PROMO_CODE_ID })
        });

        // Assert
        expect(res.status).toBe(400);
        expect(mockExtendExistingSubscriptionTrial).not.toHaveBeenCalled();
    });

    // ── Schema validation: invalid UUID for promoCodeId → 400 ──────────────────

    it('invalid promoCodeId format → 400 (schema validation)', async () => {
        // Act
        const res = await app.request(`${ROUTE_BASE}/${SUBSCRIPTION_ID}/apply-trial-extension`, {
            method: 'POST',
            headers: makeHeaders(makeAdminActor()),
            body: JSON.stringify({ promoCodeId: 'not-a-uuid' })
        });

        // Assert
        expect(res.status).toBe(400);
        expect(mockExtendExistingSubscriptionTrial).not.toHaveBeenCalled();
    });
});
