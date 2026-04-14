/**
 * @file transforms.test.ts
 * @description Unit tests for API response transform functions.
 */

import { describe, expect, it } from 'vitest';
import {
    toAccommodationCardProps,
    toDestinationCardProps,
    toEventCardProps,
    toPostCardProps,
    toTestimonialCardProps
} from '../../../src/lib/api/transforms';

describe('toAccommodationCardProps', () => {
    it('should transform a complete API item', () => {
        const item = {
            id: '123',
            slug: 'casa-del-rio',
            name: 'Casa del Río',
            summary: 'A beautiful place',
            type: 'hotel',
            averageRating: 4.5,
            reviewsCount: 10,
            isFeatured: true,
            location: { city: 'Colón', state: 'Entre Ríos' },
            price: { amount: 15000, currency: 'ARS' }
        };

        const result = toAccommodationCardProps({ item });

        expect(result.id).toBe('123');
        expect(result.slug).toBe('casa-del-rio');
        expect(result.name).toBe('Casa del Río');
        expect(result.type).toBe('hotel');
        expect(result.averageRating).toBe(4.5);
        expect(result.isFeatured).toBe(true);
        expect(result.location.city).toBe('Colón');
    });

    it('should handle missing fields with defaults', () => {
        const result = toAccommodationCardProps({ item: {} });

        expect(result.id).toBe('');
        expect(result.slug).toBe('');
        expect(result.name).toBe('');
        expect(result.averageRating).toBe(0);
        expect(result.isFeatured).toBe(false);
    });

    it('should extract price when present', () => {
        const item = { price: { amount: 5000, currency: 'USD' } };
        const result = toAccommodationCardProps({ item });

        expect(result.price).toBeDefined();
        expect(result.price?.amount).toBe(5000);
        expect(result.price?.currency).toBe('USD');
    });

    it('should return undefined price when no price data', () => {
        const result = toAccommodationCardProps({ item: {} });
        expect(result.price).toBeUndefined();
    });

    it('should fall back to destination name for city', () => {
        const item = { destination: { name: 'Colón' } };
        const result = toAccommodationCardProps({ item });
        expect(result.location.city).toBe('Colón');
    });
});

describe('toDestinationCardProps', () => {
    it('should transform destination data', () => {
        const item = {
            slug: 'colon',
            name: 'Colón',
            summary: 'Beautiful city',
            isFeatured: true,
            accommodationsCount: 15,
            averageRating: 4.2,
            reviewsCount: 50,
            eventsCount: 3
        };

        const result = toDestinationCardProps({ item });

        expect(result.slug).toBe('colon');
        expect(result.name).toBe('Colón');
        expect(result.isFeatured).toBe(true);
    });

    it('should handle missing fields with fallback defaults', () => {
        const result = toDestinationCardProps({ item: {} });
        expect(result.slug).toBe('');
        expect(result.name).toBeTruthy(); // Falls back to 'Sin nombre' or similar
        expect(result.accommodationsCount).toBe(0);
    });
});

describe('toEventCardProps', () => {
    it('should transform event data with dates', () => {
        const item = {
            slug: 'carnival-2026',
            name: 'Carnaval 2026',
            summary: 'Annual carnival',
            category: 'CARNIVAL',
            startDate: '2026-02-15',
            endDate: '2026-02-20',
            isFeatured: true
        };

        const result = toEventCardProps({ item });

        expect(result.slug).toBe('carnival-2026');
        expect(result.category).toBe('CARNIVAL');
        expect(result.date.start).toBeTruthy();
    });

    it('should handle missing fields', () => {
        const result = toEventCardProps({ item: {} });
        expect(result.slug).toBe('');
        expect(result.name).toBe('');
        expect(result.isFeatured).toBe(false);
    });
});

describe('toPostCardProps', () => {
    it('should transform blog post data', () => {
        const item = {
            slug: 'best-beaches',
            title: 'Best Beaches',
            summary: 'Top beaches guide',
            category: 'TOURISM',
            publishedAt: '2026-03-01',
            readingTimeMinutes: 5,
            isFeatured: false
        };

        const result = toPostCardProps({ item });

        expect(result.slug).toBe('best-beaches');
        expect(result.title).toBe('Best Beaches');
        expect(result.category).toBe('TOURISM');
    });

    it('should handle missing author', () => {
        const result = toPostCardProps({ item: {} });
        expect(result.authorName).toBe('');
    });
});

