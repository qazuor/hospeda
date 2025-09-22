import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    AccommodationListWrapperSchema,
    AccommodationStatsWrapperSchema
} from '../../../src/entities/accommodation/accommodation.query.schema';

/**
 * Helper function to create a valid accommodation object for testing
 */
const createValidAccommodation = () => ({
    id: '12345678-1234-4234-8234-123456789012',
    name: 'Test Hotel',
    slug: 'test-hotel',
    type: 'HOTEL',
    summary: 'A comfortable hotel in the heart of the city',
    description:
        'A test hotel for unit testing purposes with all amenities and features you need for a comfortable stay',
    moderationState: 'APPROVED',
    price: {
        amount: 100,
        currency: 'USD'
    },
    location: {
        country: 'US',
        state: 'NY',
        city: 'New York',
        address: '123 Test St',
        zipCode: '10001',
        latitude: 40.7128,
        longitude: -74.006
    },
    media: {
        images: [],
        videos: []
    },
    reviewsCount: 0,
    averageRating: 0,
    isFeatured: false,
    isActive: true,
    visibility: 'PUBLIC',
    ownerId: '12345678-1234-4234-8234-123456789013',
    destinationId: '12345678-1234-4234-8234-123456789014',
    adminInfo: {
        createdBy: '12345678-1234-4234-8234-123456789015',
        updatedBy: '12345678-1234-4234-8234-123456789015'
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    createdBy: '12345678-1234-4234-8234-123456789015',
    updatedBy: '12345678-1234-4234-8234-123456789015',
    createdById: '12345678-1234-4234-8234-123456789015',
    updatedById: '12345678-1234-4234-8234-123456789015',
    deletedAt: null
});

/**
 * Helper function to create valid accommodation stats
 */
const createValidStats = () => ({
    total: 10,
    totalFeatured: 3,
    averagePrice: 150.5,
    averageRating: 4.2,
    totalByType: {
        HOTEL: 5,
        APARTMENT: 3,
        HOSTEL: 2
    }
});

describe('AccommodationListWrapperSchema', () => {
    it('should validate accommodation list wrapper with single accommodation', () => {
        const wrapper = {
            accommodations: [createValidAccommodation()]
        };

        expect(() => AccommodationListWrapperSchema.parse(wrapper)).not.toThrow();

        const result = AccommodationListWrapperSchema.parse(wrapper);
        expect(result.accommodations).toHaveLength(1);
        expect(result.accommodations[0]?.id).toBe('12345678-1234-4234-8234-123456789012');
    });

    it('should validate accommodation list wrapper with multiple accommodations', () => {
        const accommodation1 = createValidAccommodation();
        const accommodation2 = {
            ...createValidAccommodation(),
            id: '12345678-1234-4234-8234-123456789016',
            name: 'Second Test Hotel'
        };

        const wrapper = {
            accommodations: [accommodation1, accommodation2]
        };

        expect(() => AccommodationListWrapperSchema.parse(wrapper)).not.toThrow();

        const result = AccommodationListWrapperSchema.parse(wrapper);
        expect(result.accommodations).toHaveLength(2);
    });

    it('should validate accommodation list wrapper with empty array', () => {
        const wrapper = {
            accommodations: []
        };

        expect(() => AccommodationListWrapperSchema.parse(wrapper)).not.toThrow();

        const result = AccommodationListWrapperSchema.parse(wrapper);
        expect(result.accommodations).toHaveLength(0);
    });

    it('should reject wrapper without accommodations field', () => {
        const wrapper = {};

        expect(() => AccommodationListWrapperSchema.parse(wrapper)).toThrow(ZodError);
    });

    it('should reject wrapper with invalid accommodation data', () => {
        const wrapper = {
            accommodations: [
                {
                    id: 'invalid-id', // Invalid UUID format
                    name: 'Test Hotel'
                    // Missing required fields
                }
            ]
        };

        expect(() => AccommodationListWrapperSchema.parse(wrapper)).toThrow(ZodError);
    });
});

describe('AccommodationStatsWrapperSchema', () => {
    it('should validate accommodation stats wrapper with complete stats', () => {
        const wrapper = {
            stats: createValidStats()
        };

        expect(() => AccommodationStatsWrapperSchema.parse(wrapper)).not.toThrow();

        const result = AccommodationStatsWrapperSchema.parse(wrapper);
        expect(result.stats.total).toBe(10);
        expect(result.stats.totalFeatured).toBe(3);
        expect(result.stats.averagePrice).toBe(150.5);
        expect(result.stats.averageRating).toBe(4.2);
    });

    it('should validate accommodation stats wrapper with minimal stats', () => {
        const wrapper = {
            stats: {
                total: 5,
                totalFeatured: 1,
                totalByType: {
                    HOTEL: 5
                }
            }
        };

        expect(() => AccommodationStatsWrapperSchema.parse(wrapper)).not.toThrow();

        const result = AccommodationStatsWrapperSchema.parse(wrapper);
        expect(result.stats.total).toBe(5);
        expect(result.stats.totalFeatured).toBe(1);
        expect(result.stats.averagePrice).toBeUndefined();
        expect(result.stats.averageRating).toBeUndefined();
    });

    it('should reject wrapper without stats field', () => {
        const wrapper = {};

        expect(() => AccommodationStatsWrapperSchema.parse(wrapper)).toThrow(ZodError);
    });

    it('should reject wrapper with invalid stats data', () => {
        const wrapper = {
            stats: {
                total: -1, // Invalid negative value
                totalFeatured: 'invalid', // Should be number
                totalByType: 'invalid' // Should be object
            }
        };

        expect(() => AccommodationStatsWrapperSchema.parse(wrapper)).toThrow(ZodError);
    });

    it('should reject stats without required fields', () => {
        const wrapper = {
            stats: {
                // Missing total, totalFeatured, totalByType
                averagePrice: 100
            }
        };

        expect(() => AccommodationStatsWrapperSchema.parse(wrapper)).toThrow(ZodError);
    });
});
