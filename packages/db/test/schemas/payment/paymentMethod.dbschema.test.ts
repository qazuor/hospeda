import { describe, expect, it } from 'vitest';
import {
    paymentMethodRelations,
    paymentMethods
} from '../../../src/schemas/payment/paymentMethod.dbschema';

describe('PAYMENT_METHOD Database Schema', () => {
    describe('schema compilation', () => {
        it('should import paymentMethod schema without errors', () => {
            expect(paymentMethods).toBeDefined();
            expect(typeof paymentMethods).toBe('object');
        });

        it('should import paymentMethod relations without errors', () => {
            expect(paymentMethodRelations).toBeDefined();
            expect(typeof paymentMethodRelations).toBe('object');
        });

        it('should have valid table structure', () => {
            // The schema should be a valid Drizzle table object
            expect(paymentMethods).toBeDefined();
            expect(typeof paymentMethods).toBe('object');
            // Basic validation that it's a proper table definition
            expect(paymentMethods).toHaveProperty('id');
        });

        it('should have expected columns for payment method', () => {
            // Core fields
            expect(paymentMethods).toHaveProperty('id');
            expect(paymentMethods).toHaveProperty('clientId');
            expect(paymentMethods).toHaveProperty('type');
            expect(paymentMethods).toHaveProperty('displayName');
            expect(paymentMethods).toHaveProperty('isDefault');
            expect(paymentMethods).toHaveProperty('isActive');

            // Card fields
            expect(paymentMethods).toHaveProperty('cardLast4');
            expect(paymentMethods).toHaveProperty('cardBrand');
            expect(paymentMethods).toHaveProperty('cardExpiryMonth');
            expect(paymentMethods).toHaveProperty('cardExpiryYear');

            // Bank fields
            expect(paymentMethods).toHaveProperty('bankName');
            expect(paymentMethods).toHaveProperty('accountLast4');
            expect(paymentMethods).toHaveProperty('accountType');

            // Provider fields
            expect(paymentMethods).toHaveProperty('providerPaymentMethodId');
            expect(paymentMethods).toHaveProperty('providerCustomerId');
            expect(paymentMethods).toHaveProperty('metadata');

            // Audit fields
            expect(paymentMethods).toHaveProperty('createdAt');
            expect(paymentMethods).toHaveProperty('updatedAt');
            expect(paymentMethods).toHaveProperty('createdById');
            expect(paymentMethods).toHaveProperty('updatedById');
            expect(paymentMethods).toHaveProperty('deletedAt');
            expect(paymentMethods).toHaveProperty('deletedById');
            expect(paymentMethods).toHaveProperty('adminInfo');
        });
    });
});
