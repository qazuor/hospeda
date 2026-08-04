/**
 * HOS-372 guard — `media` must not be a WRITE field on the update surface of the
 * entities whose photos moved to a relational media table.
 *
 * The `media` JSONB column was dropped from `accommodations`, `gastronomies` and
 * `experiences`. Anything still accepting `media` on update hands the model a key
 * with no column behind it, and the outcome is worse than a no-op: Drizzle drops
 * the key from the SET clause, so a payload carrying ONLY `media` produces
 * `update "gastronomies" set  where ...` — invalid SQL, a runtime error. A payload
 * carrying `media` plus other fields silently discards the media instead.
 *
 * Videos are the legitimate part of that old blob, and they now travel as a
 * top-level `videos` field backed by a real column. These tests pin both halves:
 * `media` is not writable on update, `videos` is.
 *
 * CREATE is deliberately NOT covered. `media` stays writable there because
 * `AccommodationService._beforeCreate` captures it into `pendingMedia` and
 * `_afterCreate` fans it out into the relational `accommodation_media` rows —
 * that is the shadow-write, not a column write.
 *
 * Read surfaces are covered separately by `videos-field-exposure.test.ts`: `media`
 * is still very much a RESPONSE field, composed from the relational rows on the
 * way out.
 */

import { describe, expect, it } from 'vitest';
import {
    AccommodationUpdateInputSchema,
    ExperienceOwnerUpdateInputSchema,
    ExperienceUpdateInputSchema,
    GastronomyOwnerUpdateInputSchema,
    GastronomyUpdateInputSchema
} from '../../src/index.js';

/** A minimal, valid video entry per `VideoSchema`. */
const VIDEO = {
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    moderationState: 'APPROVED' as const
};

/** A legacy media blob of the exact shape the admin form still submits today. */
const LEGACY_MEDIA = {
    featuredImage: { url: 'https://cdn.example.com/feat.jpg' },
    gallery: [{ url: 'https://cdn.example.com/g1.jpg' }],
    videos: [VIDEO]
};

const updateSchemas = [
    { name: 'AccommodationUpdateInputSchema', schema: AccommodationUpdateInputSchema },
    { name: 'GastronomyUpdateInputSchema', schema: GastronomyUpdateInputSchema },
    { name: 'GastronomyOwnerUpdateInputSchema', schema: GastronomyOwnerUpdateInputSchema },
    { name: 'ExperienceUpdateInputSchema', schema: ExperienceUpdateInputSchema },
    { name: 'ExperienceOwnerUpdateInputSchema', schema: ExperienceOwnerUpdateInputSchema }
];

describe('media is not a write field on update (HOS-372)', () => {
    for (const { name, schema } of updateSchemas) {
        it(`${name} does not declare media in its shape`, () => {
            // A field removed via .omit()/.pick() is absent from `.shape` entirely.
            // Asserting on the shape (not just on a parse) is what makes this
            // non-vacuous: Zod strips unknown keys by default, so a parse alone
            // would pass even if the field were still declared and merely emptied.
            expect(Object.keys(schema.shape)).not.toContain('media');
        });

        it(`${name} strips a legacy media payload instead of forwarding it`, () => {
            const result = schema.safeParse({ media: LEGACY_MEDIA });

            // Additive-compat: an older payload must still PARSE — it just loses
            // the key rather than being rejected.
            expect(result.success).toBe(true);
            expect(result.data).not.toHaveProperty('media');
        });

        it(`${name} accepts top-level videos`, () => {
            const result = schema.safeParse({ videos: [VIDEO] });

            expect(result.success).toBe(true);
            expect(result.data?.videos).toHaveLength(1);
            expect(result.data?.videos?.[0]?.url).toBe(VIDEO.url);
        });

        it(`${name} accepts an empty videos array so the column can be cleared`, () => {
            const result = schema.safeParse({ videos: [] });

            expect(result.success).toBe(true);
            expect(result.data?.videos).toEqual([]);
        });
    }
});
