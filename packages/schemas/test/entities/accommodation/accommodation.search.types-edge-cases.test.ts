/**
 * Edge-case matrix for `AccommodationSearchHttpSchema.types` array-param
 * parsing (HOS-96 T-022).
 *
 * Accommodation `types` is the pre-existing blueprint (`createArrayQueryParam`
 * without an enum `.pipe()` — see `accommodation.http.schema.ts`). This file
 * pins its ACTUAL parsing behavior at the schema layer, matching the same
 * matrix already covered for events/posts `categories` in
 * `event.search.categories.dedup.test.ts` / `post.search.categories.dedup.test.ts`,
 * plus the accommodation-specific nuance: no enum-pipe means an invalid
 * member is NOT rejected here (unlike `categories`).
 *
 * Per the resolved OQ-4 in the spec: `createArrayQueryParam` does NOT
 * de-duplicate. `?types=HOTEL,HOTEL` parses to `['HOTEL', 'HOTEL']` — de-dup
 * is a FRONTEND concern (the href-builder helper), not a backend/schema one.
 * The duplicate is harmless downstream because SQL `IN (HOTEL, HOTEL)` is
 * equivalent to `IN (HOTEL)`.
 */
import { describe, expect, it } from 'vitest';
import { AccommodationSearchHttpSchema } from '../../../src/entities/accommodation/accommodation.http.schema.js';

describe('AccommodationSearchHttpSchema.types — edge cases (HOS-96 T-022)', () => {
    it('does NOT de-duplicate: ?types=HOTEL,HOTEL parses to [HOTEL, HOTEL]', () => {
        const result = AccommodationSearchHttpSchema.safeParse({ types: 'HOTEL,HOTEL' });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.types).toEqual(['HOTEL', 'HOTEL']);
        }
    });

    it('trims whitespace and filters empty CSV segments: " HOTEL , CABIN "', () => {
        const result = AccommodationSearchHttpSchema.safeParse({ types: ' HOTEL , CABIN ' });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.types).toEqual(['HOTEL', 'CABIN']);
        }
    });

    it('resolves an empty string to `undefined` (unfiltered, US-11)', () => {
        const result = AccommodationSearchHttpSchema.safeParse({ types: '' });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.types).toBeUndefined();
        }
    });

    it('is optional — omitting types passes', () => {
        const result = AccommodationSearchHttpSchema.safeParse({});

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.types).toBeUndefined();
        }
    });

    it('does NOT reject an invalid member (pre-existing gap, unlike events/posts categories)', () => {
        // Unlike EventSearchHttpSchema.categories / PostSearchHttpSchema.categories
        // (which pipe through z.array(enum) and reject invalid members with a
        // Zod error), AccommodationSearchHttpSchema.types has no such pipe —
        // it accepts any non-empty string. This is a pre-existing blueprint
        // characteristic, documented here rather than "fixed" (out of scope).
        const result = AccommodationSearchHttpSchema.safeParse({
            types: 'HOTEL,NOT_A_REAL_TYPE'
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.types).toEqual(['HOTEL', 'NOT_A_REAL_TYPE']);
        }
    });

    it('keeps accepting the singular `type` enum alone (US-10)', () => {
        const result = AccommodationSearchHttpSchema.safeParse({ type: 'HOTEL' });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.type).toBe('HOTEL');
        }
    });

    it('accepts both `type` and `types` at the HTTP layer', () => {
        const result = AccommodationSearchHttpSchema.safeParse({
            type: 'HOTEL',
            types: 'CABIN,APARTMENT'
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.type).toBe('HOTEL');
            expect(result.data.types).toEqual(['CABIN', 'APARTMENT']);
        }
    });
});
