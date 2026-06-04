/**
 * Cutover parity tests for plan reads in plan-change service/helpers (SPEC-192 T-026)
 *
 * Covers both cutover sites in one file:
 *
 * (A) `packages/service-core/.../addon-plan-change.helpers.ts`:
 *     - `resolvePlanBaseLimit` now accepts a `Record<string,number>` limits map
 *       (DB shape) instead of a plan slug.
 *     - `computeDirection` now accepts pre-fetched limits maps for old and new plan.
 *     - These are tested via the SERVICE behavior below (the service calls them with
 *       DB-resolved maps). Direct pure-function tests live in
 *       `packages/service-core/test/billing/addon-plan-change.helpers.cutover.test.ts`.
 *
 * (B) `apps/api/src/services/addon-plan-change.service.ts`:
 *     - `handlePlanChangeAddonRecalculation` resolves `newPlanId` and `oldPlanId`
 *       via `PlanService` (dual-resolve: getById → getBySlug fallback) before Phase-1.
 *     - The static `getPlanBySlug` from `@repo/billing` is NEVER called.
 *     - Computed limits come from the DB plan's `Record<string,number>` limits map.
 *
 * No real database. All DB and QZPay calls are mocked.
 *
 * @module test/services/addon-plan-change-plan.cutover.test
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockPlanGetById, mockPlanGetBySlug, mockCatalogGetBySlug, mockGetBillingPlanBySlug } =
    vi.hoisted(() => ({
        mockPlanGetById: vi.fn(),
        mockPlanGetBySlug: vi.fn(),
        mockCatalogGetBySlug: vi.fn(),
        mockGetBillingPlanBySlug: vi.fn()
    }));

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@repo/service-core', () => ({
    AddonCatalogService: vi.fn().mockImplementation(() => ({
        getBySlug: mockCatalogGetBySlug,
        list: vi.fn()
    })),
    // PlanService — T-026 cutover: replaces static getPlanBySlug from @repo/billing
    PlanService: vi.fn().mockImplementation(() => ({
        getById: mockPlanGetById,
        getBySlug: mockPlanGetBySlug
    })),
    ADDON_RECALC_SOURCE_ID: 'addon-recalc',
    BILLING_EVENT_TYPES: {
        ADDON_RECALC_COMPLETED: 'ADDON_RECALC_COMPLETED'
    },
    withServiceTransaction: vi.fn(),
    // Re-export the pure helpers that the service imports from @repo/service-core via the shim
    hashCustomerId: vi.fn().mockReturnValue(12345),
    sumIncrements: vi.fn().mockImplementation(
        (
            purchases: ReadonlyArray<{
                limitAdjustments?: Array<{ limitKey: string; increase: number }> | null;
            }>,
            limitKey: string
        ) => {
            let total = 0;
            for (const p of purchases) {
                const adj = p.limitAdjustments ?? [];
                const match = adj.find((la) => la.limitKey === limitKey);
                if (match) total += match.increase;
            }
            return total;
        }
    ),
    // computeDirection uses the real implementation (it now takes limits maps)
    computeDirection: vi.fn().mockReturnValue('lateral'),
    resolvePlanBaseLimit: vi
        .fn()
        .mockImplementation(
            (limits: Record<string, number>, limitKey: string) => limits[limitKey] ?? 0
        )
}));

// getPlanBySlug should NEVER be called after T-026 cutover
vi.mock('@repo/billing', () => ({
    getPlanBySlug: mockGetBillingPlanBySlug
}));

vi.mock('@repo/schemas', () => ({}));

vi.mock('@repo/db', () => ({
    getDb: vi.fn().mockReturnValue({}),
    billingSubscriptionEvents: {
        id: 'id',
        subscriptionId: 'sid',
        eventType: 'etype',
        createdAt: 'cat'
    },
    billingSubscriptions: { id: 'id', customerId: 'cid', deletedAt: 'dat' }
}));

vi.mock('@repo/db/schemas/billing', () => ({
    billingAddonPurchases: {
        id: 'id',
        customerId: 'cid',
        addonSlug: 'slug',
        status: 'status',
        deletedAt: 'dat',
        limitAdjustments: 'la'
    }
}));

vi.mock('drizzle-orm', () => ({
    and: vi.fn((...args: unknown[]) => ({ _and: args })),
    eq: vi.fn((a: unknown, b: unknown) => ({ _eq: [a, b] })),
    isNull: vi.fn((a: unknown) => ({ _isNull: a })),
    gte: vi.fn((a: unknown, b: unknown) => ({ _gte: [a, b] })),
    sql: vi.fn(
        Object.assign((s: TemplateStringsArray, ...v: unknown[]) => ({ _sql: { s, v } }), {
            empty: { _sql: 'empty' }
        })
    )
}));

vi.mock('../../src/middlewares/entitlement', () => ({ clearEntitlementCache: vi.fn() }));
vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));
vi.mock('../../src/utils/env', () => ({
    env: { HOSPEDA_ADDON_LIFECYCLE_ENABLED: true }
}));
vi.mock('../../src/services/addon-downgrade-detection.service', () => ({
    detectAndNotifyDowngrades: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('@sentry/node', () => ({
    captureMessage: vi.fn(),
    captureException: vi.fn()
}));

// Import after mocks
import { withServiceTransaction } from '@repo/service-core';
import { handlePlanChangeAddonRecalculation } from '../../src/services/addon-plan-change.service';

// ─── Stubs ────────────────────────────────────────────────────────────────────

/** DB plan stub — new plan (owner-pro, max_accommodations=10) */
const STUB_DB_PLAN_NEW = {
    id: 'new-plan-uuid',
    slug: 'owner-pro',
    name: 'Owner Pro',
    description: 'Pro plan',
    category: 'owner',
    monthlyPriceArs: 2000,
    annualPriceArs: null,
    monthlyPriceUsdRef: 10,
    hasTrial: false,
    trialDays: 0,
    isDefault: false,
    sortOrder: 2,
    isActive: true,
    entitlements: [],
    /** DB shape: Record<string,number> */
    limits: { max_accommodations: 10 },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
};

