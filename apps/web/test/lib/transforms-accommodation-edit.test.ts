/**
 * @file transforms-accommodation-edit.test.ts
 * @description Tests for SPEC-208 accommodation editor transform functions:
 *   - transformAccommodationEdit
 *   - transformAmenityList
 *   - transformDestinationList
 */

import { describe, expect, it } from 'vitest';
import {
    transformAccommodationEdit,
    transformAmenityList,
    transformDestinationList
} from '@/lib/api/transforms';

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
                },
                street: 'Av. Belgrano',
                number: '123',
                floor: '4',
                apartment: 'B'
            },
            // Capacity fields live under extraInfo per the domain schema.
            extraInfo: {
                capacity: 4,
                bedrooms: 2,
                bathrooms: 1,
                beds: 3,
                minNights: 2
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
            ],
            seo: { title: 'A'.repeat(30), description: 'B'.repeat(70) },
            media: {
                videos: [
                    { url: 'https://youtube.com/watch?v=abc', caption: 'Tour' },
                    { url: 'https://vimeo.com/123' }
                ]
            }
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
        expect(result.street).toBe('Av. Belgrano');
        expect(result.number).toBe('123');
        expect(result.floor).toBe('4');
        expect(result.apartment).toBe('B');
        expect(result.maxGuests).toBe(4);
        expect(result.bedrooms).toBe(2);
        expect(result.bathrooms).toBe(1);
        expect(result.beds).toBe(3);
        expect(result.minNights).toBe(2);
        expect(result.basePrice).toBe(15000);
        expect(result.currency).toBe('ARS');
        expect(result.isAvailable).toBe(true);
        expect(result.isFeatured).toBe(false);
        expect(result.amenityIds).toEqual(['am-1', 'am-2']);
        expect(result.featureIds).toEqual(['ft-1', 'ft-2']);
        expect(result.seoTitle).toBe('A'.repeat(30));
        expect(result.seoDescription).toBe('B'.repeat(70));
        expect(result.videos).toEqual([
            { url: 'https://youtube.com/watch?v=abc', caption: 'Tour' },
            { url: 'https://vimeo.com/123' }
        ]);
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
        expect(result.street).toBe('');
        expect(result.number).toBe('');
        expect(result.floor).toBe('');
        expect(result.apartment).toBe('');
        expect(result.maxGuests).toBeNull();
        expect(result.bedrooms).toBeNull();
        expect(result.bathrooms).toBeNull();
        expect(result.beds).toBeNull();
        expect(result.minNights).toBeNull();
        expect(result.basePrice).toBeNull();
        expect(result.currency).toBeNull();
        expect(result.isAvailable).toBe(true);
        expect(result.isFeatured).toBe(false);
        expect(result.amenityIds).toEqual([]);
        expect(result.featureIds).toEqual([]);
        expect(result.seoTitle).toBe('');
        expect(result.seoDescription).toBe('');
        expect(result.videos).toEqual([]);
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

    it('should handle the catalog-projection shape the protected getById returns (HOS-321)', () => {
        // `GET /api/v1/protected/accommodations/:id` — the endpoint the host
        // editor loads its baseline from — emits catalog rows shaped by
        // `AmenityProtectedSchema` / `FeatureProtectedSchema`, which key the
        // row by `id` (NOT `amenityId`, and with no nested `amenity` object).
        // Before HOS-321 this shape produced empty selections, so every saved
        // amenity/feature rendered unchecked and the next save wiped them.
        const raw = {
            id: 'a4',
            amenities: [
                { id: 'am-1', slug: 'wifi' },
                { id: 'am-2', slug: 'pool' }
            ],
            features: [{ id: 'ft-1', slug: 'parking' }]
        };

        const result = transformAccommodationEdit({ item: raw });

        expect(result.amenityIds).toEqual(['am-1', 'am-2']);
        expect(result.featureIds).toEqual(['ft-1']);
    });

    it('prefers the junction key over a top-level id when a row carries both (HOS-321)', () => {
        // The `entry.id` fallback is appended LAST on purpose. A junction row
        // carrying its own `id` alongside `amenityId` must still resolve to the
        // catalog id — resolving to the junction-row id would produce a
        // well-formed but wrong selection that the exact-set sync then writes.
        const raw = {
            id: 'a5',
            amenities: [{ id: 'junction-row-1', amenityId: 'am-1' }],
            features: [{ id: 'junction-row-2', feature: { id: 'ft-1' } }]
        };

        const result = transformAccommodationEdit({ item: raw });

        expect(result.amenityIds).toEqual(['am-1']);
        expect(result.featureIds).toEqual(['ft-1']);
    });

    /**
     * HOS-792. The SEO section previews what the PUBLIC page will publish while
     * the override is empty, so these two fields must be computed with the
     * public page's rule, not with the editor's.
     *
     * The editor's own `name`/`summary` are the raw columns;
     * `transformAccommodationDetail` resolves `nameI18n ?? name` per locale.
     * Where those disagree — a rename that never re-translated, an i18n object
     * with no `es` — the editor would otherwise name a value Google never sees.
     */
    describe('SEO defaults previewed by the editor', () => {
        it('should prefer the i18n column over the raw one, like the public page', () => {
            const result = transformAccommodationEdit({
                item: {
                    name: 'Nombre crudo',
                    summary: 'Resumen crudo',
                    nameI18n: { es: 'Nombre publicado', en: 'Published name' },
                    summaryI18n: { es: 'Resumen publicado', en: 'Published summary' }
                }
            });

            expect(result.seoTitleDefault).toBe('Nombre publicado');
            expect(result.seoDescriptionDefault).toBe('Resumen publicado');
            // The editable columns are untouched — this change adds a preview,
            // it does not alter what the host edits.
            expect(result.name).toBe('Nombre crudo');
            expect(result.summary).toBe('Resumen crudo');
        });

        it('should fall back to the raw column when there is no i18n object', () => {
            const result = transformAccommodationEdit({
                item: { name: 'Solo crudo', summary: 'Resumen solo crudo' }
            });

            expect(result.seoTitleDefault).toBe('Solo crudo');
            expect(result.seoDescriptionDefault).toBe('Resumen solo crudo');
        });

        it('should pin the SOURCE locale, not whatever the host is editing in', () => {
            // The override only ever applies on `es`, so the preview is of the
            // Spanish page even for a host working in another language.
            const result = transformAccommodationEdit({
                item: {
                    name: 'crudo',
                    nameI18n: { es: 'Español', en: 'English', pt: 'Português' }
                }
            });

            expect(result.seoTitleDefault).toBe('Español');
        });

        it('should mirror the public cross-fall when the source locale is missing', () => {
            // Not the behaviour anyone would design, but it IS what the page
            // publishes: `resolveI18nText` falls through es → en → pt. Previewing
            // the Spanish column here would show a title that never ships.
            const result = transformAccommodationEdit({
                item: { name: 'Nombre en español', nameI18n: { en: 'Only English' } }
            });

            expect(result.seoTitleDefault).toBe('Only English');
        });

        it('should report a whitespace-only value as no default at all', () => {
            const result = transformAccommodationEdit({
                item: { name: '   ', summary: '\n\t ' }
            });

            expect(result.seoTitleDefault).toBe('');
            expect(result.seoDescriptionDefault).toBe('');
        });

        it('should report an empty default for a draft with nothing filled in', () => {
            const result = transformAccommodationEdit({ item: {} });

            expect(result.seoTitleDefault).toBe('');
            expect(result.seoDescriptionDefault).toBe('');
        });
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

    it('should read the grouping value from `type` (BETA-133: the real public amenities catalog shape)', () => {
        // AmenityPublicSchema exposes the AmenitiesTypeEnum value under `type`,
        // not `category` — the raw API response never actually carries `category`.
        const raw = [{ id: 'am-4', slug: 'pool', type: 'OUTDOORS' }];
        const result = transformAmenityList({ items: raw });
        expect(result[0].category).toBe('OUTDOORS');
    });

    it('should prefer `type` over `category` when both are present', () => {
        const raw = [{ id: 'am-5', slug: 'wifi', type: 'CONNECTIVITY', category: 'legacy' }];
        const result = transformAmenityList({ items: raw });
        expect(result[0].category).toBe('CONNECTIVITY');
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
