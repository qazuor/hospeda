import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { PaymentProviderEnum } from '../../src/enums/index.js';
import { PaymentProviderEnumSchema } from '../../src/enums/payment-provider.schema.js';

describe('PaymentProviderEnumSchema', () => {
    it('should validate valid payment provider values', () => {
        // Test each enum value
        // biome-ignore lint/complexity/noForEach: <explanation>
        Object.values(PaymentProviderEnum).forEach((provider) => {
            expect(() => PaymentProviderEnumSchema.parse(provider)).not.toThrow();
        });
    });

    it('should validate MERCADO_PAGO payment provider', () => {
        expect(() =>
            PaymentProviderEnumSchema.parse(PaymentProviderEnum.MERCADO_PAGO)
        ).not.toThrow();
    });

    it('should reject invalid payment provider values', () => {
        const invalidProviders = [
            'invalid-provider',
            'STRIPE', // Not yet supported
            'PAYPAL',
            'SQUARE',
            'RAPIPAGO',
            'PAGO_FACIL',
            '',
            null,
            undefined,
            123,
            {},
            []
        ];

        // biome-ignore lint/complexity/noForEach: <explanation>
        invalidProviders.forEach((provider) => {
            expect(() => PaymentProviderEnumSchema.parse(provider)).toThrow(ZodError);
        });
    });

    it('should provide appropriate error message for invalid values', () => {
        try {
            PaymentProviderEnumSchema.parse('invalid-provider');
        } catch (error) {
            expect(error).toBeInstanceOf(ZodError);
            const zodError = error as ZodError;
            expect(zodError.issues[0]?.message).toBe('zodError.enums.paymentProvider.invalid');
        }
    });

    it('should infer correct TypeScript type', () => {
        const validProvider = PaymentProviderEnumSchema.parse(PaymentProviderEnum.MERCADO_PAGO);

        // TypeScript should infer this as PaymentProviderEnum
        expect(typeof validProvider).toBe('string');
        expect(Object.values(PaymentProviderEnum)).toContain(validProvider);
    });

    it('should have all required payment providers for business model', () => {
        const requiredProviders = ['mercado_pago'];

        const enumValues = Object.values(PaymentProviderEnum);
        expect(enumValues).toHaveLength(requiredProviders.length);

        // biome-ignore lint/complexity/noForEach: <explanation>
        requiredProviders.forEach((required) => {
            expect(enumValues).toContain(required);
        });
    });

    it('should support extensibility for future providers', () => {
        // Test that the current provider works
        const mercadoPago = PaymentProviderEnumSchema.parse(PaymentProviderEnum.MERCADO_PAGO);
        expect(mercadoPago).toBe('mercado_pago');

        // The enum should be designed to easily add new providers
        expect(Object.values(PaymentProviderEnum)).toContain('mercado_pago');
    });

    it('should work with payment integration', () => {
        // Test that provider enum supports payment processing
        const provider = PaymentProviderEnum.MERCADO_PAGO;
        expect(provider).toBe('mercado_pago');

        // Provider should be usable for payment method configuration
        const paymentConfig = {
            provider: PaymentProviderEnumSchema.parse(provider),
            enabled: true
        };

        expect(paymentConfig.provider).toBe('mercado_pago');
        expect(paymentConfig.enabled).toBe(true);
    });
});
