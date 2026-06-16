/**
 * @file transforms.test.ts
 * @description Unit tests for API response transform functions.
 */

import { describe, expect, it } from 'vitest';
import {
    toAccommodationCardProps,
    toAccommodationDetailPageProps,
    toArticleCardProps,
    toDestinationCardProps,
    toEventCardProps,
    toEventDetailProps,
    toTestimonialCardProps,
    transformFavoritesBreakdown,
    transformOwnerPromotion,
    transformOwnerPromotionList,
    transformViewsDailySeries
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

    it('featuredImage should be an object with url and optional caption', () => {
        const item = {
            media: {
                featuredImage: { url: 'https://example.com/hotel.jpg', caption: 'Vista del lobby' }
            }
        };
        const result = toAccommodationCardProps({ item });
        expect(result.featuredImage).toEqual({
            url: 'https://example.com/hotel.jpg',
            caption: 'Vista del lobby'
        });
    });

    it('featuredImage.caption should be undefined when no caption on API media', () => {
        const item = {
            media: {
                featuredImage: { url: 'https://example.com/hotel.jpg' }
            }
        };
        const result = toAccommodationCardProps({ item });
        expect(result.featuredImage.url).toBe('https://example.com/hotel.jpg');
        expect(result.featuredImage.caption).toBeUndefined();
    });

    it('featuredImage.url should be fallback placeholder when no media found', () => {
        const result = toAccommodationCardProps({ item: {} });
        expect(result.featuredImage.url).toBe('/images/placeholder-accommodation.svg');
        expect(result.featuredImage.caption).toBeUndefined();
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

describe('toAccommodationDetailPageProps — SPEC-187 P2-T7', () => {
    it('passes richDescription through when present on the public API payload', () => {
        const item = {
            id: 'acc-001',
            slug: 'casa-premium',
            name: 'Casa Premium',
            summary: 'Resumen',
            description: 'Descripción simple',
            richDescription: '## Premium\n\n**luxury**',
            type: 'HOTEL',
            createdAt: '2026-01-01T00:00:00.000Z',
            owner: { id: 'owner-1', name: 'Owner', createdAt: '2026-01-01T00:00:00.000Z' }
        };

        const result = toAccommodationDetailPageProps({ item, locale: 'es' });

        expect(result.richDescription).toBe('## Premium\n\n**luxury**');
    });

    it('leaves richDescription undefined when the public payload omits it', () => {
        const item = {
            id: 'acc-001',
            slug: 'casa-free',
            name: 'Casa Free',
            summary: 'Resumen',
            description: 'Descripción simple',
            type: 'HOTEL',
            createdAt: '2026-01-01T00:00:00.000Z',
            owner: { id: 'owner-1', name: 'Owner', createdAt: '2026-01-01T00:00:00.000Z' }
        };

        const result = toAccommodationDetailPageProps({ item, locale: 'es' });

        expect(result.richDescription).toBeUndefined();
        expect(result.description).toBe('Descripción simple');
    });
});

describe('toDestinationCardProps', () => {
    it('should transform destination data', () => {
        const item = {
            id: 'e3b0c442-98fc-4c14-9e32-82b3e4b6b6a2',
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

        expect(result.id).toBe('e3b0c442-98fc-4c14-9e32-82b3e4b6b6a2');
        expect(result.slug).toBe('colon');
        expect(result.name).toBe('Colón');
        expect(result.isFeatured).toBe(true);
    });

    it('should propagate UUID id from API response (T-DC2: required for FavoriteButton entityId)', () => {
        // The UUID id is required by the bookmark service — sending slug instead
        // breaks the polymorphic foreign-key conceptual model.
        const item = {
            id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            slug: 'gualeguaychu',
            name: 'Gualeguaychú'
        };
        const result = toDestinationCardProps({ item });
        expect(result.id).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
        // id and slug must remain independent fields
        expect(result.id).not.toBe(result.slug);
    });

    it('should return empty string id and NOT throw when API response lacks id', () => {
        // Backwards-compatible: page still renders, but FavoriteButton will not work
        const item = { slug: 'no-id-destination', name: 'Sin ID' };
        const result = toDestinationCardProps({ item });
        expect(result.id).toBe('');
        expect(result.slug).toBe('no-id-destination');
    });

    it('should handle missing fields with fallback defaults', () => {
        const result = toDestinationCardProps({ item: {} });
        expect(result.id).toBe('');
        expect(result.slug).toBe('');
        expect(result.name).toBeTruthy(); // Falls back to 'Sin nombre' or similar
        expect(result.accommodationsCount).toBe(0);
    });

    it('featuredImage should carry caption from API media', () => {
        const item = {
            slug: 'colon',
            name: 'Colón',
            media: {
                featuredImage: {
                    url: 'https://example.com/colon.jpg',
                    caption: 'Río Uruguay al atardecer'
                }
            }
        };
        const result = toDestinationCardProps({ item });
        expect(result.featuredImage.url).toBe('https://example.com/colon.jpg');
        expect(result.featuredImage.caption).toBe('Río Uruguay al atardecer');
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

    it('featuredImage should carry caption from API media', () => {
        const item = {
            slug: 'evento',
            name: 'Evento Test',
            media: {
                featuredImage: {
                    url: 'https://example.com/evento.jpg',
                    caption: 'Escenario principal'
                }
            }
        };
        const result = toEventCardProps({ item });
        expect(result.featuredImage.url).toBe('https://example.com/evento.jpg');
        expect(result.featuredImage.caption).toBe('Escenario principal');
    });

    it('should propagate UUID id from API response (T-EC1: required for FavoriteButton entityId)', () => {
        // The UUID id is required by the bookmark service — sending slug instead
        // breaks the polymorphic foreign-key conceptual model.
        const item = {
            id: 'c3d4e5f6-a7b8-9012-cdef-3456789012ab',
            slug: 'festival-litoral-2026',
            name: 'Festival del Litoral 2026'
        };
        const result = toEventCardProps({ item });
        expect(result.id).toBe('c3d4e5f6-a7b8-9012-cdef-3456789012ab');
        // id and slug must remain independent fields
        expect(result.id).not.toBe(result.slug);
    });

    it('should return empty string id and NOT throw when API response lacks id', () => {
        // Backwards-compatible: page still renders, but FavoriteButton will not work
        const item = { slug: 'no-id-event', name: 'Sin ID' };
        const result = toEventCardProps({ item });
        expect(result.id).toBe('');
        expect(result.slug).toBe('no-id-event');
    });

    it('should include id in the returned object alongside all existing fields', () => {
        const item = {
            id: 'f1e2d3c4-b5a6-7890-fedc-ba9876543210',
            slug: 'carnaval-gualeguaychu',
            name: 'Carnaval de Gualeguaychú',
            summary: 'El mayor carnaval del país.',
            category: 'carnival',
            date: { start: '2026-02-01T20:00:00Z', end: '2026-03-01T04:00:00Z' },
            isFeatured: true
        };
        const result = toEventCardProps({ item });
        expect(result.id).toBe('f1e2d3c4-b5a6-7890-fedc-ba9876543210');
        expect(result.slug).toBe('carnaval-gualeguaychu');
        expect(result.name).toBe('Carnaval de Gualeguaychú');
        expect(result.category).toBe('carnival');
        expect(result.isFeatured).toBe(true);
    });
});

describe('toArticleCardProps', () => {
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

        const result = toArticleCardProps({ item });

        expect(result.slug).toBe('best-beaches');
        expect(result.title).toBe('Best Beaches');
        expect(result.category).toBe('TOURISM');
    });

    it('should handle missing author', () => {
        // Commit 7cf5dc1f8 ("fix(web): blog meta icons, sand badge, and author
        // fallback") deliberately changed the empty-author fallback from '' to
        // 'Equipo Hospeda' so the byline is never blank in the UI.
        const result = toArticleCardProps({ item: {} });
        expect(result.authorName).toBe('Equipo Hospeda');
    });

    it('featuredImage should carry caption from API media', () => {
        const item = {
            slug: 'post',
            title: 'Test Post',
            media: {
                featuredImage: {
                    url: 'https://example.com/post.jpg',
                    caption: 'Foto de portada'
                }
            }
        };
        const result = toArticleCardProps({ item });
        expect(result.featuredImage.url).toBe('https://example.com/post.jpg');
        expect(result.featuredImage.caption).toBe('Foto de portada');
    });

    it('featuredImage.url should be fallback placeholder when no media found', () => {
        const result = toArticleCardProps({ item: {} });
        expect(result.featuredImage.url).toBe('/assets/images/placeholder-blog.svg');
        expect(result.featuredImage.caption).toBeUndefined();
    });

    it('should propagate UUID id from API response (T-EC2: required for FavoriteButton entityId)', () => {
        // The UUID id is required by the bookmark service — sending slug instead
        // breaks the polymorphic foreign-key conceptual model.
        const item = {
            id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            slug: 'mejores-cabanas-entre-rios',
            title: 'Las 10 mejores cabañas de Entre Ríos'
        };
        const result = toArticleCardProps({ item });
        expect(result.id).toBe('f47ac10b-58cc-4372-a567-0e02b2c3d479');
        // id and slug must remain independent fields
        expect(result.id).not.toBe(result.slug);
    });

    it('should return empty string id and NOT throw when API response lacks id', () => {
        // Backwards-compatible: page still renders, but FavoriteButton will not work
        const item = { slug: 'no-id-post', title: 'Sin ID' };
        const result = toArticleCardProps({ item });
        expect(result.id).toBe('');
        expect(result.slug).toBe('no-id-post');
    });

    it('should include id in the returned object alongside all existing fields', () => {
        const item = {
            id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            slug: 'guia-playas-entre-rios',
            title: 'Guía de playas de Entre Ríos',
            summary: 'Las mejores playas del litoral argentino.',
            category: 'travel',
            publishedAt: '2026-04-01T09:00:00Z',
            readingTimeMinutes: 8,
            authorName: 'Pedro Sánchez',
            isFeatured: true
        };
        const result = toArticleCardProps({ item });
        expect(result.id).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
        expect(result.slug).toBe('guia-playas-entre-rios');
        expect(result.title).toBe('Guía de playas de Entre Ríos');
        expect(result.category).toBe('travel');
        expect(result.isFeatured).toBe(true);
        expect(result.readingTimeMinutes).toBe(8);
        expect(result.authorName).toBe('Pedro Sánchez');
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

        it('should map media images and normalize videos from legacy string array', () => {
            const result = toAccommodationDetailPageProps({ item: makeFullItem() });
            expect(result.media.images).toEqual(['/img/a.jpg', '/img/b.jpg']);
            // Legacy payload (bare strings) normalizes to `{ url }` objects so
            // consumers can read `entry.url` uniformly.
            expect(result.media.videos).toEqual([{ url: '/vid/c.mp4' }]);
        });

        it('should map videos from the new object payload preserving caption + description', () => {
            const item = {
                ...makeFullItem(),
                media: {
                    images: [],
                    videos: [
                        {
                            url: 'https://www.youtube.com/watch?v=abc',
                            caption: 'Tour 360',
                            description: 'Walk-through of the cabin',
                            moderationState: 'APPROVED'
                        }
                    ]
                }
            };
            const result = toAccommodationDetailPageProps({ item });
            expect(result.media.videos).toEqual([
                {
                    url: 'https://www.youtube.com/watch?v=abc',
                    caption: 'Tour 360',
                    description: 'Walk-through of the cabin'
                }
            ]);
        });

        it('should drop entries without a URL when normalizing videos', () => {
            const item = {
                ...makeFullItem(),
                media: {
                    images: [],
                    videos: [
                        'https://www.youtube.com/watch?v=ok',
                        '',
                        { caption: 'no url here' },
                        { url: 123 },
                        null
                    ]
                }
            };
            const result = toAccommodationDetailPageProps({ item });
            expect(result.media.videos).toEqual([{ url: 'https://www.youtube.com/watch?v=ok' }]);
        });

        it('should preserve caption and description in media.galleryItems (GAP-078-136)', () => {
            const item = {
                id: 'acc-002',
                slug: 'cabin-with-captions',
                name: 'Captioned Cabin',
                media: {
                    images: ['/img/x.jpg'],
                    videos: [],
                    gallery: [
                        {
                            url: 'https://example.com/1.jpg',
                            caption: 'Sunset view',
                            description: 'Captured at golden hour'
                        },
                        { url: 'https://example.com/2.jpg', caption: 'Main living area' }
                    ]
                }
            } satisfies Record<string, unknown>;
            const result = toAccommodationDetailPageProps({ item });
            expect(result.media.galleryItems).toHaveLength(2);
            expect(result.media.galleryItems[0]).toEqual({
                url: 'https://example.com/1.jpg',
                caption: 'Sunset view',
                description: 'Captured at golden hour'
            });
            expect(result.media.galleryItems[1]).toEqual({
                url: 'https://example.com/2.jpg',
                caption: 'Main living area'
            });
        });

        it('should fall back to an empty galleryItems array when no gallery exists', () => {
            const result = toAccommodationDetailPageProps({ item: makeFullItem() });
            expect(result.media.galleryItems).toEqual([]);
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
                additionalCost: null,
                displayWeight: 50
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
                comments: 'Heated',
                displayWeight: 50
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

describe('deriveCityFields integration (SPEC-095)', () => {
    const cityDestination = {
        id: 'a3bb189e-8bf9-4a1e-9adf-6e8c4d3b2a01',
        slug: 'concepcion-del-uruguay',
        name: 'Concepción del Uruguay',
        path: '/argentina/litoral/entre-rios/concepcion-del-uruguay'
    };

    it('toAccommodationCardProps reads cityName from cityDestination projection', () => {
        const result = toAccommodationCardProps({
            item: { id: '1', slug: 's', name: 'n', cityDestination }
        });
        expect(result.cityName).toBe('Concepción del Uruguay');
        expect(result.cityPath).toBe('/argentina/litoral/entre-rios/concepcion-del-uruguay');
        expect(result.cityDestinationSlug).toBe('concepcion-del-uruguay');
        expect(result.location.city).toBe('Concepción del Uruguay');
    });

    it('toAccommodationCardProps falls back to legacy destination.name', () => {
        const result = toAccommodationCardProps({
            item: { id: '1', slug: 's', name: 'n', destination: { name: 'Colón' } }
        });
        expect(result.cityName).toBe('Colón');
    });

    it('toAccommodationCardProps returns empty city fields when no source is present', () => {
        const result = toAccommodationCardProps({
            item: { id: '1', slug: 's', name: 'n' }
        });
        expect(result.cityName).toBe('');
        expect(result.cityPath).toBe('');
        expect(result.cityDestinationSlug).toBe('');
    });

    it('toEventCardProps reads cityName from event.location.cityDestination', () => {
        const result = toEventCardProps({
            item: {
                slug: 'evt',
                name: 'Festival',
                location: { placeName: 'Anfiteatro', cityDestination }
            }
        });
        expect(result.cityName).toBe('Concepción del Uruguay');
        expect(result.cityPath).toBe('/argentina/litoral/entre-rios/concepcion-del-uruguay');
        expect(result.location?.city).toBe('Concepción del Uruguay');
    });

    it('toEventCardProps returns empty cityName when location is absent', () => {
        const result = toEventCardProps({
            item: { slug: 'evt', name: 'Festival' }
        });
        expect(result.cityName).toBe('');
        expect(result.location).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// SPEC-018: displayWeight ordering
// ---------------------------------------------------------------------------

describe('SPEC-018 displayWeight ordering', () => {
    it('toAccommodationCardProps sorts amenities by displayWeight DESC', () => {
        const result = toAccommodationCardProps({
            item: {
                amenities: [
                    { amenity: { slug: 'soap', name: 'Soap', displayWeight: 10 } },
                    { amenity: { slug: 'wifi', name: 'WiFi', displayWeight: 90 } },
                    { amenity: { slug: 'pool', name: 'Pool', displayWeight: 80 } }
                ]
            }
        });
        const keys = result.amenities?.map((a) => a.key);
        expect(keys).toEqual(['wifi', 'pool', 'soap']);
    });

    it('toAccommodationCardProps sorts features by displayWeight DESC', () => {
        const result = toAccommodationCardProps({
            item: {
                features: [
                    { feature: { slug: 'tv', name: 'TV', displayWeight: 30 } },
                    { feature: { slug: 'view', name: 'Sea view', displayWeight: 70 } }
                ]
            }
        });
        const keys = result.features?.map((f) => f.key);
        expect(keys).toEqual(['view', 'tv']);
    });

    it('toAccommodationCardProps treats missing displayWeight as 50 default', () => {
        const result = toAccommodationCardProps({
            item: {
                amenities: [
                    { amenity: { slug: 'low', name: 'Low', displayWeight: 5 } },
                    { amenity: { slug: 'mid', name: 'Mid' } },
                    { amenity: { slug: 'high', name: 'High', displayWeight: 95 } }
                ]
            }
        });
        const keys = result.amenities?.map((a) => a.key);
        expect(keys).toEqual(['high', 'mid', 'low']);
    });

    it('toDestinationCardProps sorts attractions by displayWeight DESC', () => {
        const result = toDestinationCardProps({
            item: {
                slug: 'colon',
                name: 'Colón',
                attractions: [
                    { id: 'a1', name: 'Mini', icon: 'Star', displayWeight: 20 },
                    { id: 'a2', name: 'Top', icon: 'Star', displayWeight: 95 },
                    { id: 'a3', name: 'Mid', icon: 'Star', displayWeight: 60 }
                ]
            }
        });
        const ids = result.attractions.map((a) => a.id);
        expect(ids).toEqual(['a2', 'a3', 'a1']);
    });

    it('toAccommodationDetailPageProps sorts amenities/features by displayWeight DESC', () => {
        const result = toAccommodationDetailPageProps({
            item: {
                slug: 'casa',
                name: 'Casa',
                amenities: [
                    { amenityId: 'am1', name: 'Soap', displayWeight: 10 },
                    { amenityId: 'am2', name: 'WiFi', displayWeight: 90 }
                ],
                features: [
                    { featureId: 'f1', name: 'Tv', feature: { displayWeight: 25 } },
                    { featureId: 'f2', name: 'View', feature: { displayWeight: 80 } }
                ]
            }
        });
        expect(result.amenities.map((a) => a.amenityId)).toEqual(['am2', 'am1']);
        expect(result.features.map((f) => f.featureId)).toEqual(['f2', 'f1']);
    });
});

// ---------------------------------------------------------------------------
// Owner Promotions Transforms (SPEC-205)
// ---------------------------------------------------------------------------

describe('transformOwnerPromotion', () => {
    const fullItem = {
        id: 'promo-uuid-1',
        slug: 'summer-deal',
        ownerId: 'owner-uuid-1',
        accommodationId: 'acc-uuid-1',
        title: 'Summer Deal',
        description: 'Get 10% off this summer',
        discountType: 'percentage',
        discountValue: 10,
        minNights: 3,
        validFrom: '2026-07-01T00:00:00.000Z',
        validUntil: '2026-08-31T23:59:59.000Z',
        maxRedemptions: 100,
        currentRedemptions: 5,
        lifecycleState: 'ACTIVE',
        createdAt: '2026-06-01T10:00:00.000Z',
        updatedAt: '2026-06-10T12:00:00.000Z'
    };

    it('should transform a complete promotion item', () => {
        const result = transformOwnerPromotion({ item: fullItem });

        expect(result.id).toBe('promo-uuid-1');
        expect(result.slug).toBe('summer-deal');
        expect(result.ownerId).toBe('owner-uuid-1');
        expect(result.accommodationId).toBe('acc-uuid-1');
        expect(result.title).toBe('Summer Deal');
        expect(result.description).toBe('Get 10% off this summer');
        expect(result.discountType).toBe('percentage');
        expect(result.discountValue).toBe(10);
        expect(result.minNights).toBe(3);
        expect(result.validFrom).toBe('2026-07-01T00:00:00.000Z');
        expect(result.validUntil).toBe('2026-08-31T23:59:59.000Z');
        expect(result.maxRedemptions).toBe(100);
        expect(result.currentRedemptions).toBe(5);
        expect(result.lifecycleState).toBe('ACTIVE');
        expect(result.createdAt).toBe('2026-06-01T10:00:00.000Z');
        expect(result.updatedAt).toBe('2026-06-10T12:00:00.000Z');
    });

    it('should coerce null optional fields: accommodationId, description, validUntil, minNights, maxRedemptions', () => {
        const item = {
            ...fullItem,
            accommodationId: null,
            description: null,
            validUntil: null,
            minNights: null,
            maxRedemptions: null
        };
        const result = transformOwnerPromotion({ item });

        expect(result.accommodationId).toBeNull();
        expect(result.description).toBeNull();
        expect(result.validUntil).toBeNull();
        expect(result.minNights).toBeNull();
        expect(result.maxRedemptions).toBeNull();
    });

    it('should coerce absent optional fields to null', () => {
        const item = {
            id: 'promo-uuid-2',
            slug: 'flash-sale',
            ownerId: 'owner-uuid-2',
            title: 'Flash Sale',
            discountType: 'fixed',
            discountValue: 500,
            validFrom: '2026-09-01T00:00:00.000Z',
            currentRedemptions: 0,
            lifecycleState: 'DRAFT',
            createdAt: '2026-06-12T00:00:00.000Z',
            updatedAt: '2026-06-12T00:00:00.000Z'
        };
        const result = transformOwnerPromotion({ item });

        expect(result.accommodationId).toBeNull();
        expect(result.description).toBeNull();
        expect(result.validUntil).toBeNull();
        expect(result.minNights).toBeNull();
        expect(result.maxRedemptions).toBeNull();
        expect(result.discountType).toBe('fixed');
        expect(result.discountValue).toBe(500);
        expect(result.currentRedemptions).toBe(0);
    });

    it('should coerce numeric fields with Number()', () => {
        const item = {
            ...fullItem,
            discountValue: '15',
            minNights: '2',
            maxRedemptions: '50',
            currentRedemptions: '7'
        };
        const result = transformOwnerPromotion({ item });

        expect(result.discountValue).toBe(15);
        expect(result.minNights).toBe(2);
        expect(result.maxRedemptions).toBe(50);
        expect(result.currentRedemptions).toBe(7);
    });

    it('should pass through lifecycleState as string regardless of value', () => {
        const result = transformOwnerPromotion({
            item: { ...fullItem, lifecycleState: 'ARCHIVED' }
        });
        expect(result.lifecycleState).toBe('ARCHIVED');
    });

    it('should handle missing required fields with safe defaults', () => {
        const result = transformOwnerPromotion({ item: {} });

        expect(result.id).toBe('');
        expect(result.slug).toBe('');
        expect(result.title).toBe('');
        expect(result.discountValue).toBe(0);
        expect(result.currentRedemptions).toBe(0);
        expect(result.lifecycleState).toBe('DRAFT');
        expect(result.validFrom).toBe('');
        expect(result.createdAt).toBe('');
        expect(result.updatedAt).toBe('');
    });
});

describe('transformOwnerPromotionList', () => {
    it('should transform an array of promotion items', () => {
        const items = [
            {
                id: 'p1',
                slug: 'deal-1',
                ownerId: 'o1',
                accommodationId: null,
                title: 'Deal 1',
                description: null,
                discountType: 'percentage',
                discountValue: 10,
                minNights: null,
                validFrom: '2026-07-01T00:00:00.000Z',
                validUntil: null,
                maxRedemptions: null,
                currentRedemptions: 0,
                lifecycleState: 'ACTIVE',
                createdAt: '2026-06-01T00:00:00.000Z',
                updatedAt: '2026-06-01T00:00:00.000Z'
            },
            {
                id: 'p2',
                slug: 'deal-2',
                ownerId: 'o1',
                accommodationId: 'acc-1',
                title: 'Deal 2',
                description: 'A fixed discount',
                discountType: 'fixed',
                discountValue: 200,
                minNights: 2,
                validFrom: '2026-08-01T00:00:00.000Z',
                validUntil: '2026-08-31T00:00:00.000Z',
                maxRedemptions: 20,
                currentRedemptions: 3,
                lifecycleState: 'DRAFT',
                createdAt: '2026-06-05T00:00:00.000Z',
                updatedAt: '2026-06-06T00:00:00.000Z'
            }
        ];
        const result = transformOwnerPromotionList({ items });

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('p1');
        expect(result[0].accommodationId).toBeNull();
        expect(result[1].id).toBe('p2');
        expect(result[1].accommodationId).toBe('acc-1');
        expect(result[1].minNights).toBe(2);
    });

    it('should return an empty array for an empty items list', () => {
        const result = transformOwnerPromotionList({ items: [] });
        expect(result).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// SPEC-212 B-2: locale-aware i18n field resolution in transform functions
//
// Each transform that accepts `locale` must:
//   - Return the English value when locale='en' and nameI18n.en is non-empty
//   - Return the Portuguese value when locale='pt' and nameI18n.pt is non-empty
//   - Fall back to 'es' when the requested locale value is empty/missing
//   - Fall back to 'es' when the i18n object is absent entirely (AC-12)
// ---------------------------------------------------------------------------

describe('SPEC-212 locale-aware transform resolution', () => {
    /** Shared i18n fixture with translations for all three locales. */
    const nameI18n = { es: 'Cabaña del Río', en: 'River Cabin', pt: 'Cabana do Rio' };
    const summaryI18n = {
        es: 'Hermoso lugar',
        en: 'Beautiful place',
        pt: 'Lugar bonito'
    };

    describe('toAccommodationCardProps — nameI18n / summaryI18n', () => {
        it('returns English name when locale is en', () => {
            const result = toAccommodationCardProps({
                item: { nameI18n, summaryI18n },
                locale: 'en'
            });
            expect(result.name).toBe('River Cabin');
            expect(result.summary).toBe('Beautiful place');
        });

        it('returns Portuguese name when locale is pt', () => {
            const result = toAccommodationCardProps({
                item: { nameI18n, summaryI18n },
                locale: 'pt'
            });
            expect(result.name).toBe('Cabana do Rio');
            expect(result.summary).toBe('Lugar bonito');
        });

        it('returns Spanish name when locale is es (default)', () => {
            const result = toAccommodationCardProps({
                item: { nameI18n, summaryI18n }
                // locale omitted → default 'es'
            });
            expect(result.name).toBe('Cabaña del Río');
        });

        it('falls back to es when en value is empty', () => {
            const result = toAccommodationCardProps({
                item: { nameI18n: { es: 'Cabaña', en: '', pt: 'Cabana' } },
                locale: 'en'
            });
            expect(result.name).toBe('Cabaña');
        });

        it('falls back to es when i18n object is absent (AC-12)', () => {
            // No nameI18n at all — transforms falls back to item.name
            const result = toAccommodationCardProps({
                item: { name: 'Solo español' },
                locale: 'en'
            });
            expect(result.name).toBe('Solo español');
        });

        it('returns empty string when no name source exists at all', () => {
            const result = toAccommodationCardProps({
                item: {},
                locale: 'en'
            });
            expect(result.name).toBe('');
        });
    });

    describe('toDestinationCardProps — nameI18n / summaryI18n', () => {
        it('returns English name when locale is en', () => {
            const result = toDestinationCardProps({
                item: {
                    nameI18n: { es: 'Colón', en: 'Colón City', pt: 'Cidade de Colón' },
                    summaryI18n: {
                        es: 'Ciudad histórica',
                        en: 'Historic city',
                        pt: 'Cidade histórica'
                    }
                },
                locale: 'en'
            });
            expect(result.name).toBe('Colón City');
            expect(result.summary).toBe('Historic city');
        });

        it('returns Portuguese name when locale is pt', () => {
            const result = toDestinationCardProps({
                item: {
                    nameI18n: { es: 'Colón', en: 'Colón City', pt: 'Cidade de Colón' }
                },
                locale: 'pt'
            });
            expect(result.name).toBe('Cidade de Colón');
        });

        it('falls back to es when pt value is missing', () => {
            const result = toDestinationCardProps({
                item: {
                    nameI18n: { es: 'Colón', en: 'Colón City' }
                },
                locale: 'pt'
            });
            expect(result.name).toBe('Colón');
        });
    });

    describe('toEventCardProps — nameI18n / summaryI18n', () => {
        it('returns English title when locale is en', () => {
            const result = toEventCardProps({
                item: {
                    nameI18n: {
                        es: 'Festival de Verano',
                        en: 'Summer Festival',
                        pt: 'Festival de Verão'
                    },
                    summaryI18n: { es: 'Gran evento', en: 'Great event', pt: 'Grande evento' }
                },
                locale: 'en'
            });
            expect(result.name).toBe('Summer Festival');
            expect(result.summary).toBe('Great event');
        });

        it('returns Portuguese title when locale is pt', () => {
            const result = toEventCardProps({
                item: {
                    nameI18n: {
                        es: 'Festival de Verano',
                        en: 'Summer Festival',
                        pt: 'Festival de Verão'
                    }
                },
                locale: 'pt'
            });
            expect(result.name).toBe('Festival de Verão');
        });

        it('falls back to es when locale value is empty string', () => {
            const result = toEventCardProps({
                item: {
                    nameI18n: { es: 'Festival de Verano', en: '', pt: '' }
                },
                locale: 'en'
            });
            expect(result.name).toBe('Festival de Verano');
        });
    });

    describe('toArticleCardProps — titleI18n / summaryI18n', () => {
        it('returns English title when locale is en', () => {
            const result = toArticleCardProps({
                item: {
                    titleI18n: {
                        es: 'Guía de viaje',
                        en: 'Travel guide',
                        pt: 'Guia de viagem'
                    },
                    summaryI18n: {
                        es: 'Lo mejor de la región',
                        en: 'The best of the region',
                        pt: 'O melhor da região'
                    }
                },
                locale: 'en'
            });
            expect(result.title).toBe('Travel guide');
            expect(result.summary).toBe('The best of the region');
        });

        it('returns Portuguese title when locale is pt', () => {
            const result = toArticleCardProps({
                item: {
                    titleI18n: { es: 'Guía de viaje', en: 'Travel guide', pt: 'Guia de viagem' }
                },
                locale: 'pt'
            });
            expect(result.title).toBe('Guia de viagem');
        });

        it('falls back to es when i18n object is absent (AC-12)', () => {
            // No titleI18n — uses plain item.title
            const result = toArticleCardProps({
                item: { title: 'Solo en español' },
                locale: 'en'
            });
            expect(result.title).toBe('Solo en español');
        });
    });

    describe('toAccommodationDetailPageProps — nameI18n / summaryI18n / descriptionI18n', () => {
        it('returns English fields when locale is en', () => {
            const result = toAccommodationDetailPageProps({
                item: {
                    nameI18n: { es: 'Cabaña del Río', en: 'River Cabin', pt: 'Cabana do Rio' },
                    summaryI18n: { es: 'Hermoso lugar', en: 'Beautiful place', pt: 'Lugar bonito' },
                    descriptionI18n: {
                        es: 'Descripción completa',
                        en: 'Full description',
                        pt: 'Descrição completa'
                    }
                },
                locale: 'en'
            });
            expect(result.name).toBe('River Cabin');
            expect(result.summary).toBe('Beautiful place');
            expect(result.description).toBe('Full description');
        });

        it('returns Portuguese fields when locale is pt', () => {
            const result = toAccommodationDetailPageProps({
                item: {
                    nameI18n: { es: 'Cabaña del Río', en: 'River Cabin', pt: 'Cabana do Rio' },
                    descriptionI18n: {
                        es: 'Descripción completa',
                        en: 'Full description',
                        pt: 'Descrição completa'
                    }
                },
                locale: 'pt'
            });
            expect(result.name).toBe('Cabana do Rio');
            expect(result.description).toBe('Descrição completa');
        });

        it('falls back to es when the en value is empty (AC-12)', () => {
            const result = toAccommodationDetailPageProps({
                item: {
                    nameI18n: { es: 'Cabaña del Río', en: '', pt: 'Cabana do Rio' }
                },
                locale: 'en'
            });
            expect(result.name).toBe('Cabaña del Río');
        });
    });

    describe('toEventDetailProps — nameI18n / summaryI18n / descriptionI18n', () => {
        it('returns English fields when locale is en', () => {
            const result = toEventDetailProps({
                item: {
                    nameI18n: { es: 'Carnaval', en: 'Carnival', pt: 'Carnaval PT' },
                    summaryI18n: {
                        es: 'El evento más importante',
                        en: 'The most important event',
                        pt: 'O evento mais importante'
                    },
                    descriptionI18n: { es: 'Descripción', en: 'Description', pt: 'Descrição' }
                },
                locale: 'en'
            });
            expect(result.name).toBe('Carnival');
            expect(result.summary).toBe('The most important event');
            expect(result.description).toBe('Description');
        });

        it('returns Portuguese fields when locale is pt', () => {
            const result = toEventDetailProps({
                item: {
                    nameI18n: { es: 'Carnaval', en: 'Carnival', pt: 'Carnaval PT' }
                },
                locale: 'pt'
            });
            expect(result.name).toBe('Carnaval PT');
        });

        it('falls back to es when i18n object absent (AC-12)', () => {
            const result = toEventDetailProps({
                item: { name: 'Solo español' },
                locale: 'en'
            });
            expect(result.name).toBe('Solo español');
        });
    });
});

// ---------------------------------------------------------------------------
// transformFavoritesBreakdown
// ---------------------------------------------------------------------------

describe('transformFavoritesBreakdown', () => {
    it('resolves accommodation name from the names map', () => {
        const names = new Map([['acc-1', 'Casa del Río']]);
        const result = transformFavoritesBreakdown({
            favorites: [{ accommodationId: 'acc-1', slug: 'casa-del-rio', bookmarkCount: 10 }],
            names
        });
        expect(result.items).toHaveLength(1);
        expect(result.items[0].name).toBe('Casa del Río');
        expect(result.items[0].accommodationId).toBe('acc-1');
        expect(result.items[0].bookmarkCount).toBe(10);
    });

    it('falls back to slug when accommodation id is not in the names map', () => {
        const names = new Map<string, string>();
        const result = transformFavoritesBreakdown({
            favorites: [
                { accommodationId: 'acc-unknown', slug: 'mi-alojamiento', bookmarkCount: 5 }
            ],
            names
        });
        expect(result.items[0].name).toBe('mi-alojamiento');
    });

    it('sorts items by bookmarkCount descending', () => {
        const names = new Map([
            ['acc-1', 'Primero'],
            ['acc-2', 'Segundo'],
            ['acc-3', 'Tercero']
        ]);
        const result = transformFavoritesBreakdown({
            favorites: [
                { accommodationId: 'acc-1', slug: 'primero', bookmarkCount: 5 },
                { accommodationId: 'acc-2', slug: 'segundo', bookmarkCount: 20 },
                { accommodationId: 'acc-3', slug: 'tercero', bookmarkCount: 12 }
            ],
            names
        });
        expect(result.items[0].bookmarkCount).toBe(20);
        expect(result.items[1].bookmarkCount).toBe(12);
        expect(result.items[2].bookmarkCount).toBe(5);
    });

    it('returns empty items array when favorites is empty', () => {
        const result = transformFavoritesBreakdown({
            favorites: [],
            names: new Map()
        });
        expect(result.items).toHaveLength(0);
    });

    it('handles missing bookmarkCount gracefully (defaults to 0)', () => {
        const names = new Map([['acc-1', 'Test']]);
        const result = transformFavoritesBreakdown({
            favorites: [{ accommodationId: 'acc-1', slug: 'test' }],
            names
        });
        expect(result.items[0].bookmarkCount).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// transformViewsDailySeries (SPEC-207 Fase A)
// ---------------------------------------------------------------------------

describe('transformViewsDailySeries', () => {
    const mockSeries = {
        window: '7d',
        items: [
            { date: '2026-06-09', total: 3 },
            { date: '2026-06-10', total: 0 },
            { date: '2026-06-11', total: 7 },
            { date: '2026-06-12', total: 2 },
            { date: '2026-06-13', total: 5 },
            { date: '2026-06-14', total: 1 },
            { date: '2026-06-15', total: 4 }
        ]
    };

    it('returns correctly shaped HostViewDailySeriesData', () => {
        const result = transformViewsDailySeries({ series: mockSeries });
        expect(result.window).toBe('7d');
        expect(result.items).toHaveLength(7);
        expect(result.items[0]).toEqual({ date: '2026-06-09', total: 3 });
        expect(result.items[1]).toEqual({ date: '2026-06-10', total: 0 });
    });

    it('preserves server chronological order (does NOT re-sort)', () => {
        const reversed = {
            window: '7d',
            items: [
                { date: '2026-06-15', total: 10 },
                { date: '2026-06-14', total: 5 }
            ]
        };
        const result = transformViewsDailySeries({ series: reversed });
        // Items must remain in the original order — server is the authority on order
        expect(result.items[0].date).toBe('2026-06-15');
        expect(result.items[1].date).toBe('2026-06-14');
    });

    it('defaults window to "30d" when the wire value is unknown', () => {
        const result = transformViewsDailySeries({ series: { window: 'unexpected', items: [] } });
        expect(result.window).toBe('30d');
    });

    it('returns empty items array when items is missing', () => {
        const result = transformViewsDailySeries({ series: { window: '30d' } });
        expect(result.items).toHaveLength(0);
    });

    it('coerces non-number total to 0 defensively', () => {
        const result = transformViewsDailySeries({
            series: {
                window: '7d',
                items: [{ date: '2026-06-15', total: null }]
            }
        });
        expect(result.items[0].total).toBe(0);
    });

    it('coerces missing date to empty string defensively', () => {
        const result = transformViewsDailySeries({
            series: {
                window: '7d',
                items: [{ total: 5 }]
            }
        });
        expect(result.items[0].date).toBe('');
        expect(result.items[0].total).toBe(5);
    });

    it('handles 30d window correctly', () => {
        const items = Array.from({ length: 30 }, (_, i) => ({
            date: `2026-05-${String(i + 1).padStart(2, '0')}`,
            total: i
        }));
        const result = transformViewsDailySeries({ series: { window: '30d', items } });
        expect(result.window).toBe('30d');
        expect(result.items).toHaveLength(30);
    });
});
