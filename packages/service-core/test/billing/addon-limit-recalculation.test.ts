import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted() runs before vi.mock() factories so variables declared here can
// be safely referenced inside mock factories without temporal dead zone issues.
const { execRef, mockPlanGetById, mockPlanGetBySlug, mockCatalogGetBySlug, hydrationRowsRef } =
    vi.hoisted(() => {
        // execRef.fn is replaced per-test to control what tx.execute() returns.
        const execRef = { fn: vi.fn().mockResolvedValue({ rows: [] }) };
        const mockPlanGetById = vi.fn();
        const mockPlanGetBySlug = vi.fn();
        const mockCatalogGetBySlug = vi.fn();
        // HOS-1176: rows returned by the batched SELECT inside
        // `hydrateSubscriptionProductDomains` — controls what the "real DB" would
        // answer for the `billing_subscriptions.product_domain` column when a mock
        // subscription arrives WITHOUT `productDomain` (the realistic shape
        // `getByCustomerId()` actually returns).
        const hydrationRowsRef: { rows: Array<{ id: string; productDomain: string | null }> } = {
            rows: []
        };
        return {
            execRef,
            mockPlanGetById,
            mockPlanGetBySlug,
            mockCatalogGetBySlug,
            hydrationRowsRef
        };
    });

// Mock external dependencies before importing the module under test
// (kept for the 3 passing tests that still reference getPlanBySlug/getAddonBySlug)
// `importOriginal`, not a bare stub: the recalculation service resolves the
// subscription's DOMAIN through `productDomainForLimitKey` (HOS-688), and that
// mapping is precisely what these tests need to exercise rather than replace —
// a stubbed one would let a wrong mapping pass.
vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        getAddonBySlug: vi.fn(),
        getPlanBySlug: vi.fn()
    };
});

// SPEC-192 T-027 cutover: recalculation service now uses DB-backed PlanService
// and AddonCatalogService (internal package imports). Mock them via the paths
// as the test loader resolves them from this file's location.
vi.mock('../../src/services/billing/plan/plan.service.js', () => ({
    PlanService: vi.fn().mockImplementation(function () {
        return {
            getById: mockPlanGetById,
            getBySlug: mockPlanGetBySlug
        };
    })
}));

vi.mock('../../src/services/billing/addon/addon-catalog.service.js', () => ({
    AddonCatalogService: vi.fn().mockImplementation(function () {
        return {
            getBySlug: mockCatalogGetBySlug,
            list: vi.fn()
        };
    })
}));

vi.mock('@repo/db/schemas/billing', () => ({
    billingAddonPurchases: {
        customerId: 'customerId',
        status: 'status',
        deletedAt: 'deletedAt'
    }
}));

// Mock @repo/db to provide withTransaction and sql.
// withTransaction calls the callback with a proxy tx whose execute() method
// delegates to execRef.fn, which each test configures via setExecResult().
vi.mock('@repo/db', () => ({
    sql: Object.assign(
        vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
            type: 'sql',
            strings,
            values
        })),
        { raw: vi.fn((s: string) => ({ type: 'sql.raw', s })) }
    ),
    withTransaction: vi.fn(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const tx: Record<string, unknown> = {
            execute: vi.fn((..._args: unknown[]) => execRef.fn(..._args))
        };
        return fn(tx);
    }),
    // HOS-1176: `hydrateSubscriptionProductDomains` (imported transitively via
    // `subscription-product-domain.js`) reads these three off `@repo/db` when
    // a subscription arrives without `productDomain` already set. Only the
    // shape matters — `inArray`/`billingSubscriptions` are opaque markers the
    // mocked `where()`/`select()` below never actually inspect.
    getDb: vi.fn(() => ({
        select: vi.fn(() => ({
            from: vi.fn(() => ({
                where: vi.fn(() => Promise.resolve(hydrationRowsRef.rows))
            }))
        }))
    })),
    billingSubscriptions: { id: 'id', productDomain: 'productDomain' },
    inArray: vi.fn((col: unknown, values: unknown[]) => ({ col, values }))
}));

