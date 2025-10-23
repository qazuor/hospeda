import { DiscountTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import type {
    InsertDiscountCode,
    InsertDiscountCodeUsage,
    InsertPromotion
} from '../../../src/schemas/promotion';

describe('Promotion System Integration Tests', () => {
    describe('Promotion to Discount Code Relationships', () => {
        it('should validate promotion with multiple discount codes', () => {
            // Create a promotion
            const summerPromotion: InsertPromotion = {
                name: 'Summer Sale 2024',
                rules: 'Valid for accommodation bookings only. Cannot be combined with other offers.',
                startsAt: new Date('2024-06-01'),
                endsAt: new Date('2024-08-31'),
                adminInfo: {
                    favorite: true,
                    notes: 'Major summer campaign'
                }
            };

            // Create multiple discount codes for the promotion
            const percentageCode: InsertDiscountCode = {
                promotionId: 'summer-promotion-id',
                code: 'SUMMER20',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: '20.00',
                amountOffMinor: null,
                currency: null,
                maxRedemptionsGlobal: 1000,
                maxRedemptionsPerUser: 1,
                validFrom: new Date('2024-06-01'),
                validTo: new Date('2024-08-31'),
                isActive: 'true'
            };

            const fixedAmountCode: InsertDiscountCode = {
                promotionId: 'summer-promotion-id',
                code: 'SAVE50',
                discountType: DiscountTypeEnum.FIXED_AMOUNT,
                percentOff: null,
                amountOffMinor: 5000,
                currency: 'USD',
                maxRedemptionsGlobal: 500,
                maxRedemptionsPerUser: 2,
                validFrom: new Date('2024-06-01'),
                validTo: new Date('2024-08-31'),
                isActive: 'true',
                minimumPurchaseAmount: '200.00',
                minimumPurchaseCurrency: 'USD'
            };

            // Validate relationships
            expect(summerPromotion.name).toBe('Summer Sale 2024');
            expect(percentageCode.promotionId).toBe('summer-promotion-id');
            expect(fixedAmountCode.promotionId).toBe('summer-promotion-id');
            expect(percentageCode.discountType).toBe(DiscountTypeEnum.PERCENTAGE);
            expect(fixedAmountCode.discountType).toBe(DiscountTypeEnum.FIXED_AMOUNT);
        });

        it('should validate standalone discount codes without promotion', () => {
            const standaloneCode: InsertDiscountCode = {
                promotionId: null, // No promotion relationship
                code: 'WELCOME10',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: '10.00',
                amountOffMinor: null,
                currency: null,
                maxRedemptionsGlobal: null, // Unlimited
                maxRedemptionsPerUser: 1,
                validFrom: new Date('2024-01-01'),
                validTo: new Date('2024-12-31'),
                isActive: 'true',
                description: 'Welcome discount for new users'
            };

            expect(standaloneCode.promotionId).toBeNull();
            expect(standaloneCode.description).toContain('Welcome');
        });
    });

    describe('Discount Code Usage Tracking', () => {
        it('should validate usage tracking for percentage discount', () => {
            const percentageCode: InsertDiscountCode = {
                code: 'LOYALTY15',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: '15.00',
                amountOffMinor: null,
                currency: null,
                maxRedemptionsGlobal: 200,
                maxRedemptionsPerUser: 3,
                validFrom: new Date('2024-01-01'),
                validTo: new Date('2024-12-31'),
                isActive: 'true'
            };

            const usage1: InsertDiscountCodeUsage = {
                discountCodeId: 'loyalty15-code-id',
                clientId: 'client-123',
                usageCount: 1,
                firstUsedAt: new Date('2024-03-15'),
                lastUsedAt: new Date('2024-03-15')
            };

            const usage2: InsertDiscountCodeUsage = {
                discountCodeId: 'loyalty15-code-id',
                clientId: 'client-456',
                usageCount: 2,
                firstUsedAt: new Date('2024-02-10'),
                lastUsedAt: new Date('2024-04-20')
            };

            // Validate usage tracking
            if (percentageCode.maxRedemptionsPerUser) {
                expect(usage1.usageCount).toBeLessThanOrEqual(percentageCode.maxRedemptionsPerUser);
                expect(usage2.usageCount).toBeLessThanOrEqual(percentageCode.maxRedemptionsPerUser);
            }

            // Total usage should be within global limits
            const totalUsage = (usage1.usageCount ?? 0) + (usage2.usageCount ?? 0);
            if (percentageCode.maxRedemptionsGlobal) {
                expect(totalUsage).toBeLessThanOrEqual(percentageCode.maxRedemptionsGlobal);
            }
        });

        it('should validate usage tracking for fixed amount discount', () => {
            const fixedAmountCode: InsertDiscountCode = {
                code: 'VIP100',
                discountType: DiscountTypeEnum.FIXED_AMOUNT,
                percentOff: null,
                amountOffMinor: 10000, // $100.00
                currency: 'USD',
                maxRedemptionsGlobal: 50,
                maxRedemptionsPerUser: 1,
                validFrom: new Date('2024-01-01'),
                validTo: new Date('2024-12-31'),
                isActive: 'true',
                minimumPurchaseAmount: '500.00',
                minimumPurchaseCurrency: 'USD'
            };

            const vipUsage: InsertDiscountCodeUsage = {
                discountCodeId: 'vip100-code-id',
                clientId: 'vip-client-789',
                usageCount: 1,
                firstUsedAt: new Date('2024-05-10'),
                lastUsedAt: new Date('2024-05-10')
            };

            // Validate VIP usage
            expect(fixedAmountCode.amountOffMinor).toBe(10000);
            expect(fixedAmountCode.minimumPurchaseAmount).toBe('500.00');
            expect(vipUsage.usageCount).toBe(1);
            if (fixedAmountCode.maxRedemptionsPerUser) {
                expect(vipUsage.usageCount).toBeLessThanOrEqual(
                    fixedAmountCode.maxRedemptionsPerUser
                );
            }
        });
    });

    describe('Usage Limit Enforcement Scenarios', () => {
        it('should validate global usage limits', () => {
            const limitedCode: InsertDiscountCode = {
                code: 'LIMITED50',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: '25.00',
                amountOffMinor: null,
                currency: null,
                maxRedemptionsGlobal: 5, // Very limited
                maxRedemptionsPerUser: 1,
                validFrom: new Date('2024-01-01'),
                validTo: new Date('2024-12-31'),
                isActive: 'true'
            };

            // Simulate multiple users using the code
            const usages: InsertDiscountCodeUsage[] = [
                { discountCodeId: 'limited50-id', clientId: 'client-1', usageCount: 1 },
                { discountCodeId: 'limited50-id', clientId: 'client-2', usageCount: 1 },
                { discountCodeId: 'limited50-id', clientId: 'client-3', usageCount: 1 },
                { discountCodeId: 'limited50-id', clientId: 'client-4', usageCount: 1 },
                { discountCodeId: 'limited50-id', clientId: 'client-5', usageCount: 1 }
            ];

            const totalGlobalUsage = usages.reduce(
                (sum, usage) => sum + (usage.usageCount ?? 0),
                0
            );

            expect(totalGlobalUsage).toBe(5);
            if (limitedCode.maxRedemptionsGlobal) {
                expect(totalGlobalUsage).toBeLessThanOrEqual(limitedCode.maxRedemptionsGlobal);
            }

            // Each user should be within per-user limits
            for (const usage of usages) {
                if (limitedCode.maxRedemptionsPerUser && usage.usageCount) {
                    expect(usage.usageCount).toBeLessThanOrEqual(limitedCode.maxRedemptionsPerUser);
                }
            }
        });

        it('should validate per-user usage limits', () => {
            const multiUseCode: InsertDiscountCode = {
                code: 'REPEAT5',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: '10.00',
                amountOffMinor: null,
                currency: null,
                maxRedemptionsGlobal: 1000,
                maxRedemptionsPerUser: 5,
                validFrom: new Date('2024-01-01'),
                validTo: new Date('2024-12-31'),
                isActive: 'true'
            };

            const heavyUserUsage: InsertDiscountCodeUsage = {
                discountCodeId: 'repeat5-id',
                clientId: 'heavy-user-123',
                usageCount: 5, // Maximum allowed per user
                firstUsedAt: new Date('2024-01-15'),
                lastUsedAt: new Date('2024-11-20')
            };

            expect(heavyUserUsage.usageCount).toBe(multiUseCode.maxRedemptionsPerUser);
            if (multiUseCode.maxRedemptionsPerUser && heavyUserUsage.usageCount) {
                expect(heavyUserUsage.usageCount).toBeLessThanOrEqual(
                    multiUseCode.maxRedemptionsPerUser
                );
            }
        });
    });

    describe('Date Range Validation Scenarios', () => {
        it('should validate promotion and discount code date consistency', () => {
            const holidayPromotion: InsertPromotion = {
                name: 'Holiday Special',
                rules: 'Holiday booking promotion',
                startsAt: new Date('2024-12-01'),
                endsAt: new Date('2024-12-31')
            };

            const holidayCode: InsertDiscountCode = {
                promotionId: 'holiday-promotion-id',
                code: 'HOLIDAY24',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: '30.00',
                amountOffMinor: null,
                currency: null,
                maxRedemptionsGlobal: 300,
                maxRedemptionsPerUser: 1,
                validFrom: new Date('2024-12-01'), // Same as promotion
                validTo: new Date('2024-12-31'), // Same as promotion
                isActive: 'true'
            };

            // Dates should be consistent
            expect(holidayPromotion.startsAt).toEqual(holidayCode.validFrom);
            expect(holidayPromotion.endsAt).toEqual(holidayCode.validTo);

            // Usage within valid period
            const holidayUsage: InsertDiscountCodeUsage = {
                discountCodeId: 'holiday24-id',
                clientId: 'holiday-client',
                usageCount: 1,
                firstUsedAt: new Date('2024-12-15'), // Within valid range
                lastUsedAt: new Date('2024-12-15')
            };

            if (holidayUsage.firstUsedAt && holidayCode.validFrom && holidayCode.validTo) {
                expect(holidayUsage.firstUsedAt.getTime()).toBeGreaterThanOrEqual(
                    holidayCode.validFrom.getTime()
                );
                expect(holidayUsage.firstUsedAt.getTime()).toBeLessThanOrEqual(
                    holidayCode.validTo.getTime()
                );
            }
        });

        it('should validate early bird vs regular pricing scenarios', () => {
            // Conference promotion spans the entire period

            const earlyBirdCode: InsertDiscountCode = {
                promotionId: 'conference-promotion-id',
                code: 'EARLYBIRD',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: '40.00',
                amountOffMinor: null,
                currency: null,
                maxRedemptionsGlobal: 100,
                maxRedemptionsPerUser: 1,
                validFrom: new Date('2024-01-01'),
                validTo: new Date('2024-03-31'), // Early period only
                isActive: 'true'
            };

            const regularCode: InsertDiscountCode = {
                promotionId: 'conference-promotion-id',
                code: 'REGULAR20',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: '20.00',
                amountOffMinor: null,
                currency: null,
                maxRedemptionsGlobal: 500,
                maxRedemptionsPerUser: 1,
                validFrom: new Date('2024-04-01'),
                validTo: new Date('2024-10-31'), // Regular period
                isActive: 'true'
            };

            // Different discount rates for different periods
            expect(Number.parseFloat(earlyBirdCode.percentOff || '0')).toBeGreaterThan(
                Number.parseFloat(regularCode.percentOff || '0')
            );

            // Non-overlapping periods
            if (earlyBirdCode.validTo && regularCode.validFrom) {
                expect(earlyBirdCode.validTo.getTime()).toBeLessThan(
                    regularCode.validFrom.getTime()
                );
            }
        });
    });

    describe('Multi-Currency Support', () => {
        it('should validate multi-currency discount codes', () => {
            const currencies = [
                { code: 'USD', amount: 2500 },
                { code: 'EUR', amount: 2300 },
                { code: 'GBP', amount: 2000 }
            ];

            for (const curr of currencies) {
                const multiCurrencyCode: InsertDiscountCode = {
                    code: `GLOBAL25${curr.code}`,
                    discountType: DiscountTypeEnum.FIXED_AMOUNT,
                    percentOff: null,
                    amountOffMinor: curr.amount,
                    currency: curr.code,
                    maxRedemptionsGlobal: 200,
                    maxRedemptionsPerUser: 1,
                    validFrom: new Date('2024-01-01'),
                    validTo: new Date('2024-12-31'),
                    isActive: 'true',
                    minimumPurchaseAmount: '100.00',
                    minimumPurchaseCurrency: curr.code
                };

                expect(multiCurrencyCode.currency).toBe(curr.code);
                expect(multiCurrencyCode.amountOffMinor).toBe(curr.amount);
                expect(multiCurrencyCode.minimumPurchaseCurrency).toBe(curr.code);
            }
        });
    });

    describe('Admin Workflow Scenarios', () => {
        it('should validate admin-managed promotion lifecycle', () => {
            const managedPromotion: InsertPromotion = {
                name: 'Admin Managed Campaign',
                rules: 'Carefully managed promotion with tracking',
                startsAt: new Date('2024-07-01'),
                endsAt: new Date('2024-07-31'),
                adminInfo: {
                    favorite: true,
                    notes: 'High-priority campaign requiring monitoring'
                }
            };

            const managedCode: InsertDiscountCode = {
                promotionId: 'managed-promotion-id',
                code: 'MANAGED50',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: '50.00',
                amountOffMinor: null,
                currency: null,
                maxRedemptionsGlobal: 25, // Limited and monitored
                maxRedemptionsPerUser: 1,
                validFrom: new Date('2024-07-01'),
                validTo: new Date('2024-07-31'),
                isActive: 'true',
                description: 'High-value managed discount',
                adminInfo: {
                    favorite: true,
                    notes: 'Requires approval for each usage'
                }
            };

            const monitoredUsage: InsertDiscountCodeUsage = {
                discountCodeId: 'managed50-id',
                clientId: 'premium-client',
                usageCount: 1,
                firstUsedAt: new Date('2024-07-15'),
                lastUsedAt: new Date('2024-07-15'),
                createdById: 'admin-user-id' // Admin created the usage record
            };

            expect(managedPromotion.adminInfo?.favorite).toBe(true);
            expect(managedCode.adminInfo?.favorite).toBe(true);
            expect(monitoredUsage.createdById).toBe('admin-user-id');
            expect(Number.parseFloat(managedCode.percentOff || '0')).toBe(50);
        });
    });
});
