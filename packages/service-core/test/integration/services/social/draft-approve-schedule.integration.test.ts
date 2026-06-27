/**
 * SPEC-254 T-038 — editorial pipeline integration test (real DB).
 *
 * Exercises the full editorial state-machine in sequence on a single social post:
 *   1. `SocialDraftIngestionService.ingestDraft` — creates the post with
 *      status=NEEDS_REVIEW, approvalStatus=PENDING.
 *   2. `SocialPostService.approve` — advances to APPROVED; asserts a
 *      POST_APPROVED row in social_audit_log.
 *   3. `SocialPostService.schedule` — advances to SCHEDULED with a future
 *      scheduledAt; asserts a POST_SCHEDULED audit row.
 *   4. `SocialPostService.markReady` — advances to READY_TO_PUBLISH with
 *      nextRunAt ≈ now; asserts a POST_MARKED_READY audit row.
 *
 * The social services (`SocialDraftIngestionService`, `SocialPostService`) do NOT
 * extend `BaseCrudService` and do NOT accept a `ServiceContext`. Instead they
 * call `getDb()` internally. To make seed data visible to those calls inside the
 * rollback-isolated transaction, each test redirects the module-level DB client to
 * the transaction via `setDb(tx)` before exercising the services, then restores
 * the outer connection after the body completes (regardless of outcome).
 *
 * Runs only under `pnpm test:integration` (which provisions the ephemeral DB).
 * When `HOSPEDA_TEST_DATABASE_URL` is not set the suite skips cleanly.
 *
 * @see SPEC-254 T-038
 */

import { setDb, sql, users } from '@repo/db';
import type { DrizzleClient } from '@repo/db';
import {
    PermissionEnum,
    RoleEnum,
    SocialApprovalStatusEnum,
    SocialPlatformEnum,
    SocialPostStatusEnum,
    SocialPublishFormatEnum
} from '@repo/schemas';
import type { CreateSocialDraft } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SocialAuditEvent } from '../../../../src/services/social/social-audit-log.service';
import { SocialAuditLogService } from '../../../../src/services/social/social-audit-log.service';
import { SocialDraftIngestionService } from '../../../../src/services/social/social-draft-ingestion.service';
import { SocialPostService } from '../../../../src/services/social/social-post.service';
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
 * Builds an actor with all social permissions required by the editorial pipeline.
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
 * Wraps `withServiceTestTransaction` and ensures that the social services
 * (which call `getDb()` internally) query through the same transaction, so
 * seed rows inserted via `tx` are visible to the models.
 *
 * Restores the outer global DB client after the body completes regardless of
 * whether it threw or not.
 */