describe('toTestimonialCardProps', () => {
    it('should transform review/testimonial data', () => {
        const item = {
            id: 'rev-1',
            comment: 'Amazing stay!',
            rating: 5,
            userName: 'Carlos',
            entityName: 'Casa del Río'
        };

        const result = toTestimonialCardProps({ item });

        expect(result.id).toBe('rev-1');
        expect(result.quote).toBe('Amazing stay!');
        expect(result.rating).toBe(5);
        expect(result.reviewerName).toBe('Carlos');
    });

    it('should handle missing fields', () => {
        const result = toTestimonialCardProps({ item: {} });
        expect(result.id).toBe('');
        expect(result.rating).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// toAccommodationDetailPageProps
// ---------------------------------------------------------------------------

import { toAccommodationDetailPageProps } from '../../../src/lib/api/transforms';

describe('toAccommodationDetailPageProps', () => {
    /** Builds a full API item with all fields populated. */
    function makeFullItem(): Record<string, unknown> {
        return {
            id: 'acc-001',
            slug: 'cabin-retiro-soleado',
            name: 'Retiro Soleado',
            summary: 'A cozy cabin',
            description: 'Full description here',
            type: 'CABIN',
            isFeatured: true,
            createdAt: '2025-01-15T10:00:00.000Z',
            averageRating: 4.7,
            reviewsCount: 23,
            media: {
                images: ['/img/a.jpg', '/img/b.jpg'],
                videos: ['/vid/c.mp4']
            },
            location: { lat: -30.75, lng: -58.04 },
            destination: { id: 'dest-1', slug: 'colon', name: 'Colón' },
            price: { price: 16000, currency: 'ARS', additionalFees: null, discounts: null },
            extraInfo: {
                capacity: 4,
                bedrooms: 2,
                beds: 3,
                bathrooms: 1,
                minNights: 2,
                maxNights: 14,
                smokingAllowed: false
            },
            seo: { title: 'SEO Title', description: 'SEO description' },
            owner: {
                id: 'owner-1',
                name: 'María García',
                image: '/img/owner.jpg',
                createdAt: '2024-06-01T00:00:00.000Z'
            },
            amenities: [
                {
                    amenityId: 'am-1',
                    name: 'WiFi',
                    icon: 'wifi',
                    isOptional: false,
                    additionalCost: null
                }
            ],
            features: [
                {
                    featureId: 'ft-1',
                    name: 'Pool',
                    icon: 'pool',
                    hostReWriteName: 'Pileta',
                    comments: 'Heated'
                }
            ],
            faqs: [{ id: 'faq-1', question: 'Checkin?', answer: '14:00', category: 'general' }]
        };
    }

    // --- Happy path ---

    describe('Happy Path (full data)', () => {
        it('should map all scalar fields correctly', () => {
            const result = toAccommodationDetailPageProps({ item: makeFullItem() });

            expect(result.id).toBe('acc-001');
            expect(result.slug).toBe('cabin-retiro-soleado');
            expect(result.name).toBe('Retiro Soleado');
            expect(result.summary).toBe('A cozy cabin');
            expect(result.description).toBe('Full description here');
            expect(result.type).toBe('CABIN');
            expect(result.isFeatured).toBe(true);
            expect(result.createdAt).toBe('2025-01-15T10:00:00.000Z');
            expect(result.averageRating).toBe(4.7);
            expect(result.reviewsCount).toBe(23);
        });

        it('should map media images and videos', () => {
            const result = toAccommodationDetailPageProps({ item: makeFullItem() });
            expect(result.media.images).toEqual(['/img/a.jpg', '/img/b.jpg']);
            expect(result.media.videos).toEqual(['/vid/c.mp4']);
        });

        it('should map location with numeric lat/lng', () => {
            const result = toAccommodationDetailPageProps({ item: makeFullItem() });
            expect(result.location.lat).toBe(-30.75);
            expect(result.location.lng).toBe(-58.04);
        });

        it('should map destination nested object', () => {
            const result = toAccommodationDetailPageProps({ item: makeFullItem() });
            expect(result.destination).toEqual({ id: 'dest-1', slug: 'colon', name: 'Colón' });
        });

        it('should map price using price.price (not price.amount)', () => {
            const result = toAccommodationDetailPageProps({ item: makeFullItem() });
            expect(result.price).not.toBeNull();
            expect(result.price?.price).toBe(16000);
            expect(result.price?.currency).toBe('ARS');
        });

        it('should map extraInfo with all numeric fields', () => {
            const result = toAccommodationDetailPageProps({ item: makeFullItem() });
            expect(result.extraInfo?.capacity).toBe(4);
            expect(result.extraInfo?.bedrooms).toBe(2);
            expect(result.extraInfo?.bathrooms).toBe(1);
            expect(result.extraInfo?.smokingAllowed).toBe(false);
        });

        it('should map seo fields', () => {
            const result = toAccommodationDetailPageProps({ item: makeFullItem() });
            expect(result.seo?.title).toBe('SEO Title');
            expect(result.seo?.description).toBe('SEO description');
        });

        it('should map owner with all fields', () => {
            const result = toAccommodationDetailPageProps({ item: makeFullItem() });
            expect(result.owner.id).toBe('owner-1');
            expect(result.owner.name).toBe('María García');
            expect(result.owner.image).toBe('/img/owner.jpg');
            expect(result.owner.createdAt).toBe('2024-06-01T00:00:00.000Z');
        });

        it('should map amenities array', () => {
            const result = toAccommodationDetailPageProps({ item: makeFullItem() });
            expect(result.amenities).toHaveLength(1);
            expect(result.amenities[0]).toEqual({
                amenityId: 'am-1',
                name: 'WiFi',
                icon: 'wifi',
                isOptional: false,
                additionalCost: null
            });
        });

        it('should map features array', () => {
            const result = toAccommodationDetailPageProps({ item: makeFullItem() });
            expect(result.features).toHaveLength(1);
            expect(result.features[0]).toEqual({
                featureId: 'ft-1',
                name: 'Pool',
                icon: 'pool',
                hostReWriteName: 'Pileta',
                comments: 'Heated'
            });
        });

        it('should map faqs array', () => {
            const result = toAccommodationDetailPageProps({ item: makeFullItem() });
            expect(result.faqs).toHaveLength(1);
            expect(result.faqs[0]).toEqual({
                id: 'faq-1',
                question: 'Checkin?',
                answer: '14:00',
                category: 'general'
            });
        });
    });

    // --- Minimal / empty data ---

    describe('Minimal Data (empty item)', () => {
        it('should not throw on empty object', () => {
            expect(() => toAccommodationDetailPageProps({ item: {} })).not.toThrow();
        });

        it('should default scalar fields to empty strings or zero', () => {
            const result = toAccommodationDetailPageProps({ item: {} });
            expect(result.id).toBe('');
            expect(result.slug).toBe('');
            expect(result.name).toBe('');
            expect(result.type).toBe('');
            expect(result.averageRating).toBe(0);
            expect(result.reviewsCount).toBe(0);
            expect(result.isFeatured).toBe(false);
        });

        it('should default media to empty arrays', () => {
            const result = toAccommodationDetailPageProps({ item: {} });
            expect(result.media.images).toEqual([]);
            expect(result.media.videos).toEqual([]);
        });

        it('should default location to null lat/lng', () => {
            const result = toAccommodationDetailPageProps({ item: {} });
            expect(result.location.lat).toBeNull();
            expect(result.location.lng).toBeNull();
        });

        it('should default destination to empty strings', () => {
            const result = toAccommodationDetailPageProps({ item: {} });
            expect(result.destination.id).toBe('');
            expect(result.destination.slug).toBe('');
            expect(result.destination.name).toBe('');
        });

        it('should default price to null', () => {
            const result = toAccommodationDetailPageProps({ item: {} });
            expect(result.price).toBeNull();
        });

        it('should default extraInfo to null', () => {
            const result = toAccommodationDetailPageProps({ item: {} });
            expect(result.extraInfo).toBeNull();
        });

        it('should default seo to null', () => {
            const result = toAccommodationDetailPageProps({ item: {} });
            expect(result.seo).toBeNull();
        });

        it('should default owner name to Unknown', () => {
            const result = toAccommodationDetailPageProps({ item: {} });
            expect(result.owner.name).toBe('Unknown');
            expect(result.owner.id).toBe('');
            expect(result.owner.image).toBeNull();
        });

        it('should default amenities/features/faqs to empty arrays', () => {
            const result = toAccommodationDetailPageProps({ item: {} });
            expect(result.amenities).toEqual([]);
            expect(result.features).toEqual([]);
            expect(result.faqs).toEqual([]);
        });
    });

    // --- Null optional fields ---

    describe('Null Optional Fields', () => {
        it('should handle null price', () => {
            const result = toAccommodationDetailPageProps({ item: { price: null } });
            expect(result.price).toBeNull();
        });

        it('should handle null extraInfo', () => {
            const result = toAccommodationDetailPageProps({ item: { extraInfo: null } });
            expect(result.extraInfo).toBeNull();
        });

        it('should handle null seo', () => {
            const result = toAccommodationDetailPageProps({ item: { seo: null } });
            expect(result.seo).toBeNull();
        });

        it('should handle null owner image', () => {
            const result = toAccommodationDetailPageProps({
                item: { owner: { id: 'o1', name: 'Test', image: null, createdAt: '2025-01-01' } }
            });
            expect(result.owner.image).toBeNull();
        });

        it('should handle null amenity icon and additionalCost', () => {
            const result = toAccommodationDetailPageProps({
                item: {
                    amenities: [
                        {
                            amenityId: 'a1',
                            name: 'Pool',
                            icon: null,
                            isOptional: false,
                            additionalCost: null
                        }
                    ]
                }
            });
            expect(result.amenities[0].icon).toBeNull();
            expect(result.amenities[0].additionalCost).toBeNull();
        });

        it('should handle null faq category', () => {
            const result = toAccommodationDetailPageProps({
                item: { faqs: [{ id: 'f1', question: 'Q?', answer: 'A', category: null }] }
            });
            expect(result.faqs[0].category).toBeNull();
        });
    });

    // --- Price edge cases ---

    describe('Price Edge Cases', () => {
        it('should use price.price field, not price.amount', () => {
            const result = toAccommodationDetailPageProps({
                item: { price: { amount: 9999, price: 5000, currency: 'USD' } }
            });
            expect(result.price?.price).toBe(5000);
        });

        it('should handle price with null price value', () => {
            const result = toAccommodationDetailPageProps({
                item: { price: { price: null, currency: 'ARS' } }
            });
            expect(result.price?.price).toBeNull();
            expect(result.price?.currency).toBe('ARS');
        });
    });
});
