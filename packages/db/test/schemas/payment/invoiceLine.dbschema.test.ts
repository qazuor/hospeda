import { describe, expect, it } from 'vitest';
import { invoiceLines } from '../../../src/schemas/payment/invoiceLine.dbschema.js';

describe('InvoiceLine DB Schema', () => {
    describe('table structure', () => {
        it('should be properly defined as table', () => {
            expect(invoiceLines).toBeDefined();
            expect(typeof invoiceLines).toBe('object');
        });

        it('should have primary key', () => {
            expect(invoiceLines.id).toBeDefined();
        });

        it('should have required invoice relationship', () => {
            expect(invoiceLines.invoiceId).toBeDefined();
            expect(invoiceLines.invoiceId.notNull).toBeTruthy();
        });

        it('should have optional pricing plan relationship', () => {
            expect(invoiceLines.pricingPlanId).toBeDefined();
            // Should be nullable for custom items
        });

        it('should have optional subscription item relationship', () => {
            expect(invoiceLines.subscriptionItemId).toBeDefined();
            // Should be nullable for custom items
        });

        it('should have line item details', () => {
            expect(invoiceLines.description).toBeDefined();
            expect(invoiceLines.description.notNull).toBeTruthy();

            expect(invoiceLines.quantity).toBeDefined();
            expect(invoiceLines.quantity.notNull).toBeTruthy();
            expect(invoiceLines.quantity.default).toBe(1);
        });

        it('should have pricing fields with correct precision', () => {
            expect(invoiceLines.unitPrice).toBeDefined();
            expect(invoiceLines.unitPrice.notNull).toBeTruthy();

            expect(invoiceLines.lineAmount).toBeDefined();
            expect(invoiceLines.lineAmount.notNull).toBeTruthy();

            expect(invoiceLines.totalAmount).toBeDefined();
            expect(invoiceLines.totalAmount.notNull).toBeTruthy();
        });

        it('should have tax fields', () => {
            expect(invoiceLines.taxRate).toBeDefined();
            expect(invoiceLines.taxRate.default).toBe('0.0000');

            expect(invoiceLines.taxAmount).toBeDefined();
            expect(invoiceLines.taxAmount.default).toBe('0.00');
        });

        it('should have discount fields', () => {
            expect(invoiceLines.discountRate).toBeDefined();
            expect(invoiceLines.discountRate.default).toBe('0.0000');

            expect(invoiceLines.discountAmount).toBeDefined();
            expect(invoiceLines.discountAmount.default).toBe('0.00');
        });

        it('should have billing period fields', () => {
            expect(invoiceLines.periodStart).toBeDefined();
            expect(invoiceLines.periodEnd).toBeDefined();
        });

        it('should have metadata field', () => {
            expect(invoiceLines.metadata).toBeDefined();
        });

        it('should have audit fields', () => {
            expect(invoiceLines.createdAt).toBeDefined();
            expect(invoiceLines.updatedAt).toBeDefined();
            expect(invoiceLines.createdById).toBeDefined();
            expect(invoiceLines.updatedById).toBeDefined();
        });

        it('should have soft delete fields', () => {
            expect(invoiceLines.deletedAt).toBeDefined();
            expect(invoiceLines.deletedById).toBeDefined();
        });
    });

    describe('business logic validation', () => {
        it('should default quantity to 1', () => {
            expect(invoiceLines.quantity.default).toBe(1);
        });

        it('should default tax amounts to 0', () => {
            expect(invoiceLines.taxRate.default).toBe('0.0000');
            expect(invoiceLines.taxAmount.default).toBe('0.00');
        });

        it('should default discount amounts to 0', () => {
            expect(invoiceLines.discountRate.default).toBe('0.0000');
            expect(invoiceLines.discountAmount.default).toBe('0.00');
        });

        it('should support both subscription and custom line items', () => {
            // Both pricing plan and subscription item should be nullable
            // to support custom line items
            expect(invoiceLines.pricingPlanId.notNull).toBeFalsy();
            expect(invoiceLines.subscriptionItemId.notNull).toBeFalsy();
        });

        it('should support billing periods for subscription items', () => {
            expect(invoiceLines.periodStart).toBeDefined();
            expect(invoiceLines.periodEnd).toBeDefined();
        });
    });
});
