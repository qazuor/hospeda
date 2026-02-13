import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { ExchangeRateSourceEnum } from '../../src/enums/exchange-rate-source.enum.js';
import { ExchangeRateSourceEnumSchema } from '../../src/enums/exchange-rate-source.schema.js';

describe('ExchangeRateSourceEnumSchema', () => {
    it('should accept all valid exchange rate sources', () => {
        for (const value of Object.values(ExchangeRateSourceEnum)) {
            expect(() => ExchangeRateSourceEnumSchema.parse(value)).not.toThrow();
        }
    });

    it('should have exactly 3 sources', () => {
        expect(Object.values(ExchangeRateSourceEnum)).toHaveLength(3);
    });

    it('should reject invalid values', () => {
        const invalidValues = ['dolar-api', 'google', 'invalid', '', null, undefined];
        for (const value of invalidValues) {
            expect(() => ExchangeRateSourceEnumSchema.parse(value)).toThrow(ZodError);
        }
    });

    it('should provide appropriate error message for invalid values', () => {
        try {
            ExchangeRateSourceEnumSchema.parse('invalid');
        } catch (error) {
            expect(error).toBeInstanceOf(ZodError);
            const zodError = error as ZodError;
            expect(zodError.issues[0]?.message).toBe('zodError.enums.exchangeRateSource.invalid');
        }
    });

    it('should handle case sensitivity correctly', () => {
        expect(() => ExchangeRateSourceEnumSchema.parse('DOLARAPI')).toThrow(ZodError);
        expect(() => ExchangeRateSourceEnumSchema.parse('Manual')).toThrow(ZodError);
        expect(() => ExchangeRateSourceEnumSchema.parse('manual')).not.toThrow();
    });
});
