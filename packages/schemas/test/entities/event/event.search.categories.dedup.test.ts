/**
 * De-duplication edge case for `EventSearchHttpSchema.categories` array-param
 * parsing (HOS-96 T-022).
 *
 * Complements `event.search.categories.test.ts` (T-002 — CSV parsing,
 * whitespace trim, empty-string-to-undefined, invalid-member rejection,
 * singular/array coexistence), which does not cover duplicate members.
 *
 * Per the resolved OQ-4 in the spec: `createArrayQueryParam` does NOT
 * de-duplicate. `?categories=MUSIC,MUSIC` parses to `['MUSIC', 'MUSIC']` —
 * de-dup is a FRONTEND concern (the href-builder helper), not a backend/
 * schema one. The duplicate is harmless downstream because SQL
 * `IN (MUSIC, MUSIC)` is equivalent to `IN (MUSIC)`, and
 * `packages/db/test/models/event.model.categories.test.ts` proves the real
 * model builds `inArray()` with whatever array it receives.
 */
import { describe, expect, it } from 'vitest';
import { EventSearchHttpSchema } from '../../../src/entities/event/event.http.schema.js';
import { EventSearchSchema } from '../../../src/entities/event/event.query.schema.js';

describe('EventSearchHttpSchema.categories — de-dup edge case (HOS-96 T-022)', () => {
    it('does NOT de-duplicate at the HTTP layer: ?categories=MUSIC,MUSIC parses to [MUSIC, MUSIC]', () => {
        const result = EventSearchHttpSchema.safeParse({ categories: 'MUSIC,MUSIC' });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.categories).toEqual(['MUSIC', 'MUSIC']);
        }
    });

    it('does NOT de-duplicate at the domain layer: categories: [MUSIC, MUSIC] round-trips unchanged', () => {
        const result = EventSearchSchema.safeParse({ categories: ['MUSIC', 'MUSIC'] });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.categories).toEqual(['MUSIC', 'MUSIC']);
        }
    });

    it('duplicate members with distinct valid values still all pass through', () => {
        const result = EventSearchHttpSchema.safeParse({
            categories: 'MUSIC,CULTURE,MUSIC,CULTURE'
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.categories).toEqual(['MUSIC', 'CULTURE', 'MUSIC', 'CULTURE']);
        }
    });
});
