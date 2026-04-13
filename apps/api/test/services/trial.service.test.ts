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
            cancel: vi.fn(),
            get: vi.fn()
        },
        customers: {
            get: vi.fn()
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
                name: 'owner-basico', // QZPay uses name as identifier
                monthlyPriceArs: 1500000
            };
            const mockSubscription = {
                id: 'sub-123',
                customerId,
                planId: mockPlan.id,
                status: 'trialing'
            };

            vi.spyOn(mockBilling.plans, 'list').mockResolvedValue({
                data: [mockPlan]
            } as never);
            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([] as never);
            vi.spyOn(mockBilling.subscriptions, 'create').mockResolvedValue(
                mockSubscription as never
            );

            // Act
            const result = await trialService.startTrial({
                customerId
            });

            // Assert
            expect(result).toBe('sub-123');
            expect(mockBilling.subscriptions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    customerId,
                    planId: mockPlan.id,
                    trialDays: 14,
                    metadata: expect.objectContaining({
                        autoStarted: 'true',
                        createdBy: 'trial-service'
                    })
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

            vi.spyOn(mockBilling.plans, 'list').mockResolvedValue({
                data: [{ id: 'plan-1', name: 'owner-basico' }]
            } as never);
            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                existingSubscription
            ] as never);

            // Act
            const result = await trialService.startTrial({
                customerId
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
                customerId: 'customer-123'
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
                name: 'owner-basico'
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
                planId: 'plan-owner-basico',
                status: 'trialing',
                trialStart: new Date(now.setDate(now.getDate() - 19)).toISOString(), // Started 19 days ago
                trialEnd: trialEnd.toISOString()
            };

            const mockPlan = {
                id: 'plan-owner-basico',
                name: 'owner-basico'
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
            expect(result.planSlug).toBe('owner-basico');
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
                name: 'owner-basico'
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
                planId: 'plan-owner-basico',
                status: 'trialing',
                trialEnd: trialEnd.toISOString()
            };

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                mockSubscription
            ] as never);
            vi.spyOn(mockBilling.plans, 'get').mockResolvedValue({
                id: 'plan-owner-basico',
                name: 'owner-basico'
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

            vi.spyOn(mockBilling.subscriptions, 'list').mockResolvedValue({
                data: mockSubscriptions
            } as never);
            vi.spyOn(mockBilling.subscriptions, 'cancel').mockResolvedValue({} as never);
            vi.spyOn(mockBilling.customers, 'get').mockResolvedValue({
                id: 'customer-1',
                email: 'test@example.com',
                metadata: { name: 'Test User', userId: 'user-1' }
            } as never);
            vi.spyOn(mockBilling.plans, 'get').mockResolvedValue({
                id: 'plan-1',
                name: 'Test Plan'
            } as never);

            // Act
            const result = await trialService.blockExpiredTrials();

            // Assert
            expect(result).toBe(2);
            expect(mockBilling.subscriptions.cancel).toHaveBeenCalledTimes(2);
            expect(mockBilling.subscriptions.cancel).toHaveBeenCalledWith('sub-expired-1');
            expect(mockBilling.subscriptions.cancel).toHaveBeenCalledWith('sub-expired-2');
        });

        it('should return 0 if no trialing subscriptions', async () => {
            // Arrange
            vi.spyOn(mockBilling.subscriptions, 'list').mockResolvedValue({
                data: []
            } as never);

            // Act
            const result = await trialService.blockExpiredTrials();

            // Assert
            expect(result).toBe(0);
            expect(mockBilling.subscriptions.cancel).not.toHaveBeenCalled();
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

            vi.spyOn(mockBilling.subscriptions, 'list').mockResolvedValue({
                data: mockSubscriptions
            } as never);
            vi.spyOn(mockBilling.customers, 'get')
                .mockRejectedValueOnce(new Error('Customer fetch failed'))
                .mockResolvedValueOnce({
                    id: 'customer-2',
                    email: 'test2@example.com',
                    metadata: { name: 'Test User 2', userId: 'user-2' }
                } as never);
            vi.spyOn(mockBilling.plans, 'get').mockResolvedValue({
                id: 'plan-1',
                name: 'Test Plan'
            } as never);
            vi.spyOn(mockBilling.subscriptions, 'cancel').mockResolvedValue({} as never);

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
                    metadata: expect.objectContaining({
                        convertedFromTrial: 'true'
                    })
                })
            );
        });

        it('should create subscription even if no existing trial', async () => {
            // Arrange
            const customerId = 'customer-456';
            const newPlanId = 'plan-owner-pro';

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

    describe('reconcileDuplicateSubscriptions', () => {
        it('should cancel the older subscription when two active subscriptions exist', async () => {
            // Arrange — simulate the GAP-012 scenario: cancel failed during upgrade,
            // leaving both the old trialing sub and the new active sub alive.
            const customerId = 'customer-dup-001';
            const olderCreatedAt = '2026-01-10T10:00:00.000Z';
            const newerCreatedAt = '2026-01-10T10:05:00.000Z';

            const olderTrialSub = {
                id: 'sub-old-trial',
                customerId,
                status: 'trialing',
                createdAt: olderCreatedAt
            };
            const newerActiveSub = {
                id: 'sub-new-active',
                customerId,
                status: 'active',
                createdAt: newerCreatedAt
            };

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                olderTrialSub,
                newerActiveSub
            ] as never);
            vi.spyOn(mockBilling.subscriptions, 'cancel').mockResolvedValue({} as never);

            // Act
            const result = await trialService.reconcileDuplicateSubscriptions({ customerId });

            // Assert — the older subscription (trialing) must be cancelled
            expect(result.cancelledCount).toBe(1);
            expect(result.cancelledIds).toContain('sub-old-trial');
            expect(result.keptId).toBe('sub-new-active');
            expect(mockBilling.subscriptions.cancel).toHaveBeenCalledTimes(1);
            expect(mockBilling.subscriptions.cancel).toHaveBeenCalledWith('sub-old-trial');
        });

        it('should cancel all older subscriptions when three or more active exist', async () => {
            // Arrange — edge case: three live subscriptions (e.g., retry storm)
            const customerId = 'customer-dup-002';

            const subs = [
                {
                    id: 'sub-a',
                    customerId,
                    status: 'active',
                    createdAt: '2026-01-10T09:00:00.000Z'
                },
                {
                    id: 'sub-b',
                    customerId,
                    status: 'active',
                    createdAt: '2026-01-10T09:30:00.000Z'
                },
                { id: 'sub-c', customerId, status: 'active', createdAt: '2026-01-10T10:00:00.000Z' }
            ];

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue(subs as never);
            vi.spyOn(mockBilling.subscriptions, 'cancel').mockResolvedValue({} as never);

            // Act
            const result = await trialService.reconcileDuplicateSubscriptions({ customerId });

            // Assert — sub-c (newest) is kept, sub-a and sub-b are cancelled
            expect(result.cancelledCount).toBe(2);
            expect(result.cancelledIds).toContain('sub-a');
            expect(result.cancelledIds).toContain('sub-b');
            expect(result.cancelledIds).not.toContain('sub-c');
            expect(result.keptId).toBe('sub-c');
        });

        it('should be a no-op when only one active subscription exists', async () => {
            // Arrange
            const customerId = 'customer-single-001';

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([
                {
                    id: 'sub-only',
                    customerId,
                    status: 'active',
                    createdAt: '2026-01-10T10:00:00.000Z'
                }
            ] as never);

            // Act
            const result = await trialService.reconcileDuplicateSubscriptions({ customerId });

            // Assert
            expect(result.cancelledCount).toBe(0);
            expect(result.cancelledIds).toHaveLength(0);
            expect(result.keptId).toBe('sub-only');
            expect(mockBilling.subscriptions.cancel).not.toHaveBeenCalled();
        });

        it('should be a no-op when the customer has no subscriptions', async () => {
            // Arrange
            const customerId = 'customer-empty-001';

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue([] as never);

            // Act
            const result = await trialService.reconcileDuplicateSubscriptions({ customerId });

            // Assert
            expect(result.cancelledCount).toBe(0);
            expect(result.cancelledIds).toHaveLength(0);
            expect(result.keptId).toBeNull();
            expect(mockBilling.subscriptions.cancel).not.toHaveBeenCalled();
        });

        it('should return null keptId and 0 cancelled when billing is disabled', async () => {
            // Arrange
            const trialServiceNoBilling = new TrialService(null);

            // Act
            const result = await trialServiceNoBilling.reconcileDuplicateSubscriptions({
                customerId: 'customer-123'
            });

            // Assert
            expect(result.cancelledCount).toBe(0);
            expect(result.cancelledIds).toHaveLength(0);
            expect(result.keptId).toBeNull();
        });

        it('should continue cancelling remaining duplicates if one cancel call fails', async () => {
            // Arrange — three live subs. After sorting descending by createdAt:
            //   duplicates iteration order: [sub-middle, sub-oldest]
            // First cancel call (sub-middle) fails; second (sub-oldest) succeeds.
            const customerId = 'customer-partial-fail';

            const subs = [
                {
                    id: 'sub-oldest',
                    customerId,
                    status: 'trialing',
                    createdAt: '2026-01-01T00:00:00.000Z'
                },
                {
                    id: 'sub-middle',
                    customerId,
                    status: 'trialing',
                    createdAt: '2026-01-02T00:00:00.000Z'
                },
                {
                    id: 'sub-newest',
                    customerId,
                    status: 'active',
                    createdAt: '2026-01-03T00:00:00.000Z'
                }
            ];

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue(subs as never);
            // Sorted descending: newest, middle, oldest → duplicates: [middle, oldest]
            // First call (sub-middle) fails, second call (sub-oldest) succeeds
            vi.spyOn(mockBilling.subscriptions, 'cancel')
                .mockRejectedValueOnce(new Error('Network timeout'))
                .mockResolvedValue({} as never);

            // Act
            const result = await trialService.reconcileDuplicateSubscriptions({ customerId });

            // Assert — sub-middle cancel failed (not counted), sub-oldest cancel succeeded
            expect(result.cancelledCount).toBe(1);
            expect(result.cancelledIds).toContain('sub-oldest');
            expect(result.cancelledIds).not.toContain('sub-middle');
            expect(result.keptId).toBe('sub-newest');
            // Both cancel calls were attempted despite first failure
            expect(mockBilling.subscriptions.cancel).toHaveBeenCalledTimes(2);
        });

        it('should ignore cancelled and non-live subscriptions when counting duplicates', async () => {
            // Arrange — one active + one already-cancelled: not a duplicate scenario
            const customerId = 'customer-mixed-001';

            const subs = [
                {
                    id: 'sub-canceled',
                    customerId,
                    status: 'canceled',
                    createdAt: '2026-01-01T00:00:00.000Z'
                },
                {
                    id: 'sub-active',
                    customerId,
                    status: 'active',
                    createdAt: '2026-01-10T00:00:00.000Z'
                }
            ];

            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId').mockResolvedValue(subs as never);

            // Act
            const result = await trialService.reconcileDuplicateSubscriptions({ customerId });

            // Assert — only one live subscription, no cancellation needed
            expect(result.cancelledCount).toBe(0);
            expect(result.keptId).toBe('sub-active');
            expect(mockBilling.subscriptions.cancel).not.toHaveBeenCalled();
        });

        it('should trigger reconciliation inside reactivateFromTrial when trial cancel fails', async () => {
            // Arrange — this is the exact GAP-012 scenario end-to-end
            const customerId = 'customer-gap012';
            const newPlanId = 'plan-owner-pro';

            const existingTrialSub = {
                id: 'sub-trial-gap012',
                customerId,
                status: 'trialing',
                createdAt: '2026-01-10T10:00:00.000Z'
            };
            const newActiveSub = {
                id: 'sub-active-gap012',
                customerId,
                planId: newPlanId,
                status: 'active',
                createdAt: '2026-01-10T10:05:00.000Z'
            };

            // getByCustomerId is called twice: once in reactivateFromTrial (before create),
            // once inside reconcileDuplicateSubscriptions (called after cancel fails)
            vi.spyOn(mockBilling.subscriptions, 'getByCustomerId')
                .mockResolvedValueOnce([existingTrialSub] as never)
                .mockResolvedValueOnce([existingTrialSub, newActiveSub] as never);

            vi.spyOn(mockBilling.subscriptions, 'create').mockResolvedValue(newActiveSub as never);

            // First cancel call (in reactivateFromTrial loop) fails
            // Second cancel call (in reconcileDuplicateSubscriptions) succeeds
            vi.spyOn(mockBilling.subscriptions, 'cancel')
                .mockRejectedValueOnce(new Error('QZPay timeout'))
                .mockResolvedValueOnce({} as never);

            // Act
            const resultId = await trialService.reactivateFromTrial({
                customerId,
                planId: newPlanId
            });

            // Assert — new subscription is returned AND reconciliation cancelled the duplicate
            expect(resultId).toBe('sub-active-gap012');
            expect(mockBilling.subscriptions.cancel).toHaveBeenCalledTimes(2);
            // First attempt (failed) in reactivateFromTrial loop
            expect(mockBilling.subscriptions.cancel).toHaveBeenNthCalledWith(1, 'sub-trial-gap012');
            // Second attempt (success) in reconcileDuplicateSubscriptions
            expect(mockBilling.subscriptions.cancel).toHaveBeenNthCalledWith(2, 'sub-trial-gap012');
        });
    });
});
