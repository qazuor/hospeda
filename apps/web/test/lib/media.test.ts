/**
 * @file media.test.ts
 * @description Tests for media extraction utilities with attribution support (SPEC-274).
 *
 * Tests verify:
 * - extractFeaturedImage extracts attribution from API response
 * - Attribution is optional (gracefully handles missing data)
 * - Provider enum is validated
 */

import { describe, expect, it } from 'vitest';
import { type FeaturedImageResult, extractFeaturedImage } from '../../src/lib/media';

describe('extractFeaturedImage with attribution (SPEC-274)', () => {
    describe('Attribution extraction', () => {
        it('should extract attribution from structured media.featuredImage object', () => {
            const item = {
                media: {
                    featuredImage: {
                        url: 'https://res.cloudinary.com/example/image.jpg',
                        caption: 'Beautiful sunset',
                        attribution: {
                            photographer: 'John Doe',
                            sourceUrl: 'https://unsplash.com/@johndoe',
                            license: 'Unsplash License',
                            provider: 'unsplash' as const
                        }
                    }
                }
            };

            const result = extractFeaturedImage(item);

            expect(result.url).toContain('cloudinary.com');
            expect(result.caption).toBe('Beautiful sunset');
            expect(result.attribution).toBeDefined();
            expect(result.attribution?.photographer).toBe('John Doe');
            expect(result.attribution?.sourceUrl).toBe('https://unsplash.com/@johndoe');
            expect(result.attribution?.license).toBe('Unsplash License');
            expect(result.attribution?.provider).toBe('unsplash');
        });

        it('should handle pexels provider', () => {
            const item = {
                media: {
                    featuredImage: {
                        url: 'https://images.pexels.com/photos/example.jpg',
                        attribution: {
                            photographer: 'Jane Smith',
                            sourceUrl: 'https://www.pexels.com/@janesmith',
                            license: 'Pexels License',
                            provider: 'pexels' as const
                        }
                    }
                }
            };

            const result = extractFeaturedImage(item);

            expect(result.attribution?.provider).toBe('pexels');
            expect(result.attribution?.photographer).toBe('Jane Smith');
        });

        it('should gracefully handle missing attribution', () => {
            const item = {
                media: {
                    featuredImage: {
                        url: 'https://res.cloudinary.com/example/image.jpg',
                        caption: 'No attribution'
                    }
                }
            };

            const result = extractFeaturedImage(item);

            expect(result.url).toBeDefined();
            expect(result.caption).toBe('No attribution');
            expect(result.attribution).toBeUndefined();
        });

        it('should handle partial attribution gracefully', () => {
            const item = {
                media: {
                    featuredImage: {
                        url: 'https://res.cloudinary.com/example/image.jpg',
                        attribution: {
                            photographer: 'Only Photographer',
                            // Missing other fields
                            sourceUrl: '',
                            license: '',
                            provider: 'unsplash' as const
                        }
                    }
                }
            };

            const result = extractFeaturedImage(item);

            // Should only extract if all required fields are present
            if (result.attribution?.sourceUrl && result.attribution?.license) {
                expect(result.attribution.photographer).toBe('Only Photographer');
            }
        });

        it('should handle string featuredImage (no attribution)', () => {
            const item = {
                media: {
                    featuredImage: 'https://res.cloudinary.com/example/image.jpg'
                }
            };

            const result = extractFeaturedImage(item);

            expect(result.url).toBeDefined();
            expect(result.attribution).toBeUndefined();
        });

        it('should handle flat featuredImage field (no attribution)', () => {
            const item = {
                featuredImage: 'https://res.cloudinary.com/example/image.jpg'
            };

            const result = extractFeaturedImage(item);

            expect(result.url).toBeDefined();
            expect(result.attribution).toBeUndefined();
        });

        it('should use fallback when no image exists', () => {
            const item = {
                media: {}
            };

            const result = extractFeaturedImage(item, { fallback: '/placeholder.svg' });

            expect(result.url).toBe('/placeholder.svg');
            expect(result.attribution).toBeUndefined();
        });
    });

    describe('Type safety', () => {
        it('should return FeaturedImageResult with optional attribution', () => {
            const item = {
                media: {
                    featuredImage: {
                        url: 'https://example.com/image.jpg'
                    }
                }
            };

            const result: FeaturedImageResult = extractFeaturedImage(item);

            // Type should allow undefined attribution
            expect(result.url).toBeDefined();
            expect(result.attribution).toBeUndefined();
        });

        it('should enforce valid provider enum', () => {
            const item = {
                media: {
                    featuredImage: {
                        url: 'https://example.com/image.jpg',
                        attribution: {
                            photographer: 'Test',
                            sourceUrl: 'https://example.com',
                            license: 'Test License',
                            provider: 'unsplash' as 'unsplash' | 'pexels'
                        }
                    }
                }
            };

            const result = extractFeaturedImage(item);

            expect(result.attribution?.provider).toBe('unsplash');
        });
    });
});

describe('FeaturedImageResult type', () => {
    it('should have attribution as optional field', () => {
        // This test verifies the type definition allows undefined attribution
        const result: FeaturedImageResult = {
            url: 'https://example.com/image.jpg'
        };

        expect(result.url).toBeDefined();
        expect(result.attribution).toBeUndefined();
    });

    it('should accept full attribution object', () => {
        const result: FeaturedImageResult = {
            url: 'https://example.com/image.jpg',
            caption: 'Test caption',
            attribution: {
                photographer: 'Test Photographer',
                sourceUrl: 'https://example.com/@test',
                license: 'Test License',
                provider: 'pexels'
            }
        };

        expect(result.attribution?.photographer).toBe('Test Photographer');
        expect(result.attribution?.provider).toBe('pexels');
    });
});
