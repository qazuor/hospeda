import { describe, expect, it } from 'vitest';
import { PriceCurrencyEnum } from '../currency.enum.js';
import { PriceCurrencyEnumSchema } from '../currency.schema.js';
import { ExchangeRateSourceEnum } from '../exchange-rate-source.enum.js';
import { ExchangeRateSourceEnumSchema } from '../exchange-rate-source.schema.js';
import { ExchangeRateTypeEnum } from '../exchange-rate-type.enum.js';
import { ExchangeRateTypeEnumSchema } from '../exchange-rate-type.schema.js';
import { PermissionEnum } from '../permission.enum.js';

// ============================================================================
// PriceCurrencyEnum
// ============================================================================

describe('PriceCurrencyEnum', () => {
    it('should have exactly 3 currency values', () => {
        const values = Object.values(PriceCurrencyEnum);
        expect(values).toHaveLength(3);
    });

    it('should include ARS, USD, and BRL', () => {
        expect(PriceCurrencyEnum.ARS).toBe('ARS');
        expect(PriceCurrencyEnum.USD).toBe('USD');
        expect(PriceCurrencyEnum.BRL).toBe('BRL');
    });

    describe('PriceCurrencyEnumSchema', () => {
        it('should accept valid currency values', () => {
            for (const value of Object.values(PriceCurrencyEnum)) {
                const result = PriceCurrencyEnumSchema.safeParse(value);
                expect(result.success).toBe(true);
            }
        });

        it('should reject invalid currency values', () => {
            const result = PriceCurrencyEnumSchema.safeParse('EUR');
            expect(result.success).toBe(false);
        });

        it('should return correct error message for invalid value', () => {
            const result = PriceCurrencyEnumSchema.safeParse('INVALID');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0]?.message).toBe(
                    'zodError.enums.priceCurrency.invalid'
                );
            }
        });
    });
});

// ============================================================================
// ExchangeRateTypeEnum
// ============================================================================

describe('ExchangeRateTypeEnum', () => {
    it('should have exactly 6 rate type values', () => {
        const values = Object.values(ExchangeRateTypeEnum);
        expect(values).toHaveLength(6);
    });

    it('should include all expected rate types', () => {
        expect(ExchangeRateTypeEnum.OFICIAL).toBe('oficial');
        expect(ExchangeRateTypeEnum.BLUE).toBe('blue');
        expect(ExchangeRateTypeEnum.MEP).toBe('mep');
        expect(ExchangeRateTypeEnum.CCL).toBe('ccl');
        expect(ExchangeRateTypeEnum.TARJETA).toBe('tarjeta');
        expect(ExchangeRateTypeEnum.STANDARD).toBe('standard');
    });

    describe('ExchangeRateTypeEnumSchema', () => {
        it('should accept valid rate type values', () => {
            for (const value of Object.values(ExchangeRateTypeEnum)) {
                const result = ExchangeRateTypeEnumSchema.safeParse(value);
                expect(result.success).toBe(true);
            }
        });

        it('should reject invalid rate type values', () => {
            const result = ExchangeRateTypeEnumSchema.safeParse('crypto');
            expect(result.success).toBe(false);
        });

        it('should return correct error message for invalid value', () => {
            const result = ExchangeRateTypeEnumSchema.safeParse('INVALID');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0]?.message).toBe(
                    'zodError.enums.exchangeRateType.invalid'
                );
            }
        });
    });
});

// ============================================================================
// ExchangeRateSourceEnum
// ============================================================================

describe('ExchangeRateSourceEnum', () => {
    it('should have exactly 3 source values', () => {
        const values = Object.values(ExchangeRateSourceEnum);
        expect(values).toHaveLength(3);
    });

    it('should include all expected sources', () => {
        expect(ExchangeRateSourceEnum.DOLARAPI).toBe('dolarapi');
        expect(ExchangeRateSourceEnum.EXCHANGERATE_API).toBe('exchangerate-api');
        expect(ExchangeRateSourceEnum.MANUAL).toBe('manual');
    });

    describe('ExchangeRateSourceEnumSchema', () => {
        it('should accept valid source values', () => {
            for (const value of Object.values(ExchangeRateSourceEnum)) {
                const result = ExchangeRateSourceEnumSchema.safeParse(value);
                expect(result.success).toBe(true);
            }
        });

        it('should reject invalid source values', () => {
            const result = ExchangeRateSourceEnumSchema.safeParse('yahoo');
            expect(result.success).toBe(false);
        });

        it('should return correct error message for invalid value', () => {
            const result = ExchangeRateSourceEnumSchema.safeParse('INVALID');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0]?.message).toBe(
                    'zodError.enums.exchangeRateSource.invalid'
                );
            }
        });
    });
});

// ============================================================================
// Exchange Rate Permissions in PermissionEnum
// ============================================================================

describe('PermissionEnum - Exchange Rate Permissions', () => {
    it('should include all 6 exchange rate permissions', () => {
        expect(PermissionEnum.EXCHANGE_RATE_VIEW).toBe('exchange_rate.view');
        expect(PermissionEnum.EXCHANGE_RATE_CREATE).toBe('exchange_rate.create');
        expect(PermissionEnum.EXCHANGE_RATE_UPDATE).toBe('exchange_rate.update');
        expect(PermissionEnum.EXCHANGE_RATE_DELETE).toBe('exchange_rate.delete');
        expect(PermissionEnum.EXCHANGE_RATE_CONFIG_UPDATE).toBe('exchange_rate.config.update');
        expect(PermissionEnum.EXCHANGE_RATE_FETCH).toBe('exchange_rate.fetch');
    });

    it('should have exchange rate permissions that follow naming convention', () => {
        const exchangeRatePermissions = Object.entries(PermissionEnum).filter(([key]) =>
            key.startsWith('EXCHANGE_RATE_')
        );

        expect(exchangeRatePermissions).toHaveLength(6);

        for (const [, value] of exchangeRatePermissions) {
            expect(value).toMatch(/^exchange_rate\./);
        }
    });
});
