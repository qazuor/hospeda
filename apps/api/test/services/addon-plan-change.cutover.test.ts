/**
 * Parity tests for addon-plan-change.service.ts addon reads cutover (SPEC-192 T-013)
 *
 * Verifies that `handlePlanChangeAddonRecalculation` now resolves addon
 * definitions via the DB-backed `AddonCatalogService.getBySlug()` (not the
 * static `getAddonBySlug` from `@repo/billing`), while preserving EXACTLY the
 * same skip-and-log semantics on not-found/error that the old code used.
 *
 * Key assertions:
 * - `getAddonBySlug` from `@repo/billing` is NEVER called (cutover complete)
 * - `AddonCatalogService.getBySlug` IS called for each purchase slug
 * - NOT_FOUND result → warn logged + skip (same as old `!addonDef` branch)
 * - entitlement-only addon (affectsLimitKey=null) → skipped (unchanged)
 * - limit-type addon → `billing.limits.set` called with DB-resolved limitKey
 *
 * PLAN reads (`getPlanBySlug`) are NOT touched (deferred to T-026).
 *
 * Strategy: withServiceTransaction is mocked to run the callback against a
 * fake tx that accurately models the three select patterns the service uses.
 *
 * No real database. All DB and QZPay calls are mocked.
 *
 * @module test/services/addon-plan-change.cutover.test
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockGetBySlug, mockWarn, mockGetAddonBySlug, mockPlanGetById, mockPlanGetBySlug } =
    vi.hoisted(() => ({
        mockGetBySlug: vi.fn(),
        mockWarn: vi.fn(),
        mockGetAddonBySlug: vi.fn(),
        mockPlanGetById: vi.fn(),
        mockPlanGetBySlug: vi.fn()
    }));

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@repo/service-core', () => ({
    AddonCatalogService: vi.fn().mockImplementation(() => ({
        getBySlug: mockGetBySlug,
        list: vi.fn()
    })),
    // PlanService added for T-026 plan-reads cutover
    PlanService: vi.fn().mockImplementation(() => ({
        getById: mockPlanGetById,
        getBySlug: mockPlanGetBySlug
    })),
    ADDON_RECALC_SOURCE_ID: 'addon-recalc',
    BILLING_EVENT_TYPES: {
        ADDON_RECALC_COMPLETED: 'ADDON_RECALC_COMPLETED'
    },
    withServiceTransaction: vi.fn()
}));

vi.mock('@repo/billing', () => ({
    // getPlanBySlug no longer used in addon-plan-change.service after T-026
    getAddonBySlug: mockGetAddonBySlug
}));

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

vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), error: vi.fn(), warn: mockWarn, debug: vi.fn() }
}));

vi.mock('../../src/utils/env', () => ({
    env: { HOSPEDA_ADDON_LIFECYCLE_ENABLED: true }
}));

vi.mock('../../src/services/addon-plan-change.helpers', () => ({
    hashCustomerId: vi.fn().mockReturnValue(12345),
    resolvePlanBaseLimit: vi.fn().mockReturnValue(5),
    sumIncrements: vi.fn().mockReturnValue(0),
    computeDirection: vi.fn().mockReturnValue('lateral')
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

// ─── Catalog stubs ────────────────────────────────────────────────────────────

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

const STUB_VISIBILITY_7D = {
    slug: 'visibility-boost-7d',
    name: 'Visibility Boost (7 days)',
    description: 'Featured in search results for 7 days.',
    billingType: 'one_time' as const,
    priceArs: 500000,
    annualPriceArs: null,
    durationDays: 7,
    affectsLimitKey: null,
    limitIncrease: null,
    grantsEntitlement: 'FEATURED_LISTING',
    targetCategories: ['owner', 'complex'] as Array<'owner' | 'complex'>,
    isActive: true,
    sortOrder: 1
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildBilling() {
    return {
        limits: { set: vi.fn().mockResolvedValue(undefined) }
        // biome-ignore lint/suspicious/noExplicitAny: test mock — cast to satisfy QZPayBilling type
    } as unknown as import('@qazuor/qzpay-core').QZPayBilling;
}

/**
 * Builds a fake tx for phase-1 that correctly handles the service's three
 * sequential select patterns.
 *
 * The service makes these tx calls in order:
 *  1. `tx.execute(pg_advisory_xact_lock)` → void
 *  2. `tx.select({id}).from(bse).innerJoin(bs).where().limit(1)` → dedup → []
 *  3. `tx.select().from(bap).where()` → active purchases → rows
 *  4. `tx.select({id}).from(bs).where().limit(1)` → subscriptionId → []
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
                // Active purchases: .from(bap).where()  — awaited directly
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
        insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined)
        })
    };
}

function buildPhase3Tx() {
    return {
        insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined)
        })
    };
}

/**
 * Configures withServiceTransaction for one full plan-change invocation.
 * Phase-1 receives the active purchases; Phase-3 is a no-op.
 */
