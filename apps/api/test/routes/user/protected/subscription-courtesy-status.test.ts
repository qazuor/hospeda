/**
 * Tests for GET /api/v1/protected/users/me/subscription — courtesy status
 * serialization (HOS-1007).
 *
 * ## Why this file exists
 *
 * The panel-side courtesy tests (`apps/web/test/components/account/
 * SubscriptionDashboard.test.tsx`, HOS-180 AC-11) inject `status: 'courtesy'`
 * straight into the component, so they were green while the endpoint that feeds
 * the component could never emit that value: `courtesy` was missing from both
 * `SUBSCRIPTION_STATUSES` and `QZPAY_STATUS_MAP`, so it fell through the
 * `?? 'pending'` default and every gifted subscriber saw "pending". This file
 * closes that gap from the endpoint side — the half neither suite covered.
 *
 * Test matrix:
 *   1. A `courtesy` subscription serializes as `status: 'courtesy'` (never
 *      'pending', never 'paused', never 'active').
 *   2. `courtesyEndsAt` is surfaced from the typed column alongside it.
 *   3. A genuinely `paused` subscription (no gift) still serializes as
 *      'paused' — the mapping added for courtesy must not swallow a real pause.
 *   4. An unknown provider status still falls back to 'pending' — the default
 *      branch is intact.
 *
 * NOTE: unlike `subscription-spec203-fields.test.ts`, this file does NOT stub
 * `isEntitlementGrantingStatus`. The real predicate (which includes 'courtesy')
 * is what lets the route's `.find()` select the gifted subscription at all, so
 * stubbing it would make the mapping assertion unreachable.
 *
 * @module test/routes/user/protected/subscription-courtesy-status
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
    PlanService: vi.fn().mockImplementation(function () {
        return {
            list: vi.fn(),
            getBySlug: mockGetBySlug
        };
    })
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

import { getDb } from '@repo/db';
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

/**
 * The gift window. Computed relative to "now" rather than hardcoded so the
 * fixture cannot drift into the past — the route itself does not compare it to
 * a clock, but the derivation upstream does, and a stale fixture would misread
 * as "the gift lapsed" to anyone reusing this file.
 */
const COURTESY_STARTS_AT = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
const COURTESY_ENDS_AT = new Date(Date.now() + 65 * 24 * 60 * 60 * 1000);

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

interface StubSub {
    readonly id: string;
    readonly status: string;
    readonly planId: string;
    readonly currentPeriodStart: Date;
    readonly currentPeriodEnd: Date;
    readonly cancelAtPeriodEnd: boolean;
    readonly canceledAt: null;
    readonly trialEnd: null;
    readonly scheduledPlanChange: null;
    readonly metadata: Record<string, unknown>;
    readonly courtesyStartsAt?: Date | null;
    readonly courtesyEndsAt?: Date | null;
    readonly courtesyCyclesGranted?: number | null;
}

function makeSub(overrides: Partial<StubSub> = {}): StubSub {
    return {
        id: 'sub_courtesy_001',
        status: 'active',
        planId: 'owner-pro',
        currentPeriodStart: new Date(PERIOD_START),
        currentPeriodEnd: new Date(PERIOD_END),
        cancelAtPeriodEnd: false,
        canceledAt: null,
        trialEnd: null,
        scheduledPlanChange: null,
        metadata: {},
        ...overrides
    };
}

/**
 * A gifted subscription exactly as the DB holds it: the status column already
 * carries the derived `courtesy` (written by `courtesy-grant.service.ts`), and
 * the window lives in its own typed columns (HOS-993) — a `timestamptz`
 * column arrives as a `Date`, not an ISO string (see `readCourtesyFields`).
 * `metadata` no longer carries the window at all.
 */
