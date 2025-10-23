import { describe, expect, it } from 'vitest';
import { paymentRelations, payments } from '../../../src/schemas/payment/payment.dbschema';

describe('PAYMENT Database Schema', () => {
    describe('schema compilation', () => {
        it('should import payment schema without errors', () => {
            expect(payments).toBeDefined();
            expect(typeof payments).toBe('object');
        });

        it('should import payment relations without errors', () => {
            expect(paymentRelations).toBeDefined();
            expect(typeof paymentRelations).toBe('object');
        });

        it('should have valid table structure', () => {
            // The schema should be a valid Drizzle table object
            expect(payments).toBeDefined();
            expect(typeof payments).toBe('object');
            // Basic validation that it's a proper table definition
            expect(payments).toHaveProperty('id');
        });

        it('should have expected columns for payment', () => {
            expect(payments).toHaveProperty('id');
            expect(payments).toHaveProperty('provider');
            expect(payments).toHaveProperty('status');
            expect(payments).toHaveProperty('paidAt');
            expect(payments).toHaveProperty('providerPaymentId');
            expect(payments).toHaveProperty('createdAt');
            expect(payments).toHaveProperty('updatedAt');
            expect(payments).toHaveProperty('createdById');
            expect(payments).toHaveProperty('updatedById');
            expect(payments).toHaveProperty('deletedAt');
            expect(payments).toHaveProperty('deletedById');
            expect(payments).toHaveProperty('adminInfo');
        });
    });
});
