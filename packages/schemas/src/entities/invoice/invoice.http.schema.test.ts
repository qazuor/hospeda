import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { InvoiceStatusEnum } from '../../enums/index.js';
import {
    InvoiceHttpCreateSchema,
    InvoiceHttpQuerySchema,
    InvoiceHttpUpdateSchema
} from './invoice.http.schema.js';

describe('Invoice HTTP Schemas', () => {
    describe('InvoiceHttpQuerySchema', () => {
        it('should validate query with string amounts', () => {
            const queryWithStringAmounts = {
                totalMin: '100.50',
                totalMax: '1000.75',
                subtotalMin: '50.25',
                subtotalMax: '500.90'
            };
            const result = InvoiceHttpQuerySchema.parse(queryWithStringAmounts);
            expect(result.totalMin).toBe(100.5);
            expect(result.totalMax).toBe(1000.75);
            expect(result.subtotalMin).toBe(50.25);
            expect(result.subtotalMax).toBe(500.9);
        });

        it('should validate query with string dates', () => {
            const queryWithStringDates = {
                issueDateFrom: '2024-01-01',
                issueDateTo: '2024-12-31',
                dueDateFrom: '2024-01-15',
                dueDateTo: '2024-12-15'
            };
            const result = InvoiceHttpQuerySchema.parse(queryWithStringDates);
            expect(result.issueDateFrom).toBeInstanceOf(Date);
            expect(result.issueDateTo).toBeInstanceOf(Date);
            expect(result.dueDateFrom).toBeInstanceOf(Date);
            expect(result.dueDateTo).toBeInstanceOf(Date);
        });

        it('should validate query with string pagination', () => {
            const queryWithStringPagination = {
                page: '2',
                pageSize: '25'
            };
            const result = InvoiceHttpQuerySchema.parse(queryWithStringPagination);
            expect(result.page).toBe(2);
            expect(result.pageSize).toBe(25);
        });

        it('should validate query with boolean strings', () => {
            const queryWithBooleanStrings = {
                isOverdue: 'true',
                isPaid: 'false'
            };
            const result = InvoiceHttpQuerySchema.parse(queryWithBooleanStrings);
            expect(result.isOverdue).toBe(true);
            expect(result.isPaid).toBe(false);
        });

        it('should validate query with array status from string', () => {
            const queryWithArrayStatus = {
                status: `${InvoiceStatusEnum.OPEN},${InvoiceStatusEnum.PAID}`
            };
            const result = InvoiceHttpQuerySchema.parse(queryWithArrayStatus);
            expect(result.status).toEqual([InvoiceStatusEnum.OPEN, InvoiceStatusEnum.PAID]);
        });

        it('should reject invalid amount strings', () => {
            const invalidAmount = {
                totalMin: 'not-a-number'
            };
            expect(() => InvoiceHttpQuerySchema.parse(invalidAmount)).toThrow(ZodError);
        });

        it('should reject invalid date strings', () => {
            const invalidDate = {
                issueDateFrom: 'not-a-date'
            };
            expect(() => InvoiceHttpQuerySchema.parse(invalidDate)).toThrow(ZodError);
        });

        it('should reject invalid boolean strings', () => {
            const invalidBoolean = {
                isOverdue: 'maybe'
            };
            expect(() => InvoiceHttpQuerySchema.parse(invalidBoolean)).toThrow(ZodError);
        });
    });

    describe('InvoiceHttpCreateSchema', () => {
        it('should validate create data with string amounts', () => {
            const createData = {
                clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
                invoiceNumber: 'INV-2024-001',
                subtotal: '100.50',
                taxes: '21.11',
                total: '121.61',
                currency: 'USD',
                issueDate: '2024-01-01',
                dueDate: '2024-01-31'
            };
            const result = InvoiceHttpCreateSchema.parse(createData);
            expect(result.subtotal).toBe(100.5);
            expect(result.taxes).toBe(21.11);
            expect(result.total).toBe(121.61);
            expect(result.issueDate).toBeInstanceOf(Date);
            expect(result.dueDate).toBeInstanceOf(Date);
        });

        it('should validate create data with default status', () => {
            const createData = {
                clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
                invoiceNumber: 'INV-2024-001',
                subtotal: '100.00',
                taxes: '21.00',
                total: '121.00',
                currency: 'USD',
                issueDate: '2024-01-01',
                dueDate: '2024-01-31'
            };
            const result = InvoiceHttpCreateSchema.parse(createData);
            expect(result.status).toBe(InvoiceStatusEnum.OPEN);
        });

        it('should reject invalid amount strings in create', () => {
            const invalidCreate = {
                clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
                invoiceNumber: 'INV-2024-001',
                subtotal: 'invalid-amount',
                taxes: '21.00',
                total: '121.00',
                currency: 'USD',
                issueDate: '2024-01-01',
                dueDate: '2024-01-31'
            };
            expect(() => InvoiceHttpCreateSchema.parse(invalidCreate)).toThrow(ZodError);
        });
    });

    describe('InvoiceHttpUpdateSchema', () => {
        it('should validate update data with string amounts', () => {
            const updateData = {
                subtotal: '150.25',
                taxes: '31.55',
                total: '181.80'
            };
            const result = InvoiceHttpUpdateSchema.parse(updateData);
            expect(result.subtotal).toBe(150.25);
            expect(result.taxes).toBe(31.55);
            expect(result.total).toBe(181.8);
        });

        it('should validate update data with string date', () => {
            const updateData = {
                paidAt: '2024-01-15T10:30:00Z'
            };
            const result = InvoiceHttpUpdateSchema.parse(updateData);
            expect(result.paidAt).toBeInstanceOf(Date);
        });

        it('should validate empty update object', () => {
            expect(() => InvoiceHttpUpdateSchema.parse({})).not.toThrow();
        });

        it('should reject invalid amount strings in update', () => {
            const invalidUpdate = {
                total: 'not-a-number'
            };
            expect(() => InvoiceHttpUpdateSchema.parse(invalidUpdate)).toThrow(ZodError);
        });
    });
});
