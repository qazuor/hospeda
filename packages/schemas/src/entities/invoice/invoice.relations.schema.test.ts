import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { InvoiceStatusEnum } from '../../enums/index.js';
import {
    InvoiceFullRelationsSchema,
    InvoiceWithClientSchema,
    InvoiceWithLinesSchema,
    InvoiceWithPaymentsSchema
} from './invoice.relations.schema.js';

describe('Invoice Relations Schemas', () => {
    const baseInvoice = {
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

    const sampleClient = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
        email: 'client@example.com',
        name: 'Test Client',
        companyName: 'Test Company',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
        createdById: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
        updatedById: 'f47ac10b-58cc-4372-a567-0e02b2c3d482'
    };

    const sampleInvoiceLine = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d485',
        invoiceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        description: 'Consulting services',
        quantity: 1,
        unitPrice: 100.0,
        total: 100.0,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
        createdById: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
        updatedById: 'f47ac10b-58cc-4372-a567-0e02b2c3d482'
    };

    const samplePayment = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d486',
        invoiceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        amount: 121.0,
        currency: 'USD',
        status: 'COMPLETED',
        method: 'CREDIT_CARD',
        processedAt: new Date('2024-01-15T00:00:00Z'),
        createdAt: new Date('2024-01-15T00:00:00Z'),
        updatedAt: new Date('2024-01-15T00:00:00Z'),
        createdById: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
        updatedById: 'f47ac10b-58cc-4372-a567-0e02b2c3d482'
    };

    describe('InvoiceWithClientSchema', () => {
        it('should validate invoice with client relation', () => {
            const invoiceWithClient = {
                ...baseInvoice,
                client: sampleClient
            };
            expect(() => InvoiceWithClientSchema.parse(invoiceWithClient)).not.toThrow();
        });

        it('should validate invoice without client relation', () => {
            expect(() => InvoiceWithClientSchema.parse(baseInvoice)).not.toThrow();
        });

        it('should reject invalid client data', () => {
            const invalidClientInvoice = {
                ...baseInvoice,
                client: {
                    id: 'invalid-id',
                    email: 'not-an-email'
                }
            };
            expect(() => InvoiceWithClientSchema.parse(invalidClientInvoice)).toThrow(ZodError);
        });
    });

    describe('InvoiceWithLinesSchema', () => {
        it('should validate invoice with invoice lines', () => {
            const invoiceWithLines = {
                ...baseInvoice,
                lines: [sampleInvoiceLine]
            };
            expect(() => InvoiceWithLinesSchema.parse(invoiceWithLines)).not.toThrow();
        });

        it('should validate invoice with multiple lines', () => {
            const multipleLines = [
                sampleInvoiceLine,
                {
                    ...sampleInvoiceLine,
                    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d487',
                    description: 'Additional services',
                    quantity: 2,
                    unitPrice: 50.0,
                    total: 100.0
                }
            ];
            const invoiceWithMultipleLines = {
                ...baseInvoice,
                lines: multipleLines
            };
            expect(() => InvoiceWithLinesSchema.parse(invoiceWithMultipleLines)).not.toThrow();
        });

        it('should validate invoice with empty lines array', () => {
            const invoiceWithEmptyLines = {
                ...baseInvoice,
                lines: []
            };
            expect(() => InvoiceWithLinesSchema.parse(invoiceWithEmptyLines)).not.toThrow();
        });

        it('should validate invoice without lines relation', () => {
            expect(() => InvoiceWithLinesSchema.parse(baseInvoice)).not.toThrow();
        });
    });

    describe('InvoiceWithPaymentsSchema', () => {
        it('should validate invoice with payments', () => {
            const invoiceWithPayments = {
                ...baseInvoice,
                payments: [samplePayment]
            };
            expect(() => InvoiceWithPaymentsSchema.parse(invoiceWithPayments)).not.toThrow();
        });

        it('should validate invoice with multiple payments', () => {
            const multiplePayments = [
                samplePayment,
                {
                    ...samplePayment,
                    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d488',
                    amount: 50.0,
                    method: 'BANK_TRANSFER'
                }
            ];
            const invoiceWithMultiplePayments = {
                ...baseInvoice,
                payments: multiplePayments
            };
            expect(() =>
                InvoiceWithPaymentsSchema.parse(invoiceWithMultiplePayments)
            ).not.toThrow();
        });

        it('should validate invoice without payments relation', () => {
            expect(() => InvoiceWithPaymentsSchema.parse(baseInvoice)).not.toThrow();
        });
    });

    describe('InvoiceFullRelationsSchema', () => {
        it('should validate invoice with all relations', () => {
            const invoiceWithAllRelations = {
                ...baseInvoice,
                client: sampleClient,
                lines: [sampleInvoiceLine],
                payments: [samplePayment]
            };
            expect(() => InvoiceFullRelationsSchema.parse(invoiceWithAllRelations)).not.toThrow();
        });

        it('should validate invoice with partial relations', () => {
            const invoiceWithPartialRelations = {
                ...baseInvoice,
                client: sampleClient,
                lines: []
            };
            expect(() =>
                InvoiceFullRelationsSchema.parse(invoiceWithPartialRelations)
            ).not.toThrow();
        });

        it('should validate invoice without any relations', () => {
            expect(() => InvoiceFullRelationsSchema.parse(baseInvoice)).not.toThrow();
        });
    });
});
