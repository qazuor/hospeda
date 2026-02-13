import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { PriceCurrencyEnum } from '../../src/enums/currency.enum.js';
import { PriceCurrencyEnumSchema } from '../../src/enums/currency.schema.js';

describe('PriceCurrencyEnumSchema', () => {
    it('should accept all valid currency values', () => {
        for (const value of Object.values(PriceCurrencyEnum)) {
            expect(() => PriceCurrencyEnumSchema.parse(value)).not.toThrow();
        }
    });

    it('should have exactly 3 currency values', () => {
        expect(Object.values(PriceCurrencyEnum)).toHaveLength(3);
    });

    it('should accept ARS currency', () => {
        expect(() => PriceCurrencyEnumSchema.parse(PriceCurrencyEnum.ARS)).not.toThrow();
        expect(PriceCurrencyEnumSchema.parse('ARS')).toBe(PriceCurrencyEnum.ARS);
    });

    it('should accept USD currency', () => {
        expect(() => PriceCurrencyEnumSchema.parse(PriceCurrencyEnum.USD)).not.toThrow();
        expect(PriceCurrencyEnumSchema.parse('USD')).toBe(PriceCurrencyEnum.USD);
    });

    it('should accept BRL currency', () => {
        expect(() => PriceCurrencyEnumSchema.parse(PriceCurrencyEnum.BRL)).not.toThrow();
        expect(PriceCurrencyEnumSchema.parse('BRL')).toBe(PriceCurrencyEnum.BRL);
    });

    it('should reject invalid currency values', () => {
        const invalidCurrencies = ['EUR', 'GBP', 'JPY', '', null, undefined, 123, {}, []];

        for (const currency of invalidCurrencies) {
            expect(() => PriceCurrencyEnumSchema.parse(currency)).toThrow(ZodError);
        }
    });

    it('should provide appropriate error message for invalid values', () => {
        try {
            PriceCurrencyEnumSchema.parse('EUR');
        } catch (error) {
            expect(error).toBeInstanceOf(ZodError);
            const zodError = error as ZodError;
            expect(zodError.issues[0]?.message).toBe('zodError.enums.priceCurrency.invalid');
        }
    });

    it('should infer correct TypeScript type', () => {
        const validCurrency = PriceCurrencyEnumSchema.parse(PriceCurrencyEnum.BRL);

        const _typeCheck: PriceCurrencyEnum = validCurrency;
        expect(validCurrency).toBe(PriceCurrencyEnum.BRL);
    });
});

describe('PriceCurrencyEnum', () => {
    it('should have ARS value', () => {
        expect(PriceCurrencyEnum.ARS).toBe('ARS');
    });

    it('should have USD value', () => {
        expect(PriceCurrencyEnum.USD).toBe('USD');
    });

    it('should have BRL value', () => {
        expect(PriceCurrencyEnum.BRL).toBe('BRL');
    });

    it('should contain all expected currencies', () => {
        const currencies = Object.values(PriceCurrencyEnum);
        expect(currencies).toContain('ARS');
        expect(currencies).toContain('USD');
        expect(currencies).toContain('BRL');
    });
});