vi.mock('drizzle-orm', () => ({
    and: vi.fn((...args: unknown[]) => args),
    eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
    isNull: vi.fn((col: unknown) => ({ col, isNull: true })),
    // Needed by @repo/db schema files that call relations() at module load time
    relations: vi.fn(() => ({})),
    many: vi.fn(() => ({})),
    one: vi.fn(() => ({})),
    sql: Object.assign(
        vi.fn((_strings: unknown, ..._values: unknown[]) => ({ type: 'sql' })),
        { raw: vi.fn((s: string) => ({ type: 'sql.raw', s })) }
    )
}));

import { recalculateAddonLimitsForCustomer } from '../../src/services/billing/addon/addon-limit-recalculation.service.js';

/**
 * Configure what tx.execute() returns for the current test.
 * The service uses tx.execute() inside withTransaction to query
 * billing_addon_purchases with FOR UPDATE.
 */
function setExecResult(purchases: unknown[]): void {
    execRef.fn = vi.fn().mockResolvedValue({ rows: purchases });
}

/**
 * Configure tx.execute() to reject with the given error.
 */
function setExecError(error: Error): void {
    execRef.fn = vi.fn().mockRejectedValue(error);
}

/**
 * Configure what the batched `productDomain` SELECT inside
 * `hydrateSubscriptionProductDomains` returns (HOS-1176). Only relevant for
 * mock subscriptions that omit `productDomain` entirely — the realistic
 * shape `billing.subscriptions.getByCustomerId()` actually returns, per
 * `hydrateSubscriptionProductDomains`'s own doc.
 */
function setHydrationRows(rows: Array<{ id: string; productDomain: string | null }>): void {
    hydrationRowsRef.rows = rows;
}

/** Build a minimal mock QZPay billing client */
function buildMockBilling(
    subscriptions: unknown[],
    overrides: {
        setFn?: ReturnType<typeof vi.fn>;
        removeBySourceFn?: ReturnType<typeof vi.fn>;
    } = {}
) {
    return {
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue(subscriptions)
        },
        limits: {
            set: overrides.setFn ?? vi.fn().mockResolvedValue(undefined),
            removeBySource: overrides.removeBySourceFn ?? vi.fn().mockResolvedValue(undefined)
        }
    };
}

/** Minimal stub for the db parameter (service ignores it; withTransaction is used instead) */
const stubDb = {} as never;

