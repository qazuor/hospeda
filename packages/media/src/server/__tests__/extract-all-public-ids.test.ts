/**
 * Tests for {@link extractAllMediaPublicIds}.
 *
 * Covers SPEC-078-GAPS GAP-078-082: given an entity with a populated
 * media payload, returns every referenced Cloudinary publicId — reading
 * `publicId` directly when present, falling back to parsing `url` via
 * `extractPublicId()` when not.
 */
import { describe, expect, it } from 'vitest';
import { extractAllMediaPublicIds } from '../extract-all-public-ids.js';

describe('extractAllMediaPublicIds', () => {
    it('returns 4 publicIds for featuredImage + 3 gallery items', () => {
        // Arrange
        const entity = {
            media: {
                featuredImage: { publicId: 'hospeda/prod/a/featured' },
                gallery: [
                    { publicId: 'hospeda/prod/a/g1' },
                    { publicId: 'hospeda/prod/a/g2' },
                    { publicId: 'hospeda/prod/a/g3' }
                ]
            }
        };

        // Act
        const ids = extractAllMediaPublicIds(entity);

        // Assert
        expect(ids).toEqual([
            'hospeda/prod/a/featured',
            'hospeda/prod/a/g1',
            'hospeda/prod/a/g2',
            'hospeda/prod/a/g3'
        ]);
    });

    it('falls back to extractPublicId(url) when publicId is missing', () => {
        const entity = {
            media: {
                featuredImage: {
                    url: 'https://res.cloudinary.com/x/image/upload/v123/hospeda/prod/a/featured.jpg'
                },
                gallery: [
                    {
                        url: 'https://res.cloudinary.com/x/image/upload/v1/hospeda/prod/a/g1.png'
                    },
                    { publicId: 'hospeda/prod/a/g2' }
                ]
            }
        };

        const ids = extractAllMediaPublicIds(entity);

        expect(ids).toEqual(['hospeda/prod/a/featured', 'hospeda/prod/a/g1', 'hospeda/prod/a/g2']);
    });

    it('includes video publicIds in iteration order', () => {
        const entity = {
            media: {
                videos: [{ publicId: 'hospeda/prod/a/v1' }, { publicId: 'hospeda/prod/a/v2' }]
            }
        };

        expect(extractAllMediaPublicIds(entity)).toEqual([
            'hospeda/prod/a/v1',
            'hospeda/prod/a/v2'
        ]);
    });

    it('skips assets with neither publicId nor a Cloudinary URL', () => {
        const entity = {
            media: {
                featuredImage: { url: 'https://images.unsplash.com/foo.jpg' },
                gallery: [{ publicId: 'hospeda/prod/a/g1' }, {}, { url: 'not a url' }]
            }
        };

        expect(extractAllMediaPublicIds(entity)).toEqual(['hospeda/prod/a/g1']);
    });

    it('returns an empty array when media is absent', () => {
        expect(extractAllMediaPublicIds({})).toEqual([]);
        expect(extractAllMediaPublicIds(null)).toEqual([]);
        expect(extractAllMediaPublicIds(undefined)).toEqual([]);
    });

    it('dedupes by default but preserves duplicates when unique=false', () => {
        const entity = {
            media: {
                featuredImage: { publicId: 'hospeda/prod/a/shared' },
                gallery: [{ publicId: 'hospeda/prod/a/shared' }]
            }
        };

        expect(extractAllMediaPublicIds(entity)).toEqual(['hospeda/prod/a/shared']);
        expect(extractAllMediaPublicIds(entity, { unique: false })).toEqual([
            'hospeda/prod/a/shared',
            'hospeda/prod/a/shared'
        ]);
    });
});
