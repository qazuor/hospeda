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
