/**
 * Tests for GET /api/v1/protected/users/me/subscription soft-cancel state
 * (SPEC-147 T-011).
 *
 * Verifies that the subscription GET response surfaces the soft-cancel state
 * so the SPEC-203 UI can render "your subscription is scheduled to cancel —
 * access until <date>":
 *
 * - Soft-cancelled sub (cancelAtPeriodEnd=true, canceledAt set) → GET returns
 *   the flags + the access-until date via `currentPeriodEnd`.
 * - Active non-cancelled sub → `cancelAtPeriodEnd` false, `canceledAt` null.
 *
 * Design note: `accessUntil` is NOT a separate field. The UI uses
 * `currentPeriodEnd` for the "access ends on" date. This avoids duplicating
 * a value that is already present in the response schema.
 *
 * @module test/routes/user/protected/subscription-soft-cancel
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockGetBySlug, mockCreateProtectedRoute } = vi.hoisted(() => ({
    mockGetBySlug: vi.fn(),
    mockCreateProtectedRoute: vi.fn()
}));

const { mockGetQZPayBilling } = vi.hoisted(() => ({
    mockGetQZPayBilling: vi.fn()
}));

// ---------------------------------------------------------------------------
// Module mocks — must be declared before imports
// ---------------------------------------------------------------------------

vi.mock('../../../../src/services/plan.service', () => ({
    PlanService: vi.fn().mockImplementation(() => ({
        list: vi.fn(),
        getBySlug: mockGetBySlug
    }))
}));

vi.mock('@repo/billing', () => ({
    PAYMENT_GRACE_PERIOD_DAYS: 7,
    getDefaultEntitlements: vi.fn(() => ({ entitlements: [], limits: [] })),
    getUnlimitedEntitlements: vi.fn(() => ({ entitlements: [], limits: [] }))
}));

vi.mock('../../../../src/middlewares/billing', () => ({
    getQZPayBilling: () => mockGetQZPayBilling()
}));

vi.mock('../../../../src/utils/route-factory', () => ({
    createProtectedRoute: mockCreateProtectedRoute
}));

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('../../../../src/utils/actor', () => ({
    getActorFromContext: vi.fn(() => ({ id: 'test-user-id' }))
}));

// ---------------------------------------------------------------------------
// Import triggers — AFTER all vi.mock declarations
// ---------------------------------------------------------------------------

import '../../../../src/routes/user/protected/subscription';

// ---------------------------------------------------------------------------
// Capture handler from mock call
// ---------------------------------------------------------------------------

type RouteConfig = { handler: (ctx: unknown) => Promise<unknown> };

const [subscriptionRouteConfig] = mockCreateProtectedRoute.mock.calls.map(
    (call) => call[0] as RouteConfig
);

const subscriptionHandler = subscriptionRouteConfig?.handler as (ctx: unknown) => Promise<unknown>;

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

const STUB_PLAN = {
    id: 'aaaa-bbbb-cccc-dddd-eeee',
    slug: 'owner-pro',
    name: 'Pro',
    description: 'Plan pro',
    category: 'owner' as const,
    monthlyPriceArs: 1_000_000,
    annualPriceArs: null,
    monthlyPriceUsdRef: 10,
    hasTrial: true,
    trialDays: 14,
    isDefault: false,
    sortOrder: 2,
    entitlements: ['CAN_LIST_ACCOMMODATION'],
    limits: { max_accommodations: 5 },
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
};

const PLAN_FOUND = { success: true as const, data: STUB_PLAN };

/** ISO strings used across tests */
const PERIOD_END = '2026-06-30T23:59:59.000Z';
const PERIOD_START = '2026-06-01T00:00:00.000Z';
const CANCELED_AT = '2026-06-09T10:00:00.000Z';

// ---------------------------------------------------------------------------
// Context factory
// ---------------------------------------------------------------------------

function makeCtx(overrides: Record<string, unknown> = {}) {
    const store = new Map<string, unknown>([
        ['billingEnabled', true],
        ...Object.entries(overrides)
    ]);
    return {
        get: (key: string) => store.get(key),
        set: (key: string, val: unknown) => store.set(key, val)
    };
}

// ---------------------------------------------------------------------------
// Billing mock factories
// ---------------------------------------------------------------------------

function makeSoftCancelledSub() {
    return {
        status: 'active',
        planId: 'owner-pro',
        currentPeriodStart: new Date(PERIOD_START),
        currentPeriodEnd: new Date(PERIOD_END),
        cancelAtPeriodEnd: true,
        canceledAt: new Date(CANCELED_AT),
        trialEnd: null
    };
}

function makeActiveSub() {
    return {
        status: 'active',
        planId: 'owner-pro',
        currentPeriodStart: new Date(PERIOD_START),
        currentPeriodEnd: new Date(PERIOD_END),
        cancelAtPeriodEnd: false,
        canceledAt: null,
        trialEnd: null
    };
}

