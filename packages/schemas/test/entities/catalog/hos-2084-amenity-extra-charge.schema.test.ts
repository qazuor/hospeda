/**
 * HOS-2084 -- the owner-facing `extraCharge` flag of `amenityAttributes`
 * travels through every vertical's owner write input unchanged, and omitting it
 * stays valid (the service then keeps the stored value).
 */
import { describe, expect, it } from 'vitest';
import { AccommodationUpdateInputSchema } from '../../../src/entities/accommodation/accommodation.crud.schema.js';
import {
    ExperienceOwnerUpdateInputSchema,
    ExperienceUpdateInputSchema
} from '../../../src/entities/experience/experience.crud.schema.js';
import {
    VenueOwnerUpdateInputSchema,
    VenueUpdateInputSchema
} from '../../../src/entities/venue/venue.crud.schema.js';

const AMENITY = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001';

const VERTICAL_UPDATES = [
    ['accommodation', AccommodationUpdateInputSchema],
    ['venue owner', VenueOwnerUpdateInputSchema],
    ['venue', VenueUpdateInputSchema],
    ['experience owner', ExperienceOwnerUpdateInputSchema],
    ['experience', ExperienceUpdateInputSchema]
] as const;

describe.each(
    VERTICAL_UPDATES
)('%s update input carries extraCharge (HOS-2084)', (_name, schema) => {
    it('round-trips extraCharge true and false', () => {
        // Arrange
        const input = {
            amenityIds: [AMENITY],
            amenityAttributes: [{ amenityId: AMENITY, extraCharge: true }]
        };

        // Act
        const on = schema.parse(input);
        const off = schema.parse({
            ...input,
            amenityAttributes: [{ amenityId: AMENITY, extraCharge: false }]
        });

        // Assert
        expect(on.amenityAttributes).toEqual([{ amenityId: AMENITY, extraCharge: true }]);
        expect(off.amenityAttributes).toEqual([{ amenityId: AMENITY, extraCharge: false }]);
    });

    it('leaves extraCharge undefined when omitted, so the stored value is kept', () => {
        const parsed = schema.parse({
            amenityIds: [AMENITY],
            amenityAttributes: [{ amenityId: AMENITY, scope: 'shared' }]
        });

        expect(parsed.amenityAttributes?.[0]?.extraCharge).toBeUndefined();
    });
});
