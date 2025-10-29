import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { PurchaseModel } from '../../src/models/subscription/purchase.model';

// Define the Purchase type for testing
interface Purchase {
    id: string;
    clientId: string;
    pricingPlanId: string;
    purchasedAt: Date;
    createdAt: Date;
    updatedAt: Date;
    createdById?: string;
    updatedById?: string;
    deletedAt?: Date | null;
    deletedById?: string | null;
    adminInfo?: any;
}

// Mock data
const mockPurchase: Purchase = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    clientId: '550e8400-e29b-41d4-a716-446655440002',
    pricingPlanId: '550e8400-e29b-41d4-a716-446655440003',
    purchasedAt: new Date('2024-01-01T00:00:00Z'),
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    createdById: '550e8400-e29b-41d4-a716-446655440000',
    updatedById: '550e8400-e29b-41d4-a716-446655440000',
    deletedAt: null,
    deletedById: null,
    adminInfo: null
};

const mockClient = {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'Test Client Ltd',
    billingEmail: 'billing@testclient.com'
};

const mockPricingPlan = {
    id: '550e8400-e29b-41d4-a716-446655440003',
    amountMinor: 2999,
    currency: 'USD',
    billingScheme: 'ONE_TIME'
};

vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('PurchaseModel', () => {
    let purchaseModel: PurchaseModel;
    let mockDb: any;

    beforeEach(() => {
        purchaseModel = new PurchaseModel();
        mockDb = {
            select: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            innerJoin: vi.fn().mockReturnThis(),
            leftJoin: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            values: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis(),
            returning: vi.fn()
        };
        (dbUtils.getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);
        vi.clearAllMocks();
    });

    describe('getTableName', () => {
        it('should return correct table name', () => {
            const tableName = (purchaseModel as any).getTableName();
            expect(tableName).toBe('purchases');
        });
    });

    describe('business methods', () => {
        describe('findByClient', () => {
            it('should find purchases by client ID', async () => {
                // Mock the findAll method
                purchaseModel.findAll = vi.fn().mockResolvedValue({
                    items: [mockPurchase],
                    total: 1
                });

                const result = await purchaseModel.findByClient(mockPurchase.clientId);

                expect(purchaseModel.findAll).toHaveBeenCalledWith(
                    { clientId: mockPurchase.clientId },
                    undefined,
                    undefined
                );
                expect(result.items).toEqual([mockPurchase]);
                expect(result.total).toBe(1);
            });

            it('should handle pagination options', async () => {
                purchaseModel.findAll = vi.fn().mockResolvedValue({
                    items: [mockPurchase],
                    total: 1
                });

                const options = { page: 1, pageSize: 10 };
                await purchaseModel.findByClient(mockPurchase.clientId, options);

                expect(purchaseModel.findAll).toHaveBeenCalledWith(
                    { clientId: mockPurchase.clientId },
                    options,
                    undefined
                );
            });
        });

        describe('findByPlan', () => {
            it('should find purchases by pricing plan ID', async () => {
                purchaseModel.findAll = vi.fn().mockResolvedValue({
                    items: [mockPurchase],
                    total: 1
                });

                const result = await purchaseModel.findByPlan(mockPurchase.pricingPlanId);

                expect(purchaseModel.findAll).toHaveBeenCalledWith(
                    { pricingPlanId: mockPurchase.pricingPlanId },
                    undefined,
                    undefined
                );
                expect(result.items).toEqual([mockPurchase]);
            });
        });

        describe('calculateTotal', () => {
            it('should calculate total amount for a purchase', async () => {
                mockDb.limit.mockResolvedValue([{ amountMinor: 2999 }]);

                const result = await purchaseModel.calculateTotal(mockPurchase.pricingPlanId, 2);

                expect(mockDb.select).toHaveBeenCalled();
                expect(mockDb.where).toHaveBeenCalled();
                expect(result).toBe(5998); // 2999 * 2
            });

            it('should return null for non-existent pricing plan', async () => {
                mockDb.limit.mockResolvedValue([]);

                const result = await purchaseModel.calculateTotal('non-existent-id');

                expect(result).toBeNull();
            });

            it('should use default quantity of 1', async () => {
                mockDb.limit.mockResolvedValue([{ amountMinor: 2999 }]);

                const result = await purchaseModel.calculateTotal(mockPurchase.pricingPlanId);

                expect(result).toBe(2999);
            });
        });
    });

    describe('one-time logic', () => {
        describe('createFromCart', () => {
            it('should create a purchase from cart data', async () => {
                const purchaseData = {
                    clientId: mockPurchase.clientId,
                    pricingPlanId: mockPurchase.pricingPlanId
                };

                mockDb.returning.mockResolvedValue([mockPurchase]);

                const result = await purchaseModel.createFromCart(purchaseData);

                expect(mockDb.insert).toHaveBeenCalled();
                expect(mockDb.values).toHaveBeenCalledWith(
                    expect.objectContaining({
                        clientId: purchaseData.clientId,
                        pricingPlanId: purchaseData.pricingPlanId
                    })
                );
                expect(result).toEqual(mockPurchase);
            });

            it('should use provided purchase date', async () => {
                const purchaseData = {
                    clientId: mockPurchase.clientId,
                    pricingPlanId: mockPurchase.pricingPlanId,
                    purchasedAt: new Date('2024-02-01T00:00:00Z')
                };

                mockDb.returning.mockResolvedValue([mockPurchase]);

                await purchaseModel.createFromCart(purchaseData);

                expect(mockDb.values).toHaveBeenCalledWith(
                    expect.objectContaining({
                        purchasedAt: purchaseData.purchasedAt
                    })
                );
            });
        });

        describe('processPayment', () => {
            it('should process payment for a purchase', async () => {
                const updatedPurchase = { ...mockPurchase, updatedAt: new Date() };
                mockDb.returning.mockResolvedValue([updatedPurchase]);

                const result = await purchaseModel.processPayment(mockPurchase.id);

                expect(mockDb.update).toHaveBeenCalled();
                expect(mockDb.set).toHaveBeenCalledWith(
                    expect.objectContaining({
                        updatedAt: expect.any(Date)
                    })
                );
                expect(result).toEqual(updatedPurchase);
            });
        });

        describe('markComplete', () => {
            it('should mark a purchase as complete', async () => {
                const completedPurchase = { ...mockPurchase, updatedAt: new Date() };
                mockDb.returning.mockResolvedValue([completedPurchase]);

                const result = await purchaseModel.markComplete(mockPurchase.id);

                expect(mockDb.update).toHaveBeenCalled();
                expect(mockDb.set).toHaveBeenCalledWith(
                    expect.objectContaining({
                        updatedAt: expect.any(Date)
                    })
                );
                expect(result).toEqual(completedPurchase);
            });
        });
    });

    describe('complex queries', () => {
        describe('withClient', () => {
            it('should return purchase with client information', async () => {
                const mockResult = [
                    {
                        purchase: mockPurchase,
                        client: mockClient
                    }
                ];
                mockDb.limit.mockResolvedValue(mockResult);

                const result = await purchaseModel.withClient(mockPurchase.id);

                expect(mockDb.select).toHaveBeenCalled();
                expect(mockDb.innerJoin).toHaveBeenCalled();
                expect(result).toEqual({
                    purchase: mockPurchase,
                    client: mockClient
                });
            });

            it('should return null for non-existent purchase', async () => {
                mockDb.limit.mockResolvedValue([]);

                const result = await purchaseModel.withClient('non-existent-id');

                expect(result).toBeNull();
            });
        });

        describe('withPlan', () => {
            it('should return purchase with pricing plan information', async () => {
                const mockResult = [
                    {
                        purchase: mockPurchase,
                        pricingPlan: mockPricingPlan
                    }
                ];
                mockDb.limit.mockResolvedValue(mockResult);

                const result = await purchaseModel.withPlan(mockPurchase.id);

                expect(mockDb.select).toHaveBeenCalled();
                expect(mockDb.innerJoin).toHaveBeenCalled();
                expect(result).toEqual({
                    purchase: mockPurchase,
                    pricingPlan: mockPricingPlan
                });
            });
        });

        describe('getRecentPurchases', () => {
            it('should return recent purchases for a client', async () => {
                mockDb.limit.mockResolvedValue([mockPurchase]);

                const result = await purchaseModel.getRecentPurchases(mockPurchase.clientId);

                expect(mockDb.select).toHaveBeenCalled();
                expect(mockDb.where).toHaveBeenCalled();
                expect(mockDb.orderBy).toHaveBeenCalled();
                expect(mockDb.limit).toHaveBeenCalledWith(10); // default limit
                expect(result).toEqual([mockPurchase]);
            });

            it('should use custom limit', async () => {
                mockDb.limit.mockResolvedValue([mockPurchase]);

                await purchaseModel.getRecentPurchases(mockPurchase.clientId, 5);

                expect(mockDb.limit).toHaveBeenCalledWith(5);
            });
        });

        describe('withItems', () => {
            it('should return purchase with subscription items', async () => {
                const mockItems = [
                    {
                        id: 'item1',
                        linkedEntityId: 'entity1',
                        entityType: 'CAMPAIGN'
                    }
                ];

                const mockResult = [
                    {
                        purchase: mockPurchase,
                        item: mockItems[0]
                    }
                ];
                mockDb.limit = vi.fn().mockResolvedValue(mockResult);

                const result = await purchaseModel.withItems(mockPurchase.id);

                expect(mockDb.select).toHaveBeenCalled();
                expect(mockDb.leftJoin).toHaveBeenCalled();
                expect(result).toEqual({
                    purchase: mockPurchase,
                    items: mockItems
                });
            });

            it('should return empty items array when no items exist', async () => {
                const mockResult = [
                    {
                        purchase: mockPurchase,
                        item: null
                    }
                ];
                mockDb.limit = vi.fn().mockResolvedValue(mockResult);

                const result = await purchaseModel.withItems(mockPurchase.id);

                expect(result).toEqual({
                    purchase: mockPurchase,
                    items: []
                });
            });
        });
    });
});
