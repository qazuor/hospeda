/**
 * Tests for deriveAltFromEntityName (HOS-382 accessibility fix).
 *
 * Covers the validation boundary that motivated this helper:
 * `GastronomyMediaAddPayloadSchema.alt` / the accommodation and experience
 * equivalents all enforce `.min(1).max(200)`. A wrong implementation here
 * would either send an invalid `alt` (400 on addMedia — worse than the
 * empty-alt bug being fixed) or silently drop a valid one.
 */

import { describe, expect, it } from 'vitest';
import { deriveAltFromEntityName } from '@/lib/utils/media-alt.utils';

describe('deriveAltFromEntityName', () => {
    it('returns the trimmed entity name when it is a valid non-empty string', () => {
        expect(deriveAltFromEntityName('Parador del Río')).toBe('Parador del Río');
        expect(deriveAltFromEntityName('  Parador del Río  ')).toBe('Parador del Río');
    });

    it('returns undefined when the entity name is undefined or null', () => {
        expect(deriveAltFromEntityName(undefined)).toBeUndefined();
        expect(deriveAltFromEntityName(null)).toBeUndefined();
    });

    it('returns undefined when the entity name is empty or whitespace-only', () => {
        expect(deriveAltFromEntityName('')).toBeUndefined();
        expect(deriveAltFromEntityName('   ')).toBeUndefined();
    });

    it('truncates to 200 chars instead of sending an over-limit alt (schema .max(200))', () => {
        const overLimitName = 'A'.repeat(250);
        const result = deriveAltFromEntityName(overLimitName);

        expect(result).toBeDefined();
        expect(result?.length).toBe(200);
        expect(result).toBe('A'.repeat(200));
    });

    it('passes a name exactly at the 200-char boundary through untouched', () => {
        const exactLimitName = 'B'.repeat(200);
        expect(deriveAltFromEntityName(exactLimitName)).toBe(exactLimitName);
    });

    it('accepts a single-character name (schema .min(1) boundary)', () => {
        expect(deriveAltFromEntityName('X')).toBe('X');
    });
});
