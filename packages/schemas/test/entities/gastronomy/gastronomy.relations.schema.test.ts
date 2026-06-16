import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import {
    GastronomyWithBasicRelationsSchema,
    GastronomyWithDestinationSchema,
    GastronomyWithFullRelationsSchema,
    GastronomyWithOwnerSchema
} from '../../../src/entities/gastronomy/gastronomy.relations.schema.js';
import { createMinimalGastronomy } from '../../fixtures/gastronomy.fixtures.js';

describe('GastronomyWithDestinationSchema', () => {
    it('should validate gastronomy without destination (optional)', () => {
        const data = createMinimalGastronomy();
        expect(() => GastronomyWithDestinationSchema.parse(data)).not.toThrow();
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
        expect(() => GastronomyWithDestinationSchema.parse(data)).not.toThrow();
    });
});

describe('GastronomyWithOwnerSchema', () => {
    it('should validate gastronomy without owner (optional)', () => {
        const data = createMinimalGastronomy();
        expect(() => GastronomyWithOwnerSchema.parse(data)).not.toThrow();
    });

    it('should validate gastronomy with owner summary', () => {
        const data = {
            ...createMinimalGastronomy(),
            owner: {
                id: faker.string.uuid(),
                email: 'owner@example.com',
                role: 'COMMERCE_OWNER',
                isActive: true
            }
        };
        expect(() => GastronomyWithOwnerSchema.parse(data)).not.toThrow();
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
                role: 'COMMERCE_OWNER',
                isActive: true
            }
        };
        expect(() => GastronomyWithBasicRelationsSchema.parse(data)).not.toThrow();
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
                role: 'COMMERCE_OWNER',
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
        expect(() => GastronomyWithFullRelationsSchema.parse(data)).not.toThrow();
    });

    it('should validate gastronomy with no optional relations', () => {
        const data = createMinimalGastronomy();
        expect(() => GastronomyWithFullRelationsSchema.parse(data)).not.toThrow();
    });
});
