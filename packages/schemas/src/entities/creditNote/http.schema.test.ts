import { describe, expect, it } from 'vitest';
import {
    CreateCreditNoteHTTPSchema,
    CreditNoteQueryHTTPSchema,
    UpdateCreditNoteHTTPSchema
} from './http.schema.js';

describe('CreditNote HTTP Schemas', () => {
    const validCreateData = {
        invoiceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
        creditNoteNumber: 'CN-2024-001',
        amount: 50.0,
        currency: 'USD',
        reason: 'Billing error correction',
        issueDate: new Date('2024-01-15T00:00:00Z')
    };

    describe('CreateCreditNoteHTTPSchema', () => {
        it('should validate valid create data', () => {
            expect(() => CreateCreditNoteHTTPSchema.parse(validCreateData)).not.toThrow();
        });

        it('should convert string amount to number', () => {
            const dataWithStringAmount = {
                ...validCreateData,
                amount: '50.00'
            };
            const result = CreateCreditNoteHTTPSchema.parse(dataWithStringAmount);
            expect(result.amount).toBe(50.0);
            expect(typeof result.amount).toBe('number');
        });

        it('should convert string date to Date object', () => {
            const dataWithStringDate = {
                ...validCreateData,
                issueDate: '2024-01-15T00:00:00Z'
            };
            const result = CreateCreditNoteHTTPSchema.parse(dataWithStringDate);
            expect(result.issueDate).toBeInstanceOf(Date);
        });

        it('should reject invalid string amount', () => {
            const dataWithInvalidAmount = {
                ...validCreateData,
                amount: 'invalid-amount'
            };
            expect(() => CreateCreditNoteHTTPSchema.parse(dataWithInvalidAmount)).toThrow();
        });

        it('should reject invalid string date', () => {
            const dataWithInvalidDate = {
                ...validCreateData,
                issueDate: 'invalid-date'
            };
            expect(() => CreateCreditNoteHTTPSchema.parse(dataWithInvalidDate)).toThrow();
        });

        it('should reject negative string amount', () => {
            const dataWithNegativeAmount = {
                ...validCreateData,
                amount: '-10.00'
            };
            expect(() => CreateCreditNoteHTTPSchema.parse(dataWithNegativeAmount)).toThrow();
        });

        it('should reject zero string amount', () => {
            const dataWithZeroAmount = {
                ...validCreateData,
                amount: '0'
            };
            expect(() => CreateCreditNoteHTTPSchema.parse(dataWithZeroAmount)).toThrow();
        });
    });

    describe('UpdateCreditNoteHTTPSchema', () => {
        it('should validate empty update data', () => {
            expect(() => UpdateCreditNoteHTTPSchema.parse({})).not.toThrow();
        });

        it('should convert string amount to number', () => {
            const updateData = { amount: '75.00' };
            const result = UpdateCreditNoteHTTPSchema.parse(updateData);
            expect(result.amount).toBe(75.0);
            expect(typeof result.amount).toBe('number');
        });

        it('should convert string date to Date object', () => {
            const updateData = { issueDate: '2024-01-20T00:00:00Z' };
            const result = UpdateCreditNoteHTTPSchema.parse(updateData);
            expect(result.issueDate).toBeInstanceOf(Date);
        });

        it('should reject invalid string amount', () => {
            const updateData = { amount: 'invalid' };
            expect(() => UpdateCreditNoteHTTPSchema.parse(updateData)).toThrow();
        });
    });

    describe('CreditNoteQueryHTTPSchema', () => {
        it('should validate empty query', () => {
            expect(() => CreditNoteQueryHTTPSchema.parse({})).not.toThrow();
        });

        it('should convert string boolean to boolean', () => {
            const query = { isApplied: 'true' };
            const result = CreditNoteQueryHTTPSchema.parse(query);
            expect(result.isApplied).toBe(true);
            expect(typeof result.isApplied).toBe('boolean');
        });

        it('should convert "false" string to false boolean', () => {
            const query = { isApplied: 'false' };
            const result = CreditNoteQueryHTTPSchema.parse(query);
            expect(result.isApplied).toBe(false);
            expect(typeof result.isApplied).toBe('boolean');
        });

        it('should reject invalid boolean string', () => {
            const query = { isApplied: 'maybe' };
            expect(() => CreditNoteQueryHTTPSchema.parse(query)).toThrow();
        });

        it('should convert string amounts to numbers', () => {
            const query = {
                amountMin: '10.00',
                amountMax: '100.00'
            };
            const result = CreditNoteQueryHTTPSchema.parse(query);
            expect(result.amountMin).toBe(10.0);
            expect(result.amountMax).toBe(100.0);
        });

        it('should convert string dates to Date objects', () => {
            const query = {
                issueDateFrom: '2024-01-01T00:00:00Z',
                issueDateTo: '2024-12-31T23:59:59Z'
            };
            const result = CreditNoteQueryHTTPSchema.parse(query);
            expect(result.issueDateFrom).toBeInstanceOf(Date);
            expect(result.issueDateTo).toBeInstanceOf(Date);
        });

        it('should reject invalid amount range after conversion', () => {
            const query = {
                amountMin: '100.00',
                amountMax: '10.00'
            };
            expect(() => CreditNoteQueryHTTPSchema.parse(query)).toThrow();
        });

        it('should reject invalid date range after conversion', () => {
            const query = {
                issueDateFrom: '2024-12-31T00:00:00Z',
                issueDateTo: '2024-01-01T00:00:00Z'
            };
            expect(() => CreditNoteQueryHTTPSchema.parse(query)).toThrow();
        });

        it('should reject negative amount strings', () => {
            const query = { amountMin: '-10.00' };
            expect(() => CreditNoteQueryHTTPSchema.parse(query)).toThrow();
        });
    });
});
