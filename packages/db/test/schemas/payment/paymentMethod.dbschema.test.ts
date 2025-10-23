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
            expect(paymentMethods).toHaveProperty('id');
            expect(paymentMethods).toHaveProperty('clientId');
            expect(paymentMethods).toHaveProperty('provider');
            expect(paymentMethods).toHaveProperty('token');
            expect(paymentMethods).toHaveProperty('brand');
            expect(paymentMethods).toHaveProperty('last4');
            expect(paymentMethods).toHaveProperty('expiresAt');
            expect(paymentMethods).toHaveProperty('defaultMethod');
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
