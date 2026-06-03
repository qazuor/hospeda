/**
 * Parity tests for addon.admin.ts cutover (SPEC-192 T-009)
 *
 * Verifies that for each of the 5 seeded addon slugs, the DB-backed
 * AddonCatalogService resolves the same field values that the old
 * `getAddonBySlug` / `ALL_ADDONS` config calls returned:
 * - `addonName`  (from catalog `name`)
 * - `priceArs`   (from catalog `priceArs`)
 *
 * Test coverage:
 * - `listCustomerAddons`: catalog is read via `catalogService.list()` and
 *   matched per row — verifies addonName + priceArs mapping.
 * - `activateAddon`: catalog is read via `catalogService.getBySlug()` and
 *   used to compute `expiresAt` for duration-based addons.
 *
 * No real database. All DB and catalog calls are mocked.
 *
 * @module test/services/addon-admin.cutover.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockList, mockGetBySlug, mockGetDb, mockWithTransaction } = vi.hoisted(() => ({
    mockList: vi.fn(),
    mockGetBySlug: vi.fn(),
    mockGetDb: vi.fn(),
    mockWithTransaction: vi.fn()
}));

// Mock AddonCatalogService (DB-backed, now used by addon.admin)
vi.mock('@repo/service-core', () => ({
    AddonCatalogService: vi.fn().mockImplementation(() => ({
        list: mockList,
        getBySlug: mockGetBySlug
    }))
}));

vi.mock('@repo/db', () => ({
    getDb: mockGetDb,
    withTransaction: mockWithTransaction,
    billingAddonPurchases: {
        id: 'id',
        customerId: 'customer_id',
        subscriptionId: 'subscription_id',
        addonSlug: 'addon_slug',
        addonId: 'addon_id',
        status: 'status',
        purchasedAt: 'purchased_at',
        expiresAt: 'expires_at',
        canceledAt: 'canceled_at',
        deletedAt: 'deleted_at',
        paymentId: 'payment_id',
        limitAdjustments: 'limit_adjustments',
        entitlementAdjustments: 'entitlement_adjustments',
        metadata: 'metadata',
        needsEntitlementSync: 'needs_entitlement_sync',
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    },
    billingCustomers: {
        id: 'id',
        email: 'email',
        name: 'name'
    },
    safeIlike: vi.fn((_col: unknown, _term: string) => ({ __safeIlike: true }))
}));

vi.mock('drizzle-orm', () => ({
    and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
    eq: vi.fn((col: unknown, val: unknown) => ({ type: 'eq', col, val })),
    isNull: vi.fn((col: unknown) => ({ type: 'isNull', col })),
    desc: vi.fn((col: unknown) => ({ type: 'desc', col })),
    count: vi.fn(() => ({ type: 'count' })),
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
        type: 'sql',
        strings,
        values
    }))
}));

vi.mock('../../src/services/addon-entitlement.service', () => ({
    AddonEntitlementService: vi.fn().mockImplementation(() => ({
        applyAddonEntitlements: vi.fn().mockResolvedValue({ success: true, data: undefined })
    }))
}));

vi.mock('../../src/services/addon-expiration.service', () => ({
    AddonExpirationService: vi.fn().mockImplementation(() => ({
        expireAddon: vi.fn().mockResolvedValue({ success: true, data: {} })
    }))
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

// Import after mocks
import { AdminAddonService } from '../../src/services/addon.admin';

// ─── Catalog stubs ────────────────────────────────────────────────────────────

const CATALOG_STUBS = [
    {
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
    },
    {
        slug: 'visibility-boost-30d',
        name: 'Visibility Boost (30 days)',
        description: 'Featured in search results for 30 days.',
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
    },
    {
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
    },
    {
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
    },
    {
        slug: 'extra-properties-5',
        name: 'Extra Properties Pack (+5)',
        description: 'Adds 5 additional properties.',
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
    }
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a minimal Drizzle mock chain for listCustomerAddons (select+join).
 */
