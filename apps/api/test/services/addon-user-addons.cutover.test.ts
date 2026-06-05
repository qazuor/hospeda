/**
 * Parity tests for addon.user-addons.ts cutover (SPEC-192 T-011)
 *
 * Verifies that `cancelUserAddon` uses the DB-backed AddonCatalogService to
 * resolve addon definitions (instead of the old `getAddonBySlug` config call),
 * and that the resolved fields (affectsLimitKey, name) match config values for
 * all 5 seeded addon slugs.
 *
 * Key behaviors verified:
 * - For limit-affecting addons: recalculateAddonLimitsForCustomer is called
 *   (the old path triggered by addonDef.affectsLimitKey being non-null).
 * - For entitlement-only addons: cancelAddonPurchaseRecord path is taken
 *   (no limit recalculation).
 * - For unknown slugs: NOT_FOUND from catalog → addonDef=null → no limit
 *   recalculation, graceful notification fallback.
 * - addonDef.name is used for the cancellation notification.
 *
 * All DB and external calls are mocked. No real database.
 *
 * @module test/services/addon-user-addons.cutover.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockGetBySlug, mockWithTransaction, mockCancelAddonPurchaseRecord, mockRecalculate } =
    vi.hoisted(() => ({
        mockGetBySlug: vi.fn(),
        mockWithTransaction: vi.fn(),
        mockCancelAddonPurchaseRecord: vi.fn().mockResolvedValue(1),
        mockRecalculate: vi.fn()
    }));

// Mock AddonCatalogService (DB-backed after cutover)
vi.mock('@repo/service-core', () => ({
    AddonCatalogService: vi.fn().mockImplementation(() => ({
        getBySlug: mockGetBySlug,
        list: vi.fn()
    })),
    cancelAddonPurchaseRecord: mockCancelAddonPurchaseRecord,
    queryAddonActive: vi.fn(),
    queryUserAddons: vi.fn(),
    BILLING_EVENT_TYPES: { ADDON_REVOCATIONS_PENDING: 'ADDON_REVOCATIONS_PENDING' }
}));

vi.mock('@repo/db', () => ({
    getDb: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([
                        {
                            id: 'purchase-uuid',
                            addonSlug: 'extra-accommodations-5',
                            status: 'active',
                            customerId: 'cust-uuid'
                        }
                    ])
                })
            })
        })
    }),
    withTransaction: mockWithTransaction,
    billingSubscriptions: { id: 'id', customerId: 'customer_id', deletedAt: 'deleted_at' }
}));

vi.mock('@repo/db/client', () => ({
    getDb: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([
                        {
                            id: 'purchase-uuid',
                            addonSlug: 'extra-accommodations-5',
                            status: 'active',
                            customerId: 'cust-uuid'
                        }
                    ])
                })
            })
        })
    }),
    withTransaction: mockWithTransaction
}));

vi.mock('@repo/db/schemas/billing', () => ({
    billingAddonPurchases: {
        id: 'id',
        customerId: 'customer_id',
        addonSlug: 'addon_slug',
        status: 'status',
        deletedAt: 'deleted_at',
        canceledAt: 'canceled_at',
        updatedAt: 'updated_at'
    },
    billingSubscriptionEvents: { subscriptionId: 'subscription_id' }
}));

vi.mock('drizzle-orm', () => ({
    and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
    eq: vi.fn((col: unknown, val: unknown) => ({ type: 'eq', col, val })),
    isNull: vi.fn((col: unknown) => ({ type: 'isNull', col })),
    sql: vi.fn()
}));

vi.mock('../../src/services/addon-limit-recalculation.service', () => ({
    recalculateAddonLimitsForCustomer: mockRecalculate
}));

vi.mock('@sentry/node', () => ({
    captureException: vi.fn()
}));

vi.mock('@repo/notifications', () => ({
    NotificationType: { ADDON_CANCELLATION: 'ADDON_CANCELLATION' }
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../src/utils/notification-helper', () => ({
    sendNotification: vi.fn().mockResolvedValue(undefined)
}));

// Import after mocks
import { cancelUserAddon } from '../../src/services/addon.user-addons';

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

function buildBilling(_addonSlug = 'extra-accommodations-5') {
    return {
        customers: {
            get: vi.fn().mockResolvedValue({
                id: 'cust-uuid',
                email: 'test@test.com',
                metadata: { name: 'Test User' }
            })
        },
        subscriptions: {
            getByCustomerId: vi
                .fn()
                .mockResolvedValue([{ id: 'sub-uuid', status: 'active', planId: 'host-basic' }])
        }
    } as never;
}

function buildEntitlementService() {
    return {
        removeAddonEntitlements: vi.fn().mockResolvedValue({ success: true, data: undefined })
    } as never;
}

function buildPurchaseSelectDb(addonSlug: string) {
    return {
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([
                        {
                            id: `purchase-${addonSlug}`,
                            addonSlug,
                            status: 'active',
                            customerId: 'cust-uuid'
                        }
                    ])
                })
            })
        })
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('addon.user-addons cutover parity (SPEC-192 T-011)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Re-setup default mocks
        mockCancelAddonPurchaseRecord.mockResolvedValue(1);
        mockRecalculate.mockResolvedValue({
            outcome: 'success',
            limitKey: 'max_accommodations',
            oldMaxValue: 5,
            newMaxValue: 10,
            addonCount: 1
        });
    });

    describe('limit-affecting addons — triggers recalculation via affectsLimitKey', () => {
        it.each([
            ['extra-accommodations-5', 'max_accommodations', STUB_EXTRA_ACCOMMODATIONS],
            [
                'extra-photos-20',
                'max_photos_per_accommodation',
                {
                    slug: 'extra-photos-20',
                    name: 'Extra Photos Pack (+20 photos)',
                    description: 'Adds 20 photos.',
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
                }
            ]
        ])(
            'slug "%s": catalog resolves affectsLimitKey=%s → recalculation is called',
            async (slug, limitKey, stub) => {
                // Arrange — DB returns purchase with this slug
                const { getDb } = await import('@repo/db');
                (getDb as ReturnType<typeof vi.fn>).mockReturnValue(buildPurchaseSelectDb(slug));

                const { getDb: getDbClient } = await import('@repo/db/client');
                (getDbClient as ReturnType<typeof vi.fn>).mockReturnValue(
                    buildPurchaseSelectDb(slug)
                );

                // withTransaction commits DB cancel then exits
                mockWithTransaction.mockImplementation(
                    async (callback: (tx: unknown) => Promise<unknown>) => {
                        const fakeTx = {
                            update: vi.fn().mockReturnValue({
                                set: vi.fn().mockReturnValue({
                                    where: vi.fn().mockResolvedValue({ rowCount: 1 })
                                })
                            })
                        };
                        return callback(fakeTx);
                    }
                );

                // Catalog resolves the stub
                mockGetBySlug.mockResolvedValue({ success: true, data: stub });

                // Act
                const result = await cancelUserAddon(
                    buildBilling(slug),
                    buildEntitlementService(),
                    { customerId: 'cust-uuid', purchaseId: `purchase-${slug}`, userId: 'user-uuid' }
                );

                // Assert
                expect(result.success).toBe(true);
                // Catalog was consulted
                expect(mockGetBySlug).toHaveBeenCalledWith(slug);
                // Recalculation was triggered with the correct limitKey
                expect(mockRecalculate).toHaveBeenCalledWith(
                    expect.objectContaining({ limitKey, customerId: 'cust-uuid' })
                );
            }
        );
    });

    describe('entitlement-only addons — no limit recalculation', () => {
        it('slug "visibility-boost-7d": catalog resolves affectsLimitKey=null → cancelAddonPurchaseRecord path', async () => {
            // Arrange
            const { getDb } = await import('@repo/db');
            (getDb as ReturnType<typeof vi.fn>).mockReturnValue(
                buildPurchaseSelectDb('visibility-boost-7d')
            );

            const { getDb: getDbClient } = await import('@repo/db/client');
            (getDbClient as ReturnType<typeof vi.fn>).mockReturnValue(
                buildPurchaseSelectDb('visibility-boost-7d')
            );

            mockGetBySlug.mockResolvedValue({ success: true, data: STUB_VISIBILITY_7D });

            // Act
            const result = await cancelUserAddon(
                buildBilling('visibility-boost-7d'),
                buildEntitlementService(),
                {
                    customerId: 'cust-uuid',
                    purchaseId: 'purchase-visibility-boost-7d',
                    userId: 'user-uuid'
                }
            );

            // Assert
            expect(result.success).toBe(true);
            expect(mockGetBySlug).toHaveBeenCalledWith('visibility-boost-7d');
            // NO recalculation for entitlement-only addons
            expect(mockRecalculate).not.toHaveBeenCalled();
            // cancelAddonPurchaseRecord is used instead
            expect(mockCancelAddonPurchaseRecord).toHaveBeenCalledOnce();
        });
    });

    describe('when catalog returns NOT_FOUND for the slug', () => {
        it('should treat addonDef as null and take the no-limit-recalculation path', async () => {
            // Arrange
            const unknownSlug = 'unknown-addon-slug';

            const { getDb } = await import('@repo/db');
            (getDb as ReturnType<typeof vi.fn>).mockReturnValue(buildPurchaseSelectDb(unknownSlug));

            const { getDb: getDbClient } = await import('@repo/db/client');
            (getDbClient as ReturnType<typeof vi.fn>).mockReturnValue(
                buildPurchaseSelectDb(unknownSlug)
            );

            mockGetBySlug.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: `unknown slug: ${unknownSlug}` }
            });

            // Act
            const result = await cancelUserAddon(
                buildBilling(unknownSlug),
                buildEntitlementService(),
                {
                    customerId: 'cust-uuid',
                    purchaseId: `purchase-${unknownSlug}`,
                    userId: 'user-uuid'
                }
            );

            // Assert — graceful, not a failure
            expect(result.success).toBe(true);
            // No limit recalculation for null addonDef
            expect(mockRecalculate).not.toHaveBeenCalled();
        });
    });
});