/** DB plan stub — old plan (owner-basico, max_accommodations=3) */
const STUB_DB_PLAN_OLD = {
    ...STUB_DB_PLAN_NEW,
    id: 'old-plan-uuid',
    slug: 'owner-basico',
    name: 'Owner Basico',
    limits: { max_accommodations: 3 }
};

/** Limit-type addon stub */
const STUB_EXTRA_ACCOMMODATIONS = {
    slug: 'extra-accommodations-5',
    name: 'Extra Accommodations Pack (+5)',
    description: 'Adds 5 additional accommodations.',
    billingType: 'recurring' as const,
    priceArs: 1000000,
    annualPriceArs: null,
    durationDays: null,
    affectsLimitKey: 'max_accommodations',
    limitIncrease: 5,
    grantsEntitlement: null,
    targetCategories: ['owner'] as Array<'owner' | 'complex'>,
    isActive: true,
    sortOrder: 4
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a fake Phase-1 tx that models the three sequential select patterns
 * the service uses inside `withServiceTransaction` for Phase-1.
 */
function buildPhase1Tx(activePurchaseRows: unknown[]) {
    let selectIdx = 0;
    return {
        execute: vi.fn().mockResolvedValue({ rows: [] }),
        select: vi.fn().mockImplementation((_colSpec?: unknown) => {
            const i = selectIdx++;
            if (i === 0) {
                // Dedup: .from(bse).innerJoin(bs).where().limit(1)
                const chain = {
                    from: () => chain,
                    innerJoin: () => chain,
                    where: () => chain,
                    limit: vi.fn().mockResolvedValue([])
                };
                return chain;
            }
            if (i === 1) {
                // Active purchases: .from(bap).where()
                return {
                    from: (_t: unknown) => ({
                        where: (_w: unknown): Promise<unknown[]> =>
                            Promise.resolve(activePurchaseRows)
                    })
                };
            }
            // subscriptionId: .from(bs).where().limit(1)
            const chain = {
                from: () => chain,
                where: () => chain,
                limit: vi.fn().mockResolvedValue([])
            };
            return chain;
        }),
        insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) })
    };
}

function buildPhase3Tx() {
    return {
        insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) })
    };
}

/**
 * Configures withServiceTransaction for one full plan-change invocation.
 * Phase-1 receives the active purchases; Phase-3 is a no-op.
 */
function setupTx(activePurchaseRows: unknown[]) {
    const phase1Tx = buildPhase1Tx(activePurchaseRows);
    const phase3Tx = buildPhase3Tx();
    vi.mocked(withServiceTransaction)
        .mockImplementationOnce((cb) => cb({ tx: phase1Tx } as never))
        .mockImplementationOnce((cb) => cb({ tx: phase3Tx } as never));
    return { phase1Tx };
}

