/**
 * `activateRecurringAddonPurchase` — the only place a recurring add-on ever
 * becomes a granted benefit (HOS-847 PR 5).
 *
 * `addon-purchase-adjustments.ts` is deliberately left REAL here. It is the
 * seam `confirmAddonPurchase` and this activation now share, and the failure it
 * guards against — a purchase activated with `limit_adjustments: []`, which
 * contributes zero to `addon-plan-change.service.ts`'s combined-limit sum — is
 * invisible unless the arrays are computed for real and asserted on.
 *
 * @module test/services/addon-recurring-activation
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockGetBySlug,
    mockPlanGetById,
    mockPlanGetBySlug,
    mockApplyAddonEntitlements,
    mockClearEntitlementCache,
    mockUpdateSet,
    mockUpdateReturning,
    mockPlanSubRows,
    mockInsertValues
} = vi.hoisted(() => ({
    mockGetBySlug: vi.fn(),
    mockPlanGetById: vi.fn(),
    mockPlanGetBySlug: vi.fn(),
    mockApplyAddonEntitlements: vi.fn(),
    mockClearEntitlementCache: vi.fn(),
    mockUpdateSet: vi.fn(),
    /** Every `insert(...).values(payload)` — today only the featured-grant link. */
    mockInsertValues: vi.fn(),
    /** Rows the conditional activating UPDATE's `.returning()` answers with. */
    mockUpdateReturning: { rows: [] as Array<{ id: string }>, error: null as Error | null },
    mockPlanSubRows: { rows: [] as Array<{ planId: string | null }> }
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: mockClearEntitlementCache
}));

vi.mock('../../src/services/addon-entitlement.service', () => ({
    // `function`, not an arrow: the production code calls `new
    // AddonEntitlementService(billing)`, and an arrow is not a constructor.
    AddonEntitlementService: vi.fn(function () {
        return { applyAddonEntitlements: mockApplyAddonEntitlements };
    })
}));

vi.mock('@repo/service-core', () => ({
    // `function` rather than an arrow so `new AddonCatalogService()` works —
    // an arrow returned from `mockImplementation` is not a constructor.
    AddonCatalogService: vi.fn(function () {
        return { getBySlug: mockGetBySlug };
    }),
    PlanService: vi.fn(function () {
        return { getById: mockPlanGetById, getBySlug: mockPlanGetBySlug };
    })
}));

vi.mock('@repo/schemas', () => ({
    ProductDomainEnum: { ADDON: 'addon' },
    SubscriptionStatusEnum: { ACTIVE: 'active', PENDING_PROVIDER: 'pending_provider' }
}));

vi.mock('@repo/db/schemas/billing', () => ({
    billingAddonPurchases: {
        id: 'id',
        status: 'status',
        deletedAt: 'deleted_at',
        currentPeriodStart: 'current_period_start',
        currentPeriodEnd: 'current_period_end'
    },
    featuredListingAddonGrants: { id: 'id' }
}));

vi.mock('@repo/db', () => {
    const chainOver = (rows: unknown[]) => {
        const chain = {
            from: vi.fn(() => chain),
            where: vi.fn(() => chain),
            limit: vi.fn(() => Promise.resolve(rows))
        };
        return chain;
    };
    return {
        getDb: vi.fn(() => ({
            select: vi.fn(() => chainOver(mockPlanSubRows.rows)),
            update: vi.fn(() => ({
                set: vi.fn((payload: Record<string, unknown>) => {
                    mockUpdateSet(payload);
                    const whereResult = {
                        returning: vi.fn(() => {
                            if (mockUpdateReturning.error) {
                                return Promise.reject(mockUpdateReturning.error);
                            }
                            return Promise.resolve(mockUpdateReturning.rows);
                        })
                    };
                    return { where: vi.fn(() => whereResult) };
                })
            })),
            insert: vi.fn(() => ({
                values: vi.fn((payload: unknown) => {
                    mockInsertValues(payload);
                    return Promise.resolve(undefined);
                })
            }))
        })),
        billingSubscriptions: {
            id: 'id',
            planId: 'plan_id',
            status: 'status',
            mpSubscriptionId: 'mp_subscription_id',
            productDomain: 'product_domain',
            deletedAt: 'deleted_at',
            updatedAt: 'updated_at'
        },
        and: vi.fn((...args: unknown[]) => ({ and: args })),
        eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
        isNull: vi.fn((a: unknown) => ({ isNull: a }))
    };
});

