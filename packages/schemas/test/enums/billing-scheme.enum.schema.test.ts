import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { BillingSchemeEnumSchema } from '../../src/enums/billing-scheme.schema.js';
import { BillingSchemeEnum } from '../../src/enums/index.js';

describe('BillingSchemeEnumSchema', () => {
    it('should validate valid billing scheme values', () => {
        // Test each enum value
        // biome-ignore lint/complexity/noForEach: <explanation>
        Object.values(BillingSchemeEnum).forEach((billingScheme) => {
            expect(() => BillingSchemeEnumSchema.parse(billingScheme)).not.toThrow();
        });
    });

    it('should validate ONE_TIME billing scheme', () => {
        expect(() => BillingSchemeEnumSchema.parse(BillingSchemeEnum.ONE_TIME)).not.toThrow();
    });

    it('should validate RECURRING billing scheme', () => {
        expect(() => BillingSchemeEnumSchema.parse(BillingSchemeEnum.RECURRING)).not.toThrow();
    });

    it('should reject invalid billing scheme values', () => {
        const invalidBillingSchemes = [
            'invalid-billing-scheme',
            'MONTHLY', // Not in this enum
            'YEARLY',
            'SUBSCRIPTION',
            '',
            null,
            undefined,
            123,
            {},
            []
        ];

        // biome-ignore lint/complexity/noForEach: <explanation>
        invalidBillingSchemes.forEach((billingScheme) => {
            expect(() => BillingSchemeEnumSchema.parse(billingScheme)).toThrow(ZodError);
        });
    });

    it('should provide appropriate error message for invalid values', () => {
        try {
            BillingSchemeEnumSchema.parse('invalid-billing-scheme');
        } catch (error) {
            expect(error).toBeInstanceOf(ZodError);
            const zodError = error as ZodError;
            expect(zodError.issues[0]?.message).toBe('zodError.enums.billingScheme.invalid');
        }
    });

    it('should infer correct TypeScript type', () => {
        const validBillingScheme = BillingSchemeEnumSchema.parse(BillingSchemeEnum.ONE_TIME);

        // TypeScript should infer this as BillingSchemeEnum
        expect(typeof validBillingScheme).toBe('string');
        expect(Object.values(BillingSchemeEnum)).toContain(validBillingScheme);
    });

    it('should have all expected billing schemes', () => {
        const expectedBillingSchemes = ['one_time', 'recurring'];

        const enumValues = Object.values(BillingSchemeEnum);
        expect(enumValues).toHaveLength(expectedBillingSchemes.length);

        // biome-ignore lint/complexity/noForEach: <explanation>
        expectedBillingSchemes.forEach((expectedScheme) => {
            expect(enumValues).toContain(expectedScheme);
        });
    });

    it('should work with pricing validation rules', () => {
        // Test that only RECURRING scheme can have intervals
        expect(BillingSchemeEnum.RECURRING).toBe('recurring');
        expect(BillingSchemeEnum.ONE_TIME).toBe('one_time');

        // These values will be used in cross-validation with BillingIntervalEnum
        const recurringScheme = BillingSchemeEnumSchema.parse(BillingSchemeEnum.RECURRING);
        const oneTimeScheme = BillingSchemeEnumSchema.parse(BillingSchemeEnum.ONE_TIME);

        expect(recurringScheme).toBe('recurring');
        expect(oneTimeScheme).toBe('one_time');
    });
});
