import { describe, expect, it } from 'vitest';
import { CreditNoteQuerySchema } from './query.schema.js';

describe('CreditNoteQuerySchema', () => {
    it('should validate empty query', () => {
        expect(() => CreditNoteQuerySchema.parse({})).not.toThrow();
    });

    it('should validate query with search text', () => {
        const query = { q: 'CN-2024' };
        expect(() => CreditNoteQuerySchema.parse(query)).not.toThrow();
    });

    it('should validate query with filters', () => {
        const query = {
            invoiceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
            currency: 'USD',
            isApplied: true
        };
        expect(() => CreditNoteQuerySchema.parse(query)).not.toThrow();
    });

    it('should validate amount range query', () => {
        const query = {
            amountMin: 10.0,
            amountMax: 100.0
        };
        expect(() => CreditNoteQuerySchema.parse(query)).not.toThrow();
    });

    it('should validate date range query', () => {
        const query = {
            issueDateFrom: new Date('2024-01-01'),
            issueDateTo: new Date('2024-12-31')
        };
        expect(() => CreditNoteQuerySchema.parse(query)).not.toThrow();
    });

    it('should validate applied date range query', () => {
        const query = {
            appliedAtFrom: new Date('2024-01-01'),
            appliedAtTo: new Date('2024-12-31')
        };
        expect(() => CreditNoteQuerySchema.parse(query)).not.toThrow();
    });

    it('should reject invalid amount range (min > max)', () => {
        const query = {
            amountMin: 100.0,
            amountMax: 10.0
        };
        expect(() => CreditNoteQuerySchema.parse(query)).toThrow();
    });

    it('should reject invalid issue date range (from > to)', () => {
        const query = {
            issueDateFrom: new Date('2024-12-31'),
            issueDateTo: new Date('2024-01-01')
        };
        expect(() => CreditNoteQuerySchema.parse(query)).toThrow();
    });

    it('should reject invalid applied date range (from > to)', () => {
        const query = {
            appliedAtFrom: new Date('2024-12-31'),
            appliedAtTo: new Date('2024-01-01')
        };
        expect(() => CreditNoteQuerySchema.parse(query)).toThrow();
    });

    it('should reject negative amount min', () => {
        const query = {
            amountMin: -10
        };
        expect(() => CreditNoteQuerySchema.parse(query)).toThrow();
    });

    it('should reject negative amount max', () => {
        const query = {
            amountMax: -10
        };
        expect(() => CreditNoteQuerySchema.parse(query)).toThrow();
    });

    it('should reject invalid UUID', () => {
        const query = {
            invoiceId: 'invalid-id'
        };
        expect(() => CreditNoteQuerySchema.parse(query)).toThrow();
    });

    it('should reject empty search text', () => {
        const query = { q: '' };
        expect(() => CreditNoteQuerySchema.parse(query)).toThrow();
    });
});
