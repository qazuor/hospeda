/**
 * HOS-803 — the cover-upload contract, at the layer where it is enforced.
 *
 * The featured-media endpoint waives the plan gallery cap. That waiver is only
 * safe while two things stay true of the SHAPES, independently of any handler:
 *
 *  1. the request body cannot name the plan cap. A caller able to state its own
 *     allowance has no allowance;
 *  2. the request body cannot name `isFeatured` either — on this endpoint or on
 *     the gallery one. Which kind of row is created is the endpoint's decision,
 *     never the payload's.
 *
 * Both hold because the payload is a plain `z.object`, which strips unknown
 * keys. That is a real mechanism and not an accident, so it is pinned here:
 * switching the schema to `.passthrough()` turns these red, and the route tests
 * — which observe the payload only after this parse has already run — could not
 * tell the difference.
 */

import { describe, expect, it } from 'vitest';
import {
    AccommodationFeaturedMediaAddInputSchema,
    AccommodationFeaturedMediaAddOutputSchema,
    AccommodationMediaAddPayloadSchema
} from '../../../src/entities/accommodation/subtypes/accommodation.media.schema.js';

const ACCOMMODATION_ID = '00000000-0000-4000-8000-000000000001';
const MEDIA_ID = '00000000-0000-4000-8000-0000000000b2';

const VALID_PAYLOAD = {
    url: 'https://res.cloudinary.com/demo/image/upload/cover.jpg',
    publicId: 'hospeda/dev/cover'
};

describe('the cover payload cannot claim its own privileges (HOS-803)', () => {
    it('drops a planGalleryCap sent in the body', () => {
        const parsed = AccommodationMediaAddPayloadSchema.parse({
            ...VALID_PAYLOAD,
            planGalleryCap: 9999
        });

        // `in` rather than a value comparison: a key present and undefined
        // would still reach the service, and `toBeUndefined` cannot see the
        // difference.
        expect('planGalleryCap' in parsed).toBe(false);
    });

    it('drops an isFeatured sent in the body', () => {
        const parsed = AccommodationMediaAddPayloadSchema.parse({
            ...VALID_PAYLOAD,
            isFeatured: true
        });

        expect('isFeatured' in parsed).toBe(false);
    });

    it('drops the same keys when nested under the service input', () => {
        const parsed = AccommodationFeaturedMediaAddInputSchema.parse({
            accommodationId: ACCOMMODATION_ID,
            media: { ...VALID_PAYLOAD, planGalleryCap: 9999, isFeatured: true }
        });

        expect('planGalleryCap' in parsed.media).toBe(false);
        expect('isFeatured' in parsed.media).toBe(false);
        // The top-level cap is absent because the caller did not set it —
        // only the route ever does.
        expect(parsed.planGalleryCap).toBeUndefined();
    });

    it('accepts the plan cap only at the top level, where the route sets it', () => {
        const parsed = AccommodationFeaturedMediaAddInputSchema.parse({
            accommodationId: ACCOMMODATION_ID,
            media: VALID_PAYLOAD,
            planGalleryCap: 15
        });

        expect(parsed.planGalleryCap).toBe(15);
    });

    it('rejects a non-integer plan cap', () => {
        const result = AccommodationFeaturedMediaAddInputSchema.safeParse({
            accommodationId: ACCOMMODATION_ID,
            media: VALID_PAYLOAD,
            planGalleryCap: 15.5
        });

        expect(result.success).toBe(false);
    });
});

describe('the cover response reports the replaced photo (HOS-803)', () => {
    it('requires previousFeatured to be present, even when null', () => {
        // Omitted entirely is NOT the same as null: the client branches on it,
        // so a response that forgot the key would leave an archived photo
        // rendered in a gallery it has left.
        const result = AccommodationFeaturedMediaAddOutputSchema.safeParse({
            media: {
                id: MEDIA_ID,
                accommodationId: ACCOMMODATION_ID,
                url: VALID_PAYLOAD.url,
                moderationState: 'APPROVED',
                state: 'visible',
                isFeatured: true,
                sortOrder: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            }
        });

        expect(result.success).toBe(false);
    });

    it('accepts only the two dispositions the server can produce', () => {
        const outcome = { id: MEDIA_ID, disposition: 'deleted' };

        const result =
            AccommodationFeaturedMediaAddOutputSchema.shape.previousFeatured.safeParse(outcome);

        // 'deleted' is deliberately not one of them — the old cover is never
        // destroyed, only demoted or archived.
        expect(result.success).toBe(false);
    });
});
