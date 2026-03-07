/**
 * Tests for src/lib/api/transforms.ts
 *
 * Covers all exported transform functions with happy paths, edge cases,
 * null/undefined fields, type coercion, nested objects, and array handling.
 */
import { describe, expect, it } from 'vitest';

import {
    toAccommodationCardProps,
    toAccommodationDetailedProps,
    toDestinationCardProps,
    toEventCardProps,
    toPostCardProps
} from '@/lib/api/transforms';

// --- Shared helpers ---

/** Builds a minimal media object with a featuredImage url. */
function makeMedia(url: string) {
    return { featuredImage: { url } };
}

// ---------------------------------------------------------------------------
// toAccommodationCardProps
// ---------------------------------------------------------------------------

describe('toAccommodationCardProps', () => {
    describe('happy path - full data', () => {
        it('should map all core fields correctly', () => {
            // Arrange
            const item = {
                id: 'acc-1',
                slug: 'cabaña-el-rio',
                name: 'Cabaña El Río',
                summary: 'Hermosa cabaña junto al río',
                type: 'CABIN',
                media: makeMedia('https://cdn.example.com/cabin.jpg'),
                averageRating: 4.5,
                reviewsCount: 12,
                location: { city: 'Concepción del Uruguay', state: 'Entre Ríos' },
                isFeatured: true,
                price: { price: 8500, currency: 'ARS' }
            };

            // Act
            const result = toAccommodationCardProps({ item });

            // Assert
            expect(result.id).toBe('acc-1');
            expect(result.slug).toBe('cabaña-el-rio');
            expect(result.name).toBe('Cabaña El Río');
            expect(result.summary).toBe('Hermosa cabaña junto al río');
            expect(result.type).toBe('CABIN');
            expect(result.featuredImage).toBe('https://cdn.example.com/cabin.jpg');
            expect(result.averageRating).toBe(4.5);
            expect(result.reviewsCount).toBe(12);
            expect(result.location).toEqual({
                city: 'Concepción del Uruguay',
                state: 'Entre Ríos'
            });
            expect(result.isFeatured).toBe(true);
            expect(result.price).toEqual({ amount: 8500, currency: 'ARS', period: 'noche' });
        });

        it('should extract amenities from relation array', () => {
            // Arrange
            const item = {
                id: 'acc-2',
                slug: 'hotel-test',
                amenities: [
                    {
                        amenity: {
                            slug: 'wifi',
                            name: 'WiFi',
                            description: 'Internet inalámbrico',
                            icon: 'wifi',
                            displayWeight: 90
                        }
                    },
                    {
                        amenity: {
                            slug: 'pool',
                            name: 'Pileta',
                            description: 'Piscina al aire libre',
                            icon: 'pool',
                            displayWeight: 70
                        }
                    }
                ]
            };

            // Act
            const result = toAccommodationCardProps({ item });

            // Assert
            expect(result.amenities).toHaveLength(2);
            expect(result.amenities?.[0]).toEqual({
                key: 'wifi',
                label: 'Internet inalámbrico',
                icon: 'wifi',
                displayWeight: 90
            });
            expect(result.amenities?.[1]).toEqual({
                key: 'pool',
                label: 'Piscina al aire libre',
                icon: 'pool',
                displayWeight: 70
            });
        });

        it('should extract features from relation array', () => {
            // Arrange
            const item = {
                id: 'acc-3',
                slug: 'hostel-test',
                features: [
                    {
                        feature: {
                            slug: 'king-bed',
                            name: 'Cama King',
                            description: 'Cama tamaño king',
                            icon: 'bed',
                            displayWeight: 80
                        }
                    }
                ]
            };

            // Act
            const result = toAccommodationCardProps({ item });

            // Assert
            expect(result.features).toHaveLength(1);
            expect(result.features?.[0]?.key).toBe('king-bed');
            expect(result.features?.[0]?.label).toBe('Cama tamaño king');
        });
    });

    describe('field aliases and fallbacks', () => {
        it('should fall back to description when summary is absent', () => {
            // Arrange
            const item = { id: 'a', slug: 's', description: 'A description' };

            // Act
            const result = toAccommodationCardProps({ item });

            // Assert
            expect(result.summary).toBe('A description');
        });

        it('should fall back to accommodationType when type is absent', () => {
            // Arrange
            const item = { id: 'a', slug: 's', accommodationType: 'HOSTEL' };

            // Act
            const result = toAccommodationCardProps({ item });

            // Assert
            expect(result.type).toBe('HOSTEL');
        });

        it('should fall back to ratingCount when reviewsCount is absent', () => {
            // Arrange
            const item = { id: 'a', slug: 's', ratingCount: 7 };

            // Act
            const result = toAccommodationCardProps({ item });

            // Assert
            expect(result.reviewsCount).toBe(7);
        });

        it('should use destination.name as city when location is absent', () => {
            // Arrange
            const item = { id: 'a', slug: 's', destination: { name: 'Colón' } };

            // Act
            const result = toAccommodationCardProps({ item });

            // Assert
            expect(result.location.city).toBe('Colón');
            expect(result.location.state).toBe('');
        });

        it('should default currency to ARS when price has no currency', () => {
            // Arrange
            const item = { id: 'a', slug: 's', price: { price: 5000 } };

            // Act
            const result = toAccommodationCardProps({ item });

            // Assert
            expect(result.price?.currency).toBe('ARS');
            expect(result.price?.period).toBe('noche');
        });
    });

    describe('edge cases - missing/null/undefined fields', () => {
        it('should handle empty object input with safe defaults', () => {
            // Act
            const result = toAccommodationCardProps({ item: {} });

            // Assert
            expect(result.id).toBe('');
            expect(result.slug).toBe('');
            expect(result.name).toBe('');
            expect(result.summary).toBe('');
            expect(result.type).toBe('');
            expect(result.averageRating).toBe(0);
            expect(result.reviewsCount).toBe(0);
            expect(result.location).toEqual({ city: '', state: '' });
            expect(result.isFeatured).toBe(false);
            expect(result.price).toBeUndefined();
            expect(result.amenities).toBeUndefined();
            expect(result.features).toBeUndefined();
        });

        it('should return undefined price when price is absent', () => {
            const result = toAccommodationCardProps({ item: { id: 'a', slug: 's' } });
            expect(result.price).toBeUndefined();
        });

        it('should return undefined price when price.price is null', () => {
            const item = { id: 'a', slug: 's', price: { price: null } };
            const result = toAccommodationCardProps({ item });
            expect(result.price).toBeUndefined();
        });

        it('should return undefined amenities when amenities is not an array', () => {
            const item = { id: 'a', slug: 's', amenities: 'wifi,pool' };
            const result = toAccommodationCardProps({ item });
            expect(result.amenities).toBeUndefined();
        });

        it('should return undefined amenities when all items have empty keys', () => {
            const item = {
                id: 'a',
                slug: 's',
                amenities: [{ amenity: { slug: '', name: '' } }]
            };
            const result = toAccommodationCardProps({ item });
            expect(result.amenities).toBeUndefined();
        });

        it('should use featuredImage fallback when no media', () => {
            const item = { id: 'a', slug: 's' };
            const result = toAccommodationCardProps({ item });
            expect(result.featuredImage).toBe('/images/placeholder-accommodation.svg');
        });

        it('should handle isFeatured=false correctly', () => {
            const item = { id: 'a', slug: 's', isFeatured: false };
            const result = toAccommodationCardProps({ item });
            expect(result.isFeatured).toBe(false);
        });
    });

    describe('type coercion', () => {
        it('should coerce numeric string id to string', () => {
            const item = { id: 123, slug: 's' };
            const result = toAccommodationCardProps({ item });
            expect(result.id).toBe('123');
        });

        it('should coerce averageRating from string to number', () => {
            const item = { id: 'a', slug: 's', averageRating: '3.8' };
            const result = toAccommodationCardProps({ item });
            expect(result.averageRating).toBe(3.8);
        });

        it('should coerce truthy isFeatured to boolean true', () => {
            const item = { id: 'a', slug: 's', isFeatured: 1 };
            const result = toAccommodationCardProps({ item });
            expect(result.isFeatured).toBe(true);
        });
    });

    describe('amenity relation - fallback label/key logic', () => {
        it('should use name as key when slug is missing', () => {
            const item = {
                id: 'a',
                slug: 's',
                amenities: [{ amenity: { name: 'Desayuno', description: 'Incluye desayuno' } }]
            };
            const result = toAccommodationCardProps({ item });
            expect(result.amenities?.[0]?.key).toBe('Desayuno');
        });

        it('should use displayWeight default of 50 when missing', () => {
            const item = {
                id: 'a',
                slug: 's',
                amenities: [{ amenity: { slug: 'breakfast', name: 'Desayuno' } }]
            };
            const result = toAccommodationCardProps({ item });
            expect(result.amenities?.[0]?.displayWeight).toBe(50);
        });
    });
});

