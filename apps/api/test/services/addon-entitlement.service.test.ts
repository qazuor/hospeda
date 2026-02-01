/**
 * Tests for Add-on Entitlement Service
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { EntitlementKey, LimitKey } from '@repo/billing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as entitlementMiddleware from '../../src/middlewares/entitlement';
import { AddonEntitlementService } from '../../src/services/addon-entitlement.service';
import { createMockPlan, createMockSubscriptionWithHelpers } from '../helpers/mock-factories';

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

describe('AddonEntitlementService', () => {
    let service: AddonEntitlementService;
    let mockBilling: QZPayBilling;

    beforeEach(() => {
        // Create mock billing instance
        // Note: QZPay types don't include plans.update but service uses it at runtime
        mockBilling = {
            customers: {
                get: vi.fn()
            },
            subscriptions: {
                getByCustomerId: vi.fn(),
                update: vi.fn()
            },
            plans: {
                get: vi.fn(),
                update: vi.fn()
            }
        } as unknown as QZPayBilling;

        service = new AddonEntitlementService(mockBilling);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('applyAddonEntitlements', () => {
        it('should return error if billing is not configured', async () => {
            const serviceWithoutBilling = new AddonEntitlementService(null);

            const result = await serviceWithoutBilling.applyAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'extra-photos-20'
            });

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('SERVICE_UNAVAILABLE');
        });

        it('should return error if add-on not found', async () => {
            const result = await service.applyAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'non-existent-addon'
            });

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('NOT_FOUND');
        });

        it('should return error if customer has no subscription', async () => {
            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([]);

            const result = await service.applyAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'extra-photos-20'
            });

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('NO_SUBSCRIPTION');
        });

        it('should return error if no active subscription', async () => {
            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                createMockSubscriptionWithHelpers({
                    id: 'sub_123',
                    status: 'canceled',
                    planId: 'plan_basic'
                })
            ]);

            const result = await service.applyAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'extra-photos-20'
            });

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('NO_ACTIVE_SUBSCRIPTION');
        });

        it('should apply limit increase from add-on', async () => {
            // Mock active subscription
            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_123',
                status: 'active',
                planId: 'plan_basic',
                metadata: {}
            });

            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);

            // Mock plan with existing limits
            const mockPlan = createMockPlan({
                id: 'plan_basic',
                entitlements: [EntitlementKey.PUBLISH_ACCOMMODATIONS],
                limits: {
                    [LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]: 10
                }
            });

            vi.mocked(mockBilling.plans.get).mockResolvedValue(mockPlan);
            // @ts-expect-error - QZPay types don't include update but service uses it at runtime
            vi.mocked(mockBilling.plans.update).mockResolvedValue(mockPlan);
            vi.mocked(mockBilling.subscriptions.update).mockResolvedValue(mockSubscription);

            // Apply add-on that increases photos limit by 20
            const result = await service.applyAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'extra-photos-20'
            });

            expect(result.success).toBe(true);

            // Verify plan was updated with increased limit
            // @ts-expect-error - QZPay types don't include update but service uses it at runtime
            expect(mockBilling.plans.update).toHaveBeenCalledWith('plan_basic', {
                entitlements: [EntitlementKey.PUBLISH_ACCOMMODATIONS],
                limits: {
                    [LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]: 30 // 10 + 20
                }
            });

            // Verify cache was cleared
            expect(entitlementMiddleware.clearEntitlementCache).toHaveBeenCalledWith('cust_123');
        });

        it('should apply entitlement from add-on', async () => {
            // Mock active subscription
            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_123',
                status: 'active',
                planId: 'plan_basic',
                metadata: {}
            });

            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);

            // Mock plan without featured listing entitlement
            const mockPlan = createMockPlan({
                id: 'plan_basic',
                entitlements: [EntitlementKey.PUBLISH_ACCOMMODATIONS],
                limits: {}
            });

            vi.mocked(mockBilling.plans.get).mockResolvedValue(mockPlan);
            // @ts-expect-error - QZPay types don't include update but service uses it at runtime
            vi.mocked(mockBilling.plans.update).mockResolvedValue(mockPlan);
            vi.mocked(mockBilling.subscriptions.update).mockResolvedValue(mockSubscription);

            // Apply add-on that grants featured listing
            const result = await service.applyAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'visibility-boost-7d'
            });

            expect(result.success).toBe(true);

            // Verify plan was updated with new entitlement
            // @ts-expect-error - QZPay types don't include update but service uses it at runtime
            expect(mockBilling.plans.update).toHaveBeenCalledWith('plan_basic', {
                entitlements: [
                    EntitlementKey.PUBLISH_ACCOMMODATIONS,
                    EntitlementKey.FEATURED_LISTING
                ],
                limits: {}
            });

            // Verify cache was cleared
            expect(entitlementMiddleware.clearEntitlementCache).toHaveBeenCalledWith('cust_123');
        });

        it('should track add-on adjustment in subscription metadata', async () => {
            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_123',
                status: 'active',
                planId: 'plan_basic',
                metadata: {}
            });

            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);

            const mockPlan = createMockPlan({
                id: 'plan_basic',
                entitlements: [],
                limits: {
                    [LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]: 10
                }
            });

            vi.mocked(mockBilling.plans.get).mockResolvedValue(mockPlan);
            // @ts-expect-error - QZPay types don't include update but service uses it at runtime
            vi.mocked(mockBilling.plans.update).mockResolvedValue(mockPlan);
            vi.mocked(mockBilling.subscriptions.update).mockResolvedValue(mockSubscription);

            await service.applyAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'extra-photos-20'
            });

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
        });
    });

    describe('removeAddonEntitlements', () => {
        it('should return error if billing is not configured', async () => {
            const serviceWithoutBilling = new AddonEntitlementService(null);

            const result = await serviceWithoutBilling.removeAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'extra-photos-20'
            });

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('SERVICE_UNAVAILABLE');
        });

        it('should return success if customer has no subscription', async () => {
            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([]);

            const result = await service.removeAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'extra-photos-20'
            });

            expect(result.success).toBe(true);
        });

        it('should remove limit increase from add-on', async () => {
            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_123',
                status: 'active',
                planId: 'plan_basic',
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

            const mockPlan = createMockPlan({
                id: 'plan_basic',
                entitlements: [],
                limits: {
                    [LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]: 30 // 10 base + 20 from addon
                }
            });

            vi.mocked(mockBilling.plans.get).mockResolvedValue(mockPlan);
            // @ts-expect-error - QZPay types don't include update but service uses it at runtime
            vi.mocked(mockBilling.plans.update).mockResolvedValue(mockPlan);
            vi.mocked(mockBilling.subscriptions.update).mockResolvedValue(mockSubscription);

            const result = await service.removeAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'extra-photos-20'
            });

            expect(result.success).toBe(true);

            // Verify plan was updated with decreased limit
            // @ts-expect-error - QZPay types don't include update but service uses it at runtime
            expect(mockBilling.plans.update).toHaveBeenCalledWith('plan_basic', {
                entitlements: [],
                limits: {
                    [LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]: 10 // 30 - 20
                }
            });

            // Verify cache was cleared
            expect(entitlementMiddleware.clearEntitlementCache).toHaveBeenCalledWith('cust_123');
        });

        it('should remove entitlement from add-on', async () => {
            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_123',
                status: 'active',
                planId: 'plan_basic',
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

            const mockPlan = createMockPlan({
                id: 'plan_basic',
                entitlements: [
                    EntitlementKey.PUBLISH_ACCOMMODATIONS,
                    EntitlementKey.FEATURED_LISTING
                ],
                limits: {}
            });

            vi.mocked(mockBilling.plans.get).mockResolvedValue(mockPlan);
            // @ts-expect-error - QZPay types don't include update but service uses it at runtime
            vi.mocked(mockBilling.plans.update).mockResolvedValue(mockPlan);
            vi.mocked(mockBilling.subscriptions.update).mockResolvedValue(mockSubscription);

            const result = await service.removeAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'visibility-boost-7d'
            });

            expect(result.success).toBe(true);

            // Verify plan was updated without featured listing
            // @ts-expect-error - QZPay types don't include update but service uses it at runtime
            expect(mockBilling.plans.update).toHaveBeenCalledWith('plan_basic', {
                entitlements: [EntitlementKey.PUBLISH_ACCOMMODATIONS],
                limits: {}
            });

            // Verify cache was cleared
            expect(entitlementMiddleware.clearEntitlementCache).toHaveBeenCalledWith('cust_123');
        });

        it('should remove adjustment from subscription metadata', async () => {
            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_123',
                status: 'active',
                planId: 'plan_basic',
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

            const mockPlan = createMockPlan({
                id: 'plan_basic',
                entitlements: [],
                limits: {
                    [LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]: 30,
                    [LimitKey.MAX_ACCOMMODATIONS]: 8
                }
            });

            vi.mocked(mockBilling.plans.get).mockResolvedValue(mockPlan);
            // @ts-expect-error - QZPay types don't include update but service uses it at runtime
            vi.mocked(mockBilling.plans.update).mockResolvedValue(mockPlan);
            vi.mocked(mockBilling.subscriptions.update).mockResolvedValue(mockSubscription);

            await service.removeAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'extra-photos-20'
            });

            // Verify subscription metadata was updated - should only have the other add-on
            const updateCall = vi.mocked(mockBilling.subscriptions.update).mock.calls[0];
            expect(updateCall).toBeDefined();

            const metadata = updateCall![1].metadata;
            expect(metadata).toBeDefined();

            const adjustments = JSON.parse(metadata!.addonAdjustments as string);
            expect(adjustments).toHaveLength(1);
            expect(adjustments[0].addonSlug).toBe('extra-accommodations-5');
        });

        it('should not go below 0 when removing limit', async () => {
            const mockSubscription = createMockSubscriptionWithHelpers({
                id: 'sub_123',
                status: 'active',
                planId: 'plan_basic',
                metadata: {}
            });

            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                mockSubscription
            ]);

            const mockPlan = createMockPlan({
                id: 'plan_basic',
                entitlements: [],
                limits: {
                    [LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]: 5 // Less than add-on increase
                }
            });

            vi.mocked(mockBilling.plans.get).mockResolvedValue(mockPlan);
            // @ts-expect-error - QZPay types don't include update but service uses it at runtime
            vi.mocked(mockBilling.plans.update).mockResolvedValue(mockPlan);
            vi.mocked(mockBilling.subscriptions.update).mockResolvedValue(mockSubscription);

            const result = await service.removeAddonEntitlements({
                customerId: 'cust_123',
                addonSlug: 'extra-photos-20' // Would decrease by 20
            });

            expect(result.success).toBe(true);

            // Verify limit doesn't go negative
            // @ts-expect-error - QZPay types don't include update but service uses it at runtime
            expect(mockBilling.plans.update).toHaveBeenCalledWith('plan_basic', {
                entitlements: [],
                limits: {
                    [LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]: 0 // Max(0, 5 - 20) = 0
                }
            });
        });
    });

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
                planId: 'plan_basic',
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
                planId: 'plan_basic',
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
    });
});
