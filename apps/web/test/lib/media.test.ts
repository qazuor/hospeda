import { extractFeaturedImageUrl, extractGalleryUrls } from '@/lib/media';
/**
 * Tests for media.ts - Image/media URL extraction helpers.
 */
import { describe, expect, it } from 'vitest';

const DEFAULT_PLACEHOLDER = '/images/placeholder.svg';

describe('extractFeaturedImageUrl', () => {
    describe('media.featuredImage as object with url', () => {
        it('should extract url from nested media.featuredImage object', () => {
            // Arrange
            const item = {
                media: {
                    featuredImage: { url: 'https://example.com/photo.jpg', caption: 'Photo' }
                }
            };
            // Act
            const result = extractFeaturedImageUrl(item);
            // Assert
            expect(result).toBe('https://example.com/photo.jpg');
        });

        it('should return fallback when media.featuredImage.url is empty', () => {
            const item = { media: { featuredImage: { url: '' } } };
            expect(extractFeaturedImageUrl(item)).toBe(DEFAULT_PLACEHOLDER);
        });
    });

    describe('media.featuredImage as string', () => {
        it('should extract string featuredImage directly', () => {
            const item = { media: { featuredImage: 'https://example.com/direct.jpg' } };
            expect(extractFeaturedImageUrl(item)).toBe('https://example.com/direct.jpg');
        });
    });

    describe('flat top-level fallbacks', () => {
        it('should fall back to item.featuredImage when no media', () => {
            const item = { featuredImage: 'https://example.com/flat.jpg' };
            expect(extractFeaturedImageUrl(item)).toBe('https://example.com/flat.jpg');
        });

        it('should fall back to item.heroImage', () => {
            const item = { heroImage: 'https://example.com/hero.jpg' };
            expect(extractFeaturedImageUrl(item)).toBe('https://example.com/hero.jpg');
        });

        it('should fall back to item.image', () => {
            const item = { image: 'https://example.com/image.jpg' };
            expect(extractFeaturedImageUrl(item)).toBe('https://example.com/image.jpg');
        });

        it('should prioritize media.featuredImage over flat featuredImage', () => {
            const item = {
                media: { featuredImage: { url: 'https://example.com/media.jpg' } },
                featuredImage: 'https://example.com/flat.jpg'
            };
            expect(extractFeaturedImageUrl(item)).toBe('https://example.com/media.jpg');
        });
    });

    describe('default placeholder fallback', () => {
        it('should return the default placeholder when item has no images', () => {
            expect(extractFeaturedImageUrl({})).toBe(DEFAULT_PLACEHOLDER);
        });

        it('should return the default placeholder when media object is empty', () => {
            expect(extractFeaturedImageUrl({ media: {} })).toBe(DEFAULT_PLACEHOLDER);
        });

        it('should return the default placeholder when media is null-like values', () => {
            const item = { featuredImage: '', heroImage: '', image: '' };
            expect(extractFeaturedImageUrl(item)).toBe(DEFAULT_PLACEHOLDER);
        });
    });

    describe('custom fallback', () => {
        it('should use custom fallback URL when provided', () => {
            const custom = '/images/custom-fallback.png';
            expect(extractFeaturedImageUrl({}, custom)).toBe(custom);
        });
    });
});

describe('extractGalleryUrls', () => {
    it('should return an empty array when no media present', () => {
        expect(extractGalleryUrls({})).toEqual([]);
    });

    it('should return an empty array when gallery is empty', () => {
        expect(extractGalleryUrls({ media: { gallery: [] } })).toEqual([]);
    });

    it('should return an empty array when gallery is not an array', () => {
        expect(extractGalleryUrls({ media: { gallery: null } })).toEqual([]);
    });

    it('should extract urls from gallery objects', () => {
        // Arrange
        const item = {
            media: {
                gallery: [
                    { url: 'https://example.com/img1.jpg', caption: 'First' },
                    { url: 'https://example.com/img2.jpg' }
                ]
            }
        };
        // Act
        const result = extractGalleryUrls(item);
        // Assert
        expect(result).toEqual(['https://example.com/img1.jpg', 'https://example.com/img2.jpg']);
    });

    it('should filter out gallery items with empty/missing url', () => {
        const item = {
            media: {
                gallery: [
                    { url: 'https://example.com/img1.jpg' },
                    { url: '' },
                    { caption: 'no url here' }
                ]
            }
        };
        const result = extractGalleryUrls(item);
        expect(result).toEqual(['https://example.com/img1.jpg']);
    });

    it('should handle gallery with string items', () => {
        // The type supports string items via the map
        const item = {
            media: {
                gallery: ['https://example.com/a.jpg', 'https://example.com/b.jpg'] as unknown[]
            }
        };
        const result = extractGalleryUrls(item as Record<string, unknown>);
        expect(result).toEqual(['https://example.com/a.jpg', 'https://example.com/b.jpg']);
    });

    it('should return readonly array', () => {
        const item = { media: { gallery: [{ url: 'https://example.com/img.jpg' }] } };
        const result = extractGalleryUrls(item);
        expect(Array.isArray(result)).toBe(true);
    });
});
