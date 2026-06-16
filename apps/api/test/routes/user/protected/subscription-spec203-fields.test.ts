/**
 * Tests for GET /api/v1/protected/users/me/subscription — SPEC-203 new fields.
 *
 * Verifies that the two fields added for the plan-management UI are present
 * and correctly populated:
 *
 * - `id`                — always the subscription id string (needed by the
 *                         cancel-flow: POST .../subscriptions/{id}/cancel).
 * - `scheduledPlanChange` — null when none; `{ newPlanId, effectiveAt }` when
 *                           a pending downgrade is queued via
 *                           `scheduleSubscriptionDowngrade`.
 *
 * Test matrix:
 *   1. Active sub with no scheduled change → id present, scheduledPlanChange null.
 *   2. Active sub with a pending scheduled change → id present, scheduledPlanChange populated.
 *   3. Active sub with an applied (non-pending) scheduled change → scheduledPlanChange null.
 *
 * @module test/routes/user/protected/subscription-spec203-fields
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

const PERIOD_START = '2026-06-01T00:00:00.000Z';
const PERIOD_END = '2026-06-30T23:59:59.000Z';
const APPLY_AT = '2026-06-30T23:59:59.000Z';
const NEW_PLAN_ID = 'owner-basic';

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
// Subscription stub factories
// ---------------------------------------------------------------------------

interface StubScheduledChange {
    readonly newPlanId: string;
    readonly newPriceId: string;
    readonly targetTransactionAmountMajor: number;
    readonly applyAt: string;
    readonly requestedAt: string;
    readonly status: 'pending' | 'applied' | 'cancelled' | 'failed';
    readonly attemptCount: number;
    readonly metadata: Record<string, unknown>;
}

interface StubSub {
    readonly id: string;
    readonly status: string;
    readonly planId: string;
    readonly currentPeriodStart: Date;
    readonly currentPeriodEnd: Date;
    readonly cancelAtPeriodEnd: boolean;
    readonly canceledAt: null;
    readonly trialEnd: null;
    readonly scheduledPlanChange: StubScheduledChange | null;
}

function makeBaseSub(subId = 'sub_test_001'): StubSub {
    return {
        id: subId,
        status: 'active',
        planId: 'owner-pro',
        currentPeriodStart: new Date(PERIOD_START),
        currentPeriodEnd: new Date(PERIOD_END),
        cancelAtPeriodEnd: false,
        canceledAt: null,
        trialEnd: null,
        scheduledPlanChange: null
    };
}

function setupBillingMock(sub: StubSub) {
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

describe('GET /api/v1/protected/users/me/subscription — SPEC-203 id + scheduledPlanChange fields', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('id field', () => {
        it('returns the subscription id as a string when subscription is active', async () => {
            // Arrange
            const sub = makeBaseSub('sub_abc_123');
            setupBillingMock(sub);
            mockGetBySlug.mockResolvedValue(PLAN_FOUND);

            // Act
            const result = (await subscriptionHandler(makeCtx())) as {
                subscription: { id: string } | null;
            };

            // Assert
            expect(result.subscription?.id).toBe('sub_abc_123');
        });

        it('id is always a string (not undefined or null) on a non-null subscription', async () => {
            // Arrange
            setupBillingMock(makeBaseSub('sub_xyz_789'));
            mockGetBySlug.mockResolvedValue(PLAN_FOUND);

            // Act
            const result = (await subscriptionHandler(makeCtx())) as {
                subscription: { id: unknown } | null;
            };

            // Assert
            expect(typeof result.subscription?.id).toBe('string');
        });
    });

    describe('scheduledPlanChange field — no pending change', () => {
        it('returns scheduledPlanChange=null when scheduledPlanChange is null on the subscription', async () => {
            // Arrange — no scheduled change at all
            const sub = { ...makeBaseSub(), scheduledPlanChange: null };
            setupBillingMock(sub);
            mockGetBySlug.mockResolvedValue(PLAN_FOUND);

            // Act
            const result = (await subscriptionHandler(makeCtx())) as {
                subscription: { scheduledPlanChange: unknown } | null;
            };

            // Assert
            expect(result.subscription?.scheduledPlanChange).toBeNull();
        });

        it('returns scheduledPlanChange=null when the existing change has status=applied (non-pending)', async () => {
            // Arrange — historical applied change must not surface as pending
            const sub = {
                ...makeBaseSub(),
                scheduledPlanChange: {
                    newPlanId: NEW_PLAN_ID,
                    newPriceId: 'price_basic',
                    targetTransactionAmountMajor: 500,
                    applyAt: APPLY_AT,
                    requestedAt: '2026-06-01T12:00:00.000Z',
                    status: 'applied' as const,
                    attemptCount: 1,
                    metadata: {}
                }
            };
            setupBillingMock(sub);
            mockGetBySlug.mockResolvedValue(PLAN_FOUND);

            // Act
            const result = (await subscriptionHandler(makeCtx())) as {
                subscription: { scheduledPlanChange: unknown } | null;
            };

            // Assert — applied changes must NOT be surfaced
            expect(result.subscription?.scheduledPlanChange).toBeNull();
        });

        it('returns scheduledPlanChange=null when the existing change has status=cancelled', async () => {
            // Arrange
            const sub = {
                ...makeBaseSub(),
                scheduledPlanChange: {
                    newPlanId: NEW_PLAN_ID,
                    newPriceId: 'price_basic',
                    targetTransactionAmountMajor: 500,
                    applyAt: APPLY_AT,
                    requestedAt: '2026-06-01T12:00:00.000Z',
                    status: 'cancelled' as const,
                    attemptCount: 0,
                    metadata: {}
                }
            };
            setupBillingMock(sub);
            mockGetBySlug.mockResolvedValue(PLAN_FOUND);

            // Act
            const result = (await subscriptionHandler(makeCtx())) as {
                subscription: { scheduledPlanChange: unknown } | null;
            };

            // Assert
            expect(result.subscription?.scheduledPlanChange).toBeNull();
        });
    });

    describe('scheduledPlanChange field — pending change present', () => {
        it('returns scheduledPlanChange with newPlanId and effectiveAt when status=pending', async () => {
            // Arrange
            const sub = {
                ...makeBaseSub(),
                scheduledPlanChange: {
                    newPlanId: NEW_PLAN_ID,
                    newPriceId: 'price_basic',
                    targetTransactionAmountMajor: 500,
                    applyAt: APPLY_AT,
                    requestedAt: '2026-06-01T12:00:00.000Z',
                    status: 'pending' as const,
                    attemptCount: 0,
                    metadata: {}
                }
            };
            setupBillingMock(sub);
            mockGetBySlug.mockResolvedValue(PLAN_FOUND);

            // Act
            const result = (await subscriptionHandler(makeCtx())) as {
                subscription: {
                    scheduledPlanChange: { newPlanId: string; effectiveAt: string } | null;
                } | null;
            };

            // Assert
            expect(result.subscription?.scheduledPlanChange).not.toBeNull();
            expect(result.subscription?.scheduledPlanChange?.newPlanId).toBe(NEW_PLAN_ID);
            expect(result.subscription?.scheduledPlanChange?.effectiveAt).toBe(APPLY_AT);
        });

        it('effectiveAt maps from QZPayScheduledPlanChange.applyAt (not a different field)', async () => {
            // Arrange — distinct value to confirm the mapping
            const customApplyAt = '2026-07-31T23:59:59.000Z';
            const sub = {
                ...makeBaseSub(),
                scheduledPlanChange: {
                    newPlanId: 'owner-basic',
                    newPriceId: 'price_basic',
                    targetTransactionAmountMajor: 500,
                    applyAt: customApplyAt,
                    requestedAt: '2026-06-15T10:00:00.000Z',
                    status: 'pending' as const,
                    attemptCount: 0,
                    metadata: {}
                }
            };
            setupBillingMock(sub);
            mockGetBySlug.mockResolvedValue(PLAN_FOUND);

            // Act
            const result = (await subscriptionHandler(makeCtx())) as {
                subscription: {
                    scheduledPlanChange: { effectiveAt: string } | null;
                } | null;
            };

            // Assert — effectiveAt must come from applyAt, not from currentPeriodEnd or requestedAt
            expect(result.subscription?.scheduledPlanChange?.effectiveAt).toBe(customApplyAt);
        });

        it('scheduledPlanChange does not expose internal fields like newPriceId or targetTransactionAmountMajor', async () => {
            // Arrange
            const sub = {
                ...makeBaseSub(),
                scheduledPlanChange: {
                    newPlanId: NEW_PLAN_ID,
                    newPriceId: 'price_basic',
                    targetTransactionAmountMajor: 500,
                    applyAt: APPLY_AT,
                    requestedAt: '2026-06-01T12:00:00.000Z',
                    status: 'pending' as const,
                    attemptCount: 0,
                    metadata: {}
                }
            };
            setupBillingMock(sub);
            mockGetBySlug.mockResolvedValue(PLAN_FOUND);

            // Act
            const result = (await subscriptionHandler(makeCtx())) as {
                subscription: { scheduledPlanChange: Record<string, unknown> | null } | null;
            };

            const change = result.subscription?.scheduledPlanChange;

            // Assert — only newPlanId and effectiveAt should be present
            expect(change).not.toBeNull();
            expect(Object.keys(change ?? {})).toEqual(['newPlanId', 'effectiveAt']);
        });
    });
});
