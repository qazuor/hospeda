/**
 * Tests for the public-data-pull enrichment schema (HOS-66 T-021, G-10).
 *
 * This schema shapes a tightly-scoped draft-enrichment response: a small set of
 * public entities (accommodations + destinations only, per R-1) that the Custom
 * GPT can pull to enrich a social draft. `entityType` is constrained to an
 * explicit, deliberately-narrow enum — extend it deliberately, never
 * speculatively.
 *
 * @see packages/schemas/src/entities/social/social-public-data.http.schema.ts
 */
import { describe, expect, it } from 'vitest';
import {
    SocialPublicDataEntityTypeEnumSchema,
    SocialPublicDataItemSchema,
    SocialPublicDataResponseDataSchema
} from '../../../src/entities/social/social-public-data.http.schema.js';

function makeItem(overrides: Record<string, unknown> = {}) {
    return {
        entityType: 'ACCOMMODATION',
        id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        title: 'Cabaña del Río',
        slug: 'cabana-del-rio',
        summary: 'A riverside cabin with a private dock.',
        imageUrl: 'https://cdn.hospeda.com.ar/img/cabana.jpg',
        ...overrides
    };
}

describe('SocialPublicDataEntityTypeEnumSchema', () => {
    it('accepts ACCOMMODATION and DESTINATION', () => {
        expect(SocialPublicDataEntityTypeEnumSchema.safeParse('ACCOMMODATION').success).toBe(true);
        expect(SocialPublicDataEntityTypeEnumSchema.safeParse('DESTINATION').success).toBe(true);
    });

    it('rejects entity types outside the narrow scope (R-1 anti-scope-creep)', () => {
        // EVENT/POST/ATTRACTION exist elsewhere in the platform but are NOT in
        // this endpoint's scope — the enum must reject them.
        for (const bad of ['EVENT', 'POST', 'ATTRACTION', 'USER', 'accommodation', '']) {
            expect(SocialPublicDataEntityTypeEnumSchema.safeParse(bad).success).toBe(false);
        }
    });
});

describe('SocialPublicDataItemSchema', () => {
    it('validates a fully-populated item', () => {
        const result = SocialPublicDataItemSchema.safeParse(makeItem());
        expect(result.success).toBe(true);
    });

    it('allows summary and imageUrl to be null (not every entity has them)', () => {
        const result = SocialPublicDataItemSchema.safeParse(
            makeItem({ summary: null, imageUrl: null })
        );
        expect(result.success).toBe(true);
    });

    it('rejects an item whose entityType is out of scope', () => {
        const result = SocialPublicDataItemSchema.safeParse(makeItem({ entityType: 'EVENT' }));
        expect(result.success).toBe(false);
    });

    it('rejects a non-uuid id', () => {
        const result = SocialPublicDataItemSchema.safeParse(makeItem({ id: 'not-a-uuid' }));
        expect(result.success).toBe(false);
    });

    it('rejects a missing required title', () => {
        const { title, ...withoutTitle } = makeItem();
        void title;
        const result = SocialPublicDataItemSchema.safeParse(withoutTitle);
        expect(result.success).toBe(false);
    });

    it('rejects a non-url imageUrl when present', () => {
        const result = SocialPublicDataItemSchema.safeParse(makeItem({ imageUrl: 'not a url' }));
        expect(result.success).toBe(false);
    });
});

describe('SocialPublicDataResponseDataSchema', () => {
    it('validates a response with a mixed accommodation + destination item list', () => {
        const result = SocialPublicDataResponseDataSchema.safeParse({
            items: [
                makeItem(),
                makeItem({
                    entityType: 'DESTINATION',
                    id: 'ffffffff-1111-4222-8333-444444444444',
                    slug: 'concepcion-del-uruguay',
                    title: 'Concepción del Uruguay'
                })
            ]
        });
        expect(result.success).toBe(true);
    });

    it('validates an empty item list (graceful empty result)', () => {
        const result = SocialPublicDataResponseDataSchema.safeParse({ items: [] });
        expect(result.success).toBe(true);
    });

    it('rejects a response whose items contain an out-of-scope entity type', () => {
        const result = SocialPublicDataResponseDataSchema.safeParse({
            items: [makeItem({ entityType: 'POST' })]
        });
        expect(result.success).toBe(false);
    });
});