// ---------------------------------------------------------------------------
// toAccommodationDetailedProps
// ---------------------------------------------------------------------------

describe('toAccommodationDetailedProps', () => {
    describe('happy path - full data', () => {
        it('should map all fields correctly with gallery images', () => {
            // Arrange
            const item = {
                id: 'acc-10',
                slug: 'hotel-boutique',
                name: 'Hotel Boutique',
                type: 'HOTEL',
                media: {
                    featuredImage: { url: 'https://cdn.example.com/hero.jpg' },
                    gallery: [
                        { url: 'https://cdn.example.com/img1.jpg' },
                        { url: 'https://cdn.example.com/img2.jpg' }
                    ]
                },
                location: { city: 'Gualeguaychú', state: 'Entre Ríos' },
                extraInfo: { capacity: 6, bedrooms: 3, beds: 4, bathrooms: 2 },
                averageRating: 4.8,
                reviewsCount: 35,
                price: { amount: 15000, currency: 'USD' },
                isFeatured: true
            };

            // Act
            const result = toAccommodationDetailedProps({ item });

            // Assert
            expect(result.id).toBe('acc-10');
            expect(result.slug).toBe('hotel-boutique');
            expect(result.name).toBe('Hotel Boutique');
            expect(result.type).toBe('HOTEL');
            expect(result.images).toEqual([
                'https://cdn.example.com/img1.jpg',
                'https://cdn.example.com/img2.jpg'
            ]);
            expect(result.location).toEqual({ city: 'Gualeguaychú', state: 'Entre Ríos' });
            expect(result.capacity).toBe(6);
            expect(result.bedrooms).toBe(3);
            expect(result.beds).toBe(4);
            expect(result.bathrooms).toBe(2);
            expect(result.averageRating).toBe(4.8);
            expect(result.reviewsCount).toBe(35);
            expect(result.price).toEqual({ amount: 15000, currency: 'USD' });
            expect(result.isFeatured).toBe(true);
        });

        it('should use featuredImage as sole image when gallery is empty', () => {
            // Arrange
            const item = {
                id: 'a',
                slug: 's',
                media: {
                    featuredImage: { url: 'https://cdn.example.com/hero.jpg' },
                    gallery: []
                }
            };

            // Act
            const result = toAccommodationDetailedProps({ item });

            // Assert
            expect(result.images).toEqual(['https://cdn.example.com/hero.jpg']);
        });
    });

    describe('price field aliases', () => {
        it('should map price.price as amount when price.amount is absent', () => {
            const item = { id: 'a', slug: 's', price: { price: 7500, currency: 'ARS' } };
            const result = toAccommodationDetailedProps({ item });
            expect(result.price).toEqual({ amount: 7500, currency: 'ARS' });
        });

        it('should default currency to ARS when price has no currency', () => {
            const item = { id: 'a', slug: 's', price: { amount: 3000 } };
            const result = toAccommodationDetailedProps({ item });
            expect(result.price?.currency).toBe('ARS');
        });

        it('should return undefined price when price is absent', () => {
            const item = { id: 'a', slug: 's' };
            const result = toAccommodationDetailedProps({ item });
            expect(result.price).toBeUndefined();
        });
    });

    describe('edge cases - missing/null/undefined fields', () => {
        it('should return safe defaults for empty object', () => {
            // Act
            const result = toAccommodationDetailedProps({ item: {} });

            // Assert
            expect(result.id).toBe('');
            expect(result.slug).toBe('');
            expect(result.name).toBe('');
            expect(result.type).toBe('');
            expect(result.averageRating).toBe(0);
            expect(result.reviewsCount).toBe(0);
            expect(result.isFeatured).toBe(false);
            expect(result.capacity).toBeUndefined();
            expect(result.bedrooms).toBeUndefined();
            expect(result.beds).toBeUndefined();
            expect(result.bathrooms).toBeUndefined();
            expect(result.price).toBeUndefined();
            expect(result.location).toEqual({ city: undefined, state: undefined });
        });

        it('should return undefined location fields when location object is absent', () => {
            const item = { id: 'a', slug: 's' };
            const result = toAccommodationDetailedProps({ item });
            expect(result.location.city).toBeUndefined();
            expect(result.location.state).toBeUndefined();
        });

        it('should use placeholder as single image when no media at all', () => {
            const item = { id: 'a', slug: 's' };
            const result = toAccommodationDetailedProps({ item });
            expect(result.images).toEqual(['/images/placeholder-accommodation.svg']);
        });

        it('should fall back to accommodationType when type is absent', () => {
            const item = { id: 'a', slug: 's', accommodationType: 'BUNGALOW' };
            const result = toAccommodationDetailedProps({ item });
            expect(result.type).toBe('BUNGALOW');
        });
    });

    describe('type coercion', () => {
        it('should coerce extraInfo capacity from string to number', () => {
            const item = { id: 'a', slug: 's', extraInfo: { capacity: '4' } };
            const result = toAccommodationDetailedProps({ item });
            expect(result.capacity).toBe(4);
        });

        it('should coerce averageRating from string to number', () => {
            const item = { id: 'a', slug: 's', averageRating: '4.2' };
            const result = toAccommodationDetailedProps({ item });
            expect(result.averageRating).toBe(4.2);
        });
    });

    describe('price.amount vs price.price branch coverage', () => {
        it('should use price.price as amount when price.amount is undefined (null coalescing branch)', () => {
            // Arrange: price has no `amount` field, only `price` - exercises the `?? priceData.price` branch
            const item = { id: 'a', slug: 's', price: { price: 9999, currency: 'USD' } };

            // Act
            const result = toAccommodationDetailedProps({ item });

            // Assert
            expect(result.price?.amount).toBe(9999);
            expect(result.price?.currency).toBe('USD');
        });

        it('should prefer price.amount over price.price when both are present', () => {
            const item = {
                id: 'a',
                slug: 's',
                price: { amount: 1234, price: 9999, currency: 'ARS' }
            };
            const result = toAccommodationDetailedProps({ item });
            expect(result.price?.amount).toBe(1234);
        });
    });
});

