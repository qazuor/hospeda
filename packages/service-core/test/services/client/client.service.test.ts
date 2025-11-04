import { ClientModel } from '@repo/db';
import type { ClientIdType, UserIdType } from '@repo/schemas';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientService } from '../../../src/services/client/client.service';
import { createActor } from '../../factories/actorFactory';
import { createMockClient } from '../../factories/clientFactory';
import { getMockId } from '../../factories/utilsFactory';

describe('ClientService', () => {
    let service: ClientService;
    let mockModel: ClientModel;

    const mockClient = createMockClient({
        id: getMockId('client', 'c1') as ClientIdType,
        name: 'Test Client',
        billingEmail: 'test@client.com',
        userId: getMockId('user', 'u1') as UserIdType
    });

    const adminActor = createActor({
        id: getMockId('user', 'admin') as UserIdType,
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.CLIENT_CREATE,
            PermissionEnum.CLIENT_UPDATE,
            PermissionEnum.CLIENT_DELETE,
            PermissionEnum.CLIENT_VIEW
        ]
    });

    const userActor = createActor({
        id: getMockId('user', 'u1') as UserIdType,
        role: RoleEnum.USER,
        permissions: [PermissionEnum.CLIENT_VIEW]
    });

    beforeEach(() => {
        // Create mock model
        mockModel = new ClientModel();

        // Mock model methods
        vi.spyOn(mockModel, 'create').mockResolvedValue(mockClient);
        vi.spyOn(mockModel, 'findById').mockResolvedValue(mockClient);
        vi.spyOn(mockModel, 'findOne').mockResolvedValue(mockClient);
        vi.spyOn(mockModel, 'findAll').mockResolvedValue({
            items: [mockClient],
            total: 1
        });
        vi.spyOn(mockModel, 'update').mockResolvedValue(mockClient);
        vi.spyOn(mockModel, 'softDelete').mockResolvedValue(1);
        vi.spyOn(mockModel, 'hardDelete').mockResolvedValue(1);
        vi.spyOn(mockModel, 'restore').mockResolvedValue(1);
        vi.spyOn(mockModel, 'count').mockResolvedValue(1);

        // Create service with mocked model
        service = new ClientService({ logger: console }, mockModel);
    });

    describe('Constructor', () => {
        it('should create service instance', () => {
            expect(service).toBeDefined();
            expect(service).toBeInstanceOf(ClientService);
        });

        it('should have correct entity name', () => {
            expect((service as any).entityName).toBe('client');
        });
    });

    describe('create', () => {
        it('should create a new client with valid data', async () => {
            const createData = {
                name: 'New Client',
                billingEmail: 'new@client.com',
                userId: getMockId('user', 'u2') as UserIdType,
                defaultCurrency: 'ARS' as const,
                billingCycle: 'MONTHLY' as const,
                autoRenew: true,
                isActive: true
            };

            const result = await service.create(adminActor, createData);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            expect(mockModel.create).toHaveBeenCalled();
        });

        it('should throw ServiceError if actor lacks permission', async () => {
            const createData = {
                name: 'New Client',
                billingEmail: 'new@client.com',
                userId: getMockId('user', 'u2') as UserIdType,
                defaultCurrency: 'ARS' as const,
                billingCycle: 'MONTHLY' as const,
                autoRenew: true,
                isActive: true
            };

            const result = await service.create(userActor, createData);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('update', () => {
        it('should update client with valid data', async () => {
            const updateData = {
                name: 'Updated Client'
            };

            const result = await service.update(adminActor, mockClient.id, updateData);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            expect(mockModel.update).toHaveBeenCalled();
        });

        it('should allow owner to update their own client', async () => {
            const ownerActor = createActor({
                id: mockClient.userId!,
                role: RoleEnum.USER,
                permissions: [PermissionEnum.CLIENT_UPDATE]
            });

            const updateData = {
                name: 'Updated by Owner'
            };

            const result = await service.update(ownerActor, mockClient.id, updateData);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
        });

        it('should forbid non-owner without permission to update', async () => {
            const otherUserActor = createActor({
                id: getMockId('user', 'other') as UserIdType,
                role: RoleEnum.USER,
                permissions: []
            });

            const updateData = {
                name: 'Unauthorized Update'
            };

            const result = await service.update(otherUserActor, mockClient.id, updateData);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('getById', () => {
        it('should retrieve client by id', async () => {
            const result = await service.getById(adminActor, mockClient.id);

            expect(result.data).toBeDefined();
            expect(result.data?.id).toBe(mockClient.id);
            expect(mockModel.findOne).toHaveBeenCalledWith({ id: mockClient.id });
        });

        it('should throw NOT_FOUND if client does not exist', async () => {
            vi.spyOn(mockModel, 'findOne').mockResolvedValue(null);

            const result = await service.getById(adminActor, 'non-existent-id');

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });
    });

    describe('list', () => {
        it('should list all clients with pagination', async () => {
            const result = await service.list(adminActor, {
                page: 1,
                pageSize: 10
            });

            expect(result.data).toBeDefined();
            expect(result.data?.items).toHaveLength(1);
            expect(result.data?.total).toBe(1);
        });

        it('should allow any authenticated user to list clients', async () => {
            const result = await service.list(userActor, {});

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
        });
    });

    describe('softDelete', () => {
        it('should soft delete client as admin', async () => {
            const result = await service.softDelete(adminActor, mockClient.id);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            expect(mockModel.softDelete).toHaveBeenCalled();
        });

        it('should forbid non-admin to soft delete', async () => {
            const result = await service.softDelete(userActor, mockClient.id);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('findByUser', () => {
        it('should find client by user id', async () => {
            const userId = getMockId('user', 'u1') as UserIdType;
            vi.spyOn(mockModel, 'findByUser').mockResolvedValue(mockClient);

            const result = await service.findByUser(adminActor, userId);

            expect(result.data).toBeDefined();
            expect(result.data?.userId).toBe(userId);
            expect(mockModel.findByUser).toHaveBeenCalledWith(userId);
        });

        it('should return null if no client found for user', async () => {
            const userId = getMockId('user', 'u999') as UserIdType;
            vi.spyOn(mockModel, 'findByUser').mockResolvedValue(null);

            const result = await service.findByUser(adminActor, userId);

            expect(result.data).toBeNull();
            expect(result.error).toBeUndefined();
        });
    });

    describe('getBillingStats', () => {
        it('should return billing statistics for client', async () => {
            const mockStats = {
                totalInvoices: 10,
                totalPaid: 8,
                totalOverdue: 2,
                totalAmount: 10000,
                paidAmount: 8000,
                overdueAmount: 2000
            };

            vi.spyOn(mockModel, 'getBillingStats').mockResolvedValue(mockStats);

            const result = await service.getBillingStats(adminActor, mockClient.id);

            expect(result.data).toBeDefined();
            expect(result.data?.totalInvoices).toBe(10);
            expect(result.data?.totalAmount).toBe(10000);
        });

        it('should allow owner to view their own billing stats', async () => {
            const ownerActor = createActor({
                id: mockClient.userId!,
                role: RoleEnum.USER,
                permissions: []
            });

            const mockStats = {
                totalInvoices: 5,
                totalPaid: 5,
                totalOverdue: 0,
                totalAmount: 5000,
                paidAmount: 5000,
                overdueAmount: 0
            };

            vi.spyOn(mockModel, 'getBillingStats').mockResolvedValue(mockStats);

            const result = await service.getBillingStats(ownerActor, mockClient.id);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
        });
    });

    describe('hasActiveSubscriptions', () => {
        it('should check if client has active subscriptions', async () => {
            vi.spyOn(mockModel, 'hasActiveSubscriptions').mockResolvedValue(true);

            const result = await service.hasActiveSubscriptions(adminActor, mockClient.id);

            expect(result.data).toBeDefined();
            expect(result.data?.hasActive).toBe(true);
        });

        it('should return false when no active subscriptions', async () => {
            vi.spyOn(mockModel, 'hasActiveSubscriptions').mockResolvedValue(false);

            const result = await service.hasActiveSubscriptions(adminActor, mockClient.id);

            expect(result.data).toBeDefined();
            expect(result.data?.hasActive).toBe(false);
        });
    });

    describe('findWithActiveSubscriptions', () => {
        it('should find clients with active subscriptions', async () => {
            const mockClients = [mockClient];
            vi.spyOn(mockModel, 'findWithActiveSubscriptions').mockResolvedValue(mockClients);

            const result = await service.findWithActiveSubscriptions(adminActor);

            expect(result.data).toBeDefined();
            expect(result.data).toHaveLength(1);
            expect(mockModel.findWithActiveSubscriptions).toHaveBeenCalled();
        });

        it('should return empty array if no clients with active subscriptions', async () => {
            vi.spyOn(mockModel, 'findWithActiveSubscriptions').mockResolvedValue([]);

            const result = await service.findWithActiveSubscriptions(adminActor);

            expect(result.data).toBeDefined();
            expect(result.data).toHaveLength(0);
        });
    });

    describe('search', () => {
        it('should search clients with filters', async () => {
            const searchParams = {
                name: 'Test',
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
                name: 'NonExistent'
            });

            expect(result.data).toBeDefined();
            expect(result.data?.items).toHaveLength(0);
        });
    });

    describe('count', () => {
        it('should count clients matching criteria', async () => {
            const result = await service.count(adminActor, {});

            expect(result.data).toBeDefined();
            expect(result.data?.count).toBe(1);
        });
    });
});
