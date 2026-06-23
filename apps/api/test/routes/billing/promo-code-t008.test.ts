/**
 * T-008 Integration Tests: Admin promo-code create + /apply branching
 *
 * Covers SPEC-262 T-008 acceptance criteria:
 *
 * Admin create (`POST /api/v1/admin/billing/promo-codes`):
 *   AC-1.1  valid discount / trial_extension / comp → 201
 *   AC-1.2  percentage value > 100 → 422 (schema layer)
 *   AC-1.3  durationCycles = 0 → 422 (schema layer)
 *   AC-5.4  negative extraDays → 422 (schema layer)
 *   AC-6.1  missing BILLING_PROMO_CODE_MANAGE → 403
 *
 * Protected apply branching (`POST /api/v1/protected/billing/promo-codes/apply`):
 *   AC-4.3  discount → backward-compat response (discountAmount, finalAmount, amount)
 *   comp → effectKind=comp, finalAmount=0
 *   trial_extension → effectKind=trial_extension, extraDays present
 *   AC-6.2  customerId ≠ own billingCustomerId without ACCESS_API_ADMIN → 403
 *   AC-6.2  admin with ACCESS_API_ADMIN bypasses ownership guard
 *
 * @module test/routes/billing/promo-code-t008
 */

// ---------------------------------------------------------------------------
// Environment — must precede ALL module imports
// ---------------------------------------------------------------------------
process.env.NODE_ENV = 'test';
process.env.HOSPEDA_DISABLE_AUTH = 'true';
process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
// Ensure CI is not 'true' so isMockActorAllowed() passes (checks env.CI !== 'true')
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
const {
    mockCreate,
    mockGetByCode,
    mockApply,
    mockApplySeam,
    mockAssertSubOwnership,
    mockBillingCustomerIdCell
} = vi.hoisted(() => ({
    mockCreate: vi.fn(),
    mockGetByCode: vi.fn(),
    mockApply: vi.fn(),
    mockApplySeam: vi.fn(),
    /**
     * Controls what assertSubscriptionOwnership returns.
     * Default: success (no cross-customer violation).
     * Tests override to return { success: false, error: {...} } for security tests.
     */
    mockAssertSubOwnership: vi.fn().mockResolvedValue({ success: true }),
    /** Mutable cell: tests set this to control what billingCustomerMiddleware injects. */
    mockBillingCustomerIdCell: { value: null as string | null }
}));

// ---------------------------------------------------------------------------
// Module mocks — order matters: declare before any import of the mocked module
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

// Mock the PromoCodeService (used by both promo-codes.ts + promo-codes.apply.ts)
// and assertSubscriptionOwnership (B1 security helper)
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        PromoCodeService: vi.fn().mockImplementation(() => ({
            create: mockCreate,
            getByCode: mockGetByCode,
            apply: mockApply,
            validate: vi.fn().mockResolvedValue({ valid: true }),
            update: vi.fn(),
            getById: vi.fn(),
            list: vi.fn(),
            delete: vi.fn()
        })),
        // B1 fix: mock subscription ownership assertion (avoids real DB call)
        assertSubscriptionOwnership: mockAssertSubOwnership
    };
});

// Mock the T-007 seam
vi.mock('../../../src/services/promo-discount-apply.service', () => ({
    applyMultiCycleDiscountToExistingSubscription: mockApplySeam
}));

// Billing middleware — getQZPayBilling returns null (not used in create path)
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

// billing-customer middleware — injects billingCustomerId from test cell
vi.mock('../../../src/middlewares/billing-customer', () => ({
    billingCustomerMiddleware:
        () => async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
            c.set('billingCustomerId', mockBillingCustomerIdCell.value);
            await next();
        }
}));

// billing-perm middleware: requires BILLING_VIEW_OWN on /protected/billing/*
// Mock as pass-through so our actor permission sets can be minimal
vi.mock('../../../src/middlewares/billing-perm.middleware', () => ({
    billingPermMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    }
}));

// Pass-through middlewares not under test
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