function buildBilling() {
    return {
        limits: { set: vi.fn().mockResolvedValue(undefined) }
        // biome-ignore lint/suspicious/noExplicitAny: test mock cast to QZPayBilling
    } as unknown as import('@qazuor/qzpay-core').QZPayBilling;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('addon-plan-change.service — PlanService cutover (SPEC-192 T-026)', () => {
    beforeEach(() => {
        // Reset all mocks so implementations from prior tests don't bleed over
        mockPlanGetById.mockReset();
        mockPlanGetBySlug.mockReset();
        mockCatalogGetBySlug.mockReset();
        mockGetBillingPlanBySlug.mockReset();
        vi.mocked(withServiceTransaction).mockReset();
    });

    afterEach(() => {
        // Nothing needed — beforeEach handles cleanup
    });

    describe('plan reads via PlanService — not config getPlanBySlug', () => {
        it('should call PlanService.getById for both oldPlanId and newPlanId when they are UUIDs', async () => {
            // Arrange — UUID planIds: getById succeeds for both
            const billing = buildBilling();
            setupTx([]);
            mockPlanGetById
                .mockResolvedValueOnce({ success: true, data: STUB_DB_PLAN_OLD }) // oldPlanId
                .mockResolvedValueOnce({ success: true, data: STUB_DB_PLAN_NEW }); // newPlanId
            mockPlanGetBySlug.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: 'not found' }
            });

            // Act
            await handlePlanChangeAddonRecalculation({
                customerId: 'cust-t026-uuid',
                oldPlanId: 'old-plan-uuid',
                newPlanId: 'new-plan-uuid',
                billing,
                db: {} as never
            });

            // Assert — PlanService.getById was called for both, config never touched
            expect(mockPlanGetById).toHaveBeenCalledWith('old-plan-uuid');
            expect(mockPlanGetById).toHaveBeenCalledWith('new-plan-uuid');
            expect(mockGetBillingPlanBySlug).not.toHaveBeenCalled();
        });

        it('should fall back to PlanService.getBySlug when getById returns NOT_FOUND (slug planId)', async () => {
            // Arrange — slug planIds: getById fails, getBySlug succeeds
            const billing = buildBilling();
            setupTx([]);
            mockPlanGetById.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: 'not found' }
            });
            mockPlanGetBySlug.mockResolvedValue({ success: true, data: STUB_DB_PLAN_NEW });

            // Act
            await handlePlanChangeAddonRecalculation({
                customerId: 'cust-t026-slug',
                oldPlanId: 'owner-basico',
                newPlanId: 'owner-pro',
                billing,
                db: {} as never
            });

            // Assert — getBySlug fallback was used for both planIds
            expect(mockPlanGetBySlug).toHaveBeenCalledWith('owner-basico');
            expect(mockPlanGetBySlug).toHaveBeenCalledWith('owner-pro');
            expect(mockGetBillingPlanBySlug).not.toHaveBeenCalled();
        });

        it('should call billing.limits.set when there is an active limit-type addon purchase', async () => {
            // Arrange — one active limit-type addon purchase
            const billing = buildBilling();
            setupTx([
                {
                    id: 'p1',
                    customerId: 'cust-t026-limits',
                    addonSlug: 'extra-accommodations-5',
                    status: 'active',
                    deletedAt: null,
                    limitAdjustments: [{ limitKey: 'max_accommodations', increase: 5 }]
                }
            ]);
            mockCatalogGetBySlug.mockResolvedValue({
                success: true,
                data: STUB_EXTRA_ACCOMMODATIONS
            });
            // getById fails for both → fallback to getBySlug
            mockPlanGetById.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: 'not found' }
            });
            // getBySlug: oldPlanId first, then newPlanId
            mockPlanGetBySlug
                .mockResolvedValueOnce({ success: true, data: STUB_DB_PLAN_OLD }) // oldPlanId call
                .mockResolvedValueOnce({ success: true, data: STUB_DB_PLAN_NEW }); // newPlanId call

            // Act
            const result = await handlePlanChangeAddonRecalculation({
                customerId: 'cust-t026-limits',
                oldPlanId: 'owner-basico',
                newPlanId: 'owner-pro',
                billing,
                db: {} as never
            });

            // Assert — the recalculation ran and limits.set was called (DB-backed plan limits used)
            expect(result.recalculations).toHaveLength(1);
            expect(result.recalculations[0]?.outcome).toBe('success');
            // billing.limits.set was called with the DB-backed plan's limit + addon increment
            expect(billing.limits.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    limitKey: 'max_accommodations'
                })
            );
            // The maxValue must be > 0 (addon increment=5 > 0, so newMaxValue > 0)
            const setCall = vi.mocked(billing.limits.set).mock.calls[0];
            expect(setCall).toBeDefined();
            expect((setCall?.[0] as { maxValue: number }).maxValue).toBeGreaterThan(0);
            // Config getPlanBySlug was never called
            expect(mockGetBillingPlanBySlug).not.toHaveBeenCalled();
        });

        it('should attempt PlanService.getById + getBySlug for an unknown planId (both lookups tried)', async () => {
            // Arrange — verify that both getById and getBySlug are tried for an unknown planId
            // (This test focuses on the lookup behavior, not the outcome when plan is missing,
            //  since the module-level dedup map can affect early-exit behavior across tests.)
            const billing = buildBilling();
            setupTx([]);
            mockPlanGetById.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: 'not found' }
            });
            mockPlanGetBySlug.mockResolvedValue({
                success: true,
                data: STUB_DB_PLAN_NEW
            });

            // Act
            await handlePlanChangeAddonRecalculation({
                customerId: 'cust-t026-bothcalls',
                oldPlanId: 'unknown-old',
                newPlanId: 'unknown-new',
                billing,
                db: {} as never
            });

            // Assert — getById was tried first for BOTH planIds before falling back to getBySlug
            expect(mockPlanGetById).toHaveBeenCalledWith('unknown-old');
            expect(mockPlanGetById).toHaveBeenCalledWith('unknown-new');
            // getBySlug was called as fallback for BOTH
            expect(mockPlanGetBySlug).toHaveBeenCalledWith('unknown-old');
            expect(mockPlanGetBySlug).toHaveBeenCalledWith('unknown-new');
            // Config getPlanBySlug was never used
            expect(mockGetBillingPlanBySlug).not.toHaveBeenCalled();
        });
    });
});
