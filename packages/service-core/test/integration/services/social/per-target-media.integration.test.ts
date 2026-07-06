/**
 * HOS-65 FIX 1 — per-target media collision regression test (real DB).
 *
 * `social_post_media` has a `UNIQUE(social_post_id, position)` index. Before the
 * fix, each publish target's media pipeline assigned `position` starting at 0
 * PER TARGET, so a post with two targets that EACH carry their own media hit a
 * unique-constraint violation on the second target's insert. That violation was
 * swallowed non-fatally in `createMediaLinks`, dropping the second target's
 * `social_post_media` + `social_post_target_media` rows silently — and
 * `buildMakePayload` then fell back to the POST-LEVEL media, leaking target 1's
 * media into target 2's payload.
 *
 * This test exercises the seam the fakes missed: it ingests a draft with THREE
 * targets — two carrying a DISTINCT image each, and a third, media-capable
 * co-target that carries NO assets of its own (a valid, optional per-target
 * config) — against a real PostgreSQL database with a real
 * `SocialImagePipelineService` (backed by the in-memory image provider so no
 * network/Cloudinary calls occur), and asserts:
 *   1. Both media-carrying targets get their OWN `social_post_media` row (no
 *      unique violation).
 *   2. `social_post_media.position` is POST-GLOBAL (0 and 1, never both 0).
 *   3. Each media-carrying target gets its OWN `social_post_target_media` link row.
 *   4. `buildMakePayload` returns each media-carrying target's OWN media URL —
 *      no cross-leak.
 *   5. HOS-65 FIX 6 — the third (asset-less) co-target has ZERO link rows of
 *      its own, yet `buildMakePayload` resolves it to `[]`, NOT a sibling's
 *      media — proving the post-level fallback gate is exercised against a
 *      REAL DB, not just the model-mock unit tests.
 *
 * On the PRE-FIX code this FAILS (only one media row exists, and both
 * media-carrying targets' payloads resolve to the same URL; separately, the
 * FIX-6 assertion fails pre-FIX-6 because the third target's zero link rows
 * fired the legacy post-level fallback and leaked a sibling's media into it).
 * On the fixed code it PASSES.
 *
 * The social services call `getDb()` internally, so each test calls `setDb(tx)`
 * to make the rollback-isolated transaction visible to them, restoring the outer
 * connection in a `finally` block.
 *
 * Runs only under `pnpm test:integration`. Skips cleanly when
 * `HOSPEDA_TEST_DATABASE_URL` is not set.
 */

import { SocialPostModel, SocialPostTargetModel, setDb, sql } from '@repo/db';
import type { DrizzleClient } from '@repo/db';
import { InMemoryImageProvider } from '@repo/media/test-utils';
import { SocialPlatformEnum, SocialPublishFormatEnum } from '@repo/schemas';
import type { CreateSocialDraft } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SocialDraftIngestionService } from '../../../../src/services/social/social-draft-ingestion.service';
import { SocialImagePipelineService } from '../../../../src/services/social/social-image-pipeline.service';
import { SocialPublishDispatchService } from '../../../../src/services/social/social-publish-dispatch.service';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    withServiceTestTransaction
} from '../helpers';

const dbAvailable = isServiceTestDbAvailable();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Seeds an enabled `social_platform_formats` row (IMAGE media type) for the
 * given platform × FEED_POST so both targets validate during ingestion.
 */
async function seedImageFeedFormat(tx: DrizzleClient, platform: string): Promise<void> {
    await tx.execute(sql`
        INSERT INTO social_platform_formats (
            platform, publish_format, media_type, enabled, mvp_enabled,
            requires_media, requires_public_url
        )
        VALUES (
            ${platform}, 'FEED_POST', 'IMAGE', true, true, false, false
        )
        ON CONFLICT (platform, publish_format) DO UPDATE
            SET enabled = true, media_type = 'IMAGE'
    `);
}

/**
 * A three-target draft: two targets EACH carry their own distinct image
 * asset; a third, media-capable co-target (X / FEED_POST) carries NO
 * `assets` of its own — a valid, optional per-target config, NOT an error
 * state — and the payload has no post-level `image` field either, so that
 * third target's resolved assets are genuinely empty (HOS-65 FIX 6 seam).
 */
function buildThreeTargetDraft(): CreateSocialDraft {
    return {
        operatorPin: 'test-pin',
        draftId: `draft-${crypto.randomUUID()}`,
        title: 'Per-target media collision regression',
        captionBase: 'Two targets with their own image, one co-target with none.',
        pillar: 'nature',
        targets: [
            {
                platform: SocialPlatformEnum.INSTAGRAM,
                publishFormat: SocialPublishFormatEnum.FEED_POST,
                assets: [{ image: { mode: 'public_url', url: 'https://example.com/insta.jpg' } }]
            },
            {
                platform: SocialPlatformEnum.FACEBOOK,
                publishFormat: SocialPublishFormatEnum.FEED_POST,
                assets: [{ image: { mode: 'public_url', url: 'https://example.com/facebook.jpg' } }]
            },
            {
                platform: SocialPlatformEnum.X,
                publishFormat: SocialPublishFormatEnum.FEED_POST
                // No `assets` — this media-capable co-target carries none of its own.
            }
        ]
    };
}

/**
 * Stubs the global `fetch` so the image pipeline's download step resolves with
 * a tiny in-memory buffer for any URL (no real network traffic).
 */
function mockImageDownload(): void {
    vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer
        } as unknown as Response)
    );
}

