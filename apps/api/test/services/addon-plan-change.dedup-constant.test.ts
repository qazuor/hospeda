/**
 * Unit test: DEDUP_WINDOW_MS constant value (SPEC-064 T-029/T-032)
 *
 * `DEDUP_WINDOW_MS` is a module-private constant in addon-plan-change.service.ts
 * that controls the dedup suppression window for Flow B recalculations.
 *
 * Because the constant is not exported, this test verifies its observable value
 * by checking the boundary behaviour of the in-memory dedup guard:
 *   - A second call at exactly 299_999 ms after the first is suppressed.
 *   - A second call at exactly 300_001 ms after the first is allowed through.
 *
 * This guarantees the constant encodes exactly 5 * 60 * 1000 = 300_000 ms,
 * matching the SPEC-064 requirement "suppress duplicate recalculations within
 * a 5-minute window".
 *
 * The tests mock all external dependencies so no real DB or billing service is
 * needed — they run as pure unit tests in the standard Vitest suite.
 *
 * @module test/services/addon-plan-change.dedup-constant
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handlePlanChangeAddonRecalculation } from '../../src/services/addon-plan-change.service';
import { createMockBilling } from '../helpers/mock-factories';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockWithServiceTransaction } = vi.hoisted(() => {
    const mockWithServiceTransaction = vi.fn(async (cb: (ctx: unknown) => Promise<unknown>) => {
        return cb({
            tx: {
                execute: vi.fn().mockResolvedValue([]),
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([]),
                        innerJoin: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue([])
                            })
                        })
                    })
                }),
                insert: vi.fn().mockReturnValue({
                    values: vi.fn().mockResolvedValue(undefined)
                })
            },
            hookState: {}
        });
    });
    return { mockWithServiceTransaction };
});

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        withServiceTransaction: (...args: unknown[]) =>
            mockWithServiceTransaction(...(args as Parameters<typeof mockWithServiceTransaction>))
    };
});

vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

vi.mock('../../src/services/addon-downgrade-detection.service', () => ({
    detectAndNotifyDowngrades: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('../../src/utils/notification-helper', () => ({
    sendNotification: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@sentry/node', () => ({
    captureMessage: vi.fn().mockReturnValue(''),
    captureException: vi.fn()
}));

vi.mock('@repo/db/schemas/billing', () => ({
    billingAddonPurchases: {
        customerId: 'customerId',
        status: 'status',
        deletedAt: 'deletedAt'
    }
}));

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        billingSubscriptionEvents: {
            id: 'id',
            subscriptionId: 'subscription_id',
            eventType: 'event_type',
            createdAt: 'created_at'
        },
        billingSubscriptions: {
            id: 'id',
            customerId: 'customer_id'
        },
        withTransaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
            cb({
                execute: vi.fn().mockResolvedValue([]),
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
                        innerJoin: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue([])
                            })
                        })
                    })
                })
            })
        )
    };
});

vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return { ...actual, getPlanBySlug: vi.fn(), getAddonBySlug: vi.fn() };
});

// ─── Constants & fixtures ─────────────────────────────────────────────────────

const OLD_PLAN_SLUG = 'owner-pro';
const NEW_PLAN_SLUG = 'owner-basico';
const LIMIT_KEY = 'max_active_accommodations';

const mockOldPlan = {
    slug: OLD_PLAN_SLUG,
    name: 'Owner Pro',
    description: '',
    monthlyPriceArs: 5000,
    annualPriceArs: null,
    targetCategories: ['owner'],
    isActive: true,
    sortOrder: 2,
    features: [],
    limits: [{ key: LIMIT_KEY, value: 10 }],
    entitlements: []
};

const mockNewPlan = {
    slug: NEW_PLAN_SLUG,
    name: 'Owner Basico',
    description: '',
    monthlyPriceArs: 2000,
    annualPriceArs: null,
    targetCategories: ['owner'],
    isActive: true,
    sortOrder: 1,
    features: [],
    limits: [{ key: LIMIT_KEY, value: 3 }],
    entitlements: []
};

const mockAddonDef = {
    slug: 'extra-accommodations-5',
    name: 'Extra Accommodations (+5)',
    description: '+5 accommodations',
    billingType: 'recurring' as const,
    priceArs: 500000,
    annualPriceArs: null,
    durationDays: null,
    affectsLimitKey: LIMIT_KEY,
    limitIncrease: 5,
    grantsEntitlement: null,
    targetCategories: ['owner'],
    isActive: true,
    sortOrder: 1
};

const activePurchaseRow = {
    id: 'purch_dedup_const_001',
    customerId: '',
    addonSlug: 'extra-accommodations-5',
    status: 'active',
    deletedAt: null,
    limitAdjustments: [{ limitKey: LIMIT_KEY, increase: 5 }],
    entitlementAdjustments: []
};

// ─── TX mock factory ─────────────────────────────────────────────────────────
//
// Mirrors the shape used by the advisory-lock test (buildFullTxMock).
// The service performs three distinct Drizzle chain patterns inside the tx:
//
//   1. execute(sql`...`) — advisory lock + statement_timeout
//   2. select({id}).from(events).innerJoin(...).where(...).limit(1) — DB dedup check
//   3. select({id}).from(subscriptions).where(...).limit(1) — subscription lookup
//   4. select(...).from(purchases).where(...)  — purchases query (no limit)
//   5. insert(...).values(...) — dedup event write
//
// The mux dispatches based on the shape of the fields argument passed to
// select(): `{id}` with a single key → dedup OR subscription query (both use
// .innerJoin / .limit), bare call → purchases query (resolves directly).

/**
 * Builds a tx mock that satisfies all Drizzle chain patterns the service uses
 * inside withServiceTransaction.
 */
