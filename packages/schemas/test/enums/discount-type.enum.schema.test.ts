import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { DiscountTypeEnumSchema } from '../../src/enums/discount-type.schema.js';
import { DiscountTypeEnum } from '../../src/enums/index.js';

describe('DiscountTypeEnumSchema', () => {
    it('should validate valid discount type values', () => {
        // Test each enum value
        // biome-ignore lint/complexity/noForEach: <explanation>
        Object.values(DiscountTypeEnum).forEach((discountType) => {
            expect(() => DiscountTypeEnumSchema.parse(discountType)).not.toThrow();
        });
    });

    it('should validate PERCENTAGE discount type', () => {
        expect(() => DiscountTypeEnumSchema.parse(DiscountTypeEnum.PERCENTAGE)).not.toThrow();
    });

    it('should validate FIXED_AMOUNT discount type', () => {
        expect(() => DiscountTypeEnumSchema.parse(DiscountTypeEnum.FIXED_AMOUNT)).not.toThrow();
    });

    it('should reject invalid discount type values', () => {
        const invalidDiscountTypes = [
            'invalid-discount-type',
            'CURRENCY', // Not in this enum
            'POINTS',
            'CREDIT',
            'VOUCHER',
            'FREE_SHIPPING',
            'BUY_ONE_GET_ONE',
            '',
            null,
            undefined,
            123,
            {},
            []
        ];

        // biome-ignore lint/complexity/noForEach: <explanation>
        invalidDiscountTypes.forEach((discountType) => {
            expect(() => DiscountTypeEnumSchema.parse(discountType)).toThrow(ZodError);
        });
    });

    it('should provide appropriate error message for invalid values', () => {
        try {
            DiscountTypeEnumSchema.parse('invalid-discount-type');
        } catch (error) {
            expect(error).toBeInstanceOf(ZodError);
            const zodError = error as ZodError;
            expect(zodError.issues[0]?.message).toBe('zodError.enums.discountType.invalid');
        }
    });

    it('should infer correct TypeScript type', () => {
        const validDiscountType = DiscountTypeEnumSchema.parse(DiscountTypeEnum.PERCENTAGE);

        // TypeScript should infer this as DiscountTypeEnum
        expect(typeof validDiscountType).toBe('string');
        expect(Object.values(DiscountTypeEnum)).toContain(validDiscountType);
    });

    it('should have all required discount types for business model', () => {
        const requiredDiscountTypes = ['percentage', 'fixed_amount'];

        const enumValues = Object.values(DiscountTypeEnum);
        expect(enumValues).toHaveLength(requiredDiscountTypes.length);

        // biome-ignore lint/complexity/noForEach: <explanation>
        requiredDiscountTypes.forEach((required) => {
            expect(enumValues).toContain(required);
        });
    });

    it('should support discount calculation logic', () => {
        // Test discount types for calculation purposes
        const percentageType = DiscountTypeEnumSchema.parse(DiscountTypeEnum.PERCENTAGE);
        const fixedAmountType = DiscountTypeEnumSchema.parse(DiscountTypeEnum.FIXED_AMOUNT);

        expect(percentageType).toBe('percentage');
        expect(fixedAmountType).toBe('fixed_amount');

        // These represent the two main discount calculation methods
        const calculationTypes = [percentageType, fixedAmountType];
        expect(calculationTypes).toHaveLength(2);

        // biome-ignore lint/complexity/noForEach: <explanation>
        calculationTypes.forEach((type) => {
            expect(typeof type).toBe('string');
            expect(type.length).toBeGreaterThan(0);
        });
    });

    it('should differentiate discount calculation methods', () => {
        // PERCENTAGE: Discount calculated as percentage of total (e.g., 10%)
        expect(DiscountTypeEnum.PERCENTAGE).toBe('percentage');

        // FIXED_AMOUNT: Discount is a fixed amount (e.g., $50 off)
        expect(DiscountTypeEnum.FIXED_AMOUNT).toBe('fixed_amount');
    });

    it('should work with promotion and discount code systems', () => {
        // Test that discount types work with business logic
        const promotionConfig = {
            type: DiscountTypeEnum.PERCENTAGE,
            value: 15 // 15%
        };

        const fixedDiscountConfig = {
            type: DiscountTypeEnum.FIXED_AMOUNT,
            value: 2500 // $25.00 in cents
        };

        expect(promotionConfig.type).toBe('percentage');
        expect(fixedDiscountConfig.type).toBe('fixed_amount');

        // Both should be validatable
        const validatedPercentage = DiscountTypeEnumSchema.parse(promotionConfig.type);
        const validatedFixed = DiscountTypeEnumSchema.parse(fixedDiscountConfig.type);

        expect(validatedPercentage).toBe('percentage');
        expect(validatedFixed).toBe('fixed_amount');
    });

    it('should support both promotional scenarios', () => {
        // Test common discount scenarios

        // Scenario 1: Percentage discount (common for sales)
        const saleDiscount = {
            type: DiscountTypeEnum.PERCENTAGE,
            description: '20% off all listings'
        };

        // Scenario 2: Fixed amount discount (common for coupons)
        const couponDiscount = {
            type: DiscountTypeEnum.FIXED_AMOUNT,
            description: '$10 off your first campaign'
        };

        expect(saleDiscount.type).toBe('percentage');
        expect(couponDiscount.type).toBe('fixed_amount');

        // Both should be valid business discount types
        expect(() => DiscountTypeEnumSchema.parse(saleDiscount.type)).not.toThrow();
        expect(() => DiscountTypeEnumSchema.parse(couponDiscount.type)).not.toThrow();
    });
});