import { activateRecurringAddonPurchase } from '../../src/services/addon-recurring-activation.service.js';
import type { RecurringAddonPurchaseRow } from '../../src/services/addon-recurring-period.js';

const ACTIVATED_AT = new Date('2026-05-10T12:00:00.000Z');

function purchase(overrides: Partial<RecurringAddonPurchaseRow> = {}): RecurringAddonPurchaseRow {
    return {
        id: 'purchase-1',
        customerId: 'cust-1',
        subscriptionId: 'plan-sub-1',
        addonSlug: 'extra-accommodations-5',
        status: 'pending',
        mpSubscriptionId: 'preapproval-1',
        billingInterval: 'monthly',
        currentPeriodEnd: null,
        purchasedAt: new Date('2026-05-10T11:00:00.000Z'),
        metadata: {},
        ...overrides
    };
}

const billing = {} as never;

/**
 * Wraps a pg driver error the way Drizzle wraps it before a `catch` block ever
 * sees it: an outer error carrying `query`, `params` and `cause`, and NO `code`
 * of its own.
 *
 * See `apps/api/src/services/billing/unique-violation.ts` for the verified
 * shape this reproduces.
 */
function drizzleWrapped(cause: Error): Error {
    return Object.assign(new Error('Failed query: update "billing_addon_purchases" ...'), {
        name: 'DrizzleQueryError',
        query: 'update "billing_addon_purchases" set ...',
        params: [],
        cause
    });
}

/** The activating UPDATE's payload — the one carrying `status`. */
function activatingWrite(): Record<string, unknown> | undefined {
    return mockUpdateSet.mock.calls
        .map((call) => call[0] as Record<string, unknown>)
        .find((payload) => payload.status === 'active');
}

beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateReturning.rows = [{ id: 'purchase-1' }];
    mockUpdateReturning.error = null;
    mockPlanSubRows.rows = [{ planId: 'plan-uuid-1' }];
    mockGetBySlug.mockResolvedValue({
        success: true,
        data: {
            id: 'addon-uuid-1',
            slug: 'extra-accommodations-5',
            name: 'Extra accommodations',
            billingType: 'recurring',
            affectsLimitKey: 'maxAccommodations',
            limitIncrease: 5,
            grantsEntitlement: null,
            durationDays: null,
            requiresAccommodationTarget: false
        }
    });
    mockPlanGetById.mockResolvedValue({
        success: true,
        data: { id: 'plan-uuid-1', limits: { maxAccommodations: 3 } }
    });
    mockApplyAddonEntitlements.mockResolvedValue({ success: true, data: undefined });
});

