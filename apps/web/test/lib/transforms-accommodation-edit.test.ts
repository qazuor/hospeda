/**
 * @file transforms-accommodation-edit.test.ts
 * @description Tests for SPEC-208 accommodation editor transform functions:
 *   - transformAccommodationEdit
 *   - transformAmenityList
 *   - transformDestinationList
 */

import {
    transformAccommodationEdit,
    transformAmenityList,
    transformDestinationList
} from '@/lib/api/transforms';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// transformAccommodationEdit
// ---------------------------------------------------------------------------

describe('transformAccommodationEdit', () => {
    it('should extract all editable fields from a raw API accommodation object', () => {
        const raw = {
            id: 'acc-123',
            name: 'Hotel Test',
            summary: 'A beautiful hotel in the city center',
            description: 'Full description of the hotel with amenities and services.',
            type: 'HOTEL',
            destinationId: 'dest-456',
            // Coordinates live nested under location.coordinates per the domain API response shape.
            // The HTTP intake schema accepts flat latitude/longitude and maps them here server-side.
            location: {
                coordinates: {
                    lat: '-32.47',
                    long: '-58.23'
                }
            },
            // Capacity fields live under extraInfo per the domain schema.
            extraInfo: {
                capacity: 4,
                bedrooms: 2,
                bathrooms: 1,
                beds: 3
            },
            price: { price: 15000, currency: 'ARS' },
            isAvailable: true,
            isFeatured: false,
            amenities: [
                { amenityId: 'am-1', amenity: { id: 'am-1' } },
                { amenityId: 'am-2', amenity: { id: 'am-2' } }
            ],
            features: [
                { featureId: 'ft-1', feature: { id: 'ft-1' } },
                { featureId: 'ft-2', feature: { id: 'ft-2' } }
            ]
        };

        const result = transformAccommodationEdit({ item: raw });

        expect(result.id).toBe('acc-123');
        expect(result.name).toBe('Hotel Test');
        expect(result.summary).toBe('A beautiful hotel in the city center');
        expect(result.description).toBe(
            'Full description of the hotel with amenities and services.'
        );
        expect(result.type).toBe('HOTEL');
        expect(result.destinationId).toBe('dest-456');
        expect(result.latitude).toBe(-32.47);
        expect(result.longitude).toBe(-58.23);
        expect(result.maxGuests).toBe(4);
        expect(result.bedrooms).toBe(2);
        expect(result.bathrooms).toBe(1);
        expect(result.beds).toBe(3);
        expect(result.basePrice).toBe(15000);
        expect(result.currency).toBe('ARS');
        expect(result.isAvailable).toBe(true);
        expect(result.isFeatured).toBe(false);
        expect(result.amenityIds).toEqual(['am-1', 'am-2']);
        expect(result.featureIds).toEqual(['ft-1', 'ft-2']);
    });

    it('should default missing fields to safe fallbacks', () => {
        const raw = {
            id: 'acc-empty',
            name: '',
            type: 'APARTMENT',
            destinationId: 'dest-789'
        };

        const result = transformAccommodationEdit({ item: raw });

        expect(result.id).toBe('acc-empty');
        expect(result.name).toBe('');
        expect(result.summary).toBe('');
        expect(result.description).toBe('');
        expect(result.type).toBe('APARTMENT');
        expect(result.destinationId).toBe('dest-789');
        expect(result.latitude).toBeNull();
        expect(result.longitude).toBeNull();
        expect(result.maxGuests).toBeNull();
        expect(result.bedrooms).toBeNull();
        expect(result.bathrooms).toBeNull();
        expect(result.beds).toBeNull();
        expect(result.basePrice).toBeNull();
        expect(result.currency).toBeNull();
        expect(result.isAvailable).toBe(true);
        expect(result.isFeatured).toBe(false);
        expect(result.amenityIds).toEqual([]);
        expect(result.featureIds).toEqual([]);
    });

    it('should handle price nested under price.price or price.amount', () => {
        const withPricePrice = transformAccommodationEdit({
            item: { id: 'a1', price: { price: 20000, currency: 'USD' } }
        });
        expect(withPricePrice.basePrice).toBe(20000);
        expect(withPricePrice.currency).toBe('USD');

        const withPriceAmount = transformAccommodationEdit({
            item: { id: 'a2', price: { amount: 25000, currency: 'ARS' } }
        });
        expect(withPriceAmount.basePrice).toBe(25000);
        expect(withPriceAmount.currency).toBe('ARS');
    });

    it('should handle amenities and features as plain ID arrays', () => {
        const raw = {
            id: 'a3',
            amenities: ['am-1', 'am-2'],
            features: ['ft-1']
        };

        const result = transformAccommodationEdit({ item: raw });

        expect(result.amenityIds).toEqual(['am-1', 'am-2']);
        expect(result.featureIds).toEqual(['ft-1']);
    });
});

// ---------------------------------------------------------------------------
// transformAmenityList
// ---------------------------------------------------------------------------

describe('transformAmenityList', () => {
    it('should transform a list of raw amenity objects into AmenityData[]', () => {
        // SPEC-266: the catalog `name` column was dropped; `slug` is the
        // canonical identifier and the i18n key for label resolution.
        const raw = [
            { id: 'am-1', slug: 'wifi', category: 'connectivity' },
            { id: 'am-2', slug: 'pool', category: 'leisure' }
        ];

        const result = transformAmenityList({ items: raw });

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ id: 'am-1', slug: 'wifi', category: 'connectivity' });
        expect(result[1]).toEqual({ id: 'am-2', slug: 'pool', category: 'leisure' });
    });

    it('should handle empty input', () => {
        const result = transformAmenityList({ items: [] });
        expect(result).toEqual([]);
    });

    it('should default missing category to null', () => {
        const raw = [{ id: 'am-3', slug: 'parking' }];
        const result = transformAmenityList({ items: raw });
        expect(result[0].category).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// transformDestinationList
// ---------------------------------------------------------------------------

describe('transformDestinationList', () => {
    it('should transform a list of raw destination objects into DestinationData[]', () => {
        const raw = [
            {
                id: 'dest-1',
                name: 'Concepción del Uruguay',
                path: '/argentina/litoral/concepcion-del-uruguay'
            },
            { id: 'dest-2', name: 'Colón', path: '/argentina/litoral/colon' }
        ];

        const result = transformDestinationList({ items: raw });

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
            id: 'dest-1',
            name: 'Concepción del Uruguay',
            path: '/argentina/litoral/concepcion-del-uruguay'
        });
        expect(result[1]).toEqual({
            id: 'dest-2',
            name: 'Colón',
            path: '/argentina/litoral/colon'
        });
    });

    it('should handle empty input', () => {
        const result = transformDestinationList({ items: [] });
        expect(result).toEqual([]);
    });

    it('should default missing path to empty string', () => {
        const raw = [{ id: 'dest-3', name: 'Test Destination' }];
        const result = transformDestinationList({ items: raw });
        expect(result[0].path).toBe('');
    });
});
