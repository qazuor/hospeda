/**
 * UsageTrackingService Test Suite
 *
 * Comprehensive tests for usage tracking service including:
 * - Getting usage summary with correct percentages
 * - Threshold calculation at exact boundaries
 * - Handling customers with no limits (free plan)
 * - Handling zero/unlimited limits
 * - Checking usage thresholds
 * - Getting usage for specific limits
 * - Decomposing plan base vs addon bonus
 * - Reading addon adjustments from billing_addon_purchases table
 * - Excluding soft-deleted purchases
 * - Fallback to JSON metadata when table query returns no results
 *
 * @module test/services/usage-tracking.service.test
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { LimitKey } from '@repo/billing';
import { ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { UsageTrackingService } from '../../src/services/usage-tracking.service';

/**
 * Mock the @repo/db module to prevent real database calls.
 * The mock select chain simulates Drizzle's fluent API:
 * select().from().where() -> Promise<rows[]>
 */
const mockWhere = vi.fn().mockResolvedValue([]);
const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

vi.mock('@repo/db', () => ({
    getDb: () => ({
        select: mockSelect
    }),
    // EntityViewService singleton (service-core barrel) dereferences these at import.
    AccommodationModel: vi.fn(function () {
        return { findIdsByOwnerId: vi.fn(async () => []) };
    }),
    entityViewModel: {
        insertView: vi.fn(),
        getStatsForEntities: vi.fn(async () => []),
        purgeOlderThan: vi.fn(async () => 0)
    }
}));

vi.mock('@repo/db/schemas', () => ({
    billingAddonPurchases: {
        addonSlug: 'addon_slug',
        limitAdjustments: 'limit_adjustments',
        entitlementAdjustments: 'entitlement_adjustments',
        purchasedAt: 'purchased_at',
        customerId: 'customer_id',
        status: 'status',
        deletedAt: 'deleted_at'
    }
}));

vi.mock('drizzle-orm', () => ({
    and: vi.fn((...args: unknown[]) => args),
    eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
    isNull: vi.fn((a: unknown) => ({ isNull: a }))
}));

/**
 * Helper type for accessing private members in tests.
 * Avoids repeated biome-ignore comments for noExplicitAny.
 */
type TestAccessor = Record<string, any>;

