/**
 * Parity tests for addon-entitlement.service.ts addon reads cutover (SPEC-192 T-012)
 *
 * Verifies that `applyAddonEntitlements` and `removeAddonEntitlements` now
 * resolve addon definitions via the DB-backed AddonCatalogService, returning
 * the same field values that the old `getAddonBySlug` config call would have:
 * - `grantsEntitlement`  (used to decide entitlement grant vs limit set path)
 * - `affectsLimitKey`    (used in the limit set path)
 * - `limitIncrease`      (used to sum total increment per active purchase)
 * - `durationDays`       (used to compute expiresAt for entitlement addons)
 *
 * Also verifies that `ALL_PLANS` / plan reads are NOT touched (still config-backed).
 *
 * All DB and QZPay calls are mocked. No real database.
 *
 * @module test/services/addon-entitlement.cutover.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockGetBySlug, mockPlanGetById, mockPlanGetBySlug } = vi.hoisted(() => ({
    mockGetBySlug: vi.fn(),
    mockPlanGetById: vi.fn(),
    mockPlanGetBySlug: vi.fn()
}));

// Mock AddonCatalogService (DB-backed after T-012 cutover; addon reads only)
// PlanService added for T-025 plan-reads cutover (getById+getBySlug dual-resolve)
vi.mock('@repo/service-core', () => ({
    AddonCatalogService: vi.fn().mockImplementation(() => ({
        getBySlug: mockGetBySlug,
        list: vi.fn()
    })),
    PlanService: vi.fn().mockImplementation(() => ({
        getById: mockPlanGetById,
        getBySlug: mockPlanGetBySlug
    }))
}));

// Plan reads are now DB-backed via PlanService (SPEC-192 T-025 cutover)
vi.mock('@repo/billing', () => ({
    // ALL_PLANS intentionally empty — plan reads no longer go through config
    ALL_PLANS: []
}));

vi.mock('@repo/db', () => ({
    getDb: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([])
            })
        })
    })
}));

vi.mock('@repo/db/schemas', () => ({
    billingAddonPurchases: {
        id: 'id',
        customerId: 'customer_id',
        addonSlug: 'addon_slug',
        status: 'status',
        deletedAt: 'deleted_at'
    }
}));

vi.mock('drizzle-orm', () => ({
    and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
    eq: vi.fn((col: unknown, val: unknown) => ({ type: 'eq', col, val })),
    isNull: vi.fn((col: unknown) => ({ type: 'isNull', col }))
}));

vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

// Import after mocks
import { AddonEntitlementService } from '../../src/services/addon-entitlement.service';

// ─── Catalog stubs ────────────────────────────────────────────────────────────

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

const STUB_EXTRA_PHOTOS = {
    slug: 'extra-photos-20',
    name: 'Extra Photos Pack (+20 photos)',
    description: 'Adds 20 additional photos per accommodation.',
    billingType: 'recurring' as const,
    priceArs: 500000,
    annualPriceArs: null,
    durationDays: null,
    affectsLimitKey: 'max_photos_per_accommodation',
    limitIncrease: 20,
    grantsEntitlement: null,
    targetCategories: ['owner', 'complex'] as Array<'owner' | 'complex'>,
    isActive: true,
    sortOrder: 3
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildBilling() {
    return {
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue([
                {
                    id: 'sub-uuid',
                    status: 'active',
                    planId: 'host-basic',
                    metadata: {}
                }
            ]),
            update: vi.fn().mockResolvedValue({})
        },
        entitlements: {
            grant: vi.fn().mockResolvedValue(undefined),
            revoke: vi.fn().mockResolvedValue(undefined),
            revokeBySource: vi.fn().mockResolvedValue(1)
        },
        limits: {
            set: vi.fn().mockResolvedValue(undefined),
            remove: vi.fn().mockResolvedValue(undefined),
            removeBySource: vi.fn().mockResolvedValue(1)
        }
    } as never;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('addon-entitlement.service cutover parity (SPEC-192 T-012)', () => {
    let service: AddonEntitlementService;
    let billing: ReturnType<typeof buildBilling>;

    /** Stub DB plan response (limits as Record<string,number>, per BillingPlanResponse) */
    const STUB_DB_PLAN = {
        id: 'plan-uuid-001',
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
        limits: { max_accommodations: 5, max_photos_per_accommodation: 10 },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
    };

    beforeEach(() => {
        vi.clearAllMocks();
        billing = buildBilling();
        service = new AddonEntitlementService(billing);
        // Default: getById returns NOT_FOUND so getBySlug fallback is used
        mockPlanGetById.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND', message: 'not found' }
        });
        mockPlanGetBySlug.mockResolvedValue({ success: true, data: STUB_DB_PLAN });
    });

    describe('applyAddonEntitlements — addon reads via AddonCatalogService', () => {
        describe('entitlement-granting addons (grantsEntitlement non-null)', () => {
            it.each([
                ['visibility-boost-7d', STUB_VISIBILITY_7D, 'FEATURED_LISTING'],
                [
                    'visibility-boost-30d',
                    {
                        ...STUB_VISIBILITY_7D,
                        slug: 'visibility-boost-30d',
                        name: 'Visibility Boost (30 days)',
                        durationDays: 30,
                        sortOrder: 2
                    },
                    'FEATURED_LISTING'
                ]
            ])(
                'slug "%s": catalog resolves grantsEntitlement=%s → billing.entitlements.grant() called',
                async (slug, stub, expectedEntitlement) => {
                    // Arrange
                    mockGetBySlug.mockResolvedValue({ success: true, data: stub });

                    // Act
                    const result = await service.applyAddonEntitlements({
                        customerId: 'cust-uuid',
                        addonSlug: slug,
                        purchaseId: `purchase-${slug}`
                    });

                    // Assert
                    expect(result.success).toBe(true);
                    expect(mockGetBySlug).toHaveBeenCalledWith(slug);
                    expect(billing.entitlements.grant).toHaveBeenCalledWith(
                        expect.objectContaining({
                            customerId: 'cust-uuid',
                            entitlementKey: expectedEntitlement
                        })
                    );
                    expect(billing.limits.set).not.toHaveBeenCalled();
                }
            );
        });

        describe('limit-affecting addons (affectsLimitKey non-null)', () => {
            it.each([
                ['extra-accommodations-5', STUB_EXTRA_ACCOMMODATIONS, 'max_accommodations', 5],
                ['extra-photos-20', STUB_EXTRA_PHOTOS, 'max_photos_per_accommodation', 20]
            ])(
                'slug "%s": catalog resolves affectsLimitKey=%s → billing.limits.set() called',
                async (slug, stub, limitKey, _limitIncrease) => {
                    // Arrange — catalog returns the stub for getBySlug calls
                    // (first call: for the primary addon, subsequent: for allActivePurchases loop)
                    mockGetBySlug.mockResolvedValue({ success: true, data: stub });

                    // Act
                    const result = await service.applyAddonEntitlements({
                        customerId: 'cust-uuid',
                        addonSlug: slug,
                        purchaseId: `purchase-${slug}`
                    });

                    // Assert
                    expect(result.success).toBe(true);
                    expect(mockGetBySlug).toHaveBeenCalledWith(slug);
                    // billing.limits.set was called (allActivePurchases is empty so increment=0,
                    // but basePlanLimit > 0 so the "unlimited" skip branch doesn't fire).
                    // With allActivePurchases=[], totalIncrement=0, newMaxValue=basePlanLimit.
                    expect(billing.limits.set).toHaveBeenCalledWith(
                        expect.objectContaining({
                            customerId: 'cust-uuid',
                            limitKey
                        })
                    );
                    expect(billing.entitlements.grant).not.toHaveBeenCalled();
                }
            );
        });

        describe('when catalog returns NOT_FOUND', () => {
            it('should return NOT_FOUND without calling billing APIs', async () => {
                // Arrange
                mockGetBySlug.mockResolvedValue({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'unknown-slug not found' }
                });

                // Act
                const result = await service.applyAddonEntitlements({
                    customerId: 'cust-uuid',
                    addonSlug: 'unknown-slug',
                    purchaseId: 'purchase-unknown'
                });

                // Assert
                expect(result.success).toBe(false);
                if (result.success) return;
                expect(result.error.code).toBe('NOT_FOUND');
                expect(billing.entitlements.grant).not.toHaveBeenCalled();
                expect(billing.limits.set).not.toHaveBeenCalled();
            });
        });
    });

    describe('removeAddonEntitlements — addon reads via AddonCatalogService', () => {
        it('entitlement addon: catalog resolves grantsEntitlement → revokeBySource called', async () => {
            // Arrange
            mockGetBySlug.mockResolvedValue({ success: true, data: STUB_VISIBILITY_7D });

            // Act
            const result = await service.removeAddonEntitlements({
                customerId: 'cust-uuid',
                addonSlug: 'visibility-boost-7d',
                purchaseId: 'purchase-visibility-boost-7d'
            });

            // Assert
            expect(result.success).toBe(true);
            expect(mockGetBySlug).toHaveBeenCalledWith('visibility-boost-7d');
            expect(billing.entitlements.revokeBySource).toHaveBeenCalledWith(
                'addon',
                'purchase-visibility-boost-7d'
            );
        });

        it('limit addon: catalog resolves affectsLimitKey → removeBySource called', async () => {
            // Arrange
            mockGetBySlug.mockResolvedValue({ success: true, data: STUB_EXTRA_ACCOMMODATIONS });

            // Act
            const result = await service.removeAddonEntitlements({
                customerId: 'cust-uuid',
                addonSlug: 'extra-accommodations-5',
                purchaseId: 'purchase-extra-accommodations-5'
            });

            // Assert
            expect(result.success).toBe(true);
            expect(mockGetBySlug).toHaveBeenCalledWith('extra-accommodations-5');
            expect(billing.limits.removeBySource).toHaveBeenCalledWith(
                'addon',
                'purchase-extra-accommodations-5'
            );
        });

        it('when catalog returns NOT_FOUND → returns NOT_FOUND error', async () => {
            // Arrange
            mockGetBySlug.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: 'unknown-slug not found' }
            });

            // Act
            const result = await service.removeAddonEntitlements({
                customerId: 'cust-uuid',
                addonSlug: 'unknown-slug',
                purchaseId: 'purchase-unknown'
            });

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('NOT_FOUND');
        });
    });

    describe('plan reads are now DB-backed via PlanService (SPEC-192 T-025 cutover)', () => {
        it('base plan limit comes from PlanService.getBySlug (DB-backed), not ALL_PLANS', async () => {
            // Arrange — limit addon: catalog returns limitIncrease=5
            mockGetBySlug.mockResolvedValue({ success: true, data: STUB_EXTRA_ACCOMMODATIONS });
            // getById fails → getBySlug fallback returns STUB_DB_PLAN with max_accommodations=5
            mockPlanGetById.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: 'not found' }
            });
            mockPlanGetBySlug.mockResolvedValue({ success: true, data: STUB_DB_PLAN });

            // Act
            const result = await service.applyAddonEntitlements({
                customerId: 'cust-uuid',
                addonSlug: 'extra-accommodations-5',
                purchaseId: 'purchase-extra-accommodations-5'
            });

            // Assert — billing.limits.set was called with newMaxValue=basePlanLimit+0 (no purchases in DB)
            // basePlanLimit for max_accommodations is 5 (from mocked PlanService DB response)
            expect(result.success).toBe(true);
            // PlanService was used (ALL_PLANS is empty — would yield 0 if still used)
            expect(mockPlanGetBySlug).toHaveBeenCalledWith('host-basic');
            expect(billing.limits.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    limitKey: 'max_accommodations',
                    maxValue: 5 // basePlanLimit=5 from DB + totalIncrement=0 (empty allActivePurchases)
                })
            );
        });
    });
});
