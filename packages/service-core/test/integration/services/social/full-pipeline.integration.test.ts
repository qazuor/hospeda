/**
 * SPEC-254 T-050 — full end-to-end social pipeline integration test (real DB).
 *
 * Exercises the complete social automation pipeline against a real PostgreSQL
 * database, with external HTTP calls (Make.com webhook) mocked at the `fetch`
 * boundary so no real network traffic occurs.
 *
 * NOTE: `dispatchTarget` uses a synchronous Make.com Webhook Response model:
 * Make.com returns `{ status: 'SUCCESS', ... }` in the same HTTP round-trip,
 * and the target is immediately set to PUBLISHED (no PUBLISHING intermediate state).
 *
 *   Scenario A — ONCE recurrence (happy path):
 *     1. ingestDraft (no image pipeline) → post NEEDS_REVIEW / PENDING
 *     2. approve → APPROVED
 *     3. markReady → READY_TO_PUBLISH
 *     4. findEligibleTargets → the target appears in the eligible list
 *     5. dispatchTarget (fetch mocked → Make SUCCESS) → target=PUBLISHED; publish_log SUCCESS
 *
 * The image pipeline (Cloudinary upload) is bypassed by constructing
 * `SocialDraftIngestionService` without an `imagePipeline` argument so
 * `assetStatus` returns `"none"`. Media rows required by
 * `findEligibleTargets` (condition 6: at least one media row) are seeded
 * directly via raw SQL instead.
 *
 * The social services call `getDb()` internally (they do NOT accept a
 * `ServiceContext`). To make seed data visible inside the rollback-isolated
 * transaction, each test calls `setDb(tx)` before exercising the services
 * and restores the outer connection in a `finally` block.
 *
 * Runs only under `pnpm test:integration` (which provisions the ephemeral DB).
 * When `HOSPEDA_TEST_DATABASE_URL` is not set the suite skips cleanly.
 *
 * @see SPEC-254 T-050
 */

import type { DrizzleClient } from '@repo/db';
import { setDb, sql, users } from '@repo/db';
import type { CreateSocialDraft } from '@repo/schemas';
import {
    PermissionEnum,
    RoleEnum,
    SocialPlatformEnum,
    SocialPostStatusEnum,
    SocialPublishFormatEnum,
    SocialPublishResultStatusEnum
} from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SocialAuditLogService } from '../../../../src/services/social/social-audit-log.service';
import { SocialDraftIngestionService } from '../../../../src/services/social/social-draft-ingestion.service';
import { SocialPostService } from '../../../../src/services/social/social-post.service';
import { SocialPublishDispatchService } from '../../../../src/services/social/social-publish-dispatch.service';
import type { Actor } from '../../../../src/types';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    withServiceTestTransaction
} from '../helpers';

const dbAvailable = isServiceTestDbAvailable();

// ---------------------------------------------------------------------------
// Actor fixture
// ---------------------------------------------------------------------------

/**
 * Builds an admin actor with all social permissions required by the full pipeline.
 */
function buildFullActor(): Actor {
    return {
        id: crypto.randomUUID(),
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.SOCIAL_POST_APPROVE,
            PermissionEnum.SOCIAL_POST_SCHEDULE,
            PermissionEnum.SOCIAL_POST_VIEW
        ]
    };
}

/**
 * Inserts a minimal `users` row for the actor so that FK columns
 * (`approved_by_id`, `updated_by_id`, etc.) pass referential integrity checks.
 * Must be called INSIDE the transaction after `setDb(tx)`.
 */
async function seedActorUser(tx: DrizzleClient, actor: Actor): Promise<void> {
    const uid = actor.id.slice(0, 8);
    await tx.insert(users).values({
        id: actor.id,
        email: `actor-${uid}@test.local`,
        displayName: 'Test Actor',
        emailVerified: true,
        lifecycleState: 'ACTIVE'
    } as typeof users.$inferInsert);
}

// ---------------------------------------------------------------------------
// Transaction helper that redirects getDb() to use the transaction
// ---------------------------------------------------------------------------

/**
 * Wraps `withServiceTestTransaction` and ensures that social services (which
 * call `getDb()` internally and do not accept `ServiceContext`) query through
 * the same transaction so seed rows are visible.
 *
 * Restores the outer global DB client after the body completes regardless of
 * outcome.
 */
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
// Seed helpers
// ---------------------------------------------------------------------------