// ---------------------------------------------------------------------------
// toEventCardProps
// ---------------------------------------------------------------------------

describe('toEventCardProps', () => {
    describe('happy path - full data', () => {
        it('should map all event fields correctly', () => {
            // Arrange
            const item = {
                slug: 'carnaval-2026',
                name: 'Carnaval de Gualeguaychú 2026',
                summary: 'El carnaval más famoso de Argentina',
                media: makeMedia('https://cdn.example.com/carnaval.jpg'),
                category: 'FESTIVAL',
                date: { start: '2026-01-15', end: '2026-02-28' },
                isFeatured: true,
                location: { placeName: 'Corsódromo', city: 'Gualeguaychú' }
            };

            // Act
            const result = toEventCardProps({ item });

            // Assert
            expect(result.slug).toBe('carnaval-2026');
            expect(result.name).toBe('Carnaval de Gualeguaychú 2026');
            expect(result.summary).toBe('El carnaval más famoso de Argentina');
            expect(result.featuredImage).toBe('https://cdn.example.com/carnaval.jpg');
            expect(result.category).toBe('FESTIVAL');
            expect(result.date).toEqual({ start: '2026-01-15', end: '2026-02-28' });
            expect(result.isFeatured).toBe(true);
            expect(result.location).toEqual({ name: 'Corsódromo', city: 'Gualeguaychú' });
        });
    });

    describe('date field aliases', () => {
        it('should fall back to item.startDate when date.start is absent', () => {
            const item = { slug: 'e', startDate: '2026-03-10' };
            const result = toEventCardProps({ item });
            expect(result.date.start).toBe('2026-03-10');
        });

        it('should fall back to item.endDate when date.end is absent', () => {
            const item = { slug: 'e', date: { start: '2026-03-10' }, endDate: '2026-03-15' };
            const result = toEventCardProps({ item });
            expect(result.date.end).toBe('2026-03-15');
        });

        it('should return undefined date.end when no end date exists', () => {
            const item = { slug: 'e', date: { start: '2026-03-10' } };
            const result = toEventCardProps({ item });
            expect(result.date.end).toBeUndefined();
        });
    });

    describe('location field aliases', () => {
        it('should use location.name as fallback when placeName is absent', () => {
            const item = {
                slug: 'e',
                location: { name: 'Plaza Principal', city: 'Colón' }
            };
            const result = toEventCardProps({ item });
            expect(result.location?.name).toBe('Plaza Principal');
            expect(result.location?.city).toBe('Colón');
        });

        it('should return undefined location when location object is absent', () => {
            const item = { slug: 'e' };
            const result = toEventCardProps({ item });
            expect(result.location).toBeUndefined();
        });
    });

    describe('field aliases', () => {
        it('should fall back to description when summary is absent', () => {
            const item = { slug: 'e', description: 'Descripción del evento' };
            const result = toEventCardProps({ item });
            expect(result.summary).toBe('Descripción del evento');
        });
    });

    describe('edge cases - missing/null/undefined fields', () => {
        it('should handle empty object input with safe defaults', () => {
            // Act
            const result = toEventCardProps({ item: {} });

            // Assert
            expect(result.slug).toBe('');
            expect(result.name).toBe('');
            expect(result.summary).toBe('');
            expect(result.featuredImage).toBe('/images/placeholder-event.svg');
            expect(result.category).toBe('');
            expect(result.date).toEqual({ start: '', end: undefined });
            expect(result.isFeatured).toBe(false);
            expect(result.location).toBeUndefined();
        });
    });
});

