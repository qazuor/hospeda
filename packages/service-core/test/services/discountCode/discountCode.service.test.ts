import type { DiscountCodeModel } from '@repo/db';
import { DiscountTypeEnum, PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor, DiscountCode } from '@repo/types';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscountCodeService } from '../../../src/services/discountCode/discountCode.service';
import { createMockBaseModel } from '../../factories/baseServiceFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

describe('DiscountCodeService', () => {
    let service: DiscountCodeService;
    let model: ReturnType<typeof createMockBaseModel>;
    let mockActor: Actor;

    beforeEach(() => {
        // Mock actor with admin role and permissions
        mockActor = {
            id: '00000000-0000-4000-8000-000000000100',
            role: RoleEnum.ADMIN,
            permissions: [
                PermissionEnum.DISCOUNT_CODE_CREATE,
                PermissionEnum.DISCOUNT_CODE_UPDATE,
                PermissionEnum.DISCOUNT_CODE_DELETE,
                PermissionEnum.DISCOUNT_CODE_VIEW,
                PermissionEnum.DISCOUNT_CODE_RESTORE
            ]
        };

        // Create mock model using factory
        model = createMockBaseModel();

        // Add findOne method (not included in base factory)
        model.findOne = vi.fn();

        // Initialize service with mocked logger and model
        service = new DiscountCodeService({ logger: mockLogger }, model as DiscountCodeModel);

        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('create', () => {
        it('should create a percentage discount code successfully', async () => {
            const createData = {
                createdById: mockActor.id!,
                code: 'SUMMER25',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: 25,
                validFrom: new Date('2025-06-01'),
                validTo: new Date('2025-08-31')
            };

            const mockCreatedCode: DiscountCode = {
                id: '00000000-0000-4000-8000-000000000201',
                ...createData,
                promotionId: undefined,
                amountOffMinor: undefined,
                maxRedemptionsGlobal: undefined,
                maxRedemptionsPerUser: undefined,
                usedCountGlobal: 0,
                currency: 'USD',
                minimumPurchaseAmount: null,
                minimumPurchaseCurrency: 'USD',
                isActive: true,
                description: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: mockActor.id!,
                updatedById: mockActor.id!,
                deletedAt: null,
                deletedById: null
            };

            (model.create as Mock).mockResolvedValue(mockCreatedCode);

            const result = await service.create(mockActor, createData);

            expect(result.data).toBeDefined();
            expect(result.data?.code).toBe('SUMMER25');
            expect(result.data?.discountType).toBe(DiscountTypeEnum.PERCENTAGE);
            expect(result.data?.percentOff).toBe(25);
            expect(result.error).toBeUndefined();
            expect(model.create).toHaveBeenCalled();
        });

        it('should create a fixed amount discount code successfully', async () => {
            const createData = {
                createdById: mockActor.id!,
                code: 'SAVE50',
                discountType: DiscountTypeEnum.FIXED_AMOUNT,
                amountOffMinor: 5000, // $50.00 in minor units
                validFrom: new Date('2025-01-01'),
                validTo: new Date('2025-12-31')
            };

            const mockCreatedCode: DiscountCode = {
                id: '00000000-0000-4000-8000-000000000202',
                ...createData,
                promotionId: undefined,
                percentOff: undefined,
                maxRedemptionsGlobal: undefined,
                maxRedemptionsPerUser: undefined,
                usedCountGlobal: 0,
                currency: 'USD',
                minimumPurchaseAmount: null,
                minimumPurchaseCurrency: 'USD',
                isActive: true,
                description: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: mockActor.id!,
                updatedById: mockActor.id!,
                deletedAt: null,
                deletedById: null
            };

            (model.create as Mock).mockResolvedValue(mockCreatedCode);

            const result = await service.create(mockActor, createData);

            expect(result.data).toBeDefined();
            expect(result.data?.code).toBe('SAVE50');
            expect(result.data?.discountType).toBe(DiscountTypeEnum.FIXED_AMOUNT);
            expect(result.data?.amountOffMinor).toBe(5000);
            expect(result.error).toBeUndefined();
        });

        it('should fail when actor has no permission', async () => {
            const unauthorizedActor: Actor = {
                id: '00000000-0000-4000-8000-000000000999',
                role: RoleEnum.CLIENT,
                permissions: []
            };

            const unauthorizedService = new DiscountCodeService(
                { logger: mockLogger },
                model as DiscountCodeModel
            );

            const createData = {
                createdById: unauthorizedActor.id!,
                code: 'TEST123',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: 10,
                validFrom: new Date(),
                validTo: new Date(Date.now() + 86400000)
            };

            const result = await unauthorizedService.create(unauthorizedActor, createData);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(result.data).toBeUndefined();
        });
    });

    describe('getById', () => {
        it('should find discount code by id successfully', async () => {
            const mockCode: DiscountCode = {
                id: '00000000-0000-4000-8000-000000000201',
                promotionId: undefined,
                code: 'TESTCODE',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: 15,
                amountOffMinor: undefined,
                validFrom: new Date('2025-01-01'),
                validTo: new Date('2025-12-31'),
                maxRedemptionsGlobal: undefined,
                maxRedemptionsPerUser: undefined,
                usedCountGlobal: 0,
                currency: 'USD',
                minimumPurchaseAmount: null,
                minimumPurchaseCurrency: 'USD',
                isActive: true,
                description: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: mockActor.id!,
                updatedById: mockActor.id!,
                deletedAt: null,
                deletedById: null
            };

            (model.findOne as Mock).mockResolvedValue(mockCode);

            const result = await service.getById(mockActor, mockCode.id);

            expect(result.data).toBeDefined();
            expect(result.data?.id).toBe(mockCode.id);
            expect(result.data?.code).toBe('TESTCODE');
            expect(result.error).toBeUndefined();
        });

        it('should return not found error when code does not exist', async () => {
            (model.findOne as Mock).mockResolvedValue(null);

            const result = await service.getById(mockActor, '00000000-0000-4000-8000-999999999999');

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
            expect(result.data).toBeUndefined();
        });
    });

    describe('update', () => {
        it('should update discount code successfully', async () => {
            const codeId = '00000000-0000-4000-8000-000000000201';
            const updateData = {
                code: 'UPDATED_CODE',
                maxRedemptionsGlobal: 100
            };

            const existingCode: DiscountCode = {
                id: codeId,
                promotionId: undefined,
                code: 'OLD_CODE',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: 15,
                amountOffMinor: undefined,
                validFrom: new Date('2025-01-01'),
                validTo: new Date('2025-12-31'),
                maxRedemptionsGlobal: undefined,
                maxRedemptionsPerUser: undefined,
                usedCountGlobal: 0,
                currency: 'USD',
                minimumPurchaseAmount: null,
                minimumPurchaseCurrency: 'USD',
                isActive: true,
                description: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: mockActor.id!,
                updatedById: mockActor.id!,
                deletedAt: null,
                deletedById: null
            };

            const mockUpdatedCode: DiscountCode = {
                ...existingCode,
                code: 'UPDATED_CODE',
                maxRedemptionsGlobal: 100
            };

            (model.findById as Mock).mockResolvedValue(existingCode);
            (model.update as Mock).mockResolvedValue(mockUpdatedCode);

            const result = await service.update(mockActor, codeId, updateData);

            expect(result.data).toBeDefined();
            expect(result.data?.code).toBe('UPDATED_CODE');
            expect(result.data?.maxRedemptionsGlobal).toBe(100);
            expect(result.error).toBeUndefined();
        });
    });

    describe('softDelete', () => {
        it('should soft delete discount code successfully', async () => {
            const codeId = '00000000-0000-4000-8000-000000000201';

            const mockCode: DiscountCode = {
                id: codeId,
                promotionId: undefined,
                code: 'TESTCODE',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: 15,
                amountOffMinor: undefined,
                validFrom: new Date('2025-01-01'),
                validTo: new Date('2025-12-31'),
                maxRedemptionsGlobal: undefined,
                maxRedemptionsPerUser: undefined,
                usedCountGlobal: 0,
                currency: 'USD',
                minimumPurchaseAmount: null,
                minimumPurchaseCurrency: 'USD',
                isActive: true,
                description: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: mockActor.id!,
                updatedById: mockActor.id!,
                deletedAt: null,
                deletedById: null
            };

            (model.findById as Mock).mockResolvedValue(mockCode);
            (model.softDelete as Mock).mockResolvedValue(1);

            const result = await service.softDelete(mockActor, codeId);

            expect(result.data).toBeDefined();
            expect(result.data?.count).toBe(1);
            expect(result.error).toBeUndefined();
        });
    });

    describe('restore', () => {
        it('should restore soft-deleted discount code successfully', async () => {
            const codeId = '00000000-0000-4000-8000-000000000201';

            const mockDeletedCode: DiscountCode = {
                id: codeId,
                promotionId: undefined,
                code: 'TESTCODE',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: 15,
                amountOffMinor: undefined,
                validFrom: new Date('2025-01-01'),
                validTo: new Date('2025-12-31'),
                maxRedemptionsGlobal: undefined,
                maxRedemptionsPerUser: undefined,
                usedCountGlobal: 0,
                currency: 'USD',
                minimumPurchaseAmount: null,
                minimumPurchaseCurrency: 'USD',
                isActive: true,
                description: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: mockActor.id!,
                updatedById: mockActor.id!,
                deletedAt: new Date(),
                deletedById: mockActor.id!
            };

            (model.findById as Mock).mockResolvedValue(mockDeletedCode);
            (model.restore as Mock).mockResolvedValue(1);

            const result = await service.restore(mockActor, codeId);

            expect(result.data).toBeDefined();
            expect(result.data?.count).toBe(1);
            expect(result.error).toBeUndefined();
        });
    });

    describe('search', () => {
        it('should search discount codes with filters', async () => {
            const searchParams = {
                discountType: DiscountTypeEnum.PERCENTAGE,
                page: 1,
                pageSize: 10
            };

            const mockCodes: DiscountCode[] = [
                {
                    id: '00000000-0000-4000-8000-000000000201',
                    promotionId: undefined,
                    code: 'CODE1',
                    discountType: DiscountTypeEnum.PERCENTAGE,
                    percentOff: 10,
                    amountOffMinor: undefined,
                    validFrom: new Date('2025-01-01'),
                    validTo: new Date('2025-12-31'),
                    maxRedemptionsGlobal: undefined,
                    maxRedemptionsPerUser: undefined,
                    usedCountGlobal: 0,
                    currency: 'USD',
                    minimumPurchaseAmount: null,
                    minimumPurchaseCurrency: 'USD',
                    isActive: true,
                    description: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    createdById: mockActor.id!,
                    updatedById: mockActor.id!,
                    deletedAt: null,
                    deletedById: null
                }
            ];

            (model.findAll as Mock).mockResolvedValue({
                items: mockCodes,
                total: 1
            });

            const result = await service.search(mockActor, searchParams);

            expect(result.data).toBeDefined();
            expect(result.data?.items).toHaveLength(1);
            expect(result.data?.items[0].code).toBe('CODE1');
            expect(result.error).toBeUndefined();
        });
    });

    describe('validateCode', () => {
        it('should validate an active code successfully', async () => {
            const mockCode: DiscountCode = {
                id: '00000000-0000-4000-8000-000000000201',
                promotionId: undefined,
                code: 'SUMMER25',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: 25,
                amountOffMinor: undefined,
                validFrom: new Date('2025-01-01'),
                validTo: new Date('2025-12-31'),
                maxRedemptionsGlobal: 100,
                maxRedemptionsPerUser: 5,
                usedCountGlobal: 50,
                currency: 'USD',
                minimumPurchaseAmount: 1000, // $10.00 minimum
                minimumPurchaseCurrency: 'USD',
                isActive: true,
                description: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: mockActor.id!,
                updatedById: mockActor.id!,
                deletedAt: null,
                deletedById: null
            };

            (model.findOne as Mock).mockResolvedValue(mockCode);

            const result = await service.validateCode(
                mockActor,
                'SUMMER25',
                5000, // $50.00 purchase
                '00000000-0000-4000-8000-000000000999'
            );

            expect(result.data).toBeDefined();
            expect(result.data?.isValid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should reject inactive code', async () => {
            const mockCode: DiscountCode = {
                id: '00000000-0000-4000-8000-000000000201',
                promotionId: undefined,
                code: 'INACTIVE',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: 25,
                amountOffMinor: undefined,
                validFrom: new Date('2025-01-01'),
                validTo: new Date('2025-12-31'),
                maxRedemptionsGlobal: undefined,
                maxRedemptionsPerUser: undefined,
                usedCountGlobal: 0,
                currency: 'USD',
                minimumPurchaseAmount: null,
                minimumPurchaseCurrency: 'USD',
                isActive: false, // ❌ Not active
                description: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: mockActor.id!,
                updatedById: mockActor.id!,
                deletedAt: null,
                deletedById: null
            };

            (model.findOne as Mock).mockResolvedValue(mockCode);

            const result = await service.validateCode(
                mockActor,
                'INACTIVE',
                5000,
                '00000000-0000-4000-8000-000000000999'
            );

            expect(result.data).toBeDefined();
            expect(result.data?.isValid).toBe(false);
            expect(result.data?.reason).toBe('Code is not active');
        });

        it('should reject expired code', async () => {
            const mockCode: DiscountCode = {
                id: '00000000-0000-4000-8000-000000000201',
                promotionId: undefined,
                code: 'EXPIRED',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: 25,
                amountOffMinor: undefined,
                validFrom: new Date('2024-01-01'),
                validTo: new Date('2024-12-31'), // ❌ Expired
                maxRedemptionsGlobal: undefined,
                maxRedemptionsPerUser: undefined,
                usedCountGlobal: 0,
                currency: 'USD',
                minimumPurchaseAmount: null,
                minimumPurchaseCurrency: 'USD',
                isActive: true,
                description: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: mockActor.id!,
                updatedById: mockActor.id!,
                deletedAt: null,
                deletedById: null
            };

            (model.findOne as Mock).mockResolvedValue(mockCode);

            const result = await service.validateCode(
                mockActor,
                'EXPIRED',
                5000,
                '00000000-0000-4000-8000-000000000999'
            );

            expect(result.data).toBeDefined();
            expect(result.data?.isValid).toBe(false);
            expect(result.data?.reason).toBe('Code has expired');
        });

        it('should reject code with insufficient purchase amount', async () => {
            const mockCode: DiscountCode = {
                id: '00000000-0000-4000-8000-000000000201',
                promotionId: undefined,
                code: 'MINPURCHASE',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: 25,
                amountOffMinor: undefined,
                validFrom: new Date('2025-01-01'),
                validTo: new Date('2025-12-31'),
                maxRedemptionsGlobal: undefined,
                maxRedemptionsPerUser: undefined,
                usedCountGlobal: 0,
                currency: 'USD',
                minimumPurchaseAmount: 10000, // $100.00 minimum
                minimumPurchaseCurrency: 'USD',
                isActive: true,
                description: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: mockActor.id!,
                updatedById: mockActor.id!,
                deletedAt: null,
                deletedById: null
            };

            (model.findOne as Mock).mockResolvedValue(mockCode);

            const result = await service.validateCode(
                mockActor,
                'MINPURCHASE',
                5000, // ❌ Only $50.00, needs $100.00
                '00000000-0000-4000-8000-000000000999'
            );

            expect(result.data).toBeDefined();
            expect(result.data?.isValid).toBe(false);
            expect(result.data?.reason).toContain('Minimum purchase amount');
        });

        it('should reject code that exceeded global usage limit', async () => {
            const mockCode: DiscountCode = {
                id: '00000000-0000-4000-8000-000000000201',
                promotionId: undefined,
                code: 'MAXED',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: 25,
                amountOffMinor: undefined,
                validFrom: new Date('2025-01-01'),
                validTo: new Date('2025-12-31'),
                maxRedemptionsGlobal: 100,
                maxRedemptionsPerUser: undefined,
                usedCountGlobal: 100, // ❌ Already at limit
                currency: 'USD',
                minimumPurchaseAmount: null,
                minimumPurchaseCurrency: 'USD',
                isActive: true,
                description: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: mockActor.id!,
                updatedById: mockActor.id!,
                deletedAt: null,
                deletedById: null
            };

            (model.findOne as Mock).mockResolvedValue(mockCode);

            const result = await service.validateCode(
                mockActor,
                'MAXED',
                5000,
                '00000000-0000-4000-8000-000000000999'
            );

            expect(result.data).toBeDefined();
            expect(result.data?.isValid).toBe(false);
            expect(result.data?.reason).toBe('Code has reached maximum redemptions');
        });
    });

    describe('applyDiscount', () => {
        it('should calculate percentage discount correctly', async () => {
            const mockCode: DiscountCode = {
                id: '00000000-0000-4000-8000-000000000201',
                promotionId: undefined,
                code: 'PERCENT25',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: 25,
                amountOffMinor: undefined,
                validFrom: new Date('2025-01-01'),
                validTo: new Date('2025-12-31'),
                maxRedemptionsGlobal: undefined,
                maxRedemptionsPerUser: undefined,
                usedCountGlobal: 0,
                currency: 'USD',
                minimumPurchaseAmount: null,
                minimumPurchaseCurrency: 'USD',
                isActive: true,
                description: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: mockActor.id!,
                updatedById: mockActor.id!,
                deletedAt: null,
                deletedById: null
            };

            (model.findOne as Mock).mockResolvedValue(mockCode);

            const result = await service.applyDiscount(
                mockActor,
                'PERCENT25',
                10000, // $100.00
                '00000000-0000-4000-8000-000000000999'
            );

            expect(result.data).toBeDefined();
            expect(result.data?.discountAmountMinor).toBe(2500); // 25% of 10000 = 2500 ($25.00)
            expect(result.data?.finalAmountMinor).toBe(7500); // 10000 - 2500 = 7500 ($75.00)
            expect(result.error).toBeUndefined();
        });

        it('should calculate fixed amount discount correctly', async () => {
            const mockCode: DiscountCode = {
                id: '00000000-0000-4000-8000-000000000202',
                promotionId: undefined,
                code: 'FIXED50',
                discountType: DiscountTypeEnum.FIXED_AMOUNT,
                percentOff: undefined,
                amountOffMinor: 5000, // $50.00 off
                validFrom: new Date('2025-01-01'),
                validTo: new Date('2025-12-31'),
                maxRedemptionsGlobal: undefined,
                maxRedemptionsPerUser: undefined,
                usedCountGlobal: 0,
                currency: 'USD',
                minimumPurchaseAmount: null,
                minimumPurchaseCurrency: 'USD',
                isActive: true,
                description: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: mockActor.id!,
                updatedById: mockActor.id!,
                deletedAt: null,
                deletedById: null
            };

            (model.findOne as Mock).mockResolvedValue(mockCode);

            const result = await service.applyDiscount(
                mockActor,
                'FIXED50',
                10000, // $100.00
                '00000000-0000-4000-8000-000000000999'
            );

            expect(result.data).toBeDefined();
            expect(result.data?.discountAmountMinor).toBe(5000); // Fixed $50.00
            expect(result.data?.finalAmountMinor).toBe(5000); // 10000 - 5000 = 5000 ($50.00)
            expect(result.error).toBeUndefined();
        });

        it('should not allow discount to exceed purchase amount', async () => {
            const mockCode: DiscountCode = {
                id: '00000000-0000-4000-8000-000000000202',
                promotionId: undefined,
                code: 'HUGE',
                discountType: DiscountTypeEnum.FIXED_AMOUNT,
                percentOff: undefined,
                amountOffMinor: 15000, // $150.00 off
                validFrom: new Date('2025-01-01'),
                validTo: new Date('2025-12-31'),
                maxRedemptionsGlobal: undefined,
                maxRedemptionsPerUser: undefined,
                usedCountGlobal: 0,
                currency: 'USD',
                minimumPurchaseAmount: null,
                minimumPurchaseCurrency: 'USD',
                isActive: true,
                description: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: mockActor.id!,
                updatedById: mockActor.id!,
                deletedAt: null,
                deletedById: null
            };

            (model.findOne as Mock).mockResolvedValue(mockCode);

            const result = await service.applyDiscount(
                mockActor,
                'HUGE',
                10000, // $100.00 (less than discount!)
                '00000000-0000-4000-8000-000000000999'
            );

            expect(result.data).toBeDefined();
            expect(result.data?.discountAmountMinor).toBe(10000); // Capped at purchase amount
            expect(result.data?.finalAmountMinor).toBe(0); // Free!
            expect(result.error).toBeUndefined();
        });

        it('should fail if code is invalid', async () => {
            const mockCode: DiscountCode = {
                id: '00000000-0000-4000-8000-000000000201',
                promotionId: undefined,
                code: 'INVALID',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: 25,
                amountOffMinor: undefined,
                validFrom: new Date('2025-01-01'),
                validTo: new Date('2025-12-31'),
                maxRedemptionsGlobal: undefined,
                maxRedemptionsPerUser: undefined,
                usedCountGlobal: 0,
                currency: 'USD',
                minimumPurchaseAmount: null,
                minimumPurchaseCurrency: 'USD',
                isActive: false, // ❌ Not active
                description: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: mockActor.id!,
                updatedById: mockActor.id!,
                deletedAt: null,
                deletedById: null
            };

            (model.findOne as Mock).mockResolvedValue(mockCode);

            const result = await service.applyDiscount(
                mockActor,
                'INVALID',
                10000,
                '00000000-0000-4000-8000-000000000999'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.data).toBeUndefined();
        });
    });

    describe('incrementUsage', () => {
        it('should increment usage counter successfully', async () => {
            const mockCode: DiscountCode = {
                id: '00000000-0000-4000-8000-000000000201',
                promotionId: undefined,
                code: 'TESTCODE',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: 25,
                amountOffMinor: undefined,
                validFrom: new Date('2025-01-01'),
                validTo: new Date('2025-12-31'),
                maxRedemptionsGlobal: undefined,
                maxRedemptionsPerUser: undefined,
                usedCountGlobal: 5,
                currency: 'USD',
                minimumPurchaseAmount: null,
                minimumPurchaseCurrency: 'USD',
                isActive: true,
                description: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: mockActor.id!,
                updatedById: mockActor.id!,
                deletedAt: null,
                deletedById: null
            };

            const updatedCode: DiscountCode = {
                ...mockCode,
                usedCountGlobal: 6 // Incremented
            };

            (model.findById as Mock).mockResolvedValue(mockCode);
            (model.update as Mock).mockResolvedValue(updatedCode);

            const result = await service.incrementUsage(
                mockActor,
                '00000000-0000-4000-8000-000000000201',
                '00000000-0000-4000-8000-000000000999'
            );

            expect(result.data).toBeDefined();
            expect(result.data?.usedCountGlobal).toBe(6);
            expect(result.error).toBeUndefined();
        });

        it('should fail if discount code is not found', async () => {
            (model.findById as Mock).mockResolvedValue(null);

            const result = await service.incrementUsage(
                mockActor,
                '00000000-0000-4000-8000-999999999999',
                '00000000-0000-4000-8000-000000000999'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
            expect(result.data).toBeUndefined();
        });
    });

    describe('getUsageStats', () => {
        it('should return usage statistics for a code', async () => {
            const mockCode: DiscountCode = {
                id: '00000000-0000-4000-8000-000000000201',
                promotionId: undefined,
                code: 'STATS',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: 25,
                amountOffMinor: undefined,
                validFrom: new Date('2025-01-01'),
                validTo: new Date('2025-12-31'),
                maxRedemptionsGlobal: 100,
                maxRedemptionsPerUser: 5,
                usedCountGlobal: 75,
                currency: 'USD',
                minimumPurchaseAmount: null,
                minimumPurchaseCurrency: 'USD',
                isActive: true,
                description: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: mockActor.id!,
                updatedById: mockActor.id!,
                deletedAt: null,
                deletedById: null
            };

            (model.findById as Mock).mockResolvedValue(mockCode);

            const result = await service.getUsageStats(
                mockActor,
                '00000000-0000-4000-8000-000000000201'
            );

            expect(result.data).toBeDefined();
            expect(result.data?.code).toBe('STATS');
            expect(result.data?.usedCountGlobal).toBe(75);
            expect(result.data?.maxRedemptionsGlobal).toBe(100);
            expect(result.data?.remainingRedemptions).toBe(25); // 100 - 75
            expect(result.data?.usagePercentage).toBe(75); // (75/100) * 100
            expect(result.error).toBeUndefined();
        });

        it('should fail if discount code is not found', async () => {
            (model.findById as Mock).mockResolvedValue(null);

            const result = await service.getUsageStats(
                mockActor,
                '00000000-0000-4000-8000-999999999999'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
            expect(result.data).toBeUndefined();
        });
    });
});
