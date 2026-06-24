import type { AccommodationMedia, Media } from '@repo/schemas';
import { ModerationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { composeAccommodationMedia } from '../../../src/services/accommodation/accommodation.media-compose';

/**
 * Builds a fully-typed `accommodation_media` row with sensible defaults so each
 * test only spells out the fields it cares about. Mirrors the relational shape
 * (SPEC-204): a `visible`, non-featured row at `sortOrder` 0 unless overridden.
 */
function makeRow(overrides: Partial<AccommodationMedia> = {}): AccommodationMedia {
    return {
        id: '00000000-0000-0000-0000-000000000000',
        accommodationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        url: 'https://cdn.example.com/photo.jpg',
        caption: undefined,
        description: undefined,
        alt: undefined,
        publicId: undefined,
        attribution: undefined,
        moderationState: 'APPROVED',
        state: 'visible',
        isFeatured: false,
        sortOrder: 0,
        archivedAt: undefined,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        deletedAt: undefined,
        ...overrides
    } as unknown as AccommodationMedia;
}

describe('composeAccommodationMedia (SPEC-204 T-012)', () => {
    it('returns an empty object when there are no rows and no media', () => {
        expect(composeAccommodationMedia({ rows: [] })).toEqual({});
    });

    it('composes featuredImage from the is_featured visible row', () => {
        const rows = [
            makeRow({
                isFeatured: true,
                sortOrder: 0,
                url: 'https://cdn.example.com/featured.jpg',
                caption: 'Front view'
            })
        ];

        const result = composeAccommodationMedia({ rows });

        expect(result.featuredImage).toEqual({
            moderationState: 'APPROVED',
            url: 'https://cdn.example.com/featured.jpg',
            caption: 'Front view'
        });
        // No gallery key when there are no non-featured visible rows.
        expect(result.gallery).toBeUndefined();
    });

    it('composes gallery from visible non-featured rows ordered by sortOrder', () => {
        const rows = [
            makeRow({ url: 'https://cdn.example.com/c.jpg', sortOrder: 3 }),
            makeRow({ url: 'https://cdn.example.com/a.jpg', sortOrder: 1 }),
            makeRow({ url: 'https://cdn.example.com/b.jpg', sortOrder: 2 })
        ];

        const result = composeAccommodationMedia({ rows });

        expect(result.gallery?.map((g) => g.url)).toEqual([
            'https://cdn.example.com/a.jpg',
            'https://cdn.example.com/b.jpg',
            'https://cdn.example.com/c.jpg'
        ]);
    });

    it('excludes the featured row from the gallery', () => {
        const rows = [
            makeRow({
                isFeatured: true,
                sortOrder: 0,
                url: 'https://cdn.example.com/featured.jpg'
            }),
            makeRow({ sortOrder: 1, url: 'https://cdn.example.com/g1.jpg' })
        ];

        const result = composeAccommodationMedia({ rows });

        expect(result.featuredImage?.url).toBe('https://cdn.example.com/featured.jpg');
        expect(result.gallery?.map((g) => g.url)).toEqual(['https://cdn.example.com/g1.jpg']);
    });

    it('composes archivedGallery from archived rows ordered by sortOrder', () => {
        const rows = [
            makeRow({ state: 'archived', sortOrder: 1, url: 'https://cdn.example.com/ar1.jpg' }),
            makeRow({ state: 'archived', sortOrder: 0, url: 'https://cdn.example.com/ar0.jpg' })
        ];

        const result = composeAccommodationMedia({ rows });

        expect(result.archivedGallery?.map((g) => g.url)).toEqual([
            'https://cdn.example.com/ar0.jpg',
            'https://cdn.example.com/ar1.jpg'
        ]);
        expect(result.gallery).toBeUndefined();
    });

    it('carries videos forward from the current JSONB media unchanged', () => {
        const currentMedia: Media = {
            gallery: [
                {
                    moderationState: ModerationStatusEnum.APPROVED,
                    url: 'https://stale.example.com/old.jpg'
                }
            ],
            videos: [
                {
                    moderationState: ModerationStatusEnum.APPROVED,
                    url: 'https://cdn.example.com/tour.mp4'
                }
            ]
        };

        const result = composeAccommodationMedia({ rows: [], currentMedia });

        expect(result.videos).toEqual([
            { moderationState: 'APPROVED', url: 'https://cdn.example.com/tour.mp4' }
        ]);
        // Gallery is rebuilt from rows (empty), NOT carried from the stale JSONB.
        expect(result.gallery).toBeUndefined();
    });

    it('coalesces null/absent optional columns to absent keys (not null)', () => {
        const rows = [
            makeRow({
                url: 'https://cdn.example.com/min.jpg',
                caption: null as unknown as undefined,
                attribution: null as unknown as undefined
            })
        ];

        const result = composeAccommodationMedia({ rows });
        const img = result.gallery?.[0];

        expect(img).toEqual({
            moderationState: 'APPROVED',
            url: 'https://cdn.example.com/min.jpg'
        });
        expect('caption' in (img ?? {})).toBe(false);
        expect('attribution' in (img ?? {})).toBe(false);
    });

    it('does not mutate the input rows array', () => {
        const rows = [
            makeRow({ sortOrder: 2, url: 'https://cdn.example.com/b.jpg' }),
            makeRow({ sortOrder: 1, url: 'https://cdn.example.com/a.jpg' })
        ];
        const snapshot = rows.map((r) => r.url);

        composeAccommodationMedia({ rows });

        expect(rows.map((r) => r.url)).toEqual(snapshot);
    });
});
