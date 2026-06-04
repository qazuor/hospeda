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

const { mockGetBySlug, mockCreateProtectedRoute } = vi.hoisted(() => ({
    mockGetBySlug: vi.fn(),
    mockCreateProtectedRoute: vi.fn()
}));

// ─── Mock PlanService ─────────────────────────────────────────────────────────

vi.mock('../../../../src/services/plan.service', () => ({
    PlanService: vi.fn().mockImplementation(() => ({
        list: vi.fn(),
        getBySlug: mockGetBySlug
    }))
}));

// ─── Mock @repo/billing ───────────────────────────────────────────────────────
// PAYMENT_GRACE_PERIOD_DAYS is still needed by subscription.ts; getPlanBySlug
// is intentionally absent so any residual import would surface a TypeError.

vi.mock('@repo/billing', () => ({
    PAYMENT_GRACE_PERIOD_DAYS: 7,
    getDefaultEntitlements: vi.fn(() => ({ entitlements: [], limits: [] })),
    getUnlimitedEntitlements: vi.fn(() => ({ entitlements: [], limits: [] }))
}));

// ─── Mock QZPay billing accessor ─────────────────────────────────────────────

const mockGetQZPayBilling = vi.fn();
vi.mock('../../../../src/middlewares/billing', () => ({
    getQZPayBilling: () => mockGetQZPayBilling()
}));

// ─── Mock @repo/db for stats.ts DB queries ───────────────────────────────────

const mockDbLimit = vi.fn();
const mockDbOrderBy = vi.fn(() => ({ limit: mockDbLimit }));
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
    AccommodationReviewService: vi.fn().mockImplementation(() => ({
        listByUser: vi.fn().mockResolvedValue({ data: { total: 0 } })
    })),
    DestinationReviewService: vi.fn().mockImplementation(() => ({
        listByUser: vi.fn().mockResolvedValue({ data: { pagination: { total: 0 } } })
    })),
    UserBookmarkService: vi.fn().mockImplementation(() => ({
        countBookmarksForUser: vi.fn().mockResolvedValue({ data: { count: 0 } })
    })),
    ServiceError: class ServiceError extends Error {
        code: string;
        constructor(code: string, message: string) {
            super(message);
            this.code = code;
        }
    },
    RoleEnum: { HOST: 'host', USER: 'user' }
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
            const result = (await statsHandler(makeCtx())) as { plan: null };

            // Assert
            expect(result.plan).toBeNull();
            expect(mockGetBySlug).not.toHaveBeenCalled();
        });

        it('should return plan: null and not call PlanService when no customer is found', async () => {
            // Arrange
            setupStatsDbMock(null, null);

            // Act
            const result = (await statsHandler(makeCtx())) as { plan: null };

            // Assert
            expect(result.plan).toBeNull();
            expect(mockGetBySlug).not.toHaveBeenCalled();
        });
    });
});
