import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { ProductTypeEnum } from '../../src/enums/index.js';
import { ProductTypeEnumSchema } from '../../src/enums/product-type.schema.js';

describe('ProductTypeEnumSchema', () => {
    it('should validate valid product type values', () => {
        // Test each enum value
        // biome-ignore lint/complexity/noForEach: <explanation>
        Object.values(ProductTypeEnum).forEach((productType) => {
            expect(() => ProductTypeEnumSchema.parse(productType)).not.toThrow();
        });
    });

    it('should validate SPONSORSHIP product type', () => {
        expect(() => ProductTypeEnumSchema.parse(ProductTypeEnum.SPONSORSHIP)).not.toThrow();
    });

    it('should validate CAMPAIGN product type', () => {
        expect(() => ProductTypeEnumSchema.parse(ProductTypeEnum.CAMPAIGN)).not.toThrow();
    });

    it('should validate FEATURED product type', () => {
        expect(() => ProductTypeEnumSchema.parse(ProductTypeEnum.FEATURED)).not.toThrow();
    });

    it('should validate PROF_SERVICE product type', () => {
        expect(() => ProductTypeEnumSchema.parse(ProductTypeEnum.PROF_SERVICE)).not.toThrow();
    });

    it('should validate LISTING_PLAN product type', () => {
        expect(() => ProductTypeEnumSchema.parse(ProductTypeEnum.LISTING_PLAN)).not.toThrow();
    });

    it('should validate PLACEMENT_RATE product type', () => {
        expect(() => ProductTypeEnumSchema.parse(ProductTypeEnum.PLACEMENT_RATE)).not.toThrow();
    });

    it('should reject invalid product type values', () => {
        const invalidProductTypes = [
            'invalid-product-type',
            'SUBSCRIPTION', // Not in this enum
            'UNKNOWN',
            '',
            null,
            undefined,
            123,
            {},
            []
        ];

        // biome-ignore lint/complexity/noForEach: <explanation>
        invalidProductTypes.forEach((productType) => {
            expect(() => ProductTypeEnumSchema.parse(productType)).toThrow(ZodError);
        });
    });

    it('should provide appropriate error message for invalid values', () => {
        try {
            ProductTypeEnumSchema.parse('invalid-product-type');
        } catch (error) {
            expect(error).toBeInstanceOf(ZodError);
            const zodError = error as ZodError;
            expect(zodError.issues[0]?.message).toBe('zodError.enums.productType.invalid');
        }
    });

    it('should infer correct TypeScript type', () => {
        const validProductType = ProductTypeEnumSchema.parse(ProductTypeEnum.SPONSORSHIP);

        // TypeScript should infer this as ProductTypeEnum
        expect(typeof validProductType).toBe('string');
        expect(Object.values(ProductTypeEnum)).toContain(validProductType);
    });

    it('should have all expected product types', () => {
        const expectedProductTypes = [
            'sponsorship',
            'campaign',
            'featured',
            'prof_service',
            'listing_plan',
            'placement_rate'
        ];

        const enumValues = Object.values(ProductTypeEnum);
        expect(enumValues).toHaveLength(expectedProductTypes.length);

        // biome-ignore lint/complexity/noForEach: <explanation>
        expectedProductTypes.forEach((expectedType) => {
            expect(enumValues).toContain(expectedType);
        });
    });
});