function setupBillingMock(sub: ReturnType<typeof makeSoftCancelledSub | typeof makeActiveSub>) {
    const mock = {
        customers: {
            getByExternalId: vi.fn().mockResolvedValue({ id: 'cust-123' })
        },
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue([sub])
        },
        plans: { get: vi.fn().mockResolvedValue({ name: 'owner-pro' }) }
    };
    mockGetQZPayBilling.mockReturnValue(mock);
    return mock;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/v1/protected/users/me/subscription — soft-cancel state (SPEC-147 T-011)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('soft-cancelled subscription (cancelAtPeriodEnd=true, canceledAt set)', () => {
        it('returns cancelAtPeriodEnd=true', async () => {
            // Arrange
            setupBillingMock(makeSoftCancelledSub());
            mockGetBySlug.mockResolvedValue(PLAN_FOUND);

            // Act
            const result = (await subscriptionHandler(makeCtx())) as {
                subscription: { cancelAtPeriodEnd: boolean };
            };

            // Assert
            expect(result.subscription?.cancelAtPeriodEnd).toBe(true);
        });

        it('returns canceledAt as ISO string matching the recorded date', async () => {
            // Arrange
            setupBillingMock(makeSoftCancelledSub());
            mockGetBySlug.mockResolvedValue(PLAN_FOUND);

            // Act
            const result = (await subscriptionHandler(makeCtx())) as {
                subscription: { canceledAt: string | null };
            };

            // Assert
            expect(result.subscription?.canceledAt).toBe(CANCELED_AT);
        });

        it('returns currentPeriodEnd as the access-until date', async () => {
            // Arrange — accessUntil = currentPeriodEnd (no separate field)
            setupBillingMock(makeSoftCancelledSub());
            mockGetBySlug.mockResolvedValue(PLAN_FOUND);

            // Act
            const result = (await subscriptionHandler(makeCtx())) as {
                subscription: { currentPeriodEnd: string | null };
            };

            // Assert
            expect(result.subscription?.currentPeriodEnd).toBe(PERIOD_END);
        });

        it('returns all three soft-cancel fields together in one call', async () => {
            // Arrange
            setupBillingMock(makeSoftCancelledSub());
            mockGetBySlug.mockResolvedValue(PLAN_FOUND);

            // Act
            const result = (await subscriptionHandler(makeCtx())) as {
                subscription: {
                    cancelAtPeriodEnd: boolean;
                    canceledAt: string | null;
                    currentPeriodEnd: string | null;
                };
            };

            // Assert — all three soft-cancel indicators must be present and correct
            expect(result.subscription?.cancelAtPeriodEnd).toBe(true);
            expect(result.subscription?.canceledAt).toBe(CANCELED_AT);
            expect(result.subscription?.currentPeriodEnd).toBe(PERIOD_END);
        });

        it('returns status=active (finalization cron flips it later, not the cancel endpoint)', async () => {
            // Arrange
            setupBillingMock(makeSoftCancelledSub());
            mockGetBySlug.mockResolvedValue(PLAN_FOUND);

            // Act
            const result = (await subscriptionHandler(makeCtx())) as {
                subscription: { status: string };
            };

            // Assert
            expect(result.subscription?.status).toBe('active');
        });
    });

    describe('active non-cancelled subscription', () => {
        it('returns cancelAtPeriodEnd=false', async () => {
            // Arrange
            setupBillingMock(makeActiveSub());
            mockGetBySlug.mockResolvedValue(PLAN_FOUND);

            // Act
            const result = (await subscriptionHandler(makeCtx())) as {
                subscription: { cancelAtPeriodEnd: boolean };
            };

            // Assert
            expect(result.subscription?.cancelAtPeriodEnd).toBe(false);
        });

        it('returns canceledAt=null', async () => {
            // Arrange
            setupBillingMock(makeActiveSub());
            mockGetBySlug.mockResolvedValue(PLAN_FOUND);

            // Act
            const result = (await subscriptionHandler(makeCtx())) as {
                subscription: { canceledAt: string | null };
            };

            // Assert
            expect(result.subscription?.canceledAt).toBeNull();
        });

        it('returns cancelAtPeriodEnd=false and canceledAt=null together', async () => {
            // Arrange
            setupBillingMock(makeActiveSub());
            mockGetBySlug.mockResolvedValue(PLAN_FOUND);

            // Act
            const result = (await subscriptionHandler(makeCtx())) as {
                subscription: {
                    cancelAtPeriodEnd: boolean;
                    canceledAt: string | null;
                };
            };

            // Assert
            expect(result.subscription?.cancelAtPeriodEnd).toBe(false);
            expect(result.subscription?.canceledAt).toBeNull();
        });
    });
});
