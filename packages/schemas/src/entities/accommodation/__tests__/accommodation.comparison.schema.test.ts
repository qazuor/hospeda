import { describe, expect, it } from 'vitest';
import {
    AccommodationComparisonRequestSchema,
    AccommodationComparisonResponseSchema,
    MAX_COMPARE_REQUEST_IDS
} from '../accommodation.comparison.schema.js';

// ============================================================================
// Shared fixtures
// ============================================================================

const VALID_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const ANOTHER_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const THIRD_UUID = 'b2c3d4e5-f6a7-4890-9bcd-ef1234567890';
const FOURTH_UUID = 'c3d4e5f6-a7b8-4901-8cde-f12345678901';

/** Build an array of N distinct valid UUIDs. */
const buildUuids = (count: number): string[] =>
    Array.from({ length: count }, (_, i) => {
        // Vary the last hex group so each UUID is distinct but still valid.
        const tail = i.toString(16).padStart(12, '0');
        return `f47ac10b-58cc-4372-a567-${tail}`;
    });

// ============================================================================
// Request schema
// ============================================================================

describe('AccommodationComparisonRequestSchema', () => {
    describe('valid payloads', () => {
        it('accepts the minimum of 2 IDs', () => {
            const result = AccommodationComparisonRequestSchema.safeParse({
                ids: [VALID_UUID, ANOTHER_UUID]
            });
            expect(result.success).toBe(true);
        });

        it('accepts 4 IDs (the VIP cap)', () => {
            const result = AccommodationComparisonRequestSchema.safeParse({
                ids: [VALID_UUID, ANOTHER_UUID, THIRD_UUID, FOURTH_UUID]
            });
            expect(result.success).toBe(true);
        });

        it('accepts exactly the max ceiling', () => {
            const result = AccommodationComparisonRequestSchema.safeParse({
                ids: buildUuids(MAX_COMPARE_REQUEST_IDS)
            });
            expect(result.success).toBe(true);
        });
    });

    describe('invalid payloads', () => {
        it('rejects an empty ids array', () => {
            const result = AccommodationComparisonRequestSchema.safeParse({ ids: [] });
            expect(result.success).toBe(false);
        });

        it('rejects a single ID (too few to compare)', () => {
            const result = AccommodationComparisonRequestSchema.safeParse({ ids: [VALID_UUID] });
            expect(result.success).toBe(false);
        });

        it('rejects more IDs than the ceiling', () => {
            const result = AccommodationComparisonRequestSchema.safeParse({
                ids: buildUuids(MAX_COMPARE_REQUEST_IDS + 1)
            });
            expect(result.success).toBe(false);
        });

        it('rejects a non-UUID entry', () => {
            const result = AccommodationComparisonRequestSchema.safeParse({
                ids: [VALID_UUID, 'not-a-uuid']
            });
            expect(result.success).toBe(false);
        });

        it('rejects a missing ids field', () => {
            const result = AccommodationComparisonRequestSchema.safeParse({});
            expect(result.success).toBe(false);
        });

        it('rejects ids that is not an array', () => {
            const result = AccommodationComparisonRequestSchema.safeParse({ ids: VALID_UUID });
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// Response schema
// ============================================================================

describe('AccommodationComparisonResponseSchema', () => {
    it('accepts an empty items array (structural shape)', () => {
        const result = AccommodationComparisonResponseSchema.safeParse({ items: [] });
        expect(result.success).toBe(true);
    });

    it('rejects a non-array items field', () => {
        const result = AccommodationComparisonResponseSchema.safeParse({ items: 'nope' });
        expect(result.success).toBe(false);
    });

    it('rejects a missing items field', () => {
        const result = AccommodationComparisonResponseSchema.safeParse({});
        expect(result.success).toBe(false);
    });
});
