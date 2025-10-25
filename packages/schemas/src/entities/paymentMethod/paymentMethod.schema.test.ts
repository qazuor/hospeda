import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { PaymentMethodEnum } from '../../enums/index.js';
import { PaymentMethodSchema } from './paymentMethod.schema.js';

describe('PaymentMethodSchema', () => {
    const validPaymentMethodData = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
        type: PaymentMethodEnum.CREDIT_CARD,
        displayName: 'My Visa Card',
        isDefault: false,
        isActive: true,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
        createdById: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
        updatedById: 'f47ac10b-58cc-4372-a567-0e02b2c3d482'
    };

    describe('Valid payment method validation', () => {
        it('should validate a complete valid payment method', () => {
            expect(() => PaymentMethodSchema.parse(validPaymentMethodData)).not.toThrow();
        });

        it('should validate payment method with minimum required fields', () => {
            const minimalPaymentMethod = {
                id: validPaymentMethodData.id,
                clientId: validPaymentMethodData.clientId,
                type: validPaymentMethodData.type,
                displayName: validPaymentMethodData.displayName,
                isDefault: validPaymentMethodData.isDefault,
                isActive: validPaymentMethodData.isActive,
                createdAt: validPaymentMethodData.createdAt,
                updatedAt: validPaymentMethodData.updatedAt,
                createdById: validPaymentMethodData.createdById,
                updatedById: validPaymentMethodData.updatedById
            };

            expect(() => PaymentMethodSchema.parse(minimalPaymentMethod)).not.toThrow();
        });
    });

    describe('Payment method type validation', () => {
        it('should validate all payment method types', () => {
            for (const type of Object.values(PaymentMethodEnum)) {
                const methodWithType = { ...validPaymentMethodData, type };
                expect(() => PaymentMethodSchema.parse(methodWithType)).not.toThrow();
            }
        });

        it('should reject invalid payment method type', () => {
            const invalidTypeMethod = { ...validPaymentMethodData, type: 'INVALID_TYPE' };
            expect(() => PaymentMethodSchema.parse(invalidTypeMethod)).toThrow(ZodError);
        });
    });

    describe('Display name validation', () => {
        it('should validate different display name formats', () => {
            const validDisplayNames = [
                'My Credit Card',
                'Visa ending in 1234',
                'Work Account',
                'Personal Debit Card',
                'Main Payment Method'
            ];

            for (const displayName of validDisplayNames) {
                const methodWithDisplayName = { ...validPaymentMethodData, displayName };
                expect(() => PaymentMethodSchema.parse(methodWithDisplayName)).not.toThrow();
            }
        });

        it('should reject empty display name', () => {
            const emptyDisplayNameMethod = { ...validPaymentMethodData, displayName: '' };
            expect(() => PaymentMethodSchema.parse(emptyDisplayNameMethod)).toThrow(ZodError);
        });

        it('should reject too long display name', () => {
            const longDisplayNameMethod = {
                ...validPaymentMethodData,
                displayName: 'A'.repeat(101)
            };
            expect(() => PaymentMethodSchema.parse(longDisplayNameMethod)).toThrow(ZodError);
        });
    });

    describe('Boolean field validation', () => {
        it('should validate isDefault as true', () => {
            const defaultMethod = { ...validPaymentMethodData, isDefault: true };
            expect(() => PaymentMethodSchema.parse(defaultMethod)).not.toThrow();
        });

        it('should validate isDefault as false', () => {
            const nonDefaultMethod = { ...validPaymentMethodData, isDefault: false };
            expect(() => PaymentMethodSchema.parse(nonDefaultMethod)).not.toThrow();
        });

        it('should validate isActive as true', () => {
            const activeMethod = { ...validPaymentMethodData, isActive: true };
            expect(() => PaymentMethodSchema.parse(activeMethod)).not.toThrow();
        });

        it('should validate isActive as false', () => {
            const inactiveMethod = { ...validPaymentMethodData, isActive: false };
            expect(() => PaymentMethodSchema.parse(inactiveMethod)).not.toThrow();
        });
    });

    describe('Optional credit card fields validation', () => {
        it('should validate with credit card specific fields', () => {
            const creditCardMethod = {
                ...validPaymentMethodData,
                type: PaymentMethodEnum.CREDIT_CARD,
                cardLast4: '1234',
                cardBrand: 'VISA',
                cardExpiryMonth: 12,
                cardExpiryYear: 2025
            };
            expect(() => PaymentMethodSchema.parse(creditCardMethod)).not.toThrow();
        });

        it('should validate card last 4 digits', () => {
            const cardWithLast4 = {
                ...validPaymentMethodData,
                cardLast4: '9876'
            };
            expect(() => PaymentMethodSchema.parse(cardWithLast4)).not.toThrow();
        });

        it('should reject invalid card last 4 digits', () => {
            const invalidLast4Method = { ...validPaymentMethodData, cardLast4: '12' };
            expect(() => PaymentMethodSchema.parse(invalidLast4Method)).toThrow(ZodError);
        });

        it('should validate card brand', () => {
            const validBrands = ['VISA', 'MASTERCARD', 'AMEX', 'DISCOVER'];
            for (const cardBrand of validBrands) {
                const methodWithBrand = { ...validPaymentMethodData, cardBrand };
                expect(() => PaymentMethodSchema.parse(methodWithBrand)).not.toThrow();
            }
        });

        it('should validate expiry dates', () => {
            const methodWithExpiry = {
                ...validPaymentMethodData,
                cardExpiryMonth: 6,
                cardExpiryYear: 2026
            };
            expect(() => PaymentMethodSchema.parse(methodWithExpiry)).not.toThrow();
        });

        it('should reject invalid expiry month', () => {
            const invalidMonthMethod = { ...validPaymentMethodData, cardExpiryMonth: 13 };
            expect(() => PaymentMethodSchema.parse(invalidMonthMethod)).toThrow(ZodError);
        });

        it('should reject invalid expiry year', () => {
            const invalidYearMethod = { ...validPaymentMethodData, cardExpiryYear: 2020 };
            expect(() => PaymentMethodSchema.parse(invalidYearMethod)).toThrow(ZodError);
        });
    });

    describe('Bank account fields validation', () => {
        it('should validate with bank account specific fields', () => {
            const bankAccountMethod = {
                ...validPaymentMethodData,
                type: PaymentMethodEnum.BANK_TRANSFER,
                bankName: 'Banco Santander',
                accountLast4: '5678',
                accountType: 'CHECKING'
            };
            expect(() => PaymentMethodSchema.parse(bankAccountMethod)).not.toThrow();
        });

        it('should validate different account types', () => {
            const validAccountTypes = ['CHECKING', 'SAVINGS'];
            for (const accountType of validAccountTypes) {
                const methodWithAccountType = { ...validPaymentMethodData, accountType };
                expect(() => PaymentMethodSchema.parse(methodWithAccountType)).not.toThrow();
            }
        });
    });

    describe('Provider fields validation', () => {
        it('should validate with provider specific fields', () => {
            const providerMethod = {
                ...validPaymentMethodData,
                providerPaymentMethodId: 'mp_pm_123456789',
                providerCustomerId: 'mp_cust_987654321'
            };
            expect(() => PaymentMethodSchema.parse(providerMethod)).not.toThrow();
        });
    });

    describe('ID validations', () => {
        it('should validate valid UUID for payment method ID', () => {
            const validUuidMethod = {
                ...validPaymentMethodData,
                id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
            };
            expect(() => PaymentMethodSchema.parse(validUuidMethod)).not.toThrow();
        });

        it('should validate valid UUID for client ID reference', () => {
            const validClientIdMethod = {
                ...validPaymentMethodData,
                clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d999'
            };
            expect(() => PaymentMethodSchema.parse(validClientIdMethod)).not.toThrow();
        });

        it('should reject invalid payment method ID', () => {
            const invalidIdMethod = { ...validPaymentMethodData, id: 'invalid-id' };
            expect(() => PaymentMethodSchema.parse(invalidIdMethod)).toThrow(ZodError);
        });

        it('should reject invalid client ID reference', () => {
            const invalidClientIdMethod = { ...validPaymentMethodData, clientId: 'invalid-id' };
            expect(() => PaymentMethodSchema.parse(invalidClientIdMethod)).toThrow(ZodError);
        });
    });

    describe('Type inference', () => {
        it('should infer correct TypeScript type', () => {
            const paymentMethod = PaymentMethodSchema.parse(validPaymentMethodData);

            // Type assertions to ensure correct inference
            expect(typeof paymentMethod.id).toBe('string');
            expect(typeof paymentMethod.clientId).toBe('string');
            expect(typeof paymentMethod.type).toBe('string');
            expect(typeof paymentMethod.displayName).toBe('string');
            expect(typeof paymentMethod.isDefault).toBe('boolean');
            expect(typeof paymentMethod.isActive).toBe('boolean');
            expect(paymentMethod.createdAt).toBeInstanceOf(Date);
            expect(paymentMethod.updatedAt).toBeInstanceOf(Date);
        });
    });
});