describe('recalculateAddonLimitsForCustomer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: no purchases
        setExecResult([]);
        // Default: no rows to hydrate (most tests inject `productDomain`
        // directly on the mock subscription, so hydration never fires).
        setHydrationRows([]);

        // Default plan resolution: getById returns NOT_FOUND → getBySlug fallback
        mockPlanGetById.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND', message: 'plan not found by id' }
        });
        // Default: plan not found (each test overrides as needed)
        mockPlanGetBySlug.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND', message: 'plan not found' }
        });

        // Default: addon not found (each test overrides as needed)
        mockCatalogGetBySlug.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND', message: 'addon not found' }
        });
    });

    it('should return failed outcome when customer has no subscriptions', async () => {
        // Arrange
        setExecResult([]);
        const billing = buildMockBilling([]);

        // Act
        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-1',
            limitKey: 'max_accommodations',
            billing: billing as never,
            db: stubDb
        });

        // Assert
        expect(result.outcome).toBe('failed');
        expect(result.reason).toMatch(/no subscriptions/i);
    });

    it('should return failed outcome when customer has no active subscription', async () => {
        // Arrange
        setExecResult([]);
        const billing = buildMockBilling([{ status: 'cancelled', planId: 'starter' }]);

        // Act
        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-1',
            limitKey: 'max_accommodations',
            billing: billing as never,
            db: stubDb
        });

        // Assert
        expect(result.outcome).toBe('failed');
        expect(result.reason).toMatch(/no active/i);
    });

    it('should return failed outcome when plan is not found in canonical config', async () => {
        // Arrange — after SPEC-192 T-027 cutover, plan resolution uses PlanService (DB-backed)
        setExecResult([]);
        const billing = buildMockBilling([{ status: 'active', planId: 'unknown-plan' }]);
        // Both getById and getBySlug return NOT_FOUND (default from beforeEach)

        // Act
        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-1',
            limitKey: 'max_accommodations',
            billing: billing as never,
            db: stubDb
        });

        // Assert
        expect(result.outcome).toBe('failed');
        expect(result.reason).toMatch(/unknown-plan/);
    });

    it('should return skipped outcome when base plan has unlimited (-1) for the limitKey', async () => {
        // Arrange — after T-027 cutover, plan limits are Record<string,number> (not array)
        setExecResult([]);
        const billing = buildMockBilling([{ status: 'active', planId: 'enterprise' }]);
        mockPlanGetBySlug.mockResolvedValue({
            success: true,
            data: {
                id: 'plan-uuid-enterprise',
                slug: 'enterprise',
                limits: { max_accommodations: -1 }
            }
        });

        // Act
        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-1',
            limitKey: 'max_accommodations',
            billing: billing as never,
            db: stubDb
        });

        // Assert
        expect(result.outcome).toBe('skipped');
        expect(result.newMaxValue).toBe(-1);
    });

    it('should call billing.limits.set when there are active addon increments', async () => {
        // Arrange
        const mockSet = vi.fn().mockResolvedValue(undefined);
        const purchases = [
            {
                addonSlug: 'extra-listings',
                status: 'active',
                deletedAt: null,
                limitAdjustments: [{ limitKey: 'max_accommodations', increase: 10 }]
            }
        ];
        setExecResult(purchases);
        const billing = buildMockBilling([{ status: 'active', planId: 'starter' }], {
            setFn: mockSet
        });
        // After T-027 cutover: catalog returns addon def, plan service returns Record<string,number>
        mockCatalogGetBySlug.mockResolvedValue({
            success: true,
            data: {
                slug: 'extra-listings',
                affectsLimitKey: 'max_accommodations',
                limitIncrease: 10
            }
        });
        mockPlanGetBySlug.mockResolvedValue({
            success: true,
            data: { id: 'plan-uuid-starter', slug: 'starter', limits: { max_accommodations: 5 } }
        });

        // Act
        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-1',
            limitKey: 'max_accommodations',
            billing: billing as never,
            db: stubDb
        });

        // Assert
        expect(result.outcome).toBe('success');
        expect(result.newMaxValue).toBe(15); // base(5) + addon(10)
        expect(result.addonCount).toBe(1);
        expect(mockSet).toHaveBeenCalledWith(
            expect.objectContaining({
                customerId: 'cust-1',
                limitKey: 'max_accommodations',
                maxValue: 15
            })
        );
    });

    it('should call billing.limits.removeBySource when no addons contribute to the limitKey', async () => {
        // Arrange — addon exists but does not affect this limitKey
        const mockRemoveBySource = vi.fn().mockResolvedValue(undefined);
        const purchases = [
            {
                addonSlug: 'extra-photos',
                status: 'active',
                deletedAt: null,
                limitAdjustments: []
            }
        ];
        setExecResult(purchases);
        const billing = buildMockBilling([{ status: 'active', planId: 'starter' }], {
            removeBySourceFn: mockRemoveBySource
        });
        // After T-027 cutover: catalog returns addon with different key; plan has Record<string,number>
        mockCatalogGetBySlug.mockResolvedValue({
            success: true,
            data: { slug: 'extra-photos', affectsLimitKey: 'max_photos', limitIncrease: 20 }
        });
        mockPlanGetBySlug.mockResolvedValue({
            success: true,
            data: { id: 'plan-uuid-starter', slug: 'starter', limits: { max_accommodations: 5 } }
        });

        // Act
        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-1',
            limitKey: 'max_accommodations',
            billing: billing as never,
            db: stubDb
        });

        // Assert
        expect(result.outcome).toBe('success');
        expect(result.newMaxValue).toBe(5); // only base plan
        expect(mockRemoveBySource).toHaveBeenCalled();
    });

    it('should return failed outcome when an unexpected error is thrown', async () => {
        // Arrange — tx.execute() rejects to simulate a DB crash
        setExecError(new Error('unexpected db crash'));
        const billing = buildMockBilling([]);

        // Act
        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-1',
            limitKey: 'max_accommodations',
            billing: billing as never,
            db: stubDb
        });

        // Assert
        expect(result.outcome).toBe('failed');
        expect(result.reason).toMatch(/unexpected error/i);
    });

    it('should handle trialing subscription as active', async () => {
        // Arrange — after T-027 cutover, plan limits via PlanService (Record<string,number>)
        const mockSet = vi.fn().mockResolvedValue(undefined);
        setExecResult([]);
        const billing = buildMockBilling([{ status: 'trialing', planId: 'starter' }], {
            setFn: mockSet
        });
        mockPlanGetBySlug.mockResolvedValue({
            success: true,
            data: { id: 'plan-uuid-starter', slug: 'starter', limits: { max_accommodations: 3 } }
        });

        // Act
        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-1',
            limitKey: 'max_accommodations',
            billing: billing as never,
            db: stubDb
        });

        // Assert — no addons, so removeBySource is called but outcome is still success
        expect(result.outcome).toBe('success');
        expect(result.newMaxValue).toBe(3);
    });
});

