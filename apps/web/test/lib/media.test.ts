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
import {
    buildImageEndpointUrl,
    extractFeaturedImage,
    extractGalleryItems,
    type FeaturedImageResult,
    isCloudinaryDeliveryUrl
} from '../../src/lib/media';

describe('isCloudinaryDeliveryUrl', () => {
    it('returns true for a real Cloudinary delivery URL', () => {
        expect(
            isCloudinaryDeliveryUrl('https://res.cloudinary.com/demo/image/upload/v1/sample.jpg')
        ).toBe(true);
    });

    it('returns false for lookalike or non-Cloudinary hosts', () => {
        expect(
            isCloudinaryDeliveryUrl(
                'https://res.cloudinary.com.evil.example/image/upload/v1/sample.jpg'
            )
        ).toBe(false);
        expect(isCloudinaryDeliveryUrl('https://images.unsplash.com/photo-abc')).toBe(false);
    });

    it('returns false for malformed URLs', () => {
        expect(isCloudinaryDeliveryUrl('/assets/images/placeholder.svg')).toBe(false);
        expect(isCloudinaryDeliveryUrl('not-a-url')).toBe(false);
    });
});

describe('buildImageEndpointUrl', () => {
    it('builds an Astro image endpoint URL with width and format params', () => {
        expect(
            buildImageEndpointUrl({
                src: 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg',
                width: 300,
                format: 'webp'
            })
        ).toBe(
            '/_image/?href=https%3A%2F%2Fres.cloudinary.com%2Fdemo%2Fimage%2Fupload%2Fv1%2Fsample.jpg&w=300&f=webp'
        );
    });

    it('adds height when provided', () => {
        expect(
            buildImageEndpointUrl({
                src: 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg',
                width: 300,
                height: 200,
                format: 'webp'
            })
        ).toContain('&h=200');
    });
});

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

        it('should keep the photographer when the other fields are blank', () => {
            const item = {
                media: {
                    featuredImage: {
                        url: 'https://res.cloudinary.com/example/image.jpg',
                        attribution: {
                            photographer: 'Only Photographer',
                            // Blank strings are not credits — they must be dropped
                            // WITHOUT taking the photographer down with them.
                            sourceUrl: '',
                            license: '',
                            provider: 'unsplash' as const
                        }
                    }
                }
            };

            const result = extractFeaturedImage(item);

            expect(result.attribution).toBeDefined();
            expect(result.attribution?.photographer).toBe('Only Photographer');
            expect(result.attribution?.sourceUrl).toBeUndefined();
            expect(result.attribution?.license).toBeUndefined();
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

/**
 * H-125 (attribution half). The host-facing editor can now write a photo
 * credit, the API persists it and `AccommodationPublicSchema` serialises it —
 * but `extractGalleryItems` used to drop it on the floor, exactly the way it
 * dropped `alt` before. These tests pin the READ path: a credit the host typed
 * has to survive extraction, or the whole write surface is decorative.
 */
describe('gallery attribution survives extraction (H-125)', () => {
    it('preserves a host-written credit on a gallery photo', () => {
        const item = {
            media: {
                gallery: [
                    {
                        url: 'https://res.cloudinary.com/example/a.jpg',
                        caption: 'Galería al río',
                        attribution: {
                            photographer: 'Estudio Paraná',
                            sourceUrl: 'https://estudioparana.com.ar',
                            provider: 'user-upload' as const
                        }
                    }
                ]
            }
        };

        const [first] = extractGalleryItems(item);

        expect(first?.attribution).toBeDefined();
        expect(first?.attribution?.photographer).toBe('Estudio Paraná');
        expect(first?.attribution?.sourceUrl).toBe('https://estudioparana.com.ar');
        expect(first?.attribution?.provider).toBe('user-upload');
    });

    it('preserves a credit that carries only the photographer', () => {
        const item = {
            media: {
                gallery: [
                    {
                        url: 'https://res.cloudinary.com/example/a.jpg',
                        attribution: { photographer: 'Ana Gómez' }
                    }
                ]
            }
        };

        const [first] = extractGalleryItems(item);

        expect(first?.attribution?.photographer).toBe('Ana Gómez');
        expect(first?.attribution?.sourceUrl).toBeUndefined();
    });

    it('drops a credit with no photographer — there is nothing to display', () => {
        const item = {
            media: {
                gallery: [
                    {
                        url: 'https://res.cloudinary.com/example/a.jpg',
                        attribution: { sourceUrl: 'https://example.com', license: 'CC BY 4.0' }
                    }
                ]
            }
        };

        const [first] = extractGalleryItems(item);

        expect(first?.url).toBeDefined();
        expect(first?.attribution).toBeUndefined();
    });

    it('drops a non-http credit link instead of rendering it as an href', () => {
        const item = {
            media: {
                gallery: [
                    {
                        url: 'https://res.cloudinary.com/example/a.jpg',
                        attribution: {
                            photographer: 'Mallory',
                            sourceUrl: 'javascript:alert(1)'
                        }
                    }
                ]
            }
        };

        const [first] = extractGalleryItems(item);

        expect(first?.attribution?.photographer).toBe('Mallory');
        expect(first?.attribution?.sourceUrl).toBeUndefined();
    });

    it('drops an unknown provider without discarding the credit', () => {
        const item = {
            media: {
                gallery: [
                    {
                        url: 'https://res.cloudinary.com/example/a.jpg',
                        attribution: {
                            photographer: 'Ana Gómez',
                            provider: 'flickr'
                        }
                    }
                ]
            }
        };

        const [first] = extractGalleryItems(item);

        expect(first?.attribution?.photographer).toBe('Ana Gómez');
        expect(first?.attribution?.provider).toBeUndefined();
    });

    it('leaves attribution undefined when the photo carries none', () => {
        const item = {
            media: {
                gallery: [
                    { url: 'https://res.cloudinary.com/example/a.jpg', caption: 'Sin crédito' }
                ]
            }
        };

        const [first] = extractGalleryItems(item);

        expect(first?.caption).toBe('Sin crédito');
        expect(first?.attribution).toBeUndefined();
    });

    it('keeps a non-http credit link off the featured image too', () => {
        const item = {
            media: {
                featuredImage: {
                    url: 'https://res.cloudinary.com/example/cover.jpg',
                    attribution: {
                        photographer: 'Mallory',
                        sourceUrl: 'javascript:alert(1)'
                    }
                }
            }
        };

        const result = extractFeaturedImage(item);

        expect(result.attribution?.photographer).toBe('Mallory');
        expect(result.attribution?.sourceUrl).toBeUndefined();
    });
});
