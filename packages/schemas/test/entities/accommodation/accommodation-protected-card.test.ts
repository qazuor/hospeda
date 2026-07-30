/**
 * `AccommodationProtectedCardSchema` — the protected nested-embed tier (BETA-199).
 *
 * The protected twin of `accommodation-public-card.test.ts`, and it exists for the
 * same reason: the entitlement helpers that gate the premium rich-description pair
 * only ever run on a FLAT, top-level accommodation — never on one nested inside
 * another entity's payload, which the owning services eager-load with no column
 * allowlist. So for a relation, the omission IS the gate.
 *
 * The protected tier only became exposed to this when BETA-199 declared the pair on
 * `AccommodationProtectedSchema` for the owner's editor. Until then a nested embed
 * was safe by accident — parsing drops an undeclared key. `GET /protected/owner-
 * promotions` eager-loads `accommodation: true`, so without the card variant a
 * downgraded host would have received the full premium pair there, ungated.
 *
 * Every assertion parses the PARENT schema's relation rather than the card schema
 * directly. That is the whole point: it holds regardless of WHICH schema the parent
 * embeds, so swapping the relation to `AccommodationAdminSchema` — an identifier all
 * three files already import legitimately for their admin tier — fails here. A
 * name-based check cannot see that substitution.
 */

import { describe, expect, it } from 'vitest';
import { AccommodationProtectedCardSchema } from '../../../src/entities/accommodation/accommodation.access.schema.js';
import { AccommodationReviewProtectedSchema } from '../../../src/entities/accommodationReview/accommodationReview.access.schema.js';
import { OwnerPromotionProtectedSchema } from '../../../src/entities/ownerPromotion/owner-promotion.access.schema.js';
import { PostProtectedSchema } from '../../../src/entities/post/post.access.schema.js';

/** A nested accommodation carrying BOTH premium fields, as the DB row would. */
const NESTED_WITH_PREMIUM = {
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'premium-lodge',
    name: 'Premium Lodge',
    type: 'CABIN',
    summary: 'A very nice lodge',
    description: 'Plain description text',
    destinationId: '22222222-2222-4222-8222-222222222222',
    ownerId: '33333333-3333-4333-8333-333333333333',
    isFeatured: false,
    visibility: 'PUBLIC',
    lifecycleState: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    richDescription: '## Premium\n\n**must not survive**',
    richDescriptionI18n: {
        es: '## Premium ES',
        en: '## Premium EN',
        pt: '## Premium PT'
    }
};

describe('AccommodationProtectedCardSchema', () => {
    it('does NOT declare either premium rich-description field', () => {
        const keys = Object.keys(AccommodationProtectedCardSchema.shape);
        expect(keys).not.toContain('richDescription');
        expect(keys).not.toContain('richDescriptionI18n');
    });

    it('still declares the fields a nested consumer reads', () => {
        // Non-vacuity: without this, the assertions above would also pass on an
        // empty or wrongly-narrowed schema.
        const keys = Object.keys(AccommodationProtectedCardSchema.shape);
        for (const field of ['id', 'name', 'slug', 'summary', 'ownerId', 'media']) {
            expect(keys).toContain(field);
        }
    });

    it('strips both premium fields off an input that carries them', () => {
        const parsed = AccommodationProtectedCardSchema.parse(NESTED_WITH_PREMIUM);
        expect('richDescription' in parsed).toBe(false);
        expect('richDescriptionI18n' in parsed).toBe(false);
        expect(parsed.name).toBe('Premium Lodge');
    });
});

describe('protected nested embeds use the card tier, not a full accommodation schema', () => {
    it.each([
        [
            'OwnerPromotionProtectedSchema.accommodation',
            OwnerPromotionProtectedSchema,
            'accommodation'
        ],
        ['PostProtectedSchema.relatedAccommodation', PostProtectedSchema, 'relatedAccommodation'],
        [
            'AccommodationReviewProtectedSchema.accommodation',
            AccommodationReviewProtectedSchema,
            'accommodation'
        ]
    ])('%s drops both premium fields when parsing', (_label, schema, field) => {
        // Parsing the PARENT, not the card schema directly: what must hold is that
        // the premium pair cannot reach the wire through this relation, whatever
        // schema the parent happens to name. Asserting on the card schema alone
        // would not catch a parent that was never switched over — or one switched
        // to the admin tier, which carries the pair and is already imported here.
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
