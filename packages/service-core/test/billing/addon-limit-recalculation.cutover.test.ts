/**
 * Parity tests for addon-limit-recalculation.service.ts cutover (SPEC-192 T-008)
 *
 * Verifies that for each of the 5 seeded addon slugs the DB-backed
 * AddonCatalogService resolves `affectsLimitKey` and `limitIncrease` with the
 * same values that the old `getAddonBySlug` config call returned.
 *
 * The test exercises:
 * - Limit-affecting addons (extra-photos-20, extra-accommodations-5,
 *   extra-properties-5): relevantPurchases is populated and total increment
 *   is computed correctly.
 * - Entitlement-only addons (visibility-boost-7d, visibility-boost-30d):
 *   relevantPurchases is empty, so totalAddonIncrement === 0 and the "remove"
 *   branch fires.
 *
 * No real database is used. All DB and external calls are mocked.
 *
 * @module test/billing/addon-limit-recalculation.cutover.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// CI flake guard: this mock-heavy suite is fast locally (all tests < 300ms) but
// the first test of the file regularly exceeds the 5s default under shard
// contention on the self-hosted runner (two unrelated PRs hit the timeout on
// 2026-06-06). A generous ceiling still catches genuine hangs.
vi.setConfig({ testTimeout: 15_000 });

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockGetBySlug, mockWithTransaction, mockPlanGetById, mockPlanGetBySlug } = vi.hoisted(
    () => ({
        mockGetBySlug: vi.fn(),
        mockWithTransaction: vi.fn(),
        mockPlanGetById: vi.fn(),
        mockPlanGetBySlug: vi.fn()
    })
);

// Mock AddonCatalogService — DB-backed after cutover
vi.mock('../../src/services/billing/addon/addon-catalog.service.js', () => ({
    AddonCatalogService: vi.fn().mockImplementation(() => ({
        getBySlug: mockGetBySlug,
        list: vi.fn()
    }))
}));

// Mock @repo/db — withTransaction must execute the callback synchronously
vi.mock('@repo/db', () => ({
    withTransaction: mockWithTransaction,
    sql: Object.assign(
        vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
            type: 'sql',
            strings,
            values
        })),
        { raw: vi.fn() }
    )
}));

// Mock PlanService — DB-backed after T-027 cutover
vi.mock('../../src/services/billing/plan/plan.service.js', () => ({
    PlanService: vi.fn().mockImplementation(() => ({
        getById: mockPlanGetById,
        getBySlug: mockPlanGetBySlug
    }))
}));

// Mock @repo/billing — getPlanBySlug no longer used after T-027 cutover
vi.mock('@repo/billing', () => ({
    getPlanBySlug: vi.fn()
}));

vi.mock('../../src/services/billing/addon/addon-lifecycle.constants.js', () => ({
    ADDON_RECALC_SOURCE_ID: 'addon-recalc-source'
}));

// Import after mocks
import { recalculateAddonLimitsForCustomer } from '../../src/services/billing/addon/addon-limit-recalculation.service.js';

// ─── Catalog stubs (parity with addons.config.ts, accepted divergence: annualPriceArs=null) ──

const CATALOG_STUBS: Record<
    string,
    {
        slug: string;
        affectsLimitKey: string | null;
        limitIncrease: number | null;
        name: string;
        billingType: 'one_time' | 'recurring';
        priceArs: number;
        annualPriceArs: null;
        durationDays: number | null;
        grantsEntitlement: string | null;
        targetCategories: Array<'owner' | 'complex'>;
        isActive: boolean;
        sortOrder: number;
        description: string;
    }
> = {
    'visibility-boost-7d': {
        slug: 'visibility-boost-7d',
        name: 'Visibility Boost (7 days)',
        description: 'Featured in search results for 7 days.',
        billingType: 'one_time',
        priceArs: 500000,
        annualPriceArs: null,
        durationDays: 7,
        affectsLimitKey: null,
        limitIncrease: null,
        grantsEntitlement: 'FEATURED_LISTING',
        targetCategories: ['owner', 'complex'],
        isActive: true,
        sortOrder: 1
    },
    'visibility-boost-30d': {
        slug: 'visibility-boost-30d',
        name: 'Visibility Boost (30 days)',
        description: 'Featured in search results for 30 days.',
        billingType: 'one_time',
        priceArs: 1500000,
        annualPriceArs: null,
        durationDays: 30,
        affectsLimitKey: null,
        limitIncrease: null,
        grantsEntitlement: 'FEATURED_LISTING',
        targetCategories: ['owner', 'complex'],
        isActive: true,
        sortOrder: 2
    },
    'extra-photos-20': {
        slug: 'extra-photos-20',
        name: 'Extra Photos Pack (+20 photos)',
        description: 'Adds 20 additional photos per accommodation.',
        billingType: 'recurring',
        priceArs: 500000,
        annualPriceArs: null,
        durationDays: null,
        affectsLimitKey: 'max_photos_per_accommodation',
        limitIncrease: 20,
        grantsEntitlement: null,
        targetCategories: ['owner', 'complex'],
        isActive: true,
        sortOrder: 3
    },
    'extra-accommodations-5': {
        slug: 'extra-accommodations-5',
        name: 'Extra Accommodations Pack (+5)',
        description: 'Adds 5 additional accommodations.',
        billingType: 'recurring',
        priceArs: 1000000,
        annualPriceArs: null,
        durationDays: null,
        affectsLimitKey: 'max_accommodations',
        limitIncrease: 5,
        grantsEntitlement: null,
        targetCategories: ['owner'],
        isActive: true,
        sortOrder: 4
    },
    'extra-properties-5': {
        slug: 'extra-properties-5',
        name: 'Extra Properties Pack (+5)',
        description: 'Adds 5 additional properties.',
        billingType: 'recurring',
        priceArs: 2000000,
        annualPriceArs: null,
        durationDays: null,
        affectsLimitKey: 'max_properties',
        limitIncrease: 5,
        grantsEntitlement: null,
        targetCategories: ['complex'],
        isActive: true,
        sortOrder: 5
    }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Wires `mockWithTransaction` to immediately invoke the callback with a
 * minimal transaction mock that simulates `execute()` returning `rows`.
 */
