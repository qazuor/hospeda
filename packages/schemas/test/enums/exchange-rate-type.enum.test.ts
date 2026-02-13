import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { ExchangeRateTypeEnum } from '../../src/enums/exchange-rate-type.enum.js';
import { ExchangeRateTypeEnumSchema } from '../../src/enums/exchange-rate-type.schema.js';

describe('ExchangeRateTypeEnumSchema', () => {
    it('should accept all valid exchange rate types', () => {
        for (const value of Object.values(ExchangeRateTypeEnum)) {
            expect(() => ExchangeRateTypeEnumSchema.parse(value)).not.toThrow();
        }
    });

    it('should have exactly 6 rate types', () => {
        expect(Object.values(ExchangeRateTypeEnum)).toHaveLength(6);
    });

    it('should reject invalid values', () => {
        const invalidValues = ['OFFICIAL', 'black', 'invalid', '', null, undefined];
        for (const value of invalidValues) {
            expect(() => ExchangeRateTypeEnumSchema.parse(value)).toThrow(ZodError);
        }
    });

    it('should provide appropriate error message for invalid values', () => {
        try {
            ExchangeRateTypeEnumSchema.parse('invalid');
        } catch (error) {
            expect(error).toBeInstanceOf(ZodError);
            const zodError = error as ZodError;
            expect(zodError.issues[0]?.message).toBe('zodError.enums.exchangeRateType.invalid');
        }
    });

    it('should handle case sensitivity correctly', () => {
        expect(() => ExchangeRateTypeEnumSchema.parse('OFICIAL')).toThrow(ZodError);
        expect(() => ExchangeRateTypeEnumSchema.parse('Oficial')).toThrow(ZodError);
        expect(() => ExchangeRateTypeEnumSchema.parse('oficial')).not.toThrow();
    });
});
