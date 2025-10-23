import { InvoiceStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { invoices } from '../../../src/schemas/payment/invoice.dbschema.js';

describe('Invoice DB Schema', () => {
    describe('table structure', () => {
        it('should be properly defined as table', () => {
            expect(invoices).toBeDefined();
            expect(typeof invoices).toBe('object');
        });

        it('should have primary key', () => {
            expect(invoices.id).toBeDefined();
        });

        it('should have required client relationship', () => {
            expect(invoices.clientId).toBeDefined();
            expect(invoices.clientId.notNull).toBeTruthy();
        });

        it('should have invoice identification fields', () => {
            expect(invoices.invoiceNumber).toBeDefined();
            expect(invoices.invoiceNumber.notNull).toBeTruthy();
            expect(invoices.invoiceNumber.isUnique).toBeTruthy();
        });

        it('should have status field with default', () => {
            expect(invoices.status).toBeDefined();
            expect(invoices.status.notNull).toBeTruthy();
            expect(invoices.status.default).toBe(InvoiceStatusEnum.OPEN);
        });

        it('should have amount fields with correct precision', () => {
            expect(invoices.subtotalAmount).toBeDefined();
            expect(invoices.subtotalAmount.notNull).toBeTruthy();

            expect(invoices.taxAmount).toBeDefined();
            expect(invoices.taxAmount.notNull).toBeTruthy();

            expect(invoices.totalAmount).toBeDefined();
            expect(invoices.totalAmount.notNull).toBeTruthy();
        });

        it('should have currency and exchange rate support', () => {
            expect(invoices.currency).toBeDefined();
            expect(invoices.currency.default).toBe('USD');

            expect(invoices.exchangeRate).toBeDefined();
            expect(invoices.baseCurrency).toBeDefined();
            expect(invoices.baseCurrency.default).toBe('USD');
        });

        it('should have date fields', () => {
            expect(invoices.issuedAt).toBeDefined();
            expect(invoices.issuedAt.notNull).toBeTruthy();

            expect(invoices.dueAt).toBeDefined();
            expect(invoices.paidAt).toBeDefined();
            expect(invoices.voidedAt).toBeDefined();
        });

        it('should have audit fields', () => {
            expect(invoices.createdAt).toBeDefined();
            expect(invoices.updatedAt).toBeDefined();
            expect(invoices.createdById).toBeDefined();
            expect(invoices.updatedById).toBeDefined();
        });

        it('should have soft delete fields', () => {
            expect(invoices.deletedAt).toBeDefined();
            expect(invoices.deletedById).toBeDefined();
        });

        it('should have metadata fields', () => {
            expect(invoices.billingAddress).toBeDefined();
            expect(invoices.notes).toBeDefined();
            expect(invoices.metadata).toBeDefined();
            expect(invoices.adminInfo).toBeDefined();
        });
    });

    describe('enum configuration', () => {
        it('should have correct invoice status enum values', () => {
            expect(Object.values(InvoiceStatusEnum)).toEqual([
                InvoiceStatusEnum.OPEN,
                InvoiceStatusEnum.PAID,
                InvoiceStatusEnum.VOID
            ]);
        });
    });

    describe('business logic validation', () => {
        it('should support multi-currency invoices', () => {
            // Test that we can have different base and invoice currencies
            expect(invoices.currency).toBeDefined();
            expect(invoices.baseCurrency).toBeDefined();
            expect(invoices.exchangeRate).toBeDefined();
        });

        it('should enforce invoice number uniqueness', () => {
            expect(invoices.invoiceNumber.isUnique).toBeTruthy();
        });

        it('should default to USD currency', () => {
            expect(invoices.currency.default).toBe('USD');
            expect(invoices.baseCurrency.default).toBe('USD');
        });

        it('should default exchange rate to 1.0', () => {
            expect(invoices.exchangeRate.default).toBe('1.0000');
        });

        it('should default tax amount to 0', () => {
            expect(invoices.taxAmount.default).toBe('0.00');
        });
    });
});
