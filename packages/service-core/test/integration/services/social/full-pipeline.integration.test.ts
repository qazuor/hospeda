/**
 * SPEC-254 T-050 — full end-to-end social pipeline integration test (real DB).
 *
 * Exercises the complete social automation pipeline against a real PostgreSQL
 * database, with external HTTP calls (Make.com webhook) mocked at the `fetch`
 * boundary so no real network traffic occurs:
 *
 *   Scenario A — ONCE recurrence (happy path):
 *     1. ingestDraft (no image pipeline) → post NEEDS_REVIEW / PENDING
 *     2. approve → APPROVED
 *     3. markReady → READY_TO_PUBLISH
 *     4. findEligibleTargets → the target appears in the eligible list
 *     5. dispatchTarget (fetch mocked → 200) → target=PUBLISHING; publish_log RETRYING
 *     6. handleMakeCallbackClaim → target=PUBLISHING, makeLastRunId recorded
 *     7. handleMakeCallbackResult SUCCESS → target=PUBLISHED; post=PUBLISHED;
 *        audit TARGET_PUBLISHED; nextRunAt=null (ONCE recurrence)
 *
 *   Scenario B — WEEKLY recurrence:
 *     After a successful result callback, the cascade rearms the post:
 *     post.status reset to APPROVED, next_run_at = next weekly occurrence,
 *     all targets reset to APPROVED with retry_count=0.
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

import { setDb, sql, users } from '@repo/db';
import type { DrizzleClient } from '@repo/db';
import {
    PermissionEnum,
    RoleEnum,
    SocialApprovalStatusEnum,
    SocialPlatformEnum,
    SocialPostStatusEnum,
    SocialPublishFormatEnum,
    SocialPublishResultStatusEnum
} from '@repo/schemas';
import type { CreateSocialDraft } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SocialAuditEvent } from '../../../../src/services/social/social-audit-log.service';
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

/**
 * Queries `social_audit_log` for rows matching the given entity and event type.
 */
async function queryAuditRows(
    tx: DrizzleClient,
    entityId: string,
    eventType: string
): Promise<ReadonlyArray<{ event_type: string; entity_id: string }>> {
    const result = await tx.execute<{ event_type: string; entity_id: string }>(sql`
        SELECT event_type, entity_id
        FROM social_audit_log
        WHERE entity_id = ${entityId}
          AND event_type = ${eventType}
        ORDER BY created_at DESC
    `);
    return result.rows ?? [];
}

// ---------------------------------------------------------------------------
// Mock setup for global fetch
// ---------------------------------------------------------------------------

/**
 * Replaces the global `fetch` with a vitest spy that returns a 200 OK response,
 * simulating Make.com accepting the webhook dispatch.
 */