// ---------------------------------------------------------------------------
// toDestinationCardProps
// ---------------------------------------------------------------------------

describe('toDestinationCardProps', () => {
    describe('happy path - full data', () => {
        it('should map all destination fields correctly', () => {
            // Arrange
            const item = {
                slug: 'colon',
                name: 'Colón',
                summary: 'Ciudad termal junto al río Uruguay',
                media: {
                    featuredImage: { url: 'https://cdn.example.com/colon.jpg' },
                    gallery: [
                        { url: 'https://cdn.example.com/g1.jpg', caption: 'Termas' },
                        { url: 'https://cdn.example.com/g2.jpg' }
                    ]
                },
                accommodationsCount: 45,
                isFeatured: true,
                path: '/destinos/colon',
                averageRating: 4.7,
                reviewsCount: 230,
                eventsCount: 12,
                attractions: [
                    { id: 'att-1', name: 'Termas', icon: 'hot-spring', displayWeight: 100 },
                    { id: 'att-2', name: 'Playa', icon: 'beach' }
                ],
                location: {
                    coordinates: { lat: '-32.2333', long: '-58.1500' }
                },
                rating: { cleanliness: 4.8, service: 4.6 }
            };

            // Act
            const result = toDestinationCardProps({ item });

            // Assert
            expect(result.slug).toBe('colon');
            expect(result.name).toBe('Colón');
            expect(result.summary).toBe('Ciudad termal junto al río Uruguay');
            expect(result.featuredImage).toBe('https://cdn.example.com/colon.jpg');
            expect(result.accommodationsCount).toBe(45);
            expect(result.isFeatured).toBe(true);
            expect(result.path).toBe('/destinos/colon');
            expect(result.averageRating).toBe(4.7);
            expect(result.reviewsCount).toBe(230);
            expect(result.eventsCount).toBe(12);
            expect(result.attractions).toEqual([
                { id: 'att-1', name: 'Termas', icon: 'hot-spring', displayWeight: 100 },
                { id: 'att-2', name: 'Playa', icon: 'beach', displayWeight: undefined }
            ]);
            expect(result.gallery).toEqual([
                { url: 'https://cdn.example.com/g1.jpg', caption: 'Termas' },
                { url: 'https://cdn.example.com/g2.jpg', caption: undefined }
            ]);
            expect(result.coordinates).toEqual({ lat: '-32.2333', long: '-58.1500' });
            expect(result.ratingDimensions).toEqual({ cleanliness: 4.8, service: 4.6 });
        });
    });

    describe('field aliases', () => {
        it('should fall back to description when summary is absent', () => {
            const item = { slug: 'd', description: 'Descripción del destino' };
            const result = toDestinationCardProps({ item });
            expect(result.summary).toBe('Descripción del destino');
        });

        it('should use slug as path fallback when path is absent', () => {
            const item = { slug: 'concordia' };
            const result = toDestinationCardProps({ item });
            expect(result.path).toBe('concordia');
        });

        it('should default name to "Sin nombre" when absent', () => {
            const item = { slug: 'd' };
            const result = toDestinationCardProps({ item });
            expect(result.name).toBe('Sin nombre');
        });
    });

    describe('coordinates handling', () => {
        it('should return undefined coordinates when both lat and long are missing', () => {
            const item = { slug: 'd', location: { coordinates: {} } };
            const result = toDestinationCardProps({ item });
            expect(result.coordinates).toBeUndefined();
        });

        it('should return undefined coordinates when only lat is present', () => {
            const item = { slug: 'd', location: { coordinates: { lat: '-32.2' } } };
            const result = toDestinationCardProps({ item });
            expect(result.coordinates).toBeUndefined();
        });

        it('should return undefined coordinates when location is absent', () => {
            const item = { slug: 'd' };
            const result = toDestinationCardProps({ item });
            expect(result.coordinates).toBeUndefined();
        });
    });

    describe('gallery handling', () => {
        it('should return empty gallery array when media.gallery is absent', () => {
            const item = { slug: 'd', media: {} };
            const result = toDestinationCardProps({ item });
            expect(result.gallery).toEqual([]);
        });

        it('should return empty gallery array when media is absent', () => {
            const item = { slug: 'd' };
            const result = toDestinationCardProps({ item });
            expect(result.gallery).toEqual([]);
        });

        it('should use empty string for url when gallery item url is missing', () => {
            const item = {
                slug: 'd',
                media: {
                    gallery: [{ caption: 'No url here' }]
                }
            };
            const result = toDestinationCardProps({ item });
            expect(result.gallery?.[0]?.url).toBe('');
        });
    });

    describe('attractions handling', () => {
        it('should return empty attractions array when attractions is absent', () => {
            const item = { slug: 'd' };
            const result = toDestinationCardProps({ item });
            expect(result.attractions).toEqual([]);
        });

        it('should return empty attractions array when attractions is empty', () => {
            const item = { slug: 'd', attractions: [] };
            const result = toDestinationCardProps({ item });
            expect(result.attractions).toEqual([]);
        });
    });

    describe('ratingDimensions handling', () => {
        it('should return undefined ratingDimensions when rating is absent', () => {
            const item = { slug: 'd' };
            const result = toDestinationCardProps({ item });
            expect(result.ratingDimensions).toBeUndefined();
        });
    });

    describe('edge cases - missing/null/undefined fields', () => {
        it('should handle empty object input with safe defaults', () => {
            // Act
            const result = toDestinationCardProps({ item: {} });

            // Assert
            expect(result.slug).toBe('');
            expect(result.name).toBe('Sin nombre');
            expect(result.summary).toBe('');
            expect(result.featuredImage).toBe('/images/placeholder-destination.svg');
            expect(result.accommodationsCount).toBe(0);
            expect(result.isFeatured).toBe(false);
            expect(result.path).toBe('');
            expect(result.averageRating).toBe(0);
            expect(result.reviewsCount).toBe(0);
            expect(result.eventsCount).toBe(0);
            expect(result.attractions).toEqual([]);
            expect(result.gallery).toEqual([]);
            expect(result.coordinates).toBeUndefined();
            expect(result.ratingDimensions).toBeUndefined();
        });
    });

    describe('type coercion', () => {
        it('should coerce accommodationsCount from string to number', () => {
            const item = { slug: 'd', accommodationsCount: '10' };
            const result = toDestinationCardProps({ item });
            expect(result.accommodationsCount).toBe(10);
        });

        it('should coerce eventsCount from string to number', () => {
            const item = { slug: 'd', eventsCount: '5' };
            const result = toDestinationCardProps({ item });
            expect(result.eventsCount).toBe(5);
        });
    });
});

