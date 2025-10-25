import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { InvoiceStatusEnum } from '../../enums/index.js';
import { InvoiceQuerySchema, InvoiceSearchSchema } from './invoice.query.schema.js';

describe('Invoice Query Schemas', () => {
    describe('InvoiceQuerySchema', () => {
        it('should validate empty query object', () => {
            expect(() => InvoiceQuerySchema.parse({})).not.toThrow();
        });

        it('should validate query with client filter', () => {
            const queryWithClient = {
                clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480'
            };
            expect(() => InvoiceQuerySchema.parse(queryWithClient)).not.toThrow();
        });

        it('should validate query with status filter', () => {
            const queryWithStatus = {
                status: InvoiceStatusEnum.PAID
            };
            expect(() => InvoiceQuerySchema.parse(queryWithStatus)).not.toThrow();
        });

        it('should validate query with multiple status filters', () => {
            const queryWithMultipleStatus = {
                status: [InvoiceStatusEnum.OPEN, InvoiceStatusEnum.PAID]
            };
            expect(() => InvoiceQuerySchema.parse(queryWithMultipleStatus)).not.toThrow();
        });

        it('should validate query with date range filters', () => {
            const queryWithDateRange = {
                issueDateFrom: new Date('2024-01-01'),
                issueDateTo: new Date('2024-12-31'),
                dueDateFrom: new Date('2024-01-01'),
                dueDateTo: new Date('2024-12-31')
            };
            expect(() => InvoiceQuerySchema.parse(queryWithDateRange)).not.toThrow();
        });

        it('should validate query with amount range filters', () => {
            const queryWithAmountRange = {
                totalMin: 100.0,
                totalMax: 1000.0,
                subtotalMin: 50.0,
                subtotalMax: 500.0
            };
            expect(() => InvoiceQuerySchema.parse(queryWithAmountRange)).not.toThrow();
        });

        it('should validate query with invoice number search', () => {
            const queryWithInvoiceNumber = {
                invoiceNumber: 'INV-2024-001'
            };
            expect(() => InvoiceQuerySchema.parse(queryWithInvoiceNumber)).not.toThrow();
        });

        it('should validate query with pagination', () => {
            const queryWithPagination = {
                page: 2,
                pageSize: 25,
                sortBy: 'issueDate',
                sortOrder: 'desc'
            };
            expect(() => InvoiceQuerySchema.parse(queryWithPagination)).not.toThrow();
        });

        it('should validate query with overdue filter', () => {
            const queryWithOverdue = {
                isOverdue: true
            };
            expect(() => InvoiceQuerySchema.parse(queryWithOverdue)).not.toThrow();
        });

        it('should reject invalid status values', () => {
            const invalidStatus = {
                status: 'INVALID_STATUS'
            };
            expect(() => InvoiceQuerySchema.parse(invalidStatus)).toThrow(ZodError);
        });

        it('should reject negative amount filters', () => {
            const negativeAmount = {
                totalMin: -100
            };
            expect(() => InvoiceQuerySchema.parse(negativeAmount)).toThrow(ZodError);
        });

        it('should reject invalid sort order', () => {
            const invalidSortOrder = {
                sortBy: 'issueDate',
                sortOrder: 'invalid'
            };
            expect(() => InvoiceQuerySchema.parse(invalidSortOrder)).toThrow(ZodError);
        });
    });

    describe('InvoiceSearchSchema', () => {
        it('should validate text search query', () => {
            const searchQuery = {
                q: 'INV-2024'
            };
            expect(() => InvoiceSearchSchema.parse(searchQuery)).not.toThrow();
        });

        it('should validate search with filters', () => {
            const searchWithFilters = {
                q: 'services',
                status: InvoiceStatusEnum.OPEN,
                clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480'
            };
            expect(() => InvoiceSearchSchema.parse(searchWithFilters)).not.toThrow();
        });

        it('should validate search with date range', () => {
            const searchWithDateRange = {
                q: 'consultation',
                issueDateFrom: new Date('2024-01-01'),
                issueDateTo: new Date('2024-06-30')
            };
            expect(() => InvoiceSearchSchema.parse(searchWithDateRange)).not.toThrow();
        });

        it('should validate empty search query', () => {
            expect(() => InvoiceSearchSchema.parse({})).not.toThrow();
        });

        it('should reject too short search query', () => {
            const shortQuery = {
                q: 'A'
            };
            expect(() => InvoiceSearchSchema.parse(shortQuery)).toThrow(ZodError);
        });

        it('should validate search with pagination and sorting', () => {
            const searchWithPagination = {
                q: 'invoice',
                page: 1,
                pageSize: 10,
                sortBy: 'total',
                sortOrder: 'desc'
            };
            expect(() => InvoiceSearchSchema.parse(searchWithPagination)).not.toThrow();
        });
    });
});