describe('recalculateAddonLimitsForCustomer — commerce verticals (HOS-688 AC-15)', () => {
    /**
     * AC-15 asserted against the code that WRITES the customer-level override,
     * not the middleware that reads one already written.
     *
     * The reading side was green while this side was broken, which is exactly
     * why the distinction matters: `resolveCommerceVerticalCap` faithfully
     * reports whatever `billing_customer_limits` holds, so a test that stubs
     * that row proves the panel renders a number — never that anybody wrote it.
     *
     * What was broken: this service resolved the base plan through
     * `isAccommodationSubscription`. For a commerce-only owner — the normal
     * case — that matched nothing, the recalculation SKIPPED, and the add-on
     * they had just paid for raised no cap at all. A charge with nothing
     * delivered, and not one layer raises.
     */
    beforeEach(() => {
        vi.clearAllMocks();
        setExecResult([]);
        setHydrationRows([]);
        mockPlanGetById.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND', message: 'plan not found by id' }
        });
        mockPlanGetBySlug.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND', message: 'plan not found' }
        });
        mockCatalogGetBySlug.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND', message: 'addon not found' }
        });
    });

    /** One active `extra-gastronomies-1` purchase, as the checkout writes it. */
    function gastronomyAddonPurchase() {
        return [
            {
                addonSlug: 'extra-gastronomies-1',
                status: 'active',
                deletedAt: null,
                limitAdjustments: [{ limitKey: 'max_gastronomies', increase: 1 }]
            }
        ];
    }

    /** The catalogue + plan stubs a gastronomy recalculation needs. */
    function stubGastronomyCatalogue(): void {
        mockCatalogGetBySlug.mockResolvedValue({
            success: true,
            data: {
                slug: 'extra-gastronomies-1',
                affectsLimitKey: 'max_gastronomies',
                limitIncrease: 1
            }
        });
        mockPlanGetBySlug.mockResolvedValue({
            success: true,
            data: {
                id: 'plan-uuid-gastronomy',
                slug: 'gastronomy-premium',
                limits: { max_gastronomies: 1 }
            }
        });
    }

    it('raises the cap for an owner with NO accommodation subscription', async () => {
        // The case the old predicate skipped outright. The owner holds exactly
        // one subscription and it is a gastronomy one.
        const mockSet = vi.fn().mockResolvedValue(undefined);
        setExecResult(gastronomyAddonPurchase());
        stubGastronomyCatalogue();
        const billing = buildMockBilling(
            [{ status: 'active', planId: 'gastronomy-premium', productDomain: 'gastronomy' }],
            { setFn: mockSet }
        );

        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-commerce-only',
            limitKey: 'max_gastronomies',
            billing: billing as never,
            db: stubDb
        });

        expect(result.outcome).toBe('success');
        expect(result.newMaxValue).toBe(2); // base(1) + addon(1)
        expect(mockSet).toHaveBeenCalledWith(
            expect.objectContaining({ limitKey: 'max_gastronomies', maxValue: 2 })
        );
    });

    it('reads the base off the GASTRONOMY plan when the owner also holds an accommodation one', async () => {
        // The second failure mode: the accommodation plan resolves, but it does
        // not declare `max_gastronomies`, so the base came out 0 and the cap
        // became the add-on's increase alone — 1 instead of 2. The owner pays
        // for an extra listing and their cap does not move.
        const mockSet = vi.fn().mockResolvedValue(undefined);
        setExecResult(gastronomyAddonPurchase());
        mockCatalogGetBySlug.mockResolvedValue({
            success: true,
            data: {
                slug: 'extra-gastronomies-1',
                affectsLimitKey: 'max_gastronomies',
                limitIncrease: 1
            }
        });
        mockPlanGetBySlug.mockImplementation(async (slug: string) =>
            slug === 'gastronomy-premium'
                ? {
                      success: true,
                      data: {
                          id: 'plan-uuid-gastronomy',
                          slug,
                          limits: { max_gastronomies: 1 }
                      }
                  }
                : {
                      success: true,
                      data: {
                          id: 'plan-uuid-owner',
                          slug,
                          limits: { max_accommodations: 3 }
                      }
                  }
        );
        const billing = buildMockBilling(
            [
                { status: 'active', planId: 'owner-premium', productDomain: 'accommodation' },
                { status: 'active', planId: 'gastronomy-premium', productDomain: 'gastronomy' }
            ],
            { setFn: mockSet }
        );

        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-both',
            limitKey: 'max_gastronomies',
            billing: billing as never,
            db: stubDb
        });

        expect(result.outcome).toBe('success');
        expect(result.oldMaxValue).toBe(1); // the GASTRONOMY plan's base, not 0
        expect(result.newMaxValue).toBe(2);
    });

    it('leaves the other vertical cap untouched (AC-15, second half)', async () => {
        // A gastronomy add-on must not move `max_experiences`. Resolving
        // `max_experiences` for this owner finds no experience subscription and
        // refuses rather than quietly writing something.
        setExecResult(gastronomyAddonPurchase());
        stubGastronomyCatalogue();
        const mockSet = vi.fn().mockResolvedValue(undefined);
        const billing = buildMockBilling(
            [{ status: 'active', planId: 'gastronomy-premium', productDomain: 'gastronomy' }],
            { setFn: mockSet }
        );

        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-commerce-only',
            limitKey: 'max_experiences',
            billing: billing as never,
            db: stubDb
        });

        expect(result.outcome).not.toBe('success');
        expect(mockSet).not.toHaveBeenCalled();
    });

    it('does NOT let a gastronomy subscription supply an accommodation base', async () => {
        // The isolation SPEC-239 built, in the direction this change could have
        // broken it: widening the predicate to "any subscription" would have
        // made a commerce plan answer for `max_accommodations`.
        const mockSet = vi.fn().mockResolvedValue(undefined);
        setExecResult([
            {
                addonSlug: 'extra-accommodations-5',
                status: 'active',
                deletedAt: null,
                limitAdjustments: [{ limitKey: 'max_accommodations', increase: 5 }]
            }
        ]);
        mockCatalogGetBySlug.mockResolvedValue({
            success: true,
            data: {
                slug: 'extra-accommodations-5',
                affectsLimitKey: 'max_accommodations',
                limitIncrease: 5
            }
        });
        const billing = buildMockBilling(
            [{ status: 'active', planId: 'gastronomy-premium', productDomain: 'gastronomy' }],
            { setFn: mockSet }
        );

        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-commerce-only',
            limitKey: 'max_accommodations',
            billing: billing as never,
            db: stubDb
        });

        expect(result.outcome).not.toBe('success');
        expect(mockSet).not.toHaveBeenCalled();
    });

    it('still resolves accommodation add-ons against the accommodation subscription', async () => {
        // Non-regression, and non-vacuity for the pair above: every non-commerce
        // key maps to `'accommodation'`, so this change is a strict no-op there.
        const mockSet = vi.fn().mockResolvedValue(undefined);
        setExecResult([
            {
                addonSlug: 'extra-accommodations-5',
                status: 'active',
                deletedAt: null,
                limitAdjustments: [{ limitKey: 'max_accommodations', increase: 5 }]
            }
        ]);
        mockCatalogGetBySlug.mockResolvedValue({
            success: true,
            data: {
                slug: 'extra-accommodations-5',
                affectsLimitKey: 'max_accommodations',
                limitIncrease: 5
            }
        });
        mockPlanGetBySlug.mockResolvedValue({
            success: true,
            data: {
                id: 'plan-uuid-owner',
                slug: 'owner-premium',
                limits: { max_accommodations: 3 }
            }
        });
        const billing = buildMockBilling(
            [
                { status: 'active', planId: 'gastronomy-premium', productDomain: 'gastronomy' },
                { status: 'active', planId: 'owner-premium', productDomain: 'accommodation' }
            ],
            { setFn: mockSet }
        );

        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-both',
            limitKey: 'max_accommodations',
            billing: billing as never,
            db: stubDb
        });

        expect(result.outcome).toBe('success');
        expect(result.newMaxValue).toBe(8); // base(3) + addon(5)
    });

    it('refuses a limit key that owns no product domain (HOS-1078)', async () => {
        // `limitKey` reaches this service as a free string off a
        // `billing_addons.affects_limit_key` row, so a typo gets here. It used
        // to resolve to `'accommodation'` via a `??`: this exact call would then
        // have found the owner's accommodation subscription below, read a plan
        // that does not declare the key, and computed a cap off a base of zero
        // — a charge with nothing delivered, and nothing raised.
        const mockSet = vi.fn().mockResolvedValue(undefined);
        setExecResult([
            {
                addonSlug: 'extra-gastronomys-1',
                status: 'active',
                deletedAt: null,
                limitAdjustments: [{ limitKey: 'max_gastronomys', increase: 1 }]
            }
        ]);
        mockCatalogGetBySlug.mockResolvedValue({
            success: true,
            data: {
                slug: 'extra-gastronomys-1',
                affectsLimitKey: 'max_gastronomys',
                limitIncrease: 1
            }
        });
        mockPlanGetBySlug.mockResolvedValue({
            success: true,
            data: {
                id: 'plan-uuid-owner',
                slug: 'owner-premium',
                limits: { max_accommodations: 3 }
            }
        });
        const billing = buildMockBilling(
            [{ status: 'active', planId: 'owner-premium', productDomain: 'accommodation' }],
            { setFn: mockSet }
        );

        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-typo-addon',
            limitKey: 'max_gastronomys',
            billing: billing as never,
            db: stubDb
        });

        expect(result.outcome).toBe('failed');
        // Naming the key in the reason is what makes this diagnosable at all —
        // the old path produced no reason because it produced no failure.
        expect(result.reason).toContain('max_gastronomys');
        expect(mockSet).not.toHaveBeenCalled();
    });
});

