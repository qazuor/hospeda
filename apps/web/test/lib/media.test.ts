/**
 * @file media.test.ts
 * @description Unit tests for media URL extraction utilities.
 */

import { describe, expect, it } from 'vitest';
import { extractFeaturedImageUrl, extractGalleryUrls } from '../../src/lib/media';

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
