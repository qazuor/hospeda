import { describe, expect, it } from 'vitest';
import { refundRelations, refunds } from '../../../src/schemas/payment/refund.dbschema';

describe('REFUND Database Schema', () => {
    describe('schema compilation', () => {
        it('should import refund schema without errors', () => {
            expect(refunds).toBeDefined();
            expect(typeof refunds).toBe('object');
        });

        it('should import refund relations without errors', () => {
            expect(refundRelations).toBeDefined();
            expect(typeof refundRelations).toBe('object');
        });

        it('should have valid table structure', () => {
            // The schema should be a valid Drizzle table object
            expect(refunds).toBeDefined();
            expect(typeof refunds).toBe('object');
            // Basic validation that it's a proper table definition
            expect(refunds).toHaveProperty('id');
        });

        it('should have expected columns for refund', () => {
            expect(refunds).toHaveProperty('id');
            expect(refunds).toHaveProperty('paymentId');
            expect(refunds).toHaveProperty('amountMinor');
            expect(refunds).toHaveProperty('reason');
            expect(refunds).toHaveProperty('refundedAt');
            expect(refunds).toHaveProperty('createdAt');
            expect(refunds).toHaveProperty('updatedAt');
            expect(refunds).toHaveProperty('createdById');
            expect(refunds).toHaveProperty('updatedById');
            expect(refunds).toHaveProperty('deletedAt');
            expect(refunds).toHaveProperty('deletedById');
            expect(refunds).toHaveProperty('adminInfo');
        });
    });
});
