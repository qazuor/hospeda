import { ProductModel } from '@repo/db';
import type { ProductIdType } from '@repo/schemas';
import { PermissionEnum, ProductTypeEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductService } from '../../../src/services/product/product.service';
import { createActor } from '../../factories/actorFactory';
import { createMockProduct } from '../../factories/productFactory';
import { getMockId } from '../../factories/utilsFactory';

describe('ProductService', () => {
    let service: ProductService;
    let mockModel: ProductModel;

    const mockProduct = createMockProduct({
        id: getMockId('product', 'p1') as ProductIdType,
        name: 'Test Listing Plan',
        type: ProductTypeEnum.LISTING_PLAN,
        isActive: true
    });

    const adminActor = createActor({
        id: getMockId('user', 'admin') as string,
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.PRODUCT_CREATE,
            PermissionEnum.PRODUCT_UPDATE,
            PermissionEnum.PRODUCT_DELETE,
            PermissionEnum.PRODUCT_VIEW
        ]
    });

    const userActor = createActor({
        id: getMockId('user', 'u1') as string,
        role: RoleEnum.USER,
        permissions: [PermissionEnum.PRODUCT_VIEW]
    });

    beforeEach(() => {
        // Create mock model
        mockModel = new ProductModel();

        // Mock base CRUD methods
        vi.spyOn(mockModel, 'create').mockResolvedValue(mockProduct);
        vi.spyOn(mockModel, 'findById').mockResolvedValue(mockProduct);
        vi.spyOn(mockModel, 'findOne').mockResolvedValue(mockProduct);
        vi.spyOn(mockModel, 'findAll').mockResolvedValue({
            items: [mockProduct],
            total: 1
        });
        vi.spyOn(mockModel, 'update').mockResolvedValue(mockProduct);
        vi.spyOn(mockModel, 'softDelete').mockResolvedValue(1);
        vi.spyOn(mockModel, 'hardDelete').mockResolvedValue(1);
        vi.spyOn(mockModel, 'restore').mockResolvedValue(1);
        vi.spyOn(mockModel, 'count').mockResolvedValue(1);

        // Mock custom model methods
        vi.spyOn(mockModel, 'findByType').mockResolvedValue([mockProduct]);
        vi.spyOn(mockModel, 'findActive').mockResolvedValue([mockProduct]);
        vi.spyOn(mockModel, 'findFeatured').mockResolvedValue([mockProduct]);
        vi.spyOn(mockModel, 'findByCategory').mockResolvedValue([mockProduct]);
        vi.spyOn(mockModel, 'isAvailable').mockResolvedValue(true);
        vi.spyOn(mockModel, 'getAvailablePlans').mockResolvedValue([]);
        vi.spyOn(mockModel, 'calculatePricing').mockResolvedValue({
            basePrice: 10000,
            totalPrice: 10000,
            discount: 0,
            quantity: 1
        });
        vi.spyOn(mockModel, 'findWithPricingPlans').mockResolvedValue([
            { ...mockProduct, pricingPlans: [] }
        ]);

        // Create service with mocked model
        service = new ProductService({ logger: console }, mockModel);
    });

    describe('Constructor', () => {
        it('should create service instance', () => {
            expect(service).toBeDefined();
            expect(service).toBeInstanceOf(ProductService);
        });

        it('should have correct entity name', () => {
            expect((service as any).entityName).toBe('product');
        });
    });

    describe('create', () => {
        it('should create a new product with valid data', async () => {
            const createData = {
                name: 'New Product',
                type: ProductTypeEnum.CAMPAIGN,
                metadata: { category: 'digital' }
            };

            const result = await service.create(adminActor, createData);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            expect(mockModel.create).toHaveBeenCalled();
        });

        it('should throw ServiceError if actor lacks permission', async () => {
            const createData = {
                name: 'New Product',
                type: ProductTypeEnum.FEATURED
            };

            const result = await service.create(userActor, createData);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('update', () => {
        it('should update product with valid data', async () => {
            const updateData = {
                name: 'Updated Product'
            };

            const result = await service.update(adminActor, mockProduct.id, updateData);

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
                name: 'Updated Product'
            };

            const result = await service.update(otherUserActor, mockProduct.id, updateData);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('getById', () => {
        it('should retrieve product by id', async () => {
            const result = await service.getById(adminActor, mockProduct.id);

            expect(result.data).toBeDefined();
            expect(result.data?.id).toBe(mockProduct.id);
            expect(mockModel.findOne).toHaveBeenCalledWith({ id: mockProduct.id });
        });

        it('should throw NOT_FOUND if product does not exist', async () => {
            vi.spyOn(mockModel, 'findOne').mockResolvedValue(null);

            const result = await service.getById(adminActor, 'non-existent-id');

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });
    });

    describe('list', () => {
        it('should list all products with pagination', async () => {
            const result = await service.list(adminActor, {
                page: 1,
                pageSize: 10
            });

            expect(result.data).toBeDefined();
            expect(result.data?.items).toHaveLength(1);
            expect(result.data?.total).toBe(1);
        });

        it('should allow any authenticated user to list products', async () => {
            const result = await service.list(userActor, {});

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
        });
    });

    describe('softDelete', () => {
        it('should soft delete product as admin', async () => {
            const result = await service.softDelete(adminActor, mockProduct.id);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            expect(mockModel.softDelete).toHaveBeenCalled();
        });

        it('should forbid non-admin to soft delete', async () => {
            const result = await service.softDelete(userActor, mockProduct.id);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('findByType', () => {
        it('should find products by type', async () => {
            const result = await service.findByType(adminActor, ProductTypeEnum.LISTING_PLAN);

            expect(result.data).toBeDefined();
            expect(result.data).toHaveLength(1);
            expect(mockModel.findByType).toHaveBeenCalledWith(
                ProductTypeEnum.LISTING_PLAN,
                undefined
            );
        });

        it('should return empty array if no products found for type', async () => {
            vi.spyOn(mockModel, 'findByType').mockResolvedValue([]);

            const result = await service.findByType(adminActor, ProductTypeEnum.CAMPAIGN);

            expect(result.data).toBeDefined();
            expect(result.data).toHaveLength(0);
        });
    });

    describe('findActive', () => {
        it('should find all active products', async () => {
            const result = await service.findActive(adminActor);

            expect(result.data).toBeDefined();
            expect(result.data).toHaveLength(1);
            expect(mockModel.findActive).toHaveBeenCalled();
        });

        it('should return empty array if no active products', async () => {
            vi.spyOn(mockModel, 'findActive').mockResolvedValue([]);

            const result = await service.findActive(adminActor);

            expect(result.data).toBeDefined();
            expect(result.data).toHaveLength(0);
        });
    });

    describe('findFeatured', () => {
        it('should find featured products', async () => {
            const result = await service.findFeatured(adminActor);

            expect(result.data).toBeDefined();
            expect(result.data).toHaveLength(1);
            expect(mockModel.findFeatured).toHaveBeenCalled();
        });

        it('should return empty array if no featured products', async () => {
            vi.spyOn(mockModel, 'findFeatured').mockResolvedValue([]);

            const result = await service.findFeatured(adminActor);

            expect(result.data).toBeDefined();
            expect(result.data).toHaveLength(0);
        });
    });

    describe('findByCategory', () => {
        it('should find products by category', async () => {
            const category = 'digital';
            const result = await service.findByCategory(adminActor, category);

            expect(result.data).toBeDefined();
            expect(result.data).toHaveLength(1);
            expect(mockModel.findByCategory).toHaveBeenCalledWith(category, undefined);
        });

        it('should return empty array if no products in category', async () => {
            vi.spyOn(mockModel, 'findByCategory').mockResolvedValue([]);

            const result = await service.findByCategory(adminActor, 'nonexistent');

            expect(result.data).toBeDefined();
            expect(result.data).toHaveLength(0);
        });
    });

    describe('checkIsAvailable', () => {
        it('should check if product is available', async () => {
            const result = await service.checkIsAvailable(adminActor, mockProduct.id);

            expect(result.data).toBeDefined();
            expect(result.data?.isAvailable).toBe(true);
            expect(mockModel.isAvailable).toHaveBeenCalledWith(mockProduct.id, undefined);
        });

        it('should return false when product is not available', async () => {
            vi.spyOn(mockModel, 'isAvailable').mockResolvedValue(false);

            const result = await service.checkIsAvailable(adminActor, mockProduct.id);

            expect(result.data).toBeDefined();
            expect(result.data?.isAvailable).toBe(false);
        });
    });

    describe('getAvailablePlans', () => {
        it('should get available pricing plans for product', async () => {
            const mockPlans = [
                {
                    id: 'plan1',
                    productId: mockProduct.id,
                    billingScheme: 'tiered',
                    interval: 'monthly',
                    amountMinor: 10000,
                    currency: 'ARS',
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ];

            vi.spyOn(mockModel, 'getAvailablePlans').mockResolvedValue(mockPlans);

            const result = await service.getAvailablePlans(adminActor, mockProduct.id);

            expect(result.data).toBeDefined();
            expect(result.data).toHaveLength(1);
            expect(mockModel.getAvailablePlans).toHaveBeenCalledWith(mockProduct.id, undefined);
        });

        it('should return empty array if no plans available', async () => {
            vi.spyOn(mockModel, 'getAvailablePlans').mockResolvedValue([]);

            const result = await service.getAvailablePlans(adminActor, mockProduct.id);

            expect(result.data).toBeDefined();
            expect(result.data).toHaveLength(0);
        });
    });

    describe('calculatePricing', () => {
        it('should calculate pricing for product', async () => {
            const quantity = 5;
            const mockPricing = {
                basePrice: 10000,
                totalPrice: 50000,
                discount: 0,
                quantity: 5
            };

            vi.spyOn(mockModel, 'calculatePricing').mockResolvedValue(mockPricing);

            const result = await service.calculatePricing(adminActor, mockProduct.id, quantity);

            expect(result.data).toBeDefined();
            expect(result.data?.totalPrice).toBe(50000);
            expect(result.data?.quantity).toBe(5);
            expect(mockModel.calculatePricing).toHaveBeenCalledWith(
                mockProduct.id,
                quantity,
                undefined
            );
        });

        it('should handle quantity of 1', async () => {
            const quantity = 1;
            const result = await service.calculatePricing(adminActor, mockProduct.id, quantity);

            expect(result.data).toBeDefined();
            expect(result.data?.quantity).toBe(1);
        });
    });

    describe('findWithPricingPlans', () => {
        it('should find products with their pricing plans', async () => {
            const result = await service.findWithPricingPlans(adminActor);

            expect(result.data).toBeDefined();
            expect(result.data).toHaveLength(1);
            expect(result.data?.[0]).toHaveProperty('pricingPlans');
            expect(mockModel.findWithPricingPlans).toHaveBeenCalled();
        });

        it('should return empty array if no products exist', async () => {
            vi.spyOn(mockModel, 'findWithPricingPlans').mockResolvedValue([]);

            const result = await service.findWithPricingPlans(adminActor);

            expect(result.data).toBeDefined();
            expect(result.data).toHaveLength(0);
        });
    });

    describe('search', () => {
        it('should search products with filters', async () => {
            const searchParams = {
                type: ProductTypeEnum.LISTING_PLAN,
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
                type: ProductTypeEnum.PROF_SERVICE
            });

            expect(result.data).toBeDefined();
            expect(result.data?.items).toHaveLength(0);
        });
    });

    describe('count', () => {
        it('should count products matching criteria', async () => {
            const result = await service.count(adminActor, {});

            expect(result.data).toBeDefined();
            expect(result.data?.count).toBe(1);
        });

        it('should count with type filter', async () => {
            const result = await service.count(adminActor, {
                type: ProductTypeEnum.CAMPAIGN
            });

            expect(result.data).toBeDefined();
            expect(mockModel.count).toHaveBeenCalled();
        });
    });
});