function wireTxWithRows(rows: unknown[]) {
    mockWithTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const fakeTx = {
            execute: vi.fn().mockResolvedValue({ rows })
        };
        return callback(fakeTx);
    });
}

/**
 * Wires `PlanService.getById`/`getBySlug` to return a plan with the given limit for `limitKey`.
 *
 * Post-T-027: plan reads use PlanService dual-resolve (getById → getBySlug fallback).
 * The DB `limits` shape is `Record<string,number>` (not `LimitDefinition[]`).
 * getById returns NOT_FOUND so the fallback getBySlug is exercised.
 */
function wirePlan(limitKey: string, basePlanLimit: number) {
    mockPlanGetById.mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'not found' }
    });
    mockPlanGetBySlug.mockResolvedValue({
        success: true,
        data: {
            id: 'plan-uuid',
            slug: 'host-basic',
            name: 'Host Basic',
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
            /** DB shape: Record<string,number> */
            limits: { [limitKey]: basePlanLimit },
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z'
        }
    });
}

/**
 * Wires `mockGetBySlug` to return the catalog stub for a given slug.
 */
function wireCatalog(slug: string) {
    const stub = CATALOG_STUBS[slug];
    mockGetBySlug.mockImplementation(async (s: string) => {
        const found = CATALOG_STUBS[s];
        if (found) return { success: true, data: found };
        return { success: false, error: { code: 'NOT_FOUND', message: `not found: ${s}` } };
    });
    return stub;
}

/**
 * Minimal billing stub: active subscription with the given planId.
 */