/**
 * Seeds a single `social_platform_formats` row (INSTAGRAM × FEED_POST) that
 * is enabled and does NOT require media (so approve succeeds without a media
 * row). Returns the generated `platformFormatId`.
 */
async function seedPlatformFormat(
    tx: DrizzleClient
): Promise<{ readonly platformFormatId: string }> {
    const rows = await tx.execute<{ id: string }>(sql`
        INSERT INTO social_platform_formats (
            platform, publish_format, media_type, enabled, mvp_enabled,
            requires_media, requires_public_url
        )
        VALUES (
            'INSTAGRAM', 'FEED_POST', 'IMAGE', true, true, false, false
        )
        ON CONFLICT (platform, publish_format) DO UPDATE
            SET enabled = true, requires_media = false
        RETURNING id
    `);

    const id = rows.rows?.[0]?.id;
    if (!id) throw new Error('seedPlatformFormat: no id returned');
    return { platformFormatId: id };
}

/**
 * Seeds a `social_assets` row and a `social_post_media` row linking it to
 * `postId`, so that `findEligibleTargets` passes the media-presence check
 * (condition 6: post must have at least one media row).
 */
async function seedPostMedia(
    tx: DrizzleClient,
    postId: string
): Promise<{ readonly assetId: string; readonly mediaId: string }> {
    const assetRows = await tx.execute<{ id: string }>(sql`
        INSERT INTO social_assets (
            source, cloudinary_url, cloudinary_public_id, original_url, media_type
        )
        VALUES (
            'EXTERNAL_URL',
            'https://res.cloudinary.com/demo/image/upload/sample.jpg',
            'sample',
            'https://example.com/sample.jpg',
            'IMAGE'
        )
        RETURNING id
    `);

    const assetId = assetRows.rows?.[0]?.id;
    if (!assetId) throw new Error('seedPostMedia: asset insert returned no id');

    const mediaRows = await tx.execute<{ id: string }>(sql`
        INSERT INTO social_post_media (social_post_id, asset_id, position)
        VALUES (${postId}, ${assetId}, 0)
        RETURNING id
    `);

    const mediaId = mediaRows.rows?.[0]?.id;
    if (!mediaId) throw new Error('seedPostMedia: media insert returned no id');

    return { assetId, mediaId };
}

/**
 * Returns a valid `CreateSocialDraft` payload targeting INSTAGRAM / FEED_POST.
 * `draftId` is randomised to avoid UNIQUE constraint collisions across test runs.
 */
function buildDraftPayload(): CreateSocialDraft {
    return {
        operatorPin: 'test-pin',
        draftId: `draft-${crypto.randomUUID()}`,
        title: 'Litoral Esteros del Iberá',
        captionBase: 'Explore the wetlands and wildlife of the Argentine Mesopotamia.',
        pillar: 'nature',
        targets: [
            {
                platform: SocialPlatformEnum.INSTAGRAM,
                publishFormat: SocialPublishFormatEnum.FEED_POST
            }
        ]
    };
}

// ---------------------------------------------------------------------------
// Mock setup for global fetch
// ---------------------------------------------------------------------------

/**
 * Replaces the global `fetch` with a vitest spy that returns a 200 OK response
 * with a Make.com Webhook Response SUCCESS body, simulating Make.com publishing
 * the post and returning the result synchronously.
 */
