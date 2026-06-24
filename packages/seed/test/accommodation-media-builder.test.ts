import { describe, expect, it } from 'vitest';
import {
    type FixtureMediaBlock,
    buildAccommodationMediaRows
} from '../src/utils/accommodation-media-builder.js';

/**
 * SPEC-204 T-027 — Unit tests for `buildAccommodationMediaRows`.
 *
 * These tests verify the pure mapping logic from a fixture `media` block to
 * `InsertAccommodationMedia` rows — no DB required.
 */

const ACCOMMODATION_ID = 'accom-uuid-1234';

describe('buildAccommodationMediaRows', () => {
    describe('empty / missing media', () => {
        it('returns an empty array when media has no featuredImage and no gallery', () => {
            const result = buildAccommodationMediaRows({
                accommodationId: ACCOMMODATION_ID,
                media: {}
            });
            expect(result).toHaveLength(0);
        });

        it('returns an empty array when gallery is an empty array', () => {
            const result = buildAccommodationMediaRows({
                accommodationId: ACCOMMODATION_ID,
                media: { gallery: [] }
            });
            expect(result).toHaveLength(0);
        });

        it('skips gallery entries with missing url', () => {
            const media: FixtureMediaBlock = {
                gallery: [
                    { url: 'https://example.com/photo1.jpg' },
                    { url: '' },
                    { url: 'https://example.com/photo3.jpg' }
                ]
            };
            const result = buildAccommodationMediaRows({
                accommodationId: ACCOMMODATION_ID,
                media
            });
            // Only 2 valid URLs
            expect(result).toHaveLength(2);
        });
    });

    describe('featuredImage only', () => {
        it('produces exactly one row with is_featured=true and sort_order=0', () => {
            const media: FixtureMediaBlock = {
                featuredImage: {
                    url: 'https://example.com/featured.jpg',
                    caption: 'Main view'
                }
            };
            const result = buildAccommodationMediaRows({
                accommodationId: ACCOMMODATION_ID,
                media
            });

            expect(result).toHaveLength(1);
            const row = result[0];
            expect(row).toBeDefined();
            if (!row) return;
            expect(row.isFeatured).toBe(true);
            expect(row.sortOrder).toBe(0);
            expect(row.url).toBe('https://example.com/featured.jpg');
            expect(row.caption).toBe('Main view');
            expect(row.state).toBe('visible');
            expect(row.moderationState).toBe('APPROVED');
            expect(row.archivedAt).toBeNull();
            expect(row.accommodationId).toBe(ACCOMMODATION_ID);
        });
    });

    describe('gallery only (no featuredImage)', () => {
        it('produces one row per gallery entry, none featured, sort_order starting at 0', () => {
            const media: FixtureMediaBlock = {
                gallery: [
                    { url: 'https://example.com/g1.jpg' },
                    { url: 'https://example.com/g2.jpg' },
                    { url: 'https://example.com/g3.jpg' }
                ]
            };
            const result = buildAccommodationMediaRows({
                accommodationId: ACCOMMODATION_ID,
                media
            });

            expect(result).toHaveLength(3);
            for (const row of result) {
                expect(row.isFeatured).toBe(false);
            }
            expect(result[0]?.sortOrder).toBe(0);
            expect(result[1]?.sortOrder).toBe(1);
            expect(result[2]?.sortOrder).toBe(2);
        });
    });

    describe('featuredImage + gallery (typical fixture)', () => {
        const FEATURED_URL = 'https://example.com/featured.jpg';
        const GALLERY_URLS = [
            'https://example.com/room.jpg',
            'https://example.com/pool.jpg',
            'https://example.com/garden.jpg'
        ];

        const media: FixtureMediaBlock = {
            featuredImage: { url: FEATURED_URL, caption: 'Front view' },
            gallery: GALLERY_URLS.map((url, i) => ({ url, caption: `Gallery ${i + 1}` }))
        };

        it('produces featuredImage + gallery rows in correct total count', () => {
            const result = buildAccommodationMediaRows({
                accommodationId: ACCOMMODATION_ID,
                media
            });
            expect(result).toHaveLength(4);
        });

        it('places featured image first with sort_order=0 and is_featured=true', () => {
            const result = buildAccommodationMediaRows({
                accommodationId: ACCOMMODATION_ID,
                media
            });
            const featuredRow = result[0];
            expect(featuredRow).toBeDefined();
            if (!featuredRow) return;
            expect(featuredRow.url).toBe(FEATURED_URL);
            expect(featuredRow.isFeatured).toBe(true);
            expect(featuredRow.sortOrder).toBe(0);
        });

        it('places gallery rows with is_featured=false and ascending sort_order from 1', () => {
            const result = buildAccommodationMediaRows({
                accommodationId: ACCOMMODATION_ID,
                media
            });
            const galleryRows = result.slice(1);
            expect(galleryRows).toHaveLength(3);

            for (let i = 0; i < galleryRows.length; i++) {
                const row = galleryRows[i];
                expect(row).toBeDefined();
                if (!row) continue;
                expect(row.isFeatured).toBe(false);
                expect(row.sortOrder).toBe(i + 1);
                expect(row.url).toBe(GALLERY_URLS[i]);
            }
        });

        it('sets state=visible and moderationState=APPROVED on all rows', () => {
            const result = buildAccommodationMediaRows({
                accommodationId: ACCOMMODATION_ID,
                media
            });
            for (const row of result) {
                expect(row.state).toBe('visible');
                expect(row.moderationState).toBe('APPROVED');
                expect(row.archivedAt).toBeNull();
            }
        });

        it('propagates accommodationId to every row', () => {
            const result = buildAccommodationMediaRows({
                accommodationId: ACCOMMODATION_ID,
                media
            });
            for (const row of result) {
                expect(row.accommodationId).toBe(ACCOMMODATION_ID);
            }
        });

        it('respects the single-featured invariant — exactly one row has is_featured=true', () => {
            const result = buildAccommodationMediaRows({
                accommodationId: ACCOMMODATION_ID,
                media
            });
            const featuredCount = result.filter((r) => r.isFeatured).length;
            expect(featuredCount).toBe(1);
        });
    });

    describe('optional fields (caption, description, alt, publicId)', () => {
        it('maps caption and description from the fixture entry', () => {
            const media: FixtureMediaBlock = {
                featuredImage: {
                    url: 'https://example.com/img.jpg',
                    caption: 'Pool area',
                    description: 'A beautiful pool area at sunset'
                }
            };
            const result = buildAccommodationMediaRows({
                accommodationId: ACCOMMODATION_ID,
                media
            });
            expect(result[0]?.caption).toBe('Pool area');
            expect(result[0]?.description).toBe('A beautiful pool area at sunset');
        });

        it('leaves caption/description/alt/publicId undefined when not provided', () => {
            const media: FixtureMediaBlock = {
                featuredImage: { url: 'https://example.com/img.jpg' }
            };
            const result = buildAccommodationMediaRows({
                accommodationId: ACCOMMODATION_ID,
                media
            });
            expect(result[0]?.caption).toBeUndefined();
            expect(result[0]?.description).toBeUndefined();
            expect(result[0]?.alt).toBeUndefined();
            expect(result[0]?.publicId).toBeUndefined();
        });

        it('maps publicId when present in the fixture entry', () => {
            const media: FixtureMediaBlock = {
                featuredImage: {
                    url: 'https://res.cloudinary.com/demo/image/upload/v1/foo.jpg',
                    publicId: 'hospeda/dev/seed/accommodations/acc-01/featured'
                }
            };
            const result = buildAccommodationMediaRows({
                accommodationId: ACCOMMODATION_ID,
                media
            });
            expect(result[0]?.publicId).toBe('hospeda/dev/seed/accommodations/acc-01/featured');
        });
    });

    describe('sort_order continuity', () => {
        it('produces a dense 0-based sort_order with no gaps', () => {
            const media: FixtureMediaBlock = {
                featuredImage: { url: 'https://example.com/f.jpg' },
                gallery: [
                    { url: 'https://example.com/g1.jpg' },
                    { url: 'https://example.com/g2.jpg' },
                    { url: 'https://example.com/g3.jpg' },
                    { url: 'https://example.com/g4.jpg' },
                    { url: 'https://example.com/g5.jpg' }
                ]
            };
            const result = buildAccommodationMediaRows({
                accommodationId: ACCOMMODATION_ID,
                media
            });
            const orders = result.map((r) => r.sortOrder);
            expect(orders).toEqual([0, 1, 2, 3, 4, 5]);
        });
    });
});