describe('recalculateAddonLimitsForCustomer — realistic getByCustomerId shape (HOS-1176)', () => {
    /**
     * The other two describe blocks in this file inject `productDomain`
     * directly on the mock subscription literal (e.g.
     * `{ status: 'active', planId: 'x', productDomain: 'gastronomy' }`).
     * That is NOT what `billing.subscriptions.getByCustomerId()` actually
     * returns: qzpay-core's real mapper (`mapDrizzleSubscriptionToCore` in
     * qzpay `2.1.0`, the version pinned in this repo's `pnpm-lock.yaml`)
     * builds `QZPaySubscriptionWithHelpers` field-by-field off
     * `QZPaySubscription`'s own interface, which does not declare
     * `productDomain` — a qzpay-drizzle-only column added on top of it. Every
     * real subscription object therefore arrives with `productDomain`
     * `undefined`, never the hand-injected string the other two blocks use.
     *
     * That gap is exactly what let HOS-1176 ship and stay green for 13 days:
     * the mocks above never exercised the code path where `productDomain` is
     * missing and must be hydrated from a separate SELECT. These tests build
     * mock subscriptions WITHOUT `productDomain` — matching the real mapper's
     * output — and route the hydration read through `setHydrationRows()`
     * instead, so a regression in the recalculation service's call to
     * `hydrateSubscriptionProductDomains` fails these tests the same way it
     * fails in production: silently, as `outcome: 'failed'`.
     */
    beforeEach(() => {
        vi.clearAllMocks();
        setExecResult([]);
        setHydrationRows([]);
        mockPlanGetById.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND', message: 'plan not found by id' }
        });
        mockPlanGetBySlug.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND', message: 'plan not found' }
        });
        mockCatalogGetBySlug.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND', message: 'addon not found' }
        });
    });

    it('raises a gastronomy add-on cap when the raw subscription has no productDomain field', async () => {
        // Arrange — the addon purchase + catalogue definition, as HOS-688's
        // fixtures already model them.
        setExecResult([
            {
                addonSlug: 'extra-gastronomies-1',
                status: 'active',
                deletedAt: null,
                limitAdjustments: [{ limitKey: 'max_gastronomies', increase: 1 }]
            }
        ]);
        mockCatalogGetBySlug.mockResolvedValue({
            success: true,
            data: {
                slug: 'extra-gastronomies-1',
                affectsLimitKey: 'max_gastronomies',
                limitIncrease: 1
            }
        });
        mockPlanGetBySlug.mockResolvedValue({
            success: true,
            data: {
                id: 'plan-uuid-gastronomy',
                slug: 'gastronomy-premium',
                limits: { max_gastronomies: 1 }
            }
        });

        // The raw subscription — no `productDomain` key at all, matching the
        // real qzpay-core mapper's output.
        const mockSet = vi.fn().mockResolvedValue(undefined);
        const billing = buildMockBilling(
            [{ id: 'sub-gastro-1', status: 'active', planId: 'gastronomy-premium' }],
            { setFn: mockSet }
        );
        // The batched hydration SELECT is what actually tells the service
        // this subscription is a gastronomy one.
        setHydrationRows([{ id: 'sub-gastro-1', productDomain: 'gastronomy' }]);

        // Act
        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-realistic-gastronomy',
            limitKey: 'max_gastronomies',
            billing: billing as never,
            db: stubDb
        });

        // Assert — the cap actually moves.
        expect(result.outcome).toBe('success');
        expect(result.newMaxValue).toBe(2); // base(1) + addon(1)
        expect(mockSet).toHaveBeenCalledWith(
            expect.objectContaining({ limitKey: 'max_gastronomies', maxValue: 2 })
        );
    });

    it('raises an experience add-on cap when the raw subscription has no productDomain field', async () => {
        setExecResult([
            {
                addonSlug: 'extra-experiences-1',
                status: 'active',
                deletedAt: null,
                limitAdjustments: [{ limitKey: 'max_experiences', increase: 1 }]
            }
        ]);
        mockCatalogGetBySlug.mockResolvedValue({
            success: true,
            data: {
                slug: 'extra-experiences-1',
                affectsLimitKey: 'max_experiences',
                limitIncrease: 1
            }
        });
        mockPlanGetBySlug.mockResolvedValue({
            success: true,
            data: {
                id: 'plan-uuid-experience',
                slug: 'experience-premium',
                limits: { max_experiences: 1 }
            }
        });

        const mockSet = vi.fn().mockResolvedValue(undefined);
        const billing = buildMockBilling(
            [{ id: 'sub-exp-1', status: 'active', planId: 'experience-premium' }],
            { setFn: mockSet }
        );
        setHydrationRows([{ id: 'sub-exp-1', productDomain: 'experience' }]);

        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-realistic-experience',
            limitKey: 'max_experiences',
            billing: billing as never,
            db: stubDb
        });

        expect(result.outcome).toBe('success');
        expect(result.newMaxValue).toBe(2); // base(1) + addon(1)
        expect(mockSet).toHaveBeenCalledWith(
            expect.objectContaining({ limitKey: 'max_experiences', maxValue: 2 })
        );
    });

    it('still resolves an accommodation add-on when the raw subscription has no productDomain field (fail-open, symmetric case)', async () => {
        // The accommodation domain fails OPEN by design (subscriptionMatchesDomain),
        // so this path "worked by accident" even before HOS-1176's fix — this
        // test guards that the fix does not disturb that fail-open behaviour.
        // The hydration SELECT answers `null` here (a genuinely legacy row,
        // column exists but is NULL), which must still read as accommodation.
        setExecResult([
            {
                addonSlug: 'extra-accommodations-5',
                status: 'active',
                deletedAt: null,
                limitAdjustments: [{ limitKey: 'max_accommodations', increase: 5 }]
            }
        ]);
        mockCatalogGetBySlug.mockResolvedValue({
            success: true,
            data: {
                slug: 'extra-accommodations-5',
                affectsLimitKey: 'max_accommodations',
                limitIncrease: 5
            }
        });
        mockPlanGetBySlug.mockResolvedValue({
            success: true,
            data: {
                id: 'plan-uuid-owner',
                slug: 'owner-premium',
                limits: { max_accommodations: 3 }
            }
        });

        const mockSet = vi.fn().mockResolvedValue(undefined);
        const billing = buildMockBilling(
            [{ id: 'sub-owner-1', status: 'active', planId: 'owner-premium' }],
            { setFn: mockSet }
        );
        setHydrationRows([{ id: 'sub-owner-1', productDomain: null }]);

        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-realistic-accommodation',
            limitKey: 'max_accommodations',
            billing: billing as never,
            db: stubDb
        });

        expect(result.outcome).toBe('success');
        expect(result.newMaxValue).toBe(8); // base(3) + addon(5)
        expect(mockSet).toHaveBeenCalledWith(
            expect.objectContaining({ limitKey: 'max_accommodations', maxValue: 8 })
        );
    });
});