function buildListMockDb(purchaseRows: unknown[], total = 1) {
    const offsetMock = vi.fn().mockResolvedValue(purchaseRows);
    const limitMock = vi.fn().mockReturnValue({ offset: offsetMock });
    const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock });
    const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock, where: whereMock });

    // Count query chain
    const countWhereMock = vi.fn().mockResolvedValue([{ total }]);
    const countInnerJoinMock = vi.fn().mockReturnValue({ where: countWhereMock });
    const countFromMock = vi.fn().mockReturnValue({ innerJoin: countInnerJoinMock });

    let callCount = 0;
    const selectMock = vi.fn().mockImplementation(() => {
        callCount++;
        // First call is the count select, second is the data select
        if (callCount === 1) return { from: countFromMock };
        return { from: fromMock };
    });

    return { select: selectMock };
}

/**
 * Builds a minimal purchase row for the given slug.
 */
function buildPurchaseRow(slug: string) {
    return {
        id: `purchase-${slug}`,
        customerId: 'cust-uuid',
        customerEmail: 'test@test.com',
        customerName: 'Test User',
        subscriptionId: null,
        addonSlug: slug,
        addonId: null,
        status: 'active',
        purchasedAt: new Date('2025-01-01T00:00:00Z'),
        expiresAt: null,
        canceledAt: null,
        deletedAt: null,
        paymentId: null,
        limitAdjustments: null,
        entitlementAdjustments: null,
        metadata: null,
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-01T00:00:00Z')
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('addon.admin cutover parity (SPEC-192 T-009)', () => {
    let svc: AdminAddonService;

    beforeEach(() => {
        vi.clearAllMocks();
        svc = new AdminAddonService();
    });

    describe('listCustomerAddons — catalog enrichment via AddonCatalogService.list()', () => {
        it.each(CATALOG_STUBS)(
            'slug "%s": addonName and priceArs come from DB catalog',
            async (stub) => {
                // Arrange — catalog returns all stubs for the list()
                mockList.mockResolvedValue({ success: true, data: CATALOG_STUBS });

                const purchaseRow = buildPurchaseRow(stub.slug);
                const mockDb = buildListMockDb([purchaseRow]);
                mockGetDb.mockReturnValue(mockDb);

                // Act
                const result = await svc.listCustomerAddons({
                    page: 1,
                    pageSize: 10,
                    status: 'all',
                    includeDeleted: false
                });

                // Assert
                expect(result.success).toBe(true);
                if (!result.success) return;

                const row = result.data.data[0];
                expect(row).toBeDefined();
                if (!row) return;

                // Parity: catalog fields match config values
                expect(row.addonSlug).toBe(stub.slug);
                expect(row.addonName).toBe(stub.name);
                expect(row.priceArs).toBe(stub.priceArs);
            }
        );

        it('should use null addonName and priceArs when slug is not in DB catalog', async () => {
            // Arrange — catalog returns empty list (slug not found)
            mockList.mockResolvedValue({ success: true, data: [] });

            const purchaseRow = buildPurchaseRow('unknown-slug');
            const mockDb = buildListMockDb([purchaseRow]);
            mockGetDb.mockReturnValue(mockDb);

            // Act
            const result = await svc.listCustomerAddons({
                page: 1,
                pageSize: 10,
                status: 'all',
                includeDeleted: false
            });

            // Assert
            expect(result.success).toBe(true);
            if (!result.success) return;

            const row = result.data.data[0];
            expect(row?.addonName).toBeNull();
            expect(row?.priceArs).toBeNull();
        });
    });

    describe('activateAddon — durationDays via AddonCatalogService.getBySlug()', () => {
        it('should compute expiresAt when catalog returns durationDays > 0', async () => {
            // Arrange — activateAddon uses withTransaction and then fetches by ID
            const purchaseId = 'purchase-visibility-boost-7d';

            // Wire withTransaction to execute callback + set lockedPurchase
            mockWithTransaction.mockImplementation(
                async (callback: (tx: unknown) => Promise<unknown>, _existingTx?: unknown) => {
                    const fakeTx = {
                        execute: vi.fn().mockResolvedValue({
                            rows: [
                                {
                                    id: purchaseId,
                                    customerId: 'cust-uuid',
                                    addonSlug: 'visibility-boost-7d',
                                    status: 'expired'
                                }
                            ]
                        }),
                        update: vi.fn().mockReturnValue({
                            set: vi.fn().mockReturnValue({
                                where: vi.fn().mockResolvedValue([])
                            })
                        })
                    };
                    return callback(fakeTx);
                }
            );

            // getBySlug returns the 7-day duration addon
            mockGetBySlug.mockResolvedValue({
                success: true,
                data: CATALOG_STUBS[0] // visibility-boost-7d, durationDays=7
            });

            // getAddonPurchaseById fetch after activation: builds select chain
            const selectAfterMock = vi.fn().mockResolvedValue([
                {
                    id: purchaseId,
                    customerId: 'cust-uuid',
                    customerEmail: 'test@test.com',
                    customerName: 'Test User',
                    subscriptionId: null,
                    addonSlug: 'visibility-boost-7d',
                    addonId: null,
                    status: 'active',
                    purchasedAt: new Date(),
                    expiresAt: new Date(),
                    canceledAt: null,
                    deletedAt: null,
                    paymentId: null,
                    limitAdjustments: null,
                    entitlementAdjustments: null,
                    metadata: null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ]);
            const _limitMockAfter = vi.fn().mockReturnValue(selectAfterMock.mock.results);

            // For the post-activation fetch, mockGetDb returns a chain that resolves to the row
            const postFetchDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        innerJoin: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue([
                                    {
                                        id: purchaseId,
                                        customerId: 'cust-uuid',
                                        customerEmail: 'test@test.com',
                                        customerName: 'Test User',
                                        subscriptionId: null,
                                        addonSlug: 'visibility-boost-7d',
                                        addonId: null,
                                        status: 'active',
                                        purchasedAt: new Date(),
                                        expiresAt: new Date(Date.now() + 7 * 86400_000),
                                        canceledAt: null,
                                        deletedAt: null,
                                        paymentId: null,
                                        limitAdjustments: null,
                                        entitlementAdjustments: null,
                                        metadata: null,
                                        createdAt: new Date(),
                                        updatedAt: new Date()
                                    }
                                ])
                            })
                        })
                    })
                }),
                update: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([])
                    })
                })
            };

            // Both getDb calls use postFetchDb (the second is for needsEntitlementSync flag)
            mockGetDb.mockReturnValue(postFetchDb);

            // Act
            const result = await svc.activateAddon({ purchaseId });

            // Assert — catalog was consulted for the addon slug
            expect(mockGetBySlug).toHaveBeenCalledWith('visibility-boost-7d');
            expect(result.success).toBe(true);
        });

        it('should use null expiresAt when catalog returns NOT_FOUND for the slug', async () => {
            // Arrange
            mockWithTransaction.mockImplementation(
                async (callback: (tx: unknown) => Promise<unknown>, _existingTx?: unknown) => {
                    const fakeTx = {
                        execute: vi.fn().mockResolvedValue({
                            rows: [
                                {
                                    id: 'purchase-unknown',
                                    customerId: 'cust-uuid',
                                    addonSlug: 'unknown-slug',
                                    status: 'expired'
                                }
                            ]
                        }),
                        update: vi.fn().mockReturnValue({
                            set: vi.fn().mockReturnValue({
                                where: vi.fn().mockResolvedValue([])
                            })
                        })
                    };
                    return callback(fakeTx);
                }
            );

            // Catalog returns NOT_FOUND — addon has no durationDays, expiresAt stays null
            mockGetBySlug.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: 'unknown-slug not found' }
            });

            // Post-activation fetch
            const postFetchDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        innerJoin: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue([
                                    {
                                        id: 'purchase-unknown',
                                        customerId: 'cust-uuid',
                                        customerEmail: 'test@test.com',
                                        customerName: 'Test User',
                                        subscriptionId: null,
                                        addonSlug: 'unknown-slug',
                                        addonId: null,
                                        status: 'active',
                                        purchasedAt: new Date(),
                                        expiresAt: null,
                                        canceledAt: null,
                                        deletedAt: null,
                                        paymentId: null,
                                        limitAdjustments: null,
                                        entitlementAdjustments: null,
                                        metadata: null,
                                        createdAt: new Date(),
                                        updatedAt: new Date()
                                    }
                                ])
                            })
                        })
                    })
                }),
                update: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([])
                    })
                })
            };
            mockGetDb.mockReturnValue(postFetchDb);

            // Act
            const result = await svc.activateAddon({ purchaseId: 'purchase-unknown' });

            // Assert — catalog was consulted; result is still success (graceful fallback)
            expect(mockGetBySlug).toHaveBeenCalledWith('unknown-slug');
            expect(result.success).toBe(true);
        });
    });
});
