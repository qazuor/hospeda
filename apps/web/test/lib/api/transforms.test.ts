import { describe, expect, it } from 'vitest';
import {
    toAccommodationCardProps,
    toAccommodationDetailedProps,
    toDestinationCardProps,
    toEventCardProps,
    toPostCardProps
} from '../../../src/lib/api/transforms';

// ─── toAccommodationCardProps ────────────────────────────────────────────────

describe('toAccommodationCardProps', () => {
    it('should transform a complete API item correctly', () => {
        const item: Record<string, unknown> = {
            id: '123',
            slug: 'cabin-lake',
            name: 'Cabin by the Lake',
            summary: 'A cozy cabin',
            type: 'cabin',
            media: { featuredImage: { url: '/img/cabin.jpg' } },
            averageRating: 4.5,
            reviewsCount: 12,
            location: { city: 'Concordia', state: 'Entre Rios' },
            isFeatured: true,
            price: { price: 15000, currency: 'ARS' },
            amenities: [
                {
                    amenity: {
                        slug: 'wifi',
                        name: 'WiFi',
                        description: 'WiFi gratis',
                        icon: 'wifi',
                        displayWeight: 10
                    }
                }
            ],
            features: [
                {
                    feature: {
                        slug: 'pool',
                        name: 'Pool',
                        description: 'Piscina',
                        icon: 'pool',
                        displayWeight: 20
                    }
                }
            ]
        };

        const result = toAccommodationCardProps({ item });

        expect(result.id).toBe('123');
        expect(result.slug).toBe('cabin-lake');
        expect(result.name).toBe('Cabin by the Lake');
        expect(result.summary).toBe('A cozy cabin');
        expect(result.type).toBe('cabin');
        expect(result.featuredImage).toBe('/img/cabin.jpg');
        expect(result.averageRating).toBe(4.5);
        expect(result.reviewsCount).toBe(12);
        expect(result.location).toEqual({ city: 'Concordia', state: 'Entre Rios' });
        expect(result.isFeatured).toBe(true);
        expect(result.price).toEqual({ amount: 15000, currency: 'ARS', period: 'noche' });
        expect(result.amenities).toEqual([
            { key: 'wifi', label: 'WiFi gratis', icon: 'wifi', displayWeight: 10 }
        ]);
        expect(result.features).toEqual([
            { key: 'pool', label: 'Piscina', icon: 'pool', displayWeight: 20 }
        ]);
    });

    it('should handle partial input with fallbacks', () => {
        const item: Record<string, unknown> = {
            slug: 'test',
            description: 'Fallback description',
            accommodationType: 'hotel',
            ratingCount: 5,
            destination: { name: 'CdU' }
        };

        const result = toAccommodationCardProps({ item });

        expect(result.id).toBe('');
        expect(result.summary).toBe('Fallback description');
        expect(result.type).toBe('hotel');
        expect(result.reviewsCount).toBe(5);
        expect(result.location.city).toBe('CdU');
        expect(result.price).toBeUndefined();
        expect(result.amenities).toBeUndefined();
        expect(result.features).toBeUndefined();
    });

    it('should handle empty input without throwing', () => {
        const result = toAccommodationCardProps({ item: {} });

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
    });

    it('should use default currency ARS when price has no currency', () => {
        const item: Record<string, unknown> = {
            price: { price: 5000 }
        };
        const result = toAccommodationCardProps({ item });
        expect(result.price).toEqual({ amount: 5000, currency: 'ARS', period: 'noche' });
    });

    it('should filter out amenities with empty keys', () => {
        const item: Record<string, unknown> = {
            amenities: [
                { amenity: { slug: 'wifi', name: 'WiFi' } },
                { amenity: {} },
                { amenity: { slug: '', name: '' } }
            ]
        };
        const result = toAccommodationCardProps({ item });
        expect(result.amenities).toHaveLength(1);
        expect(result.amenities?.[0]?.key).toBe('wifi');
    });
});

// ─── toAccommodationDetailedProps ────────────────────────────────────────────

