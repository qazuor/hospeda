/**
 * @file entityView.admin.schema.test.ts
 *
 * Unit tests for the SPEC-197 admin schemas:
 *   - AdminViewBatchQuerySchema
 *   - AdminViewTopQuerySchema
 *   - AdminViewDailySeriesItemSchema
 *   - AdminViewSummaryItemSchema
 *   - AdminViewSummaryResponseSchema
 *   - AdminViewDailySeriesResponseSchema
 */

import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    AdminViewBatchQuerySchema,
    AdminViewDailySeriesItemSchema,
    AdminViewDailySeriesResponseSchema,
    AdminViewSummaryItemSchema,
    AdminViewSummaryResponseSchema,
    AdminViewTopQuerySchema
} from '../entityView.admin.schema.js';

// ============================================================================
// Fixtures
// ============================================================================

const VALID_UUID_1 = '550e8400-e29b-41d4-a716-446655440001';
const VALID_UUID_2 = '550e8400-e29b-41d4-a716-446655440002';

/** Build a comma-separated UUID string with N entries. */
function buildUuidList(count: number): string {
    return Array.from(
        { length: count },
        (_, i) => `550e8400-e29b-41d4-a716-4466554${String(i).padStart(5, '0')}`
    ).join(',');
}

// ============================================================================
// AdminViewBatchQuerySchema
// ============================================================================

