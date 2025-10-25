import { describe, expect, it } from 'vitest';
import {
    CreditNoteClientRelationSchema,
    CreditNoteInvoiceRelationSchema,
    CreditNoteWithRelationsSchema
} from './relations.schema.js';

describe('CreditNote Relations Schemas', () => {
    describe('CreditNoteInvoiceRelationSchema', () => {
        it('should validate valid invoice relation', () => {
            const invoiceRelation = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                invoiceNumber: 'INV-2024-001',
                totalAmount: 500.0,
                status: 'paid'
            };
            expect(() => CreditNoteInvoiceRelationSchema.parse(invoiceRelation)).not.toThrow();
        });

        it('should reject invalid UUID', () => {
            const invoiceRelation = {
                id: 'invalid-id',
                invoiceNumber: 'INV-2024-001',
                totalAmount: 500.0,
                status: 'paid'
            };
            expect(() => CreditNoteInvoiceRelationSchema.parse(invoiceRelation)).toThrow();
        });
    });

    describe('CreditNoteClientRelationSchema', () => {
        it('should validate valid client relation', () => {
            const clientRelation = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                name: 'John Doe',
                email: 'john.doe@example.com'
            };
            expect(() => CreditNoteClientRelationSchema.parse(clientRelation)).not.toThrow();
        });

        it('should reject invalid email', () => {
            const clientRelation = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                name: 'John Doe',
                email: 'invalid-email'
            };
            expect(() => CreditNoteClientRelationSchema.parse(clientRelation)).toThrow();
        });

        it('should reject invalid UUID', () => {
            const clientRelation = {
                id: 'invalid-id',
                name: 'John Doe',
                email: 'john.doe@example.com'
            };
            expect(() => CreditNoteClientRelationSchema.parse(clientRelation)).toThrow();
        });
    });

    describe('CreditNoteWithRelationsSchema', () => {
        const validCreditNoteWithRelations = {
            id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            invoiceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
            clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
            creditNoteNumber: 'CN-2024-001',
            amount: 50.0,
            currency: 'USD',
            reason: 'Billing error correction',
            issueDate: new Date('2024-01-15T00:00:00Z'),
            isApplied: false,
            createdAt: new Date('2024-01-15T00:00:00Z'),
            updatedAt: new Date('2024-01-15T00:00:00Z'),
            createdById: 'f47ac10b-58cc-4372-a567-0e02b2c3d482',
            updatedById: 'f47ac10b-58cc-4372-a567-0e02b2c3d483'
        };

        it('should validate credit note without relations', () => {
            expect(() =>
                CreditNoteWithRelationsSchema.parse(validCreditNoteWithRelations)
            ).not.toThrow();
        });

        it('should validate credit note with invoice relation', () => {
            const withInvoiceRelation = {
                ...validCreditNoteWithRelations,
                invoice: {
                    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
                    invoiceNumber: 'INV-2024-001',
                    totalAmount: 500.0,
                    status: 'paid'
                }
            };
            expect(() => CreditNoteWithRelationsSchema.parse(withInvoiceRelation)).not.toThrow();
        });

        it('should validate credit note with client relation', () => {
            const withClientRelation = {
                ...validCreditNoteWithRelations,
                client: {
                    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
                    name: 'John Doe',
                    email: 'john.doe@example.com'
                }
            };
            expect(() => CreditNoteWithRelationsSchema.parse(withClientRelation)).not.toThrow();
        });

        it('should validate credit note with all relations', () => {
            const withAllRelations = {
                ...validCreditNoteWithRelations,
                invoice: {
                    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
                    invoiceNumber: 'INV-2024-001',
                    totalAmount: 500.0,
                    status: 'paid'
                },
                client: {
                    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
                    name: 'John Doe',
                    email: 'john.doe@example.com'
                }
            };
            expect(() => CreditNoteWithRelationsSchema.parse(withAllRelations)).not.toThrow();
        });

        it('should validate applied credit note with appliedAt date', () => {
            const appliedCreditNote = {
                ...validCreditNoteWithRelations,
                isApplied: true,
                appliedAt: new Date('2024-01-16T00:00:00Z')
            };
            expect(() => CreditNoteWithRelationsSchema.parse(appliedCreditNote)).not.toThrow();
        });

        it('should validate credit note with deletedAt date', () => {
            const deletedCreditNote = {
                ...validCreditNoteWithRelations,
                deletedAt: new Date('2024-01-17T00:00:00Z'),
                deletedById: 'f47ac10b-58cc-4372-a567-0e02b2c3d484'
            };
            expect(() => CreditNoteWithRelationsSchema.parse(deletedCreditNote)).not.toThrow();
        });

        it('should validate credit note with optional description', () => {
            const withDescription = {
                ...validCreditNoteWithRelations,
                description: 'Customer requested refund'
            };
            expect(() => CreditNoteWithRelationsSchema.parse(withDescription)).not.toThrow();
        });
    });
});
