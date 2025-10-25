import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { InvoiceStatusEnum } from '../../enums/index.js';
import { InvoiceSchema } from './invoice.schema.js';

describe('InvoiceSchema', () => {
    const validInvoiceData = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
        invoiceNumber: 'INV-2024-001',
        status: InvoiceStatusEnum.OPEN,
        subtotal: 100.0,
        taxes: 21.0,
        total: 121.0,
        currency: 'USD',
        issueDate: new Date('2024-01-01T00:00:00Z'),
        dueDate: new Date('2024-01-31T00:00:00Z'),
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
        createdById: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
        updatedById: 'f47ac10b-58cc-4372-a567-0e02b2c3d482'
    };

    describe('Valid invoice validation', () => {
        it('should validate a complete valid invoice', () => {
            expect(() => InvoiceSchema.parse(validInvoiceData)).not.toThrow();
        });

        it('should validate invoice with minimum required fields', () => {
            const minimalInvoice = {
                id: validInvoiceData.id,
                clientId: validInvoiceData.clientId,
                invoiceNumber: validInvoiceData.invoiceNumber,
                status: validInvoiceData.status,
                subtotal: validInvoiceData.subtotal,
                taxes: validInvoiceData.taxes,
                total: validInvoiceData.total,
                currency: validInvoiceData.currency,
                issueDate: validInvoiceData.issueDate,
                dueDate: validInvoiceData.dueDate,
                createdAt: validInvoiceData.createdAt,
                updatedAt: validInvoiceData.updatedAt,
                createdById: validInvoiceData.createdById,
                updatedById: validInvoiceData.updatedById
            };

            expect(() => InvoiceSchema.parse(minimalInvoice)).not.toThrow();
        });
    });

    describe('Invoice status validation', () => {
        it('should validate all invoice status values', () => {
            for (const status of Object.values(InvoiceStatusEnum)) {
                const invoiceWithStatus = { ...validInvoiceData, status };
                expect(() => InvoiceSchema.parse(invoiceWithStatus)).not.toThrow();
            }
        });

        it('should reject invalid status values', () => {
            const invalidStatusInvoice = { ...validInvoiceData, status: 'INVALID_STATUS' };
            expect(() => InvoiceSchema.parse(invalidStatusInvoice)).toThrow(ZodError);
        });
    });

    describe('Amount validations', () => {
        it('should validate positive amounts', () => {
            const positiveAmountsInvoice = {
                ...validInvoiceData,
                subtotal: 50.25,
                taxes: 10.55,
                total: 60.8
            };
            expect(() => InvoiceSchema.parse(positiveAmountsInvoice)).not.toThrow();
        });

        it('should reject negative subtotal', () => {
            const negativeSubtotalInvoice = { ...validInvoiceData, subtotal: -10 };
            expect(() => InvoiceSchema.parse(negativeSubtotalInvoice)).toThrow(ZodError);
        });

        it('should reject negative total', () => {
            const negativeTotalInvoice = { ...validInvoiceData, total: -10 };
            expect(() => InvoiceSchema.parse(negativeTotalInvoice)).toThrow(ZodError);
        });

        it('should allow zero taxes', () => {
            const zeroTaxesInvoice = { ...validInvoiceData, taxes: 0 };
            expect(() => InvoiceSchema.parse(zeroTaxesInvoice)).not.toThrow();
        });
    });

    describe('Invoice number validation', () => {
        it('should validate different invoice number formats', () => {
            const validFormats = ['INV-2024-001', 'FACT-001', 'F-24-123', '2024-001-INV', 'INV001'];

            for (const invoiceNumber of validFormats) {
                const invoiceWithNumber = { ...validInvoiceData, invoiceNumber };
                expect(() => InvoiceSchema.parse(invoiceWithNumber)).not.toThrow();
            }
        });

        it('should reject empty invoice number', () => {
            const emptyNumberInvoice = { ...validInvoiceData, invoiceNumber: '' };
            expect(() => InvoiceSchema.parse(emptyNumberInvoice)).toThrow(ZodError);
        });

        it('should reject too long invoice number', () => {
            const longNumberInvoice = {
                ...validInvoiceData,
                invoiceNumber: 'A'.repeat(101)
            };
            expect(() => InvoiceSchema.parse(longNumberInvoice)).toThrow(ZodError);
        });
    });

    describe('Date validations', () => {
        it('should validate dates as Date objects', () => {
            const dateObjectInvoice = {
                ...validInvoiceData,
                issueDate: new Date('2024-01-15T10:30:00Z'),
                dueDate: new Date('2024-02-15T10:30:00Z')
            };
            expect(() => InvoiceSchema.parse(dateObjectInvoice)).not.toThrow();
        });

        it('should reject invalid date values', () => {
            const invalidDateInvoice = { ...validInvoiceData, issueDate: 'invalid-date' };
            expect(() => InvoiceSchema.parse(invalidDateInvoice)).toThrow(ZodError);
        });
    });

    describe('Optional fields validation', () => {
        it('should validate with optional description', () => {
            const withDescriptionInvoice = {
                ...validInvoiceData,
                description: 'Invoice for services rendered'
            };
            expect(() => InvoiceSchema.parse(withDescriptionInvoice)).not.toThrow();
        });

        it('should validate with optional payment terms', () => {
            const withPaymentTermsInvoice = {
                ...validInvoiceData,
                paymentTerms: 'Net 30 days'
            };
            expect(() => InvoiceSchema.parse(withPaymentTermsInvoice)).not.toThrow();
        });

        it('should validate with optional notes', () => {
            const withNotesInvoice = {
                ...validInvoiceData,
                notes: 'Special handling required'
            };
            expect(() => InvoiceSchema.parse(withNotesInvoice)).not.toThrow();
        });

        it('should validate with optional paid date for paid invoices', () => {
            const paidInvoice = {
                ...validInvoiceData,
                status: InvoiceStatusEnum.PAID,
                paidAt: new Date('2024-01-15T00:00:00Z')
            };
            expect(() => InvoiceSchema.parse(paidInvoice)).not.toThrow();
        });
    });

    describe('Type inference', () => {
        it('should infer correct TypeScript type', () => {
            const invoice = InvoiceSchema.parse(validInvoiceData);

            // Type assertions to ensure correct inference
            expect(typeof invoice.id).toBe('string');
            expect(typeof invoice.clientId).toBe('string');
            expect(typeof invoice.invoiceNumber).toBe('string');
            expect(typeof invoice.status).toBe('string');
            expect(typeof invoice.subtotal).toBe('number');
            expect(typeof invoice.taxes).toBe('number');
            expect(typeof invoice.total).toBe('number');
            expect(typeof invoice.currency).toBe('string');
            expect(invoice.issueDate).toBeInstanceOf(Date);
            expect(invoice.dueDate).toBeInstanceOf(Date);
            expect(invoice.createdAt).toBeInstanceOf(Date);
            expect(invoice.updatedAt).toBeInstanceOf(Date);
        });
    });
});
