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
import { createMinimalGastronomy } from '../../fixtures/venue.fixtures.js';

describe('GastronomyWithDestinationSchema', () => {
    it('should validate gastronomy without destination (optional)', () => {
        const data = createMinimalGastronomy();
        expect(() => VenueWithDestinationSchema.parse(data)).not.toThrow();
    });

    it('should validate gastronomy with destination', () => {
        const data = {
            ...createMinimalGastronomy(),
            destination: {
                id: faker.string.uuid(),
                name: 'Concepción del Uruguay',
                slug: 'concepcion-del-uruguay'
            }
        };
        expect(() => VenueWithDestinationSchema.parse(data)).not.toThrow();
    });
});

describe('GastronomyWithOwnerSchema', () => {
    it('should validate gastronomy without owner (optional)', () => {
        const data = createMinimalGastronomy();
        expect(() => VenueWithOwnerSchema.parse(data)).not.toThrow();
    });

    it('should validate gastronomy with owner summary', () => {
        const data = {
            ...createMinimalGastronomy(),
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

describe('GastronomyWithBasicRelationsSchema', () => {
    it('should validate gastronomy with both destination and owner', () => {
        const data = {
            ...createMinimalGastronomy(),
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

describe('GastronomyWithFullRelationsSchema', () => {
    it('should validate gastronomy with all relations', () => {
        const data = {
            ...createMinimalGastronomy(),
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

    it('should validate gastronomy with no optional relations', () => {
        const data = createMinimalGastronomy();
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
            ...createMinimalGastronomy(),
            [field]: [{ id: faker.string.uuid(), slug: 'wifi' }]
        };
        expect(schema.safeParse(data).success).toBe(true);
    });
});
