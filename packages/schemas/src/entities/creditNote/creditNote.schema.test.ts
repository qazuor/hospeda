import { describe, expect, it } from 'vitest';
import { CreditNoteSchema } from './creditNote.schema.js';

describe('CreditNoteSchema', () => {
    const validCreditNoteData = {
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

    it('should validate a complete valid credit note', () => {
        expect(() => CreditNoteSchema.parse(validCreditNoteData)).not.toThrow();
    });

    it('should validate credit note with optional description', () => {
        const withDescription = {
            ...validCreditNoteData,
            description: 'Refund for overpayment'
        };
        expect(() => CreditNoteSchema.parse(withDescription)).not.toThrow();
    });

    it('should validate applied credit note', () => {
        const appliedCreditNote = {
            ...validCreditNoteData,
            isApplied: true,
            appliedAt: new Date('2024-01-16T00:00:00Z')
        };
        expect(() => CreditNoteSchema.parse(appliedCreditNote)).not.toThrow();
    });
});
