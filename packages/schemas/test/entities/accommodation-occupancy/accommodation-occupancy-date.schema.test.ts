import { describe, expect, it } from 'vitest';
import { OccupancyDateSchema } from '../../../src/entities/accommodation-occupancy/accommodation-occupancy-date.schema.js';

/**
 * Unit tests for {@link OccupancyDateSchema} (HOS-43 Phase 1).
 *
 * Regression coverage: a shape-only `/^\d{4}-\d{2}-\d{2}$/` regex accepts
 * calendar-invalid dates like `2026-02-30` or `2026-13-01`, which then hit
 * Postgres and raise a raw 500 on insert into the native `date` column. This
 * schema layers a round-trip calendar-validity check on top of the shape
 * regex to reject those before they ever reach the DB.
 */
describe('OccupancyDateSchema', () => {
    describe('accepts calendar-valid dates', () => {
        it.each([
            ['2026-07-10', 'a normal mid-year date'],
            ['2026-01-01', 'the first day of the year'],
            ['2026-12-31', 'the last day of the year'],
            ['2024-02-29', 'a leap-year Feb 29th (2024 is a leap year)'],
            ['2026-04-30', 'the last day of a 30-day month']
        ])('accepts %s (%s)', (value) => {
            expect(OccupancyDateSchema.safeParse(value).success).toBe(true);
        });
    });

    describe('rejects calendar-invalid dates (shape-valid but not real dates)', () => {
        it.each([
            ['2026-02-30', 'February has no 30th'],
            ['2026-13-01', 'there is no month 13'],
            ['2026-00-10', 'there is no month 0'],
            ['2026-07-00', 'there is no day 0'],
            ['2026-07-32', 'July has no 32nd'],
            ['2025-02-29', '2025 is NOT a leap year — no Feb 29th']
        ])('rejects %s (%s)', (value) => {
            const result = OccupancyDateSchema.safeParse(value);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0]?.message).toBe(
                    'zodError.accommodationOccupancy.date.invalid'
                );
            }
        });
    });

    describe('rejects shape-invalid input', () => {
        it.each([
            ['2026/07/10', 'wrong separator'],
            ['26-07-10', 'two-digit year'],
            ['2026-7-10', 'unpadded month'],
            ['2026-07-1', 'unpadded day'],
            ['not-a-date', 'not a date at all'],
            ['', 'empty string']
        ])('rejects %s (%s)', (value) => {
            const result = OccupancyDateSchema.safeParse(value);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0]?.message).toBe(
                    'zodError.accommodationOccupancy.date.pattern'
                );
            }
        });
    });

    it('rejects non-string input', () => {
        const result = OccupancyDateSchema.safeParse(20_260_710);
        expect(result.success).toBe(false);
    });
});
