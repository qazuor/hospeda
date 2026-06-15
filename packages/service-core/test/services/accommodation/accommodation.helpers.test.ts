import { AccommodationModel } from '@repo/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    flattenAccommodationJoinRelations,
    generateSlug
} from '../../../src/services/accommodation/accommodation.helpers';

/**
 * Test suite for generateSlug helper in AccommodationService.
 * Ensures robust, unique, and predictable slug generation for accommodations.
 */
describe('generateSlug (AccommodationService)', () => {
    let findOneMock: ReturnType<typeof vi.fn>;
    beforeEach(() => {
        findOneMock = vi.fn();
        vi.spyOn(AccommodationModel.prototype, 'findOne').mockImplementation(findOneMock);
    });

    it('generates a slug from type and name if not taken', async () => {
        findOneMock.mockResolvedValue(null);
        const slug = await generateSlug('hotel', 'Gran Hotel Plaza');
        expect(typeof slug).toBe('string');
        expect(slug).toMatch(/^hotel-gran-hotel-plaza/);
    });

    it('handles special characters, spaces, and case', async () => {
        findOneMock.mockResolvedValue(null);
        const slug = await generateSlug('cabaña', 'El Río & Sol! 2024');
        // The slugify utility replaces '&' with 'and'
        expect(slug).toBe('cabana-el-rio-and-sol-2024');
    });

    it('appends a suffix if slug is already taken', async () => {
        findOneMock.mockResolvedValueOnce({}).mockResolvedValueOnce(null);
        const slug = await generateSlug('hostel', 'La Posta');
        expect(slug).toMatch(/^hostel-la-posta-[a-z0-9]+$/);
    });

    it('handles multiple collisions and increments suffix', async () => {
        findOneMock
            .mockResolvedValueOnce({}) // slug exists
            .mockResolvedValueOnce({}) // slug-xxxx exists
            .mockResolvedValueOnce(null); // finally available
        const slug = await generateSlug('apartment', 'El Centro');
        expect(slug).toMatch(/^apartment-el-centro-[a-z0-9]+$/);
    });

    it('is idempotent for the same type and name if slug is available', async () => {
        findOneMock.mockResolvedValue(null);
        const slug1 = await generateSlug('cabin', 'Monte Verde');
        const slug2 = await generateSlug('cabin', 'Monte Verde');
        expect(slug1).toBe(slug2);
    });

    it('throws if model throws', async () => {
        findOneMock.mockRejectedValue(new Error('DB error'));
        await expect(generateSlug('hotel', 'Error Name')).rejects.toThrow('DB error');
    });
});

// ---------------------------------------------------------------------------
// flattenAccommodationJoinRelations — pure transformation, no mocks needed
// ---------------------------------------------------------------------------

describe('flattenAccommodationJoinRelations()', () => {
    it('should return null/undefined as-is', () => {
        expect(flattenAccommodationJoinRelations(null)).toBeNull();
        expect(flattenAccommodationJoinRelations(undefined)).toBeUndefined();
    });

    it('should flatten amenities with nested amenity entity', () => {
        // Arrange — Drizzle with-join shape
        const entity = {
            id: 'acc-1',
            amenities: [
                {
                    accommodationId: 'acc-1',
                    amenityId: 'am-1',
                    isOptional: false,
                    additionalCost: 0,
                    amenity: { id: 'am-1', name: 'Pool', icon: 'pool-icon' }
                }
            ],
            features: []
        } as never;

        // Act
        const result = flattenAccommodationJoinRelations(entity);

        // Assert — junction metadata + entity fields merged, wrapper key removed
        const amenities = (result as never as Record<string, unknown[]>).amenities ?? [];
        expect(amenities).toHaveLength(1);
        expect(amenities.at(0)).not.toHaveProperty('amenity');
        expect(amenities.at(0)).toMatchObject({
            amenityId: 'am-1',
            isOptional: false,
            name: 'Pool',
            icon: 'pool-icon'
        });
    });

    it('should flatten features with nested feature entity', () => {
        // Arrange
        const entity = {
            id: 'acc-2',
            amenities: [],
            features: [
                {
                    accommodationId: 'acc-2',
                    featureId: 'ft-1',
                    feature: { id: 'ft-1', name: 'Kitchen', slug: 'kitchen' }
                }
            ]
        } as never;

        // Act
        const result = flattenAccommodationJoinRelations(entity);

        // Assert
        const features = (result as never as Record<string, unknown[]>).features ?? [];
        expect(features.at(0)).not.toHaveProperty('feature');
        expect(features.at(0)).toMatchObject({ featureId: 'ft-1', name: 'Kitchen' });
    });

    it('should handle rows where nested key is missing (no entity to merge)', () => {
        // Arrange — junction row has no nested entity key
        const entity = {
            id: 'acc-3',
            amenities: [{ amenityId: 'am-2', isOptional: true }],
            features: []
        } as never;

        // Act
        const result = flattenAccommodationJoinRelations(entity);

        // Assert — row passes through as-is (no nested key to strip)
        const amenities = (result as never as Record<string, unknown[]>).amenities ?? [];
        expect(amenities.at(0)).toMatchObject({ amenityId: 'am-2', isOptional: true });
    });

    it('should filter out null/non-object rows', () => {
        // Arrange — mix of valid and invalid rows
        const entity = {
            id: 'acc-4',
            amenities: [null, 'invalid', { amenityId: 'am-3', amenity: { name: 'Wifi' } }],
            features: []
        } as never;

        // Act
        const result = flattenAccommodationJoinRelations(entity);

        // Assert — null and string rows are filtered out
        const amenities = (result as never as Record<string, unknown[]>).amenities ?? [];
        expect(amenities).toHaveLength(1);
        expect(amenities.at(0)).toMatchObject({ amenityId: 'am-3', name: 'Wifi' });
    });

    it('should skip fields that are not arrays', () => {
        // Arrange — amenities is not an array (e.g., not loaded with relations)
        const entity = { id: 'acc-5', amenities: null, features: undefined } as never;

        // Act — should not throw
        const result = flattenAccommodationJoinRelations(entity);

        // Assert — entity returned unchanged
        expect(result).toBe(entity);
    });

    it('should handle nested entity that is not an object (drops wrapper key)', () => {
        // Arrange — nested key exists but is a primitive (not an object)
        const entity = {
            id: 'acc-6',
            amenities: [{ amenityId: 'am-4', amenity: null }],
            features: []
        } as never;

        // Act
        const result = flattenAccommodationJoinRelations(entity);

        // Assert — amenity key is stripped, rest of row preserved
        const amenities = (result as never as Record<string, unknown[]>).amenities ?? [];
        expect(amenities.at(0)).not.toHaveProperty('amenity');
        expect(amenities.at(0)).toMatchObject({ amenityId: 'am-4' });
    });
});
