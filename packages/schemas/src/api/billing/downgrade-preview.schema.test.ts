/**
 * Unit tests for the downgrade-preview `cap` primitive (HOS-212).
 *
 * The downgrade-excess service uses `-1` as the "unlimited / no cap" sentinel.
 * The response schema must accept it (otherwise the fail-closed strip turns a
 * valid preview into an HTTP 500), while still rejecting any other negative
 * value.
 *
 * @module test/api/billing/downgrade-preview.schema
 */

import { describe, expect, it } from 'vitest';
import { AccommodationExcessSchema, PromotionExcessSchema } from './downgrade-preview.schema';

const baseAccommodationExcess = {
    activeCount: 0,
    excessCount: 0,
    items: []
};

const basePromotionExcess = {
    activeCount: 0,
    excessCount: 0,
    items: []
};

describe('downgrade-preview cap sentinel (HOS-212)', () => {
    describe('AccommodationExcessSchema.cap', () => {
        it.each([-1, 0, 1, 50])('accepts cap = %i', (cap) => {
            const result = AccommodationExcessSchema.safeParse({
                ...baseAccommodationExcess,
                cap
            });
            expect(result.success).toBe(true);
        });

        it.each([-2, -100])('rejects invalid negative cap = %i', (cap) => {
            const result = AccommodationExcessSchema.safeParse({
                ...baseAccommodationExcess,
                cap
            });
            expect(result.success).toBe(false);
        });

        it('rejects a non-integer cap', () => {
            const result = AccommodationExcessSchema.safeParse({
                ...baseAccommodationExcess,
                cap: 1.5
            });
            expect(result.success).toBe(false);
        });
    });

    describe('PromotionExcessSchema.cap', () => {
        it('accepts the unlimited sentinel (-1)', () => {
            const result = PromotionExcessSchema.safeParse({
                ...basePromotionExcess,
                cap: -1
            });
            expect(result.success).toBe(true);
        });

        it('rejects -2', () => {
            const result = PromotionExcessSchema.safeParse({
                ...basePromotionExcess,
                cap: -2
            });
            expect(result.success).toBe(false);
        });
    });
});