describe('UsageTrackingService', () => {
    let service: UsageTrackingService;
    let mockBilling: QZPayBilling;

    // Mock data
    const mockCustomerId = 'cust_123';
    const mockPlanId = 'plan_owner_monthly';
    const mockSubscription = {
        id: 'sub_123',
        customerId: mockCustomerId,
        planId: mockPlanId,
        status: 'active',
        metadata: {}
    };

    const mockPlan = {
        id: mockPlanId,
        name: 'Owner Monthly',
        limits: {
            [LimitKey.MAX_ACCOMMODATIONS]: 5,
            [LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]: 10,
            [LimitKey.MAX_ACTIVE_PROMOTIONS]: 2,
            [LimitKey.MAX_FAVORITES]: 20,
            [LimitKey.MAX_PROPERTIES]: 0, // Unlimited
            [LimitKey.MAX_STAFF_ACCOUNTS]: 0, // Unlimited
            // SPEC-145: two new tourist-facing limits added to LimitKey
            [LimitKey.MAX_ACTIVE_ALERTS]: 0,
            [LimitKey.MAX_COMPARE_ITEMS]: 0
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Create mock billing client
        mockBilling = {
            subscriptions: {
                getByCustomerId: vi.fn()
            },
            plans: {
                get: vi.fn()
            }
        } as unknown as QZPayBilling;

        // Create service instance
        service = new UsageTrackingService(mockBilling);

        // Default mock implementations
        (mockBilling.subscriptions.getByCustomerId as Mock).mockResolvedValue([mockSubscription]);
        (mockBilling.plans.get as Mock).mockResolvedValue(mockPlan);

        // Mock getCurrentUsage to return 0 by default
        vi.spyOn(service as unknown as TestAccessor, 'getCurrentUsage').mockResolvedValue(0);

        // Default: DB query returns empty (triggers metadata fallback)
        mockWhere.mockResolvedValue([]);
    });

    describe('getUsageSummary', () => {
        it('should return all limits with correct percentages', async () => {
            // Arrange - set different usage levels
            const usageMap: Record<string, number> = {
                [LimitKey.MAX_ACCOMMODATIONS]: 3, // 60%
                [LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]: 8, // 80%
                [LimitKey.MAX_ACTIVE_PROMOTIONS]: 2, // 100%
                [LimitKey.MAX_FAVORITES]: 5, // 25%
                [LimitKey.MAX_PROPERTIES]: 10, // Unlimited, 0%
                [LimitKey.MAX_STAFF_ACCOUNTS]: 5 // Unlimited, 0%
            };

            (service as unknown as TestAccessor).getCurrentUsage = vi.fn((limitKey: string) => {
                return Promise.resolve(usageMap[limitKey] || 0);
            });

            // Act
            const result = await service.getUsageSummary(mockCustomerId);

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data!.customerId).toBe(mockCustomerId);
            // One entry per LimitKey enum value (6 original + 4 AI keys added in SPEC-173 T-030).
            expect(result.data!.limits).toHaveLength(Object.values(LimitKey).length);

            // Check specific limit percentages
            const accommodationsLimit = result.data!.limits.find(
                (l) => l.limitKey === LimitKey.MAX_ACCOMMODATIONS
            );
            expect(accommodationsLimit?.usagePercentage).toBe(60);
            expect(accommodationsLimit?.currentUsage).toBe(3);
            expect(accommodationsLimit?.maxAllowed).toBe(5);

            const photosLimit = result.data!.limits.find(
                (l) => l.limitKey === LimitKey.MAX_PHOTOS_PER_ACCOMMODATION
            );
            expect(photosLimit?.usagePercentage).toBe(80);

            const promotionsLimit = result.data!.limits.find(
                (l) => l.limitKey === LimitKey.MAX_ACTIVE_PROMOTIONS
            );
            expect(promotionsLimit?.usagePercentage).toBe(100);
        });

        it('should calculate thresholds correctly at exact boundaries', async () => {
            // Arrange - Test exact boundary values
            const usageMap: Record<string, number> = {
                [LimitKey.MAX_ACCOMMODATIONS]: 3, // 60% - ok
                [LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]: 8, // 80% - warning
                [LimitKey.MAX_ACTIVE_PROMOTIONS]: 18, // 90% - critical (18/20)
                [LimitKey.MAX_FAVORITES]: 20, // 100% - exceeded
                [LimitKey.MAX_PROPERTIES]: 0,
                [LimitKey.MAX_STAFF_ACCOUNTS]: 0
            };

            const planWithLimits = {
                ...mockPlan,
                limits: {
                    [LimitKey.MAX_ACCOMMODATIONS]: 5, // 3/5 = 60%
                    [LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]: 10, // 8/10 = 80%
                    [LimitKey.MAX_ACTIVE_PROMOTIONS]: 20, // 18/20 = 90%
                    [LimitKey.MAX_FAVORITES]: 20, // 20/20 = 100%
                    [LimitKey.MAX_PROPERTIES]: 0,
                    [LimitKey.MAX_STAFF_ACCOUNTS]: 0
                }
            };

            (mockBilling.plans.get as Mock).mockResolvedValue(planWithLimits);
            (service as unknown as TestAccessor).getCurrentUsage = vi.fn((limitKey: string) => {
                return Promise.resolve(usageMap[limitKey] || 0);
            });

            // Act
            const result = await service.getUsageSummary(mockCustomerId);

            // Assert
            expect(result.success).toBe(true);
            const limits = result.data!.limits;

            // ok (<80%)
            const okLimit = limits.find((l) => l.limitKey === LimitKey.MAX_ACCOMMODATIONS);
            expect(okLimit?.threshold).toBe('ok');
            expect(okLimit?.usagePercentage).toBe(60);

            // warning (80-89%)
            const warningLimit = limits.find(
                (l) => l.limitKey === LimitKey.MAX_PHOTOS_PER_ACCOMMODATION
            );
            expect(warningLimit?.threshold).toBe('warning');
            expect(warningLimit?.usagePercentage).toBe(80);

            // critical (90-99%)
            const criticalLimit = limits.find((l) => l.limitKey === LimitKey.MAX_ACTIVE_PROMOTIONS);
            expect(criticalLimit?.threshold).toBe('critical');
            expect(criticalLimit?.usagePercentage).toBe(90);

            // exceeded (100%)
            const exceededLimit = limits.find((l) => l.limitKey === LimitKey.MAX_FAVORITES);
            expect(exceededLimit?.threshold).toBe('exceeded');
            expect(exceededLimit?.usagePercentage).toBe(100);
        });

        it('should handle customers with no subscription', async () => {
            // Arrange
            (mockBilling.subscriptions.getByCustomerId as Mock).mockResolvedValue([]);

            // Act
            const result = await service.getUsageSummary(mockCustomerId);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
            expect(result.error?.message).toContain('no subscription');
        });

        it('should handle zero max (unlimited) - should return 0% usage', async () => {
            // Arrange
            const usageMap: Record<string, number> = {
                [LimitKey.MAX_PROPERTIES]: 100, // Used 100, but unlimited (max=0)
                [LimitKey.MAX_STAFF_ACCOUNTS]: 50
            };

            (service as unknown as TestAccessor).getCurrentUsage = vi.fn((limitKey: string) => {
                return Promise.resolve(usageMap[limitKey] || 0);
            });

            // Act
            const result = await service.getUsageSummary(mockCustomerId);

            // Assert
            expect(result.success).toBe(true);

            const propertiesLimit = result.data!.limits.find(
                (l) => l.limitKey === LimitKey.MAX_PROPERTIES
            );
            expect(propertiesLimit?.maxAllowed).toBe(0);
            expect(propertiesLimit?.usagePercentage).toBe(0);
            expect(propertiesLimit?.threshold).toBe('ok');

            const staffLimit = result.data!.limits.find(
                (l) => l.limitKey === LimitKey.MAX_STAFF_ACCOUNTS
            );
            expect(staffLimit?.maxAllowed).toBe(0);
            expect(staffLimit?.usagePercentage).toBe(0);
            expect(staffLimit?.threshold).toBe('ok');
        });

        it('should decompose plan base vs addon bonus from DB table', async () => {
            // Arrange - DB returns active addon purchases
            mockWhere.mockResolvedValue([
                {
                    addonSlug: 'extra-accommodations',
                    limitAdjustments: [
                        {
                            limitKey: LimitKey.MAX_ACCOMMODATIONS,
                            increase: 10,
                            previousValue: 5,
                            newValue: 15
                        }
                    ],
                    entitlementAdjustments: [],
                    purchasedAt: new Date('2024-01-01')
                },
                {
                    addonSlug: 'extra-photos',
                    limitAdjustments: [
                        {
                            limitKey: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
                            increase: 20,
                            previousValue: 10,
                            newValue: 30
                        }
                    ],
                    entitlementAdjustments: [],
                    purchasedAt: new Date('2024-01-01')
                }
            ]);

            // Act
            const result = await service.getUsageSummary(mockCustomerId);

            // Assert
            expect(result.success).toBe(true);

            const accommodationsLimit = result.data!.limits.find(
                (l) => l.limitKey === LimitKey.MAX_ACCOMMODATIONS
            );
            expect(accommodationsLimit?.planBaseLimit).toBe(5);
            expect(accommodationsLimit?.addonBonusLimit).toBe(10);
            expect(accommodationsLimit?.maxAllowed).toBe(15); // 5 + 10

            const photosLimit = result.data!.limits.find(
                (l) => l.limitKey === LimitKey.MAX_PHOTOS_PER_ACCOMMODATION
            );
            expect(photosLimit?.planBaseLimit).toBe(10);
            expect(photosLimit?.addonBonusLimit).toBe(20);
            expect(photosLimit?.maxAllowed).toBe(30); // 10 + 20
        });

        it('should exclude soft-deleted purchases from addon adjustments', async () => {
            // Arrange - DB returns empty (soft-deleted records are filtered by WHERE clause)
            mockWhere.mockResolvedValue([]);

            // No metadata fallback either
            (mockBilling.subscriptions.getByCustomerId as Mock).mockResolvedValue([
                { ...mockSubscription, metadata: {} }
            ]);

            // Act
            const result = await service.getUsageSummary(mockCustomerId);

            // Assert
            expect(result.success).toBe(true);

            // All addon bonuses should be 0 since no active purchases exist
            const accommodationsLimit = result.data!.limits.find(
                (l) => l.limitKey === LimitKey.MAX_ACCOMMODATIONS
            );
            expect(accommodationsLimit?.addonBonusLimit).toBe(0);
            expect(accommodationsLimit?.maxAllowed).toBe(5); // Plan base only
        });

        it('should fallback to JSON metadata when DB query returns no results', async () => {
            // Arrange - DB returns empty, but metadata has adjustments
            mockWhere.mockResolvedValue([]);

            const subscriptionWithMetadata = {
                ...mockSubscription,
                metadata: {
                    addonAdjustments: JSON.stringify([
                        {
                            addonSlug: 'extra-accommodations',
                            limitKey: LimitKey.MAX_ACCOMMODATIONS,
                            limitIncrease: 10,
                            appliedAt: '2024-01-01'
                        }
                    ])
                }
            };

            (mockBilling.subscriptions.getByCustomerId as Mock).mockResolvedValue([
                subscriptionWithMetadata
            ]);

            // Act
            const result = await service.getUsageSummary(mockCustomerId);

            // Assert
            expect(result.success).toBe(true);

            const accommodationsLimit = result.data!.limits.find(
                (l) => l.limitKey === LimitKey.MAX_ACCOMMODATIONS
            );
            expect(accommodationsLimit?.planBaseLimit).toBe(5);
            expect(accommodationsLimit?.addonBonusLimit).toBe(10);
            expect(accommodationsLimit?.maxAllowed).toBe(15); // 5 + 10 from metadata fallback
        });

        it('should fallback to JSON metadata when DB query throws', async () => {
            // Arrange - DB throws an error
            mockWhere.mockRejectedValue(new Error('DB connection failed'));

            const subscriptionWithMetadata = {
                ...mockSubscription,
                metadata: {
                    addonAdjustments: JSON.stringify([
                        {
                            addonSlug: 'extra-accommodations',
                            limitKey: LimitKey.MAX_ACCOMMODATIONS,
                            limitIncrease: 5,
                            appliedAt: '2024-01-01'
                        }
                    ])
                }
            };

            (mockBilling.subscriptions.getByCustomerId as Mock).mockResolvedValue([
                subscriptionWithMetadata
            ]);

            // Act
            const result = await service.getUsageSummary(mockCustomerId);

            // Assert
            expect(result.success).toBe(true);

            const accommodationsLimit = result.data!.limits.find(
                (l) => l.limitKey === LimitKey.MAX_ACCOMMODATIONS
            );
            expect(accommodationsLimit?.addonBonusLimit).toBe(5); // From metadata fallback
        });

        it('should determine overall threshold as worst case', async () => {
            // Arrange - Mix of thresholds
            const usageMap: Record<string, number> = {
                [LimitKey.MAX_ACCOMMODATIONS]: 1, // ok
                [LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]: 8, // warning (80%)
                [LimitKey.MAX_ACTIVE_PROMOTIONS]: 2, // exceeded (100%)
                [LimitKey.MAX_FAVORITES]: 5 // ok
            };

            (service as unknown as TestAccessor).getCurrentUsage = vi.fn((limitKey: string) => {
                return Promise.resolve(usageMap[limitKey] || 0);
            });

            // Act
            const result = await service.getUsageSummary(mockCustomerId);

            // Assert
            expect(result.success).toBe(true);
            expect(result.data!.overallThreshold).toBe('exceeded'); // Worst case
        });

        it('should handle billing service unavailable', async () => {
            // Arrange
            const serviceWithoutBilling = new UsageTrackingService(null);

            // Act
            const result = await serviceWithoutBilling.getUsageSummary(mockCustomerId);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe(ServiceErrorCode.SERVICE_UNAVAILABLE);
            expect(result.error?.message).toContain('not configured');
        });

        it('should handle errors gracefully', async () => {
            // Arrange
            (mockBilling.subscriptions.getByCustomerId as Mock).mockRejectedValue(
                new Error('Database connection failed')
            );

            // Act
            const result = await service.getUsageSummary(mockCustomerId);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
            expect(result.error?.message).toContain('Failed to get usage summary');
        });
    });

    describe('checkUsageThreshold', () => {
        it('should return correct status for ok threshold (<80%)', async () => {
            // Arrange
            (service as unknown as TestAccessor).getCurrentUsage = vi.fn().mockResolvedValue(3); // 60%

            // Act
            const result = await service.checkUsageThreshold(
                mockCustomerId,
                LimitKey.MAX_ACCOMMODATIONS
            );

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toBe('ok');
        });

        it('should return correct status for warning threshold (80-89%)', async () => {
            // Arrange
            (service as unknown as TestAccessor).getCurrentUsage = vi.fn().mockResolvedValue(8); // 80%

            // Act
            const result = await service.checkUsageThreshold(
                mockCustomerId,
                LimitKey.MAX_PHOTOS_PER_ACCOMMODATION
            );

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toBe('warning');
        });

        it('should return correct status for critical threshold (90-99%)', async () => {
            // Arrange
            const planWithHigherLimit = {
                ...mockPlan,
                limits: {
                    ...mockPlan.limits,
                    [LimitKey.MAX_FAVORITES]: 100
                }
            };
            (mockBilling.plans.get as Mock).mockResolvedValue(planWithHigherLimit);
            (service as unknown as TestAccessor).getCurrentUsage = vi.fn().mockResolvedValue(95); // 95%

            // Act
            const result = await service.checkUsageThreshold(
                mockCustomerId,
                LimitKey.MAX_FAVORITES
            );

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toBe('critical');
        });

        it('should return correct status for exceeded threshold (100%)', async () => {
            // Arrange
            (service as unknown as TestAccessor).getCurrentUsage = vi.fn().mockResolvedValue(20); // 100%

            // Act
            const result = await service.checkUsageThreshold(
                mockCustomerId,
                LimitKey.MAX_FAVORITES
            );

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toBe('exceeded');
        });

        it('should handle errors in underlying service', async () => {
            // Arrange
            (mockBilling.subscriptions.getByCustomerId as Mock).mockRejectedValue(
                new Error('Network error')
            );

            // Act
            const result = await service.checkUsageThreshold(
                mockCustomerId,
                LimitKey.MAX_ACCOMMODATIONS
            );

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        });
    });

    describe('getUsageForLimit', () => {
        it('should return detailed usage for specific limit', async () => {
            // Arrange
            (service as unknown as TestAccessor).getCurrentUsage = vi.fn().mockResolvedValue(3);

            // Act
            const result = await service.getUsageForLimit(
                mockCustomerId,
                LimitKey.MAX_ACCOMMODATIONS
            );

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data!.limitKey).toBe(LimitKey.MAX_ACCOMMODATIONS);
            expect(result.data!.currentUsage).toBe(3);
            expect(result.data!.maxAllowed).toBe(5);
            expect(result.data!.usagePercentage).toBe(60);
            expect(result.data!.threshold).toBe('ok');
            expect(result.data!.planBaseLimit).toBe(5);
            expect(result.data!.addonBonusLimit).toBe(0);
        });

        it('should decompose plan base vs addon bonus from DB table', async () => {
            // Arrange - DB returns active addon purchase
            mockWhere.mockResolvedValue([
                {
                    addonSlug: 'extra-accommodations',
                    limitAdjustments: [
                        {
                            limitKey: LimitKey.MAX_ACCOMMODATIONS,
                            increase: 15,
                            previousValue: 5,
                            newValue: 20
                        }
                    ],
                    entitlementAdjustments: [],
                    purchasedAt: new Date('2024-01-01')
                }
            ]);

            (service as unknown as TestAccessor).getCurrentUsage = vi.fn().mockResolvedValue(10);

            // Act
            const result = await service.getUsageForLimit(
                mockCustomerId,
                LimitKey.MAX_ACCOMMODATIONS
            );

            // Assert
            expect(result.success).toBe(true);
            expect(result.data!.planBaseLimit).toBe(5);
            expect(result.data!.addonBonusLimit).toBe(15);
            expect(result.data!.maxAllowed).toBe(20); // 5 + 15
            expect(result.data!.usagePercentage).toBe(50); // 10/20
        });

        it('should fallback to metadata when DB returns empty', async () => {
            // Arrange - DB empty, metadata has adjustments
            mockWhere.mockResolvedValue([]);

            const subscriptionWithAddon = {
                ...mockSubscription,
                metadata: {
                    addonAdjustments: JSON.stringify([
                        {
                            addonSlug: 'extra-accommodations',
                            limitKey: LimitKey.MAX_ACCOMMODATIONS,
                            limitIncrease: 15,
                            appliedAt: '2024-01-01'
                        }
                    ])
                }
            };

            (mockBilling.subscriptions.getByCustomerId as Mock).mockResolvedValue([
                subscriptionWithAddon
            ]);
            (service as unknown as TestAccessor).getCurrentUsage = vi.fn().mockResolvedValue(10);

            // Act
            const result = await service.getUsageForLimit(
                mockCustomerId,
                LimitKey.MAX_ACCOMMODATIONS
            );

            // Assert
            expect(result.success).toBe(true);
            expect(result.data!.planBaseLimit).toBe(5);
            expect(result.data!.addonBonusLimit).toBe(15);
            expect(result.data!.maxAllowed).toBe(20); // 5 + 15
        });

        it('should return null for customer with no subscription', async () => {
            // Arrange
            (mockBilling.subscriptions.getByCustomerId as Mock).mockResolvedValue([]);

            // Act
            const result = await service.getUsageForLimit(
                mockCustomerId,
                LimitKey.MAX_ACCOMMODATIONS
            );

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toBeNull();
        });

        it('should return null for customer with inactive subscription', async () => {
            // Arrange
            const inactiveSubscription = {
                ...mockSubscription,
                status: 'canceled'
            };
            (mockBilling.subscriptions.getByCustomerId as Mock).mockResolvedValue([
                inactiveSubscription
            ]);

            // Act
            const result = await service.getUsageForLimit(
                mockCustomerId,
                LimitKey.MAX_ACCOMMODATIONS
            );

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toBeNull();
        });

        it('should handle billing service unavailable', async () => {
            // Arrange
            const serviceWithoutBilling = new UsageTrackingService(null);

            // Act
            const result = await serviceWithoutBilling.getUsageForLimit(
                mockCustomerId,
                LimitKey.MAX_ACCOMMODATIONS
            );

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe(ServiceErrorCode.SERVICE_UNAVAILABLE);
        });
    });

    describe('getAddonAdjustments (DB query pattern)', () => {
        it('should read addon adjustments from billing_addon_purchases table', async () => {
            // Arrange - DB returns active purchases with limit adjustments
            mockWhere.mockResolvedValue([
                {
                    addonSlug: 'extra-accommodations',
                    limitAdjustments: [
                        {
                            limitKey: LimitKey.MAX_ACCOMMODATIONS,
                            increase: 10,
                            previousValue: 5,
                            newValue: 15
                        }
                    ],
                    entitlementAdjustments: [],
                    purchasedAt: new Date('2024-06-15')
                }
            ]);

            // Act
            const result = await service.getUsageSummary(mockCustomerId);

            // Assert
            expect(result.success).toBe(true);
            expect(mockSelect).toHaveBeenCalled();

            const accommodationsLimit = result.data!.limits.find(
                (l) => l.limitKey === LimitKey.MAX_ACCOMMODATIONS
            );
            expect(accommodationsLimit?.addonBonusLimit).toBe(10);
        });

        it('should handle entitlement-only addon purchases', async () => {
            // Arrange - DB returns purchase with entitlement but no limit adjustments
            mockWhere.mockResolvedValue([
                {
                    addonSlug: 'featured-listing',
                    limitAdjustments: [],
                    entitlementAdjustments: [{ entitlementKey: 'featured_listing', granted: true }],
                    purchasedAt: new Date('2024-06-15')
                }
            ]);

            // Act
            const result = await service.getUsageSummary(mockCustomerId);

            // Assert
            expect(result.success).toBe(true);
            // Entitlement adjustments don't affect limit bonuses
            const accommodationsLimit = result.data!.limits.find(
                (l) => l.limitKey === LimitKey.MAX_ACCOMMODATIONS
            );
            expect(accommodationsLimit?.addonBonusLimit).toBe(0);
        });

        it('should return empty adjustments when both DB and metadata are empty', async () => {
            // Arrange
            mockWhere.mockResolvedValue([]);
            (mockBilling.subscriptions.getByCustomerId as Mock).mockResolvedValue([
                { ...mockSubscription, metadata: {} }
            ]);

            // Act
            const result = await service.getUsageSummary(mockCustomerId);

            // Assert
            expect(result.success).toBe(true);
            for (const limit of result.data!.limits) {
                expect(limit.addonBonusLimit).toBe(0);
            }
        });
    });

    describe('isMeasured flag and usage kinds', () => {
        it('should mark only the limits that have a real counter', async () => {
            // Act
            const result = await service.getUsageSummary(mockCustomerId);

            // Assert — the eight account-wide stocks plus the seven AI meters.
            expect(result.success).toBe(true);
            const measured = result
                .data!.limits.filter((l) => l.isMeasured)
                .map((l) => l.limitKey)
                .sort();

            expect(measured).toEqual(
                [
                    LimitKey.MAX_ACCOMMODATIONS,
                    LimitKey.MAX_ACTIVE_PROMOTIONS,
                    LimitKey.MAX_FAVORITES,
                    LimitKey.MAX_ACTIVE_ALERTS,
                    LimitKey.MAX_COLLECTIONS,
                    LimitKey.MAX_SEARCH_HISTORY_ENTRIES,
                    LimitKey.MAX_GASTRONOMIES,
                    LimitKey.MAX_EXPERIENCES,
                    LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH,
                    LimitKey.MAX_AI_CHAT_PER_MONTH,
                    LimitKey.MAX_AI_CHAT_CONSUMER_PER_MONTH,
                    LimitKey.MAX_AI_SEARCH_PER_MONTH,
                    LimitKey.MAX_AI_SUPPORT_PER_MONTH,
                    LimitKey.MAX_AI_TRANSLATE_PER_MONTH,
                    LimitKey.MAX_AI_ACCOMMODATION_IMPORT_PER_MONTH
                ].sort()
            );
        });

        it('should mark a per-accommodation limit as unmeasured account-wide', async () => {
            // Arrange — MAX_PHOTOS_PER_ACCOMMODATION caps each accommodation
            // separately, so its account-level 0 is not a measurement; the real
            // figures travel in `perAccommodation`.
            const result = await service.getUsageSummary(mockCustomerId);

            // Assert
            const photos = result.data!.limits.find(
                (l) => l.limitKey === LimitKey.MAX_PHOTOS_PER_ACCOMMODATION
            );
            expect(photos?.isMeasured).toBe(false);
            expect(photos?.usageKind).toBe('per_accommodation');
        });

        it('should classify the compare cap as a per-operation limit', async () => {
            // Arrange — the comparison endpoint bounds an `ids[]` array; there
            // is no stored quantity to report.
            const result = await service.getUsageSummary(mockCustomerId);

            // Assert
            const compare = result.data!.limits.find(
                (l) => l.limitKey === LimitKey.MAX_COMPARE_ITEMS
            );
            expect(compare?.usageKind).toBe('per_operation');
            expect(compare?.isMeasured).toBe(false);
        });

        it('should classify limits with no feature behind them as unbuilt', async () => {
            // Arrange — no properties/staff table exists.
            const result = await service.getUsageSummary(mockCustomerId);

            // Assert
            const properties = result.data!.limits.find(
                (l) => l.limitKey === LimitKey.MAX_PROPERTIES
            );
            const staff = result.data!.limits.find(
                (l) => l.limitKey === LimitKey.MAX_STAFF_ACCOUNTS
            );
            expect(properties?.usageKind).toBe('unbuilt');
            expect(staff?.usageKind).toBe('unbuilt');
        });

        it('should classify AI meters as monthly', async () => {
            // Act
            const result = await service.getUsageSummary(mockCustomerId);

            // Assert
            const aiSearch = result.data!.limits.find(
                (l) => l.limitKey === LimitKey.MAX_AI_SEARCH_PER_MONTH
            );
            expect(aiSearch?.usageKind).toBe('monthly');
            expect(aiSearch?.isMeasured).toBe(true);
        });

        it('should expose isMeasured and usageKind on getUsageForLimit too', async () => {
            // Act
            const measuredResult = await service.getUsageForLimit(
                mockCustomerId,
                LimitKey.MAX_ACCOMMODATIONS
            );
            const unmeasuredResult = await service.getUsageForLimit(
                mockCustomerId,
                LimitKey.MAX_PROPERTIES
            );

            // Assert
            expect(measuredResult.data?.isMeasured).toBe(true);
            expect(measuredResult.data?.usageKind).toBe('stock');
            expect(unmeasuredResult.data?.isMeasured).toBe(false);
            expect(unmeasuredResult.data?.usageKind).toBe('unbuilt');
        });
    });

    describe('product domain scoping (HOS-259, updated HOS-695)', () => {
        // HOS-695 retired the transitional 'commerce' umbrella domain — a
        // commerce-vertical subscription is scoped by its OWN vertical
        // ('gastronomy' / 'experience') now, never by a shared 'commerce'
        // value. This suite exercises the scoping mechanism through
        // 'gastronomy' in place of the old 'commerce' fixture.
        const gastronomyPlanId = 'plan_gastronomy_monthly';

        /** A gastronomy-domain subscription living under the SAME billing customer. */
        const gastronomySubscription = {
            ...mockSubscription,
            id: 'sub_gastronomy_1',
            planId: gastronomyPlanId,
            productDomain: 'gastronomy'
        };

        /** An explicitly accommodation-domain subscription. */
        const accommodationSubscription = {
            ...mockSubscription,
            id: 'sub_accommodation_1',
            productDomain: 'accommodation'
        };

        const gastronomyPlan = {
            id: gastronomyPlanId,
            name: 'Gastronomy Monthly',
            limits: {
                [LimitKey.MAX_ACCOMMODATIONS]: 99
            }
        };

        beforeEach(() => {
            (mockBilling.plans.get as Mock).mockImplementation((planId: string) =>
                Promise.resolve(planId === gastronomyPlanId ? gastronomyPlan : mockPlan)
            );
        });

        it('should resolve the gastronomy subscription when the gastronomy domain is requested, even when the accommodation one is listed first', async () => {
            // Arrange — a dual-role owner: accommodation sub ordered BEFORE the
            // gastronomy one, which is exactly what made the old unscoped
            // `.find()` return the wrong row.
            (mockBilling.subscriptions.getByCustomerId as Mock).mockResolvedValue([
                accommodationSubscription,
                gastronomySubscription
            ]);

            // Act
            const result = await service.getUsageSummary(mockCustomerId, 'gastronomy');

            // Assert — the gastronomy plan's limits, not the accommodation plan's.
            expect(result.success).toBe(true);
            const accommodationsLimit = result.data!.limits.find(
                (l) => l.limitKey === LimitKey.MAX_ACCOMMODATIONS
            );
            expect(accommodationsLimit?.maxAllowed).toBe(99);
            expect(mockBilling.plans.get).toHaveBeenCalledWith(gastronomyPlanId);
        });

        it('should resolve the accommodation subscription when the gastronomy one is listed first', async () => {
            // Arrange — the mirror case: gastronomy ordered first, accommodation
            // requested.
            (mockBilling.subscriptions.getByCustomerId as Mock).mockResolvedValue([
                gastronomySubscription,
                accommodationSubscription
            ]);

            // Act
            const result = await service.getUsageSummary(mockCustomerId, 'accommodation');

            // Assert
            expect(result.success).toBe(true);
            const accommodationsLimit = result.data!.limits.find(
                (l) => l.limitKey === LimitKey.MAX_ACCOMMODATIONS
            );
            expect(accommodationsLimit?.maxAllowed).toBe(5);
            expect(mockBilling.plans.get).toHaveBeenCalledWith(mockPlanId);
        });

        it('should default to the accommodation domain when none is given', async () => {
            // Arrange
            (mockBilling.subscriptions.getByCustomerId as Mock).mockResolvedValue([
                gastronomySubscription,
                accommodationSubscription
            ]);

            // Act — no productDomain argument at all (every pre-HOS-259 caller).
            const result = await service.getUsageSummary(mockCustomerId);

            // Assert
            expect(result.success).toBe(true);
            expect(mockBilling.plans.get).toHaveBeenCalledWith(mockPlanId);
        });

        it('should treat a legacy subscription with no productDomain as accommodation', async () => {
            // Arrange — `mockSubscription` has no productDomain key at all,
            // which is every row that predates the column.
            (mockBilling.subscriptions.getByCustomerId as Mock).mockResolvedValue([
                mockSubscription
            ]);

            // Act
            const result = await service.getUsageSummary(mockCustomerId, 'accommodation');

            // Assert
            expect(result.success).toBe(true);
            expect(mockBilling.plans.get).toHaveBeenCalledWith(mockPlanId);
        });

        it('should NOT fall back to the accommodation subscription when no gastronomy one exists', async () => {
            // Arrange — an accommodation-only customer asking for gastronomy
            // usage. Returning the accommodation numbers here would be the
            // original bug in its most misleading form.
            (mockBilling.subscriptions.getByCustomerId as Mock).mockResolvedValue([
                accommodationSubscription
            ]);

            // Act
            const result = await service.getUsageSummary(mockCustomerId, 'gastronomy');

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });

        it('should scope getUsageForLimit by product domain too', async () => {
            // Arrange
            (mockBilling.subscriptions.getByCustomerId as Mock).mockResolvedValue([
                accommodationSubscription,
                gastronomySubscription
            ]);

            // Act
            const result = await service.getUsageForLimit(
                mockCustomerId,
                LimitKey.MAX_ACCOMMODATIONS,
                'gastronomy'
            );

            // Assert
            expect(result.success).toBe(true);
            expect(result.data?.maxAllowed).toBe(99);
        });

        it('should return null from getUsageForLimit when the domain has no subscription', async () => {
            // Arrange
            (mockBilling.subscriptions.getByCustomerId as Mock).mockResolvedValue([
                accommodationSubscription
            ]);

            // Act
            const result = await service.getUsageForLimit(
                mockCustomerId,
                LimitKey.MAX_ACCOMMODATIONS,
                'gastronomy'
            );

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toBeNull();
        });
    });
});
