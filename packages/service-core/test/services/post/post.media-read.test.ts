/**
 * post.media-read.test.ts
 *
 * Unit tests for the post media read-composition helpers (HOS-390).
 *
 * The interesting behavior here is the DELIBERATE divergence from the
 * accommodation/gastronomy molde: because `posts.media` JSONB is NOT dropped
 * (videos still live there), falling back to the entity's own `media` on an
 * empty composition would resurrect photos the author just deleted. These tests
 * pin that down — the relational rows are authoritative for photos, and the only
 * preserved case is a `null` media with nothing to compose.
 *
 * No DB is touched: the model is a hand-rolled stub.
 */

import type { Post, PostMedia } from '@repo/schemas';
import { ModerationStatusEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    attachComposedPostMedia,
    attachComposedPostMediaList
} from '../../../src/services/post/post.media-read';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const POST_ID = '00000000-0000-4000-a000-000000000001';
const OTHER_POST_ID = '00000000-0000-4000-a000-000000000002';

const BLOB_PHOTO_URL = 'https://cdn.example.com/legacy-blob-photo.jpg';
const VIDEO = { url: 'https://youtube.com/watch?v=abc' };

function makeRow(overrides: Partial<PostMedia> = {}): PostMedia {
    return {
        id: '00000000-0000-4000-a000-00000000000a',
        postId: POST_ID,
        url: 'https://cdn.example.com/row.jpg',
        moderationState: ModerationStatusEnum.APPROVED,
        state: 'visible',
        isFeatured: false,
        sortOrder: 0,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        ...overrides
    } as PostMedia;
}

/** A post carrying the pre-HOS-390 photo blob, as an un-backfilled row would. */
function makePostWithBlob(overrides: Partial<Post> = {}): Post {
    return {
        id: POST_ID,
        media: {
            featuredImage: { url: BLOB_PHOTO_URL, moderationState: ModerationStatusEnum.APPROVED },
            gallery: [{ url: BLOB_PHOTO_URL, moderationState: ModerationStatusEnum.APPROVED }]
        },
        ...overrides
    } as unknown as Post;
}

/** Stub model whose `findByPosts` returns the supplied grouping. */
function makeMediaModel(grouped: Map<string, PostMedia[]>) {
    return {
        findByPosts: vi.fn().mockResolvedValue(grouped)
    } as unknown as Parameters<typeof attachComposedPostMedia>[0]['mediaModel'];
}

// ---------------------------------------------------------------------------
// attachComposedPostMedia
// ---------------------------------------------------------------------------