function makeCourtesySub(): StubSub {
    return makeSub({
        status: 'courtesy',
        courtesyStartsAt: COURTESY_STARTS_AT,
        courtesyEndsAt: COURTESY_ENDS_AT,
        courtesyCyclesGranted: 2
    });
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

    // The route reads the courtesy window from the ROW, not from the object
    // `getByCustomerId` returns: qzpay-core's mapper builds those field by
    // field from core's own interface, so a column qzpay-drizzle adds on top
    // never reaches them. Mirroring the stub's window here is what keeps this
    // fixture honest about where the value actually comes from — put it only
    // on the facade object and the endpoint would answer `null` in production
    // while the test stayed green.
    //
    // HOS-934: the route now runs a SECOND getDb() query first —
    // `hydrateSubscriptionProductDomains`'s batched `productDomain` recovery
    // (`.select({id, productDomain}).from(...).where(inArray(...))`, no
    // `.limit()`). The two queries are distinguished by their `.select()`
    // projection: only the hydration query names a `productDomain` column.
    // Without this, `where()` resolved to the chain object itself (not an
    // array), `rows.map(...)` inside the hydration helper threw, and the
    // route's own catch-all swallowed it as "no subscription" — every
    // assertion below then saw `result.subscription: null`.
    vi.mocked(getDb).mockImplementation((() => {
        let isProductDomainQuery = false;
        const chain = {
            select: vi.fn((cols: Record<string, unknown>) => {
                isProductDomainQuery = 'productDomain' in cols && 'id' in cols;
                return chain;
            }),
            from: vi.fn(() => chain),
            where: vi.fn(() => {
                if (isProductDomainQuery) {
                    // No stored row for this fixture's id — hydration resolves
                    // productDomain to `null`, which fails open to
                    // accommodation, matching this file's pre-HOS-934 default.
                    return Promise.resolve([]);
                }
                return chain;
            }),
            limit: vi.fn().mockResolvedValue([
                {
                    courtesyStartsAt: sub.courtesyStartsAt ?? null,
                    courtesyEndsAt: sub.courtesyEndsAt ?? null,
                    courtesyCyclesGranted: sub.courtesyCyclesGranted ?? null
                }
            ])
        };
        return chain;
    }) as never);

    return mock;
}

type SubscriptionResponse = {
    subscription: {
        status: string;
        courtesyEndsAt: string | null;
        isComplimentary: boolean;
    } | null;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/v1/protected/users/me/subscription — courtesy status (HOS-1007)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetBySlug.mockResolvedValue(PLAN_FOUND);
    });

    it('serializes a courtesy subscription with status "courtesy"', async () => {
        // Arrange
        setupBillingMock(makeCourtesySub());

        // Act
        const result = (await subscriptionHandler(makeCtx())) as SubscriptionResponse;

        // Assert — the exact value, not a membership check: falling back to
        // 'pending' is the bug this test exists to catch.
        expect(result.subscription).not.toBeNull();
        expect(result.subscription?.status).toBe('courtesy');
    });

    it('does not fall back to "pending" for a courtesy subscription', async () => {
        // Arrange
        setupBillingMock(makeCourtesySub());

        // Act
        const result = (await subscriptionHandler(makeCtx())) as SubscriptionResponse;

        // Assert — spelled out separately from the positive assertion above so a
        // future mapping mistake that lands on some OTHER wrong value still
        // trips the first test while this one names the historical regression.
        expect(result.subscription?.status).not.toBe('pending');
    });

    it('does not report a courtesy subscription as "paused" or "active"', async () => {
        // Arrange — the provider state underneath a courtesy IS a paused
        // preapproval, and the `comp` precedent maps to 'active'. Neither is
        // the right answer here.
        setupBillingMock(makeCourtesySub());

        // Act
        const result = (await subscriptionHandler(makeCtx())) as SubscriptionResponse;

        // Assert
        expect(result.subscription?.status).not.toBe('paused');
        expect(result.subscription?.status).not.toBe('active');
    });

    it('surfaces courtesyEndsAt from the typed column alongside the status', async () => {
        // Arrange
        setupBillingMock(makeCourtesySub());

        // Act
        const result = (await subscriptionHandler(makeCtx())) as SubscriptionResponse;

        // Assert — the panel renders "Sin cargo hasta <date>" off this field, so
        // the status alone is not enough to call the contract satisfied.
        expect(result.subscription?.courtesyEndsAt).toBe(COURTESY_ENDS_AT.toISOString());
    });

    it('does not flag a courtesy subscription as complimentary', async () => {
        // Arrange — `isComplimentary` hides the cancel action; a courtesy IS
        // self-service cancellable (SOFT_CANCELLABLE_STATUSES), so the flag
        // must stay false.
        setupBillingMock(makeCourtesySub());

        // Act
        const result = (await subscriptionHandler(makeCtx())) as SubscriptionResponse;

        // Assert
        expect(result.subscription?.isComplimentary).toBe(false);
    });

    it('still serializes a genuinely paused subscription as "paused"', async () => {
        // Arrange — a real pause carries no courtesy window. Adding the courtesy
        // mapping must not swallow it: one provider state, two local readings.
        setupBillingMock(makeSub({ status: 'paused', metadata: {} }));

        // Act
        const result = (await subscriptionHandler(makeCtx())) as SubscriptionResponse;

        // Assert
        expect(result.subscription?.status).toBe('paused');
        expect(result.subscription?.courtesyEndsAt).toBeNull();
    });

    it('still maps trialing to "trial" — the new entry does not disturb its neighbours', async () => {
        // Arrange — a courtesy row also carries a paused preapproval underneath,
        // so the entry sits next to `paused`/`trialing` in the same lookup.
        setupBillingMock(makeSub({ status: 'trialing' }));

        // Act
        const result = (await subscriptionHandler(makeCtx())) as SubscriptionResponse;

        // Assert
        expect(result.subscription?.status).toBe('trial');
    });
});
