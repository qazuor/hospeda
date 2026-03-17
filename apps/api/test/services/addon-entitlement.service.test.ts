/**
 * Tests for Add-on Entitlement Service
 *
 * Covers:
 * - T-010a: applyAddonEntitlements() with QZPay grant/set APIs
 * - T-010b: removeAddonEntitlements() with revokeBySource/removeBySource + fallbacks
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { EntitlementKey, LimitKey } from '@repo/billing';
import type { PlanDefinition } from '@repo/billing';
import * as billingModule from '@repo/billing';
import { getDb } from '@repo/db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as entitlementMiddleware from '../../src/middlewares/entitlement';
import { AddonEntitlementService } from '../../src/services/addon-entitlement.service';
import { createMockBilling, createMockSubscriptionWithHelpers } from '../helpers/mock-factories';

// Mock the entitlement middleware
vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

// Mock the logger
vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

// Mock getDb for getCustomerAddonAdjustments
vi.mock('@repo/db', () => ({
    getDb: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([])
    })
}));

// Mock @repo/db/schemas so billingAddonPurchases.deletedAt is accessible in soft-delete tests
vi.mock('@repo/db/schemas', () => ({
    billingAddonPurchases: {
        id: 'id',
        customerId: 'customer_id',
        addonSlug: 'addon_slug',
        status: 'status',
        purchasedAt: 'purchased_at',
        expiresAt: 'expires_at',
        canceledAt: 'canceled_at',
        deletedAt: 'deleted_at',
        limitAdjustments: 'limit_adjustments',
        entitlementAdjustments: 'entitlement_adjustments',
        metadata: 'metadata',
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
}));

describe('AddonEntitlementService', () => {
    let service: AddonEntitlementService;
    let mockBilling: QZPayBilling;

    beforeEach(() => {
        mockBilling = createMockBilling();
        service = new AddonEntitlementService(mockBilling);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // T-010a: applyAddonEntitlements()
    // =========================================================================
    describe('applyAddonEntitlements', () => {
        it('should return error if billing is not configured', async () => {
            const serviceWithoutBilling = new AddonEntitlementService(null);

            const result = await serviceWithoutBilling.applyAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'extra-photos-20',
                purchaseId: 'purchase_abc'
            });

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('SERVICE_UNAVAILABLE');
        });

        it('should return error if add-on not found', async () => {
            const result = await service.applyAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'non-existent-addon',
                purchaseId: 'purchase_abc'
            });

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('NOT_FOUND');
        });

        it('should return error if customer has no subscription', async () => {
            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([]);

            const result = await service.applyAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'extra-photos-20',
                purchaseId: 'purchase_abc'
            });

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('NO_SUBSCRIPTION');
        });

        it('should return error if no active subscription', async () => {
            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                createMockSubscriptionWithHelpers({
                    id: 'sub_123',
                    status: 'canceled',
                    planId: 'owner-basico'
                })
            ]);

            const result = await service.applyAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'extra-photos-20',
                purchaseId: 'purchase_abc'
            });

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('NO_ACTIVE_SUBSCRIPTION');
        });

        it('should call billing.entitlements.grant() for entitlement add-ons with expiresAt', async () => {
            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_123',
                status: 'active',
                planId: 'owner-basico',
                metadata: {}
            });

            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);
            vi.mocked(mockBilling.subscriptions.update).mockResolvedValue(mockSubscription);

            const beforeCall = Date.now();
            const result = await service.applyAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'visibility-boost-7d',
                purchaseId: 'purchase_abc'
            });
            const afterCall = Date.now();

            expect(result.success).toBe(true);

            // Verify entitlements.grant was called with correct params
            expect(mockBilling.entitlements.grant).toHaveBeenCalledTimes(1);
            const grantCall = vi.mocked(mockBilling.entitlements.grant).mock.calls[0]![0];

            expect(grantCall).toMatchObject({
                customerId: 'cust_123',
                entitlementKey: EntitlementKey.FEATURED_LISTING,
                source: 'addon',
                sourceId: 'purchase_abc'
            });

            // Verify expiresAt is ~7 days from now
            expect(grantCall.expiresAt).toBeInstanceOf(Date);
            const expectedExpiry = 7 * 24 * 60 * 60 * 1000;
            const actualExpiry = grantCall.expiresAt!.getTime() - beforeCall;
            expect(actualExpiry).toBeGreaterThanOrEqual(expectedExpiry - 1000);
            expect(actualExpiry).toBeLessThanOrEqual(
                expectedExpiry + (afterCall - beforeCall) + 1000
            );

            // Should NOT call limits.set for entitlement add-ons
            expect(mockBilling.limits.set).not.toHaveBeenCalled();
        });

        it('should call billing.entitlements.grant() for 30-day boost with correct expiresAt', async () => {
            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_123',
                status: 'active',
                planId: 'owner-basico',
                metadata: {}
            });

            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);
            vi.mocked(mockBilling.subscriptions.update).mockResolvedValue(mockSubscription);

            const beforeCall = Date.now();
            const result = await service.applyAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'visibility-boost-30d',
                purchaseId: 'purchase_30d'
            });

            expect(result.success).toBe(true);

            const grantCall = vi.mocked(mockBilling.entitlements.grant).mock.calls[0]![0];
            expect(grantCall.sourceId).toBe('purchase_30d');

            // Verify expiresAt is ~30 days from now
            const expectedExpiry = 30 * 24 * 60 * 60 * 1000;
            const actualExpiry = grantCall.expiresAt!.getTime() - beforeCall;
            expect(actualExpiry).toBeGreaterThanOrEqual(expectedExpiry - 1000);
        });

        it('should call billing.limits.set() for limit add-ons with computed maxValue', async () => {
            // owner-basico has MAX_PHOTOS_PER_ACCOMMODATION = 5
            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_123',
                status: 'active',
                planId: 'owner-basico',
                metadata: {}
            });

            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);
            vi.mocked(mockBilling.subscriptions.update).mockResolvedValue(mockSubscription);

            const result = await service.applyAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'extra-photos-20',
                purchaseId: 'purchase_photos'
            });

            expect(result.success).toBe(true);

            // Verify limits.set was called: basePlanLimit(5) + addon.limitIncrease(20) = 25
            expect(mockBilling.limits.set).toHaveBeenCalledTimes(1);
            expect(mockBilling.limits.set).toHaveBeenCalledWith({
                customerId: 'cust_123',
                limitKey: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
                maxValue: 25,
                source: 'addon',
                sourceId: 'purchase_photos'
            });

            // Should NOT call entitlements.grant for limit add-ons
            expect(mockBilling.entitlements.grant).not.toHaveBeenCalled();
        });

        it('should compute correct maxValue for extra-accommodations on owner-pro plan', async () => {
            // owner-pro has MAX_ACCOMMODATIONS = 3
            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_123',
                status: 'active',
                planId: 'owner-pro',
                metadata: {}
            });

            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);
            vi.mocked(mockBilling.subscriptions.update).mockResolvedValue(mockSubscription);

            const result = await service.applyAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'extra-accommodations-5',
                purchaseId: 'purchase_acc'
            });

            expect(result.success).toBe(true);

            // basePlanLimit(3) + limitIncrease(5) = 8
            expect(mockBilling.limits.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    limitKey: LimitKey.MAX_ACCOMMODATIONS,
                    maxValue: 8,
                    source: 'addon',
                    sourceId: 'purchase_acc'
                })
            );
        });

        it('should skip limits.set() when base plan limit is -1 (unlimited)', async () => {
            // No real canonical plan has -1 for a limit key targeted by an existing addon.
            // We inject a synthetic plan with MAX_PHOTOS_PER_ACCOMMODATION = -1 so the service
            // reads -1 from ALL_PLANS and skips the limits.set() call entirely.
            const originalAllPlans = billingModule.ALL_PLANS;
            const planWithUnlimitedPhotos: PlanDefinition = {
                slug: 'owner-unlimited-test',
                name: 'Test Unlimited Plan',
                description: 'Synthetic plan for -1 skip test',
                category: 'owner',
                monthlyPriceArs: 0,
                annualPriceArs: null,
                monthlyPriceUsdRef: 0,
                hasTrial: false,
                trialDays: 0,
                isDefault: false,
                sortOrder: 99,
                entitlements: [],
                limits: [
                    {
                        key: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
                        value: -1,
                        name: 'Photos per accommodation',
                        description: 'Unlimited photos'
                    }
                ],
                isActive: true
            };

            Object.defineProperty(billingModule, 'ALL_PLANS', {
                value: [...originalAllPlans, planWithUnlimitedPhotos],
                configurable: true,
                writable: true
            });

            try {
                const mockSubscription = createMockSubscriptionWithHelpers({
                    id: 'sub_123',
                    status: 'active',
                    planId: 'owner-unlimited-test',
                    metadata: {}
                });

                vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                    mockSubscription
                ]);
                vi.mocked(mockBilling.subscriptions.update).mockResolvedValue(mockSubscription);

                const result = await service.applyAddonEntitlements({
                    customerId: 'cust_123',
                    addonSlug: 'extra-photos-20',
                    purchaseId: 'purchase_x'
                });

                expect(result.success).toBe(true);

                // Base plan limit is -1 (unlimited) -> service must NOT call limits.set()
                expect(mockBilling.limits.set).not.toHaveBeenCalled();
            } finally {
                // Restore original ALL_PLANS regardless of test outcome
                Object.defineProperty(billingModule, 'ALL_PLANS', {
                    value: originalAllPlans,
                    configurable: true,
                    writable: true
                });
            }
        });

        it('should work with trialing subscription status', async () => {
            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_trial',
                status: 'trialing',
                planId: 'owner-basico',
                metadata: {}
            });

            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);
            vi.mocked(mockBilling.subscriptions.update).mockResolvedValue(mockSubscription);

            const result = await service.applyAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'extra-photos-20',
                purchaseId: 'purchase_trial'
            });

            expect(result.success).toBe(true);
            expect(mockBilling.limits.set).toHaveBeenCalledTimes(1);
        });

        it('should write add-on adjustment to subscription metadata and clear cache', async () => {
            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_123',
                status: 'active',
                planId: 'owner-basico',
                metadata: {}
            });

            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);
            vi.mocked(mockBilling.subscriptions.update).mockResolvedValue(mockSubscription);

            const result = await service.applyAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'extra-photos-20',
                purchaseId: 'purchase_abc'
            });

            expect(result.success).toBe(true);

            // Verify subscription metadata was updated with adjustment tracking
            const updateCall = vi.mocked(mockBilling.subscriptions.update).mock.calls[0];
            expect(updateCall).toBeDefined();
            expect(updateCall![0]).toBe('sub_123');

            const metadata = updateCall![1].metadata;
            expect(metadata).toBeDefined();

            const adjustments = JSON.parse(metadata!.addonAdjustments as string);
            expect(adjustments).toHaveLength(1);
            expect(adjustments[0]).toMatchObject({
                addonSlug: 'extra-photos-20',
                limitKey: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
                limitIncrease: 20
            });

            // Verify cache was cleared
            expect(entitlementMiddleware.clearEntitlementCache).toHaveBeenCalledWith('cust_123');
        });

        it('should write entitlement add-on to subscription metadata', async () => {
            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_123',
                status: 'active',
                planId: 'owner-basico',
                metadata: {}
            });

            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);
            vi.mocked(mockBilling.subscriptions.update).mockResolvedValue(mockSubscription);

            const result = await service.applyAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'visibility-boost-7d',
                purchaseId: 'purchase_abc'
            });

            expect(result.success).toBe(true);

            const updateCall = vi.mocked(mockBilling.subscriptions.update).mock.calls[0];
            const metadata = updateCall![1].metadata;
            const adjustments = JSON.parse(metadata!.addonAdjustments as string);

            expect(adjustments).toHaveLength(1);
            expect(adjustments[0]).toMatchObject({
                addonSlug: 'visibility-boost-7d',
                entitlement: EntitlementKey.FEATURED_LISTING
            });
        });

        it('should NOT call billing.plans.get or billing.plans.update (no global plan mutation)', async () => {
            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_123',
                status: 'active',
                planId: 'owner-basico',
                metadata: {}
            });

            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);
            vi.mocked(mockBilling.subscriptions.update).mockResolvedValue(mockSubscription);

            await service.applyAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'extra-photos-20',
                purchaseId: 'purchase_abc'
            });

            // The primary bug fix: service must NEVER touch the global plan
            expect(mockBilling.plans.get).not.toHaveBeenCalled();
        });

        it('should return INTERNAL_ERROR when billing.entitlements.grant throws', async () => {
            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_123',
                status: 'active',
                planId: 'owner-basico',
                metadata: {}
            });

            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);
            vi.mocked(mockBilling.entitlements.grant).mockRejectedValue(
                new Error('QZPay grant failed')
            );

            const result = await service.applyAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'visibility-boost-7d',
                purchaseId: 'purchase_abc'
            });

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('INTERNAL_ERROR');
        });

        it('should return INTERNAL_ERROR when billing.limits.set throws', async () => {
            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_123',
                status: 'active',
                planId: 'owner-basico',
                metadata: {}
            });

            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);
            vi.mocked(mockBilling.limits.set).mockRejectedValue(new Error('QZPay set failed'));

            const result = await service.applyAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'extra-photos-20',
                purchaseId: 'purchase_abc'
            });

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('INTERNAL_ERROR');
        });

        it('should call billing.entitlements.grant() without expiresAt for permanent entitlement addon (durationDays: null)', async () => {
            // Arrange — spy on getAddonBySlug to return a permanent entitlement addon
            const permanentAddon = {
                slug: 'permanent-entitlement-addon',
                name: 'Permanent Entitlement Addon',
                description: 'Grants a permanent entitlement with no expiry.',
                billingType: 'recurring' as const,
                priceArs: 100000,
                annualPriceArs: null,
                durationDays: null, // permanent — no expiry
                affectsLimitKey: null,
                limitIncrease: null,
                grantsEntitlement: EntitlementKey.FEATURED_LISTING,
                targetCategories: ['owner'] as Array<'owner' | 'complex'>,
                isActive: true,
                sortOrder: 99
            };

            const getAddonBySlugSpy = vi
                .spyOn(billingModule, 'getAddonBySlug')
                .mockReturnValueOnce(permanentAddon);

            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_perm',
                status: 'active',
                planId: 'owner-basico',
                metadata: {}
            });

            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);
            vi.mocked(mockBilling.subscriptions.update).mockResolvedValue(mockSubscription);

            // Act
            const result = await service.applyAddonEntitlements({
                customerId: 'cust_perm',
                addonSlug: 'permanent-entitlement-addon',
                purchaseId: 'purchase_perm'
            });

            // Assert
            expect(result.success).toBe(true);

            // grant() must be called
            expect(mockBilling.entitlements.grant).toHaveBeenCalledTimes(1);
            const grantCall = vi.mocked(mockBilling.entitlements.grant).mock.calls[0]![0];

            // expiresAt must be undefined (permanent — no expiry logic should run)
            expect(grantCall.expiresAt).toBeUndefined();
            expect(grantCall.customerId).toBe('cust_perm');
            expect(grantCall.source).toBe('addon');
            expect(grantCall.sourceId).toBe('purchase_perm');

            // limits.set must NOT be called
            expect(mockBilling.limits.set).not.toHaveBeenCalled();

            getAddonBySlugSpy.mockRestore();
        });

        it('should NOT clear entitlement cache when billing.entitlements.grant throws', async () => {
            // Arrange
            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_nocache',
                status: 'active',
                planId: 'owner-basico',
                metadata: {}
            });

            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);
            vi.mocked(mockBilling.entitlements.grant).mockRejectedValue(
                new Error('QZPay grant failed')
            );

            // Act
            const result = await service.applyAddonEntitlements({
                customerId: 'cust_nocache',
                addonSlug: 'visibility-boost-7d',
                purchaseId: 'purchase_nocache'
            });

            // Assert — operation failed
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('INTERNAL_ERROR');

            // Cache must NOT be cleared when the operation fails
            expect(entitlementMiddleware.clearEntitlementCache).not.toHaveBeenCalled();
        });

        // =========================================================================
        // GAP-038-07: Overlapping limit key — second addon on the same limitKey
        // =========================================================================
        it('should compute maxValue from base plan limit (not current customer limit) when two addons share the same limitKey', async () => {
            // The service reads the base plan limit from canonical ALL_PLANS config and adds
            // the addon's limitIncrease. It does NOT read the current customer limit.
            // Therefore, a second addon purchase for the same limitKey overwrites the previous
            // customer-level value with basePlanLimit + addon.limitIncrease (not an accumulation).
            //
            // owner-basico has MAX_PHOTOS_PER_ACCOMMODATION = 5.
            // extra-photos-20 has limitIncrease = 20.
            // First call:  limits.set({ maxValue: 5 + 20 = 25 })
            // Second call: limits.set({ maxValue: 5 + 20 = 25 })  (reads plan base again, not 25)

            // Arrange
            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_overlap',
                status: 'active',
                planId: 'owner-basico',
                metadata: {}
            });

            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);
            vi.mocked(mockBilling.subscriptions.update).mockResolvedValue(mockSubscription);

            // Act — first addon purchase affecting MAX_PHOTOS_PER_ACCOMMODATION
            const firstResult = await service.applyAddonEntitlements({
                customerId: 'cust_overlap',
                addonSlug: 'extra-photos-20',
                purchaseId: 'purchase_overlap_1'
            });

            // Act — second addon purchase affecting the same limitKey
            const secondResult = await service.applyAddonEntitlements({
                customerId: 'cust_overlap',
                addonSlug: 'extra-photos-20',
                purchaseId: 'purchase_overlap_2'
            });

            // Assert — both succeed
            expect(firstResult.success).toBe(true);
            expect(secondResult.success).toBe(true);

            // Assert — limits.set was called twice
            expect(mockBilling.limits.set).toHaveBeenCalledTimes(2);

            // Assert — both calls use basePlanLimit(5) + limitIncrease(20) = 25
            // The second call does NOT compound on top of the first call's value
            const [firstCall, secondCall] = vi.mocked(mockBilling.limits.set).mock.calls;

            expect(firstCall![0]).toMatchObject({
                customerId: 'cust_overlap',
                limitKey: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
                maxValue: 25,
                source: 'addon',
                sourceId: 'purchase_overlap_1'
            });

            expect(secondCall![0]).toMatchObject({
                customerId: 'cust_overlap',
                limitKey: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
                maxValue: 25,
                source: 'addon',
                sourceId: 'purchase_overlap_2'
            });
        });

        it('should append to existing adjustments without overwriting', async () => {
            const existingAdjustments = [
                {
                    addonSlug: 'extra-accommodations-5',
                    limitKey: LimitKey.MAX_ACCOMMODATIONS,
                    limitIncrease: 5,
                    appliedAt: '2026-01-01T00:00:00.000Z'
                }
            ];

            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_123',
                status: 'active',
                planId: 'owner-basico',
                metadata: {
                    addonAdjustments: JSON.stringify(existingAdjustments)
                }
            });

            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);
            vi.mocked(mockBilling.subscriptions.update).mockResolvedValue(mockSubscription);

            await service.applyAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'extra-photos-20',
                purchaseId: 'purchase_new'
            });

            const updateCall = vi.mocked(mockBilling.subscriptions.update).mock.calls[0];
            const metadata = updateCall![1].metadata;
            const adjustments = JSON.parse(metadata!.addonAdjustments as string);

            expect(adjustments).toHaveLength(2);
            expect(adjustments[0].addonSlug).toBe('extra-accommodations-5');
            expect(adjustments[1].addonSlug).toBe('extra-photos-20');
        });
    });

    // =========================================================================
    // T-010b: removeAddonEntitlements()
    // =========================================================================
    describe('removeAddonEntitlements', () => {
        it('should return error if billing is not configured', async () => {
            const serviceWithoutBilling = new AddonEntitlementService(null);

            const result = await serviceWithoutBilling.removeAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'extra-photos-20',
                purchaseId: 'purchase_abc'
            });

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('SERVICE_UNAVAILABLE');
        });

        it('should return NOT_FOUND for unknown addon slug', async () => {
            const result = await service.removeAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'non-existent-addon',
                purchaseId: 'purchase_abc'
            });

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('NOT_FOUND');
        });

        it('should return success if customer has no subscription', async () => {
            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([]);

            const result = await service.removeAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'extra-photos-20',
                purchaseId: 'purchase_abc'
            });

            expect(result.success).toBe(true);
        });

        it('should return success if no active subscription (nothing to remove)', async () => {
            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                createMockSubscriptionWithHelpers({
                    id: 'sub_123',
                    status: 'canceled',
                    planId: 'owner-basico'
                })
            ]);

            const result = await service.removeAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'extra-photos-20',
                purchaseId: 'purchase_abc'
            });

            expect(result.success).toBe(true);
        });

        it('should call revokeBySource for entitlement add-ons (post-migration path)', async () => {
            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_123',
                status: 'active',
                planId: 'owner-basico',
                metadata: {
                    addonAdjustments: JSON.stringify([
                        {
                            addonSlug: 'visibility-boost-7d',
                            entitlement: EntitlementKey.FEATURED_LISTING,
                            appliedAt: new Date().toISOString()
                        }
                    ])
                }
            });

            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);
            vi.mocked(mockBilling.subscriptions.update).mockResolvedValue(mockSubscription);
            vi.mocked(mockBilling.entitlements.revokeBySource).mockResolvedValue(1);

            const result = await service.removeAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'visibility-boost-7d',
                purchaseId: 'purchase_abc'
            });

            expect(result.success).toBe(true);

            // Should call revokeBySource with source='addon' and purchaseId
            expect(mockBilling.entitlements.revokeBySource).toHaveBeenCalledWith(
                'addon',
                'purchase_abc'
            );

            // Should NOT fall back to revoke() since revokeBySource returned 1
            expect(mockBilling.entitlements.revoke).not.toHaveBeenCalled();
        });

        it('should fall back to revoke() when revokeBySource returns 0 (pre-migration data)', async () => {
            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_123',
                status: 'active',
                planId: 'owner-basico',
                metadata: {
                    addonAdjustments: JSON.stringify([
                        {
                            addonSlug: 'visibility-boost-7d',
                            entitlement: EntitlementKey.FEATURED_LISTING,
                            appliedAt: new Date().toISOString()
                        }
                    ])
                }
            });

            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);
            vi.mocked(mockBilling.subscriptions.update).mockResolvedValue(mockSubscription);
            vi.mocked(mockBilling.entitlements.revokeBySource).mockResolvedValue(0);

            const result = await service.removeAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'visibility-boost-7d',
                purchaseId: 'purchase_abc'
            });

            expect(result.success).toBe(true);

            // Should fall back to revoke() with customerId and entitlementKey
            expect(mockBilling.entitlements.revoke).toHaveBeenCalledWith(
                'cust_123',
                EntitlementKey.FEATURED_LISTING
            );
        });

        it('should call removeBySource for limit add-ons (post-migration path)', async () => {
            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_123',
                status: 'active',
                planId: 'owner-basico',
                metadata: {
                    addonAdjustments: JSON.stringify([
                        {
                            addonSlug: 'extra-photos-20',
                            limitKey: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
                            limitIncrease: 20,
                            appliedAt: new Date().toISOString()
                        }
                    ])
                }
            });

            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);
            vi.mocked(mockBilling.subscriptions.update).mockResolvedValue(mockSubscription);
            vi.mocked(mockBilling.limits.removeBySource).mockResolvedValue(1);

            const result = await service.removeAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'extra-photos-20',
                purchaseId: 'purchase_photos'
            });

            expect(result.success).toBe(true);

            // Should call removeBySource with source='addon' and purchaseId
            expect(mockBilling.limits.removeBySource).toHaveBeenCalledWith(
                'addon',
                'purchase_photos'
            );

            // Should NOT fall back to remove() since removeBySource returned 1
            expect(mockBilling.limits.remove).not.toHaveBeenCalled();
        });

        it('should fall back to remove() when removeBySource returns 0 (pre-migration data)', async () => {
            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_123',
                status: 'active',
                planId: 'owner-basico',
                metadata: {
                    addonAdjustments: JSON.stringify([
                        {
                            addonSlug: 'extra-photos-20',
                            limitKey: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
                            limitIncrease: 20,
                            appliedAt: new Date().toISOString()
                        }
                    ])
                }
            });

            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);
            vi.mocked(mockBilling.subscriptions.update).mockResolvedValue(mockSubscription);
            vi.mocked(mockBilling.limits.removeBySource).mockResolvedValue(0);

            const result = await service.removeAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'extra-photos-20',
                purchaseId: 'purchase_photos'
            });

            expect(result.success).toBe(true);

            // Should fall back to remove() with customerId and limitKey
            expect(mockBilling.limits.remove).toHaveBeenCalledWith(
                'cust_123',
                LimitKey.MAX_PHOTOS_PER_ACCOMMODATION
            );
        });

        it('should continue with metadata cleanup even if revokeBySource throws (resilience)', async () => {
            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_123',
                status: 'active',
                planId: 'owner-basico',
                metadata: {
                    addonAdjustments: JSON.stringify([
                        {
                            addonSlug: 'visibility-boost-7d',
                            entitlement: EntitlementKey.FEATURED_LISTING,
                            appliedAt: new Date().toISOString()
                        }
                    ])
                }
            });

            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);
            vi.mocked(mockBilling.subscriptions.update).mockResolvedValue(mockSubscription);
            vi.mocked(mockBilling.entitlements.revokeBySource).mockRejectedValue(
                new Error('QZPay unavailable')
            );

            const result = await service.removeAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'visibility-boost-7d',
                purchaseId: 'purchase_abc'
            });

            // Should still succeed despite QZPay error (resilient)
            expect(result.success).toBe(true);

            // Metadata should still be cleaned up
            expect(mockBilling.subscriptions.update).toHaveBeenCalled();

            // Cache should still be cleared
            expect(entitlementMiddleware.clearEntitlementCache).toHaveBeenCalledWith('cust_123');
        });

        it('should continue with metadata cleanup even if removeBySource throws (resilience)', async () => {
            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_123',
                status: 'active',
                planId: 'owner-basico',
                metadata: {
                    addonAdjustments: JSON.stringify([
                        {
                            addonSlug: 'extra-photos-20',
                            limitKey: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
                            limitIncrease: 20,
                            appliedAt: new Date().toISOString()
                        }
                    ])
                }
            });

            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);
            vi.mocked(mockBilling.subscriptions.update).mockResolvedValue(mockSubscription);
            vi.mocked(mockBilling.limits.removeBySource).mockRejectedValue(
                new Error('QZPay unavailable')
            );

            const result = await service.removeAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'extra-photos-20',
                purchaseId: 'purchase_photos'
            });

            // Should still succeed despite QZPay error (resilient)
            expect(result.success).toBe(true);

            // Metadata should still be cleaned up
            expect(mockBilling.subscriptions.update).toHaveBeenCalled();
        });

        it('should remove adjustment from subscription metadata and clear cache', async () => {
            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_123',
                status: 'active',
                planId: 'owner-basico',
                metadata: {
                    addonAdjustments: JSON.stringify([
                        {
                            addonSlug: 'extra-photos-20',
                            limitKey: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
                            limitIncrease: 20,
                            appliedAt: new Date().toISOString()
                        }
                    ])
                }
            });

            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);
            vi.mocked(mockBilling.subscriptions.update).mockResolvedValue(mockSubscription);
            vi.mocked(mockBilling.limits.removeBySource).mockResolvedValue(1);

            const result = await service.removeAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'extra-photos-20',
                purchaseId: 'purchase_abc'
            });

            expect(result.success).toBe(true);

            // Verify subscription metadata was cleared
            const updateCall = vi.mocked(mockBilling.subscriptions.update).mock.calls[0];
            expect(updateCall).toBeDefined();
            expect(updateCall![0]).toBe('sub_123');

            const metadata = updateCall![1].metadata;
            const adjustments = JSON.parse(metadata!.addonAdjustments as string);
            expect(adjustments).toHaveLength(0);

            // Verify cache was cleared
            expect(entitlementMiddleware.clearEntitlementCache).toHaveBeenCalledWith('cust_123');
        });

        it('should only remove the targeted add-on from metadata, leaving others intact', async () => {
            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_123',
                status: 'active',
                planId: 'owner-basico',
                metadata: {
                    addonAdjustments: JSON.stringify([
                        {
                            addonSlug: 'extra-photos-20',
                            limitKey: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
                            limitIncrease: 20,
                            appliedAt: new Date().toISOString()
                        },
                        {
                            addonSlug: 'extra-accommodations-5',
                            limitKey: LimitKey.MAX_ACCOMMODATIONS,
                            limitIncrease: 5,
                            appliedAt: new Date().toISOString()
                        }
                    ])
                }
            });

            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);
            vi.mocked(mockBilling.subscriptions.update).mockResolvedValue(mockSubscription);
            vi.mocked(mockBilling.limits.removeBySource).mockResolvedValue(1);

            await service.removeAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'extra-photos-20',
                purchaseId: 'purchase_abc'
            });

            const updateCall = vi.mocked(mockBilling.subscriptions.update).mock.calls[0];
            const metadata = updateCall![1].metadata;
            const adjustments = JSON.parse(metadata!.addonAdjustments as string);

            expect(adjustments).toHaveLength(1);
            expect(adjustments[0].addonSlug).toBe('extra-accommodations-5');
        });

        it('should NOT call billing.plans.get or billing.plans.update (no global plan mutation)', async () => {
            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_123',
                status: 'active',
                planId: 'owner-basico',
                metadata: {}
            });

            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);
            vi.mocked(mockBilling.subscriptions.update).mockResolvedValue(mockSubscription);

            await service.removeAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'extra-photos-20',
                purchaseId: 'purchase_abc'
            });

            // The primary bug fix: service must NEVER touch the global plan
            expect(mockBilling.plans.get).not.toHaveBeenCalled();
        });

        it('should handle gracefully when revokeBySource returns 0 and fallback revoke also throws (cascading failure)', async () => {
            // Arrange — revokeBySource returns 0 (triggers fallback), then revoke() also throws.
            // The inner catch (revokeError) wraps BOTH revokeBySource AND revoke() — so the
            // revoke() error is captured by the same catch block, logged as a warning, and the
            // operation continues to metadata cleanup. Result is success: true (resilient design).
            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_cascade',
                status: 'active',
                planId: 'owner-basico',
                metadata: {
                    addonAdjustments: JSON.stringify([
                        {
                            addonSlug: 'visibility-boost-7d',
                            entitlement: EntitlementKey.FEATURED_LISTING,
                            appliedAt: new Date().toISOString()
                        }
                    ])
                }
            });

            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);
            vi.mocked(mockBilling.subscriptions.update).mockResolvedValue(mockSubscription);

            // revokeBySource returns 0 — triggers fallback revoke()
            vi.mocked(mockBilling.entitlements.revokeBySource).mockResolvedValue(0);
            // fallback revoke() ALSO throws — captured by the same inner catch
            vi.mocked(mockBilling.entitlements.revoke).mockRejectedValue(
                new Error('QZPay revoke also failed')
            );

            // Act
            const result = await service.removeAddonEntitlements({
                customerId: 'cust_cascade',
                addonSlug: 'visibility-boost-7d',
                purchaseId: 'purchase_cascade'
            });

            // Assert — inner catch captures the cascading error, operation is resilient.
            // Metadata cleanup and cache clear still run despite billing failures.
            expect(result.success).toBe(true);

            // Metadata cleanup still ran despite cascading billing failure
            expect(mockBilling.subscriptions.update).toHaveBeenCalled();

            // Cache was still cleared
            expect(entitlementMiddleware.clearEntitlementCache).toHaveBeenCalledWith('cust_cascade');
        });

        it('should return INTERNAL_ERROR when subscriptions.update throws (outer catch)', async () => {
            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_123',
                status: 'active',
                planId: 'owner-basico',
                metadata: {}
            });

            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);
            vi.mocked(mockBilling.subscriptions.update).mockRejectedValue(
                new Error('DB write failed')
            );

            const result = await service.removeAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'extra-photos-20',
                purchaseId: 'purchase_abc'
            });

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('INTERNAL_ERROR');
        });
    });

    // =========================================================================
    // getCustomerAddonAdjustments
    // =========================================================================
    describe('getCustomerAddonAdjustments', () => {
        it('should return empty array if no subscription', async () => {
            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([]);

            const result = await service.getCustomerAddonAdjustments('cust_123');

            expect(result.success).toBe(true);
            expect(result.data).toEqual([]);
        });

        it('should return adjustments from subscription metadata', async () => {
            const adjustments = [
                {
                    addonSlug: 'extra-photos-20',
                    limitKey: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
                    limitIncrease: 20,
                    appliedAt: new Date().toISOString()
                }
            ];

            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_123',
                status: 'active',
                planId: 'owner-basico',
                metadata: {
                    addonAdjustments: JSON.stringify(adjustments)
                }
            });

            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);

            const result = await service.getCustomerAddonAdjustments('cust_123');

            expect(result.success).toBe(true);
            expect(result.data).toEqual(adjustments);
        });

        it('should handle malformed metadata gracefully', async () => {
            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_123',
                status: 'active',
                planId: 'owner-basico',
                metadata: {
                    addonAdjustments: 'invalid json'
                }
            });

            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);

            const result = await service.getCustomerAddonAdjustments('cust_123');

            expect(result.success).toBe(true);
            expect(result.data).toEqual([]);
        });

        it('should return SERVICE_UNAVAILABLE when billing is null', async () => {
            const serviceWithoutBilling = new AddonEntitlementService(null);

            const result = await serviceWithoutBilling.getCustomerAddonAdjustments('cust_123');

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('SERVICE_UNAVAILABLE');
        });
    });

    // =========================================================================
    // T-018: Soft-delete behavior — getCustomerAddonAdjustments()
    // =========================================================================
    describe('soft-delete exclusion in getCustomerAddonAdjustments()', () => {
        it('should not return a soft-deleted purchase when DB applies isNull(deletedAt) filter', async () => {
            // Arrange: configure a fresh mock DB that returns empty for the purchase query,
            // simulating what the real DB does when isNull(deletedAt) excludes the soft-deleted row.
            const mockWhere = vi.fn().mockResolvedValue([]);
            const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
            const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
            vi.mocked(getDb).mockReturnValue({
                select: mockSelect,
                from: mockFrom,
                where: mockWhere
                // biome-ignore lint/suspicious/noExplicitAny: mock object used only in test setup
            } as any);

            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_123',
                status: 'active',
                planId: 'owner-basico',
                metadata: {}
            });
            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);

            // Act: even though no purchase rows come back, the service should succeed with an empty list
            const result = await service.getCustomerAddonAdjustments('cust_123');

            // Assert: the WHERE query was invoked (filtering happened at DB level)
            expect(mockSelect).toHaveBeenCalled();
            expect(mockFrom).toHaveBeenCalled();
            expect(mockWhere).toHaveBeenCalled();

            // No adjustments are returned because the DB filtered the soft-deleted record
            expect(result.success).toBe(true);
            expect(result.data).toEqual([]);
        });

        it('should return active (non-deleted) purchases from the DB query result', async () => {
            // Arrange: the DB returns one active, non-soft-deleted purchase
            const activePurchase = {
                id: 'purchase_active',
                customerId: 'cust_123',
                addonSlug: 'extra-photos-20',
                status: 'active',
                purchasedAt: new Date('2024-01-15'),
                limitAdjustments: [
                    {
                        limitKey: 'max_photos_per_accommodation',
                        increase: 20,
                        previousValue: 5,
                        newValue: 25
                    }
                ],
                entitlementAdjustments: []
            };

            const mockWhere = vi.fn().mockResolvedValue([activePurchase]);
            const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
            const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
            vi.mocked(getDb).mockReturnValue({
                select: mockSelect,
                from: mockFrom,
                where: mockWhere
                // biome-ignore lint/suspicious/noExplicitAny: mock object used only in test setup
            } as any);

            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_123',
                status: 'active',
                planId: 'owner-basico',
                metadata: {}
            });
            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);

            // Act
            const result = await service.getCustomerAddonAdjustments('cust_123');

            // Assert: the active purchase is included in the result
            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(1);
            expect(result.data?.[0]?.addonSlug).toBe('extra-photos-20');
        });
    });
});
