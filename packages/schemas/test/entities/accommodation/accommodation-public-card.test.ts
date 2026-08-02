/**
 * `AccommodationPublicCardSchema` — the nested-embed tier.
 *
 * Two real production leaks are closed by this schema and by nothing else:
 * `/api/v1/public/posts*` (via `PostPublicSchema.relatedAccommodation`) and
 * `/api/v1/public/owner-promotions/:id` (via `OwnerPromotionPublicSchema.accommodation`)
 * both eager-load the joined accommodation with no column allowlist, and the
 * entitlement helpers that gate the premium fields only ever run on a FLAT,
 * top-level accommodation — never on one nested inside another entity.
 *
 * So the omission IS the gate here. Without these tests, reverting any of the three
 * `.omit()` swaps — or a later `.extend()` re-adding the fields — is invisible to CI.
 */

import { describe, expect, it } from 'vitest';
import { AccommodationPublicCardSchema } from '../../../src/entities/accommodation/accommodation.access.schema.js';
import { AccommodationReviewPublicSchema } from '../../../src/entities/accommodationReview/accommodationReview.access.schema.js';
import { OwnerPromotionPublicSchema } from '../../../src/entities/ownerPromotion/owner-promotion.access.schema.js';
import { PostPublicSchema } from '../../../src/entities/post/post.access.schema.js';

/** A nested accommodation carrying BOTH premium fields, as the DB row would. */
const NESTED_WITH_PREMIUM = {
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'premium-lodge',
    name: 'Premium Lodge',
    type: 'CABIN',
    summary: 'A very nice lodge',
    description: 'Plain description text',
    destinationId: '22222222-2222-4222-8222-222222222222',
    isFeatured: false,
    isVerified: false,
    visibility: 'PUBLIC',
    richDescription: '## Premium\n\n**must not survive**',
    richDescriptionI18n: {
        es: '## Premium ES',
        en: '## Premium EN',
        pt: '## Premium PT'
    }
};

describe('AccommodationPublicCardSchema', () => {
    it('does NOT declare either premium rich-description field', () => {
        const keys = Object.keys(AccommodationPublicCardSchema.shape);
        expect(keys).not.toContain('richDescription');
        expect(keys).not.toContain('richDescriptionI18n');
    });

    it('still declares the card fields consumers actually read', () => {
        // Non-vacuity: without this, the assertions above would also pass on an empty
        // or wrongly-narrowed schema. The web renders these five from the nested embed.
        const keys = Object.keys(AccommodationPublicCardSchema.shape);
        for (const field of ['id', 'name', 'slug', 'summary', 'media']) {
            expect(keys).toContain(field);
        }
    });

    it('strips both premium fields off an input that carries them', () => {
        const parsed = AccommodationPublicCardSchema.parse(NESTED_WITH_PREMIUM);
        expect('richDescription' in parsed).toBe(false);
        expect('richDescriptionI18n' in parsed).toBe(false);
        expect(parsed.name).toBe('Premium Lodge');
    });
});

describe('nested embeds use the card tier, not the full public schema', () => {
    it.each([
        ['PostPublicSchema.relatedAccommodation', PostPublicSchema, 'relatedAccommodation'],
        ['OwnerPromotionPublicSchema.accommodation', OwnerPromotionPublicSchema, 'accommodation'],
        [
            'AccommodationReviewPublicSchema.accommodation',
            AccommodationReviewPublicSchema,
            'accommodation'
        ]
    ])('%s drops both premium fields when parsing', (_label, schema, field) => {
        // Parsing the PARENT, not the card schema directly: what must hold is that the
        // premium fields cannot reach the wire through this relation. Asserting on the
        // card schema alone would not catch a parent that was never switched over.
        const shape = (schema as { shape: Record<string, unknown> }).shape;
        expect(Object.keys(shape)).toContain(field);

        const nestedSchema = shape[field] as {
            parse: (input: unknown) => Record<string, unknown>;
        };
        const parsed = nestedSchema.parse(NESTED_WITH_PREMIUM);

        expect('richDescription' in parsed).toBe(false);
        expect('richDescriptionI18n' in parsed).toBe(false);
        // The relation still carries something — an over-eager omit would pass above.
        expect(parsed.id).toBe(NESTED_WITH_PREMIUM.id);
    });
});