describe('AdminViewBatchQuerySchema', () => {
    describe('when given valid input', () => {
        it('should accept a comma-separated string of two valid UUIDs', () => {
            // Arrange
            const input = {
                entityType: 'ACCOMMODATION',
                entityIds: `${VALID_UUID_1},${VALID_UUID_2}`
            };

            // Act
            const result = AdminViewBatchQuerySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.entityIds).toEqual([VALID_UUID_1, VALID_UUID_2]);
                expect(result.data.window).toBe('30d'); // default
            }
        });

        it('should accept a single UUID', () => {
            // Arrange
            const input = { entityType: 'POST', entityIds: VALID_UUID_1 };

            // Act
            const result = AdminViewBatchQuerySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.entityIds).toEqual([VALID_UUID_1]);
            }
        });

        it('should accept exactly 100 UUIDs', () => {
            // Arrange
            const input = {
                entityType: 'EVENT',
                entityIds: buildUuidList(100)
            };

            // Act
            const result = AdminViewBatchQuerySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.entityIds).toHaveLength(100);
            }
        });

        it('should respect explicit window param', () => {
            // Arrange
            const input = {
                entityType: 'ACCOMMODATION',
                entityIds: VALID_UUID_1,
                window: '7d'
            };

            // Act
            const result = AdminViewBatchQuerySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.window).toBe('7d');
            }
        });
    });

    describe('when entityIds is empty string', () => {
        it('should reject an empty string', () => {
            // Arrange
            const input = { entityType: 'ACCOMMODATION', entityIds: '' };

            // Act
            const result = AdminViewBatchQuerySchema.safeParse(input);

            // Assert — empty string splits to [''] which is an invalid UUID
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });
    });

    describe('when entityIds exceeds the 100-item limit', () => {
        it('should reject 101 UUIDs', () => {
            // Arrange
            const input = {
                entityType: 'POST',
                entityIds: buildUuidList(101)
            };

            // Act
            const result = AdminViewBatchQuerySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                const flat = result.error.flatten();
                // The error lands on the entityIds field
                expect(Object.keys(flat.fieldErrors)).toContain('entityIds');
            }
        });
    });

    describe('when entityIds contains an invalid UUID', () => {
        it('should reject a non-UUID value in the list', () => {
            // Arrange
            const input = {
                entityType: 'EVENT',
                entityIds: `${VALID_UUID_1},not-a-uuid`
            };

            // Act
            const result = AdminViewBatchQuerySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject a list where all items are invalid UUIDs', () => {
            // Arrange
            const input = { entityType: 'ACCOMMODATION', entityIds: 'abc,def,ghi' };

            // Act
            const result = AdminViewBatchQuerySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('when entityType is invalid', () => {
        it('should reject a non-trackable entity type', () => {
            // Arrange
            const input = { entityType: 'DESTINATION', entityIds: VALID_UUID_1 };

            // Act
            const result = AdminViewBatchQuerySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// AdminViewTopQuerySchema
// ============================================================================

describe('AdminViewTopQuerySchema', () => {
    describe('when given valid input', () => {
        it('should default limit to 10 when omitted', () => {
            // Arrange
            const input = { entityType: 'ACCOMMODATION' };

            // Act
            const result = AdminViewTopQuerySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.limit).toBe(10);
                expect(result.data.window).toBe('30d');
            }
        });

        it('should accept limit=1 (minimum boundary)', () => {
            // Arrange
            const input = { entityType: 'POST', limit: '1' };

            // Act
            const result = AdminViewTopQuerySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.limit).toBe(1);
            }
        });

        it('should accept limit=50 (maximum boundary)', () => {
            // Arrange
            const input = { entityType: 'EVENT', limit: '50' };

            // Act
            const result = AdminViewTopQuerySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.limit).toBe(50);
            }
        });

        it('should coerce string limit to number', () => {
            // Arrange
            const input = { entityType: 'ACCOMMODATION', limit: '25' };

            // Act
            const result = AdminViewTopQuerySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(typeof result.data.limit).toBe('number');
                expect(result.data.limit).toBe(25);
            }
        });
    });

    describe('when limit is out of range', () => {
        it('should reject limit=0', () => {
            // Arrange
            const input = { entityType: 'ACCOMMODATION', limit: '0' };

            // Act
            const result = AdminViewTopQuerySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject limit=51', () => {
            // Arrange
            const input = { entityType: 'POST', limit: '51' };

            // Act
            const result = AdminViewTopQuerySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject a negative limit', () => {
            // Arrange
            const input = { entityType: 'EVENT', limit: '-1' };

            // Act
            const result = AdminViewTopQuerySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('when entityType is missing', () => {
        it('should reject when entityType is absent', () => {
            // Arrange
            const input = { limit: '10' };

            // Act
            const result = AdminViewTopQuerySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// AdminViewDailySeriesItemSchema
// ============================================================================

describe('AdminViewDailySeriesItemSchema', () => {
    describe('when given a valid date string', () => {
        it("should accept '2026-06-05' (YYYY-MM-DD format)", () => {
            // Arrange
            const input = { date: '2026-06-05', entityType: 'ACCOMMODATION', total: 12 };

            // Act
            const result = AdminViewDailySeriesItemSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.date).toBe('2026-06-05');
            }
        });

        it("should accept '2026-01-01' (first day of year)", () => {
            const result = AdminViewDailySeriesItemSchema.safeParse({
                date: '2026-01-01',
                entityType: 'POST',
                total: 0
            });
            expect(result.success).toBe(true);
        });

        it("should accept '2026-12-31' (last day of year)", () => {
            const result = AdminViewDailySeriesItemSchema.safeParse({
                date: '2026-12-31',
                entityType: 'EVENT',
                total: 5
            });
            expect(result.success).toBe(true);
        });
    });

    describe('when given an invalid date string format', () => {
        it("should reject '2026/06/05' (wrong separator)", () => {
            // Arrange
            const input = { date: '2026/06/05', entityType: 'ACCOMMODATION', total: 3 };

            // Act
            const result = AdminViewDailySeriesItemSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it("should reject '06-05-2026' (DD-MM-YYYY order)", () => {
            const result = AdminViewDailySeriesItemSchema.safeParse({
                date: '06-05-2026',
                entityType: 'POST',
                total: 1
            });
            expect(result.success).toBe(false);
        });

        it("should reject '2026-6-5' (no zero-padding)", () => {
            const result = AdminViewDailySeriesItemSchema.safeParse({
                date: '2026-6-5',
                entityType: 'EVENT',
                total: 2
            });
            expect(result.success).toBe(false);
        });

        it('should reject an empty date string', () => {
            const result = AdminViewDailySeriesItemSchema.safeParse({
                date: '',
                entityType: 'ACCOMMODATION',
                total: 0
            });
            expect(result.success).toBe(false);
        });

        it("should reject a plain timestamp string '2026-06-05T10:00:00Z'", () => {
            const result = AdminViewDailySeriesItemSchema.safeParse({
                date: '2026-06-05T10:00:00Z',
                entityType: 'POST',
                total: 0
            });
            expect(result.success).toBe(false);
        });
    });

    describe('when total is invalid', () => {
        it('should reject a negative total', () => {
            const result = AdminViewDailySeriesItemSchema.safeParse({
                date: '2026-06-05',
                entityType: 'ACCOMMODATION',
                total: -1
            });
            expect(result.success).toBe(false);
        });

        it('should accept total=0 (zero-filled gap)', () => {
            const result = AdminViewDailySeriesItemSchema.safeParse({
                date: '2026-06-05',
                entityType: 'POST',
                total: 0
            });
            expect(result.success).toBe(true);
        });
    });
});

// ============================================================================
// AdminViewSummaryItemSchema
// ============================================================================

describe('AdminViewSummaryItemSchema', () => {
    it('should accept valid summary item with all three entity types', () => {
        for (const entityType of ['ACCOMMODATION', 'POST', 'EVENT'] as const) {
            const result = AdminViewSummaryItemSchema.safeParse({
                entityType,
                unique: 10,
                total: 30
            });
            expect(result.success).toBe(true);
        }
    });

    it('should accept zero unique and total', () => {
        const result = AdminViewSummaryItemSchema.safeParse({
            entityType: 'ACCOMMODATION',
            unique: 0,
            total: 0
        });
        expect(result.success).toBe(true);
    });

    it('should reject negative unique', () => {
        const result = AdminViewSummaryItemSchema.safeParse({
            entityType: 'POST',
            unique: -1,
            total: 10
        });
        expect(result.success).toBe(false);
    });

    it('should reject non-integer total', () => {
        const result = AdminViewSummaryItemSchema.safeParse({
            entityType: 'EVENT',
            unique: 5,
            total: 9.9
        });
        expect(result.success).toBe(false);
    });
});

// ============================================================================
// AdminViewSummaryResponseSchema
// ============================================================================

describe('AdminViewSummaryResponseSchema', () => {
    it('should accept a valid three-item summary array', () => {
        // Arrange
        const input = {
            data: [
                { entityType: 'ACCOMMODATION', unique: 120, total: 340 },
                { entityType: 'POST', unique: 55, total: 110 },
                { entityType: 'EVENT', unique: 30, total: 60 }
            ]
        };

        // Act
        const result = AdminViewSummaryResponseSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should accept an empty data array', () => {
        const result = AdminViewSummaryResponseSchema.safeParse({ data: [] });
        expect(result.success).toBe(true);
    });

    it('should reject when data is absent', () => {
        const result = AdminViewSummaryResponseSchema.safeParse({});
        expect(result.success).toBe(false);
    });

    it('should reject when any item has an invalid field', () => {
        const result = AdminViewSummaryResponseSchema.safeParse({
            data: [{ entityType: 'ACCOMMODATION', unique: -1, total: 10 }]
        });
        expect(result.success).toBe(false);
    });
});

// ============================================================================
// AdminViewDailySeriesResponseSchema
// ============================================================================

describe('AdminViewDailySeriesResponseSchema', () => {
    it('should accept a valid response with multiple items', () => {
        // Arrange
        const input = {
            data: [
                { date: '2026-05-10', entityType: 'ACCOMMODATION', total: 5 },
                { date: '2026-05-10', entityType: 'POST', total: 3 },
                { date: '2026-05-10', entityType: 'EVENT', total: 1 }
            ]
        };

        // Act
        const result = AdminViewDailySeriesResponseSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should accept an empty data array', () => {
        const result = AdminViewDailySeriesResponseSchema.safeParse({ data: [] });
        expect(result.success).toBe(true);
    });

    it('should reject when any item has an invalid date', () => {
        const result = AdminViewDailySeriesResponseSchema.safeParse({
            data: [{ date: '2026/05/10', entityType: 'ACCOMMODATION', total: 5 }]
        });
        expect(result.success).toBe(false);
    });

    it('should reject when data is absent', () => {
        const result = AdminViewDailySeriesResponseSchema.safeParse({});
        expect(result.success).toBe(false);
    });
});
