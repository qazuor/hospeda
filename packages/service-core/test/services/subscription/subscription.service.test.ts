import { SubscriptionModel } from '@repo/db';
import type { ClientIdType, SubscriptionIdType } from '@repo/schemas';
import { PermissionEnum, RoleEnum, ServiceErrorCode, SubscriptionStatusEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionService } from '../../../src/services/subscription/subscription.service';
import { createActor } from '../../factories/actorFactory';
import { createMockSubscription } from '../../factories/subscriptionFactory';
import { getMockId } from '../../factories/utilsFactory';

describe('SubscriptionService', () => {
    let service: SubscriptionService;
    let mockModel: SubscriptionModel;

    const mockSubscription = createMockSubscription({
        id: getMockId('subscription', 's1') as SubscriptionIdType,
        clientId: getMockId('client', 'c1') as ClientIdType,
        status: SubscriptionStatusEnum.ACTIVE
    });

    const adminActor = createActor({
        id: getMockId('user', 'admin') as string,
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.SUBSCRIPTION_CREATE,
            PermissionEnum.SUBSCRIPTION_UPDATE,
            PermissionEnum.SUBSCRIPTION_DELETE,
            PermissionEnum.SUBSCRIPTION_VIEW
        ]
    });

    const userActor = createActor({
        id: getMockId('user', 'u1') as string,
        role: RoleEnum.USER,
        permissions: [PermissionEnum.SUBSCRIPTION_VIEW]
    });

    beforeEach(() => {
        // Create mock model
        mockModel = new SubscriptionModel();

        // Mock model methods
        vi.spyOn(mockModel, 'create').mockResolvedValue(mockSubscription);
        vi.spyOn(mockModel, 'findById').mockResolvedValue(mockSubscription);
        vi.spyOn(mockModel, 'findOne').mockResolvedValue(mockSubscription);
        vi.spyOn(mockModel, 'findAll').mockResolvedValue({
            items: [mockSubscription],
            total: 1
        });
        vi.spyOn(mockModel, 'update').mockResolvedValue(mockSubscription);
        vi.spyOn(mockModel, 'softDelete').mockResolvedValue(1);
        vi.spyOn(mockModel, 'hardDelete').mockResolvedValue(1);
        vi.spyOn(mockModel, 'restore').mockResolvedValue(1);
        vi.spyOn(mockModel, 'count').mockResolvedValue(1);

        // Mock custom model methods
        vi.spyOn(mockModel, 'activate').mockResolvedValue(mockSubscription);
        vi.spyOn(mockModel, 'cancel').mockResolvedValue(mockSubscription);
        vi.spyOn(mockModel, 'renew').mockResolvedValue(mockSubscription);
        vi.spyOn(mockModel, 'isActive').mockResolvedValue(true);
        vi.spyOn(mockModel, 'findActive').mockResolvedValue([mockSubscription]);
        vi.spyOn(mockModel, 'findByClient').mockResolvedValue([mockSubscription]);
        vi.spyOn(mockModel, 'isTrialExpiring').mockResolvedValue(false);
        vi.spyOn(mockModel, 'calculateNextBilling').mockResolvedValue(new Date());
        vi.spyOn(mockModel, 'updateStatus').mockResolvedValue(mockSubscription);
        vi.spyOn(mockModel, 'findExpiring').mockResolvedValue([mockSubscription]);
        vi.spyOn(mockModel, 'withItems').mockResolvedValue({
            subscription: mockSubscription,
            items: []
        });

        // Create service with mocked model
        service = new SubscriptionService({ logger: console }, mockModel);
    });

    describe('Constructor', () => {
        it('should create service instance', () => {
            expect(service).toBeDefined();
            expect(service).toBeInstanceOf(SubscriptionService);
        });

        it('should have correct entity name', () => {
            expect((service as any).entityName).toBe('subscription');
        });
    });

    describe('create', () => {
        it('should create a new subscription with valid data', async () => {
            const createData = {
                clientId: getMockId('client', 'c2') as ClientIdType,
                pricingPlanId: getMockId('pricingPlan', 'pp1'),
                status: SubscriptionStatusEnum.ACTIVE,
                startAt: new Date(),
                endAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            };

            const result = await service.create(adminActor, createData);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            expect(mockModel.create).toHaveBeenCalled();
        });

        it('should throw ServiceError if actor lacks permission', async () => {
            const createData = {
                clientId: getMockId('client', 'c2') as ClientIdType,
                pricingPlanId: getMockId('pricingPlan', 'pp1'),
                status: SubscriptionStatusEnum.ACTIVE,
                startAt: new Date()
            };

            const result = await service.create(userActor, createData);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('update', () => {
        it('should update subscription with valid data', async () => {
            const updateData = {
                status: SubscriptionStatusEnum.PAUSED
            };

            const result = await service.update(adminActor, mockSubscription.id, updateData);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            expect(mockModel.update).toHaveBeenCalled();
        });

        it('should forbid non-admin without permission to update', async () => {
            const otherUserActor = createActor({
                id: getMockId('user', 'other') as string,
                role: RoleEnum.USER,
                permissions: []
            });

            const updateData = {
                status: SubscriptionStatusEnum.PAUSED
            };

            const result = await service.update(otherUserActor, mockSubscription.id, updateData);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('getById', () => {
        it('should retrieve subscription by id', async () => {
            const result = await service.getById(adminActor, mockSubscription.id);

            expect(result.data).toBeDefined();
            expect(result.data?.id).toBe(mockSubscription.id);
            expect(mockModel.findOne).toHaveBeenCalledWith({ id: mockSubscription.id });
        });

        it('should throw NOT_FOUND if subscription does not exist', async () => {
            vi.spyOn(mockModel, 'findOne').mockResolvedValue(null);

            const result = await service.getById(adminActor, 'non-existent-id');

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });
    });

    describe('list', () => {
        it('should list all subscriptions with pagination', async () => {
            const result = await service.list(adminActor, {
                page: 1,
                pageSize: 10
            });

            expect(result.data).toBeDefined();
            expect(result.data?.items).toHaveLength(1);
            expect(result.data?.total).toBe(1);
        });

        it('should allow any authenticated user to list subscriptions', async () => {
            const result = await service.list(userActor, {});

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
        });
    });

    describe('softDelete', () => {
        it('should soft delete subscription as admin', async () => {
            const result = await service.softDelete(adminActor, mockSubscription.id);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            expect(mockModel.softDelete).toHaveBeenCalled();
        });

        it('should forbid non-admin to soft delete', async () => {
            const result = await service.softDelete(userActor, mockSubscription.id);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('findByClient', () => {
        it('should find subscriptions by client id', async () => {
            const clientId = getMockId('client', 'c1') as ClientIdType;
            vi.spyOn(mockModel, 'findByClient').mockResolvedValue([mockSubscription]);

            const result = await service.findByClient(adminActor, clientId);

            expect(result.data).toBeDefined();
            expect(result.data).toHaveLength(1);
            expect(result.data?.[0].clientId).toBe(clientId);
        });

        it('should return empty array if no subscriptions found for client', async () => {
            const clientId = getMockId('client', 'c999') as ClientIdType;
            vi.spyOn(mockModel, 'findByClient').mockResolvedValue([]);

            const result = await service.findByClient(adminActor, clientId);

            expect(result.data).toBeDefined();
            expect(result.data).toHaveLength(0);
        });
    });

    describe('activate', () => {
        it('should activate subscription', async () => {
            const startAt = new Date();
            const result = await service.activate(adminActor, mockSubscription.id, startAt);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            expect(mockModel.activate).toHaveBeenCalledWith(
                mockSubscription.id,
                startAt,
                undefined
            );
        });

        it('should activate subscription without explicit start date', async () => {
            const result = await service.activate(adminActor, mockSubscription.id);

            expect(result.data).toBeDefined();
            expect(mockModel.activate).toHaveBeenCalledWith(
                mockSubscription.id,
                undefined,
                undefined
            );
        });

        it('should forbid non-admin to activate', async () => {
            const result = await service.activate(userActor, mockSubscription.id);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('cancel', () => {
        it('should cancel subscription', async () => {
            const cancelAt = new Date();
            const result = await service.cancel(adminActor, mockSubscription.id, cancelAt);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            expect(mockModel.cancel).toHaveBeenCalledWith(mockSubscription.id, cancelAt, undefined);
        });

        it('should cancel subscription without explicit cancel date', async () => {
            const result = await service.cancel(adminActor, mockSubscription.id);

            expect(result.data).toBeDefined();
            expect(mockModel.cancel).toHaveBeenCalledWith(
                mockSubscription.id,
                undefined,
                undefined
            );
        });

        it('should forbid non-admin to cancel', async () => {
            const result = await service.cancel(userActor, mockSubscription.id);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('renew', () => {
        it('should renew subscription', async () => {
            const newEndAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
            const result = await service.renew(adminActor, mockSubscription.id, newEndAt);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            expect(mockModel.renew).toHaveBeenCalledWith(mockSubscription.id, newEndAt, undefined);
        });

        it('should forbid non-admin to renew', async () => {
            const newEndAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
            const result = await service.renew(userActor, mockSubscription.id, newEndAt);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('checkIsActive', () => {
        it('should check if subscription is active', async () => {
            const result = await service.checkIsActive(adminActor, mockSubscription.id);

            expect(result.data).toBeDefined();
            expect(result.data?.isActive).toBe(true);
            expect(mockModel.isActive).toHaveBeenCalledWith(mockSubscription.id);
        });

        it('should return false when subscription is not active', async () => {
            vi.spyOn(mockModel, 'isActive').mockResolvedValue(false);

            const result = await service.checkIsActive(adminActor, mockSubscription.id);

            expect(result.data).toBeDefined();
            expect(result.data?.isActive).toBe(false);
        });
    });

    describe('findActive', () => {
        it('should find all active subscriptions', async () => {
            vi.spyOn(mockModel, 'findActive').mockResolvedValue([mockSubscription]);

            const result = await service.findActive(adminActor);

            expect(result.data).toBeDefined();
            expect(result.data).toHaveLength(1);
        });

        it('should return empty array if no active subscriptions', async () => {
            vi.spyOn(mockModel, 'findActive').mockResolvedValue([]);

            const result = await service.findActive(adminActor);

            expect(result.data).toBeDefined();
            expect(result.data).toHaveLength(0);
        });
    });

    describe('search', () => {
        it('should search subscriptions with filters', async () => {
            const searchParams = {
                status: SubscriptionStatusEnum.ACTIVE,
                page: 1,
                pageSize: 10
            };

            const result = await service.search(adminActor, searchParams);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
        });

        it('should handle empty search results', async () => {
            vi.spyOn(mockModel, 'findAll').mockResolvedValue({
                items: [],
                total: 0
            });

            const result = await service.search(adminActor, {
                status: SubscriptionStatusEnum.CANCELLED
            });

            expect(result.data).toBeDefined();
            expect(result.data?.items).toHaveLength(0);
        });
    });

    describe('count', () => {
        it('should count subscriptions matching criteria', async () => {
            const result = await service.count(adminActor, {});

            expect(result.data).toBeDefined();
            expect(result.data?.count).toBe(1);
        });
    });

    describe('checkTrialExpiring', () => {
        it('should check if trial is expiring', async () => {
            vi.spyOn(mockModel, 'isTrialExpiring').mockResolvedValue(true);

            const result = await service.checkTrialExpiring(adminActor, mockSubscription.id, 7);

            expect(result.data).toBeDefined();
            expect(result.data?.isExpiring).toBe(true);
            expect(mockModel.isTrialExpiring).toHaveBeenCalledWith(mockSubscription.id, 7);
        });

        it('should return false when trial is not expiring', async () => {
            vi.spyOn(mockModel, 'isTrialExpiring').mockResolvedValue(false);

            const result = await service.checkTrialExpiring(adminActor, mockSubscription.id, 7);

            expect(result.data).toBeDefined();
            expect(result.data?.isExpiring).toBe(false);
        });

        it('should forbid guest to check trial expiring', async () => {
            const guestActor = createActor({
                id: '',
                role: RoleEnum.GUEST,
                permissions: []
            });

            const result = await service.checkTrialExpiring(guestActor, mockSubscription.id, 7);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('getNextBillingDate', () => {
        it('should calculate next billing date', async () => {
            const nextBilling = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            vi.spyOn(mockModel, 'calculateNextBilling').mockResolvedValue(nextBilling);

            const result = await service.getNextBillingDate(adminActor, mockSubscription.id);

            expect(result.data).toBeDefined();
            expect(result.data?.nextBillingDate).toEqual(nextBilling);
            expect(mockModel.calculateNextBilling).toHaveBeenCalledWith(mockSubscription.id);
        });

        it('should return null when no next billing date', async () => {
            vi.spyOn(mockModel, 'calculateNextBilling').mockResolvedValue(null);

            const result = await service.getNextBillingDate(adminActor, mockSubscription.id);

            expect(result.data).toBeDefined();
            expect(result.data?.nextBillingDate).toBeNull();
        });

        it('should forbid guest to get next billing date', async () => {
            const guestActor = createActor({
                id: '',
                role: RoleEnum.GUEST,
                permissions: []
            });

            const result = await service.getNextBillingDate(guestActor, mockSubscription.id);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('updateStatus', () => {
        it('should update subscription status as admin', async () => {
            const updatedSubscription = {
                ...mockSubscription,
                status: SubscriptionStatusEnum.PAUSED
            };
            vi.spyOn(mockModel, 'updateStatus').mockResolvedValue(updatedSubscription);

            const result = await service.updateStatus(
                adminActor,
                mockSubscription.id,
                SubscriptionStatusEnum.PAUSED
            );

            expect(result.data).toBeDefined();
            expect(result.data?.status).toBe(SubscriptionStatusEnum.PAUSED);
            expect(mockModel.updateStatus).toHaveBeenCalledWith(
                mockSubscription.id,
                SubscriptionStatusEnum.PAUSED,
                undefined
            );
        });

        it('should throw NOT_FOUND when subscription does not exist', async () => {
            vi.spyOn(mockModel, 'updateStatus').mockResolvedValue(null);

            const result = await service.updateStatus(
                adminActor,
                'non-existent-id',
                SubscriptionStatusEnum.PAUSED
            );

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });

        it('should forbid non-admin to update status', async () => {
            const result = await service.updateStatus(
                userActor,
                mockSubscription.id,
                SubscriptionStatusEnum.PAUSED
            );

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('findExpiring', () => {
        it('should find expiring subscriptions', async () => {
            const expiringSubscription = {
                ...mockSubscription,
                endAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
            };
            vi.spyOn(mockModel, 'findExpiring').mockResolvedValue([expiringSubscription]);

            const result = await service.findExpiring(adminActor, 7);

            expect(result.data).toBeDefined();
            expect(result.data).toHaveLength(1);
            expect(mockModel.findExpiring).toHaveBeenCalledWith(7);
        });

        it('should return empty array when no subscriptions expiring', async () => {
            vi.spyOn(mockModel, 'findExpiring').mockResolvedValue([]);

            const result = await service.findExpiring(adminActor, 7);

            expect(result.data).toBeDefined();
            expect(result.data).toHaveLength(0);
        });

        it('should forbid guest to find expiring subscriptions', async () => {
            const guestActor = createActor({
                id: '',
                role: RoleEnum.GUEST,
                permissions: []
            });

            const result = await service.findExpiring(guestActor, 7);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('getWithItems', () => {
        it('should get subscription with items', async () => {
            const mockItems = [
                { id: 'item1', subscriptionId: mockSubscription.id, quantity: 1 },
                { id: 'item2', subscriptionId: mockSubscription.id, quantity: 2 }
            ];
            vi.spyOn(mockModel, 'withItems').mockResolvedValue({
                subscription: mockSubscription,
                items: mockItems
            });

            const result = await service.getWithItems(adminActor, mockSubscription.id);

            expect(result.data).toBeDefined();
            expect(result.data?.subscription).toBeDefined();
            expect(result.data?.items).toHaveLength(2);
            expect(mockModel.withItems).toHaveBeenCalledWith(mockSubscription.id);
        });

        it('should return null when subscription not found', async () => {
            vi.spyOn(mockModel, 'withItems').mockResolvedValue(null);

            const result = await service.getWithItems(adminActor, 'non-existent-id');

            expect(result.data).toBeNull();
        });

        it('should get subscription with empty items array', async () => {
            vi.spyOn(mockModel, 'withItems').mockResolvedValue({
                subscription: mockSubscription,
                items: []
            });

            const result = await service.getWithItems(adminActor, mockSubscription.id);

            expect(result.data).toBeDefined();
            expect(result.data?.items).toHaveLength(0);
        });

        it('should forbid guest to get subscription with items', async () => {
            const guestActor = createActor({
                id: '',
                role: RoleEnum.GUEST,
                permissions: []
            });

            const result = await service.getWithItems(guestActor, mockSubscription.id);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });
});
