import { describe, expect, it } from 'vitest';
import {
    CreateCreditNoteSchema,
    CreditNoteKeySchema,
    DeleteCreditNoteSchema,
    RestoreCreditNoteSchema,
    UpdateCreditNoteSchema
} from './crud.schema.js';

describe('CreditNote CRUD Schemas', () => {
    const validCreateData = {
        invoiceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
        creditNoteNumber: 'CN-2024-001',
        amount: 50.0,
        currency: 'USD',
        reason: 'Billing error correction',
        issueDate: new Date('2024-01-15T00:00:00Z')
    };

    describe('CreateCreditNoteSchema', () => {
        it('should validate valid create data', () => {
            expect(() => CreateCreditNoteSchema.parse(validCreateData)).not.toThrow();
        });

        it('should validate create data with optional description', () => {
            const withDescription = {
                ...validCreateData,
                description: 'Customer refund request'
            };
            expect(() => CreateCreditNoteSchema.parse(withDescription)).not.toThrow();
        });

        it('should reject invalid invoice ID', () => {
            const invalidData = {
                ...validCreateData,
                invoiceId: 'invalid-id'
            };
            expect(() => CreateCreditNoteSchema.parse(invalidData)).toThrow();
        });

        it('should reject negative amount', () => {
            const invalidData = {
                ...validCreateData,
                amount: -10
            };
            expect(() => CreateCreditNoteSchema.parse(invalidData)).toThrow();
        });

        it('should reject zero amount', () => {
            const invalidData = {
                ...validCreateData,
                amount: 0
            };
            expect(() => CreateCreditNoteSchema.parse(invalidData)).toThrow();
        });

        it('should reject empty credit note number', () => {
            const invalidData = {
                ...validCreateData,
                creditNoteNumber: ''
            };
            expect(() => CreateCreditNoteSchema.parse(invalidData)).toThrow();
        });

        it('should reject too long credit note number', () => {
            const invalidData = {
                ...validCreateData,
                creditNoteNumber: 'x'.repeat(101)
            };
            expect(() => CreateCreditNoteSchema.parse(invalidData)).toThrow();
        });

        it('should reject empty reason', () => {
            const invalidData = {
                ...validCreateData,
                reason: ''
            };
            expect(() => CreateCreditNoteSchema.parse(invalidData)).toThrow();
        });

        it('should reject too long reason', () => {
            const invalidData = {
                ...validCreateData,
                reason: 'x'.repeat(501)
            };
            expect(() => CreateCreditNoteSchema.parse(invalidData)).toThrow();
        });

        it('should reject too long description', () => {
            const invalidData = {
                ...validCreateData,
                description: 'x'.repeat(1001)
            };
            expect(() => CreateCreditNoteSchema.parse(invalidData)).toThrow();
        });

        it('should reject invalid currency', () => {
            const invalidData = {
                ...validCreateData,
                currency: 'XYZ'
            };
            expect(() => CreateCreditNoteSchema.parse(invalidData)).toThrow();
        });
    });

    describe('UpdateCreditNoteSchema', () => {
        it('should validate empty update data', () => {
            expect(() => UpdateCreditNoteSchema.parse({})).not.toThrow();
        });

        it('should validate partial update data', () => {
            const updateData = {
                reason: 'Updated reason',
                amount: 75.0
            };
            expect(() => UpdateCreditNoteSchema.parse(updateData)).not.toThrow();
        });

        it('should reject invalid partial data', () => {
            const invalidData = {
                amount: -10
            };
            expect(() => UpdateCreditNoteSchema.parse(invalidData)).toThrow();
        });
    });

    describe('DeleteCreditNoteSchema', () => {
        it('should validate valid ID', () => {
            const data = { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' };
            expect(() => DeleteCreditNoteSchema.parse(data)).not.toThrow();
        });

        it('should reject invalid ID', () => {
            const data = { id: 'invalid-id' };
            expect(() => DeleteCreditNoteSchema.parse(data)).toThrow();
        });
    });

    describe('RestoreCreditNoteSchema', () => {
        it('should validate valid ID', () => {
            const data = { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' };
            expect(() => RestoreCreditNoteSchema.parse(data)).not.toThrow();
        });

        it('should reject invalid ID', () => {
            const data = { id: 'invalid-id' };
            expect(() => RestoreCreditNoteSchema.parse(data)).toThrow();
        });
    });

    describe('CreditNoteKeySchema', () => {
        it('should validate valid key', () => {
            const data = { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' };
            expect(() => CreditNoteKeySchema.parse(data)).not.toThrow();
        });

        it('should reject invalid key', () => {
            const data = { id: 'invalid-id' };
            expect(() => CreditNoteKeySchema.parse(data)).toThrow();
        });
    });
});