async function withSocialTestTransaction(fn: (tx: DrizzleClient) => Promise<void>): Promise<void> {
    const outerDb = getServiceTestDb();
    await withServiceTestTransaction(async (tx) => {
        // Redirect global getDb() to the transaction so all models inside use it.
        setDb(tx);
        try {
            await fn(tx);
        } finally {
            // Always restore the outer DB client.
            setDb(outerDb);
        }
    });
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

/**
 * Seeds the minimum rows required so that `ingestDraft` can succeed inside a
 * test transaction:
 *   - One `social_platform_formats` row (INSTAGRAM × FEED_POST, enabled=true,
 *     requiresMedia=false) — allows the target validation step to find a match
 *     without requiring media.
 *
 * Must be called AFTER `setDb(tx)` so the ON CONFLICT update is in the same
 * transaction scope as the INSERT.
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
 * Returns a valid `CreateSocialDraft` payload targeting INSTAGRAM / FEED_POST.
 * `draftId` is randomised per call to avoid UNIQUE constraint collisions.
 */
function buildDraftPayload(): CreateSocialDraft {
    return {
        operatorPin: 'test-pin',
        draftId: `draft-${crypto.randomUUID()}`,
        title: 'Discover Concepción del Uruguay',
        captionBase: 'Visit our beautiful city along the Uruguay River.',
        pillar: 'travel',
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
// Tests
// ---------------------------------------------------------------------------

describe('SPEC-254 T-038 — editorial pipeline: ingest → approve → schedule → markReady', () => {
    beforeAll(() => {
        if (!dbAvailable) return;
        getServiceTestDb();
    });

    afterAll(async () => {
        if (!dbAvailable) return;
        await closeServiceTestPool();
    });

    it.skipIf(!dbAvailable)(
        'ingestDraft creates post with status=NEEDS_REVIEW and approvalStatus=PENDING',
        async () => {
            await withSocialTestTransaction(async (tx) => {
                // Arrange
                await seedPlatformFormat(tx);
                const actor = buildFullActor();
                await seedActorUser(tx, actor);
                const payload = buildDraftPayload();

                const serviceConfig = {};
                const ingestionService = new SocialDraftIngestionService(serviceConfig);

                // Act
                const result = await ingestionService.ingestDraft({
                    payload,
                    actorId: actor.id
                });

                // Assert
                expect(result.code).toBe('SUCCESS');
                if (result.code !== 'SUCCESS') throw new Error('expected SUCCESS');

                expect(result.data.status).toBe('NEEDS_REVIEW');
                expect(result.data.approvalStatus).toBe('PENDING');
                expect(result.data.targetsCreated).toBe(1);
                expect(result.data.draftId).toBe(payload.draftId);

                // Verify the DB row directly
                const dbRows = await tx.execute<{
                    status: string;
                    approval_status: string;
                    paused: boolean;
                }>(sql`
                    SELECT status, approval_status, paused
                    FROM social_posts
                    WHERE id = ${result.data.postId}
                `);
                const row = dbRows.rows?.[0];
                expect(row?.status).toBe(SocialPostStatusEnum.NEEDS_REVIEW);
                expect(row?.approval_status).toBe(SocialApprovalStatusEnum.PENDING);
                expect(row?.paused).toBe(false);
            });
        }
    );

    it.skipIf(!dbAvailable)(
        'approve transitions post to APPROVED and writes POST_APPROVED audit row',
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

                const ingestResult = await ingestionService.ingestDraft({
                    payload,
                    actorId: actor.id
                });
                if (ingestResult.code !== 'SUCCESS') {
                    throw new Error(`ingestDraft failed: ${JSON.stringify(ingestResult)}`);
                }
                const postId = ingestResult.data.postId;

                // Act — approve requires SOCIAL_POST_APPROVE permission
                const approveResult = await postService.approve({ actor, postId });

                // Assert
                expect(approveResult.error).toBeUndefined();
                expect(approveResult.data?.status).toBe(SocialPostStatusEnum.APPROVED);
                expect(approveResult.data?.approvalStatus).toBe(SocialApprovalStatusEnum.APPROVED);

                // Verify the DB row
                const dbRows = await tx.execute<{
                    status: string;
                    approval_status: string;
                }>(sql`
                    SELECT status, approval_status
                    FROM social_posts
                    WHERE id = ${postId}
                `);
                const row = dbRows.rows?.[0];
                expect(row?.status).toBe(SocialPostStatusEnum.APPROVED);
                expect(row?.approval_status).toBe(SocialApprovalStatusEnum.APPROVED);

                // Verify audit log
                const auditRows = await queryAuditRows(tx, postId, SocialAuditEvent.POST_APPROVED);
                expect(auditRows.length).toBeGreaterThanOrEqual(1);
            });
        }
    );

    it.skipIf(!dbAvailable)(
        'schedule transitions APPROVED post to SCHEDULED and writes POST_SCHEDULED audit row',
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

                // Ingest → approve
                const ingestResult = await ingestionService.ingestDraft({
                    payload,
                    actorId: actor.id
                });
                if (ingestResult.code !== 'SUCCESS') {
                    throw new Error(`ingestDraft failed: ${JSON.stringify(ingestResult)}`);
                }
                const postId = ingestResult.data.postId;

                await postService.approve({ actor, postId });

                // Act — schedule for 1 hour in the future
                const scheduledAt = new Date(Date.now() + 60 * 60 * 1000);
                const scheduleResult = await postService.schedule({
                    actor,
                    postId,
                    scheduledAt,
                    timezone: 'America/Argentina/Buenos_Aires'
                });

                // Assert
                expect(scheduleResult.error).toBeUndefined();
                expect(scheduleResult.data?.status).toBe(SocialPostStatusEnum.SCHEDULED);

                // Verify the DB row
                const dbRows = await tx.execute<{
                    status: string;
                    scheduled_at: string;
                    next_run_at: string;
                }>(sql`
                    SELECT status, scheduled_at, next_run_at
                    FROM social_posts
                    WHERE id = ${postId}
                `);
                const row = dbRows.rows?.[0];
                expect(row?.status).toBe(SocialPostStatusEnum.SCHEDULED);
                expect(row?.scheduled_at).not.toBeNull();
                expect(row?.next_run_at).not.toBeNull();

                // Verify audit log
                const auditRows = await queryAuditRows(tx, postId, SocialAuditEvent.POST_SCHEDULED);
                expect(auditRows.length).toBeGreaterThanOrEqual(1);
            });
        }
    );

    it.skipIf(!dbAvailable)(
        'markReady transitions APPROVED post to READY_TO_PUBLISH and writes POST_MARKED_READY audit row',
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

                // Ingest → approve
                const ingestResult = await ingestionService.ingestDraft({
                    payload,
                    actorId: actor.id
                });
                if (ingestResult.code !== 'SUCCESS') {
                    throw new Error(`ingestDraft failed: ${JSON.stringify(ingestResult)}`);
                }
                const postId = ingestResult.data.postId;

                await postService.approve({ actor, postId });

                // Act
                const beforeMark = Date.now();
                const markResult = await postService.markReady({ actor, postId });
                const afterMark = Date.now();

                // Assert
                expect(markResult.error).toBeUndefined();
                expect(markResult.data?.status).toBe(SocialPostStatusEnum.READY_TO_PUBLISH);

                // Verify the DB row — nextRunAt must be ≈ now
                const dbRows = await tx.execute<{
                    status: string;
                    next_run_at: string;
                }>(sql`
                    SELECT status, next_run_at
                    FROM social_posts
                    WHERE id = ${postId}
                `);
                const row = dbRows.rows?.[0];
                expect(row?.status).toBe(SocialPostStatusEnum.READY_TO_PUBLISH);
                expect(row?.next_run_at).not.toBeNull();

                const nextRunAtMs = row?.next_run_at ? new Date(row.next_run_at).getTime() : 0;
                expect(nextRunAtMs).toBeGreaterThanOrEqual(beforeMark - 1000);
                expect(nextRunAtMs).toBeLessThanOrEqual(afterMark + 1000);

                // Verify audit log
                const auditRows = await queryAuditRows(
                    tx,
                    postId,
                    SocialAuditEvent.POST_MARKED_READY
                );
                expect(auditRows.length).toBeGreaterThanOrEqual(1);
            });
        }
    );

    it.skipIf(!dbAvailable)(
        'full editorial pipeline in sequence: ingest → approve → schedule → markReady',
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

                // Step 1: Ingest
                const ingestResult = await ingestionService.ingestDraft({
                    payload,
                    actorId: actor.id
                });
                expect(ingestResult.code).toBe('SUCCESS');
                if (ingestResult.code !== 'SUCCESS') throw new Error('expected SUCCESS');

                const postId = ingestResult.data.postId;
                expect(ingestResult.data.status).toBe('NEEDS_REVIEW');
                expect(ingestResult.data.approvalStatus).toBe('PENDING');

                // Step 2: Approve
                const approveResult = await postService.approve({ actor, postId });
                expect(approveResult.error).toBeUndefined();
                expect(approveResult.data?.status).toBe(SocialPostStatusEnum.APPROVED);
                expect(approveResult.data?.approvalStatus).toBe(SocialApprovalStatusEnum.APPROVED);

                // Verify POST_APPROVED audit
                const approvedAudit = await queryAuditRows(
                    tx,
                    postId,
                    SocialAuditEvent.POST_APPROVED
                );
                expect(approvedAudit.length).toBe(1);

                // Step 3: Schedule
                const scheduledAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // +2h
                const scheduleResult = await postService.schedule({
                    actor,
                    postId,
                    scheduledAt,
                    timezone: 'UTC'
                });
                expect(scheduleResult.error).toBeUndefined();
                expect(scheduleResult.data?.status).toBe(SocialPostStatusEnum.SCHEDULED);

                // Verify POST_SCHEDULED audit
                const scheduledAudit = await queryAuditRows(
                    tx,
                    postId,
                    SocialAuditEvent.POST_SCHEDULED
                );
                expect(scheduledAudit.length).toBe(1);

                // NOTE: markReady requires status=APPROVED, not SCHEDULED.
                // After scheduling we reset via direct DB update so we can
                // exercise markReady in the same test (they are normally mutually
                // exclusive paths in production usage).
                await tx.execute(sql`
                    UPDATE social_posts
                    SET status = 'APPROVED', scheduled_at = NULL, next_run_at = NULL
                    WHERE id = ${postId}
                `);

                // Step 4: Mark ready
                const markResult = await postService.markReady({ actor, postId });
                expect(markResult.error).toBeUndefined();
                expect(markResult.data?.status).toBe(SocialPostStatusEnum.READY_TO_PUBLISH);

                // Verify POST_MARKED_READY audit
                const readyAudit = await queryAuditRows(
                    tx,
                    postId,
                    SocialAuditEvent.POST_MARKED_READY
                );
                expect(readyAudit.length).toBe(1);

                // Final DB state assertion
                const finalRows = await tx.execute<{
                    status: string;
                    approval_status: string;
                    next_run_at: string;
                }>(sql`
                    SELECT status, approval_status, next_run_at
                    FROM social_posts
                    WHERE id = ${postId}
                `);
                const finalRow = finalRows.rows?.[0];
                expect(finalRow?.status).toBe(SocialPostStatusEnum.READY_TO_PUBLISH);
                expect(finalRow?.approval_status).toBe(SocialApprovalStatusEnum.APPROVED);
                expect(finalRow?.next_run_at).not.toBeNull();
            });
        }
    );
});