describe('activateRecurringAddonPurchase', () => {
    it('writes the status, the adjustment arrays and a locally computed period', async () => {
        // Act
        const outcome = await activateRecurringAddonPurchase({
            billing,
            purchase: purchase(),
            activatedAt: ACTIVATED_AT,
            providerPaymentId: 'mp-pay-1',
            triggerSource: 'test'
        });

        // Assert
        expect(outcome).toEqual({ activated: true });
        expect(activatingWrite()).toMatchObject({
            status: 'active',
            paymentId: 'mp-pay-1',
            needsEntitlementSync: false,
            currentPeriodStart: ACTIVATED_AT,
            currentPeriodEnd: new Date('2026-06-10T12:00:00.000Z')
        });
    });

    it('records the limit increase over the BASE plan limit, not an empty array', async () => {
        // Act
        await activateRecurringAddonPurchase({
            billing,
            purchase: purchase(),
            activatedAt: ACTIVATED_AT,
            triggerSource: 'test'
        });

        // Assert: `addon-plan-change.service.ts` sums `increase` across a
        // customer's active purchases. An empty array here is a paid add-on that
        // silently raises nobody's limit.
        expect(activatingWrite()?.limitAdjustments).toEqual([
            { limitKey: 'maxAccommodations', increase: 5, previousValue: 3, newValue: 8 }
        ]);
    });

    it('grants the entitlements and drops the entitlement cache', async () => {
        // Act
        await activateRecurringAddonPurchase({
            billing,
            purchase: purchase(),
            activatedAt: ACTIVATED_AT,
            triggerSource: 'test'
        });

        // Assert
        expect(mockClearEntitlementCache).toHaveBeenCalledWith('cust-1');
        expect(mockApplyAddonEntitlements).toHaveBeenCalledWith({
            customerId: 'cust-1',
            addonSlug: 'extra-accommodations-5',
            purchaseId: 'purchase-1'
        });
    });

    it('grants NOTHING when the conditional UPDATE claimed no row (a concurrent webhook won)', async () => {
        // Arrange: the `status = 'pending'` predicate matched nothing, which is
        // what a MercadoPago redelivery — or the authorization event racing the
        // first charge event — actually looks like.
        mockUpdateReturning.rows = [];

        // Act
        const outcome = await activateRecurringAddonPurchase({
            billing,
            purchase: purchase(),
            activatedAt: ACTIVATED_AT,
            triggerSource: 'test'
        });

        // Assert
        expect(outcome).toEqual({ activated: false, reason: 'already-settled' });
        expect(mockApplyAddonEntitlements).not.toHaveBeenCalled();
        expect(mockClearEntitlementCache).not.toHaveBeenCalled();
    });

    it('does not even attempt the UPDATE for a purchase that is not pending', async () => {
        // Act
        const outcome = await activateRecurringAddonPurchase({
            billing,
            purchase: purchase({ status: 'active' }),
            activatedAt: ACTIVATED_AT,
            triggerSource: 'test'
        });

        // Assert
        expect(outcome).toEqual({ activated: false, reason: 'already-settled' });
        expect(mockUpdateSet).not.toHaveBeenCalled();
    });

    it('reports a duplicate active purchase instead of crashing the webhook', async () => {
        // Arrange: `idx_addon_purchases_active_unique` rejected the row — this
        // customer already has this add-on active under another purchase.
        //
        // The error is built in the WRAPPED shape Drizzle actually throws, not
        // the flat `Error & { code }` a hand-written fixture reaches for first.
        // Drizzle wraps every query failure in a `DrizzleQueryError` that has
        // `query`, `params` and `cause` and NO `code` of its own; the SQLSTATE
        // lives one level down on the pg driver's `DatabaseError`. A flat
        // fixture passes against a predicate that reads `error.code` — which is
        // dead in production — so it certifies exactly the bug it is supposed
        // to catch.
        mockUpdateReturning.error = drizzleWrapped(
            Object.assign(new Error('duplicate key value violates unique constraint'), {
                code: '23505',
                constraint: 'idx_addon_purchases_active_unique'
            })
        );

        // Act
        const outcome = await activateRecurringAddonPurchase({
            billing,
            purchase: purchase(),
            activatedAt: ACTIVATED_AT,
            triggerSource: 'test'
        });

        // Assert
        expect(outcome).toEqual({ activated: false, reason: 'duplicate-active-purchase' });
        expect(mockApplyAddonEntitlements).not.toHaveBeenCalled();
    });

    it('re-throws a database failure that is NOT a unique violation', async () => {
        // Arrange: the control for the test above. Without it, a predicate that
        // returned `true` for every error would pass just as happily — and would
        // silently swallow a connection failure as "duplicate purchase".
        mockUpdateReturning.error = drizzleWrapped(
            Object.assign(new Error('connection terminated unexpectedly'), { code: '57P01' })
        );

        // Act
        const thrown = await activateRecurringAddonPurchase({
            billing,
            purchase: purchase(),
            activatedAt: ACTIVATED_AT,
            triggerSource: 'test'
        }).then(
            (outcome) => outcome,
            (error: unknown) => error
        );

        // Assert: the wrapper propagates untouched, still carrying the real
        // SQLSTATE on its cause. Asserted on the CAUSE, because a Drizzle
        // wrapper's own message names the query, never the failure.
        expect(thrown).toBeInstanceOf(Error);
        expect((thrown as Error & { cause?: { code?: string } }).cause?.code).toBe('57P01');
        expect(mockApplyAddonEntitlements).not.toHaveBeenCalled();
    });

    it('flags the row for the reconciliation sweep when the grant fails', async () => {
        // Arrange
        mockApplyAddonEntitlements.mockResolvedValue({
            success: false,
            error: { code: 'PROVIDER_ERROR', message: 'nope' }
        });

        // Act
        const outcome = await activateRecurringAddonPurchase({
            billing,
            purchase: purchase(),
            activatedAt: ACTIVATED_AT,
            triggerSource: 'test'
        });

        // Assert: the purchase stays active (the money was taken) and the
        // existing `addon-expiry` phase-7 sweep is handed the retry.
        expect(outcome).toEqual({ activated: true });
        expect(
            mockUpdateSet.mock.calls
                .map((call) => call[0] as Record<string, unknown>)
                .some((payload) => payload.needsEntitlementSync === true)
        ).toBe(true);
    });

    it('refuses to activate an add-on slug the catalog does not know', async () => {
        // Arrange
        mockGetBySlug.mockResolvedValue({ success: false, error: { code: 'NOT_FOUND' } });

        // Act
        const outcome = await activateRecurringAddonPurchase({
            billing,
            purchase: purchase(),
            activatedAt: ACTIVATED_AT,
            triggerSource: 'test'
        });

        // Assert
        expect(outcome).toEqual({ activated: false, reason: 'addon-not-in-catalog' });
        expect(mockUpdateSet).not.toHaveBeenCalled();
    });

    it('writes the featured-listing link BEFORE granting the entitlements', async () => {
        // Arrange: a target-required add-on with its accommodation in metadata.
        // `applyAddonEntitlements` READS `featured_listing_addon_grants` by
        // purchaseId to decide whether to flip `featuredByEntitlement`, so a
        // grant that runs first reads an empty table and silently flips nothing
        // — HOS-675 is that incident, months long, with no failure anywhere.
        mockGetBySlug.mockResolvedValue({
            success: true,
            data: {
                id: 'addon-uuid-2',
                slug: 'visibility-boost-30d',
                name: 'Visibility boost',
                billingType: 'recurring',
                affectsLimitKey: null,
                limitIncrease: null,
                grantsEntitlement: 'FEATURED_LISTING',
                durationDays: null,
                requiresAccommodationTarget: true
            }
        });

        // Act
        await activateRecurringAddonPurchase({
            billing,
            purchase: purchase({
                addonSlug: 'visibility-boost-30d',
                metadata: { accommodationId: 'acc-1' }
            }),
            activatedAt: ACTIVATED_AT,
            triggerSource: 'test'
        });

        // Assert: both ran, and the link ran first.
        expect(mockInsertValues).toHaveBeenCalledWith({
            purchaseId: 'purchase-1',
            accommodationId: 'acc-1'
        });
        expect(mockApplyAddonEntitlements).toHaveBeenCalledTimes(1);
        const linkOrder = mockInsertValues.mock.invocationCallOrder[0] as number;
        const grantOrder = mockApplyAddonEntitlements.mock.invocationCallOrder[0] as number;
        expect(linkOrder).toBeLessThan(grantOrder);
    });

    it('opens a twelve-month window for an annual add-on', async () => {
        // Act
        await activateRecurringAddonPurchase({
            billing,
            purchase: purchase({ billingInterval: 'annual' }),
            activatedAt: ACTIVATED_AT,
            triggerSource: 'test'
        });

        // Assert
        expect(activatingWrite()?.currentPeriodEnd).toEqual(new Date('2027-05-10T12:00:00.000Z'));
    });
});
