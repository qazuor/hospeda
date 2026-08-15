import type { BaseCommerceMedia, Video } from '@repo/schemas';
import { ModerationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { composeCommerceMedia } from '../../../src/services/commerce/commerce-media-compose';

/**
 * Builds a fully-typed commerce-media row (structurally compatible with both
 * `GastronomyMedia` and `ExperienceMedia`) with sensible defaults so each test
 * only spells out the fields it cares about. Mirrors the relational shape
 * (HOS-372): a `visible`, non-featured row at `sortOrder` 0 unless overridden.
 */
function makeRow(overrides: Partial<BaseCommerceMedia> = {}): BaseCommerceMedia {
    return {
        url: 'https://cdn.example.com/photo.jpg',
        caption: undefined,
        description: undefined,
        alt: undefined,
        publicId: undefined,
        attribution: undefined,
        moderationState: ModerationStatusEnum.APPROVED,
        state: 'visible',
        isFeatured: false,
        sortOrder: 0,
        archivedAt: undefined,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        deletedAt: undefined,
        ...overrides
    } as unknown as BaseCommerceMedia;
}

describe('composeCommerceMedia (HOS-372)', () => {
    it('returns an empty object when there are no rows and no videos', () => {
        expect(composeCommerceMedia({ rows: [] })).toEqual({});
    });

    it('composes featuredImage from the isFeatured visible row', () => {
        const rows = [
            makeRow({
                isFeatured: true,
                sortOrder: 0,
                url: 'https://cdn.example.com/featured.jpg',
                caption: 'Front view'
            })
        ];

        const result = composeCommerceMedia({ rows });

        expect(result.featuredImage).toEqual({
            moderationState: ModerationStatusEnum.APPROVED,
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

        const result = composeCommerceMedia({ rows });

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

        const result = composeCommerceMedia({ rows });

        expect(result.featuredImage?.url).toBe('https://cdn.example.com/featured.jpg');
        expect(result.gallery?.map((g) => g.url)).toEqual(['https://cdn.example.com/g1.jpg']);
    });

    it('composes archivedGallery from archived rows ordered by sortOrder', () => {
        const rows = [
            makeRow({ state: 'archived', sortOrder: 1, url: 'https://cdn.example.com/ar1.jpg' }),
            makeRow({ state: 'archived', sortOrder: 0, url: 'https://cdn.example.com/ar0.jpg' })
        ];

        const result = composeCommerceMedia({ rows });

        expect(result.archivedGallery?.map((g) => g.url)).toEqual([
            'https://cdn.example.com/ar0.jpg',
            'https://cdn.example.com/ar1.jpg'
        ]);
        expect(result.gallery).toBeUndefined();
    });

    it('passes videos through unchanged from the caller-supplied array (not from rows)', () => {
        const videos: Video[] = [
            {
                moderationState: ModerationStatusEnum.APPROVED,
                url: 'https://cdn.example.com/tour.mp4'
            }
        ];

        const result = composeCommerceMedia({ rows: [], videos });

        expect(result.videos).toEqual([
            {
                moderationState: ModerationStatusEnum.APPROVED,
                url: 'https://cdn.example.com/tour.mp4'
            }
        ]);
        // Gallery is rebuilt from rows (empty), regardless of videos being present.
        expect(result.gallery).toBeUndefined();
    });

    it('omits videos key when the videos array is empty or absent', () => {
        expect(composeCommerceMedia({ rows: [], videos: [] }).videos).toBeUndefined();
        expect(composeCommerceMedia({ rows: [], videos: null }).videos).toBeUndefined();
        expect(composeCommerceMedia({ rows: [] }).videos).toBeUndefined();
    });

    it('coalesces null/absent optional columns to absent keys (not null)', () => {
        const rows = [
            makeRow({
                url: 'https://cdn.example.com/min.jpg',
                caption: null as unknown as undefined,
                attribution: null as unknown as undefined
            })
        ];

        const result = composeCommerceMedia({ rows });
        const img = result.gallery?.[0];

        expect(img).toEqual({
            moderationState: ModerationStatusEnum.APPROVED,
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

        composeCommerceMedia({ rows });

        expect(rows.map((r) => r.url)).toEqual(snapshot);
    });
});

/**
 * Regression suite for H-23 — media awaiting moderation was served publicly.
 *
 * Measured in production on 2026-08-15: `GET /public/posts/slug/…` returned five
 * photos with `moderationState: "PENDING"` and the SSR page rendered them. The
 * composer partitioned rows by `state` (visible / archived) and by `isFeatured`,
 * and never looked at `moderationState` at all — so the platform's verdict on a
 * photo had no effect on whether the photo was published.
 *
 * The gate lives HERE, unconditionally, rather than at each read path, because
 * this is the single composition implementation behind post, event, gastronomy
 * and experience payloads. A per-call-site flag would be fail-open: the next
 * read path added would forget it and the photo would ship. Editors are
 * unaffected — media management reads raw rows through the dedicated
 * `getMedia` endpoints, not through a composed entity.
 */
describe('composeCommerceMedia moderation gate (H-23)', () => {
    it('excludes a PENDING row from the gallery', () => {
        const rows = [
            makeRow({ url: 'https://cdn.example.com/ok.jpg', sortOrder: 0 }),
            makeRow({
                url: 'https://cdn.example.com/pending.jpg',
                sortOrder: 1,
                moderationState: ModerationStatusEnum.PENDING
            })
        ];

        const result = composeCommerceMedia({ rows });

        // Exact comparison: asserting only that the approved photo is present
        // would still pass with the pending one sitting next to it.
        expect(result.gallery?.map((i) => i.url)).toEqual(['https://cdn.example.com/ok.jpg']);
    });

    it('excludes a REJECTED row from the gallery', () => {
        const rows = [
            makeRow({
                url: 'https://cdn.example.com/rejected.jpg',
                moderationState: ModerationStatusEnum.REJECTED
            })
        ];

        expect(composeCommerceMedia({ rows })).toEqual({});
    });

    it('drops featuredImage when the featured row is not approved', () => {
        // This is the production case: the affected event's cover image was a
        // PENDING row, so gating it must leave the entity with NO featured
        // image rather than promoting an unapproved one.
        const rows = [
            makeRow({
                url: 'https://cdn.example.com/pending-cover.jpg',
                isFeatured: true,
                moderationState: ModerationStatusEnum.PENDING
            })
        ];

        const result = composeCommerceMedia({ rows });

        expect(result.featuredImage).toBeUndefined();
        expect(result.gallery).toBeUndefined();
    });

    it('keeps videos, which carry no moderation state of their own', () => {
        const videos = [{ url: 'https://youtube.com/watch?v=abc' }] as unknown as Video[];
        const rows = [makeRow({ moderationState: ModerationStatusEnum.PENDING })];

        const result = composeCommerceMedia({ rows, videos });

        expect(result.videos).toEqual(videos);
        expect(result.gallery).toBeUndefined();
    });

    it('excludes a non-approved row from archivedGallery too', () => {
        const rows = [
            makeRow({
                state: 'archived',
                moderationState: ModerationStatusEnum.PENDING,
                url: 'https://cdn.example.com/archived-pending.jpg'
            })
        ];

        expect(composeCommerceMedia({ rows }).archivedGallery).toBeUndefined();
    });
});