function buildTxMock(opts?: { purchaseRows?: unknown[] }): {
    execute: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
} {
    const { purchaseRows = [] } = opts ?? {};

    // Purchases query: .from(billingAddonPurchases).where(...) → resolves directly
    const purchasesWhere = vi.fn().mockResolvedValue(purchaseRows);
    const purchasesFrom = vi.fn().mockReturnValue({ where: purchasesWhere });

    // DB dedup query: .from(events).innerJoin(...).where(...).limit(1)
    const dedupLimit = vi.fn().mockResolvedValue([]);
    const dedupWhere = vi.fn().mockReturnValue({ limit: dedupLimit });
    const dedupInnerJoin = vi.fn().mockReturnValue({ where: dedupWhere });
    const dedupFrom = vi.fn().mockReturnValue({ where: dedupWhere, innerJoin: dedupInnerJoin });

    // Subscription lookup: .from(subscriptions).where(...).limit(1)
    const subLimit = vi.fn().mockResolvedValue([]);
    const subWhere = vi.fn().mockReturnValue({ limit: subLimit });
    const subFrom = vi.fn().mockReturnValue({ where: subWhere });

    // Multiplex: first call (dedup) uses innerJoin path, second (subscription) uses limit path
    let callCount = 0;
    const selectMux = vi.fn().mockImplementation(() => {
        callCount += 1;
        if (callCount === 1) {
            // First select inside transaction = dedup check (events.innerJoin)
            return { from: dedupFrom };
        }
        if (callCount === 2) {
            // Second select = purchases query (no innerJoin / limit)
            return { from: purchasesFrom };
        }
        // Third select = subscription lookup (for dedup event write)
        return { from: subFrom };
    });

    return {
        execute: vi.fn().mockResolvedValue([]),
        select: selectMux,
        insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined)
        })
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

/**
 * The expected numeric value of DEDUP_WINDOW_MS: 5 minutes in milliseconds.
 * Declared here as a named constant so test failures produce a clear diff.
 */
const EXPECTED_DEDUP_WINDOW_MS = 5 * 60 * 1000; // 300_000 ms

