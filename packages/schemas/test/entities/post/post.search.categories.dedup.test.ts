/**
 * De-duplication edge case for `PostSearchHttpSchema.categories` array-param
 * parsing (HOS-96 T-022).
 *
 * Complements `post.search.categories.test.ts` (T-003 — CSV parsing,
 * whitespace trim, empty-string-to-undefined, invalid-member rejection,
 * singular/array coexistence), which does not cover duplicate members.
 *
 * Per the resolved OQ-4 in the spec: `createArrayQueryParam` does NOT
 * de-duplicate. `?categories=CULTURE,CULTURE` parses to
 * `['CULTURE', 'CULTURE']` — de-dup is a FRONTEND concern (the href-builder
 * helper), not a backend/schema one. The duplicate is harmless downstream
 * because SQL `IN (CULTURE, CULTURE)` is equivalent to `IN (CULTURE)`, and
 * `packages/db/test/models/post.model.categories.test.ts` proves the real
 * model builds `inArray()` with whatever array it receives.
 */
import { describe, expect, it } from 'vitest';
import { PostSearchHttpSchema } from '../../../src/entities/post/post.http.schema.js';
import { PostSearchSchema } from '../../../src/entities/post/post.query.schema.js';

describe('PostSearchHttpSchema.categories — de-dup edge case (HOS-96 T-022)', () => {
    it('does NOT de-duplicate at the HTTP layer: ?categories=CULTURE,CULTURE parses to [CULTURE, CULTURE]', () => {
        const result = PostSearchHttpSchema.safeParse({ categories: 'CULTURE,CULTURE' });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.categories).toEqual(['CULTURE', 'CULTURE']);
        }
    });

    it('does NOT de-duplicate at the domain layer: categories: [CULTURE, CULTURE] round-trips unchanged', () => {
        const result = PostSearchSchema.safeParse({ categories: ['CULTURE', 'CULTURE'] });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.categories).toEqual(['CULTURE', 'CULTURE']);
        }
    });

    it('duplicate members with distinct valid values still all pass through', () => {
        const result = PostSearchHttpSchema.safeParse({
            categories: 'CULTURE,GASTRONOMY,CULTURE,GASTRONOMY'
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.categories).toEqual([
                'CULTURE',
                'GASTRONOMY',
                'CULTURE',
                'GASTRONOMY'
            ]);
        }
    });
});
