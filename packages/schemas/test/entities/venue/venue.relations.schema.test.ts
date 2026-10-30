import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import {
    VenueWithAmenitiesSchema,
    VenueWithBasicRelationsSchema,
    VenueWithDestinationSchema,
    VenueWithFeaturesSchema,
    VenueWithFullRelationsSchema,
    VenueWithOwnerSchema
} from '../../../src/entities/venue/venue.relations.schema.js';
import { createMinimalVenue } from '../../fixtures/venue.fixtures.js';

describe('VenueWithDestinationSchema', () => {
    it('should validate venue without destination (optional)', () => {
        const data = createMinimalVenue();
        expect(() => VenueWithDestinationSchema.parse(data)).not.toThrow();
    });

    it('should validate venue with destination', () => {
        const data = {
            ...createMinimalVenue(),
            destination: {
                id: faker.string.uuid(),
                name: 'Concepción del Uruguay',
                slug: 'concepcion-del-uruguay'
            }
        };
        expect(() => VenueWithDestinationSchema.parse(data)).not.toThrow();
    });
});

describe('VenueWithOwnerSchema', () => {
    it('should validate venue without owner (optional)', () => {
        const data = createMinimalVenue();
        expect(() => VenueWithOwnerSchema.parse(data)).not.toThrow();
    });

    it('should validate venue with owner summary', () => {
        const data = {
            ...createMinimalVenue(),
            owner: {
                id: faker.string.uuid(),
                email: 'owner@example.com',
                role: 'HOST',
                isActive: true
            }
        };
        expect(() => VenueWithOwnerSchema.parse(data)).not.toThrow();
    });
});

describe('VenueWithBasicRelationsSchema', () => {
    it('should validate venue with both destination and owner', () => {
        const data = {
            ...createMinimalVenue(),
            destination: { id: faker.string.uuid(), name: 'Test City', slug: 'test-city' },
            owner: {
                id: faker.string.uuid(),
                email: 'owner@example.com',
                role: 'HOST',
                isActive: true
            }
        };
        expect(() => VenueWithBasicRelationsSchema.parse(data)).not.toThrow();
    });
});

describe('VenueWithFullRelationsSchema', () => {
    it('should validate venue with all relations', () => {
        const data = {
            ...createMinimalVenue(),
            destination: { id: faker.string.uuid(), name: 'Test City', slug: 'test-city' },
            owner: {
                id: faker.string.uuid(),
                email: 'owner@example.com',
                role: 'HOST',
                isActive: true
            },
            features: [{ id: faker.string.uuid(), slug: 'wifi', name: 'WiFi' }],
            amenities: [{ id: faker.string.uuid(), slug: 'parking', name: 'Parking' }],
            reviews: [
                {
                    id: faker.string.uuid(),
                    overallRating: 4,
                    userId: faker.string.uuid(),
                    createdAt: new Date()
                }
            ],
            reviewsCount: 1,
            averageRating: 4.0
        };
        expect(() => VenueWithFullRelationsSchema.parse(data)).not.toThrow();
    });

    it('should validate venue with no optional relations', () => {
        const data = createMinimalVenue();
        expect(() => VenueWithFullRelationsSchema.parse(data)).not.toThrow();
    });
});

// HOS-1774: zod 4.6 requires unwrapped `z.unknown()` keys; 4.3.6 accepted omission.
describe('feature/amenity summaries without a `name` key (zod 4.3.6 parity)', () => {
    it.each([
        ['features', VenueWithFeaturesSchema],
        ['amenities', VenueWithAmenitiesSchema]
    ] as const)('accepts a %s summary that omits name', (field, schema) => {
        const data = {
            ...createMinimalVenue(),
            [field]: [{ id: faker.string.uuid(), slug: 'wifi' }]
        };
        expect(schema.safeParse(data).success).toBe(true);
    });
});
