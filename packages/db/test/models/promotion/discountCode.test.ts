import { DiscountTypeEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../../src/client';
import { DiscountCodeModel } from '../../../src/models/promotion/discountCode.model';
import type { DiscountCode } from '../../../src/schemas/promotion/discountCode.dbschema';

// Mock data
const mockDiscountCode: DiscountCode = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    promotionId: null,
    code: 'SAVE20',
    discountType: DiscountTypeEnum.PERCENTAGE,
    percentOff: '20.00',
    amountOffMinor: null,
    validFrom: new Date('2024-01-01T00:00:00Z'),
    validTo: new Date('2026-12-31T23:59:59Z'),
    maxRedemptionsGlobal: 1000,
    maxRedemptionsPerUser: 1,
    usedCountGlobal: 0,
    currency: 'USD',
    minimumPurchaseAmount: '50.00',
    minimumPurchaseCurrency: 'USD',
    isActive: 'true',
    description: 'Save 20% on your order',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    createdById: '550e8400-e29b-41d4-a716-446655440000',
    updatedById: '550e8400-e29b-41d4-a716-446655440000',
    deletedAt: null,
    deletedById: null,
    adminInfo: null
};

const _mockFixedAmountCode: DiscountCode = {
    ...mockDiscountCode,
    id: '550e8400-e29b-41d4-a716-446655440002',
    code: 'FIXED10',
    discountType: DiscountTypeEnum.FIXED_AMOUNT,
    percentOff: null,
    amountOffMinor: 1000, // $10.00 in cents
    minimumPurchaseAmount: null
};

const mockExpiredCode: DiscountCode = {
    ...mockDiscountCode,
    id: '550e8400-e29b-41d4-a716-446655440003',
    code: 'EXPIRED',
    validTo: new Date('2023-12-31T23:59:59Z')
};

const mockMaxedOutCode: DiscountCode = {
    ...mockDiscountCode,
    id: '550e8400-e29b-41d4-a716-446655440004',
    code: 'MAXEDOUT',
    maxRedemptionsGlobal: 10,
    usedCountGlobal: 10
};

vi.mock('../../../src/client', () => ({
    getDb: vi.fn()
}));

