import { describe, expect, it } from 'vitest';
import { AccommodationOccupancyEventUpdateSchema } from '../../../src/entities/accommodation-occupancy/accommodation-occupancy.crud.schema.js';

/**
 * Unit tests for {@link AccommodationOccupancyEventUpdateSchema} (HOS-175
 * Phase 3 — atomic manual event edit endpoint).
 *
 * IMPORTANT: this schema's `.refine()` checks are NOT currently enforced by
 * the API route layer (`apps/api`'s `route-factory.ts` + `openapi-schema.ts`
 * silently drop a top-level `z.object().refine()` under Zod v4 — see the long
 * comment on `updateOccupancyEvent` in
 * `packages/service-core/src/services/accommodation/accommodation.occupancy.ts`
 * for the full root cause). This file exercises the schema directly via
 * `.safeParse()`, which DOES run the refine checks correctly — it documents
 * the schema's intended contract and protects any future/direct consumer
 * (e.g. client-side pre-validation) that calls `.safeParse()`/`.parse()`
 * itself rather than going through the HTTP route.
 */
describe('AccommodationOccupancyEventUpdateSchema', () => {
    const validInput = {
        oldStartDate: '2026-07-10',
        oldEndDate: '2026-07-12',
        newStartDate: '2026-07-11',
        newEndDate: '2026-07-13',
        note: 'moved event'
    };

    it('accepts a fully valid input', () => {
        expect(AccommodationOccupancyEventUpdateSchema.safeParse(validInput).success).toBe(true);
    });

    it('accepts a single-day event where start === end for either range', () => {
        const result = AccommodationOccupancyEventUpdateSchema.safeParse({
            oldStartDate: '2026-07-10',
            oldEndDate: '2026-07-10',
            newStartDate: '2026-07-11',
            newEndDate: '2026-07-11'
        });
        expect(result.success).toBe(true);
    });

    it('accepts an omitted note', () => {
        const { note: _note, ...withoutNote } = validInput;
        expect(AccommodationOccupancyEventUpdateSchema.safeParse(withoutNote).success).toBe(true);
    });

    it('accepts a null note', () => {
        const result = AccommodationOccupancyEventUpdateSchema.safeParse({
            ...validInput,
            note: null
        });
        expect(result.success).toBe(true);
    });

    it('rejects a shape-invalid date', () => {
        const result = AccommodationOccupancyEventUpdateSchema.safeParse({
            ...validInput,
            oldStartDate: 'not-a-date'
        });
        expect(result.success).toBe(false);
    });

    it('rejects a calendar-invalid date', () => {
        const result = AccommodationOccupancyEventUpdateSchema.safeParse({
            ...validInput,
            newEndDate: '2026-02-30'
        });
        expect(result.success).toBe(false);
    });

    it('rejects oldStartDate after oldEndDate', () => {
        const result = AccommodationOccupancyEventUpdateSchema.safeParse({
            ...validInput,
            oldStartDate: '2026-07-15',
            oldEndDate: '2026-07-10'
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0]?.message).toBe(
                'zodError.accommodationOccupancy.eventUpdate.oldRange.invalid'
            );
            expect(result.error.issues[0]?.path).toEqual(['oldEndDate']);
        }
    });

    it('rejects newStartDate after newEndDate', () => {
        const result = AccommodationOccupancyEventUpdateSchema.safeParse({
            ...validInput,
            newStartDate: '2026-07-20',
            newEndDate: '2026-07-11'
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0]?.message).toBe(
                'zodError.accommodationOccupancy.eventUpdate.newRange.invalid'
            );
            expect(result.error.issues[0]?.path).toEqual(['newEndDate']);
        }
    });

    it('accepts a new range spanning exactly 366 days', () => {
        const result = AccommodationOccupancyEventUpdateSchema.safeParse({
            ...validInput,
            newStartDate: '2026-01-01',
            newEndDate: '2027-01-01'
        });
        expect(result.success).toBe(true);
    });

    it('rejects a new range spanning more than 366 days', () => {
        const result = AccommodationOccupancyEventUpdateSchema.safeParse({
            ...validInput,
            newStartDate: '2026-01-01',
            newEndDate: '2027-01-02'
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(
                result.error.issues.some(
                    (issue) =>
                        issue.message ===
                        'zodError.accommodationOccupancy.eventUpdate.newRange.tooLong'
                )
            ).toBe(true);
            expect(
                result.error.issues.find(
                    (issue) =>
                        issue.message ===
                        'zodError.accommodationOccupancy.eventUpdate.newRange.tooLong'
                )?.path
            ).toEqual(['newEndDate']);
        }
    });

    it('accepts an old range spanning exactly 366 days', () => {
        const result = AccommodationOccupancyEventUpdateSchema.safeParse({
            ...validInput,
            oldStartDate: '2026-01-01',
            oldEndDate: '2027-01-01'
        });
        expect(result.success).toBe(true);
    });

    it('rejects an old range spanning more than 366 days', () => {
        const result = AccommodationOccupancyEventUpdateSchema.safeParse({
            ...validInput,
            oldStartDate: '2026-01-01',
            oldEndDate: '2027-01-02'
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(
                result.error.issues.some(
                    (issue) =>
                        issue.message ===
                        'zodError.accommodationOccupancy.eventUpdate.oldRange.tooLong'
                )
            ).toBe(true);
            expect(
                result.error.issues.find(
                    (issue) =>
                        issue.message ===
                        'zodError.accommodationOccupancy.eventUpdate.oldRange.tooLong'
                )?.path
            ).toEqual(['oldEndDate']);
        }
    });

    it('rejects a note over 500 characters', () => {
        const result = AccommodationOccupancyEventUpdateSchema.safeParse({
            ...validInput,
            note: 'x'.repeat(501)
        });
        expect(result.success).toBe(false);
    });
});
