/**
 * Schema compatibility test for `common/seo.schema.ts`.
 *
 * Enforces the additive-only schema compatibility policy documented in
 * `packages/schemas/docs/guides/schema-compat-policy.md`: every historic
 * shape captured under `test/fixtures/historic/seo.historic.ts` MUST
 * still `safeParse` successfully against the current `SeoSchema`.
 *
 * SPEC-267 removed `keywords` from `SeoSchema`. The `.strip()` mechanism
 * ensures legacy payloads that still carry `keywords` parse without error —
 * the key is silently dropped.
 *
 * If a change causes any of these assertions to fail, that change is
 * BREAKING and must be reverted or follow the three-phase migration path.
 */
import { describe, expect, it } from 'vitest';
import { SeoSchema } from '../../src/common/seo.schema.js';
import {
    seoPostSpec267Full,
    seoPostSpec267TitleOnly,
    seoPreSpec267KeywordsOnly,
    seoPreSpec267WithKeywords
} from '../fixtures/historic/seo.historic.js';

describe('seo.schema compat — historic fixtures still parse', () => {
    it('accepts pre-SPEC-267 payload with keywords (strip drops it silently)', () => {
        const result = SeoSchema.safeParse(seoPreSpec267WithKeywords);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).not.toHaveProperty('keywords');
        }
    });

    it('accepts pre-SPEC-267 keywords-only payload (all fields optional)', () => {
        const result = SeoSchema.safeParse(seoPreSpec267KeywordsOnly);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).not.toHaveProperty('keywords');
        }
    });

    it('accepts post-SPEC-267 title-only payload', () => {
        const result = SeoSchema.safeParse(seoPostSpec267TitleOnly);
        expect(result.success).toBe(true);
    });

    it('accepts post-SPEC-267 full payload', () => {
        const result = SeoSchema.safeParse(seoPostSpec267Full);
        expect(result.success).toBe(true);
    });

    it('accepts empty object (all fields are optional)', () => {
        const result = SeoSchema.safeParse({});
        expect(result.success).toBe(true);
    });
});
