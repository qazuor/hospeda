import { PricingPlanModel } from '@repo/db';
import type {
    PricingCalculationResult,
    PricingPlanWithTiers,
    QuantityValidationResult,
    UsageStats
} from '@repo/db';
import { BillingIntervalEnum, BillingSchemeEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { PricingPlan } from '@repo/schemas/entities/pricingPlan';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PricingPlanService } from '../../../src/services/pricingPlan/pricingPlan.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { createMockPricingPlan } from '../../factories/pricingPlanFactory';

describe('PricingPlanService', () => {
    let service: PricingPlanService;
    let mockModel: PricingPlanModel;
    let mockPricingPlan: PricingPlan;
    let adminActor: Actor;
    let userActor: Actor;

    beforeEach(() => {
        // Create mock model
        mockModel = new PricingPlanModel();

        // Create test data
        mockPricingPlan = createMockPricingPlan();
        adminActor = createActor({ role: RoleEnum.ADMIN });
        userActor = createActor({ role: RoleEnum.USER, permissions: [] });

        // Mock all model methods
        vi.spyOn(mockModel, 'create').mockResolvedValue(mockPricingPlan);
        vi.spyOn(mockModel, 'update').mockResolvedValue(mockPricingPlan);
        vi.spyOn(mockModel, 'findById').mockResolvedValue(mockPricingPlan);
        vi.spyOn(mockModel, 'findOne').mockResolvedValue(mockPricingPlan);
        vi.spyOn(mockModel, 'findAll').mockResolvedValue({
            items: [mockPricingPlan],
            totalCount: 1,
            page: 1,
            pageSize: 10,
            totalPages: 1
        });
        vi.spyOn(mockModel, 'findAllWithRelations').mockResolvedValue({
            items: [mockPricingPlan],
            totalCount: 1,
            page: 1,
            pageSize: 10,
            totalPages: 1
        });
        vi.spyOn(mockModel, 'softDelete').mockResolvedValue(undefined);
        vi.spyOn(mockModel, 'hardDelete').mockResolvedValue(undefined);
        vi.spyOn(mockModel, 'restore').mockResolvedValue(mockPricingPlan);
        vi.spyOn(mockModel, 'count').mockResolvedValue(10);

        // Mock custom model methods
        vi.spyOn(mockModel, 'calculateTotal').mockResolvedValue({
            total: 50000,
            currency: 'ARS',
            quantity: 5,
            billingInterval: 'MONTH',
            plan: mockPricingPlan
        } as PricingCalculationResult);

        vi.spyOn(mockModel, 'getApplicableTiers').mockResolvedValue([]);

        vi.spyOn(mockModel, 'validateQuantity').mockResolvedValue({
            isValid: true,
            quantity: 5
        } as QuantityValidationResult);

        vi.spyOn(mockModel, 'findByProduct').mockResolvedValue([mockPricingPlan]);
        vi.spyOn(mockModel, 'findRecurring').mockResolvedValue([mockPricingPlan]);
        vi.spyOn(mockModel, 'findOneTime').mockResolvedValue([mockPricingPlan]);
        vi.spyOn(mockModel, 'withTiers').mockResolvedValue([
            { ...mockPricingPlan, pricingTiers: [] } as PricingPlanWithTiers
        ]);
        vi.spyOn(mockModel, 'getUsageStats').mockResolvedValue({
            planId: mockPricingPlan.id,
            totalSubscriptions: 0,
            activeSubscriptions: 0,
            totalRevenue: 0
        } as UsageStats);

        // Create service with mocked model
        service = new PricingPlanService({ logger: console }, mockModel);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================

    describe('constructor', () => {
        it('should initialize with provided model', () => {
            expect(service.model).toBe(mockModel);
        });

        it('should initialize with new model if not provided', () => {
            const newService = new PricingPlanService({ logger: console });
            expect(newService.model).toBeInstanceOf(PricingPlanModel);
        });
    });

    // ============================================================================
    // CRUD OPERATIONS
    // ============================================================================

    describe('create', () => {
        it('should create a new pricing plan with valid data', async () => {
            const data = {
                productId: mockPricingPlan.productId,
                billingScheme: BillingSchemeEnum.RECURRING,
                interval: BillingIntervalEnum.MONTH,
                amountMinor: 10000,
                currency: 'ARS'
            };

            const result = await service.create(adminActor, data);

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(result.data?.id).toBe(mockPricingPlan.id);
            expect(mockModel.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    ...data,
                    createdById: adminActor.id,
                    updatedById: adminActor.id
                })
            );
        });

        it('should throw ServiceError if actor lacks permission', async () => {
            const data = {
                productId: mockPricingPlan.productId,
                billingScheme: BillingSchemeEnum.ONE_TIME,
                amountMinor: 5000,
                currency: 'ARS'
            };

            const result = await service.create(userActor, data);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(mockModel.create).not.toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('should update pricing plan with valid data', async () => {
            const updateData = { amountMinor: 15000 };

            const result = await service.update(adminActor, mockPricingPlan.id, updateData);

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(mockModel.update).toHaveBeenCalledWith(
                { id: mockPricingPlan.id },
                expect.objectContaining({
                    ...updateData,
                    updatedById: adminActor.id
                })
            );
        });

        it('should forbid non-admin without permission to update', async () => {
            const result = await service.update(userActor, mockPricingPlan.id, {
                amountMinor: 15000
            });

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('getById', () => {
        it('should retrieve pricing plan by id', async () => {
            const result = await service.getById(adminActor, mockPricingPlan.id);

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(result.data?.id).toBe(mockPricingPlan.id);
        });

        it('should throw NOT_FOUND if pricing plan does not exist', async () => {
            vi.spyOn(mockModel, 'findOne').mockResolvedValueOnce(null);

            const result = await service.getById(adminActor, mockPricingPlan.id);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });
    });

    describe('list', () => {
        it('should list all pricing plans with pagination', async () => {
            const result = await service.list(adminActor, { page: 1, pageSize: 10 });

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(result.data?.items).toHaveLength(1);
            expect(result.data?.totalCount).toBe(1);
        });

        it('should allow any authenticated user to list pricing plans', async () => {
            const result = await service.list(userActor, {});

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
        });
    });

    describe('softDelete', () => {
        it('should soft delete pricing plan as admin', async () => {
            const result = await service.softDelete(adminActor, mockPricingPlan.id);

            expect(result.error).toBeUndefined();
            expect(mockModel.softDelete).toHaveBeenCalled();
        });

        it('should forbid non-admin to soft delete', async () => {
            const result = await service.softDelete(userActor, mockPricingPlan.id);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('hardDelete', () => {
        it('should hard delete pricing plan as super admin', async () => {
            const superAdminActor = createActor({ role: RoleEnum.SUPER_ADMIN });
            vi.spyOn(mockModel, 'findById').mockResolvedValueOnce(mockPricingPlan);

            const result = await service.hardDelete(superAdminActor, mockPricingPlan.id);

            expect(result.error).toBeUndefined();
            expect(mockModel.hardDelete).toHaveBeenCalled();
        });

        it('should forbid non-super-admin from hard delete', async () => {
            vi.spyOn(mockModel, 'findById').mockResolvedValueOnce(mockPricingPlan);

            const result = await service.hardDelete(adminActor, mockPricingPlan.id);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('restore', () => {
        it('should restore pricing plan as admin', async () => {
            const deletedPricingPlan = { ...mockPricingPlan, deletedAt: new Date() };
            vi.spyOn(mockModel, 'findById').mockResolvedValueOnce(deletedPricingPlan);
            vi.spyOn(mockModel, 'restore').mockResolvedValueOnce(1);

            const result = await service.restore(adminActor, mockPricingPlan.id);

            expect(result.error).toBeUndefined();
            expect(result.data).toEqual({ count: 1 });
            expect(mockModel.restore).toHaveBeenCalledWith({ id: mockPricingPlan.id });
        });

        it('should forbid non-admin from restore', async () => {
            const result = await service.restore(userActor, mockPricingPlan.id);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    // ============================================================================
    // CUSTOM BUSINESS METHODS
    // ============================================================================

    describe('calculateTotal', () => {
        it('should calculate total for pricing plan', async () => {
            const result = await service.calculateTotal(adminActor, mockPricingPlan.id, 5);

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(result.data?.total).toBe(50000);
            expect(result.data?.quantity).toBe(5);
            expect(mockModel.calculateTotal).toHaveBeenCalledWith(mockPricingPlan.id, 5, undefined);
        });

        it('should return calculation with plan details', async () => {
            const result = await service.calculateTotal(adminActor, mockPricingPlan.id, 3);

            expect(result.data?.currency).toBe('ARS');
            expect(result.data?.billingInterval).toBe('MONTH');
            expect(result.data?.plan).toBeDefined();
        });
    });

    describe('getApplicableTiers', () => {
        it('should get applicable tiers for plan and quantity', async () => {
            const result = await service.getApplicableTiers(adminActor, mockPricingPlan.id, 10);

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(Array.isArray(result.data)).toBe(true);
            expect(mockModel.getApplicableTiers).toHaveBeenCalledWith(
                mockPricingPlan.id,
                10,
                undefined
            );
        });

        it('should return empty array if no tiers available', async () => {
            vi.spyOn(mockModel, 'getApplicableTiers').mockResolvedValueOnce([]);

            const result = await service.getApplicableTiers(adminActor, mockPricingPlan.id, 1);

            expect(result.data).toEqual([]);
        });
    });

    describe('validateQuantity', () => {
        it('should validate quantity successfully', async () => {
            const result = await service.validateQuantity(adminActor, mockPricingPlan.id, 5);

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(result.data?.isValid).toBe(true);
            expect(result.data?.quantity).toBe(5);
        });

        it('should return error for invalid quantity', async () => {
            vi.spyOn(mockModel, 'validateQuantity').mockResolvedValueOnce({
                isValid: false,
                quantity: 0,
                error: 'Quantity must be greater than 0'
            });

            const result = await service.validateQuantity(adminActor, mockPricingPlan.id, 0);

            expect(result.data?.isValid).toBe(false);
            expect(result.data?.error).toBeDefined();
        });
    });

    describe('findByProduct', () => {
        it('should find pricing plans by product', async () => {
            const result = await service.findByProduct(adminActor, 'product-id');

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(Array.isArray(result.data)).toBe(true);
            expect(mockModel.findByProduct).toHaveBeenCalledWith('product-id', undefined);
        });

        it('should return empty array if no plans found for product', async () => {
            vi.spyOn(mockModel, 'findByProduct').mockResolvedValueOnce([]);

            const result = await service.findByProduct(adminActor, 'non-existent-product');

            expect(result.data).toEqual([]);
        });
    });

    describe('findRecurring', () => {
        it('should find recurring pricing plans by interval', async () => {
            const result = await service.findRecurring(adminActor, BillingIntervalEnum.MONTH);

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(Array.isArray(result.data)).toBe(true);
            expect(mockModel.findRecurring).toHaveBeenCalledWith(
                BillingIntervalEnum.MONTH,
                undefined
            );
        });

        it('should return empty array if no recurring plans found', async () => {
            vi.spyOn(mockModel, 'findRecurring').mockResolvedValueOnce([]);

            const result = await service.findRecurring(adminActor, BillingIntervalEnum.YEAR);

            expect(result.data).toEqual([]);
        });
    });

    describe('findOneTime', () => {
        it('should find one-time pricing plans', async () => {
            const result = await service.findOneTime(adminActor);

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(Array.isArray(result.data)).toBe(true);
            expect(mockModel.findOneTime).toHaveBeenCalledWith(undefined);
        });

        it('should return empty array if no one-time plans found', async () => {
            vi.spyOn(mockModel, 'findOneTime').mockResolvedValueOnce([]);

            const result = await service.findOneTime(adminActor);

            expect(result.data).toEqual([]);
        });
    });

    describe('findWithTiers', () => {
        it('should find pricing plans with their tiers', async () => {
            const result = await service.findWithTiers(adminActor);

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(Array.isArray(result.data)).toBe(true);
            expect(result.data?.[0]?.pricingTiers).toBeDefined();
            expect(mockModel.withTiers).toHaveBeenCalledWith(undefined);
        });

        it('should return empty array if no plans with tiers found', async () => {
            vi.spyOn(mockModel, 'withTiers').mockResolvedValueOnce([]);

            const result = await service.findWithTiers(adminActor);

            expect(result.data).toEqual([]);
        });
    });

    describe('getUsageStats', () => {
        it('should get usage statistics for plan', async () => {
            const result = await service.getUsageStats(adminActor, mockPricingPlan.id);

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(result.data?.planId).toBe(mockPricingPlan.id);
            expect(result.data?.totalSubscriptions).toBeDefined();
            expect(result.data?.activeSubscriptions).toBeDefined();
            expect(result.data?.totalRevenue).toBeDefined();
        });

        it('should return zero stats for unused plan', async () => {
            const result = await service.getUsageStats(adminActor, mockPricingPlan.id);

            expect(result.data?.totalSubscriptions).toBe(0);
            expect(result.data?.activeSubscriptions).toBe(0);
            expect(result.data?.totalRevenue).toBe(0);
        });
    });

    // ============================================================================
    // SEARCH & COUNT
    // ============================================================================

    describe('search', () => {
        it('should search pricing plans with filters', async () => {
            const filters = {
                billingScheme: BillingSchemeEnum.RECURRING,
                page: 1,
                pageSize: 10
            };

            const result = await service.search(adminActor, filters);

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(result.data?.items).toHaveLength(1);
        });

        it('should handle empty search results', async () => {
            vi.spyOn(mockModel, 'findAll').mockResolvedValueOnce({
                items: [],
                totalCount: 0,
                page: 1,
                pageSize: 10,
                totalPages: 0
            });

            const result = await service.search(adminActor, {
                billingScheme: BillingSchemeEnum.ONE_TIME
            });

            expect(result.data?.items).toHaveLength(0);
            expect(result.data?.totalCount).toBe(0);
        });
    });

    describe('count', () => {
        it('should count pricing plans matching criteria', async () => {
            const result = await service.count(adminActor, {});

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(result.data?.count).toBe(10);
        });

        it('should count with interval filter', async () => {
            vi.spyOn(mockModel, 'count').mockResolvedValueOnce(5);

            const result = await service.count(adminActor, {
                interval: BillingIntervalEnum.MONTH
            });

            expect(result.data?.count).toBe(5);
        });
    });
});
