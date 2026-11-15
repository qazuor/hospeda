/**
 * HOS-2189 — the venue postal address (`location`) is the SAME shape as an
 * accommodation's: one shared schema, owner- and admin-writable, publicly
 * readable.
 */
import { describe, expect, it } from 'vitest';
import {
    PostalAddressReadSchema,
    PostalAddressSchema
} from '../../../src/common/postal-address.schema.js';
import {
    AccommodationLocationReadSchema,
    AccommodationLocationSchema
} from '../../../src/entities/accommodation/accommodation.location.schema.js';
import { VenuePublicSchema } from '../../../src/entities/venue/venue.access.schema.js';
import {
    VenueOwnerUpdateInputSchema,
    VenueUpdateInputSchema
} from '../../../src/entities/venue/venue.crud.schema.js';
import { VenueSchema } from '../../../src/entities/venue/venue.schema.js';

const ADDRESS = {
    street: 'Av. San Martín',
    number: '123',
    floor: '2',
    apartment: 'B',
    coordinates: { lat: '-32.4825', long: '-58.2333' }
};

describe('venue location (HOS-2189)', () => {
    it('shares one postal schema with accommodation (no duplicate definition)', () => {
        expect(AccommodationLocationSchema).toBe(PostalAddressSchema);
        expect(AccommodationLocationReadSchema).toBe(PostalAddressReadSchema);
    });

    it('is a nullish member of the venue entity', () => {
        const shape = VenueSchema.shape;
        expect(shape.location.safeParse(ADDRESS).success).toBe(true);
        expect(shape.location.safeParse(null).success).toBe(true);
        expect(shape.location.safeParse(undefined).success).toBe(true);
    });

    it('is writable by the owner and accepts "" to clear a member', () => {
        expect(VenueOwnerUpdateInputSchema.safeParse({ location: ADDRESS }).success).toBe(true);
        expect(VenueOwnerUpdateInputSchema.safeParse({ location: { floor: '' } }).success).toBe(
            true
        );
    });

    it('is writable by an admin', () => {
        expect(VenueUpdateInputSchema.safeParse({ location: ADDRESS }).success).toBe(true);
    });

    it('rejects a one-character street with the accommodation message key', () => {
        const result = VenueOwnerUpdateInputSchema.safeParse({ location: { street: 'A' } });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0]?.message).toBe(
                'zodError.accommodation.location.street.min'
            );
        }
    });

    it('rejects out-of-range coordinates', () => {
        const result = VenueOwnerUpdateInputSchema.safeParse({
            location: { coordinates: { lat: '95', long: '-58' } }
        });
        expect(result.success).toBe(false);
    });

    it('is published in the public projection', () => {
        expect(Object.keys(VenuePublicSchema.shape)).toContain('location');
    });
});
