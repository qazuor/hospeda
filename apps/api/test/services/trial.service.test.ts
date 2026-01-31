/**
 * Trial Service Tests
 *
 * Tests for trial lifecycle management including:
 * - Trial creation
 * - Status checking
 * - Expiry detection
 * - Batch blocking
 * - Reactivation
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrialService } from '../../src/services/trial.service';

// Mock QZPay billing
const createMockBilling = () => {
    return {
        plans: {
            list: vi.fn(),
            get: vi.fn()
        },
        subscriptions: {
            create: vi.fn(),
            getByCustomerId: vi.fn(),
            list: vi.fn(),
            update: vi.fn(),
            cancel: vi.fn()
        }
    } as unknown as QZPayBilling;
};

describe('TrialService', () => {
    let trialService: TrialService;
    let mockBilling: QZPayBilling;

    beforeEach(() => {
        mockBilling = createMockBilling();
        trialService = new TrialService(mockBilling);
    });

    describe('startTrial', () => {
        it('should start trial for owner user', async () => {
            // Arrange
            const customerId = 'customer-123';
            const mockPlan = {
                id: 'plan-owner-basico',
                slug: 'owner-basico',
                name: 'Basico',
                monthlyPriceArs: 1500000
            };
            const mockSubscription = {
                id: 'sub-123',
                customerId,
                planId: mockPlan.id,
                status: 'trialing'
            };

            vi.spyOn(mockBilling.plans, 'list').mockResolvedValue([mockPlan] as never);
            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([] as never);
            vi.spyOn(mockBilling.subscriptions, 'create').mockResolvedValue(
                mockSubscription as never
            );

            // Act
            const result = await trialService.startTrial({
                customerId,
                userType: 'owner'
            });

            // Assert
            expect(result).toBe('sub-123');
            expect(mockBilling.subscriptions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    customerId,
                    planId: mockPlan.id,
                    status: 'trialing'
                })
            );
        });

        it('should start trial for complex user', async () => {
            // Arrange
            const customerId = 'customer-456';
            const mockPlan = {
                id: 'plan-complex-basico',
                slug: 'complex-basico',
                name: 'Complejo Basico',
                monthlyPriceArs: 5000000
            };
            const mockSubscription = {
                id: 'sub-456',
                customerId,
                planId: mockPlan.id,
                status: 'trialing'
            };

            vi.spyOn(mockBilling.plans, 'list').mockResolvedValue([mockPlan] as never);
            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([] as never);
            vi.spyOn(mockBilling.subscriptions, 'create').mockResolvedValue(
                mockSubscription as never
            );

            // Act
            const result = await trialService.startTrial({
                customerId,
                userType: 'complex'
            });

            // Assert
            expect(result).toBe('sub-456');
            expect(mockBilling.subscriptions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    customerId,
                    planId: mockPlan.id,
                    status: 'trialing'
                })
            );
        });

        it('should not start trial if user already has subscription', async () => {
            // Arrange
            const customerId = 'customer-789';
            const existingSubscription = {
                id: 'sub-existing',
                customerId,
                status: 'active'
            };

            vi.spyOn(mockBilling.plans, 'list').mockResolvedValue([
                { id: 'plan-1', slug: 'owner-basico' }
            ] as never);
            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                existingSubscription
            ] as never);

            // Act
            const result = await trialService.startTrial({
                customerId,
                userType: 'owner'
            });

            // Assert
            expect(result).toBeNull();
            expect(mockBilling.subscriptions.create).not.toHaveBeenCalled();
        });

        it('should return null if billing is not enabled', async () => {
            // Arrange
            const trialServiceNoBilling = new TrialService(null);

            // Act
            const result = await trialServiceNoBilling.startTrial({
                customerId: 'customer-123',
                userType: 'owner'
            });

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('getTrialStatus', () => {
        it('should return trial status for active trial', async () => {
            // Arrange
            const customerId = 'customer-123';
            const now = new Date();
            const trialEnd = new Date(now);
            trialEnd.setDate(trialEnd.getDate() + 7); // 7 days remaining

            const mockSubscription = {
                id: 'sub-123',
                customerId,
                planId: 'plan-owner-basico',
                status: 'trialing',
                trialStart: now.toISOString(),
                trialEnd: trialEnd.toISOString()
            };

            const mockPlan = {
                id: 'plan-owner-basico',
                slug: 'owner-basico'
            };

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                mockSubscription
            ] as never);
            vi.spyOn(mockBilling.plans, 'get').mockResolvedValue(mockPlan as never);

            // Act
            const result = await trialService.getTrialStatus({ customerId });

            // Assert
            expect(result.isOnTrial).toBe(true);
            expect(result.isExpired).toBe(false);
            expect(result.daysRemaining).toBeGreaterThan(6);
            expect(result.daysRemaining).toBeLessThanOrEqual(7);
            expect(result.planSlug).toBe('owner-basico');
        });

        it('should return expired status for expired trial', async () => {
            // Arrange
            const customerId = 'customer-456';
            const now = new Date();
            const trialEnd = new Date(now);
            trialEnd.setDate(trialEnd.getDate() - 5); // Expired 5 days ago

            const mockSubscription = {
                id: 'sub-456',
                customerId,
                planId: 'plan-complex-basico',
                status: 'trialing',
                trialStart: new Date(now.setDate(now.getDate() - 19)).toISOString(), // Started 19 days ago
                trialEnd: trialEnd.toISOString()
            };

            const mockPlan = {
                id: 'plan-complex-basico',
                slug: 'complex-basico'
            };

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                mockSubscription
            ] as never);
            vi.spyOn(mockBilling.plans, 'get').mockResolvedValue(mockPlan as never);

            // Act
            const result = await trialService.getTrialStatus({ customerId });

            // Assert
            expect(result.isOnTrial).toBe(true);
            expect(result.isExpired).toBe(true);
            expect(result.daysRemaining).toBe(0);
            expect(result.planSlug).toBe('complex-basico');
        });

        it('should return not on trial if no subscription', async () => {
            // Arrange
            const customerId = 'customer-789';

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([] as never);

            // Act
            const result = await trialService.getTrialStatus({ customerId });

            // Assert
            expect(result.isOnTrial).toBe(false);
            expect(result.isExpired).toBe(false);
            expect(result.daysRemaining).toBe(0);
            expect(result.planSlug).toBeNull();
        });

        it('should return safe default if billing disabled', async () => {
            // Arrange
            const trialServiceNoBilling = new TrialService(null);

            // Act
            const result = await trialServiceNoBilling.getTrialStatus({
                customerId: 'customer-123'
            });

            // Assert
            expect(result.isOnTrial).toBe(false);
            expect(result.isExpired).toBe(false);
            expect(result.daysRemaining).toBe(0);
            expect(result.planSlug).toBeNull();
        });
    });

    describe('checkTrialExpiry', () => {
        it('should return true for expired trial', async () => {
            // Arrange
            const customerId = 'customer-123';
            const now = new Date();
            const trialEnd = new Date(now);
            trialEnd.setDate(trialEnd.getDate() - 1); // Expired yesterday

            const mockSubscription = {
                id: 'sub-123',
                customerId,
                planId: 'plan-owner-basico',
                status: 'trialing',
                trialEnd: trialEnd.toISOString()
            };

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                mockSubscription
            ] as never);
            vi.spyOn(mockBilling.plans, 'get').mockResolvedValue({
                id: 'plan-owner-basico',
                slug: 'owner-basico'
            } as never);

            // Act
            const result = await trialService.checkTrialExpiry({ customerId });

            // Assert
            expect(result).toBe(true);
        });

        it('should return false for active trial', async () => {
            // Arrange
            const customerId = 'customer-456';
            const now = new Date();
            const trialEnd = new Date(now);
            trialEnd.setDate(trialEnd.getDate() + 5); // 5 days remaining

            const mockSubscription = {
                id: 'sub-456',
                customerId,
                planId: 'plan-complex-basico',
                status: 'trialing',
                trialEnd: trialEnd.toISOString()
            };

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                mockSubscription
            ] as never);
            vi.spyOn(mockBilling.plans, 'get').mockResolvedValue({
                id: 'plan-complex-basico',
                slug: 'complex-basico'
            } as never);

            // Act
            const result = await trialService.checkTrialExpiry({ customerId });

            // Assert
            expect(result).toBe(false);
        });
    });

    describe('blockExpiredTrials', () => {
        it('should block all expired trials', async () => {
            // Arrange
            const now = new Date();
            const expiredEnd1 = new Date(now);
            expiredEnd1.setDate(expiredEnd1.getDate() - 2);
            const expiredEnd2 = new Date(now);
            expiredEnd2.setDate(expiredEnd2.getDate() - 1);
            const activeEnd = new Date(now);
            activeEnd.setDate(activeEnd.getDate() + 5);

            const mockSubscriptions = [
                {
                    id: 'sub-expired-1',
                    customerId: 'customer-1',
                    status: 'trialing',
                    trialEnd: expiredEnd1.toISOString(),
                    metadata: {}
                },
                {
                    id: 'sub-expired-2',
                    customerId: 'customer-2',
                    status: 'trialing',
                    trialEnd: expiredEnd2.toISOString(),
                    metadata: {}
                },
                {
                    id: 'sub-active',
                    customerId: 'customer-3',
                    status: 'trialing',
                    trialEnd: activeEnd.toISOString(),
                    metadata: {}
                }
            ];

            vi.spyOn(mockBilling.subscriptions, 'list').mockResolvedValue(
                mockSubscriptions as never
            );
            vi.spyOn(mockBilling.subscriptions, 'update').mockResolvedValue({} as never);

            // Act
            const result = await trialService.blockExpiredTrials();

            // Assert
            expect(result).toBe(2);
            expect(mockBilling.subscriptions.update).toHaveBeenCalledTimes(2);
            expect(mockBilling.subscriptions.update).toHaveBeenCalledWith(
                'sub-expired-1',
                expect.objectContaining({
                    status: 'expired'
                })
            );
            expect(mockBilling.subscriptions.update).toHaveBeenCalledWith(
                'sub-expired-2',
                expect.objectContaining({
                    status: 'expired'
                })
            );
        });

        it('should return 0 if no trialing subscriptions', async () => {
            // Arrange
            vi.spyOn(mockBilling.subscriptions, 'list').mockResolvedValue([] as never);

            // Act
            const result = await trialService.blockExpiredTrials();

            // Assert
            expect(result).toBe(0);
            expect(mockBilling.subscriptions.update).not.toHaveBeenCalled();
        });

        it('should continue on individual update errors', async () => {
            // Arrange
            const now = new Date();
            const expiredEnd = new Date(now);
            expiredEnd.setDate(expiredEnd.getDate() - 1);

            const mockSubscriptions = [
                {
                    id: 'sub-error',
                    customerId: 'customer-1',
                    status: 'trialing',
                    trialEnd: expiredEnd.toISOString(),
                    metadata: {}
                },
                {
                    id: 'sub-success',
                    customerId: 'customer-2',
                    status: 'trialing',
                    trialEnd: expiredEnd.toISOString(),
                    metadata: {}
                }
            ];

            vi.spyOn(mockBilling.subscriptions, 'list').mockResolvedValue(
                mockSubscriptions as never
            );
            vi.spyOn(mockBilling.subscriptions, 'update')
                .mockRejectedValueOnce(new Error('Update failed'))
                .mockResolvedValueOnce({} as never);

            // Act
            const result = await trialService.blockExpiredTrials();

            // Assert
            expect(result).toBe(1); // Only one succeeded
        });
    });

    describe('reactivateFromTrial', () => {
        it('should cancel trial and create paid subscription', async () => {
            // Arrange
            const customerId = 'customer-123';
            const newPlanId = 'plan-owner-pro';

            const existingTrialSub = {
                id: 'sub-trial',
                customerId,
                status: 'trialing'
            };

            const newSubscription = {
                id: 'sub-paid',
                customerId,
                planId: newPlanId,
                status: 'active'
            };

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                existingTrialSub
            ] as never);
            vi.spyOn(mockBilling.subscriptions, 'cancel').mockResolvedValue({} as never);
            vi.spyOn(mockBilling.subscriptions, 'create').mockResolvedValue(
                newSubscription as never
            );

            // Act
            const result = await trialService.reactivateFromTrial({
                customerId,
                planId: newPlanId
            });

            // Assert
            expect(result).toBe('sub-paid');
            expect(mockBilling.subscriptions.cancel).toHaveBeenCalledWith('sub-trial');
            expect(mockBilling.subscriptions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    customerId,
                    planId: newPlanId,
                    status: 'active'
                })
            );
        });

        it('should create subscription even if no existing trial', async () => {
            // Arrange
            const customerId = 'customer-456';
            const newPlanId = 'plan-complex-pro';

            const newSubscription = {
                id: 'sub-paid',
                customerId,
                planId: newPlanId,
                status: 'active'
            };

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([] as never);
            vi.spyOn(mockBilling.subscriptions, 'create').mockResolvedValue(
                newSubscription as never
            );

            // Act
            const result = await trialService.reactivateFromTrial({
                customerId,
                planId: newPlanId
            });

            // Assert
            expect(result).toBe('sub-paid');
            expect(mockBilling.subscriptions.cancel).not.toHaveBeenCalled();
        });

        it('should throw error if billing disabled', async () => {
            // Arrange
            const trialServiceNoBilling = new TrialService(null);

            // Act & Assert
            await expect(
                trialServiceNoBilling.reactivateFromTrial({
                    customerId: 'customer-123',
                    planId: 'plan-123'
                })
            ).rejects.toThrow('Billing not enabled');
        });
    });
});