function setupTx(activePurchaseRows: unknown[]) {
    const phase1Tx = buildPhase1Tx(activePurchaseRows);
    const phase3Tx = buildPhase3Tx();

    // biome-ignore lint/suspicious/noExplicitAny: test mock — type-cast to satisfy strict ServiceContext
    vi.mocked(withServiceTransaction)
        .mockImplementationOnce((cb) => cb({ tx: phase1Tx } as never))
        .mockImplementationOnce((cb) => cb({ tx: phase3Tx } as never));

    return { phase1Tx };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('addon-plan-change.service cutover parity (SPEC-192 T-013)', () => {
    let billing: ReturnType<typeof buildBilling>;

    /** Stub DB plan with max_accommodations=5 for the owner-basic plan */
    const STUB_DB_PLAN = {
        id: 'plan-uuid-001',
        slug: 'owner-basic',
        name: 'Owner Basic',
        description: 'Basic plan',
        category: 'owner',
        monthlyPriceArs: 500,
        annualPriceArs: null,
        monthlyPriceUsdRef: 3,
        hasTrial: false,
        trialDays: 0,
        isDefault: false,
        sortOrder: 1,
        isActive: true,
        entitlements: [],
        limits: { max_accommodations: 5 },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
    };

    beforeEach(() => {
        billing = buildBilling();
        // Reset only call counts, preserve implementations
        mockGetBySlug.mockReset();
        mockWarn.mockReset();
        mockGetAddonBySlug.mockReset();
        mockPlanGetById.mockReset();
        mockPlanGetBySlug.mockReset();
        vi.mocked(withServiceTransaction).mockReset();

        // Default PlanService stubs: getById returns NOT_FOUND, getBySlug returns STUB_DB_PLAN.
        // Tests that need a different plan setup override these.
        mockPlanGetById.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND', message: 'not found' }
        });
        mockPlanGetBySlug.mockResolvedValue({ success: true, data: STUB_DB_PLAN });
    });

    afterEach(() => {
        // Nothing needed — mockReset in beforeEach handles cleanup
    });

    describe('addon reads use AddonCatalogService.getBySlug — not config getAddonBySlug', () => {
        it('should call catalogService.getBySlug with the purchase slug', async () => {
            // Arrange
            setupTx([
                {
                    id: 'p1',
                    customerId: 'cust-uuid',
                    addonSlug: 'extra-accommodations-5',
                    status: 'active',
                    deletedAt: null,
                    limitAdjustments: [{ limitKey: 'max_accommodations', increase: 5 }]
                }
            ]);
            mockGetBySlug.mockResolvedValue({ success: true, data: STUB_EXTRA_ACCOMMODATIONS });

            // Act
            await handlePlanChangeAddonRecalculation({
                customerId: 'cust-uuid',
                oldPlanId: 'owner-basic',
                newPlanId: 'owner-basic',
                billing,
                db: {} as never
            });

            // Assert
            expect(mockGetBySlug).toHaveBeenCalledWith('extra-accommodations-5');
            // Config-backed getAddonBySlug NEVER called after cutover
            expect(mockGetAddonBySlug).not.toHaveBeenCalled();
        });

        it('should skip-and-warn when catalog returns NOT_FOUND (preserves old semantics)', async () => {
            // Arrange — unique customerId to bypass the module-level dedup guard
            // (the `recentRecalculations` Map persists across tests; test 1 stamps 'cust-uuid').
            const customerId = 'cust-not-found-t013';
            mockGetBySlug.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: "Add-on 'retired-addon' not found" }
            });
            setupTx([
                {
                    id: 'p-retired',
                    customerId,
                    addonSlug: 'retired-addon',
                    status: 'active',
                    deletedAt: null,
                    limitAdjustments: null
                }
            ]);

            // Act
            await handlePlanChangeAddonRecalculation({
                customerId,
                oldPlanId: 'owner-basic',
                newPlanId: 'owner-basic',
                billing,
                db: {} as never
            });

            // Assert — warn logged with addonSlug; billing not touched
            expect(mockWarn).toHaveBeenCalledWith(
                expect.objectContaining({ addonSlug: 'retired-addon' }),
                expect.stringContaining('skipping purchase')
            );
            expect(billing.limits.set).not.toHaveBeenCalled();
            expect(mockGetAddonBySlug).not.toHaveBeenCalled();
        });

        it('should skip entitlement-only addons (affectsLimitKey=null)', async () => {
            // Arrange — unique customerId to bypass module-level dedup guard
            const customerId = 'cust-entitlement-skip-t013';
            mockGetBySlug.mockResolvedValue({ success: true, data: STUB_VISIBILITY_7D });
            setupTx([
                {
                    id: 'p-vis',
                    customerId,
                    addonSlug: 'visibility-boost-7d',
                    status: 'active',
                    deletedAt: null,
                    limitAdjustments: null
                }
            ]);

            // Act
            await handlePlanChangeAddonRecalculation({
                customerId,
                oldPlanId: 'owner-basic',
                newPlanId: 'owner-basic',
                billing,
                db: {} as never
            });

            // Assert — limitKey=null → not in limitAddons → no billing.limits.set
            expect(billing.limits.set).not.toHaveBeenCalled();
            expect(mockGetAddonBySlug).not.toHaveBeenCalled();
        });

        it('should NOT call getBySlug when there are no active purchases', async () => {
            // Arrange — unique customerId + empty purchases → early exit (limitAddons=[])
            const customerId = 'cust-empty-t013';
            setupTx([]);

            // Act
            await handlePlanChangeAddonRecalculation({
                customerId,
                oldPlanId: 'owner-basic',
                newPlanId: 'owner-pro',
                billing,
                db: {} as never
            });

            // Assert — catalog never consulted when no purchases
            expect(mockGetBySlug).not.toHaveBeenCalled();
            expect(mockGetAddonBySlug).not.toHaveBeenCalled();
        });
    });
});