// ---------------------------------------------------------------------------
// toPostCardProps
// ---------------------------------------------------------------------------

describe('toPostCardProps', () => {
    describe('happy path - full data', () => {
        it('should map all post fields correctly', () => {
            // Arrange
            const item = {
                slug: 'mejores-playas-er',
                title: 'Las mejores playas de Entre Ríos',
                summary: 'Guía completa de playas en la provincia',
                media: makeMedia('https://cdn.example.com/playas.jpg'),
                category: 'TURISMO',
                publishedAt: '2026-03-01T10:00:00Z',
                readingTimeMinutes: 8,
                authorName: 'María González',
                isFeatured: true,
                tags: ['playas', 'verano', 'entre-rios']
            };

            // Act
            const result = toPostCardProps({ item });

            // Assert
            expect(result.slug).toBe('mejores-playas-er');
            expect(result.title).toBe('Las mejores playas de Entre Ríos');
            expect(result.summary).toBe('Guía completa de playas en la provincia');
            expect(result.featuredImage).toBe('https://cdn.example.com/playas.jpg');
            expect(result.category).toBe('TURISMO');
            expect(result.publishedAt).toBe('2026-03-01T10:00:00Z');
            expect(result.readingTimeMinutes).toBe(8);
            expect(result.authorName).toBe('María González');
            expect(result.isFeatured).toBe(true);
            expect(result.tags).toEqual(['playas', 'verano', 'entre-rios']);
        });
    });

    describe('field aliases', () => {
        it('should fall back to content when summary is absent', () => {
            const item = { slug: 'p', content: 'Contenido del post' };
            const result = toPostCardProps({ item });
            expect(result.summary).toBe('Contenido del post');
        });
    });

    describe('tags handling', () => {
        it('should return undefined tags when tags is absent', () => {
            const item = { slug: 'p' };
            const result = toPostCardProps({ item });
            expect(result.tags).toBeUndefined();
        });

        it('should return undefined tags when tags is not an array', () => {
            const item = { slug: 'p', tags: 'not-an-array' };
            const result = toPostCardProps({ item });
            expect(result.tags).toBeUndefined();
        });

        it('should coerce array items to strings', () => {
            const item = { slug: 'p', tags: [1, 2, 'tres'] };
            const result = toPostCardProps({ item });
            expect(result.tags).toEqual(['1', '2', 'tres']);
        });

        it('should handle empty tags array', () => {
            const item = { slug: 'p', tags: [] };
            const result = toPostCardProps({ item });
            expect(result.tags).toEqual([]);
        });
    });

    describe('edge cases - missing/null/undefined fields', () => {
        it('should handle empty object input with safe defaults', () => {
            // Act
            const result = toPostCardProps({ item: {} });

            // Assert
            expect(result.slug).toBe('');
            expect(result.title).toBe('');
            expect(result.summary).toBe('');
            expect(result.featuredImage).toBe('/images/placeholder-post.svg');
            expect(result.category).toBe('');
            expect(result.publishedAt).toBe('');
            expect(result.readingTimeMinutes).toBe(0);
            expect(result.authorName).toBe('');
            expect(result.isFeatured).toBe(false);
            expect(result.tags).toBeUndefined();
        });
    });

    describe('type coercion', () => {
        it('should coerce readingTimeMinutes from string to number', () => {
            const item = { slug: 'p', readingTimeMinutes: '12' };
            const result = toPostCardProps({ item });
            expect(result.readingTimeMinutes).toBe(12);
        });

        it('should coerce isFeatured from truthy value to boolean', () => {
            const item = { slug: 'p', isFeatured: 1 };
            const result = toPostCardProps({ item });
            expect(result.isFeatured).toBe(true);
        });
    });
});
