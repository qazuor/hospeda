import type { PromotionModel } from '@repo/db';
import { PermissionEnum, type Promotion, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PromotionService } from '../../../src/services/promotion/promotion.service.js';
import type { Actor } from '../../../src/types/index.js';

describe('PromotionService', () => {
    let service: PromotionService;
    let mockModel: PromotionModel;
    let mockActor: Actor;
    let ctx: import('../../../src/types/index.js').ServiceContext;

    // Mock data
    const mockPromotion: Promotion = {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Summer Sale',
        rules: JSON.stringify({ discountPercent: 20 }),
        startsAt: new Date('2024-06-01'),
        endsAt: new Date('2024-08-31'),
        description: 'Summer promotional campaign',
        targetConditions: { minPurchase: 100 },
        maxTotalUsage: 1000,
        currentUsageCount: 50,
        isActive: true,
        createdById: '00000000-0000-0000-0000-000000000099',
        createdAt: new Date(),
        updatedAt: new Date(),
        updatedById: null,
        deletedAt: null,
        deletedById: null,
        adminInfo: null
    };

    beforeEach(() => {
        ctx = {
            logger: {
                info: vi.fn(),
                error: vi.fn(),
                warn: vi.fn(),
                debug: vi.fn()
            }
        } as unknown as import('../../../src/types/index.js').ServiceContext;

        mockActor = {
            id: '00000000-0000-0000-0000-000000000100',
            role: RoleEnum.ADMIN,
            permissions: [
                PermissionEnum.PROMOTION_CREATE,
                PermissionEnum.PROMOTION_UPDATE,
                PermissionEnum.PROMOTION_DELETE,
                PermissionEnum.PROMOTION_VIEW
            ]
        };

        mockModel = {
            isActive: vi.fn(),
            applyPromotion: vi.fn(),
            getEligibleClients: vi.fn(),
            evaluateRules: vi.fn(),
            checkConditions: vi.fn(),
            calculateBenefit: vi.fn(),
            findActive: vi.fn(),
            findByDate: vi.fn(),
            withDiscountCodes: vi.fn(),
            getPerformanceAnalytics: vi.fn()
        } as unknown as PromotionModel;

        service = new PromotionService(ctx, mockModel);
    });

    // =========================================================================
    // Permission Hook Tests
    // =========================================================================

    describe('Permission Hooks', () => {
        it('should allow ADMIN to create promotion', () => {
            expect(() => service._canCreate(mockActor, {})).not.toThrow();
        });

        it('should allow user with PROMOTION_CREATE permission to create promotion', () => {
            const actorWithPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: [PermissionEnum.PROMOTION_CREATE]
            };

            expect(() => service._canCreate(actorWithPermission, {})).not.toThrow();
        });

        it('should deny creation without permission', () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            expect(() => service._canCreate(actorWithoutPermission, {})).toThrow();
        });

        it('should allow ADMIN to update promotion', () => {
            expect(() => service._canUpdate(mockActor, mockPromotion)).not.toThrow();
        });

        it('should deny update without permission', () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            expect(() => service._canUpdate(actorWithoutPermission, mockPromotion)).toThrow();
        });

        it('should allow ADMIN to soft delete promotion', () => {
            expect(() => service._canSoftDelete(mockActor, mockPromotion)).not.toThrow();
        });

        it('should deny soft delete without permission', () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            expect(() => service._canSoftDelete(actorWithoutPermission, mockPromotion)).toThrow();
        });

        it('should allow only ADMIN to hard delete promotion', () => {
            expect(() => service._canHardDelete(mockActor, mockPromotion)).not.toThrow();
        });

        it('should deny hard delete for non-admin', () => {
            const actorWithPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: [PermissionEnum.PROMOTION_HARD_DELETE]
            };

            expect(() => service._canHardDelete(actorWithPermission, mockPromotion)).toThrow();
        });

        it('should allow ADMIN to view promotion', () => {
            expect(() => service._canView(mockActor, mockPromotion)).not.toThrow();
        });

        it('should deny view without permission', () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            expect(() => service._canView(actorWithoutPermission, mockPromotion)).toThrow();
        });

        it('should allow ADMIN to list promotions', () => {
            expect(() => service._canList(mockActor)).not.toThrow();
        });

        it('should deny list without permission', () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            expect(() => service._canList(actorWithoutPermission)).toThrow();
        });

        it('should allow ADMIN to restore promotion', () => {
            expect(() => service._canRestore(mockActor, mockPromotion)).not.toThrow();
        });

        it('should deny restore without permission', () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            expect(() => service._canRestore(actorWithoutPermission, mockPromotion)).toThrow();
        });

        it('should allow ADMIN to search promotions', () => {
            expect(() => service._canSearch(mockActor)).not.toThrow();
        });

        it('should deny search without permission', () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            expect(() => service._canSearch(actorWithoutPermission)).toThrow();
        });

        it('should allow ADMIN to count promotions', () => {
            expect(() => service._canCount(mockActor)).not.toThrow();
        });

        it('should deny count without permission', () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            expect(() => service._canCount(actorWithoutPermission)).toThrow();
        });
    });

    // =========================================================================
    // isActive
    // =========================================================================

    describe('isActive', () => {
        it('should check if promotion is active', async () => {
            const promotionId = '00000000-0000-0000-0000-000000000001';

            vi.mocked(mockModel.isActive).mockResolvedValue(true);

            const result = await service.isActive(mockActor, promotionId);

            expect(result.data).toBe(true);
            expect(result.error).toBeUndefined();
            expect(mockModel.isActive).toHaveBeenCalledWith(promotionId);
        });

        it('should return false when promotion is not active', async () => {
            const promotionId = '00000000-0000-0000-0000-000000000001';

            vi.mocked(mockModel.isActive).mockResolvedValue(false);

            const result = await service.isActive(mockActor, promotionId);

            expect(result.data).toBe(false);
            expect(result.error).toBeUndefined();
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new PromotionService(ctx, mockModel);

            const result = await serviceWithoutPermission.isActive(
                actorWithoutPermission,
                'promotion-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // applyPromotion
    // =========================================================================

    describe('applyPromotion', () => {
        it('should apply promotion successfully', async () => {
            const params = {
                promotionId: '00000000-0000-0000-0000-000000000001',
                clientId: 'client-123',
                purchaseData: { amount: 150, items: [] }
            };

            const applyResult = {
                applied: true,
                discountAmount: 30,
                finalAmount: 120,
                appliedRules: ['PERCENTAGE_DISCOUNT']
            };

            vi.mocked(mockModel.applyPromotion).mockResolvedValue(applyResult);

            const result = await service.applyPromotion(mockActor, params);

            expect(result.data).toEqual(applyResult);
            expect(result.error).toBeUndefined();
            expect(mockModel.applyPromotion).toHaveBeenCalledWith(
                params.promotionId,
                params.clientId,
                expect.objectContaining({
                    amount: params.purchaseData.amount,
                    currency: 'ARS'
                })
            );
        });

        it('should return not applied when promotion is inactive', async () => {
            const params = {
                promotionId: '00000000-0000-0000-0000-000000000001',
                clientId: 'client-123',
                purchaseData: { amount: 150 }
            };

            const applyResult = {
                applied: false,
                discountAmount: 0,
                finalAmount: 150,
                reason: 'PROMOTION_NOT_ACTIVE'
            };

            vi.mocked(mockModel.applyPromotion).mockResolvedValue(applyResult);

            const result = await service.applyPromotion(mockActor, params);

            expect(result.data).toEqual(applyResult);
            expect(result.data?.applied).toBe(false);
            expect(result.data?.reason).toBe('PROMOTION_NOT_ACTIVE');
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new PromotionService(ctx, mockModel);

            const result = await serviceWithoutPermission.applyPromotion(actorWithoutPermission, {
                promotionId: 'promo-id',
                clientId: 'client-id',
                purchaseData: { amount: 100 }
            });

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // getEligibleClients
    // =========================================================================

    describe('getEligibleClients', () => {
        it('should get eligible clients', async () => {
            const promotionId = '00000000-0000-0000-0000-000000000001';
            const eligibleClients = [
                { clientId: 'client-1', eligibilityScore: 0.9 },
                { clientId: 'client-2', eligibilityScore: 0.8 }
            ];

            vi.mocked(mockModel.getEligibleClients).mockResolvedValue(eligibleClients);

            const result = await service.getEligibleClients(mockActor, { promotionId });

            expect(result.data).toEqual(eligibleClients);
            expect(result.error).toBeUndefined();
            expect(mockModel.getEligibleClients).toHaveBeenCalledWith(promotionId, undefined);
        });

        it('should get eligible clients with limit', async () => {
            const promotionId = '00000000-0000-0000-0000-000000000001';
            const limit = 10;
            const eligibleClients = [{ clientId: 'client-1', eligibilityScore: 0.9 }];

            vi.mocked(mockModel.getEligibleClients).mockResolvedValue(eligibleClients);

            const result = await service.getEligibleClients(mockActor, { promotionId, limit });

            expect(result.data).toEqual(eligibleClients);
            expect(mockModel.getEligibleClients).toHaveBeenCalledWith(promotionId, limit);
        });

        it('should return empty array when no eligible clients', async () => {
            const promotionId = '00000000-0000-0000-0000-000000000001';

            vi.mocked(mockModel.getEligibleClients).mockResolvedValue([]);

            const result = await service.getEligibleClients(mockActor, { promotionId });

            expect(result.data).toEqual([]);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new PromotionService(ctx, mockModel);

            const result = await serviceWithoutPermission.getEligibleClients(
                actorWithoutPermission,
                { promotionId: 'promo-id' }
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // evaluateRules
    // =========================================================================

    describe('evaluateRules', () => {
        it('should evaluate rules as eligible', async () => {
            const params = {
                promotion: mockPromotion,
                clientId: 'client-123',
                purchaseData: { amount: 150 }
            };

            const evaluationResult = {
                eligible: true,
                appliedRules: ['MINIMUM_AMOUNT_CHECK']
            };

            vi.mocked(mockModel.evaluateRules).mockResolvedValue(evaluationResult);

            const result = await service.evaluateRules(mockActor, params);

            expect(result.data).toEqual(evaluationResult);
            expect(result.error).toBeUndefined();
        });

        it('should evaluate rules as not eligible with reason', async () => {
            const params = {
                promotion: mockPromotion,
                clientId: 'client-123',
                purchaseData: { amount: 50 }
            };

            const evaluationResult = {
                eligible: false,
                reason: 'MINIMUM_AMOUNT_NOT_MET'
            };

            vi.mocked(mockModel.evaluateRules).mockResolvedValue(evaluationResult);

            const result = await service.evaluateRules(mockActor, params);

            expect(result.data).toEqual(evaluationResult);
            expect(result.data?.eligible).toBe(false);
            expect(result.data?.reason).toBe('MINIMUM_AMOUNT_NOT_MET');
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new PromotionService(ctx, mockModel);

            const result = await serviceWithoutPermission.evaluateRules(actorWithoutPermission, {
                promotion: mockPromotion,
                clientId: 'client-id',
                purchaseData: { amount: 100 }
            });

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // checkConditions
    // =========================================================================

    describe('checkConditions', () => {
        it('should check conditions as met', async () => {
            const params = {
                promotionId: '00000000-0000-0000-0000-000000000001',
                conditions: { checkDate: true }
            };

            const conditionResult = {
                met: true,
                details: { dateValid: true, exists: true }
            };

            vi.mocked(mockModel.checkConditions).mockResolvedValue(conditionResult);

            const result = await service.checkConditions(mockActor, params);

            expect(result.data).toEqual(conditionResult);
            expect(result.error).toBeUndefined();
        });

        it('should check conditions as not met', async () => {
            const params = {
                promotionId: '00000000-0000-0000-0000-000000000001',
                conditions: { checkDate: true }
            };

            const conditionResult = {
                met: false,
                details: { dateValid: false, exists: true }
            };

            vi.mocked(mockModel.checkConditions).mockResolvedValue(conditionResult);

            const result = await service.checkConditions(mockActor, params);

            expect(result.data).toEqual(conditionResult);
            expect(result.data?.met).toBe(false);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new PromotionService(ctx, mockModel);

            const result = await serviceWithoutPermission.checkConditions(actorWithoutPermission, {
                promotionId: 'promo-id',
                conditions: {}
            });

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // calculateBenefit
    // =========================================================================

    describe('calculateBenefit', () => {
        it('should calculate percentage discount benefit', async () => {
            const params = {
                promotion: mockPromotion,
                purchaseData: { amount: 150 }
            };

            const benefitResult = {
                discountAmount: 30,
                finalAmount: 120,
                benefitType: 'PERCENTAGE_DISCOUNT'
            };

            vi.mocked(mockModel.calculateBenefit).mockResolvedValue(benefitResult);

            const result = await service.calculateBenefit(mockActor, params);

            expect(result.data).toEqual(benefitResult);
            expect(result.error).toBeUndefined();
        });

        it('should calculate fixed discount benefit', async () => {
            const params = {
                promotion: mockPromotion,
                purchaseData: { amount: 150 }
            };

            const benefitResult = {
                discountAmount: 20,
                finalAmount: 130,
                benefitType: 'FIXED_DISCOUNT'
            };

            vi.mocked(mockModel.calculateBenefit).mockResolvedValue(benefitResult);

            const result = await service.calculateBenefit(mockActor, params);

            expect(result.data).toEqual(benefitResult);
            expect(result.data?.benefitType).toBe('FIXED_DISCOUNT');
        });

        it('should return zero benefit when no rules', async () => {
            const params = {
                promotion: { ...mockPromotion, rules: '' },
                purchaseData: { amount: 150 }
            };

            const benefitResult = {
                discountAmount: 0,
                finalAmount: 150,
                benefitType: 'NONE'
            };

            vi.mocked(mockModel.calculateBenefit).mockResolvedValue(benefitResult);

            const result = await service.calculateBenefit(mockActor, params);

            expect(result.data).toEqual(benefitResult);
            expect(result.data?.discountAmount).toBe(0);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new PromotionService(ctx, mockModel);

            const result = await serviceWithoutPermission.calculateBenefit(actorWithoutPermission, {
                promotion: mockPromotion,
                purchaseData: { amount: 100 }
            });

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // findActive
    // =========================================================================

    describe('findActive', () => {
        it('should find active promotions', async () => {
            const activePromotions = {
                items: [mockPromotion],
                total: 1
            };

            vi.mocked(mockModel.findActive).mockResolvedValue(activePromotions);

            const result = await service.findActive(mockActor);

            expect(result.data).toEqual(activePromotions);
            expect(result.error).toBeUndefined();
            expect(mockModel.findActive).toHaveBeenCalledWith(undefined);
        });

        it('should find active promotions with pagination', async () => {
            const options = { page: 1, pageSize: 10 };
            const activePromotions = {
                items: [mockPromotion],
                total: 1
            };

            vi.mocked(mockModel.findActive).mockResolvedValue(activePromotions);

            const result = await service.findActive(mockActor, options);

            expect(result.data).toEqual(activePromotions);
            expect(mockModel.findActive).toHaveBeenCalledWith(options);
        });

        it('should return empty array when no active promotions', async () => {
            const activePromotions = {
                items: [],
                total: 0
            };

            vi.mocked(mockModel.findActive).mockResolvedValue(activePromotions);

            const result = await service.findActive(mockActor);

            expect(result.data).toEqual(activePromotions);
            expect(result.data?.items).toEqual([]);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new PromotionService(ctx, mockModel);

            const result = await serviceWithoutPermission.findActive(actorWithoutPermission);

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // findByDate
    // =========================================================================

    describe('findByDate', () => {
        it('should find promotions by date range', async () => {
            const params = {
                startDate: new Date('2024-06-01'),
                endDate: new Date('2024-08-31')
            };

            const promotions = {
                items: [mockPromotion],
                total: 1
            };

            vi.mocked(mockModel.findByDate).mockResolvedValue(promotions);

            const result = await service.findByDate(mockActor, params);

            expect(result.data).toEqual(promotions);
            expect(result.error).toBeUndefined();
            expect(mockModel.findByDate).toHaveBeenCalledWith(
                params.startDate,
                params.endDate,
                undefined
            );
        });

        it('should find promotions by date range with pagination', async () => {
            const params = {
                startDate: new Date('2024-06-01'),
                endDate: new Date('2024-08-31'),
                options: { page: 1, pageSize: 10 }
            };

            const promotions = {
                items: [mockPromotion],
                total: 1
            };

            vi.mocked(mockModel.findByDate).mockResolvedValue(promotions);

            const result = await service.findByDate(mockActor, params);

            expect(result.data).toEqual(promotions);
            expect(mockModel.findByDate).toHaveBeenCalledWith(
                params.startDate,
                params.endDate,
                params.options
            );
        });

        it('should return empty array when no promotions in range', async () => {
            const params = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31')
            };

            const promotions = {
                items: [],
                total: 0
            };

            vi.mocked(mockModel.findByDate).mockResolvedValue(promotions);

            const result = await service.findByDate(mockActor, params);

            expect(result.data).toEqual(promotions);
            expect(result.data?.items).toEqual([]);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new PromotionService(ctx, mockModel);

            const result = await serviceWithoutPermission.findByDate(actorWithoutPermission, {
                startDate: new Date(),
                endDate: new Date()
            });

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // withDiscountCodes
    // =========================================================================

    describe('withDiscountCodes', () => {
        it('should get promotions with discount codes', async () => {
            const promotionWithCodes = {
                items: [
                    {
                        ...mockPromotion,
                        discountCodes: [
                            { id: 'code-1', code: 'SUMMER20', discountType: 'PERCENTAGE' }
                        ]
                    }
                ],
                total: 1
            };

            vi.mocked(mockModel.withDiscountCodes).mockResolvedValue(promotionWithCodes);

            const result = await service.withDiscountCodes(mockActor);

            expect(result.data).toEqual(promotionWithCodes);
            expect(result.error).toBeUndefined();
            expect(mockModel.withDiscountCodes).toHaveBeenCalledWith(undefined, undefined);
        });

        it('should get specific promotion with discount codes', async () => {
            const params = { promotionId: '00000000-0000-0000-0000-000000000001' };

            const promotionWithCodes = {
                items: [
                    {
                        ...mockPromotion,
                        discountCodes: [
                            { id: 'code-1', code: 'SUMMER20', discountType: 'PERCENTAGE' }
                        ]
                    }
                ],
                total: 1
            };

            vi.mocked(mockModel.withDiscountCodes).mockResolvedValue(promotionWithCodes);

            const result = await service.withDiscountCodes(mockActor, params);

            expect(result.data).toEqual(promotionWithCodes);
            expect(mockModel.withDiscountCodes).toHaveBeenCalledWith(params.promotionId, undefined);
        });

        it('should get promotions with discount codes with pagination', async () => {
            const params = {
                promotionId: '00000000-0000-0000-0000-000000000001',
                options: { page: 1, pageSize: 10 }
            };

            const promotionWithCodes = {
                items: [
                    {
                        ...mockPromotion,
                        discountCodes: []
                    }
                ],
                total: 1
            };

            vi.mocked(mockModel.withDiscountCodes).mockResolvedValue(promotionWithCodes);

            const result = await service.withDiscountCodes(mockActor, params);

            expect(result.data).toEqual(promotionWithCodes);
            expect(mockModel.withDiscountCodes).toHaveBeenCalledWith(
                params.promotionId,
                params.options
            );
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new PromotionService(ctx, mockModel);

            const result = await serviceWithoutPermission.withDiscountCodes(actorWithoutPermission);

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // getPerformanceAnalytics
    // =========================================================================

    describe('getPerformanceAnalytics', () => {
        it('should get performance analytics', async () => {
            const promotionId = '00000000-0000-0000-0000-000000000001';
            const modelAnalytics = {
                totalDiscountCodesGenerated: 100,
                totalDiscountCodesUsed: 50,
                usageRate: 50.0,
                totalDiscountValue: 1500,
                uniqueUsers: 45
            };

            vi.mocked(mockModel.getPerformanceAnalytics).mockResolvedValue(modelAnalytics);

            const result = await service.getPerformanceAnalytics(mockActor, promotionId);

            expect(result.data).toBeDefined();
            expect(result.data?.totalDiscountCodesGenerated).toBe(100);
            expect(result.data?.totalUsage).toBe(50);
            expect(result.data?.totalDiscountAmount).toBe(1500);
            expect(result.data?.averageDiscountPerUse).toBe(30);
            expect(result.data?.conversionRate).toBe(50.0);
            expect(result.error).toBeUndefined();
            expect(mockModel.getPerformanceAnalytics).toHaveBeenCalledWith(promotionId);
        });

        it('should return zero analytics when no codes used', async () => {
            const promotionId = '00000000-0000-0000-0000-000000000001';
            const modelAnalytics = {
                totalDiscountCodesGenerated: 100,
                totalDiscountCodesUsed: 0,
                usageRate: 0,
                totalDiscountValue: 0,
                uniqueUsers: 0
            };

            vi.mocked(mockModel.getPerformanceAnalytics).mockResolvedValue(modelAnalytics);

            const result = await service.getPerformanceAnalytics(mockActor, promotionId);

            expect(result.data).toBeDefined();
            expect(result.data?.totalUsage).toBe(0);
            expect(result.data?.averageDiscountPerUse).toBe(0);
            expect(result.data?.conversionRate).toBe(0);
        });

        it('should handle promotion with no codes', async () => {
            const promotionId = '00000000-0000-0000-0000-000000000001';
            const modelAnalytics = {
                totalDiscountCodesGenerated: 0,
                totalDiscountCodesUsed: 0,
                usageRate: 0,
                totalDiscountValue: 0,
                uniqueUsers: 0
            };

            vi.mocked(mockModel.getPerformanceAnalytics).mockResolvedValue(modelAnalytics);

            const result = await service.getPerformanceAnalytics(mockActor, promotionId);

            expect(result.data).toBeDefined();
            expect(result.data?.totalDiscountCodesGenerated).toBe(0);
            expect(result.data?.totalUsage).toBe(0);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new PromotionService(ctx, mockModel);

            const result = await serviceWithoutPermission.getPerformanceAnalytics(
                actorWithoutPermission,
                'promo-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });
});