describe('toAccommodationDetailedProps', () => {
    it('should transform a complete API item with gallery', () => {
        const item: Record<string, unknown> = {
            id: '456',
            slug: 'hotel-center',
            name: 'Hotel Center',
            type: 'hotel',
            media: {
                featuredImage: { url: '/img/hotel.jpg' },
                gallery: [{ url: '/img/g1.jpg' }, { url: '/img/g2.jpg' }]
            },
            location: { city: 'Gualeguaychu', state: 'Entre Rios' },
            extraInfo: { capacity: 4, bedrooms: 2, beds: 3, bathrooms: 1 },
            averageRating: 3.8,
            reviewsCount: 25,
            price: { amount: 20000, currency: 'USD' },
            isFeatured: false
        };

        const result = toAccommodationDetailedProps({ item });

        expect(result.id).toBe('456');
        expect(result.images).toEqual(['/img/g1.jpg', '/img/g2.jpg']);
        expect(result.capacity).toBe(4);
        expect(result.bedrooms).toBe(2);
        expect(result.beds).toBe(3);
        expect(result.bathrooms).toBe(1);
        expect(result.price).toEqual({ amount: 20000, currency: 'USD' });
        expect(result.isFeatured).toBe(false);
    });

    it('should fall back to featured image when gallery is empty', () => {
        const item: Record<string, unknown> = {
            media: { featuredImage: { url: '/img/featured.jpg' }, gallery: [] }
        };
        const result = toAccommodationDetailedProps({ item });
        expect(result.images).toEqual(['/img/featured.jpg']);
    });

    it('should handle empty input', () => {
        const result = toAccommodationDetailedProps({ item: {} });

        expect(result.id).toBe('');
        expect(result.images).toEqual(['/images/placeholder-accommodation.svg']);
        expect(result.capacity).toBeUndefined();
        expect(result.bedrooms).toBeUndefined();
        expect(result.price).toBeUndefined();
    });

    it('should handle price with "price" field instead of "amount"', () => {
        const item: Record<string, unknown> = {
            price: { price: 10000 }
        };
        const result = toAccommodationDetailedProps({ item });
        expect(result.price).toEqual({ amount: 10000, currency: 'ARS' });
    });
});

// ─── toEventCardProps ────────────────────────────────────────────────────────

describe('toEventCardProps', () => {
    it('should transform a complete API item correctly', () => {
        const item: Record<string, unknown> = {
            slug: 'carnival-2026',
            name: 'Carnival 2026',
            summary: 'Annual carnival',
            media: { featuredImage: { url: '/img/carnival.jpg' } },
            category: 'festival',
            startDate: '2026-02-14',
            endDate: '2026-02-28',
            isFeatured: true,
            location: { name: 'Corsodromo', city: 'Gualeguaychu' }
        };

        const result = toEventCardProps({ item });

        expect(result.slug).toBe('carnival-2026');
        expect(result.name).toBe('Carnival 2026');
        expect(result.summary).toBe('Annual carnival');
        expect(result.featuredImage).toBe('/img/carnival.jpg');
        expect(result.category).toBe('festival');
        expect(result.date).toEqual({ start: '2026-02-14', end: '2026-02-28' });
        expect(result.isFeatured).toBe(true);
        expect(result.location).toEqual({ name: 'Corsodromo', city: 'Gualeguaychu' });
    });

    it('should handle date object format (date.start/end)', () => {
        const item: Record<string, unknown> = {
            slug: 'test',
            date: { start: '2026-03-01', end: '2026-03-02' }
        };
        const result = toEventCardProps({ item });
        expect(result.date).toEqual({ start: '2026-03-01', end: '2026-03-02' });
    });

    it('should handle location with placeName', () => {
        const item: Record<string, unknown> = {
            slug: 'test',
            location: { placeName: 'Teatro Municipal', city: 'CdU' }
        };
        const result = toEventCardProps({ item });
        expect(result.location).toEqual({ name: 'Teatro Municipal', city: 'CdU' });
    });

    it('should handle empty input', () => {
        const result = toEventCardProps({ item: {} });

        expect(result.slug).toBe('');
        expect(result.name).toBe('');
        expect(result.date).toEqual({ start: '', end: undefined });
        expect(result.location).toBeUndefined();
    });

    it('should use description as summary fallback', () => {
        const item: Record<string, unknown> = {
            slug: 'test',
            description: 'A description'
        };
        const result = toEventCardProps({ item });
        expect(result.summary).toBe('A description');
    });
});

// ─── toDestinationCardProps ──────────────────────────────────────────────────

