import { ProfessionalServiceOrderModel } from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode, ServiceOrderStatusEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfessionalServiceOrderService } from '../../../src/services/professionalServiceOrder/professionalServiceOrder.service.js';
import { createActor } from '../../factories/actorFactory.js';
import {
    createMockCompletedServiceOrder,
    createMockInProgressServiceOrder,
    createMockServiceOrder
} from '../../factories/serviceOrderFactory.js';
import { getMockId } from '../../factories/utilsFactory.js';
import { createMockLogger } from '../../utils/mockLogger.js';

describe('ProfessionalServiceOrderService', () => {
    let service: ProfessionalServiceOrderService;
    let mockModel: ProfessionalServiceOrderModel;

    const mockServiceOrder = createMockServiceOrder({
        id: getMockId('serviceOrder', 'so1'),
        status: ServiceOrderStatusEnum.PENDING
    });

    const adminActor = createActor({
        id: getMockId('user', 'admin') as string,
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.SERVICE_ORDER_CREATE,
            PermissionEnum.SERVICE_ORDER_UPDATE,
            PermissionEnum.SERVICE_ORDER_DELETE,
            PermissionEnum.SERVICE_ORDER_VIEW,
            PermissionEnum.SERVICE_ORDER_HARD_DELETE,
            PermissionEnum.SERVICE_ORDER_RESTORE
        ]
    });

    const userActor = createActor({
        id: getMockId('user', 'u1') as string,
        role: RoleEnum.USER,
        permissions: [PermissionEnum.SERVICE_ORDER_VIEW]
    });

    beforeEach(() => {
        // Create mock model
        mockModel = new ProfessionalServiceOrderModel();

        // Mock base CRUD methods
        vi.spyOn(mockModel, 'create').mockResolvedValue(mockServiceOrder);
        vi.spyOn(mockModel, 'findById').mockResolvedValue(mockServiceOrder);
        vi.spyOn(mockModel, 'findOne').mockResolvedValue(mockServiceOrder);
        vi.spyOn(mockModel, 'findAll').mockResolvedValue({
            items: [mockServiceOrder],
            total: 1
        });
        vi.spyOn(mockModel, 'update').mockResolvedValue(mockServiceOrder);
        vi.spyOn(mockModel, 'softDelete').mockResolvedValue(1);
        vi.spyOn(mockModel, 'hardDelete').mockResolvedValue(1);
        vi.spyOn(mockModel, 'restore').mockResolvedValue(1);
        vi.spyOn(mockModel, 'count').mockResolvedValue(1);

        // Mock custom model methods
        vi.spyOn(mockModel, 'findByClient').mockResolvedValue([mockServiceOrder]);
        vi.spyOn(mockModel, 'findByServiceType').mockResolvedValue([mockServiceOrder]);
        vi.spyOn(mockModel, 'findByStatus').mockResolvedValue([mockServiceOrder]);
        vi.spyOn(mockModel, 'startOrder').mockResolvedValue(
            createMockInProgressServiceOrder({ id: mockServiceOrder.id })
        );
        vi.spyOn(mockModel, 'completeOrder').mockResolvedValue(
            createMockCompletedServiceOrder({ id: mockServiceOrder.id })
        );
        vi.spyOn(mockModel, 'cancelOrder').mockResolvedValue({
            ...mockServiceOrder,
            status: ServiceOrderStatusEnum.CANCELLED
        });
        vi.spyOn(mockModel, 'refundOrder').mockResolvedValue({
            ...mockServiceOrder,
            status: ServiceOrderStatusEnum.REFUNDED
        });

        // Create service with mocked model
        service = new ProfessionalServiceOrderService({ logger: createMockLogger() }, mockModel);
    });

    describe('Constructor', () => {
        it('should create service instance', () => {
            expect(service).toBeDefined();
            expect(service).toBeInstanceOf(ProfessionalServiceOrderService);
        });

        it('should have correct entity name', () => {
            expect((service as any).entityName).toBe('professional-service-order');
        });
    });

    describe('create', () => {
        it('should create a new service order with valid data', async () => {
            const createData = {
                clientId: getMockId('client', 'c1'),
                serviceTypeId: getMockId('professionalService', 'ps1'),
                pricingPlanId: getMockId('pricingPlan', 'pp1'),
                status: ServiceOrderStatusEnum.PENDING,
                orderedAt: new Date(),
                clientRequirements: 'Test requirements for service order creation',
                pricing: {
                    baseAmount: 100000,
                    additionalCharges: 0,
                    discountAmount: 0,
                    totalAmount: 100000,
                    currency: 'ARS',
                    taxAmount: 21000,
                    finalAmount: 121000
                }
            };

            const result = await service.create(adminActor, createData);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            expect(mockModel.create).toHaveBeenCalled();
        });

        it('should throw ServiceError if actor lacks permission', async () => {
            const createData = {
                clientId: getMockId('client', 'c1'),
                serviceTypeId: getMockId('professionalService', 'ps1'),
                pricingPlanId: getMockId('pricingPlan', 'pp1'),
                status: ServiceOrderStatusEnum.PENDING,
                orderedAt: new Date(),
                clientRequirements: 'Test requirements',
                pricing: {
                    baseAmount: 100000,
                    additionalCharges: 0,
                    discountAmount: 0,
                    totalAmount: 100000,
                    currency: 'ARS',
                    taxAmount: 21000,
                    finalAmount: 121000
                }
            };

            const result = await service.create(userActor, createData);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('update', () => {
        it('should update service order with valid data', async () => {
            const updateData = {
                notes: 'Updated notes'
            };

            const result = await service.update(adminActor, mockServiceOrder.id, updateData);

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
                notes: 'Updated notes'
            };

            const result = await service.update(otherUserActor, mockServiceOrder.id, updateData);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('getById', () => {
        it('should retrieve service order by id', async () => {
            const result = await service.getById(adminActor, mockServiceOrder.id);

            expect(result.data).toBeDefined();
            expect(result.data?.id).toBe(mockServiceOrder.id);
            expect(mockModel.findOne).toHaveBeenCalledWith({ id: mockServiceOrder.id });
        });

        it('should throw NOT_FOUND if service order does not exist', async () => {
            vi.spyOn(mockModel, 'findOne').mockResolvedValue(null);

            const result = await service.getById(adminActor, 'non-existent-id');

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });
    });

    describe('list', () => {
        it('should list all service orders with pagination', async () => {
            const result = await service.list(adminActor, {
                page: 1,
                pageSize: 10
            });

            expect(result.data).toBeDefined();
            expect(result.data?.items).toHaveLength(1);
            expect(result.data?.total).toBe(1);
        });

        it('should allow any user with VIEW permission to list service orders', async () => {
            const result = await service.list(userActor, {});

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
        });
    });

    describe('softDelete', () => {
        it('should soft delete service order as admin', async () => {
            const result = await service.softDelete(adminActor, mockServiceOrder.id);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            expect(mockModel.softDelete).toHaveBeenCalled();
        });

        it('should forbid non-admin to soft delete', async () => {
            const result = await service.softDelete(userActor, mockServiceOrder.id);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('hardDelete', () => {
        it('should hard delete service order as admin with HARD_DELETE permission', async () => {
            const result = await service.hardDelete(adminActor, mockServiceOrder.id);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            expect(mockModel.hardDelete).toHaveBeenCalled();
        });

        it('should forbid user without HARD_DELETE permission', async () => {
            const result = await service.hardDelete(userActor, mockServiceOrder.id);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('restore', () => {
        it('should restore soft-deleted service order', async () => {
            // Mock a soft-deleted service order (with deletedAt set)
            const deletedServiceOrder = {
                ...mockServiceOrder,
                deletedAt: new Date()
            };
            vi.spyOn(mockModel, 'findById').mockResolvedValueOnce(deletedServiceOrder);

            const result = await service.restore(adminActor, mockServiceOrder.id);

            expect(result.data).toBeDefined();
            expect(result.data?.count).toBe(1);
            expect(result.error).toBeUndefined();
        });

        it('should forbid user without RESTORE permission', async () => {
            const result = await service.restore(userActor, mockServiceOrder.id);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('search', () => {
        it('should search service orders with filters', async () => {
            const searchParams = {
                status: ServiceOrderStatusEnum.PENDING,
                page: 1,
                pageSize: 10,
                sortBy: 'createdAt' as const,
                sortOrder: 'desc' as const,
                includeService: false,
                includeDeliverables: false
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
                status: ServiceOrderStatusEnum.CANCELLED,
                page: 1,
                pageSize: 10,
                sortBy: 'createdAt' as const,
                sortOrder: 'desc' as const,
                includeService: false,
                includeDeliverables: false
            });

            expect(result.data).toBeDefined();
            expect(result.data?.items).toHaveLength(0);
        });
    });

    describe('count', () => {
        it('should count service orders matching criteria', async () => {
            const result = await service.count(adminActor, {
                page: 1,
                pageSize: 10,
                sortBy: 'createdAt' as const,
                sortOrder: 'desc' as const,
                includeService: false,
                includeDeliverables: false
            });

            expect(result.data).toBeDefined();
            expect(result.data?.count).toBe(1);
        });

        it('should count with status filter', async () => {
            const result = await service.count(adminActor, {
                status: ServiceOrderStatusEnum.COMPLETED,
                page: 1,
                pageSize: 10,
                sortBy: 'createdAt' as const,
                sortOrder: 'desc' as const,
                includeService: false,
                includeDeliverables: false
            });

            expect(result.data).toBeDefined();
            expect(mockModel.count).toHaveBeenCalled();
        });
    });

    describe('Business Logic Methods', () => {
        describe('findByClient', () => {
            it('should find all service orders for a specific client', async () => {
                const clientId = getMockId('client', 'c1');
                const result = await service.findByClient(clientId);

                expect(result.data).toBeDefined();
                expect(result.data).toHaveLength(1);
                expect(mockModel.findByClient).toHaveBeenCalledWith(clientId);
            });

            it('should return empty array if no orders found for client', async () => {
                vi.spyOn(mockModel, 'findByClient').mockResolvedValue([]);

                const result = await service.findByClient('non-existent-client');

                expect(result.data).toBeDefined();
                expect(result.data).toHaveLength(0);
            });
        });

        describe('findByServiceType', () => {
            it('should find all service orders for a specific service type', async () => {
                const serviceTypeId = getMockId('professionalService', 'ps1');
                const result = await service.findByServiceType(serviceTypeId);

                expect(result.data).toBeDefined();
                expect(result.data).toHaveLength(1);
                expect(mockModel.findByServiceType).toHaveBeenCalledWith(serviceTypeId);
            });

            it('should return empty array if no orders found for service type', async () => {
                vi.spyOn(mockModel, 'findByServiceType').mockResolvedValue([]);

                const result = await service.findByServiceType('non-existent-service');

                expect(result.data).toBeDefined();
                expect(result.data).toHaveLength(0);
            });
        });

        describe('findByStatus', () => {
            it('should find all service orders with PENDING status', async () => {
                const result = await service.findByStatus(ServiceOrderStatusEnum.PENDING);

                expect(result.data).toBeDefined();
                expect(result.data).toHaveLength(1);
                expect(mockModel.findByStatus).toHaveBeenCalledWith(ServiceOrderStatusEnum.PENDING);
            });

            it('should find all service orders with COMPLETED status', async () => {
                vi.spyOn(mockModel, 'findByStatus').mockResolvedValue([
                    createMockCompletedServiceOrder()
                ]);

                const result = await service.findByStatus(ServiceOrderStatusEnum.COMPLETED);

                expect(result.data).toBeDefined();
                expect(result.data).toHaveLength(1);
                expect(mockModel.findByStatus).toHaveBeenCalledWith(
                    ServiceOrderStatusEnum.COMPLETED
                );
            });

            it('should return empty array if no orders with status', async () => {
                vi.spyOn(mockModel, 'findByStatus').mockResolvedValue([]);

                const result = await service.findByStatus(ServiceOrderStatusEnum.REFUNDED);

                expect(result.data).toBeDefined();
                expect(result.data).toHaveLength(0);
            });
        });

        describe('startOrder', () => {
            it('should start a service order (transition to IN_PROGRESS)', async () => {
                const result = await service.startOrder(mockServiceOrder.id);

                expect(result.data).toBeDefined();
                expect(result.data?.status).toBe(ServiceOrderStatusEnum.IN_PROGRESS);
                expect(mockModel.startOrder).toHaveBeenCalledWith(mockServiceOrder.id);
            });
        });

        describe('completeOrder', () => {
            it('should complete a service order (transition to COMPLETED)', async () => {
                const completedAt = new Date();
                const result = await service.completeOrder(mockServiceOrder.id, completedAt);

                expect(result.data).toBeDefined();
                expect(result.data?.status).toBe(ServiceOrderStatusEnum.COMPLETED);
                expect(result.data?.completedAt).toBeDefined();
                expect(mockModel.completeOrder).toHaveBeenCalledWith(
                    mockServiceOrder.id,
                    completedAt
                );
            });

            it('should complete a service order without explicit completedAt', async () => {
                const result = await service.completeOrder(mockServiceOrder.id);

                expect(result.data).toBeDefined();
                expect(result.data?.status).toBe(ServiceOrderStatusEnum.COMPLETED);
                expect(mockModel.completeOrder).toHaveBeenCalledWith(
                    mockServiceOrder.id,
                    undefined
                );
            });
        });

        describe('cancelOrder', () => {
            it('should cancel a service order (transition to CANCELLED)', async () => {
                const result = await service.cancelOrder(mockServiceOrder.id);

                expect(result.data).toBeDefined();
                expect(result.data?.status).toBe(ServiceOrderStatusEnum.CANCELLED);
                expect(mockModel.cancelOrder).toHaveBeenCalledWith(mockServiceOrder.id);
            });
        });

        describe('refundOrder', () => {
            it('should refund a service order (transition to REFUNDED)', async () => {
                const result = await service.refundOrder(mockServiceOrder.id);

                expect(result.data).toBeDefined();
                expect(result.data?.status).toBe(ServiceOrderStatusEnum.REFUNDED);
                expect(mockModel.refundOrder).toHaveBeenCalledWith(mockServiceOrder.id);
            });
        });
    });
});
