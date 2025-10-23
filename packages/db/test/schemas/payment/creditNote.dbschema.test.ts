import { describe, expect, it } from 'vitest';
import { creditNoteRelations, creditNotes } from '../../../src/schemas/payment/creditNote.dbschema';

describe('CREDIT_NOTE Database Schema', () => {
    describe('schema compilation', () => {
        it('should import creditNote schema without errors', () => {
            expect(creditNotes).toBeDefined();
            expect(typeof creditNotes).toBe('object');
        });

        it('should import creditNote relations without errors', () => {
            expect(creditNoteRelations).toBeDefined();
            expect(typeof creditNoteRelations).toBe('object');
        });

        it('should have valid table structure', () => {
            // The schema should be a valid Drizzle table object
            expect(creditNotes).toBeDefined();
            expect(typeof creditNotes).toBe('object');
            // Basic validation that it's a proper table definition
            expect(creditNotes).toHaveProperty('id');
        });

        it('should have expected columns for credit note', () => {
            expect(creditNotes).toHaveProperty('id');
            expect(creditNotes).toHaveProperty('amount');
            expect(creditNotes).toHaveProperty('currency');
            expect(creditNotes).toHaveProperty('reason');
            expect(creditNotes).toHaveProperty('issuedAt');
            expect(creditNotes).toHaveProperty('createdAt');
            expect(creditNotes).toHaveProperty('updatedAt');
            expect(creditNotes).toHaveProperty('createdById');
            expect(creditNotes).toHaveProperty('updatedById');
            expect(creditNotes).toHaveProperty('deletedAt');
            expect(creditNotes).toHaveProperty('deletedById');
            expect(creditNotes).toHaveProperty('adminInfo');
        });
    });
});