describe('attachComposedPostMedia', () => {
    it('returns null untouched for a single-read miss', async () => {
        const mediaModel = makeMediaModel(new Map());

        const result = await attachComposedPostMedia({ entity: null, mediaModel });

        expect(result).toBeNull();
        expect(mediaModel.findByPosts).not.toHaveBeenCalled();
    });

    it('composes the gallery and featured image from the relational rows', async () => {
        const featured = makeRow({
            id: '00000000-0000-4000-a000-00000000000f',
            url: 'https://cdn.example.com/featured.jpg',
            isFeatured: true
        });
        const second = makeRow({
            id: '00000000-0000-4000-a000-00000000000b',
            url: 'https://cdn.example.com/second.jpg',
            sortOrder: 1
        });
        const first = makeRow({ url: 'https://cdn.example.com/first.jpg', sortOrder: 0 });
        const mediaModel = makeMediaModel(new Map([[POST_ID, [second, featured, first]]]));

        const result = await attachComposedPostMedia({
            entity: makePostWithBlob(),
            mediaModel
        });

        expect(result?.media?.featuredImage?.url).toBe('https://cdn.example.com/featured.jpg');
        expect(result?.media?.gallery?.map((i) => i.url)).toEqual([
            'https://cdn.example.com/first.jpg',
            'https://cdn.example.com/second.jpg'
        ]);
    });

    it('keeps videos, which still live in the JSONB blob', async () => {
        const mediaModel = makeMediaModel(new Map([[POST_ID, [makeRow()]]]));
        const entity = makePostWithBlob({
            media: { videos: [VIDEO] }
        } as unknown as Partial<Post>);

        const result = await attachComposedPostMedia({ entity, mediaModel });

        expect(result?.media?.videos).toEqual([VIDEO]);
        expect(result?.media?.gallery?.[0]?.url).toBe('https://cdn.example.com/row.jpg');
    });

    it('does NOT resurrect blob photos when the post has zero relational rows', async () => {
        // The anti-regression case: an author who deleted every photo (or a post
        // the backfill has not reached) must NOT get the legacy blob gallery back.
        const mediaModel = makeMediaModel(new Map());

        const result = await attachComposedPostMedia({
            entity: makePostWithBlob(),
            mediaModel
        });

        expect(result?.media?.gallery).toBeUndefined();
        expect(result?.media?.featuredImage).toBeUndefined();
    });

    it('does not let the presence of videos decide whether blob photos survive', async () => {
        // Same zero-row state as above, but WITH videos. Under the molde's
        // `hasContent` fallback these two cases diverge (photos vanish here,
        // come back above); the authoritative rule keeps them identical.
        const mediaModel = makeMediaModel(new Map());
        const entity = makePostWithBlob({
            media: {
                gallery: [{ url: BLOB_PHOTO_URL, moderationState: ModerationStatusEnum.APPROVED }],
                videos: [VIDEO]
            }
        } as unknown as Partial<Post>);

        const result = await attachComposedPostMedia({ entity, mediaModel });

        expect(result?.media?.gallery).toBeUndefined();
        expect(result?.media?.videos).toEqual([VIDEO]);
    });

    it('preserves a null media rather than drifting it to an empty object', async () => {
        const mediaModel = makeMediaModel(new Map());
        const entity = { id: POST_ID, media: null } as unknown as Post;

        const result = await attachComposedPostMedia({ entity, mediaModel });

        expect(result?.media).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// attachComposedPostMediaList
// ---------------------------------------------------------------------------

describe('attachComposedPostMediaList', () => {
    it('returns an empty list without querying', async () => {
        const mediaModel = makeMediaModel(new Map());

        const result = await attachComposedPostMediaList({ items: [], mediaModel });

        expect(result).toEqual([]);
        expect(mediaModel.findByPosts).not.toHaveBeenCalled();
    });

    it('returns an empty array for a nullish item list instead of throwing', async () => {
        // Reachable from a model stub or an error path that yields a result
        // object with no `items` key. Spreading it would raise a TypeError.
        const mediaModel = makeMediaModel(new Map());

        await expect(
            attachComposedPostMediaList({ items: undefined as never, mediaModel })
        ).resolves.toEqual([]);
        expect(mediaModel.findByPosts).not.toHaveBeenCalled();
    });

    it('batches every post into a single query (no N+1)', async () => {
        const mediaModel = makeMediaModel(
            new Map([[POST_ID, [makeRow({ url: 'https://cdn.example.com/a.jpg' })]]])
        );
        const items = [
            makePostWithBlob(),
            makePostWithBlob({ id: OTHER_POST_ID } as Partial<Post>)
        ];

        const result = await attachComposedPostMediaList({ items, mediaModel });

        expect(mediaModel.findByPosts).toHaveBeenCalledTimes(1);
        expect(mediaModel.findByPosts).toHaveBeenCalledWith(
            expect.objectContaining({ postIds: [POST_ID, OTHER_POST_ID] })
        );
        // The post WITH rows composes them; the one without gets no photos back.
        expect(result[0]?.media?.gallery?.map((i) => i.url)).toEqual([
            'https://cdn.example.com/a.jpg'
        ]);
        expect(result[1]?.media?.gallery).toBeUndefined();
    });
});

/**
 * Reproduces the exact production state of H-22 / H-23 and pins what the read
 * path serves for it.
 *
 * The post `gualeguaychu-mas-alla-del-carnaval` carries five `post_media` rows
 * whose `url` is a `blob:` handle — a browser object URL that resolves for
 * nobody — and the same five URLs still sit in the legacy `media` JSONB blob,
 * because the `0037` data-migration copied them across. All five rows are
 * `PENDING`: the old admin gallery persisted a local preview instead of
 * uploading, so `public_id` is empty and nothing ever approved them.
 *
 * The question this test answers is the one the finding could not separate by
 * observation — both sources hold the same five URLs, so counting rendered
 * images cannot tell you which one the page read. The relational composition
 * ALWAYS wins (see the module docblock on why a fallback would resurrect
 * deleted photos), so with the moderation gate in place the composed media is
 * empty and the legacy blob does NOT come back to fill the gap.
 *
 * Consequence worth stating: deploying the gate stops production serving those
 * broken images, without any change to the rows themselves.
 */
describe('H-22 / H-23 — a post whose only photos are unapproved blob rows', () => {
    it('serves no gallery, and does not fall back to the legacy blob', async () => {
        const blobRows = [0, 1, 2, 3, 4].map((i) =>
            makeRow({
                id: `00000000-0000-4000-a000-0000000000${10 + i}`,
                url: `blob:https://admin.hospeda.com.ar/handle-${i}`,
                sortOrder: i,
                moderationState: ModerationStatusEnum.PENDING
            })
        );
        const mediaModel = makeMediaModel(new Map([[POST_ID, blobRows]]));

        const result = await attachComposedPostMedia({
            entity: makePostWithBlob(),
            mediaModel
        });

        // Exact comparison. Asserting "no blob: url is present" would also pass
        // if the whole media object went missing for an unrelated reason.
        expect(result?.media).toEqual({});
        expect(JSON.stringify(result?.media)).not.toContain('blob:');
    });

    it('still serves the approved photos of a post that has both', async () => {
        // The gate must remove the unapproved rows, not the gallery. Without
        // this case the assertion above would be satisfied by a composer that
        // simply returns nothing.
        const rows = [
            makeRow({
                id: '00000000-0000-4000-a000-000000000020',
                url: 'https://res.cloudinary.com/ok.jpg',
                sortOrder: 0
            }),
            makeRow({
                id: '00000000-0000-4000-a000-000000000021',
                url: 'blob:https://admin.hospeda.com.ar/handle-x',
                sortOrder: 1,
                moderationState: ModerationStatusEnum.PENDING
            })
        ];
        const mediaModel = makeMediaModel(new Map([[POST_ID, rows]]));

        const result = await attachComposedPostMedia({
            entity: makePostWithBlob(),
            mediaModel
        });

        expect(result?.media?.gallery?.map((i) => i.url)).toEqual([
            'https://res.cloudinary.com/ok.jpg'
        ]);
    });
});
