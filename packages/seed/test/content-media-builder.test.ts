/**
 * Unit tests for the editorial-content media row builders (HOS-390).
 *
 * These builders feed BOTH halves of the dual-write: the baseline seeders
 * (`example/posts.seed.ts`, `example/events.seed.ts`) and the
 * `0037-hos-390-content-media-to-relational` backfill migration. Sharing one
 * builder is what guarantees a freshly-seeded database and a backfilled one end
 * up with identical rows, so the ordering and defaulting rules are pinned here.
 */

import { ModerationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { buildEventMediaRows, buildPostMediaRows } from '../src/utils/content-media-builder.js';
import type { FixtureMediaBlock } from '../src/utils/media-rows-builder.js';

const POST_ID = '390a09a5-dee0-5a59-83b1-21d4a62bd0c5';
const EVENT_ID = '686b70d4-aa3f-57c6-8958-a83eca33cd69';

const MEDIA: FixtureMediaBlock = {
    featuredImage: { url: 'https://cdn.test/featured.jpg', caption: 'Portada' },
    gallery: [
        { url: 'https://cdn.test/g1.jpg' },
        { url: 'https://cdn.test/g2.jpg', moderationState: 'REJECTED' }
    ]
};

describe('buildPostMediaRows', () => {
    it('emits the featured image first, at sortOrder 0', () => {
        const rows = buildPostMediaRows({ postId: POST_ID, media: MEDIA });

        expect(rows[0]).toMatchObject({
            url: 'https://cdn.test/featured.jpg',
            isFeatured: true,
            sortOrder: 0,
            state: 'visible'
        });
    });

    it('numbers the gallery after the featured slot', () => {
        const rows = buildPostMediaRows({ postId: POST_ID, media: MEDIA });

        expect(rows.map((row) => row.sortOrder)).toEqual([0, 1, 2]);
        expect(rows.filter((row) => row.isFeatured)).toHaveLength(1);
    });

    it('starts the gallery at 0 when there is no featured image', () => {
        const rows = buildPostMediaRows({
            postId: POST_ID,
            media: { gallery: [{ url: 'https://cdn.test/only.jpg' }] }
        });

        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ sortOrder: 0, isFeatured: false });
    });

    it('stamps the parent post id on every row', () => {
        const rows = buildPostMediaRows({ postId: POST_ID, media: MEDIA });

        expect(rows.every((row) => row.postId === POST_ID)).toBe(true);
    });

    it('defaults moderation to APPROVED but honours an explicit value', () => {
        const rows = buildPostMediaRows({ postId: POST_ID, media: MEDIA });

        // Seed content is curated and pre-vetted, so an omitted state means
        // approved — seeding PENDING would simulate a state the moderation
        // pipeline never produced.
        expect(rows[0]?.moderationState).toBe(ModerationStatusEnum.APPROVED);
        expect(rows[2]?.moderationState).toBe(ModerationStatusEnum.REJECTED);
    });

    it('skips entries with no url instead of emitting a broken row', () => {
        const rows = buildPostMediaRows({
            postId: POST_ID,
            media: { gallery: [{ url: '' }, { url: 'https://cdn.test/ok.jpg' }] }
        });

        expect(rows).toHaveLength(1);
        expect(rows[0]?.url).toBe('https://cdn.test/ok.jpg');
    });

    it('returns nothing for a videos-only block', () => {
        expect(buildPostMediaRows({ postId: POST_ID, media: {} })).toEqual([]);
    });
});

describe('buildEventMediaRows', () => {
    it('produces the same rows as the post builder, with the event FK', () => {
        const postRows = buildPostMediaRows({ postId: POST_ID, media: MEDIA });
        const eventRows = buildEventMediaRows({ eventId: EVENT_ID, media: MEDIA });

        // The two builders must not drift: same ordering, same defaults, only
        // the owning key differs.
        expect(eventRows.map(({ eventId: _e, ...rest }) => rest)).toEqual(
            postRows.map(({ postId: _p, ...rest }) => rest)
        );
        expect(eventRows.every((row) => row.eventId === EVENT_ID)).toBe(true);
    });
});
