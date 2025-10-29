import { SubscriptionStatusEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { SubscriptionModel } from '../../src/models/subscription/subscription.model';

// Define the Subscription type for testing
interface Subscription {
    id: string;
    clientId: string;
    pricingPlanId: string;
    status: string;
    startAt: Date;
    endAt?: Date | null;
    trialEndsAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
    createdById?: string;
    updatedById?: string;
    deletedAt?: Date | null;
    deletedById?: string | null;
    adminInfo?: any;
}

// Mock data
const mockSubscription: Subscription = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    clientId: '550e8400-e29b-41d4-a716-446655440002',
    pricingPlanId: '550e8400-e29b-41d4-a716-446655440003',
    status: SubscriptionStatusEnum.ACTIVE,
    startAt: new Date('2024-01-01T00:00:00Z'),
    endAt: new Date('2025-12-31T23:59:59Z'), // Future date
    trialEndsAt: new Date('2024-01-15T23:59:59Z'),
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    createdById: '550e8400-e29b-41d4-a716-446655440000',
    updatedById: '550e8400-e29b-41d4-a716-446655440000',
    deletedAt: undefined,
    deletedById: undefined,
    adminInfo: null
};

const mockExpiredSubscription: Subscription = {
    ...mockSubscription,
    id: '550e8400-e29b-41d4-a716-446655440004',
    status: SubscriptionStatusEnum.EXPIRED,
    endAt: new Date('2023-12-31T23:59:59Z')
};

vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('SubscriptionModel', () => {
    let subscriptionModel: SubscriptionModel;
    let mockDb: any;

    beforeEach(() => {
        subscriptionModel = new SubscriptionModel();
        mockDb = {
            select: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            innerJoin: vi.fn().mockReturnThis(),
            leftJoin: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis(),
            returning: vi.fn()
        };
        (dbUtils.getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);
        vi.clearAllMocks();
    });

    describe('getTableName', () => {
        it('should return correct table name', () => {
            const tableName = (subscriptionModel as any).getTableName();
            expect(tableName).toBe('subscriptions');
        });
    });

    describe('lifecycle methods', () => {
        describe('activate', () => {
            it('should activate a subscription', async () => {
                const subscriptionId = '550e8400-e29b-41d4-a716-446655440001';
                const startAt = new Date('2024-01-01T00:00:00Z');

                mockDb.returning.mockResolvedValue([
                    {
                        ...mockSubscription,
                        status: SubscriptionStatusEnum.ACTIVE,
                        startAt
                    }
                ]);

                const result = await subscriptionModel.activate(subscriptionId, startAt);

                expect(mockDb.update).toHaveBeenCalled();
                expect(mockDb.set).toHaveBeenCalledWith(
                    expect.objectContaining({
                        status: SubscriptionStatusEnum.ACTIVE,
                        startAt
                    })
                );
                expect(result).toEqual(
                    expect.objectContaining({
                        status: SubscriptionStatusEnum.ACTIVE,
                        startAt
                    })
                );
            });
        });

        describe('cancel', () => {
            it('should cancel a subscription', async () => {
                const subscriptionId = '550e8400-e29b-41d4-a716-446655440001';
                const cancelAt = new Date('2024-06-01T00:00:00Z');

                mockDb.returning.mockResolvedValue([
                    {
                        ...mockSubscription,
                        status: SubscriptionStatusEnum.CANCELLED,
                        endAt: cancelAt
                    }
                ]);

                const result = await subscriptionModel.cancel(subscriptionId, cancelAt);

                expect(mockDb.update).toHaveBeenCalled();
                expect(mockDb.set).toHaveBeenCalledWith(
                    expect.objectContaining({
                        status: SubscriptionStatusEnum.CANCELLED,
                        endAt: cancelAt
                    })
                );
                expect(result).toEqual(
                    expect.objectContaining({
                        status: SubscriptionStatusEnum.CANCELLED,
                        endAt: cancelAt
                    })
                );
            });
        });

        describe('renew', () => {
            it('should renew a subscription', async () => {
                const subscriptionId = '550e8400-e29b-41d4-a716-446655440001';
                const newEndAt = new Date('2025-12-31T23:59:59Z');

                mockDb.returning.mockResolvedValue([
                    {
                        ...mockSubscription,
                        endAt: newEndAt
                    }
                ]);

                const result = await subscriptionModel.renew(subscriptionId, newEndAt);

                expect(mockDb.update).toHaveBeenCalled();
                expect(mockDb.set).toHaveBeenCalledWith(
                    expect.objectContaining({
                        endAt: newEndAt
                    })
                );
                expect(result).toEqual(
                    expect.objectContaining({
                        endAt: newEndAt
                    })
                );
            });
        });
    });

    describe('business methods', () => {
        describe('isActive', () => {
            it('should return true for active subscription with future end date', async () => {
                // Mock findById
                subscriptionModel.findById = vi.fn().mockResolvedValue(mockSubscription);

                const result = await subscriptionModel.isActive(mockSubscription.id);

                expect(result).toBe(true);
            });

            it('should return false for expired subscription', async () => {
                subscriptionModel.findById = vi.fn().mockResolvedValue(mockExpiredSubscription);

                const result = await subscriptionModel.isActive(mockExpiredSubscription.id);

                expect(result).toBe(false);
            });

            it('should return false for non-existent subscription', async () => {
                subscriptionModel.findById = vi.fn().mockResolvedValue(null);

                const result = await subscriptionModel.isActive('non-existent-id');

                expect(result).toBe(false);
            });
        });

        describe('isTrialExpiring', () => {
            it('should return true for trial expiring within threshold', async () => {
                const trialEndingSoon = {
                    ...mockSubscription,
                    trialEndsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days from now
                };

                subscriptionModel.findById = vi.fn().mockResolvedValue(trialEndingSoon);

                const result = await subscriptionModel.isTrialExpiring(mockSubscription.id, 3);

                expect(result).toBe(true);
            });

            it('should return false for trial not expiring soon', async () => {
                const trialNotEndingSoon = {
                    ...mockSubscription,
                    trialEndsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) // 10 days from now
                };

                subscriptionModel.findById = vi.fn().mockResolvedValue(trialNotEndingSoon);

                const result = await subscriptionModel.isTrialExpiring(mockSubscription.id, 3);

                expect(result).toBe(false);
            });
        });

        describe('calculateNextBilling', () => {
            it('should calculate next billing for monthly plan', async () => {
                const mockResult = [
                    {
                        subscription: {
                            ...mockSubscription,
                            startAt: new Date('2024-01-01T00:00:00Z')
                        },
                        pricingPlan: {
                            billingInterval: 'MONTH'
                        }
                    }
                ];

                mockDb.limit = vi.fn().mockResolvedValue(mockResult);

                const result = await subscriptionModel.calculateNextBilling(mockSubscription.id);

                expect(result).toBeInstanceOf(Date);
                expect(result?.getMonth()).toBe(1); // February (0-indexed)
            });

            it('should return null for subscription without billing interval', async () => {
                const mockResult = [
                    {
                        subscription: mockSubscription,
                        pricingPlan: {
                            billingInterval: null
                        }
                    }
                ];

                mockDb.limit = vi.fn().mockResolvedValue(mockResult);

                const result = await subscriptionModel.calculateNextBilling(mockSubscription.id);

                expect(result).toBeNull();
            });
        });
    });

    describe('state management', () => {
        describe('canTransitionTo', () => {
            it('should allow valid transitions from ACTIVE', () => {
                const validTransitions = [
                    SubscriptionStatusEnum.PAST_DUE,
                    SubscriptionStatusEnum.CANCELLED,
                    SubscriptionStatusEnum.EXPIRED
                ];

                for (const targetStatus of validTransitions) {
                    const result = subscriptionModel.canTransitionTo(
                        SubscriptionStatusEnum.ACTIVE,
                        targetStatus
                    );
                    expect(result).toBe(true);
                }
            });

            it('should reject invalid transitions from CANCELLED', () => {
                const result = subscriptionModel.canTransitionTo(
                    SubscriptionStatusEnum.CANCELLED,
                    SubscriptionStatusEnum.ACTIVE
                );
                expect(result).toBe(false);
            });
        });

        describe('updateStatus', () => {
            it('should update status if transition is valid', async () => {
                subscriptionModel.findById = vi.fn().mockResolvedValue(mockSubscription);
                mockDb.returning.mockResolvedValue([
                    {
                        ...mockSubscription,
                        status: SubscriptionStatusEnum.PAST_DUE
                    }
                ]);

                const result = await subscriptionModel.updateStatus(
                    mockSubscription.id,
                    SubscriptionStatusEnum.PAST_DUE
                );

                expect(result).toEqual(
                    expect.objectContaining({
                        status: SubscriptionStatusEnum.PAST_DUE
                    })
                );
            });

            it('should throw error for invalid transition', async () => {
                const cancelledSubscription = {
                    ...mockSubscription,
                    status: SubscriptionStatusEnum.CANCELLED
                };

                subscriptionModel.findById = vi.fn().mockResolvedValue(cancelledSubscription);

                await expect(
                    subscriptionModel.updateStatus(
                        mockSubscription.id,
                        SubscriptionStatusEnum.ACTIVE
                    )
                ).rejects.toThrow('Invalid status transition');
            });
        });
    });

    describe('complex queries', () => {
        describe('findActive', () => {
            it('should find active subscriptions', async () => {
                mockDb.where = vi.fn().mockReturnValue([mockSubscription]);

                const result = await subscriptionModel.findActive();

                expect(mockDb.select).toHaveBeenCalled();
                expect(mockDb.where).toHaveBeenCalled();
                expect(result).toEqual([mockSubscription]);
            });
        });

        describe('findExpiring', () => {
            it('should find subscriptions expiring within threshold', async () => {
                mockDb.where = vi.fn().mockReturnValue([mockSubscription]);

                const result = await subscriptionModel.findExpiring(7);

                expect(mockDb.select).toHaveBeenCalled();
                expect(mockDb.where).toHaveBeenCalled();
                expect(result).toEqual([mockSubscription]);
            });
        });

        describe('findByClient', () => {
            it('should find subscriptions by client ID', async () => {
                mockDb.where = vi.fn().mockReturnValue([mockSubscription]);

                const result = await subscriptionModel.findByClient(mockSubscription.clientId);

                expect(mockDb.select).toHaveBeenCalled();
                expect(mockDb.where).toHaveBeenCalled();
                expect(result).toEqual([mockSubscription]);
            });
        });
    });
});
