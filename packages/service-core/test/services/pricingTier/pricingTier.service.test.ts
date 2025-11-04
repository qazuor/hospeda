import { PricingTierModel } from '@repo/db';
import type {
    OverlapCheckResult,
    RangeValidationResult,
    SavingsCalculation,
    TierPriceCalculation,
    TierStructureValidation
} from '@repo/db';
import { RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { PricingTier } from '@repo/schemas/entities/pricingTier';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PricingTierService } from '../../../src/services/pricingTier/pricingTier.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { createMockPricingTier } from '../../factories/pricingTierFactory';

describe('PricingTierService', () => {
    let service: PricingTierService;
    let mockModel: PricingTierModel;
    let mockPricingTier: PricingTier;
    let adminActor: Actor;
    let userActor: Actor;

    beforeEach(() => {
        // Create mock model
        mockModel = new PricingTierModel();

        // Create test data
        mockPricingTier = createMockPricingTier();
        adminActor = createActor({ role: RoleEnum.ADMIN });
        userActor = createActor({ role: RoleEnum.USER, permissions: [] });

        // Mock all model methods
        vi.spyOn(mockModel, 'create').mockResolvedValue(mockPricingTier);
        vi.spyOn(mockModel, 'update').mockResolvedValue(mockPricingTier);
        vi.spyOn(mockModel, 'findById').mockResolvedValue(mockPricingTier);
        vi.spyOn(mockModel, 'findOne').mockResolvedValue(mockPricingTier);
        vi.spyOn(mockModel, 'findAll').mockResolvedValue({
            items: [mockPricingTier],
            totalCount: 1,
            page: 1,
            pageSize: 10,
            totalPages: 1
        });
        vi.spyOn(mockModel, 'findAllWithRelations').mockResolvedValue({
            items: [mockPricingTier],
            totalCount: 1,
            page: 1,
            pageSize: 10,
            totalPages: 1
        });
        vi.spyOn(mockModel, 'softDelete').mockResolvedValue(undefined);
        vi.spyOn(mockModel, 'hardDelete').mockResolvedValue(undefined);
        vi.spyOn(mockModel, 'restore').mockResolvedValue(mockPricingTier);
        vi.spyOn(mockModel, 'count').mockResolvedValue(10);

        // Mock custom model methods
        vi.spyOn(mockModel, 'findApplicableTier').mockResolvedValue(mockPricingTier);
        vi.spyOn(mockModel, 'calculatePrice').mockResolvedValue({
            tierPrice: 5000,
            quantity: 5,
            tier: mockPricingTier
        } as unknown as TierPriceCalculation);
        vi.spyOn(mockModel, 'validateRanges').mockResolvedValue({
            isValid: true,
            errors: []
        } as RangeValidationResult);
        vi.spyOn(mockModel, 'checkOverlaps').mockResolvedValue({
            hasOverlaps: false,
            overlaps: []
        } as OverlapCheckResult);
        vi.spyOn(mockModel, 'getTierForQuantity').mockResolvedValue(mockPricingTier);
        vi.spyOn(mockModel, 'calculateSavings').mockResolvedValue({
            savings: 500,
            percentageSaved: 10,
            comparisonTier: mockPricingTier
        } as unknown as SavingsCalculation);
        vi.spyOn(mockModel, 'findByPlan').mockResolvedValue([mockPricingTier]);
        vi.spyOn(mockModel, 'validateTierStructure').mockResolvedValue({
            isValid: true,
            errors: [],
            warnings: []
        } as TierStructureValidation);
        vi.spyOn(mockModel, 'getOptimalTier').mockResolvedValue(mockPricingTier);

        // Create service with mocked model
        service = new PricingTierService({ logger: console }, mockModel);
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
            const newService = new PricingTierService({ logger: console });
            expect(newService.model).toBeInstanceOf(PricingTierModel);
        });
    });

    // ============================================================================
    // CRUD OPERATIONS
    // ============================================================================

    describe('create', () => {
        it('should create a new pricing tier with valid data', async () => {
            const data = {
                pricingPlanId: mockPricingTier.pricingPlanId,
                minQuantity: 1,
                maxQuantity: 10,
                unitPriceMinor: 1000
            };

            const result = await service.create(adminActor, data);

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(result.data?.id).toBe(mockPricingTier.id);
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
                pricingPlanId: mockPricingTier.pricingPlanId,
                minQuantity: 1,
                maxQuantity: 10,
                unitPriceMinor: 1000
            };

            const result = await service.create(userActor, data);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(mockModel.create).not.toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('should update pricing tier with valid data', async () => {
            const updateData = { unitPriceMinor: 1500 };

            const result = await service.update(adminActor, mockPricingTier.id, updateData);

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(mockModel.update).toHaveBeenCalledWith(
                { id: mockPricingTier.id },
                expect.objectContaining({
                    ...updateData,
                    updatedById: adminActor.id
                })
            );
        });

        it('should forbid non-admin without permission to update', async () => {
            const result = await service.update(userActor, mockPricingTier.id, {
                unitPriceMinor: 1500
            });

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('getById', () => {
        it('should retrieve pricing tier by id', async () => {
            const result = await service.getById(adminActor, mockPricingTier.id);

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(result.data?.id).toBe(mockPricingTier.id);
        });

        it('should throw NOT_FOUND if pricing tier does not exist', async () => {
            vi.spyOn(mockModel, 'findOne').mockResolvedValueOnce(null);

            const result = await service.getById(adminActor, mockPricingTier.id);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });
    });

    describe('list', () => {
        it('should list all pricing tiers with pagination', async () => {
            const result = await service.list(adminActor, { page: 1, pageSize: 10 });

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(result.data?.items).toHaveLength(1);
            expect(result.data?.totalCount).toBe(1);
        });

        it('should allow any authenticated user to list pricing tiers', async () => {
            const result = await service.list(userActor, {});

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
        });
    });

    describe('softDelete', () => {
        it('should soft delete pricing tier as admin', async () => {
            const result = await service.softDelete(adminActor, mockPricingTier.id);

            expect(result.error).toBeUndefined();
            expect(mockModel.softDelete).toHaveBeenCalled();
        });

        it('should forbid non-admin to soft delete', async () => {
            const result = await service.softDelete(userActor, mockPricingTier.id);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('hardDelete', () => {
        it('should hard delete pricing tier as super admin', async () => {
            const superAdminActor = createActor({ role: RoleEnum.SUPER_ADMIN });
            vi.spyOn(mockModel, 'findById').mockResolvedValueOnce(mockPricingTier);

            const result = await service.hardDelete(superAdminActor, mockPricingTier.id);

            expect(result.error).toBeUndefined();
            expect(mockModel.hardDelete).toHaveBeenCalled();
        });

        it('should forbid non-super-admin from hard delete', async () => {
            vi.spyOn(mockModel, 'findById').mockResolvedValueOnce(mockPricingTier);

            const result = await service.hardDelete(adminActor, mockPricingTier.id);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('restore', () => {
        it('should restore pricing tier as admin', async () => {
            const deletedPricingTier = { ...mockPricingTier, deletedAt: new Date() };
            vi.spyOn(mockModel, 'findById').mockResolvedValueOnce(deletedPricingTier);
            vi.spyOn(mockModel, 'restore').mockResolvedValueOnce(1);

            const result = await service.restore(adminActor, mockPricingTier.id);

            expect(result.error).toBeUndefined();
            expect(result.data).toEqual({ count: 1 });
            expect(mockModel.restore).toHaveBeenCalledWith({ id: mockPricingTier.id });
        });

        it('should forbid non-admin from restore', async () => {
            const result = await service.restore(userActor, mockPricingTier.id);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    // ============================================================================
    // CUSTOM BUSINESS METHODS
    // ============================================================================

    describe('findApplicableTier', () => {
        it('should find applicable tier for quantity', async () => {
            const result = await service.findApplicableTier(
                adminActor,
                mockPricingTier.pricingPlanId,
                5
            );

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(result.data?.id).toBe(mockPricingTier.id);
            expect(mockModel.findApplicableTier).toHaveBeenCalledWith(
                mockPricingTier.pricingPlanId,
                5,
                undefined
            );
        });

        it('should return null if no tier applies', async () => {
            vi.spyOn(mockModel, 'findApplicableTier').mockResolvedValueOnce(null);

            const result = await service.findApplicableTier(
                adminActor,
                mockPricingTier.pricingPlanId,
                1000
            );

            expect(result.data).toBeNull();
        });
    });

    describe('calculatePrice', () => {
        it('should calculate price for tier and quantity', async () => {
            const result = await service.calculatePrice(adminActor, mockPricingTier.id, 5);

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(result.data?.tierPrice).toBe(5000);
            expect(result.data?.quantity).toBe(5);
            expect(mockModel.calculatePrice).toHaveBeenCalledWith(mockPricingTier.id, 5, undefined);
        });

        it('should return calculation with tier details', async () => {
            const result = await service.calculatePrice(adminActor, mockPricingTier.id, 3);

            expect(result.data?.tier).toBeDefined();
        });
    });

    describe('validateRanges', () => {
        it('should validate ranges successfully', async () => {
            const result = await service.validateRanges(adminActor, mockPricingTier.pricingPlanId);

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(result.data?.isValid).toBe(true);
            expect(result.data?.errors).toHaveLength(0);
        });

        it('should return errors for invalid ranges', async () => {
            vi.spyOn(mockModel, 'validateRanges').mockResolvedValueOnce({
                isValid: false,
                errors: ['Overlap detected']
            });

            const result = await service.validateRanges(adminActor, mockPricingTier.pricingPlanId);

            expect(result.data?.isValid).toBe(false);
            expect(result.data?.errors).toHaveLength(1);
        });
    });

    describe('checkOverlaps', () => {
        it('should check for overlaps successfully', async () => {
            const result = await service.checkOverlaps(adminActor, mockPricingTier.pricingPlanId);

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(result.data?.hasOverlaps).toBe(false);
            expect(result.data?.overlaps).toHaveLength(0);
        });

        it('should detect overlaps', async () => {
            vi.spyOn(mockModel, 'checkOverlaps').mockResolvedValueOnce({
                hasOverlaps: true,
                overlaps: [
                    {
                        tier1: mockPricingTier,
                        tier2: createMockPricingTier({ id: 'pt2' as any }),
                        overlapRange: { min: 5, max: 10 }
                    }
                ]
            });

            const result = await service.checkOverlaps(adminActor, mockPricingTier.pricingPlanId);

            expect(result.data?.hasOverlaps).toBe(true);
            expect(result.data?.overlaps).toHaveLength(1);
        });
    });

    describe('getTierForQuantity', () => {
        it('should get tier for specific quantity', async () => {
            const result = await service.getTierForQuantity(
                adminActor,
                mockPricingTier.pricingPlanId,
                5
            );

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(result.data?.id).toBe(mockPricingTier.id);
        });

        it('should return null if no tier found', async () => {
            vi.spyOn(mockModel, 'getTierForQuantity').mockResolvedValueOnce(null);

            const result = await service.getTierForQuantity(
                adminActor,
                mockPricingTier.pricingPlanId,
                1000
            );

            expect(result.data).toBeNull();
        });
    });

    describe('calculateSavings', () => {
        it('should calculate savings between tiers', async () => {
            const tier2Id = 'tier2-uuid';
            const result = await service.calculateSavings(
                adminActor,
                mockPricingTier.id,
                tier2Id,
                10
            );

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(result.data?.savings).toBe(500);
            expect(result.data?.percentageSaved).toBe(10);
        });

        it('should handle no savings scenario', async () => {
            vi.spyOn(mockModel, 'calculateSavings').mockResolvedValueOnce({
                savings: 0,
                percentageSaved: 0,
                comparisonTier: mockPricingTier
            } as unknown as SavingsCalculation);

            const result = await service.calculateSavings(
                adminActor,
                mockPricingTier.id,
                'tier2-uuid',
                5
            );

            expect(result.data?.savings).toBe(0);
            expect(result.data?.percentageSaved).toBe(0);
        });
    });

    describe('findByPlan', () => {
        it('should find tiers by plan', async () => {
            const result = await service.findByPlan(adminActor, mockPricingTier.pricingPlanId);

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(Array.isArray(result.data)).toBe(true);
            expect(mockModel.findByPlan).toHaveBeenCalledWith(
                mockPricingTier.pricingPlanId,
                undefined
            );
        });

        it('should return empty array if no tiers found', async () => {
            vi.spyOn(mockModel, 'findByPlan').mockResolvedValueOnce([]);

            const result = await service.findByPlan(adminActor, 'non-existent-plan');

            expect(result.data).toEqual([]);
        });
    });

    describe('validateTierStructure', () => {
        it('should validate tier structure successfully', async () => {
            const result = await service.validateTierStructure(
                adminActor,
                mockPricingTier.pricingPlanId
            );

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(result.data?.isValid).toBe(true);
            expect(result.data?.errors).toHaveLength(0);
            expect(result.data?.warnings).toHaveLength(0);
        });

        it('should return validation errors and warnings', async () => {
            vi.spyOn(mockModel, 'validateTierStructure').mockResolvedValueOnce({
                isValid: false,
                errors: ['Gap in coverage'],
                warnings: ['Consider adding more tiers']
            });

            const result = await service.validateTierStructure(
                adminActor,
                mockPricingTier.pricingPlanId
            );

            expect(result.data?.isValid).toBe(false);
            expect(result.data?.errors).toHaveLength(1);
            expect(result.data?.warnings).toHaveLength(1);
        });
    });

    describe('getOptimalTier', () => {
        it('should get optimal tier for quantity', async () => {
            const result = await service.getOptimalTier(
                adminActor,
                mockPricingTier.pricingPlanId,
                25
            );

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(result.data?.id).toBe(mockPricingTier.id);
            expect(mockModel.getOptimalTier).toHaveBeenCalledWith(
                mockPricingTier.pricingPlanId,
                25,
                undefined
            );
        });

        it('should return null if no optimal tier found', async () => {
            vi.spyOn(mockModel, 'getOptimalTier').mockResolvedValueOnce(null);

            const result = await service.getOptimalTier(
                adminActor,
                mockPricingTier.pricingPlanId,
                0
            );

            expect(result.data).toBeNull();
        });
    });

    // ============================================================================
    // SEARCH & COUNT
    // ============================================================================

    describe('search', () => {
        it('should search pricing tiers with filters', async () => {
            const filters = {
                pricingPlanId: mockPricingTier.pricingPlanId,
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
                pricingPlanId: '00000000-0000-0000-0000-000000000000'
            });

            expect(result.data?.items).toHaveLength(0);
            expect(result.data?.totalCount).toBe(0);
        });
    });

    describe('count', () => {
        it('should count pricing tiers matching criteria', async () => {
            const result = await service.count(adminActor, {});

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(result.data?.count).toBe(10);
        });

        it('should count with plan filter', async () => {
            vi.spyOn(mockModel, 'count').mockResolvedValueOnce(5);

            const result = await service.count(adminActor, {
                pricingPlanId: mockPricingTier.pricingPlanId
            });

            expect(result.data?.count).toBe(5);
        });
    });
});
