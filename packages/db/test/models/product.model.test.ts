import type { Product } from '@repo/schemas';
import { LifecycleStatusEnum, ProductTypeEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { ProductModel } from '../../src/models/catalog/product.model';

// Mock data
const mockProduct: Product = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Premium Listing Package',
    type: ProductTypeEnum.LISTING_PLAN,
    description: 'Enhanced listing with priority placement',
    metadata: {
        category: 'accommodation',
        features: ['premium_placement', 'photo_boost', 'analytics']
    },
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    isActive: true,
    isDeleted: false,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    createdById: '550e8400-e29b-41d4-a716-446655440000',
    updatedById: '550e8400-e29b-41d4-a716-446655440000',
    deletedAt: undefined,
    deletedById: undefined,
    adminInfo: null
};

const mockSponsorshipProduct: Product = {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'Post Sponsorship',
    type: ProductTypeEnum.SPONSORSHIP,
    description: 'Sponsor posts for increased visibility',
    metadata: {
        category: 'marketing',
        target_entities: ['post', 'event']
    },
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    isActive: true,
    isDeleted: false,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    createdById: '550e8400-e29b-41d4-a716-446655440000',
    updatedById: '550e8400-e29b-41d4-a716-446655440000',
    deletedAt: undefined,
    deletedById: undefined,
    adminInfo: null
};

vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('ProductModel', () => {
    let productModel: ProductModel;
    let getDb: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        productModel = new ProductModel();
        getDb = dbUtils.getDb as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
    });

    describe('getTableName', () => {
        it('should return correct table name', () => {
            const tableName = (
                productModel as unknown as { getTableName(): string }
            ).getTableName();
            expect(tableName).toBe('products');
        });
    });

    describe('findByType', () => {
        it('should find products by type', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([mockProduct])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await productModel.findByType(ProductTypeEnum.LISTING_PLAN);

            expect(result).toHaveLength(1);
            expect(result[0].type).toBe(ProductTypeEnum.LISTING_PLAN);
        });
    });

    describe('findActive', () => {
        it('should find active products', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([mockProduct, mockSponsorshipProduct])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await productModel.findActive();

            expect(result).toHaveLength(2);
            expect(result[0].isActive).toBe(true);
            expect(result[1].isActive).toBe(true);
        });
    });

    describe('searchByMetadata', () => {
        it('should search products by metadata', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([mockProduct])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await productModel.searchByMetadata('category', 'accommodation');

            expect(result).toHaveLength(1);
            expect(result[0].metadata?.category).toBe('accommodation');
        });
    });

    describe('getAvailablePlans', () => {
        it('should get available pricing plans for product', async () => {
            const mockPlans = [
                { id: 'plan-1', productId: mockProduct.id, amountMinor: 1000 },
                { id: 'plan-2', productId: mockProduct.id, amountMinor: 2000 }
            ];

            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue(mockPlans)
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await productModel.getAvailablePlans(mockProduct.id);

            expect(result).toHaveLength(2);
            expect(result[0].productId).toBe(mockProduct.id);
        });
    });

    describe('calculatePricing', () => {
        it('should calculate pricing for product with quantity', async () => {
            const mockPricingPlan = {
                id: 'plan-1',
                productId: mockProduct.id,
                amountMinor: 1000,
                billingScheme: 'flat_rate',
                currency: 'USD'
            };

            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([mockPricingPlan])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await productModel.calculatePricing(mockProduct.id, 5);

            expect(result).toBeDefined();
            expect(result.basePrice).toBe(1000);
            expect(result.totalPrice).toBe(5000); // 1000 * 5
            expect(result.quantity).toBe(5);
            expect(result.discount).toBe(0);
        });

        it('should handle quantity of zero gracefully', async () => {
            const mockPricingPlan = {
                id: 'plan-1',
                productId: mockProduct.id,
                amountMinor: 1000,
                billingScheme: 'flat_rate',
                currency: 'USD'
            };

            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([mockPricingPlan])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await productModel.calculatePricing(mockProduct.id, 0);

            expect(result).toBeDefined();
            expect(result.basePrice).toBe(1000);
            expect(result.totalPrice).toBe(0); // 1000 * 0 = 0
            expect(result.quantity).toBe(0);
        });

        it('should handle negative quantity (multiplies normally)', async () => {
            const mockPricingPlan = {
                id: 'plan-1',
                productId: mockProduct.id,
                amountMinor: 1000,
                billingScheme: 'flat_rate',
                currency: 'USD'
            };

            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([mockPricingPlan])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            // Note: Currently the model doesn't validate negative quantities
            // This test documents the current behavior
            const result = await productModel.calculatePricing(mockProduct.id, -5);

            expect(result).toBeDefined();
            expect(result.basePrice).toBe(1000);
            expect(result.totalPrice).toBe(-5000); // 1000 * -5 = -5000
            expect(result.quantity).toBe(-5);
        });
    });

    describe('isAvailable', () => {
        it('should check if product is available', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([mockProduct])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await productModel.isAvailable(mockProduct.id);

            expect(result).toBe(true);
        });

        it('should return false for deleted product', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([]) // Empty array because deleted products are filtered out
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await productModel.isAvailable(mockProduct.id);

            expect(result).toBe(false);
        });
    });

    describe('findWithPricingPlans', () => {
        it('should find products with their pricing plans', async () => {
            const productWithPlans = {
                ...mockProduct,
                pricingPlans: [
                    { id: 'plan-1', amountMinor: 1000 },
                    { id: 'plan-2', amountMinor: 2000 }
                ]
            };

            const mockDb = {
                query: {
                    products: {
                        findMany: vi.fn().mockResolvedValue([productWithPlans])
                    }
                }
            };
            getDb.mockReturnValue(mockDb);

            const result = await productModel.findWithPricingPlans();

            expect(result).toHaveLength(1);
            expect(result[0].pricingPlans).toHaveLength(2);
        });
    });

    describe('findByCategory', () => {
        it('should find products by metadata category', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([mockProduct])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await productModel.findByCategory('accommodation');

            expect(result).toHaveLength(1);
            expect(result[0].metadata?.category).toBe('accommodation');
        });
    });

    describe('findFeatured', () => {
        it('should find featured products', async () => {
            const featuredProduct = {
                ...mockProduct,
                metadata: { ...mockProduct.metadata, featured: true }
            };

            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([featuredProduct])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await productModel.findFeatured();

            expect(result).toHaveLength(1);
            expect(result[0].metadata?.featured).toBe(true);
        });
    });

    describe('error handling', () => {
        it('should handle database errors in findWithPricingPlans', async () => {
            // Arrange - Mock database to throw error
            const mockDb = {
                query: {
                    products: {
                        findMany: vi.fn().mockRejectedValue(new Error('Database connection lost'))
                    }
                }
            };
            getDb.mockReturnValue(mockDb);

            // Act & Assert - Expect error to be thrown
            await expect(productModel.findWithPricingPlans()).rejects.toThrow(
                'Database connection lost'
            );
        });

        it('should handle calculating pricing when no plans exist', async () => {
            // Arrange - Mock empty result (no pricing plans found)
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([]) // No pricing plan found
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            // Act - calculatePricing handles this gracefully by returning zeros
            const result = await productModel.calculatePricing('non-existent-id', 1);

            // Assert - Should return zero values when no plans exist
            expect(result).toBeDefined();
            expect(result.basePrice).toBe(0);
            expect(result.totalPrice).toBe(0);
            expect(result.quantity).toBe(1);
            expect(result.discount).toBe(0);
        });

        it('should handle database errors in getAvailablePlans', async () => {
            // Arrange - Mock database error
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockRejectedValue(new Error('Query execution failed'))
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            // Act & Assert
            await expect(productModel.getAvailablePlans(mockProduct.id)).rejects.toThrow(
                'Query execution failed'
            );
        });
    });
});
