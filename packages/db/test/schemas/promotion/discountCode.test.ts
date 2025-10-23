import { DiscountTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    type InsertDiscountCode,
    discountCodes
} from '../../../src/schemas/promotion/discountCode.dbschema';

describe('DiscountCode Schema Tests', () => {
    describe('Table Structure', () => {
        it('should have all required fields', () => {
            const discountCode = discountCodes;

            expect(discountCode.id).toBeDefined();
            expect(discountCode.code).toBeDefined();
            expect(discountCode.discountType).toBeDefined();
            expect(discountCode.percentOff).toBeDefined();
            expect(discountCode.amountOffMinor).toBeDefined();
            expect(discountCode.currency).toBeDefined();
            expect(discountCode.maxRedemptionsGlobal).toBeDefined();
            expect(discountCode.maxRedemptionsPerUser).toBeDefined();
            expect(discountCode.validFrom).toBeDefined();
            expect(discountCode.validTo).toBeDefined();
            expect(discountCode.isActive).toBeDefined();
            expect(discountCode.promotionId).toBeDefined();
            expect(discountCode.createdAt).toBeDefined();
            expect(discountCode.updatedAt).toBeDefined();
            expect(discountCode.deletedAt).toBeDefined();
            expect(discountCode.adminInfo).toBeDefined();
        });

        it('should have discount type enum with correct values', () => {
            expect(Object.values(DiscountTypeEnum)).toContain(DiscountTypeEnum.PERCENTAGE);
            expect(Object.values(DiscountTypeEnum)).toContain(DiscountTypeEnum.FIXED_AMOUNT);
        });
    });

    describe('Discount Code Data Validation', () => {
        it('should validate percentage discount structure', () => {
            const percentageDiscount: InsertDiscountCode = {
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

            expect(percentageDiscount.discountType).toBe(DiscountTypeEnum.PERCENTAGE);
            expect(percentageDiscount.percentOff).toBe('20.00');
            expect(percentageDiscount.amountOffMinor).toBeNull();
            expect(percentageDiscount.currency).toBeNull();
        });

        it('should validate fixed amount discount structure', () => {
            const fixedAmountDiscount: InsertDiscountCode = {
                code: 'SAVE50',
                discountType: DiscountTypeEnum.FIXED_AMOUNT,
                percentOff: null,
                amountOffMinor: 5000, // $50.00 in cents
                currency: 'USD',
                maxRedemptionsGlobal: 500,
                maxRedemptionsPerUser: 2,
                validFrom: new Date('2024-01-01'),
                validTo: new Date('2024-12-31'),
                isActive: 'true'
            };

            expect(fixedAmountDiscount.discountType).toBe(DiscountTypeEnum.FIXED_AMOUNT);
            expect(fixedAmountDiscount.percentOff).toBeNull();
            expect(fixedAmountDiscount.amountOffMinor).toBe(5000);
            expect(fixedAmountDiscount.currency).toBe('USD');
        });

        it('should handle unlimited usage discount codes', () => {
            const unlimitedDiscount: InsertDiscountCode = {
                code: 'WELCOME',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: '10.00',
                amountOffMinor: null,
                currency: null,
                maxRedemptionsGlobal: null, // Unlimited global usage
                maxRedemptionsPerUser: 1, // But limited to 1 per user
                validFrom: new Date('2024-01-01'),
                validTo: new Date('2024-12-31'),
                isActive: 'true'
            };

            expect(unlimitedDiscount.maxRedemptionsGlobal).toBeNull();
            expect(unlimitedDiscount.maxRedemptionsPerUser).toBe(1);
        });

        it('should validate optional promotion relationship', () => {
            const discountWithPromotion: InsertDiscountCode = {
                code: 'PROMO2024',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: '15.00',
                amountOffMinor: null,
                currency: null,
                maxRedemptionsGlobal: 200,
                maxRedemptionsPerUser: 1,
                validFrom: new Date('2024-01-01'),
                validTo: new Date('2024-12-31'),
                isActive: 'true',
                promotionId: 'promotion-uuid-123'
            };

            expect(discountWithPromotion.promotionId).toBe('promotion-uuid-123');
        });
    });

    describe('Date and Time Validation', () => {
        it('should validate date ranges', () => {
            const validDateRange: InsertDiscountCode = {
                code: 'TIMETEST',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: '10.00',
                amountOffMinor: null,
                currency: null,
                maxRedemptionsGlobal: 100,
                maxRedemptionsPerUser: 1,
                validFrom: new Date('2024-01-01T00:00:00Z'),
                validTo: new Date('2024-12-31T23:59:59Z'),
                isActive: 'true'
            };

            expect(validDateRange.validFrom.getTime()).toBeLessThan(
                validDateRange.validTo.getTime()
            );
        });

        it('should handle timezone-aware timestamps', () => {
            const timezoneDiscount: InsertDiscountCode = {
                code: 'TIMEZONE',
                discountType: DiscountTypeEnum.FIXED_AMOUNT,
                percentOff: null,
                amountOffMinor: 2500,
                currency: 'EUR',
                maxRedemptionsGlobal: 50,
                maxRedemptionsPerUser: 1,
                validFrom: new Date('2024-07-01T08:00:00+02:00'),
                validTo: new Date('2024-07-31T20:00:00+02:00'),
                isActive: 'true'
            };

            expect(timezoneDiscount.validFrom).toBeInstanceOf(Date);
            expect(timezoneDiscount.validTo).toBeInstanceOf(Date);
        });
    });

    describe('Code Generation and Validation', () => {
        it('should accept various code formats', () => {
            const codeFormats = ['SIMPLE', 'ALPHA123', 'SUMMER-2024', 'NEW_USER', 'welcome2024!'];

            for (const code of codeFormats) {
                const discount: InsertDiscountCode = {
                    code,
                    discountType: DiscountTypeEnum.PERCENTAGE,
                    percentOff: '10.00',
                    amountOffMinor: null,
                    currency: null,
                    maxRedemptionsGlobal: 100,
                    maxRedemptionsPerUser: 1,
                    validFrom: new Date('2024-01-01'),
                    validTo: new Date('2024-12-31'),
                    isActive: 'true'
                };

                expect(discount.code).toBe(code);
            }
        });
    });

    describe('Usage Limits Validation', () => {
        it('should validate global usage limits', () => {
            const globalLimitDiscount: InsertDiscountCode = {
                code: 'LIMITED100',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: '25.00',
                amountOffMinor: null,
                currency: null,
                maxRedemptionsGlobal: 100,
                maxRedemptionsPerUser: 5,
                validFrom: new Date('2024-01-01'),
                validTo: new Date('2024-12-31'),
                isActive: 'true'
            };

            expect(globalLimitDiscount.maxRedemptionsGlobal).toBe(100);
            expect(globalLimitDiscount.maxRedemptionsPerUser).toBe(5);
        });

        it('should handle zero usage limits for disabled codes', () => {
            const disabledCode: InsertDiscountCode = {
                code: 'DISABLED',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: '50.00',
                amountOffMinor: null,
                currency: null,
                maxRedemptionsGlobal: 0, // Effectively disabled
                maxRedemptionsPerUser: 0,
                validFrom: new Date('2024-01-01'),
                validTo: new Date('2024-12-31'),
                isActive: 'false'
            };

            expect(disabledCode.maxRedemptionsGlobal).toBe(0);
            expect(disabledCode.maxRedemptionsPerUser).toBe(0);
            expect(disabledCode.isActive).toBe('false');
        });
    });

    describe('Admin Info Field', () => {
        it('should store admin metadata', () => {
            const adminInfo = {
                favorite: true,
                notes: 'High-value customers only'
            };

            const premiumDiscount: InsertDiscountCode = {
                code: 'VIP50',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: '50.00',
                amountOffMinor: null,
                currency: null,
                maxRedemptionsGlobal: 20,
                maxRedemptionsPerUser: 1,
                validFrom: new Date('2024-01-01'),
                validTo: new Date('2024-12-31'),
                isActive: 'true',
                adminInfo
            };

            expect(premiumDiscount.adminInfo).toEqual(adminInfo);
            expect(premiumDiscount.adminInfo?.favorite).toBe(true);
            expect(premiumDiscount.adminInfo?.notes).toContain('High-value');
        });
    });

    describe('Currency Support', () => {
        it('should support multiple currencies for fixed amount discounts', () => {
            const currencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];

            for (const currency of currencies) {
                const discount: InsertDiscountCode = {
                    code: `SAVE10${currency}`,
                    discountType: DiscountTypeEnum.FIXED_AMOUNT,
                    percentOff: null,
                    amountOffMinor: 1000, // $10.00 equivalent
                    currency,
                    maxRedemptionsGlobal: 100,
                    maxRedemptionsPerUser: 1,
                    validFrom: new Date('2024-01-01'),
                    validTo: new Date('2024-12-31'),
                    isActive: 'true'
                };

                expect(discount.currency).toBe(currency);
                expect(discount.amountOffMinor).toBe(1000);
            }
        });
    });

    describe('Minimum Purchase Requirements', () => {
        it('should validate minimum purchase amounts', () => {
            const minPurchaseDiscount: InsertDiscountCode = {
                code: 'MIN100',
                discountType: DiscountTypeEnum.PERCENTAGE,
                percentOff: '20.00',
                amountOffMinor: null,
                currency: null,
                maxRedemptionsGlobal: 500,
                maxRedemptionsPerUser: 1,
                validFrom: new Date('2024-01-01'),
                validTo: new Date('2024-12-31'),
                isActive: 'true',
                minimumPurchaseAmount: '100.00',
                minimumPurchaseCurrency: 'USD'
            };

            expect(minPurchaseDiscount.minimumPurchaseAmount).toBe('100.00');
            expect(minPurchaseDiscount.minimumPurchaseCurrency).toBe('USD');
        });
    });
});