describe('toDestinationCardProps', () => {
    it('should transform a complete API item correctly', () => {
        const item: Record<string, unknown> = {
            slug: 'gualeguaychu',
            name: 'Gualeguaychu',
            summary: 'City of Carnival',
            media: {
                featuredImage: { url: '/img/gchu.jpg' },
                gallery: [{ url: '/img/g1.jpg', caption: 'Photo 1' }]
            },
            accommodationsCount: 15,
            isFeatured: true,
            path: 'entre-rios/gualeguaychu',
            averageRating: 4.2,
            reviewsCount: 50,
            eventsCount: 3,
            attractions: [{ id: 'a1', name: 'Carnival', icon: 'mask' }],
            location: { coordinates: { lat: '-33.0', long: '-58.5' } },
            rating: { landscape: 4, gastronomy: 3 }
        };

        const result = toDestinationCardProps({ item });

        expect(result.slug).toBe('gualeguaychu');
        expect(result.name).toBe('Gualeguaychu');
        expect(result.summary).toBe('City of Carnival');
        expect(result.featuredImage).toBe('/img/gchu.jpg');
        expect(result.accommodationsCount).toBe(15);
        expect(result.isFeatured).toBe(true);
        expect(result.path).toBe('entre-rios/gualeguaychu');
        expect(result.averageRating).toBe(4.2);
        expect(result.reviewsCount).toBe(50);
        expect(result.eventsCount).toBe(3);
        expect(result.attractions).toEqual([{ id: 'a1', name: 'Carnival', icon: 'mask' }]);
        expect(result.gallery).toEqual([{ url: '/img/g1.jpg', caption: 'Photo 1' }]);
        expect(result.coordinates).toEqual({ lat: '-33.0', long: '-58.5' });
        expect(result.ratingDimensions).toEqual({ landscape: 4, gastronomy: 3 });
    });

    it('should handle minimal input with defaults', () => {
        const item: Record<string, unknown> = {
            slug: 'test-dest'
        };

        const result = toDestinationCardProps({ item });

        expect(result.slug).toBe('test-dest');
        expect(result.name).toBe('Sin nombre');
        expect(result.accommodationsCount).toBe(0);
        expect(result.isFeatured).toBe(false);
        expect(result.path).toBe('test-dest');
        expect(result.attractions).toEqual([]);
        expect(result.gallery).toEqual([]);
        expect(result.coordinates).toBeUndefined();
        expect(result.ratingDimensions).toBeUndefined();
    });

    it('should handle empty input', () => {
        const result = toDestinationCardProps({ item: {} });

        expect(result.slug).toBe('');
        expect(result.name).toBe('Sin nombre');
        expect(result.path).toBe('');
    });

    it('should use description as summary fallback', () => {
        const item: Record<string, unknown> = {
            slug: 'test',
            description: 'A description'
        };
        const result = toDestinationCardProps({ item });
        expect(result.summary).toBe('A description');
    });
});

// ─── toPostCardProps ─────────────────────────────────────────────────────────

describe('toPostCardProps', () => {
    it('should transform a complete API item correctly', () => {
        const item: Record<string, unknown> = {
            slug: 'best-beaches',
            title: 'Best Beaches in Entre Rios',
            summary: 'Discover the top beaches',
            media: { featuredImage: { url: '/img/beaches.jpg' } },
            category: 'travel',
            publishedAt: '2026-01-15',
            readingTimeMinutes: 5,
            authorName: 'Juan Perez',
            isFeatured: true,
            tags: ['beaches', 'summer']
        };

        const result = toPostCardProps({ item });

        expect(result.slug).toBe('best-beaches');
        expect(result.title).toBe('Best Beaches in Entre Rios');
        expect(result.summary).toBe('Discover the top beaches');
        expect(result.featuredImage).toBe('/img/beaches.jpg');
        expect(result.category).toBe('travel');
        expect(result.publishedAt).toBe('2026-01-15');
        expect(result.readingTimeMinutes).toBe(5);
        expect(result.authorName).toBe('Juan Perez');
        expect(result.isFeatured).toBe(true);
        expect(result.tags).toEqual(['beaches', 'summer']);
    });

    it('should handle partial input with fallbacks', () => {
        const item: Record<string, unknown> = {
            slug: 'test',
            content: 'Fallback content'
        };

        const result = toPostCardProps({ item });

        expect(result.summary).toBe('Fallback content');
        expect(result.readingTimeMinutes).toBe(0);
        expect(result.authorName).toBe('');
        expect(result.tags).toBeUndefined();
    });

    it('should handle empty input', () => {
        const result = toPostCardProps({ item: {} });

        expect(result.slug).toBe('');
        expect(result.title).toBe('');
        expect(result.readingTimeMinutes).toBe(0);
        expect(result.isFeatured).toBe(false);
        expect(result.tags).toBeUndefined();
    });

    it('should convert tag values to strings', () => {
        const item: Record<string, unknown> = {
            slug: 'test',
            tags: [123, 'text', null]
        };
        const result = toPostCardProps({ item });
        expect(result.tags).toEqual(['123', 'text', 'null']);
    });
});
