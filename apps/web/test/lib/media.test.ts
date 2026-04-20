/**
 * @file media.test.ts
 * @description Unit tests for media URL extraction utilities.
 */

import { describe, expect, it } from 'vitest';
import {
    extractFeaturedImageUrl,
    extractGalleryItems,
    extractGalleryUrls
} from '../../src/lib/media';

describe('extractFeaturedImageUrl', () => {
    it('should extract URL from nested media.featuredImage object', () => {
        const item = {
            media: {
                featuredImage: { url: 'https://example.com/image.jpg', caption: 'Test' }
            }
        };
        expect(extractFeaturedImageUrl(item)).toBe('https://example.com/image.jpg');
    });

    it('should extract URL from media.featuredImage string', () => {
        const item = {
            media: {
                featuredImage: 'https://example.com/image.jpg'
            }
        };
        expect(extractFeaturedImageUrl(item)).toBe('https://example.com/image.jpg');
    });

    it('should fall back to top-level featuredImage', () => {
        const item = { featuredImage: 'https://example.com/direct.jpg' };
        expect(extractFeaturedImageUrl(item)).toBe('https://example.com/direct.jpg');
    });

    it('should fall back to heroImage', () => {
        const item = { heroImage: 'https://example.com/hero.jpg' };
        expect(extractFeaturedImageUrl(item)).toBe('https://example.com/hero.jpg');
    });

    it('should fall back to image', () => {
        const item = { image: 'https://example.com/img.jpg' };
        expect(extractFeaturedImageUrl(item)).toBe('https://example.com/img.jpg');
    });

    it('should return default placeholder when no image found', () => {
        expect(extractFeaturedImageUrl({})).toBe('/images/placeholder.svg');
    });

    it('should use custom fallback when provided', () => {
        expect(extractFeaturedImageUrl({}, '/custom.svg')).toBe('/custom.svg');
    });

    it('should ignore empty string values', () => {
        const item = { featuredImage: '' };
        expect(extractFeaturedImageUrl(item)).toBe('/images/placeholder.svg');
    });

    it('should honor options.fallback over positional fallback (GAP-078-061)', () => {
        // No image on the item — options.fallback must win over the positional param
        expect(
            extractFeaturedImageUrl({}, '/positional.svg', 'card', { fallback: '/options.svg' })
        ).toBe('/options.svg');
    });

    it('should use positional fallback when options.fallback is not provided (GAP-078-061)', () => {
        // Backward-compat: options present but no fallback key — positional still wins
        expect(extractFeaturedImageUrl({}, '/positional.svg', 'card', {})).toBe('/positional.svg');
    });

    it('should use DEFAULT_PLACEHOLDER when neither fallback nor options.fallback given (GAP-078-061)', () => {
        expect(extractFeaturedImageUrl({})).toBe('/images/placeholder.svg');
    });

    it('should NOT override the result when an image IS found, even if options.fallback is set (GAP-078-061)', () => {
        const item = { image: 'https://example.com/real.jpg' };
        const result = extractFeaturedImageUrl(item, '/positional.svg', 'card', {
            fallback: '/options.svg'
        });
        // The real image wins; fallback is never reached
        expect(result).toBe('https://example.com/real.jpg');
    });
});

describe('extractGalleryUrls', () => {
    it('should extract URLs from gallery array', () => {
        const item = {
            media: {
                gallery: [
                    { url: 'https://example.com/1.jpg' },
                    { url: 'https://example.com/2.jpg' }
                ]
            }
        };
        expect(extractGalleryUrls(item)).toEqual([
            'https://example.com/1.jpg',
            'https://example.com/2.jpg'
        ]);
    });

    it('should return empty array when no gallery', () => {
        expect(extractGalleryUrls({})).toEqual([]);
    });

    it('should return empty array when gallery is empty', () => {
        const item = { media: { gallery: [] } };
        expect(extractGalleryUrls(item)).toEqual([]);
    });

    it('should filter out items without valid URLs', () => {
        const item = {
            media: {
                gallery: [
                    { url: 'https://example.com/valid.jpg' },
                    { url: '' },
                    { caption: 'no url' }
                ]
            }
        };
        const result = extractGalleryUrls(item);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe('https://example.com/valid.jpg');
    });
});

describe('extractGalleryItems', () => {
    it('should return empty array when no gallery', () => {
        expect(extractGalleryItems({})).toEqual([]);
    });

    it('should preserve caption and description per entry (GAP-078-136)', () => {
        const item = {
            media: {
                gallery: [
                    {
                        url: 'https://example.com/a.jpg',
                        caption: 'Sunset over the lake',
                        description: 'Photo taken at golden hour'
                    },
                    { url: 'https://example.com/b.jpg', caption: 'Pool area' },
                    { url: 'https://example.com/c.jpg' }
                ]
            }
        };
        const result = extractGalleryItems(item);
        expect(result).toHaveLength(3);
        expect(result[0]).toEqual({
            url: 'https://example.com/a.jpg',
            caption: 'Sunset over the lake',
            description: 'Photo taken at golden hour'
        });
        expect(result[1]).toEqual({
            url: 'https://example.com/b.jpg',
            caption: 'Pool area'
        });
        expect(result[2]).toEqual({ url: 'https://example.com/c.jpg' });
    });

    it('should omit empty caption and description fields', () => {
        const item = {
            media: {
                gallery: [{ url: 'https://example.com/a.jpg', caption: '', description: '' }]
            }
        };
        const result = extractGalleryItems(item);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ url: 'https://example.com/a.jpg' });
        expect(result[0]).not.toHaveProperty('caption');
        expect(result[0]).not.toHaveProperty('description');
    });

    it('should transform Cloudinary URLs with the requested preset', () => {
        const item = {
            media: {
                gallery: [
                    {
                        url: 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg',
                        caption: 'Living room'
                    }
                ]
            }
        };
        const result = extractGalleryItems(item, 'card');
        expect(result).toHaveLength(1);
        expect(result[0].url).toContain('/upload/w_400,h_300');
        expect(result[0].url).toContain('/sample.jpg');
        expect(result[0].caption).toBe('Living room');
    });

    it('should accept string entries without captions', () => {
        const item: Record<string, unknown> = {
            media: {
                gallery: ['https://example.com/a.jpg', '', 'https://example.com/b.jpg']
            }
        };
        const result = extractGalleryItems(item);
        expect(result).toHaveLength(2);
        expect(result.map((r) => r.url)).toEqual([
            'https://example.com/a.jpg',
            'https://example.com/b.jpg'
        ]);
    });

    it('should filter out entries without a valid URL', () => {
        const item = {
            media: {
                gallery: [
                    { url: 'https://example.com/valid.jpg', caption: 'ok' },
                    { url: '' },
                    { caption: 'no url' }
                ]
            }
        };
        const result = extractGalleryItems(item);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ url: 'https://example.com/valid.jpg', caption: 'ok' });
    });
});