vi.mock('../../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('DiscountCodeModel', () => {
    let discountCodeModel: DiscountCodeModel;
    let getDb: ReturnType<typeof vi.fn>;
    let mockDb: any;

    beforeEach(() => {
        discountCodeModel = new DiscountCodeModel();
        getDb = dbUtils.getDb as ReturnType<typeof vi.fn>;

        // Common mock DB structure
        mockDb = {
            select: vi.fn(),
            insert: vi.fn(),
            update: vi.fn(),
            delete: vi.fn()
        };

        getDb.mockReturnValue(mockDb);
        vi.clearAllMocks();
    });

    describe('getTableName', () => {
        it('should return correct table name', () => {
            const tableName = (discountCodeModel as any).getTableName();
            expect(tableName).toBe('discount_codes');
        });
    });

    describe('isValid', () => {
        it('should return true for valid active code', async () => {
            mockDb.select.mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                id: mockDiscountCode.id,
                                isActive: 'true',
                                validFrom: mockDiscountCode.validFrom,
                                validTo: mockDiscountCode.validTo,
                                deletedAt: null
                            }
                        ])
                    })
                })
            });

            const result = await discountCodeModel.isValid('SAVE20');
            expect(result).toBe(true);
        });

        it('should return false for expired code', async () => {
            mockDb.select.mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                id: mockExpiredCode.id,
                                isActive: 'true',
                                validFrom: mockExpiredCode.validFrom,
                                validTo: mockExpiredCode.validTo,
                                deletedAt: null
                            }
                        ])
                    })
                })
            });

            const result = await discountCodeModel.isValid('EXPIRED');
            expect(result).toBe(false);
        });

        it('should return false for non-existent code', async () => {
            mockDb.select.mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([])
                    })
                })
            });

            const result = await discountCodeModel.isValid('NONEXISTENT');
            expect(result).toBe(false);
        });

        it('should return false for inactive code', async () => {
            mockDb.select.mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                id: mockDiscountCode.id,
                                isActive: 'false',
                                validFrom: mockDiscountCode.validFrom,
                                validTo: mockDiscountCode.validTo,
                                deletedAt: null
                            }
                        ])
                    })
                })
            });

            const result = await discountCodeModel.isValid('SAVE20');
            expect(result).toBe(false);
        });
    });

    describe('canBeUsed', () => {
        const clientId = 'client-123';

        it('should return canUse: true for valid code with no usage limits exceeded', async () => {
            // Mock isValid to return true
            vi.spyOn(discountCodeModel, 'isValid').mockResolvedValue(true);

            // Mock code details
            mockDb.select.mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                id: mockDiscountCode.id,
                                maxRedemptionsGlobal: 1000,
                                maxRedemptionsPerUser: 1,
                                usedCountGlobal: 0
                            }
                        ])
                    })
                })
            });

            // Mock user usage query
            mockDb.select.mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([{ usageCount: null }])
                })
            });

            const result = await discountCodeModel.canBeUsed('SAVE20', clientId);
            expect(result.canUse).toBe(true);
        });

        it('should return canUse: false when global limit exceeded', async () => {
            vi.spyOn(discountCodeModel, 'isValid').mockResolvedValue(true);

            mockDb.select.mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                id: mockMaxedOutCode.id,
                                maxRedemptionsGlobal: 10,
                                maxRedemptionsPerUser: 1,
                                usedCountGlobal: 10
                            }
                        ])
                    })
                })
            });

            const result = await discountCodeModel.canBeUsed('MAXEDOUT', clientId);
            expect(result.canUse).toBe(false);
            expect(result.reason).toBe('GLOBAL_LIMIT_EXCEEDED');
        });

        it('should return canUse: false when user limit exceeded', async () => {
            vi.spyOn(discountCodeModel, 'isValid').mockResolvedValue(true);

            // Mock code details
            mockDb.select.mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                id: mockDiscountCode.id,
                                maxRedemptionsGlobal: 1000,
                                maxRedemptionsPerUser: 1,
                                usedCountGlobal: 0
                            }
                        ])
                    })
                })
            });

            // Mock user usage query - user already used it once
            mockDb.select.mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([{ usageCount: '1' }])
                })
            });

            const result = await discountCodeModel.canBeUsed('SAVE20', clientId);
            expect(result.canUse).toBe(false);
            expect(result.reason).toBe('USER_LIMIT_EXCEEDED');
        });
    });

    describe('calculateDiscount', () => {
        it('should calculate percentage discount correctly', async () => {
            mockDb.select.mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                discountType: DiscountTypeEnum.PERCENTAGE,
                                percentOff: '20.00',
                                amountOffMinor: null,
                                currency: 'USD',
                                minimumPurchaseAmount: '50.00',
                                minimumPurchaseCurrency: 'USD'
                            }
                        ])
                    })
                })
            });

            const result = await discountCodeModel.calculateDiscount('SAVE20', 100);
            expect(result).toEqual({
                discountAmount: 20,
                finalAmount: 80
            });
        });

        it('should calculate fixed amount discount correctly', async () => {
            mockDb.select.mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                discountType: DiscountTypeEnum.FIXED_AMOUNT,
                                percentOff: null,
                                amountOffMinor: 1000, // $10.00
                                currency: 'USD',
                                minimumPurchaseAmount: null,
                                minimumPurchaseCurrency: 'USD'
                            }
                        ])
                    })
                })
            });

            const result = await discountCodeModel.calculateDiscount('FIXED10', 100);
            expect(result).toEqual({
                discountAmount: 10,
                finalAmount: 90
            });
        });

        it('should respect minimum purchase amount', async () => {
            mockDb.select.mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                discountType: DiscountTypeEnum.PERCENTAGE,
                                percentOff: '20.00',
                                amountOffMinor: null,
                                currency: 'USD',
                                minimumPurchaseAmount: '50.00',
                                minimumPurchaseCurrency: 'USD'
                            }
                        ])
                    })
                })
            });

            // Purchase amount below minimum
            const result = await discountCodeModel.calculateDiscount('SAVE20', 30);
            expect(result).toEqual({
                discountAmount: 0,
                finalAmount: 30
            });
        });

        it('should not allow discount to exceed purchase amount', async () => {
            mockDb.select.mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                discountType: DiscountTypeEnum.FIXED_AMOUNT,
                                percentOff: null,
                                amountOffMinor: 15000, // $150.00
                                currency: 'USD',
                                minimumPurchaseAmount: null,
                                minimumPurchaseCurrency: 'USD'
                            }
                        ])
                    })
                })
            });

            const result = await discountCodeModel.calculateDiscount('HUGE10', 100);
            expect(result).toEqual({
                discountAmount: 100, // Capped at purchase amount
                finalAmount: 0
            });
        });
    });

    describe('incrementUsage', () => {
        const clientId = 'client-123';

        it('should create new usage record for first use', async () => {
            // Mock get discount code ID
            mockDb.select.mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([{ id: mockDiscountCode.id }])
                    })
                })
            });

            // Mock existing usage query - no existing usage
            mockDb.select.mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([])
                    })
                })
            });

            // Mock insert and update
            mockDb.insert.mockReturnValue({
                values: vi.fn().mockResolvedValue(undefined)
            });
            mockDb.update.mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue(undefined)
                })
            });

            const result = await discountCodeModel.incrementUsage('SAVE20', clientId);
            expect(result).toBe(true);
            expect(mockDb.insert).toHaveBeenCalled();
            expect(mockDb.update).toHaveBeenCalled();
        });

        it('should update existing usage record', async () => {
            // Mock get discount code ID
            mockDb.select.mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([{ id: mockDiscountCode.id }])
                    })
                })
            });

            // Mock existing usage query - existing usage found
            mockDb.select.mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                id: 'usage-id',
                                usageCount: 1
                            }
                        ])
                    })
                })
            });

            // Mock update methods
            mockDb.update.mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue(undefined)
                })
            });

            const result = await discountCodeModel.incrementUsage('SAVE20', clientId);
            expect(result).toBe(true);
            expect(mockDb.update).toHaveBeenCalledTimes(2); // Once for usage record, once for global counter
        });
    });

    describe('checkExpiration', () => {
        it('should return false for non-expired code', async () => {
            mockDb.select.mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                validTo: new Date(Date.now() + 86400000) // Tomorrow
                            }
                        ])
                    })
                })
            });

            const result = await discountCodeModel.checkExpiration('SAVE20');
            expect(result).toBe(false);
        });

        it('should return true for expired code', async () => {
            mockDb.select.mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                validTo: new Date(Date.now() - 86400000) // Yesterday
                            }
                        ])
                    })
                })
            });

            const result = await discountCodeModel.checkExpiration('EXPIRED');
            expect(result).toBe(true);
        });

        it('should return true for non-existent code', async () => {
            mockDb.select.mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([])
                    })
                })
            });

            const result = await discountCodeModel.checkExpiration('NONEXISTENT');
            expect(result).toBe(true);
        });
    });

    describe('checkEligibility', () => {
        const clientId = 'client-123';

        it('should return eligible: true for valid eligible code', async () => {
            vi.spyOn(discountCodeModel, 'isValid').mockResolvedValue(true);
            vi.spyOn(discountCodeModel, 'canBeUsed').mockResolvedValue({ canUse: true });
            vi.spyOn(discountCodeModel, 'checkExpiration').mockResolvedValue(false);
            vi.spyOn(discountCodeModel, 'calculateDiscount').mockResolvedValue({
                discountAmount: 20,
                finalAmount: 80
            });

            const result = await discountCodeModel.checkEligibility('SAVE20', clientId, 100);
            expect(result.eligible).toBe(true);
            expect(result.discountPreview).toEqual({
                discountAmount: 20,
                finalAmount: 80
            });
        });

        it('should return eligible: false for invalid code', async () => {
            vi.spyOn(discountCodeModel, 'isValid').mockResolvedValue(false);

            const result = await discountCodeModel.checkEligibility('INVALID', clientId, 100);
            expect(result.eligible).toBe(false);
            expect(result.reason).toBe('INVALID_CODE');
        });

        it('should return eligible: false for expired code', async () => {
            vi.spyOn(discountCodeModel, 'isValid').mockResolvedValue(true);
            vi.spyOn(discountCodeModel, 'canBeUsed').mockResolvedValue({ canUse: true });
            vi.spyOn(discountCodeModel, 'checkExpiration').mockResolvedValue(true);

            const result = await discountCodeModel.checkEligibility('EXPIRED', clientId, 100);
            expect(result.eligible).toBe(false);
            expect(result.reason).toBe('EXPIRED');
        });
    });

    describe('getRemainingUses', () => {
        it('should return unlimited for codes with no global limit', async () => {
            mockDb.select.mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                maxRedemptionsGlobal: null,
                                usedCountGlobal: 5
                            }
                        ])
                    })
                })
            });

            const result = await discountCodeModel.getRemainingUses('UNLIMITED');
            expect(result).toEqual({
                globalRemaining: null,
                unlimited: true
            });
        });

        it('should calculate remaining uses correctly', async () => {
            mockDb.select.mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                maxRedemptionsGlobal: 100,
                                usedCountGlobal: 75
                            }
                        ])
                    })
                })
            });

            const result = await discountCodeModel.getRemainingUses('SAVE20');
            expect(result).toEqual({
                globalRemaining: 25,
                unlimited: false
            });
        });
    });

    describe('hasBeenUsedByClient', () => {
        const clientId = 'client-123';

        it('should return true if client has used the code', async () => {
            // Mock get discount code ID
            mockDb.select.mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([{ id: mockDiscountCode.id }])
                    })
                })
            });

            // Mock usage query - usage found
            mockDb.select.mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([{ id: 'usage-id' }])
                    })
                })
            });

            const result = await discountCodeModel.hasBeenUsedByClient('SAVE20', clientId);
            expect(result).toBe(true);
        });

        it('should return false if client has not used the code', async () => {
            // Mock get discount code ID
            mockDb.select.mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([{ id: mockDiscountCode.id }])
                    })
                })
            });

            // Mock usage query - no usage found
            mockDb.select.mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([])
                    })
                })
            });

            const result = await discountCodeModel.hasBeenUsedByClient('SAVE20', clientId);
            expect(result).toBe(false);
        });
    });
});