function buildBilling(planId = 'host-basic') {
    return {
        subscriptions: {
            getByCustomerId: vi
                .fn()
                .mockResolvedValue([{ id: 'sub-uuid', status: 'active', planId }])
        },
        limits: {
            set: vi.fn().mockResolvedValue(undefined),
            removeBySource: vi.fn().mockResolvedValue(undefined)
        }
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('addon-limit-recalculation cutover parity (SPEC-192 T-008)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('limit-affecting addons', () => {
        it.each([
            ['extra-photos-20', 'max_photos_per_accommodation', 20, 10],
            ['extra-accommodations-5', 'max_accommodations', 5, 5],
            ['extra-properties-5', 'max_properties', 5, 3]
        ])(
            'slug "%s": resolves affectsLimitKey=%s, limitIncrease=%d, basePlan=%d → success',
            async (slug, limitKey, limitIncrease, basePlanLimit) => {
                // Arrange
                wireCatalog(slug);
                wirePlan(limitKey, basePlanLimit);

                // Step 6 reads increment from purchase.limitAdjustments (JSONB), not catalog
                const purchaseRow = {
                    addonSlug: slug,
                    id: `purchase-${slug}`,
                    status: 'active',
                    limitAdjustments: [{ limitKey, increase: limitIncrease }]
                };
                wireTxWithRows([purchaseRow]);

                const billing = buildBilling();

                // Act
                const result = await recalculateAddonLimitsForCustomer({
                    customerId: 'cust-uuid',
                    limitKey,
                    billing: billing as never,
                    db: {} as never
                });

                // Assert
                expect(result.outcome).toBe('success');
                expect(result.limitKey).toBe(limitKey);
                expect(result.addonCount).toBe(1);
                // newMaxValue = basePlanLimit + limitIncrease
                expect(result.newMaxValue).toBe(basePlanLimit + limitIncrease);
                expect(result.oldMaxValue).toBe(basePlanLimit);

                // billing.limits.set was called with the correct values
                expect(billing.limits.set).toHaveBeenCalledWith(
                    expect.objectContaining({
                        customerId: 'cust-uuid',
                        limitKey,
                        maxValue: basePlanLimit + limitIncrease
                    })
                );
            }
        );
    });

    describe('entitlement-only addons (no affectsLimitKey)', () => {
        it.each(['visibility-boost-7d', 'visibility-boost-30d'])(
            'slug "%s": not relevant to any limitKey → addonCount=0, removeBySource called',
            async (slug) => {
                // Arrange — the query is for a limit key the entitlement addon doesn't affect
                wireCatalog(slug);
                wirePlan('max_accommodations', 5);

                const purchaseRow = { addonSlug: slug, id: `purchase-${slug}`, status: 'active' };
                wireTxWithRows([purchaseRow]);

                const billing = buildBilling();

                // Act
                const result = await recalculateAddonLimitsForCustomer({
                    customerId: 'cust-uuid',
                    limitKey: 'max_accommodations',
                    billing: billing as never,
                    db: {} as never
                });

                // Assert — no relevant purchases, so removeBySource is called
                expect(result.outcome).toBe('success');
                expect(result.addonCount).toBe(0);
                expect(result.newMaxValue).toBe(5); // basePlanLimit + 0
                expect(billing.limits.set).not.toHaveBeenCalled();
                expect(billing.limits.removeBySource).toHaveBeenCalledOnce();
            }
        );
    });

    describe('when catalog returns NOT_FOUND for a purchase slug', () => {
        it('should treat the purchase as non-relevant (addonDef=null, filtered out)', async () => {
            // Arrange
            mockGetBySlug.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: 'unknown slug' }
            });
            wirePlan('max_accommodations', 5);

            const purchaseRow = {
                addonSlug: 'unknown-slug',
                id: 'purchase-unknown',
                status: 'active'
            };
            wireTxWithRows([purchaseRow]);

            const billing = buildBilling();

            // Act
            const result = await recalculateAddonLimitsForCustomer({
                customerId: 'cust-uuid',
                limitKey: 'max_accommodations',
                billing: billing as never,
                db: {} as never
            });

            // Assert — unknown slugs are filtered out (null addonDef.affectsLimitKey !== limitKey)
            expect(result.outcome).toBe('success');
            expect(result.addonCount).toBe(0);
            expect(billing.limits.removeBySource).toHaveBeenCalledOnce();
        });
    });

    describe('when no active subscription is found', () => {
        it('should return outcome=failed', async () => {
            // Arrange
            wireCatalog('extra-accommodations-5');
            wireTxWithRows([{ addonSlug: 'extra-accommodations-5', id: 'p1', status: 'active' }]);

            const billing = {
                subscriptions: { getByCustomerId: vi.fn().mockResolvedValue([]) },
                limits: { set: vi.fn(), removeBySource: vi.fn() }
            };

            // Act
            const result = await recalculateAddonLimitsForCustomer({
                customerId: 'cust-uuid',
                limitKey: 'max_accommodations',
                billing: billing as never,
                db: {} as never
            });

            // Assert
            expect(result.outcome).toBe('failed');
            expect(result.reason).toContain('no subscriptions');
        });
    });
});
