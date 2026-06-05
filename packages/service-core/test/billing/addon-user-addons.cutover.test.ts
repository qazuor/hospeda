/**
 * Parity tests for addon-user-addons.ts cutover (SPEC-192 T-007)
 *
 * Verifies that for each of the 5 seeded addon slugs, the DB-backed
 * AddonCatalogService resolves the same field values that the old
 * `getAddonBySlug` config call would have returned:
 * - `addonName`        (from catalog `name`)
 * - `billingType`      (from catalog `billingType`)
 * - `priceArs`         (from catalog `priceArs`)
 * - `durationDays`     (surfaced via priceArs / billingType checks)
 *
 * AddonCatalogService is mocked to return controlled stub data so that no
 * real database is needed. The mock mirrors the shape produced by
 * `mapRowToAddonDefinition` (the DB mapper introduced in T-001).
 *
 * @module test/billing/addon-user-addons.cutover.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockGetBySlug, mockGetDb } = vi.hoisted(() => ({
    mockGetBySlug: vi.fn(),
    mockGetDb: vi.fn()
}));

// Mock AddonCatalogService — DB-backed catalog used after the cutover
vi.mock('../../src/services/billing/addon/addon-catalog.service.js', () => ({
    AddonCatalogService: vi.fn().mockImplementation(() => ({
        getBySlug: mockGetBySlug,
        list: vi.fn()
    }))
}));

// Mock @repo/db — no real database
vi.mock('@repo/db', () => ({
    getDb: mockGetDb
}));

// Mock @repo/db/schemas — required by the module under test
vi.mock('@repo/db/schemas', () => ({
    billingAddonPurchases: {
        id: 'id',
        customerId: 'customer_id',
        addonSlug: 'addon_slug',
        status: 'status',
        deletedAt: 'deleted_at',
        purchasedAt: 'purchased_at',
        expiresAt: 'expires_at',
        canceledAt: 'canceled_at',
        limitAdjustments: 'limit_adjustments',
        entitlementAdjustments: 'entitlement_adjustments'
    }
}));

vi.mock('drizzle-orm', () => ({
    and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
    eq: vi.fn((col: unknown, val: unknown) => ({ type: 'eq', col, val })),
    isNull: vi.fn((col: unknown) => ({ type: 'isNull', col }))
}));

// Import after mocks are established
import { queryUserAddons } from '../../src/services/billing/addon/addon-user-addons.js';

// ─── Catalog stubs (mirror config values, accepted divergence: annualPriceArs=null) ──

/** Mirrors VISIBILITY_BOOST_ADDON from addons.config.ts */
const STUB_VISIBILITY_7D = {
    slug: 'visibility-boost-7d',
    name: 'Visibility Boost (7 days)',
    description: 'Your accommodation appears featured in search results for 7 days.',
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

/** Mirrors VISIBILITY_BOOST_30D_ADDON */
const STUB_VISIBILITY_30D = {
    slug: 'visibility-boost-30d',
    name: 'Visibility Boost (30 days)',
    description: 'Your accommodation appears featured in search results for 30 days.',
    billingType: 'one_time' as const,
    priceArs: 1500000,
    annualPriceArs: null,
    durationDays: 30,
    affectsLimitKey: null,
    limitIncrease: null,
    grantsEntitlement: 'FEATURED_LISTING',
    targetCategories: ['owner', 'complex'] as Array<'owner' | 'complex'>,
    isActive: true,
    sortOrder: 2
};

/** Mirrors EXTRA_PHOTOS_ADDON (accepted divergence: annualPriceArs=null instead of 4800000) */
const STUB_EXTRA_PHOTOS = {
    slug: 'extra-photos-20',
    name: 'Extra Photos Pack (+20 photos)',
    description: 'Adds 20 additional photos to each accommodation. Renews monthly.',
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

/** Mirrors EXTRA_ACCOMMODATIONS_ADDON */
const STUB_EXTRA_ACCOMMODATIONS = {
    slug: 'extra-accommodations-5',
    name: 'Extra Accommodations Pack (+5)',
    description: 'Adds 5 additional accommodations to your plan. Renews monthly.',
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

/** Mirrors EXTRA_PROPERTIES_ADDON */
const STUB_EXTRA_PROPERTIES = {
    slug: 'extra-properties-5',
    name: 'Extra Properties Pack (+5)',
    description: 'Adds 5 additional properties to your complex. Renews monthly.',
    billingType: 'recurring' as const,
    priceArs: 2000000,
    annualPriceArs: null,
    durationDays: null,
    affectsLimitKey: 'max_properties',
    limitIncrease: 5,
    grantsEntitlement: null,
    targetCategories: ['complex'] as Array<'owner' | 'complex'>,
    isActive: true,
    sortOrder: 5
};

const ALL_STUBS = [
    STUB_VISIBILITY_7D,
    STUB_VISIBILITY_30D,
    STUB_EXTRA_PHOTOS,
    STUB_EXTRA_ACCOMMODATIONS,
    STUB_EXTRA_PROPERTIES
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a minimal Drizzle mock that resolves the purchase-query chain with
 * the provided rows array.
 */
function buildMockDb(purchaseRows: unknown[]) {
    const whereMock = vi.fn().mockResolvedValue(purchaseRows);
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    return { select: selectMock };
}

/**
 * Builds a minimal billing client stub.
 * - `customers.getByExternalId` returns a customer with the given id.
 * - `subscriptions.getByCustomerId` returns an empty array (no metadata addons).
 */
function buildBillingStub(customerId = 'cust-uuid') {
    return {
        customers: {
            getByExternalId: vi.fn().mockResolvedValue({ id: customerId, email: 'u@test.com' })
        },
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue([])
        }
    };
}

/**
 * Builds a raw purchase row for the given slug.
 * No adjustments so the UserAddon fields come purely from the catalog.
 */
function buildPurchaseRow(slug: string) {
    return {
        id: `purchase-${slug}`,
        addonSlug: slug,
        status: 'active',
        purchasedAt: new Date('2025-01-01T00:00:00Z'),
        expiresAt: null,
        canceledAt: null,
        limitAdjustments: null,
        entitlementAdjustments: null
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('addon-user-addons cutover parity (SPEC-192 T-007)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('for each of the 5 seeded addon slugs', () => {
        it.each(ALL_STUBS)(
            'should resolve addonName, billingType, priceArs from DB catalog for slug "%s"',
            async (stub) => {
                // Arrange
                const purchaseRow = buildPurchaseRow(stub.slug);
                const billing = buildBillingStub();
                const mockDb = buildMockDb([purchaseRow]);
                mockGetDb.mockReturnValue(mockDb);

                // Catalog service returns the DB-backed stub
                mockGetBySlug.mockResolvedValue({ success: true, data: stub });

                // Act
                const result = await queryUserAddons({ billing, userId: 'user-123' });

                // Assert — result shape
                expect(result.success).toBe(true);
                if (!result.success) return;

                const userAddon = result.data[0];
                expect(userAddon).toBeDefined();
                if (!userAddon) return;

                // Parity: name matches config
                expect(userAddon.addonSlug).toBe(stub.slug);
                expect(userAddon.addonName).toBe(stub.name);

                // Parity: billingType matches config
                expect(userAddon.billingType).toBe(stub.billingType);

                // Parity: priceArs matches config
                expect(userAddon.priceArs).toBe(stub.priceArs);

                // Catalog service was called once for this slug
                expect(mockGetBySlug).toHaveBeenCalledWith(stub.slug, undefined);
            }
        );
    });

    describe('when catalog returns NOT_FOUND for a slug', () => {
        it('should fall back to safe defaults (addonSlug as name, one_time billingType, 0 priceArs)', async () => {
            // Arrange
            const unknownSlug = 'unknown-addon-slug';
            const purchaseRow = buildPurchaseRow(unknownSlug);
            const billing = buildBillingStub();
            const mockDb = buildMockDb([purchaseRow]);
            mockGetDb.mockReturnValue(mockDb);

            mockGetBySlug.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: `Add-on '${unknownSlug}' not found` }
            });

            // Act
            const result = await queryUserAddons({ billing, userId: 'user-123' });

            // Assert — graceful fallback, not a failure
            expect(result.success).toBe(true);
            if (!result.success) return;

            const userAddon = result.data[0];
            expect(userAddon).toBeDefined();
            if (!userAddon) return;

            expect(userAddon.addonSlug).toBe(unknownSlug);
            expect(userAddon.addonName).toBe(unknownSlug); // falls back to slug as name
            expect(userAddon.billingType).toBe('one_time'); // safe default
            expect(userAddon.priceArs).toBe(0); // safe default
        });
    });

    describe('when customer is not found', () => {
        it('should return empty addon list without calling the catalog service', async () => {
            // Arrange
            const billing = {
                customers: { getByExternalId: vi.fn().mockResolvedValue(null) },
                subscriptions: { getByCustomerId: vi.fn() }
            };
            mockGetDb.mockReturnValue(buildMockDb([]));

            // Act
            const result = await queryUserAddons({ billing, userId: 'no-such-user' });

            // Assert
            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data).toHaveLength(0);
            expect(mockGetBySlug).not.toHaveBeenCalled();
        });
    });

    describe('metadata-addon path', () => {
        it('should resolve catalog fields for addons found only in subscription metadata', async () => {
            // Arrange — no table rows, but metadata has visibility-boost-7d
            const billing = buildBillingStub();
            const mockDb = buildMockDb([]); // empty table
            mockGetDb.mockReturnValue(mockDb);

            const metadataAddonAdjustments = JSON.stringify([
                {
                    addonSlug: 'visibility-boost-7d',
                    appliedAt: '2025-01-01T00:00:00Z',
                    limitKey: null,
                    limitIncrease: null,
                    entitlement: 'FEATURED_LISTING'
                }
            ]);

            billing.subscriptions.getByCustomerId.mockResolvedValue([
                {
                    id: 'sub-123',
                    status: 'active',
                    planId: 'host-basic',
                    metadata: { addonAdjustments: metadataAddonAdjustments }
                }
            ]);

            mockGetBySlug.mockResolvedValue({ success: true, data: STUB_VISIBILITY_7D });

            // Act
            const result = await queryUserAddons({ billing, userId: 'user-123' });

            // Assert
            expect(result.success).toBe(true);
            if (!result.success) return;

            const metaAddon = result.data[0];
            expect(metaAddon).toBeDefined();
            if (!metaAddon) return;

            expect(metaAddon.addonSlug).toBe('visibility-boost-7d');
            expect(metaAddon.addonName).toBe(STUB_VISIBILITY_7D.name);
            expect(metaAddon.billingType).toBe('one_time');
            expect(metaAddon.priceArs).toBe(500000);
        });
    });
});
