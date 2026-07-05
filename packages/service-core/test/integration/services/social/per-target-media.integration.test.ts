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
 * This test exercises the seam the fakes missed: it ingests a draft with TWO
 * targets, each carrying a DISTINCT image, against a real PostgreSQL database
 * with a real `SocialImagePipelineService` (backed by the in-memory image
 * provider so no network/Cloudinary calls occur), and asserts:
 *   1. Both targets get their OWN `social_post_media` row (no unique violation).
 *   2. `social_post_media.position` is POST-GLOBAL (0 and 1, never both 0).
 *   3. Each target gets its OWN `social_post_target_media` link row.
 *   4. `buildMakePayload` returns each target's OWN media URL — no cross-leak.
 *
 * On the PRE-FIX code this FAILS (only one media row exists, and both targets'
 * payloads resolve to the same URL). On the fixed code it PASSES.
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
 * A two-target draft where EACH target carries its own distinct image asset.
 */
function buildTwoTargetDraft(): CreateSocialDraft {
    return {
        operatorPin: 'test-pin',
        draftId: `draft-${crypto.randomUUID()}`,
        title: 'Per-target media collision regression',
        captionBase: 'Two targets, each with its own image.',
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
        'ingests two targets with distinct media and keeps each target’s media isolated',
        async () => {
            await withSocialTestTransaction(async (tx) => {
                // Arrange
                mockImageDownload();
                await seedImageFeedFormat(tx, 'INSTAGRAM');
                await seedImageFeedFormat(tx, 'FACEBOOK');

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

                // Act — ingest a draft whose two targets EACH carry a distinct image.
                // `gpt-action` mirrors the real synthetic GPT actor: a non-UUID
                // id so the pipeline persists `social_assets.created_by_id` as
                // NULL (no `users` FK row required).
                const ingestResult = await ingestionService.ingestDraft({
                    payload: buildTwoTargetDraft(),
                    actorId: 'gpt-action'
                });

                // Assert — ingestion succeeded and reported media uploaded.
                expect(ingestResult.code).toBe('SUCCESS');
                if (ingestResult.code !== 'SUCCESS') throw new Error('expected SUCCESS');
                expect(ingestResult.data.assetStatus).toBe('uploaded');
                const postId = ingestResult.data.postId;

                // Assert — TWO social_post_media rows exist (no unique violation)
                // with POST-GLOBAL positions 0 and 1 (never both 0).
                const mediaRows = await tx.execute<{ position: number }>(sql`
                    SELECT position
                    FROM social_post_media
                    WHERE social_post_id = ${postId}
                    ORDER BY position ASC
                `);
                expect(mediaRows.rows?.length).toBe(2);
                expect(mediaRows.rows?.map((r) => r.position)).toEqual([0, 1]);

                // Assert — each target has exactly ONE social_post_target_media link row.
                const targetModel = new SocialPostTargetModel();
                const { items: targets } = await targetModel.findAll(
                    { socialPostId: postId },
                    { pageSize: 50 }
                );
                expect(targets.length).toBe(2);

                for (const target of targets) {
                    const linkRows = await tx.execute<{ n: number }>(sql`
                        SELECT COUNT(*)::int AS n
                        FROM social_post_target_media
                        WHERE social_post_target_id = ${target.id as string}
                    `);
                    expect(linkRows.rows?.[0]?.n).toBe(1);
                }

                // Assert — buildMakePayload returns each target's OWN media URL
                // (exactly one each) with NO cross-leak between the two targets.
                const postModel = new SocialPostModel();
                const post = await postModel.findOne({ id: postId });
                if (!post) throw new Error('post not found');

                const payloads = await Promise.all(
                    targets.map((target) =>
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
                // Each target resolves to a DISTINCT media URL — no leak.
                const [first, second] = mediaUrlSets;
                expect(first?.[0]).toBeDefined();
                expect(second?.[0]).toBeDefined();
                expect(first?.[0]).not.toBe(second?.[0]);
            });
        }
    );
});
