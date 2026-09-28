import { describe, expect, it } from 'vitest';
import {
    ACCOMMODATION_SLUG_MAX_LENGTH,
    ACCOMMODATION_SLUG_READ_MAX_LENGTH,
    AccommodationAdminSchema,
    AccommodationCreateInputSchema,
    AccommodationCreateOutputSchema,
    AccommodationListItemSchema,
    AccommodationProtectedSchema,
    AccommodationPublicSchema,
    AccommodationRestoreOutputSchema,
    AccommodationSchema,
    AccommodationSummarySchema,
    AccommodationUpdateInputSchema,
    AccommodationUpdateOutputSchema
} from '../../../src/index.js';

/**
 * HOS-855: the slug limit lived in three places (create 100, entity 50, access
 * schemas 120), so a 51-100 char slug passed the write gate and then 500'd on
 * some read paths. Invariant locked here: everything the write side accepts,
 * every read schema must parse; and the write side cannot exceed the generator cap.
 */
const slugOf = (length: number): string => 'a'.repeat(length);

describe('accommodation slug length (HOS-855)', () => {
    it('write limit equals the generator cap (50) and never exceeds the read limit', () => {
        expect(ACCOMMODATION_SLUG_MAX_LENGTH).toBe(50);
        expect(ACCOMMODATION_SLUG_READ_MAX_LENGTH).toBeGreaterThanOrEqual(
            ACCOMMODATION_SLUG_MAX_LENGTH
        );
    });

    it('create and update reject a slug over the write limit', () => {
        const slug = slugOf(ACCOMMODATION_SLUG_MAX_LENGTH + 1);
        expect(AccommodationCreateInputSchema.shape.slug.safeParse(slug).success).toBe(false);
        expect(AccommodationUpdateInputSchema.shape.slug.safeParse(slug).success).toBe(false);
        expect(
            AccommodationCreateInputSchema.shape.slug.safeParse(
                slugOf(ACCOMMODATION_SLUG_MAX_LENGTH)
            ).success
        ).toBe(true);
    });

    const readSchemas = {
        AccommodationPublicSchema,
        AccommodationProtectedSchema,
        AccommodationAdminSchema,
        AccommodationSummarySchema,
        AccommodationListItemSchema,
        AccommodationCreateOutputSchema,
        AccommodationUpdateOutputSchema,
        AccommodationRestoreOutputSchema
    } as const;

    for (const [name, schema] of Object.entries(readSchemas)) {
        it(`${name} reads a legacy slug up to the read limit and rejects beyond it`, () => {
            const slugShape = (schema as unknown as { shape: { slug: import('zod').ZodType } })
                .shape.slug;
            // Legacy rows persisted before the cap (51-100 via create, up to 120 generated).
            for (const length of [51, 100, ACCOMMODATION_SLUG_READ_MAX_LENGTH]) {
                expect(slugShape.safeParse(slugOf(length)).success, `${name} @${length}`).toBe(
                    true
                );
            }
            expect(
                slugShape.safeParse(slugOf(ACCOMMODATION_SLUG_READ_MAX_LENGTH + 1)).success
            ).toBe(false);
        });
    }

    it('the entity schema itself stays at the write limit', () => {
        expect(
            AccommodationSchema.shape.slug.safeParse(slugOf(ACCOMMODATION_SLUG_MAX_LENGTH + 1))
                .success
        ).toBe(false);
    });
});