async function withSocialTestTransaction(fn: (tx: DrizzleClient) => Promise<void>): Promise<void> {
    const outerDb = getServiceTestDb();
    await withServiceTestTransaction(async (tx) => {
        setDb(tx);
        try {
            await fn(tx);
        } finally {
            setDb(outerDb);
        }
    });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('HOS-65 FIX 1 — per-target media does not collide on social_post_media', () => {
    beforeAll(() => {
        if (!dbAvailable) return;
        getServiceTestDb();
    });

    afterAll(async () => {
        if (!dbAvailable) return;
        await closeServiceTestPool();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it.skipIf(!dbAvailable)(
        'ingests two targets with distinct media and keeps each target’s media isolated, and a third asset-less co-target publishes [] (HOS-65 FIX 6)',
        async () => {
            await withSocialTestTransaction(async (tx) => {
                // Arrange
                mockImageDownload();
                await seedImageFeedFormat(tx, 'INSTAGRAM');
                await seedImageFeedFormat(tx, 'FACEBOOK');
                // Media-capable co-target platform for the FIX 6 asset-less target.
                await seedImageFeedFormat(tx, 'X');

                const serviceConfig = {};
                const imagePipeline = new SocialImagePipelineService(
                    serviceConfig,
                    new InMemoryImageProvider({ cloudName: 'test-cloud' })
                );
                const ingestionService = new SocialDraftIngestionService(
                    serviceConfig,
                    imagePipeline
                );
                const dispatchService = new SocialPublishDispatchService(serviceConfig);

                // Act — ingest a draft whose two targets EACH carry a distinct
                // image, plus a third media-capable co-target with none.
                // `gpt-action` mirrors the real synthetic GPT actor: a non-UUID
                // id so the pipeline persists `social_assets.created_by_id` as
                // NULL (no `users` FK row required).
                const ingestResult = await ingestionService.ingestDraft({
                    payload: buildThreeTargetDraft(),
                    actorId: 'gpt-action'
                });

                // Assert — ingestion succeeded and reported media uploaded.
                expect(ingestResult.code).toBe('SUCCESS');
                if (ingestResult.code !== 'SUCCESS') throw new Error('expected SUCCESS');
                expect(ingestResult.data.assetStatus).toBe('uploaded');
                const postId = ingestResult.data.postId;

                // Assert — TWO social_post_media rows exist (no unique violation)
                // with POST-GLOBAL positions 0 and 1 (never both 0). The third
                // (asset-less) target never dispatches, so it never creates one.
                const mediaRows = await tx.execute<{ position: number }>(sql`
                    SELECT position
                    FROM social_post_media
                    WHERE social_post_id = ${postId}
                    ORDER BY position ASC
                `);
                expect(mediaRows.rows?.length).toBe(2);
                expect(mediaRows.rows?.map((r) => r.position)).toEqual([0, 1]);

                // Assert — the two media-carrying targets each have exactly ONE
                // social_post_target_media link row; the third (X / asset-less)
                // co-target has ZERO — a valid, expected state, not an error.
                const targetModel = new SocialPostTargetModel();
                const { items: targets } = await targetModel.findAll(
                    { socialPostId: postId },
                    { pageSize: 50 }
                );
                expect(targets.length).toBe(3);

                const mediaCarryingTargets = targets.filter(
                    (target) => (target.platform as string) !== 'X'
                );
                const assetlessTarget = targets.find(
                    (target) => (target.platform as string) === 'X'
                );
                expect(mediaCarryingTargets.length).toBe(2);
                if (!assetlessTarget) throw new Error('asset-less X target not found');

                for (const target of mediaCarryingTargets) {
                    const linkRows = await tx.execute<{ n: number }>(sql`
                        SELECT COUNT(*)::int AS n
                        FROM social_post_target_media
                        WHERE social_post_target_id = ${target.id as string}
                    `);
                    expect(linkRows.rows?.[0]?.n).toBe(1);
                }

                const assetlessLinkRows = await tx.execute<{ n: number }>(sql`
                    SELECT COUNT(*)::int AS n
                    FROM social_post_target_media
                    WHERE social_post_target_id = ${assetlessTarget.id as string}
                `);
                expect(assetlessLinkRows.rows?.[0]?.n).toBe(0);

                // Assert — buildMakePayload returns each media-carrying target's
                // OWN media URL (exactly one each) with NO cross-leak between them.
                const postModel = new SocialPostModel();
                const post = await postModel.findOne({ id: postId });
                if (!post) throw new Error('post not found');

                const payloads = await Promise.all(
                    mediaCarryingTargets.map((target) =>
                        dispatchService.buildMakePayload({
                            target: target as unknown as Record<string, unknown>,
                            post: post as unknown as Record<string, unknown>
                        })
                    )
                );

                const mediaUrlSets = payloads.map((p) => p.payload.mediaUrls);
                for (const urls of mediaUrlSets) {
                    expect(urls.length).toBe(1);
                }
                // Each media-carrying target resolves to a DISTINCT media URL — no leak.
                const [first, second] = mediaUrlSets;
                expect(first?.[0]).toBeDefined();
                expect(second?.[0]).toBeDefined();
                expect(first?.[0]).not.toBe(second?.[0]);

                // Assert (HOS-65 FIX 6) — the asset-less co-target has ZERO link
                // rows of its own, but the POST has already been migrated to
                // per-target media (the other two targets' link rows exist), so
                // its payload must resolve to `[]` — NOT a sibling's media URL.
                const { payload: assetlessPayload } = await dispatchService.buildMakePayload({
                    target: assetlessTarget as unknown as Record<string, unknown>,
                    post: post as unknown as Record<string, unknown>
                });
                expect(assetlessPayload.mediaUrls).toEqual([]);
                expect(assetlessPayload.mediaUrls).not.toContain(first?.[0]);
                expect(assetlessPayload.mediaUrls).not.toContain(second?.[0]);
            });
        }
    );
});
