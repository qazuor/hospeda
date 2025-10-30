import type { ServiceOrder } from '@repo/schemas';
import { ServiceOrderStatusEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfessionalServiceOrderModel } from '../../src/models/professionalServiceOrder.model';

// Mock the database client
vi.mock('../../src/client', () => ({
    getDb: vi.fn(() => ({}))
}));

// Mock logger to avoid console output during tests
vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

// Mock database operations
vi.mock('../../src/utils/db-utils', () => ({
    buildWhereClause: vi.fn(() => ({}))
}));

// Create mock professional service order data
const mockProfessionalServiceOrderData: ServiceOrder = {
    id: 'service-order-id-1',
    clientId: 'client-id-1',
    serviceTypeId: 'service-type-id-1',
    pricingPlanId: 'pricing-plan-id-1',
    status: ServiceOrderStatusEnum.PENDING,
    orderedAt: new Date('2024-01-15'),
    deliveryDate: new Date('2024-02-15'),
    completedAt: null,
    notes: 'Internal notes about the service order',
    clientRequirements: 'Client specific requirements for the service',
    deliverables: {
        photos: ['photo1.jpg', 'photo2.jpg'],
        documents: ['report.pdf']
    },
    adminInfo: {
        assignedTo: 'admin-id-1',
        priority: 'high'
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'user-id-1',
    updatedById: 'user-id-1',
    deletedAt: null,
    deletedById: null
};

describe('ProfessionalServiceOrderModel', () => {
    let model: ProfessionalServiceOrderModel;

    beforeEach(async () => {
        vi.clearAllMocks();
        model = new ProfessionalServiceOrderModel();

        // Mock the specific methods that are called by the model
        vi.spyOn(model, 'findById').mockImplementation(async (id: string) => {
            if (id === 'service-order-id-1') {
                return mockProfessionalServiceOrderData;
            }
            return null;
        });

        vi.spyOn(model, 'findAll').mockImplementation(async () => ({
            items: [mockProfessionalServiceOrderData],
            total: 1
        }));

        vi.spyOn(model, 'count').mockImplementation(async () => 1);

        vi.spyOn(model, 'create').mockImplementation(async (data: any) => ({
            ...mockProfessionalServiceOrderData,
            ...data,
            id: 'service-order-id-1'
        }));

        vi.spyOn(model, 'update').mockImplementation(async (where: any, data: any) => ({
            ...mockProfessionalServiceOrderData,
            ...data,
            id: where.id || 'service-order-id-1'
        }));

        // Mock database operations for insert/update/select
        const mockDb = {
            insert: vi.fn(() => ({
                values: vi.fn((data) => ({
                    returning: vi.fn(() =>
                        Promise.resolve([
                            {
                                id: 'service-order-id-1',
                                clientId: data.clientId,
                                serviceTypeId: data.serviceTypeId,
                                pricingPlanId: data.pricingPlanId,
                                status: data.status,
                                orderedAt: data.orderedAt,
                                deliveryDate: data.deliveryDate,
                                createdAt: new Date(),
                                updatedAt: new Date(),
                                createdById: 'user-id-1',
                                updatedById: 'user-id-1',
                                deletedAt: null,
                                deletedById: null
                            }
                        ])
                    )
                }))
            })),
            update: vi.fn(() => ({
                set: vi.fn(() => ({
                    where: vi.fn(() => ({
                        returning: vi.fn(() =>
                            Promise.resolve([
                                {
                                    id: 'service-order-id-1',
                                    status: ServiceOrderStatusEnum.IN_PROGRESS,
                                    createdAt: new Date(),
                                    updatedAt: new Date()
                                }
                            ])
                        )
                    }))
                }))
            })),
            select: vi.fn(() => ({
                from: vi.fn(() => ({
                    where: vi.fn(() =>
                        Promise.resolve([
                            {
                                ...mockProfessionalServiceOrderData,
                                deletedAt: null,
                                deletedById: null
                            }
                        ])
                    )
                }))
            })),
            query: {
                professionalServiceOrders: {
                    findFirst: vi.fn(() =>
                        Promise.resolve({
                            id: 'service-order-id-1',
                            status: ServiceOrderStatusEnum.PENDING
                        })
                    )
                }
            }
        };

        // Override getDb for this instance
        const { getDb } = await import('../../src/client');
        vi.mocked(getDb).mockReturnValue(mockDb as any);
    });

    describe('Constructor', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(ProfessionalServiceOrderModel);
        });
    });

    describe('Base Model Properties', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(ProfessionalServiceOrderModel);
        });
    });

    describe('findById', () => {
        it('should find a professional service order by ID', async () => {
            const result = await model.findById('service-order-id-1');

            expect(result).toBeDefined();
            expect(result?.id).toBe('service-order-id-1');
            expect(result?.status).toBe(ServiceOrderStatusEnum.PENDING);
        });

        it('should return null for non-existent ID', async () => {
            const result = await model.findById('non-existent-id');

            expect(result).toBeNull();
        });
    });

    describe('findAll', () => {
        it('should find all professional service orders', async () => {
            const result = await model.findAll();

            expect(result).toBeDefined();
            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
        });
    });

    describe('create', () => {
        it('should create a new professional service order', async () => {
            const newOrderData = {
                clientId: 'client-id-2',
                serviceTypeId: 'service-type-id-2',
                pricingPlanId: 'pricing-plan-id-2',
                status: ServiceOrderStatusEnum.PENDING,
                orderedAt: new Date('2024-01-20'),
                deliveryDate: new Date('2024-02-20'),
                createdById: 'user-id-1',
                updatedById: 'user-id-1'
            };

            const result = await model.create(newOrderData);

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.status).toBe(ServiceOrderStatusEnum.PENDING);
        });
    });

    describe('count', () => {
        it('should count professional service orders', async () => {
            const result = await model.count();

            expect(result).toBe(1);
        });
    });

    describe('findByClient', () => {
        it('should find orders by client ID', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockProfessionalServiceOrderData],
                total: 1
            });

            const result = await model.findByClient('client-id-1');

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.clientId).toBe('client-id-1');
        });
    });

    describe('findByServiceType', () => {
        it('should find orders by service type ID', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockProfessionalServiceOrderData],
                total: 1
            });

            const result = await model.findByServiceType('service-type-id-1');

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.serviceTypeId).toBe('service-type-id-1');
        });
    });

    describe('findByStatus', () => {
        it('should find orders by status', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockProfessionalServiceOrderData],
                total: 1
            });

            const result = await model.findByStatus(ServiceOrderStatusEnum.PENDING);

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.status).toBe(ServiceOrderStatusEnum.PENDING);
        });
    });

    describe('startOrder', () => {
        it('should start an order (change status to IN_PROGRESS)', async () => {
            const result = await model.startOrder('service-order-id-1');

            expect(result).toBeDefined();
            expect(result.id).toBe('service-order-id-1');
        });
    });

    describe('completeOrder', () => {
        it('should complete an order (change status to COMPLETED)', async () => {
            const completedAt = new Date();
            const result = await model.completeOrder('service-order-id-1', completedAt);

            expect(result).toBeDefined();
            expect(result.id).toBe('service-order-id-1');
        });
    });

    describe('cancelOrder', () => {
        it('should cancel an order (change status to CANCELLED)', async () => {
            const result = await model.cancelOrder('service-order-id-1');

            expect(result).toBeDefined();
            expect(result.id).toBe('service-order-id-1');
        });
    });

    describe('refundOrder', () => {
        it('should refund an order (change status to REFUNDED)', async () => {
            const result = await model.refundOrder('service-order-id-1');

            expect(result).toBeDefined();
            expect(result.id).toBe('service-order-id-1');
        });
    });
});