function mockFetchSuccess(): void {
    vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ accepted: true })
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
        'Scenario A: dispatchTarget sets target=PUBLISHING and publish_log=RETRYING',
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

                // Act — dispatch with webhook URL override (bypasses settings lookup)
                const dispatchResult = await dispatchService.dispatchTarget({
                    target: bundle.target,
                    post: bundle.post,
                    makeApiKey: 'test-api-key',
                    apiBaseUrl: 'https://api.hospeda.test',
                    webhookUrl: 'https://hook.make.com/test-webhook'
                });

                // Assert outcome
                expect(dispatchResult.outcome).toBe('dispatched');

                // Verify target status = PUBLISHING in DB
                const targetRows = await tx.execute<{ status: string }>(sql`
                    SELECT status
                    FROM social_post_targets
                    WHERE id = ${targetId}
                `);
                expect(targetRows.rows?.[0]?.status).toBe(SocialPostStatusEnum.PUBLISHING);

                // Verify publish_log has a RETRYING row
                const logRows = await tx.execute<{ status: string }>(sql`
                    SELECT status
                    FROM social_publish_logs
                    WHERE social_post_id = ${postId}
                      AND social_post_target_id = ${targetId}
                    ORDER BY created_at DESC
                    LIMIT 1
                `);
                expect(logRows.rows?.[0]?.status).toBe(SocialPublishResultStatusEnum.RETRYING);
            });
        }
    );

    it.skipIf(!dbAvailable)(
        'Scenario A: handleMakeCallbackClaim records PUBLISHING and makeLastRunId',
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

                // Pipeline: ingest → seed media → approve → markReady → dispatch
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
                if (!bundle) throw new Error('target bundle not found');
                const targetId = bundle.target.id as string;

                await dispatchService.dispatchTarget({
                    target: bundle.target,
                    post: bundle.post,
                    makeApiKey: 'test-api-key',
                    apiBaseUrl: 'https://api.hospeda.test',
                    webhookUrl: 'https://hook.make.com/test-webhook'
                });

                const makeRunId = `run-${crypto.randomUUID()}`;

                // Act — claim callback
                const claimResult = await dispatchService.handleMakeCallbackClaim({
                    targetId,
                    makeRunId
                });

                // Assert
                expect(claimResult.targetId).toBe(targetId);
                expect(claimResult.status).toBe('PUBLISHING');

                // Verify makeLastRunId stored in DB
                const targetRows = await tx.execute<{
                    status: string;
                    make_last_run_id: string;
                }>(sql`
                    SELECT status, make_last_run_id
                    FROM social_post_targets
                    WHERE id = ${targetId}
                `);
                const row = targetRows.rows?.[0];
                expect(row?.status).toBe(SocialPostStatusEnum.PUBLISHING);
                expect(row?.make_last_run_id).toBe(makeRunId);
            });
        }
    );

    it.skipIf(!dbAvailable)(
        'Scenario A: ONCE — handleMakeCallbackResult SUCCESS → target PUBLISHED, post PUBLISHED, audit TARGET_PUBLISHED, nextRunAt null',
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

                // Pipeline: ingest → seed media → approve → markReady → dispatch → claim
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
                if (!bundle) throw new Error('target bundle not found');
                const targetId = bundle.target.id as string;

                await dispatchService.dispatchTarget({
                    target: bundle.target,
                    post: bundle.post,
                    makeApiKey: 'test-api-key',
                    apiBaseUrl: 'https://api.hospeda.test',
                    webhookUrl: 'https://hook.make.com/test-webhook'
                });

                await dispatchService.handleMakeCallbackClaim({
                    targetId,
                    makeRunId: 'run-abc-123'
                });

                // Act — result callback SUCCESS
                const resultResponse = await dispatchService.handleMakeCallbackResult({
                    targetId,
                    status: 'SUCCESS',
                    externalPostId: 'ig-post-001',
                    externalPostUrl: 'https://www.instagram.com/p/abc123/',
                    makeRunId: 'run-abc-123'
                });

                // Assert result
                expect(resultResponse.targetId).toBe(targetId);
                expect(resultResponse.status).toBe('PUBLISHED');

                // Verify target = PUBLISHED in DB
                const targetRows = await tx.execute<{
                    status: string;
                    external_post_id: string;
                    external_post_url: string;
                }>(sql`
                    SELECT status, external_post_id, external_post_url
                    FROM social_post_targets
                    WHERE id = ${targetId}
                `);
                const targetRow = targetRows.rows?.[0];
                expect(targetRow?.status).toBe(SocialPostStatusEnum.PUBLISHED);
                expect(targetRow?.external_post_id).toBe('ig-post-001');
                expect(targetRow?.external_post_url).toBe('https://www.instagram.com/p/abc123/');

                // Verify post = PUBLISHED in DB and nextRunAt = null (ONCE recurrence)
                const postRows = await tx.execute<{
                    status: string;
                    next_run_at: string | null;
                }>(sql`
                    SELECT status, next_run_at
                    FROM social_posts
                    WHERE id = ${postId}
                `);
                const postRow = postRows.rows?.[0];
                expect(postRow?.status).toBe(SocialPostStatusEnum.PUBLISHED);
                // Default recurrence for ingested posts is ONCE — nextRunAt nulled after publish
                expect(postRow?.next_run_at).toBeNull();

                // Verify TARGET_PUBLISHED audit row
                const auditRows = await queryAuditRows(
                    tx,
                    targetId,
                    SocialAuditEvent.TARGET_PUBLISHED
                );
                expect(auditRows.length).toBeGreaterThanOrEqual(1);

                // Verify publish_log has a SUCCESS row
                const logRows = await tx.execute<{ status: string }>(sql`
                    SELECT status
                    FROM social_publish_logs
                    WHERE social_post_id = ${postId}
                      AND social_post_target_id = ${targetId}
                      AND status = 'SUCCESS'
                    LIMIT 1
                `);
                expect(logRows.rows?.length).toBe(1);
            });
        }
    );

    // -------------------------------------------------------------------------
    // Scenario B — WEEKLY recurrence rearm
    // -------------------------------------------------------------------------

    it.skipIf(!dbAvailable)(
        'Scenario B: WEEKLY — after SUCCESS callback post rearms to APPROVED with future next_run_at and targets reset',
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

                // Pipeline: ingest → set WEEKLY recurrence → seed media → approve → markReady
                const ingestResult = await ingestionService.ingestDraft({
                    payload,
                    actorId: actor.id
                });
                if (ingestResult.code !== 'SUCCESS') throw new Error('expected SUCCESS');
                const postId = ingestResult.data.postId;

                // Patch post to WEEKLY recurrence with timezone before approve/dispatch
                await tx.execute(sql`
                    UPDATE social_posts
                    SET recurrence_type = 'WEEKLY',
                        recurrence_params_json = '{"weekday": "MONDAY"}',
                        timezone = 'UTC'
                    WHERE id = ${postId}
                `);

                await seedPostMedia(tx, postId);
                await postService.approve({ actor, postId });
                await postService.markReady({ actor, postId });

                const { targets } = await dispatchService.findEligibleTargets();
                const bundle = targets.find((b) => (b.post.id as string) === postId);
                if (!bundle) throw new Error('target bundle not found');
                const targetId = bundle.target.id as string;

                await dispatchService.dispatchTarget({
                    target: bundle.target,
                    post: bundle.post,
                    makeApiKey: 'test-api-key',
                    apiBaseUrl: 'https://api.hospeda.test',
                    webhookUrl: 'https://hook.make.com/test-webhook'
                });

                await dispatchService.handleMakeCallbackClaim({
                    targetId,
                    makeRunId: 'run-weekly-001'
                });

                // Act — result callback SUCCESS
                const beforeCallback = Date.now();
                const resultResponse = await dispatchService.handleMakeCallbackResult({
                    targetId,
                    status: 'SUCCESS',
                    externalPostId: 'ig-weekly-post',
                    makeRunId: 'run-weekly-001'
                });

                // Assert result
                expect(resultResponse.status).toBe('PUBLISHED');

                // Verify post was rearmed — status=APPROVED, next_run_at is a future date
                const postRows = await tx.execute<{
                    status: string;
                    approval_status: string;
                    next_run_at: string | null;
                    recurrence_type: string;
                }>(sql`
                    SELECT status, approval_status, next_run_at, recurrence_type
                    FROM social_posts
                    WHERE id = ${postId}
                `);
                const postRow = postRows.rows?.[0];

                expect(postRow?.status).toBe(SocialPostStatusEnum.APPROVED);
                expect(postRow?.approval_status).toBe(SocialApprovalStatusEnum.APPROVED);
                expect(postRow?.recurrence_type).toBe('WEEKLY');
                expect(postRow?.next_run_at).not.toBeNull();

                // next_run_at must be in the future (at least 1 second after test start)
                const nextRunAtMs = postRow?.next_run_at
                    ? new Date(postRow.next_run_at).getTime()
                    : 0;
                expect(nextRunAtMs).toBeGreaterThan(beforeCallback);

                // Verify all targets were reset to APPROVED with retry_count=0
                const targetRows = await tx.execute<{
                    status: string;
                    retry_count: number;
                }>(sql`
                    SELECT status, retry_count
                    FROM social_post_targets
                    WHERE social_post_id = ${postId}
                `);
                for (const t of targetRows.rows ?? []) {
                    expect(t.status).toBe(SocialPostStatusEnum.APPROVED);
                    expect(t.retry_count).toBe(0);
                }
            });
        }
    );
});
