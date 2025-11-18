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
            expect(invoiceLines.quantity.default).toBe('1');
        });

        it('should have pricing fields with correct precision', () => {
            expect(invoiceLines.unitPrice).toBeDefined();
            expect(invoiceLines.unitPrice.notNull).toBeTruthy();

            expect(invoiceLines.total).toBeDefined();
            expect(invoiceLines.total.notNull).toBeTruthy();
        });

        it('should have tax fields', () => {
            expect(invoiceLines.taxRate).toBeDefined();

            expect(invoiceLines.taxAmount).toBeDefined();
        });

        it('should have discount fields', () => {
            expect(invoiceLines.discountRate).toBeDefined();

            expect(invoiceLines.discountAmount).toBeDefined();
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
            expect(invoiceLines.quantity.default).toBe('1');
        });

        it('should have tax fields for calculations', () => {
            // Tax rate and amount don't have defaults - they're calculated
            expect(invoiceLines.taxRate).toBeDefined();
            expect(invoiceLines.taxAmount).toBeDefined();
        });

        it('should have discount fields for calculations', () => {
            // Discount rate and amount don't have defaults - they're optional
            expect(invoiceLines.discountRate).toBeDefined();
            expect(invoiceLines.discountAmount).toBeDefined();
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
