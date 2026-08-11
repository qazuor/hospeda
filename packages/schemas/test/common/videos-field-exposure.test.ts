/**
 * HOS-372 guard — the `videos` field must stay exposed on the access schemas of
 * every entity whose photos moved to a relational media table.
 *
 * Accommodations, gastronomy listings and experiences keep their photos as rows
 * (`accommodation_media` / `gastronomy_media` / `experience_media`) and their
 * videos in a dedicated `videos` column, because a video is an external
 * YouTube/Vimeo URL rather than an uploaded asset. Once the `media` JSONB column
 * is dropped, that column is the ONLY place videos exist.
 *
 * The access schemas are `.pick()`-based allowlists: dropping `videos: true` from
 * a pick does not fail typecheck and does not fail any other test — it just
 * silently stops serving videos. This file is the tripwire for that.
 *
 * Entities that still keep their whole media object in JSONB (posts, events,
 * destinations) are deliberately NOT covered: their videos live inside
 * `media.videos` and this field does not apply to them.
 */

import { describe, expect, it } from 'vitest';
import {
    AccommodationPublicSchema,
    ExperiencePublicSchema,
    GastronomyPublicSchema
} from '../../src/index.js';

/** A minimal, valid video entry per `VideoSchema`. */
const VIDEO = {
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    moderationState: 'APPROVED' as const,
    caption: 'Tour of the venue'
};

describe('videos field exposure on relational-media entities (HOS-372)', () => {
    // `.pick()` is applied HERE, where each schema still has its own concrete
    // type. Collecting the schemas first and picking inside the loop makes
    // `schema` a union of three unrelated ZodObjects, and `.pick()` on that
    // union has no compatible call signature (TS2349).
    //
    // Isolating the field is what makes the parse assertion meaningful: these
    // schemas have other required members, so a whole-object parse would fail on
    // those and tell us nothing about videos. The pick also proves the key really
    // exists — picking an absent key yields an empty shape, which the shape
    // assertion below then catches.
    const cases = [
        {
            name: 'GastronomyPublicSchema',
            shapeKeys: Object.keys(GastronomyPublicSchema.shape),
            isolated: GastronomyPublicSchema.pick({ videos: true })
        },
        {
            name: 'ExperiencePublicSchema',
            shapeKeys: Object.keys(ExperiencePublicSchema.shape),
            isolated: ExperiencePublicSchema.pick({ videos: true })
        },
        {
            name: 'AccommodationPublicSchema',
            shapeKeys: Object.keys(AccommodationPublicSchema.shape),
            isolated: AccommodationPublicSchema.pick({ videos: true })
        }
    ];

    for (const { name, shapeKeys, isolated } of cases) {
        it(`${name} declares a videos field`, () => {
            // A picked-away field is absent from `.shape` entirely.
            expect(shapeKeys).toContain('videos');
        });

        it(`${name} preserves videos through a parse instead of stripping them`, () => {
            expect(Object.keys(isolated.shape)).toEqual(['videos']);

            const parsed = isolated.parse({ videos: [VIDEO] });
            expect(parsed.videos).toHaveLength(1);
            expect(parsed.videos?.[0]?.url).toBe(VIDEO.url);
        });
    }

    it('accepts a null videos value (column is nullable)', () => {
        const parsed = GastronomyPublicSchema.pick({ videos: true }).parse({ videos: null });
        expect(parsed.videos).toBeNull();
    });

    it('still parses payloads written before the field existed', () => {
        // Additive-only policy: videos is nullish, so an older payload that never
        // carried the key must keep parsing.
        const result = GastronomyPublicSchema.pick({ videos: true }).safeParse({});
        expect(result.success).toBe(true);
    });
});
