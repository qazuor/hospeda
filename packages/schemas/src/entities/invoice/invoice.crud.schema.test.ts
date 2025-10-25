import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { InvoiceStatusEnum } from '../../enums/index.js';
import {
    CreateInvoiceSchema,
    DeleteInvoiceSchema,
    UpdateInvoiceSchema
} from './invoice.crud.schema.js';

describe('Invoice CRUD Schemas', () => {
    describe('CreateInvoiceSchema', () => {
        const validCreateData = {
            clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
            invoiceNumber: 'INV-2024-001',
            status: InvoiceStatusEnum.OPEN,
            subtotal: 100.0,
            taxes: 21.0,
            total: 121.0,
            currency: 'USD',
            issueDate: new Date('2024-01-01T00:00:00Z'),
            dueDate: new Date('2024-01-31T00:00:00Z')
        };

        it('should validate valid invoice creation data', () => {
            expect(() => CreateInvoiceSchema.parse(validCreateData)).not.toThrow();
        });

        it('should validate with optional fields', () => {
            const withOptionalFields = {
                ...validCreateData,
                description: 'Invoice for services',
                paymentTerms: 'Net 30',
                notes: 'Important notes'
            };
            expect(() => CreateInvoiceSchema.parse(withOptionalFields)).not.toThrow();
        });

        it('should reject invalid status values', () => {
            const invalidStatus = { ...validCreateData, status: 'INVALID' };
            expect(() => CreateInvoiceSchema.parse(invalidStatus)).toThrow(ZodError);
        });

        it('should reject negative amounts', () => {
            const negativeSubtotal = { ...validCreateData, subtotal: -10 };
            expect(() => CreateInvoiceSchema.parse(negativeSubtotal)).toThrow(ZodError);
        });

        it('should reject empty invoice number', () => {
            const emptyNumber = { ...validCreateData, invoiceNumber: '' };
            expect(() => CreateInvoiceSchema.parse(emptyNumber)).toThrow(ZodError);
        });

        it('should default status to OPEN if not provided', () => {
            const { status, ...withoutStatus } = validCreateData;
            const result = CreateInvoiceSchema.parse(withoutStatus);
            expect(result.status).toBe(InvoiceStatusEnum.OPEN);
        });
    });

    describe('UpdateInvoiceSchema', () => {
        it('should validate partial updates', () => {
            const partialUpdate = {
                status: InvoiceStatusEnum.PAID,
                paidAt: new Date('2024-01-15T00:00:00Z')
            };
            expect(() => UpdateInvoiceSchema.parse(partialUpdate)).not.toThrow();
        });

        it('should validate amount updates', () => {
            const amountUpdate = {
                subtotal: 150.0,
                taxes: 31.5,
                total: 181.5
            };
            expect(() => UpdateInvoiceSchema.parse(amountUpdate)).not.toThrow();
        });

        it('should validate description update', () => {
            const descriptionUpdate = {
                description: 'Updated invoice description'
            };
            expect(() => UpdateInvoiceSchema.parse(descriptionUpdate)).not.toThrow();
        });

        it('should validate notes update', () => {
            const notesUpdate = {
                notes: 'Updated notes'
            };
            expect(() => UpdateInvoiceSchema.parse(notesUpdate)).not.toThrow();
        });

        it('should reject negative amounts in updates', () => {
            const negativeUpdate = { subtotal: -50 };
            expect(() => UpdateInvoiceSchema.parse(negativeUpdate)).toThrow(ZodError);
        });

        it('should reject invalid status in updates', () => {
            const invalidStatusUpdate = { status: 'INVALID_STATUS' };
            expect(() => UpdateInvoiceSchema.parse(invalidStatusUpdate)).toThrow(ZodError);
        });

        it('should validate empty update object', () => {
            expect(() => UpdateInvoiceSchema.parse({})).not.toThrow();
        });
    });

    describe('DeleteInvoiceSchema', () => {
        it('should validate invoice deletion with reason', () => {
            const deleteData = {
                reason: 'Invoice cancelled by client request'
            };
            expect(() => DeleteInvoiceSchema.parse(deleteData)).not.toThrow();
        });

        it('should validate deletion without reason', () => {
            expect(() => DeleteInvoiceSchema.parse({})).not.toThrow();
        });

        it('should validate deletion with metadata', () => {
            const deleteWithMetadata = {
                reason: 'System cleanup',
                metadata: {
                    cleanupJob: 'invoice-cleanup-2024',
                    triggeredBy: 'admin'
                }
            };
            expect(() => DeleteInvoiceSchema.parse(deleteWithMetadata)).not.toThrow();
        });

        it('should reject too long deletion reason', () => {
            const longReason = {
                reason: 'A'.repeat(501)
            };
            expect(() => DeleteInvoiceSchema.parse(longReason)).toThrow(ZodError);
        });
    });
});
