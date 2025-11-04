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
});