function mockFetchSuccess(): void {
    vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({
                status: 'SUCCESS',
                externalPostId: 'mock-external-post-id',
                externalPostUrl: 'https://instagram.com/p/mock-post'
            })
        } satisfies Partial<Response> as Response)
    );
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('SPEC-254 T-050 — full social pipeline: ingest → dispatch → callbacks', () => {
    beforeAll(() => {
        if (!dbAvailable) return;
        getServiceTestDb();
    });

    afterAll(async () => {
        if (!dbAvailable) return;
        await closeServiceTestPool();
    });

    beforeEach(() => {
        if (!dbAvailable) return;
        // Stub fetch before each test so dispatchTarget does not make real HTTP calls.
        mockFetchSuccess();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    // -------------------------------------------------------------------------
    // Scenario A — ONCE recurrence happy path
    // -------------------------------------------------------------------------

    it.skipIf(!dbAvailable)(
        'Scenario A: ingest → approve → markReady → findEligibleTargets finds the target',
        async () => {
            await withSocialTestTransaction(async (tx) => {
                // Arrange
                await seedPlatformFormat(tx);
                const actor = buildFullActor();
                await seedActorUser(tx, actor);
                const payload = buildDraftPayload();

                const serviceConfig = {};
                const ingestionService = new SocialDraftIngestionService(serviceConfig);
                const auditLogService = new SocialAuditLogService(serviceConfig);
                const postService = new SocialPostService(
                    serviceConfig,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    auditLogService
                );
                const dispatchService = new SocialPublishDispatchService(serviceConfig);

                // Step 1: ingest
                const ingestResult = await ingestionService.ingestDraft({
                    payload,
                    actorId: actor.id
                });
                expect(ingestResult.code).toBe('SUCCESS');
                if (ingestResult.code !== 'SUCCESS') throw new Error('expected SUCCESS');
                const postId = ingestResult.data.postId;

                // Seed a media row (required by findEligibleTargets condition 6)
                await seedPostMedia(tx, postId);

                // Step 2: approve
                const approveResult = await postService.approve({ actor, postId });
                expect(approveResult.error).toBeUndefined();

                // Step 3: markReady → status = READY_TO_PUBLISH
                const markResult = await postService.markReady({ actor, postId });
                expect(markResult.error).toBeUndefined();
                expect(markResult.data?.status).toBe(SocialPostStatusEnum.READY_TO_PUBLISH);

                // Step 4: findEligibleTargets
                const { targets } = await dispatchService.findEligibleTargets();

                // Assert — the target for our post must be in the eligible list
                const ourTarget = targets.find((b) => (b.post.id as string | undefined) === postId);
                expect(ourTarget).toBeDefined();
            });
        }
    );

    it.skipIf(!dbAvailable)(
        'Scenario A: dispatchTarget resolves synchronously to PUBLISHED and publish_log=SUCCESS',
        async () => {
            await withSocialTestTransaction(async (tx) => {
                // Arrange
                await seedPlatformFormat(tx);
                const actor = buildFullActor();
                await seedActorUser(tx, actor);
                const payload = buildDraftPayload();

                const serviceConfig = {};
                const ingestionService = new SocialDraftIngestionService(serviceConfig);
                const auditLogService = new SocialAuditLogService(serviceConfig);
                const postService = new SocialPostService(
                    serviceConfig,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    auditLogService
                );
                const dispatchService = new SocialPublishDispatchService(serviceConfig);

                // Pipeline: ingest → seed media → approve → markReady
                const ingestResult = await ingestionService.ingestDraft({
                    payload,
                    actorId: actor.id
                });
                if (ingestResult.code !== 'SUCCESS') throw new Error('expected SUCCESS');
                const postId = ingestResult.data.postId;

                await seedPostMedia(tx, postId);
                await postService.approve({ actor, postId });
                await postService.markReady({ actor, postId });

                const { targets } = await dispatchService.findEligibleTargets();
                const bundle = targets.find((b) => (b.post.id as string) === postId);
                expect(bundle).toBeDefined();
                if (!bundle) throw new Error('target bundle not found');

                const targetId = bundle.target.id as string;

                // Act — dispatch with webhook URL override (bypasses settings lookup).
                // mockFetchSuccess (in beforeEach) returns { status: 'SUCCESS', ... },
                // so dispatchTarget resolves synchronously to 'published'.
                const dispatchResult = await dispatchService.dispatchTarget({
                    target: bundle.target,
                    post: bundle.post,
                    makeApiKey: 'test-api-key',
                    webhookUrl: 'https://hook.make.com/test-webhook'
                });

                // Assert outcome — synchronous publish
                expect(dispatchResult.outcome).toBe('published');

                // Verify target status = PUBLISHED in DB
                const targetRows = await tx.execute<{ status: string }>(sql`
                    SELECT status
                    FROM social_post_targets
                    WHERE id = ${targetId}
                `);
                expect(targetRows.rows?.[0]?.status).toBe(SocialPostStatusEnum.PUBLISHED);

                // Verify publish_log has a SUCCESS row
                const logRows = await tx.execute<{ status: string }>(sql`
                    SELECT status
                    FROM social_publish_logs
                    WHERE social_post_id = ${postId}
                      AND social_post_target_id = ${targetId}
                    ORDER BY created_at DESC
                    LIMIT 1
                `);
                expect(logRows.rows?.[0]?.status).toBe(SocialPublishResultStatusEnum.SUCCESS);
            });
        }
    );
});
