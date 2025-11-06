/**
 * Advanced Service Tests - Complex Business Logic Testing
 *
 * This file demonstrates testing patterns for advanced services including:
 * - Transaction rollback scenarios
 * - Permission denial tests
 * - Complex business logic validation
 * - Multi-step operation testing
 * - Mocking complex dependencies
 * - Error handling verification
 *
 * @see packages/service-core/test/services/subscription/subscription.service.test.ts
 */

import { PricingPlanModel, PurchaseModel, SubscriptionModel } from '@repo/db';
import type { ClientIdType, PricingPlanIdType, SubscriptionIdType } from '@repo/schemas';
import { PermissionEnum, RoleEnum, ServiceErrorCode, SubscriptionStatusEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { createMockSubscription } from '../../factories/subscriptionFactory';
import { getMockId } from '../../factories/utilsFactory';
import { SubscriptionUpgradeService } from '../../../src/services/subscription/upgrade.service';

describe('SubscriptionUpgradeService - Advanced Scenarios', () => {
    let service: SubscriptionUpgradeService;
    let mockSubscriptionModel: SubscriptionModel;
    let mockPricingPlanModel: PricingPlanModel;
    let mockPurchaseModel: PurchaseModel;

    // Test actors with different permission levels
    const adminActor = createActor({
        id: getMockId('user', 'admin') as string,
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.SUBSCRIPTION_UPDATE]
    });

    const userActor = createActor({
        id: getMockId('user', 'u1') as string,
        role: RoleEnum.USER,
        permissions: [PermissionEnum.SUBSCRIPTION_UPDATE]
    });

    const unauthorizedActor = createActor({
        id: getMockId('user', 'u2') as string,
        role: RoleEnum.USER,
        permissions: [] // No permissions
    });

    const mockSubscription = createMockSubscription({
        id: getMockId('subscription', 's1') as SubscriptionIdType,
        clientId: userActor.id as ClientIdType,
        pricingPlanId: getMockId('pricingPlan', 'basic') as PricingPlanIdType,
        status: SubscriptionStatusEnum.ACTIVE,
        startAt: new Date('2024-01-01'),
        endAt: new Date('2024-01-31')
    });

    const mockBasicPlan = {
        id: getMockId('pricingPlan', 'basic') as PricingPlanIdType,
        name: 'Basic Plan',
        price: 100,
        isActive: true
    };

    const mockPremiumPlan = {
        id: getMockId('pricingPlan', 'premium') as PricingPlanIdType,
        name: 'Premium Plan',
        price: 200,
        isActive: true
    };

    beforeEach(() => {
        // Create mock models
        mockSubscriptionModel = new SubscriptionModel();
        mockPricingPlanModel = new PricingPlanModel();
        mockPurchaseModel = new PurchaseModel();

        // Mock subscription model methods
        vi.spyOn(mockSubscriptionModel, 'findById').mockResolvedValue(mockSubscription);
        vi.spyOn(mockSubscriptionModel, 'update').mockResolvedValue({
            ...mockSubscription,
            pricingPlanId: mockPremiumPlan.id
        });

        // Mock pricing plan model methods
        vi.spyOn(mockPricingPlanModel, 'findById').mockImplementation(async (id) => {
            if (id === mockBasicPlan.id) return mockBasicPlan as any;
            if (id === mockPremiumPlan.id) return mockPremiumPlan as any;
            return null;
        });

        // Mock purchase model methods
        vi.spyOn(mockPurchaseModel, 'create').mockResolvedValue({
            id: getMockId('purchase', 'p1'),
            clientId: userActor.id as ClientIdType,
            amount: 100,
            description: 'Test purchase'
        } as any);

        // Create service with mocked dependencies
        service = new SubscriptionUpgradeService({ logger: console });
        (service as any).subscriptionModel = mockSubscriptionModel;
        (service as any).pricingPlanModel = mockPricingPlanModel;
        (service as any).purchaseModel = mockPurchaseModel;
    });

    // ========================================================================
    // PERMISSION TESTS
    // ========================================================================

    describe('Permission Checks', () => {
        it('should allow admin to upgrade any subscription', async () => {
            // Arrange
            const upgradeData = {
                subscriptionId: mockSubscription.id,
                newPricingPlanId: mockPremiumPlan.id
            };

            // Act
            const result = await service.upgradeSubscription(adminActor, upgradeData);

            // Assert
            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
        });

        it('should allow user to upgrade their own subscription', async () => {
            // Arrange
            const upgradeData = {
                subscriptionId: mockSubscription.id,
                newPricingPlanId: mockPremiumPlan.id
            };

            // Act
            const result = await service.upgradeSubscription(userActor, upgradeData);

            // Assert
            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
        });

        it('should deny upgrade for user without permission', async () => {
            // Arrange
            const upgradeData = {
                subscriptionId: mockSubscription.id,
                newPricingPlanId: mockPremiumPlan.id
            };

            // Act
            const result = await service.upgradeSubscription(unauthorizedActor, upgradeData);

            // Assert
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(result.error?.message).toContain('Insufficient permissions');
        });

        it("should deny user upgrading another user's subscription", async () => {
            // Arrange
            const otherUserSubscription = createMockSubscription({
                id: getMockId('subscription', 's2') as SubscriptionIdType,
                clientId: getMockId('user', 'other') as ClientIdType // Different user
            });
            vi.spyOn(mockSubscriptionModel, 'findById').mockResolvedValue(otherUserSubscription);

            const upgradeData = {
                subscriptionId: otherUserSubscription.id,
                newPricingPlanId: mockPremiumPlan.id
            };

            // Act
            const result = await service.upgradeSubscription(userActor, upgradeData);

            // Assert
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(result.error?.message).toContain('only upgrade your own subscriptions');
        });
    });

    // ========================================================================
    // BUSINESS RULE VALIDATION TESTS
    // ========================================================================

    describe('Business Rule Validation', () => {
        it('should reject upgrade to same plan', async () => {
            // Arrange
            const upgradeData = {
                subscriptionId: mockSubscription.id,
                newPricingPlanId: mockBasicPlan.id // Same as current
            };

            // Act
            const result = await service.upgradeSubscription(userActor, upgradeData);

            // Assert
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.message).toContain('already on this plan');
        });

        it('should reject upgrade of cancelled subscription', async () => {
            // Arrange
            const cancelledSubscription = createMockSubscription({
                ...mockSubscription,
                status: SubscriptionStatusEnum.CANCELLED
            });
            vi.spyOn(mockSubscriptionModel, 'findById').mockResolvedValue(cancelledSubscription);

            const upgradeData = {
                subscriptionId: cancelledSubscription.id,
                newPricingPlanId: mockPremiumPlan.id
            };

            // Act
            const result = await service.upgradeSubscription(userActor, upgradeData);

            // Assert
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.message).toContain('Cannot upgrade cancelled subscription');
        });

        it('should reject downgrade during trial period', async () => {
            // Arrange
            const trialSubscription = createMockSubscription({
                ...mockSubscription,
                pricingPlanId: mockPremiumPlan.id,
                trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
            });
            vi.spyOn(mockSubscriptionModel, 'findById').mockResolvedValue(trialSubscription);

            const upgradeData = {
                subscriptionId: trialSubscription.id,
                newPricingPlanId: mockBasicPlan.id // Downgrade
            };

            // Act
            const result = await service.upgradeSubscription(userActor, upgradeData);

            // Assert
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.message).toContain('Cannot downgrade during trial');
        });

        it('should reject upgrade to inactive plan', async () => {
            // Arrange
            const inactivePlan = { ...mockPremiumPlan, isActive: false };
            vi.spyOn(mockPricingPlanModel, 'findById').mockResolvedValue(inactivePlan as any);

            const upgradeData = {
                subscriptionId: mockSubscription.id,
                newPricingPlanId: inactivePlan.id
            };

            // Act
            const result = await service.upgradeSubscription(userActor, upgradeData);

            // Assert
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.message).toContain('not available');
        });
    });

    // ========================================================================
    // TRANSACTION AND COMPLEX OPERATION TESTS
    // ========================================================================

    describe('Transaction Handling', () => {
        it('should successfully upgrade with charge', async () => {
            // Arrange
            const upgradeData = {
                subscriptionId: mockSubscription.id,
                newPricingPlanId: mockPremiumPlan.id
            };

            // Act
            const result = await service.upgradeSubscription(userActor, upgradeData);

            // Assert
            expect(result.data).toBeDefined();
            expect(result.data?.subscription.pricingPlanId).toBe(mockPremiumPlan.id);
            expect(result.data?.purchase).toBeDefined();
            expect(result.data?.purchase?.amount).toBeGreaterThan(0);
            expect(result.data?.message).toContain('upgraded');
        });

        it('should calculate prorated charge correctly', async () => {
            // Arrange
            // Subscription with 15 days remaining (half of 30-day cycle)
            const halfwaySubscription = createMockSubscription({
                ...mockSubscription,
                startAt: new Date('2024-01-01'),
                endAt: new Date('2024-01-31')
            });
            vi.spyOn(mockSubscriptionModel, 'findById').mockResolvedValue(halfwaySubscription);

            const upgradeData = {
                subscriptionId: halfwaySubscription.id,
                newPricingPlanId: mockPremiumPlan.id,
                effectiveDate: new Date('2024-01-16') // Halfway through month
            };

            // Act
            const result = await service.upgradeSubscription(userActor, upgradeData);

            // Assert
            expect(result.data).toBeDefined();
            // Prorated charge should be approximately (200-100) * (15/30) = 50
            expect(result.data?.purchase?.amount).toBeCloseTo(50, 0);
        });

        it('should handle downgrade with credit', async () => {
            // Arrange
            const premiumSubscription = createMockSubscription({
                ...mockSubscription,
                pricingPlanId: mockPremiumPlan.id
            });
            vi.spyOn(mockSubscriptionModel, 'findById').mockResolvedValue(premiumSubscription);

            const upgradeData = {
                subscriptionId: premiumSubscription.id,
                newPricingPlanId: mockBasicPlan.id // Downgrade
            };

            // Act
            const result = await service.upgradeSubscription(userActor, upgradeData);

            // Assert
            expect(result.data).toBeDefined();
            expect(result.data?.proratedCredit).toBeGreaterThan(0);
            expect(result.data?.message).toContain('downgraded');
        });

        it('should rollback on payment failure', async () => {
            // Arrange
            vi.spyOn(mockPurchaseModel, 'create').mockRejectedValue(
                new Error('Payment processing failed')
            );

            const upgradeData = {
                subscriptionId: mockSubscription.id,
                newPricingPlanId: mockPremiumPlan.id
            };

            // Act
            const result = await service.upgradeSubscription(userActor, upgradeData);

            // Assert
            expect(result.error).toBeDefined();
            // Verify subscription was NOT updated (transaction rolled back)
            const updatedSubscription = await mockSubscriptionModel.findById(mockSubscription.id);
            expect(updatedSubscription?.pricingPlanId).toBe(mockBasicPlan.id);
        });
    });

    // ========================================================================
    // ERROR HANDLING TESTS
    // ========================================================================

    describe('Error Handling', () => {
        it('should handle subscription not found', async () => {
            // Arrange
            vi.spyOn(mockSubscriptionModel, 'findById').mockResolvedValue(null);

            const upgradeData = {
                subscriptionId: 'non-existent-id',
                newPricingPlanId: mockPremiumPlan.id
            };

            // Act
            const result = await service.upgradeSubscription(userActor, upgradeData as any);

            // Assert
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
            expect(result.error?.message).toContain('Subscription not found');
        });

        it('should handle pricing plan not found', async () => {
            // Arrange
            vi.spyOn(mockPricingPlanModel, 'findById').mockResolvedValue(null);

            const upgradeData = {
                subscriptionId: mockSubscription.id,
                newPricingPlanId: 'non-existent-plan'
            };

            // Act
            const result = await service.upgradeSubscription(userActor, upgradeData as any);

            // Assert
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
            expect(result.error?.message).toContain('Pricing plan not found');
        });

        it('should handle database update failure', async () => {
            // Arrange
            vi.spyOn(mockSubscriptionModel, 'update').mockResolvedValue(null);

            const upgradeData = {
                subscriptionId: mockSubscription.id,
                newPricingPlanId: mockPremiumPlan.id
            };

            // Act
            const result = await service.upgradeSubscription(userActor, upgradeData);

            // Assert
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.DATABASE_ERROR);
        });
    });

    // ========================================================================
    // EDGE CASES
    // ========================================================================

    describe('Edge Cases', () => {
        it('should handle upgrade on last day of billing cycle', async () => {
            // Arrange
            const lastDaySubscription = createMockSubscription({
                ...mockSubscription,
                endAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
            });
            vi.spyOn(mockSubscriptionModel, 'findById').mockResolvedValue(lastDaySubscription);

            const upgradeData = {
                subscriptionId: lastDaySubscription.id,
                newPricingPlanId: mockPremiumPlan.id
            };

            // Act
            const result = await service.upgradeSubscription(userActor, upgradeData);

            // Assert
            expect(result.data).toBeDefined();
            // Should have minimal prorated charge
            expect(result.data?.purchase?.amount).toBeLessThan(10);
        });

        it('should handle immediate effective date', async () => {
            // Arrange
            const upgradeData = {
                subscriptionId: mockSubscription.id,
                newPricingPlanId: mockPremiumPlan.id,
                effectiveDate: new Date() // Immediate
            };

            // Act
            const result = await service.upgradeSubscription(userActor, upgradeData);

            // Assert
            expect(result.data).toBeDefined();
            expect(result.data?.subscription.pricingPlanId).toBe(mockPremiumPlan.id);
        });
    });
});
