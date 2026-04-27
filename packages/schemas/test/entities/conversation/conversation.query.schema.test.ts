import { describe, expect, it } from 'vitest';
import {
    GuestInboxQuerySchema,
    ThreadQuerySchema
} from '../../../src/entities/conversation/conversation.query.schema.js';

// ============================================================================
// ThreadQuerySchema
// ============================================================================

describe('ThreadQuerySchema', () => {
    describe('when given valid input', () => {
        it('should parse an empty query (defaults apply)', () => {
            // Arrange & Act
            const result = ThreadQuerySchema.safeParse({});

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.limit).toBe(50);
                expect(result.data.cursor).toBeUndefined();
            }
        });

        it('should parse a valid cursor + limit', () => {
            const result = ThreadQuerySchema.safeParse({
                cursor: '2025-04-01T00:00:00.000Z',
                limit: 20
            });
            expect(result.success).toBe(true);
        });

        it('should coerce limit from a string', () => {
            const result = ThreadQuerySchema.safeParse({ limit: '30' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.limit).toBe(30);
            }
        });

        it('should accept limit = 1', () => {
            const result = ThreadQuerySchema.safeParse({ limit: 1 });
            expect(result.success).toBe(true);
        });

        it('should accept limit = 100', () => {
            const result = ThreadQuerySchema.safeParse({ limit: 100 });
            expect(result.success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject limit = 0', () => {
            const result = ThreadQuerySchema.safeParse({ limit: 0 });
            expect(result.success).toBe(false);
        });

        it('should reject limit = 101', () => {
            const result = ThreadQuerySchema.safeParse({ limit: 101 });
            expect(result.success).toBe(false);
        });

        it('should reject a non-ISO-8601 cursor', () => {
            const result = ThreadQuerySchema.safeParse({ cursor: 'yesterday' });
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// GuestInboxQuerySchema
// ============================================================================

describe('GuestInboxQuerySchema', () => {
    describe('when given valid input', () => {
        it('should parse an empty query (defaults apply)', () => {
            // Arrange & Act
            const result = GuestInboxQuerySchema.safeParse({});

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(1);
                expect(result.data.pageSize).toBe(20);
                expect(result.data.archivedByGuest).toBeUndefined();
            }
        });

        it('should parse with archivedByGuest=true', () => {
            const result = GuestInboxQuerySchema.safeParse({ archivedByGuest: true });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.archivedByGuest).toBe(true);
            }
        });

        it('should coerce archivedByGuest from string "true"', () => {
            const result = GuestInboxQuerySchema.safeParse({ archivedByGuest: 'true' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.archivedByGuest).toBe(true);
            }
        });

        it('should coerce page and pageSize from strings', () => {
            const result = GuestInboxQuerySchema.safeParse({ page: '2', pageSize: '10' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(2);
                expect(result.data.pageSize).toBe(10);
            }
        });

        it('should accept pageSize = 100', () => {
            const result = GuestInboxQuerySchema.safeParse({ pageSize: 100 });
            expect(result.success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject page = 0', () => {
            const result = GuestInboxQuerySchema.safeParse({ page: 0 });
            expect(result.success).toBe(false);
        });

        it('should reject pageSize = 101', () => {
            const result = GuestInboxQuerySchema.safeParse({ pageSize: 101 });
            expect(result.success).toBe(false);
        });

        it('should reject pageSize = 0', () => {
            const result = GuestInboxQuerySchema.safeParse({ pageSize: 0 });
            expect(result.success).toBe(false);
        });
    });
});