// QZPay Hono — replace with a minimal stub that passes auth middleware through
vi.mock('@qazuor/qzpay-hono', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OpenAPIHono } = require('@hono/zod-openapi');
    return {
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
                // Stub routes that the billing router references
                router.get(
                    '/customers/:id',
                    (c: {
                        json: (d: unknown) => Response;
                        req: { param: (n: string) => string };
                    }) => c.json({ id: c.req.param('id') })
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

import { randomUUID } from 'node:crypto';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Admin actor with full promo-code management permissions (AC-6.1 pass). */
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

/** Build a minimal PromoCode success stub. */
function makePromoCodeStub(overrides: Record<string, unknown> = {}) {
    return {
        id: randomUUID(),
        code: 'TESTCODE',
        type: 'percentage',
        value: 30,
        active: true,
        timesRedeemed: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        effect: { kind: 'discount', valueKind: 'percentage', value: 30, durationCycles: 3 },
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Suite 1: Admin create route
// AC-1.1, AC-1.2, AC-1.3, AC-5.4, AC-6.1
// ---------------------------------------------------------------------------

describe('POST /api/v1/admin/billing/promo-codes', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(() => {
        validateApiEnv();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        app = initApp();
    });

    // ── AC-1.1: discount ────────────────────────────────────────────────────

    it('AC-1.1 creates a discount code (durationCycles=3) → 201', async () => {
        // Arrange
        mockCreate.mockResolvedValue({ success: true, data: makePromoCodeStub() });

        // Act
        const res = await app.request('/api/v1/admin/billing/promo-codes', {
            method: 'POST',
            headers: makeHeaders(makeAdminActor()),
            body: JSON.stringify({
                code: 'SAVE30',
                effect: { kind: 'discount', valueKind: 'percentage', value: 30, durationCycles: 3 }
            })
        });

        // Assert
        expect(res.status).toBe(201);
        const body = (await res.json()) as { success: boolean };
        expect(body.success).toBe(true);
        expect(mockCreate).toHaveBeenCalledOnce();
    });

    // ── AC-1.1: trial_extension ──────────────────────────────────────────────

    it('AC-1.1 creates a trial_extension code (extraDays=30) → 201', async () => {
        // Arrange
        mockCreate.mockResolvedValue({
            success: true,
            data: makePromoCodeStub({
                code: 'FREEMONTH',
                type: 'trial_extension',
                effect: { kind: 'trial_extension', extraDays: 30 }
            })
        });

        // Act
        const res = await app.request('/api/v1/admin/billing/promo-codes', {
            method: 'POST',
            headers: makeHeaders(makeAdminActor()),
            body: JSON.stringify({
                code: 'FREEMONTH',
                effect: { kind: 'trial_extension', extraDays: 30 }
            })
        });

        // Assert
        expect(res.status).toBe(201);
        const body = (await res.json()) as { success: boolean };
        expect(body.success).toBe(true);
    });

    // ── AC-1.1: comp ─────────────────────────────────────────────────────────

    it('AC-1.1 creates a comp code → 201', async () => {
        // Arrange
        mockCreate.mockResolvedValue({
            success: true,
            data: makePromoCodeStub({
                code: 'HOSPEDA_FREE',
                type: 'comp',
                effect: { kind: 'comp' }
            })
        });

        // Act
        const res = await app.request('/api/v1/admin/billing/promo-codes', {
            method: 'POST',
            headers: makeHeaders(makeAdminActor()),
            body: JSON.stringify({
                code: 'HOSPEDA_FREE',
                effect: { kind: 'comp' }
            })
        });

        // Assert
        expect(res.status).toBe(201);
        const body = (await res.json()) as { success: boolean };
        expect(body.success).toBe(true);
    });

    // ── AC-1.2 + AC-5.4: percentage > 100 ───────────────────────────────────

    it('AC-1.2/AC-5.4 rejects discount with percentage value > 100 → 400', async () => {
        // Arrange — Zod refine: percentage must be ≤ 100

        // Act
        const res = await app.request('/api/v1/admin/billing/promo-codes', {
            method: 'POST',
            headers: makeHeaders(makeAdminActor()),
            body: JSON.stringify({
                code: 'BADPCT',
                effect: { kind: 'discount', valueKind: 'percentage', value: 150, durationCycles: 1 }
            })
        });

        // Assert — Zod rejects at schema layer before handler runs.
        // Route factory uses 400 (Bad Request) for body validation failures.
        expect(res.status).toBe(400);
        expect(mockCreate).not.toHaveBeenCalled();
    });

    // ── AC-1.3 + AC-5.4: durationCycles = 0 ────────────────────────────────

    it('AC-1.3/AC-5.4 rejects discount with durationCycles = 0 → 400', async () => {
        // Act
        const res = await app.request('/api/v1/admin/billing/promo-codes', {
            method: 'POST',
            headers: makeHeaders(makeAdminActor()),
            body: JSON.stringify({
                code: 'ZEROCYCLES',
                effect: { kind: 'discount', valueKind: 'percentage', value: 20, durationCycles: 0 }
            })
        });

        // Assert
        expect(res.status).toBe(400);
        expect(mockCreate).not.toHaveBeenCalled();
    });

    // ── AC-5.4: extraDays < 1 ────────────────────────────────────────────────

    it('AC-5.4 rejects trial_extension with negative extraDays → 400', async () => {
        // Act
        const res = await app.request('/api/v1/admin/billing/promo-codes', {
            method: 'POST',
            headers: makeHeaders(makeAdminActor()),
            body: JSON.stringify({
                code: 'NEGDAYS',
                effect: { kind: 'trial_extension', extraDays: -5 }
            })
        });

        // Assert
        expect(res.status).toBe(400);
        expect(mockCreate).not.toHaveBeenCalled();
    });

    // ── AC-6.1: BILLING_PROMO_CODE_MANAGE required ───────────────────────────

    it('AC-6.1 returns 403 when caller lacks BILLING_PROMO_CODE_MANAGE', async () => {
        // Arrange — admin-tier actor WITHOUT the specific manage permission
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
        const res = await app.request('/api/v1/admin/billing/promo-codes', {
            method: 'POST',
            headers: makeHeaders(restrictedActor),
            body: JSON.stringify({
                code: 'FORBIDDEN',
                effect: { kind: 'discount', valueKind: 'percentage', value: 10, durationCycles: 1 }
            })
        });

        // Assert
        expect(res.status).toBe(403);
        expect(mockCreate).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Suite 2: Protected apply route branching
// AC-4.3, comp, trial_extension branching; AC-6.2 ownership guard
// ---------------------------------------------------------------------------

describe('POST /api/v1/protected/billing/promo-codes/apply', () => {
    let app: ReturnType<typeof initApp>;

    const OWN_CUSTOMER_ID = randomUUID();

    /** Regular host actor without ACCESS_API_ADMIN */
    function makeHostActor(id = randomUUID()) {
        return {
            id,
            role: RoleEnum.HOST,
            permissions: [
                PermissionEnum.ACCESS_API_PUBLIC,
                PermissionEnum.ACCESS_API_PRIVATE,
                PermissionEnum.BILLING_VIEW_OWN
            ] as string[]
        };
    }

    beforeAll(() => {
        validateApiEnv();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        // Default: subscription ownership check passes (no cross-customer violation)
        mockAssertSubOwnership.mockResolvedValue({ success: true });
        // Default: caller is looking up their own customer
        mockBillingCustomerIdCell.value = OWN_CUSTOMER_ID;
        app = initApp();
    });

    // ── AC-4.3: discount → backward-compat shape ─────────────────────────────

    it('AC-4.3 discount effect → backward-compat response (discountAmount, finalAmount, amount)', async () => {
        // Arrange
        mockApply.mockResolvedValue({
            success: true,
            data: {
                effectKind: 'discount',
                code: 'SAVE30',
                type: 'percentage',
                value: 30,
                originalAmount: 10000,
                discountAmount: 3000,
                finalAmount: 7000
            }
        });

        // Act
        const res = await app.request('/api/v1/protected/billing/promo-codes/apply', {
            method: 'POST',
            headers: makeHeaders(makeHostActor()),
            body: JSON.stringify({
                code: 'SAVE30',
                customerId: OWN_CUSTOMER_ID,
                amount: 10000
            })
        });

        // Assert
        expect([200, 201]).toContain(res.status);
        const body = (await res.json()) as {
            success: boolean;
            data?: {
                effectKind: string;
                discountAmount: number;
                finalAmount: number;
                amount: number;
                originalAmount: number;
            };
        };
        expect(body.success).toBe(true);
        const data = body.data!;
        expect(data.effectKind).toBe('discount');
        expect(data.discountAmount).toBe(3000);
        expect(data.finalAmount).toBe(7000);
        // backward-compat alias (AC-4.3)
        expect(data.amount).toBe(7000);
        expect(data.originalAmount).toBe(10000);
    });

    // ── comp effect ───────────────────────────────────────────────────────────

    it('comp effect → effectKind=comp, finalAmount=0, comp=true', async () => {
        // Arrange
        mockApply.mockResolvedValue({
            success: true,
            data: {
                effectKind: 'comp',
                code: 'HOSPEDA_FREE',
                discountAmount: 0,
                finalAmount: 0,
                originalAmount: 10000,
                type: undefined,
                value: undefined
            }
        });

        // Act
        const res = await app.request('/api/v1/protected/billing/promo-codes/apply', {
            method: 'POST',
            headers: makeHeaders(makeHostActor()),
            body: JSON.stringify({
                code: 'HOSPEDA_FREE',
                customerId: OWN_CUSTOMER_ID,
                amount: 10000
            })
        });

        // Assert
        expect([200, 201]).toContain(res.status);
        const body = (await res.json()) as { success: boolean; data?: Record<string, unknown> };
        expect(body.success).toBe(true);
        const data = body.data!;
        expect(data.effectKind).toBe('comp');
        expect(data.finalAmount).toBe(0);
        expect(data.comp).toBe(true);
    });

    // ── trial_extension effect ────────────────────────────────────────────────

    it('trial_extension effect → effectKind=trial_extension, extraDays present', async () => {
        // Arrange
        mockApply.mockResolvedValue({
            success: true,
            data: {
                effectKind: 'trial_extension',
                code: 'FREEMONTH',
                extraDays: 30,
                discountAmount: 0,
                finalAmount: 10000,
                originalAmount: 10000,
                type: undefined,
                value: undefined
            }
        });

        // Act
        const res = await app.request('/api/v1/protected/billing/promo-codes/apply', {
            method: 'POST',
            headers: makeHeaders(makeHostActor()),
            body: JSON.stringify({
                code: 'FREEMONTH',
                customerId: OWN_CUSTOMER_ID,
                amount: 10000
            })
        });

        // Assert
        expect([200, 201]).toContain(res.status);
        const body = (await res.json()) as { success: boolean; data?: Record<string, unknown> };
        expect(body.success).toBe(true);
        const data = body.data!;
        expect(data.effectKind).toBe('trial_extension');
        expect(data.extraDays).toBe(30);
        expect(typeof data.trialEnd).toBe('string');
    });

    // ── AC-6.2: non-admin cannot use a different customerId ──────────────────

    it('AC-6.2 non-admin with mismatched customerId → 403', async () => {
        // Arrange
        const differentCustomerId = randomUUID(); // NOT OWN_CUSTOMER_ID

        // Act
        const res = await app.request('/api/v1/protected/billing/promo-codes/apply', {
            method: 'POST',
            headers: makeHeaders(makeHostActor()),
            body: JSON.stringify({
                code: 'SAVE30',
                customerId: differentCustomerId,
                amount: 10000
            })
        });

        // Assert — ownership guard fires before service.apply
        expect(res.status).toBe(403);
        expect(mockApply).not.toHaveBeenCalled();
    });

    // ── AC-6.2: admin bypasses ownership guard ────────────────────────────────

    it('AC-6.2 admin with ACCESS_API_ADMIN bypasses ownership guard', async () => {
        // Arrange — admin can apply to any customerId
        const anyCustomerId = randomUUID(); // NOT OWN_CUSTOMER_ID
        mockApply.mockResolvedValue({
            success: true,
            data: {
                effectKind: 'discount',
                code: 'SAVE30',
                type: 'percentage',
                value: 30,
                originalAmount: 10000,
                discountAmount: 3000,
                finalAmount: 7000
            }
        });

        // Act
        const res = await app.request('/api/v1/protected/billing/promo-codes/apply', {
            method: 'POST',
            headers: makeHeaders(makeAdminActor()),
            body: JSON.stringify({
                code: 'SAVE30',
                customerId: anyCustomerId,
                amount: 10000
            })
        });

        // Assert — admin passes ownership check; service.apply is called
        expect([200, 201]).toContain(res.status);
        expect(mockApply).toHaveBeenCalledOnce();
    });

    // ── B1 security regression: foreign subscriptionId + own customerId ────────

    it('B1 discount path: foreign subscriptionId + own customerId → 403, no mutation', async () => {
        // Arrange — assertSubscriptionOwnership rejects (sub belongs to victim)
        mockAssertSubOwnership.mockResolvedValue({
            success: false,
            error: { code: 'PERMISSION_DENIED', message: 'Subscription does not belong to you' }
        });

        // Act — attacker passes THEIR OWN customerId but a VICTIM subscription
        const res = await app.request('/api/v1/protected/billing/promo-codes/apply', {
            method: 'POST',
            headers: makeHeaders(makeHostActor()),
            body: JSON.stringify({
                code: 'SAVE30',
                customerId: OWN_CUSTOMER_ID,
                subscriptionId: randomUUID(), // victim's subscription
                amount: 10000
            })
        });

        // Assert — blocked before any MP mutation or service.apply call
        expect(res.status).toBe(403);
        expect(mockApply).not.toHaveBeenCalled();
        expect(mockApplySeam).not.toHaveBeenCalled();
    });

    it('B1 comp path: foreign subscriptionId + own customerId → 403, no status flip', async () => {
        // Arrange — assertSubscriptionOwnership rejects
        mockAssertSubOwnership.mockResolvedValue({
            success: false,
            error: { code: 'PERMISSION_DENIED', message: 'Subscription does not belong to you' }
        });

        // Act — attacker cannot flip victim's subscription to comp=free-forever
        const res = await app.request('/api/v1/protected/billing/promo-codes/apply', {
            method: 'POST',
            headers: makeHeaders(makeHostActor()),
            body: JSON.stringify({
                code: 'HOSPEDA_FREE',
                customerId: OWN_CUSTOMER_ID,
                subscriptionId: randomUUID(), // victim's subscription
                amount: 10000
            })
        });

        // Assert — ownership check fires; service.apply (which flips status=comp) not called
        expect(res.status).toBe(403);
        expect(mockApply).not.toHaveBeenCalled();
    });

    it('B1 trial_extension path: foreign subscriptionId + own customerId → 403, no usage insert', async () => {
        // Arrange
        mockAssertSubOwnership.mockResolvedValue({
            success: false,
            error: { code: 'PERMISSION_DENIED', message: 'Subscription does not belong to you' }
        });

        // Act
        const res = await app.request('/api/v1/protected/billing/promo-codes/apply', {
            method: 'POST',
            headers: makeHeaders(makeHostActor()),
            body: JSON.stringify({
                code: 'FREEMONTH',
                customerId: OWN_CUSTOMER_ID,
                subscriptionId: randomUUID(), // victim's subscription
                amount: 10000
            })
        });

        // Assert — usage not inserted on victim's sub
        expect(res.status).toBe(403);
        expect(mockApply).not.toHaveBeenCalled();
    });

    it('B1: subscriptionId not found → 404', async () => {
        // Arrange — assertSubscriptionOwnership returns NOT_FOUND
        mockAssertSubOwnership.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Subscription not found' }
        });

        // Act
        const res = await app.request('/api/v1/protected/billing/promo-codes/apply', {
            method: 'POST',
            headers: makeHeaders(makeHostActor()),
            body: JSON.stringify({
                code: 'SAVE30',
                customerId: OWN_CUSTOMER_ID,
                subscriptionId: randomUUID(),
                amount: 10000
            })
        });

        // Assert
        expect(res.status).toBe(404);
        expect(mockApply).not.toHaveBeenCalled();
    });

    it('B1: admin with ACCESS_API_ADMIN + foreign subscriptionId → passes ownership, 200/201', async () => {
        // Arrange — ownership check passes for admin (from beforeEach default).
        // getByCode returns no discount effect → seam skipped → falls to service.apply.
        mockGetByCode.mockResolvedValue({
            success: true,
            data: makePromoCodeStub({ effect: { kind: 'comp' } })
        });
        mockApply.mockResolvedValue({
            success: true,
            data: {
                effectKind: 'discount',
                code: 'SAVE30',
                type: 'percentage',
                value: 30,
                originalAmount: 10000,
                discountAmount: 3000,
                finalAmount: 7000
            }
        });

        // Act — admin uses a foreign subscriptionId; ownership check is bypassed
        const foreignSubscriptionId = randomUUID();
        const res = await app.request('/api/v1/protected/billing/promo-codes/apply', {
            method: 'POST',
            headers: makeHeaders(makeAdminActor()),
            body: JSON.stringify({
                code: 'SAVE30',
                customerId: OWN_CUSTOMER_ID,
                subscriptionId: foreignSubscriptionId,
                amount: 10000
            })
        });

        // Assert — admin is not blocked; service.apply is called
        expect([200, 201]).toContain(res.status);
        expect(mockApply).toHaveBeenCalledOnce();
    });

    // ── SF3: max-uses error → 409 (not 500) ──────────────────────────────────

    it('SF3: code at max uses via /apply → 409 Conflict', async () => {
        // Arrange — service.apply returns PROMO_CODE_MAX_USES error
        mockApply.mockResolvedValue({
            success: false,
            error: {
                code: 'PROMO_CODE_MAX_USES',
                message: 'This promo code has reached its maximum number of uses'
            }
        });

        // Act
        const res = await app.request('/api/v1/protected/billing/promo-codes/apply', {
            method: 'POST',
            headers: makeHeaders(makeHostActor()),
            body: JSON.stringify({
                code: 'EXHAUSTED',
                customerId: OWN_CUSTOMER_ID,
                amount: 10000
            })
        });

        // Assert — 409 Conflict, not 500 Internal Server Error
        expect(res.status).toBe(409);
    });
});
