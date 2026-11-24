/**
 * @file experience-gallery-images.test.ts
 * @description Unit tests of `buildExperienceGalleryImages` (moved out of the
 * experience detail page, HOS-2579).
 */

import { describe, expect, it } from 'vitest';
import { buildExperienceGalleryImages } from '@/lib/experience/experience-gallery-images';

const featuredImage = { url: 'https://img/cover.jpg', caption: 'Portada' };

describe('buildExperienceGalleryImages', () => {
    it('maps media.gallery, dropping entries without a URL and using the name as alt fallback', () => {
        // Arrange
        const media = {
            gallery: [
                { url: 'https://img/1.jpg', caption: 'Río', description: 'Al atardecer' },
                { caption: 'sin url' },
                { url: 'https://img/2.jpg' }
            ]
        };
        // Act
        const { images } = buildExperienceGalleryImages({ media, name: 'Kayak', featuredImage });
        // Assert
        expect(images).toEqual([
            { url: 'https://img/1.jpg', alt: 'Río', caption: 'Río', description: 'Al atardecer' },
            { url: 'https://img/2.jpg', alt: 'Kayak', caption: undefined, description: undefined }
        ]);
    });

    it('falls back to the featured image without a gallery', () => {
        expect(
            buildExperienceGalleryImages({ media: undefined, name: 'Kayak', featuredImage }).images
        ).toEqual([{ url: 'https://img/cover.jpg', alt: 'Portada', caption: 'Portada' }]);
    });

    it('returns no image for a placeholder or missing featured image', () => {
        for (const url of ['', 'https://img/placeholder.jpg']) {
            expect(
                buildExperienceGalleryImages({
                    media: { gallery: [] },
                    name: 'Kayak',
                    featuredImage: { url }
                }).images
            ).toEqual([]);
        }
    });
});
