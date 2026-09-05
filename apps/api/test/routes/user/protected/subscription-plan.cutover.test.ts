/**
 * Parity / regression tests — subscription.ts + stats.ts plan lookup cutover
 * (SPEC-192 T-023).
 *
 * Verifies that both user-protected routes now resolve plan data via
 * PlanService.getBySlug() (DB-backed) instead of the static getPlanBySlug()
 * config from @repo/billing.
 *
 * Covered routes:
 * - GET /api/v1/protected/users/me/subscription  (subscription.ts)
 * - GET /api/v1/protected/users/me/stats         (stats.ts)
 *
 * Both tests are in this single file per T-023 spec.
 *
 * @module test/routes/user/protected/subscription-plan.cutover.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockGetById, mockGetBySlug, mockCreateProtectedRoute } = vi.hoisted(() => ({
    mockGetById: vi.fn(),
    mockGetBySlug: vi.fn(),
    mockCreateProtectedRoute: vi.fn()
}));

// ─── Mock PlanService ─────────────────────────────────────────────────────────

vi.mock('../../../../src/services/plan.service', () => ({
    PlanService: vi.fn().mockImplementation(function () {
        return {
            list: vi.fn(),
            getById: mockGetById,
            getBySlug: mockGetBySlug
        };
    })
}));

// ─── Mock @repo/billing ───────────────────────────────────────────────────────
// Only the two entitlement loaders are stubbed. Everything else — including
// `isEntitlementGrantingStatus` and `ENTITLEMENT_GRANTING_STATUSES` — comes
// from the REAL module via importOriginal.
//
// The predicate used to be re-implemented here by hand. That is exactly the
// drift these routes suffer from (H-70): a copy of the canonical rule that can
// disagree with it, in the test that is supposed to catch the disagreement. A
// hand-written mock also silently omits any export the routes later start
// using — which is how a route importing `ENTITLEMENT_GRANTING_STATUSES` got an
// `undefined` here and fell into its own catch, reporting `plan: null`.
//
// `getPlanBySlug` is deliberately overridden to `undefined` so any residual
// import of it still surfaces as a TypeError, which was the point of the
// original full-replacement mock.

vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        getPlanBySlug: undefined,
        getDefaultEntitlements: vi.fn(() => ({ entitlements: [], limits: [] })),
        getUnlimitedEntitlements: vi.fn(() => ({ entitlements: [], limits: [] }))
    };
});

// ─── Mock QZPay billing accessor ─────────────────────────────────────────────

const mockGetQZPayBilling = vi.fn();
vi.mock('../../../../src/middlewares/billing', () => ({
    getQZPayBilling: () => mockGetQZPayBilling()
}));

// ─── Mock @repo/db for stats.ts DB queries ───────────────────────────────────

// Defaults to an empty result set rather than `undefined`: the route
// destructures its queries (`const [row] = await ...limit(1)`), which is the
// repo-wide pattern, and destructuring `undefined` throws before any assertion
// runs. A test that needs rows overrides this per case — hence the explicit
// return type, without which TypeScript infers `never[]` from the empty literal
// and rejects every such override.
const mockDbLimit = vi.fn((): Record<string, unknown>[] => []);
// HOS-1066: `resolveUserPlanSummary` no longer calls `.limit()` on the
// subscriptions query — it reads every live subscription (grouped by product
// domain) instead of the single newest row — so it `await`s the result of
// `.orderBy()` directly. Real Drizzle query builders are thenable, so this
// mock must be too: `then()` resolves by delegating to `mockDbLimit()`,
// consuming the SAME queued `mockResolvedValueOnce` value `setupStatsDbMock`
// sets up for the subscriptions call, without production ever calling
// `.limit()` itself. Without this, `await` on the plain `{ limit }` object
// resolves to that object unchanged, `subscriptions.length === 0` is
// `undefined === 0` (false), and the next `.find()` call throws — caught by
// `resolveUserPlanSummary`'s own try/catch, which silently returns
// `{ plan: null, activeSubscriptionsCount: 0 }` regardless of the fixture.
const mockDbOrderBy = vi.fn(() => ({
    limit: mockDbLimit,
    // biome-ignore lint/suspicious/noThenProperty: intentional thenable — mirrors Drizzle's own awaitable query builder so the production code under test can `await` this mock without a trailing `.limit()`.
    then: (onFulfilled: (rows: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(mockDbLimit()).then(onFulfilled, onRejected)
}));
const mockDbWhere = vi.fn(() => ({ orderBy: mockDbOrderBy, limit: mockDbLimit }));
const mockDbFrom = vi.fn(() => ({ where: mockDbWhere }));
const mockDbSelect = vi.fn(() => ({ from: mockDbFrom }));

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        getDb: vi.fn(() => ({ select: mockDbSelect }))
    };
});

// ─── Capture route factory calls ──────────────────────────────────────────────

vi.mock('../../../../src/utils/route-factory', () => ({
    createProtectedRoute: mockCreateProtectedRoute
}));

// ─── Mock @repo/service-core services used by stats.ts ───────────────────────

vi.mock('@repo/service-core', () => ({
    // HOS-180: the route reads the courtesy window off the subscription row.
    // A whole-module mock leaves a new import `undefined`, which crashes at the
    // call site rather than failing an assertion — so it has to be listed here.
    readCourtesyFields: () => ({
        courtesyStartsAt: null,
        courtesyEndsAt: null,
        courtesyCyclesGranted: null
    }),
    AccommodationReviewService: vi.fn().mockImplementation(function () {
        return {
            listByUser: vi.fn().mockResolvedValue({ data: { total: 0 } })
        };
    }),
    DestinationReviewService: vi.fn().mockImplementation(function () {
        return {
            listByUser: vi.fn().mockResolvedValue({ data: { pagination: { total: 0 } } })
        };
    }),
    UserBookmarkService: vi.fn().mockImplementation(function () {
        return {
            countBookmarksForUser: vi.fn().mockResolvedValue({ data: { count: 0 } })
        };
    }),
    ServiceError: class ServiceError extends Error {
        code: string;
        constructor(code: string, message: string) {
            super(message);
            this.code = code;
        }
    },
    RoleEnum: { HOST: 'host', USER: 'user' },
    // HOS-934: subscription.ts hydrates `productDomain` on the raw
    // getByCustomerId() result BEFORE it reaches subscriptionMatchesDomain
    // below — the real helper runs a getDb() recovery query none of the
    // fixtures in this file need (none set a non-default productDomain), so
    // this is a transparent passthrough: same objects, unchanged, exactly
    // what the real function does when there is nothing to recover. Omitting
    // this export entirely (as this whole-module mock originally did) makes
    // subscription.ts's real `hydrateSubscriptionProductDomains(...)` call
    // throw "is not a function", which the route's own catch-all silently
    // turns into `{ subscription: null }` — the exact failure mode this
    // comment is here to prevent from recurring.
    hydrateSubscriptionProductDomains: async <T>(subs: readonly T[]): Promise<T[]> => [...subs],
    // HOS-259 / HOS-685: subscription.ts domain-scopes the resolved subscription
    // through ONE canonical predicate. Mirror its real semantics — accommodation
    // fails open on a legacy row, every other domain fails closed, and a
    // commerce-scoped read matches any commerce vertical — so the
    // default-accommodation path resolves exactly as it does in production.
    subscriptionMatchesDomain: (sub: unknown, domain: string): boolean => {
        const wantsAccommodation = domain === 'accommodation';
        if (typeof sub !== 'object' || sub === null) {
            return wantsAccommodation;
        }
        const value = (sub as { productDomain?: unknown }).productDomain;
        if (value === null || value === undefined) {
            return wantsAccommodation;
        }
        if (typeof value !== 'string') {
            return false;
        }
        if (domain === 'commerce') {
            return ['commerce', 'gastronomy', 'experience'].includes(value);
        }
        return value === domain;
    }
}));

// ─── Mock logger + actor ──────────────────────────────────────────────────────

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('../../../../src/utils/actor', () => ({
    getActorFromContext: vi.fn(() => ({ id: 'test-user-id' }))
}));

// ─── Import triggers ──────────────────────────────────────────────────────────
// Both imports come AFTER all vi.mock declarations.

import '../../../../src/routes/user/protected/subscription';
import '../../../../src/routes/user/protected/stats';
// HOS-1066: imported (not just triggered) so the "no subscription" test below
// can assert `warn` was NOT called — proof the `plan: null` result comes from
// `resolveUserPlanSummary`'s real "no live subscription" branch and not from
// its catch block silently swallowing a thrown TypeError (see the `then()`
// comment on `mockDbOrderBy` above for the failure mode this guards against).
import { apiLogger } from '../../../../src/utils/logger';

// ─── Capture handlers at module scope (before beforeEach clears mock state) ───

type RouteConfig = { handler: (ctx: unknown) => Promise<unknown> };

const [subscriptionRouteConfig, statsRouteConfig] = mockCreateProtectedRoute.mock.calls.map(
    (call) => call[0] as RouteConfig
);

// Casts keep strict typecheck happy: the configs are captured at import time
// and the tests below would fail loudly if they were missing.
const subscriptionHandler = subscriptionRouteConfig?.handler as (ctx: unknown) => Promise<unknown>;
const statsHandler = statsRouteConfig?.handler as (ctx: unknown) => Promise<unknown>;

// ─── Stubs ────────────────────────────────────────────────────────────────────

const STUB_PLAN = {
    id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    slug: 'owner-basico',
    name: 'Básico',
    description: 'Plan básico',
    category: 'owner' as const,
    monthlyPriceArs: 500_000,
    annualPriceArs: null,
    monthlyPriceUsdRef: 5,
    hasTrial: true,
    trialDays: 14,
    isDefault: true,
    sortOrder: 1,
    entitlements: ['CAN_LIST_ACCOMMODATION'],
    limits: { max_accommodations: 1 },
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
};

const PLAN_FOUND = { success: true as const, data: STUB_PLAN };
const PLAN_NOT_FOUND = {
    success: false as const,
    error: { code: 'NOT_FOUND', message: 'Plan not found: owner-basico' }
};

// ─── Context factory ──────────────────────────────────────────────────────────

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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('subscription-plan cutover (SPEC-192 T-023)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // subscription.ts
    // =========================================================================

    describe('subscription.ts — getPlanBySlug replaced with PlanService.getBySlug', () => {
        describe('when billing is disabled', () => {
            it('should return { subscription: null } without calling PlanService', async () => {
                // Arrange
                const ctx = makeCtx({ billingEnabled: false });

                // Act
                const result = (await subscriptionHandler(ctx)) as { subscription: null };

                // Assert
                expect(result).toEqual({ subscription: null });
                expect(mockGetBySlug).not.toHaveBeenCalled();
            });
        });

        describe('when billing is enabled and an active subscription exists', () => {
            function setupBillingMock() {
                const mock = {
                    customers: {
                        getByExternalId: vi.fn().mockResolvedValue({ id: 'cust-123' })
                    },
                    subscriptions: {
                        getByCustomerId: vi.fn().mockResolvedValue([
                            {
                                status: 'active',
                                planId: 'owner-basico',
                                currentPeriodStart: null,
                                currentPeriodEnd: null,
                                cancelAtPeriodEnd: false,
                                trialEnd: null
                            }
                        ])
                    },
                    plans: { get: vi.fn().mockResolvedValue({ name: 'owner-basico' }) }
                };
                mockGetQZPayBilling.mockReturnValue(mock);
                return mock;
            }

            it('should call PlanService.getBySlug with the resolved plan slug', async () => {
                // Arrange
                setupBillingMock();
                mockGetBySlug.mockResolvedValue(PLAN_FOUND);

                // Act
                await subscriptionHandler(makeCtx());

                // Assert
                expect(mockGetBySlug).toHaveBeenCalledOnce();
                expect(mockGetBySlug).toHaveBeenCalledWith('owner-basico');
            });

            it('should use plan.name and monthlyPriceArs from DB result', async () => {
                // Arrange
                setupBillingMock();
                mockGetBySlug.mockResolvedValue(PLAN_FOUND);

                // Act
                const result = (await subscriptionHandler(makeCtx())) as {
                    subscription: { planName: string; monthlyPriceArs: number };
                };

                // Assert
                expect(result.subscription?.planName).toBe('Básico');
                expect(result.subscription?.monthlyPriceArs).toBe(500_000);
            });

            it('should fall back to slug as planName and 0 as price when NOT_FOUND', async () => {
                // Arrange
                setupBillingMock();
                mockGetBySlug.mockResolvedValue(PLAN_NOT_FOUND);

                // Act
                const result = (await subscriptionHandler(makeCtx())) as {
                    subscription: { planName: string; monthlyPriceArs: number };
                };

                // Assert — identical fallback to old getPlanBySlug returning undefined
                expect(result.subscription?.planName).toBe('owner-basico');
                expect(result.subscription?.monthlyPriceArs).toBe(0);
            });
        });
    });

    // =========================================================================
    // stats.ts
    // =========================================================================

    describe('stats.ts — getPlanBySlug replaced with PlanService.getBySlug', () => {
        function setupStatsDbMock(
            customer: Record<string, unknown> | null,
            subscription: Record<string, unknown> | null
        ) {
            // stats.ts calls getDb() then chains select().from().where()...limit()
            // First call: customer lookup (select...where...limit)
            // Second call: subscription lookup (select...where...orderBy...limit)
            mockDbLimit
                .mockResolvedValueOnce(customer ? [customer] : [])
                .mockResolvedValueOnce(subscription ? [subscription] : []);
        }

        it('should call PlanService.getBySlug with subscription.planId', async () => {
            // Arrange
            setupStatsDbMock(
                { id: 'cust-456', externalId: 'test-user-id' },
                { planId: 'owner-basico', status: 'active' }
            );
            // resolvePlanName tries getById first; for slug-format planIds it returns
            // NOT_FOUND so the dual-resolve falls through to getBySlug.
            mockGetById.mockResolvedValue(PLAN_NOT_FOUND);
            mockGetBySlug.mockResolvedValue(PLAN_FOUND);

            // Act
            await statsHandler(makeCtx());

            // Assert
            expect(mockGetBySlug).toHaveBeenCalledOnce();
            expect(mockGetBySlug).toHaveBeenCalledWith('owner-basico');
        });

        it('should include plan.name from DB result in the response', async () => {
            // Arrange
            setupStatsDbMock(
                { id: 'cust-456', externalId: 'test-user-id' },
                { planId: 'owner-basico', status: 'active' }
            );
            mockGetById.mockResolvedValue(PLAN_NOT_FOUND);
            mockGetBySlug.mockResolvedValue(PLAN_FOUND);

            // Act
            const result = (await statsHandler(makeCtx())) as {
                plan: { name: string; status: string } | null;
            };

            // Assert
            expect(result.plan?.name).toBe('Básico');
            expect(result.plan?.status).toBe('active');
        });

        it('should fall back to planId as plan name when PlanService returns NOT_FOUND', async () => {
            // Arrange
            setupStatsDbMock(
                { id: 'cust-456', externalId: 'test-user-id' },
                { planId: 'owner-basico', status: 'active' }
            );
            // Both getById and getBySlug return NOT_FOUND → falls back to raw planId
            mockGetById.mockResolvedValue(PLAN_NOT_FOUND);
            mockGetBySlug.mockResolvedValue(PLAN_NOT_FOUND);

            // Act
            const result = (await statsHandler(makeCtx())) as {
                plan: { name: string; status: string } | null;
            };

            // Assert
            expect(result.plan?.name).toBe('owner-basico');
            expect(result.plan?.status).toBe('active');
        });

        it('should return plan: null when no subscription exists', async () => {
            // Arrange
            setupStatsDbMock({ id: 'cust-456', externalId: 'test-user-id' }, null);

            // Act
            const result = (await statsHandler(makeCtx())) as {
                plan: null;
                activeSubscriptionsCount: number;
            };

            // Assert
            expect(result.plan).toBeNull();
            expect(result.activeSubscriptionsCount).toBe(0);
            expect(mockGetBySlug).not.toHaveBeenCalled();
            // Proves the empty-array "no live subscription" branch ran, not the
            // catch block: `.limit()` is invoked once for the customer lookup
            // and once more (via `mockDbOrderBy`'s `then()`) for the
            // subscriptions lookup — the catch-block failure mode this
            // regresses only ever consumes the FIRST call.
            expect(mockDbLimit).toHaveBeenCalledTimes(2);
            expect(apiLogger.warn).not.toHaveBeenCalled();
        });

        it('should return plan: null and not call PlanService when no customer is found', async () => {
            // Arrange
            setupStatsDbMock(null, null);

            // Act
            const result = (await statsHandler(makeCtx())) as { plan: null };

            // Assert
            expect(result.plan).toBeNull();
            expect(mockGetBySlug).not.toHaveBeenCalled();
            // Real early-return branch (no customer row) — the subscriptions
            // query never runs, so `.limit()` is invoked exactly once (the
            // customer lookup) and nothing is caught.
            expect(mockDbLimit).toHaveBeenCalledTimes(1);
            expect(apiLogger.warn).not.toHaveBeenCalled();
        });
    });
});