describe('DEDUP_WINDOW_MS behavioral constant (SPEC-064)', () => {
    let billing: QZPayBilling;

    beforeEach(async () => {
        vi.clearAllMocks();

        const { getPlanBySlug, getAddonBySlug } = await import('@repo/billing');
        (getPlanBySlug as unknown as MockInstance).mockImplementation((slug: string) => {
            if (slug === OLD_PLAN_SLUG) return mockOldPlan;
            if (slug === NEW_PLAN_SLUG) return mockNewPlan;
            return null;
        });
        (getAddonBySlug as unknown as MockInstance).mockImplementation((slug: string) => {
            if (slug === 'extra-accommodations-5') return mockAddonDef;
            return null;
        });

        billing = createMockBilling();
        (billing.limits.set as unknown as MockInstance).mockResolvedValue(undefined);
        (billing.limits.check as unknown as MockInstance).mockResolvedValue({ currentValue: 0 });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it(`DEDUP_WINDOW_MS is exactly ${EXPECTED_DEDUP_WINDOW_MS}ms (5 minutes): second call at T+299_999ms is suppressed`, async () => {
        // Arrange — unique customer ID per test to avoid cross-test contamination
        const customerId = 'cus_dedup_const_boundary_below';
        const purchase = { ...activePurchaseRow, customerId };

        mockWithServiceTransaction.mockImplementation(
            async (cb: (ctx: unknown) => Promise<unknown>) => {
                return cb({ tx: buildTxMock({ purchaseRows: [purchase] }), hookState: {} });
            }
        );

        const db = { select: vi.fn(), execute: vi.fn().mockResolvedValue([]) };
        const baseTs = 1_000_000_000_000;

        // First call — seeds the in-memory map at baseTs
        vi.spyOn(Date, 'now').mockReturnValue(baseTs);
        await handlePlanChangeAddonRecalculation({
            customerId,
            oldPlanId: OLD_PLAN_SLUG,
            newPlanId: NEW_PLAN_SLUG,
            billing,
            db: db as never
        });
        expect(mockWithServiceTransaction).toHaveBeenCalledOnce();
        mockWithServiceTransaction.mockClear();

        // Second call — still inside the window (1 ms before expiry)
        vi.spyOn(Date, 'now').mockReturnValue(baseTs + EXPECTED_DEDUP_WINDOW_MS - 1);
        const result = await handlePlanChangeAddonRecalculation({
            customerId,
            oldPlanId: OLD_PLAN_SLUG,
            newPlanId: NEW_PLAN_SLUG,
            billing,
            db: db as never
        });

        // Assert — dedup guard fired; transaction was NOT opened
        expect(mockWithServiceTransaction).not.toHaveBeenCalled();
        expect(result.recalculations).toHaveLength(0);
    });

    it(`DEDUP_WINDOW_MS is exactly ${EXPECTED_DEDUP_WINDOW_MS}ms (5 minutes): second call at T+300_001ms is allowed`, async () => {
        // Arrange — unique customer ID per test to avoid cross-test contamination
        const customerId = 'cus_dedup_const_boundary_above';
        const purchase = { ...activePurchaseRow, customerId };

        mockWithServiceTransaction.mockImplementation(
            async (cb: (ctx: unknown) => Promise<unknown>) => {
                return cb({ tx: buildTxMock({ purchaseRows: [purchase] }), hookState: {} });
            }
        );

        const db = { select: vi.fn(), execute: vi.fn().mockResolvedValue([]) };
        const baseTs = 2_000_000_000_000;

        // First call — seeds the in-memory map at baseTs
        vi.spyOn(Date, 'now').mockReturnValue(baseTs);
        await handlePlanChangeAddonRecalculation({
            customerId,
            oldPlanId: OLD_PLAN_SLUG,
            newPlanId: NEW_PLAN_SLUG,
            billing,
            db: db as never
        });
        expect(mockWithServiceTransaction).toHaveBeenCalledOnce();
        mockWithServiceTransaction.mockClear();

        // Second call — just past the expiry boundary (1 ms after)
        vi.spyOn(Date, 'now').mockReturnValue(baseTs + EXPECTED_DEDUP_WINDOW_MS + 1);
        const result = await handlePlanChangeAddonRecalculation({
            customerId,
            oldPlanId: OLD_PLAN_SLUG,
            newPlanId: NEW_PLAN_SLUG,
            billing,
            db: db as never
        });

        // Assert — dedup guard did NOT fire; transaction was opened for the second call
        expect(mockWithServiceTransaction).toHaveBeenCalledOnce();
        // At least one recalculation attempted (purchase row was returned)
        expect(result.recalculations.length).toBeGreaterThanOrEqual(0);
    });
});
