import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { PaymentSchema } from '../../../src/entities/payment/payment.schema.js';
import {
    createComplexPayment,
    createInvalidPayment,
    createMinimalPayment,
    createPaymentEdgeCases,
    createPaymentWithInvalidFields,
    createValidPayment
} from '../../fixtures/payment.fixtures.js';

describe('PaymentSchema', () => {
    describe('Valid Data', () => {
        it('should validate a complete valid payment', () => {
            const validData = createValidPayment();

            expect(() => PaymentSchema.parse(validData)).not.toThrow();

            const result = PaymentSchema.parse(validData);
            expect(result).toMatchObject(validData);
        });

        it('should validate minimal required payment data', () => {
            const minimalData = createMinimalPayment();

            expect(() => PaymentSchema.parse(minimalData)).not.toThrow();
        });

        it('should validate complex nested payment', () => {
            const complexData = createComplexPayment();

            expect(() => PaymentSchema.parse(complexData)).not.toThrow();

            const result = PaymentSchema.parse(complexData);
            expect(result.description).toBeDefined();
            expect(result.externalReference).toBeDefined();
            expect(result.metadata).toBeDefined();
            expect(result.mercadoPagoResponse).toBeDefined();
        });

        it('should handle edge cases correctly', () => {
            const edgeCases = createPaymentEdgeCases();

            edgeCases.forEach((edgeCase, index) => {
                expect(
                    () => PaymentSchema.parse(edgeCase),
                    `Edge case ${index} should be valid`
                ).not.toThrow();
            });
        });

        it('should validate all payment methods', () => {
            const methods = [
                'credit_card',
                'debit_card',
                'bank_transfer',
                'ticket',
                'account_money'
            ];

            for (const method of methods) {
                const paymentData = {
                    ...createMinimalPayment(),
                    paymentMethod: method
                };

                expect(
                    () => PaymentSchema.parse(paymentData),
                    `Method ${method} should be valid`
                ).not.toThrow();
            }
        });

        it('should validate all payment statuses', () => {
            const statuses = [
                'pending',
                'approved',
                'authorized',
                'in_process',
                'in_mediation',
                'rejected',
                'cancelled',
                'refunded',
                'charged_back'
            ];

            for (const status of statuses) {
                const paymentData = {
                    ...createMinimalPayment(),
                    status
                };

                expect(
                    () => PaymentSchema.parse(paymentData),
                    `Status ${status} should be valid`
                ).not.toThrow();
            }
        });

        it('should validate all payment types', () => {
            const types = ['one_time', 'subscription'];

            for (const type of types) {
                const paymentData = {
                    ...createMinimalPayment(),
                    type
                };

                expect(
                    () => PaymentSchema.parse(paymentData),
                    `Type ${type} should be valid`
                ).not.toThrow();
            }
        });

        it('should validate all supported currencies', () => {
            const currencies = ['USD', 'ARS'];

            for (const currency of currencies) {
                const paymentData = {
                    ...createMinimalPayment(),
                    currency
                };

                expect(
                    () => PaymentSchema.parse(paymentData),
                    `Currency ${currency} should be valid`
                ).not.toThrow();
            }
        });

        it('should validate optional fields when present', () => {
            const paymentWithOptionals = {
                ...createMinimalPayment(),
                description: 'Payment for accommodation booking',
                externalReference: 'ext_12345',
                paymentPlanId: '123e4567-e89b-12d3-a456-426614174000',
                metadata: {
                    gateway: 'stripe',
                    transactionId: 'txn_12345'
                }
            };

            expect(() => PaymentSchema.parse(paymentWithOptionals)).not.toThrow();

            const result = PaymentSchema.parse(paymentWithOptionals);
            expect(result.description).toBe(paymentWithOptionals.description);
            expect(result.externalReference).toBe(paymentWithOptionals.externalReference);
            expect(result.paymentPlanId).toBe(paymentWithOptionals.paymentPlanId);
            expect(result.metadata).toEqual(paymentWithOptionals.metadata);
        });
    });

    describe('Invalid Data', () => {
        it('should reject completely invalid payment data', () => {
            const invalidData = createInvalidPayment();

            expect(() => PaymentSchema.parse(invalidData)).toThrow(ZodError);
        });

        it('should reject payment with invalid fields', () => {
            const invalidFields = createPaymentWithInvalidFields();

            for (const [index, invalidField] of invalidFields.entries()) {
                expect(
                    () => PaymentSchema.parse(invalidField),
                    `Invalid field case ${index} should throw`
                ).toThrow(ZodError);
            }
        });

        it('should reject missing required fields', () => {
            const incompleteData = {
                // Missing required fields: id, amount, currency, method, status, type, userId, etc.
                description: 'Some description'
            };

            expect(() => PaymentSchema.parse(incompleteData)).toThrow(ZodError);
        });

        it('should reject invalid amount values', () => {
            const invalidAmountCases = [
                { ...createMinimalPayment(), amount: 'not-number' },
                { ...createMinimalPayment(), amount: -10.5 }, // negative
                { ...createMinimalPayment(), amount: 0 }, // zero
                { ...createMinimalPayment(), amount: null },
                { ...createMinimalPayment(), amount: undefined }
            ];

            invalidAmountCases.forEach((testCase, index) => {
                expect(
                    () => PaymentSchema.parse(testCase),
                    `Invalid amount case ${index} should throw`
                ).toThrow(ZodError);
            });
        });

        it('should reject invalid currency', () => {
            const invalidCurrency = {
                ...createMinimalPayment(),
                currency: 'INVALID_CURRENCY'
            };

            expect(() => PaymentSchema.parse(invalidCurrency)).toThrow(ZodError);
        });

        it('should reject invalid payment method', () => {
            const invalidMethod = {
                ...createMinimalPayment(),
                paymentMethod: 'BITCOIN'
            };

            expect(() => PaymentSchema.parse(invalidMethod)).toThrow(ZodError);
        });

        it('should reject invalid payment status', () => {
            const invalidStatus = {
                ...createMinimalPayment(),
                status: 'UNKNOWN'
            };

            expect(() => PaymentSchema.parse(invalidStatus)).toThrow(ZodError);
        });

        it('should reject invalid payment type', () => {
            const invalidType = {
                ...createMinimalPayment(),
                type: 'INVALID_TYPE'
            };

            expect(() => PaymentSchema.parse(invalidType)).toThrow(ZodError);
        });

        it('should reject invalid UUID fields', () => {
            const invalidUuidCases = [
                { ...createMinimalPayment(), id: 'not-uuid' },
                { ...createMinimalPayment(), userId: 'invalid-uuid' },
                { ...createMinimalPayment(), paymentPlanId: 'not-uuid' },
                { ...createMinimalPayment(), createdById: '' },
                { ...createMinimalPayment(), updatedById: 'invalid' }
            ];

            invalidUuidCases.forEach((testCase, index) => {
                expect(
                    () => PaymentSchema.parse(testCase),
                    `Invalid UUID case ${index} should throw`
                ).toThrow(ZodError);
            });
        });

        it('should reject invalid date fields', () => {
            const invalidDateCases = [
                { ...createMinimalPayment(), createdAt: 'not-date' },
                { ...createMinimalPayment(), updatedAt: 'invalid-date' },
                { ...createMinimalPayment(), createdAt: {} }
            ];

            for (const [index, testCase] of invalidDateCases.entries()) {
                expect(
                    () => PaymentSchema.parse(testCase),
                    `Invalid date case ${index} should throw`
                ).toThrow(ZodError);
            }
        });
    });

    describe('Field Validation', () => {
        it('should validate amount precision correctly', () => {
            const validAmounts = [
                0.01, // minimum
                10.5,
                100.0,
                999.99,
                10000.0
            ];

            for (const amount of validAmounts) {
                const paymentData = {
                    ...createMinimalPayment(),
                    amount
                };

                expect(
                    () => PaymentSchema.parse(paymentData),
                    `Amount ${amount} should be valid`
                ).not.toThrow();
            }
        });

        it('should validate external ID format', () => {
            const validExternalIds = [
                undefined, // optional
                'ext_123',
                'stripe_pi_1234567890',
                'mp_12345678901234567890',
                'a'.repeat(50) // reasonable length
            ];

            validExternalIds.forEach((externalId, index) => {
                const paymentData = {
                    ...createMinimalPayment(),
                    ...(externalId !== undefined && { externalId })
                };

                expect(
                    () => PaymentSchema.parse(paymentData),
                    `External ID case ${index} should be valid`
                ).not.toThrow();
            });
        });

        it('should validate description length', () => {
            const validDescriptions = [
                undefined, // optional
                'Short description',
                'A'.repeat(500) // reasonable length
            ];

            validDescriptions.forEach((description, index) => {
                const paymentData = {
                    ...createMinimalPayment(),
                    ...(description !== undefined && { description })
                };

                expect(
                    () => PaymentSchema.parse(paymentData),
                    `Description case ${index} should be valid`
                ).not.toThrow();
            });
        });

        it('should validate metadata structure', () => {
            const validMetadata = [
                undefined, // optional
                {},
                { gateway: 'stripe' },
                { transactionId: 'txn_123', customerIp: '192.168.1.1' },
                { complex: { nested: { data: 'value' } } }
            ];

            validMetadata.forEach((metadata, index) => {
                const paymentData = {
                    ...createMinimalPayment(),
                    ...(metadata !== undefined && { metadata })
                };

                expect(
                    () => PaymentSchema.parse(paymentData),
                    `Metadata case ${index} should be valid`
                ).not.toThrow();
            });
        });

        it('should validate mercadoPagoResponse structure', () => {
            const validResponses = [
                undefined, // optional
                {},
                { id: 123456, status: 'approved' },
                {
                    id: 789012,
                    status: 'pending',
                    payment_method_id: 'visa',
                    transaction_amount: 100.5
                }
            ];

            validResponses.forEach((mercadoPagoResponse, index) => {
                const paymentData = {
                    ...createMinimalPayment(),
                    ...(mercadoPagoResponse !== undefined && { mercadoPagoResponse })
                };

                expect(
                    () => PaymentSchema.parse(paymentData),
                    `MercadoPago response case ${index} should be valid`
                ).not.toThrow();
            });
        });
    });

    describe('Type Inference', () => {
        it('should infer correct types from valid data', () => {
            const validData = createValidPayment();
            const result = PaymentSchema.parse(validData);

            // Type checks
            expect(typeof result.id).toBe('string');
            expect(typeof result.amount).toBe('number');
            expect(typeof result.currency).toBe('string');
            expect(typeof result.paymentMethod).toBe('string');
            expect(typeof result.status).toBe('string');
            expect(typeof result.type).toBe('string');
            expect(typeof result.userId).toBe('string');
            expect(result.createdAt).toBeInstanceOf(Date);
            expect(result.updatedAt).toBeInstanceOf(Date);

            // Optional fields type checks
            if (result.description) {
                expect(typeof result.description).toBe('string');
            }
            if (result.externalReference) {
                expect(typeof result.externalReference).toBe('string');
            }
            if (result.paymentPlanId) {
                expect(typeof result.paymentPlanId).toBe('string');
            }
            if (result.metadata) {
                expect(typeof result.metadata).toBe('object');
            }
            if (result.mercadoPagoResponse) {
                expect(typeof result.mercadoPagoResponse).toBe('object');
            }
        });
    });
});
