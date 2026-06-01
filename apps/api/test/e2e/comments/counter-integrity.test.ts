/**
 * @file counter-integrity.test.ts
 *
 * E2E tests for posts.comments counter integrity (SPEC-165 T-012).
 *
 * Covers AC-24, AC-25, AC-26.
 *
 * These tests compose multiple HTTP operations in sequence and verify
 * that the `posts.comments` integer counter in the DB is kept accurate
 * after creates, soft-deletes, and moderation-state transitions. They
 * also verify that event comments do NOT touch the `events` table.
 *
 * NOTE: each test leaves data in the DB; afterEach runs testDb.clean() to reset state.
 */

import { events, eq } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app.js';
import { createAuthenticatedRequest, createMockActor } from '../../helpers/auth.js';
import {
    readPostCommentsCounter,
    seedComment,
    seedEvent,
    seedPost
} from '../setup/seed-comment-helpers.js';
import { createTestUser } from '../setup/seed-helpers.js';
import { testDb } from '../setup/test-database.js';

/** Helper: build request headers for a USER with POST_COMMENT_CREATE. */
function userHeaders(userId: string): HeadersInit {
    const actor = createMockActor(RoleEnum.USER, [PermissionEnum.POST_COMMENT_CREATE], userId);
    return createAuthenticatedRequest(actor).headers;
}

/** Helper: build request headers for an EDITOR with all comment + admin permissions. */
function editorHeaders(userId: string): HeadersInit {
    const actor = createMockActor(
        RoleEnum.EDITOR,
        [
            PermissionEnum.ACCESS_API_ADMIN,
            PermissionEnum.POST_COMMENT_VIEW,
            PermissionEnum.EVENT_COMMENT_VIEW,
            PermissionEnum.POST_COMMENT_MODERATE,
            PermissionEnum.EVENT_COMMENT_MODERATE
        ],
        userId
    );
    return createAuthenticatedRequest(actor).headers;
}

/**
 * Read the `events` table row for the given event id from the live DB.
 * Returns the raw row so tests can assert no unexpected columns changed.
 */
async function readEventRow(eventId: string): Promise<Record<string, unknown>> {
    const db = testDb.getDb();
    const result = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
    const row = result[0];
    if (!row) throw new Error(`readEventRow: event ${eventId} not found`);
    return row as Record<string, unknown>;
}

describe('SPEC-165 T-012 — posts.comments counter integrity', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(async () => {
        await testDb.setup();
        app = initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    afterEach(async () => {
        await testDb.clean();
    });

    // -------------------------------------------------------------------------
    // AC-24: post starts at 5; create 2 new + soft-delete 1 APPROVED → counter = 6
    // -------------------------------------------------------------------------

    it('AC-24: counter reflects +2 creates and -1 soft-delete correctly (5 → 7 → 6)', async () => {
        // ARRANGE: post with counter = 5 (pre-seeded), plus an existing APPROVED comment to delete
        const user = await createTestUser();
        const { postId } = await seedPost({ authorId: user.id, comments: 5 });

        // Seed an existing APPROVED comment that we will delete via API
        const { commentId: existingCommentId } = await seedComment({
            entityType: 'POST',
            entityId: postId,
            authorId: user.id,
            moderationState: 'APPROVED'
        });

        const createHeaders = userHeaders(user.id);
        const deleteHeaders = createAuthenticatedRequest(
            createMockActor(RoleEnum.USER, [], user.id)
        ).headers;

        // Verify starting counter (5 — seedComment bypasses the service, counter is still 5)
        const startCounter = await readPostCommentsCounter(postId);
        expect(startCounter).toBe(5);

        // ACT: create 2 new comments via API (service increments counter each time)
        const r1 = await app.request(`/api/v1/protected/posts/${postId}/comments`, {
            method: 'POST',
            headers: createHeaders,
            body: JSON.stringify({ content: 'New comment 1' })
        });
        expect(r1.status).toBe(201);

        const r2 = await app.request(`/api/v1/protected/posts/${postId}/comments`, {
            method: 'POST',
            headers: createHeaders,
            body: JSON.stringify({ content: 'New comment 2' })
        });
        expect(r2.status).toBe(201);

        // Counter should now be 7 (5 seed + 2 created via API)
        const afterCreate = await readPostCommentsCounter(postId);
        expect(afterCreate).toBe(7);

        // ACT: soft-delete the pre-existing APPROVED comment via API
        const del = await app.request(`/api/v1/protected/comments/${existingCommentId}`, {
            method: 'DELETE',
            headers: deleteHeaders
        });
        expect(del.status).toBe(200);

        // ASSERT: counter = 6 (7 - 1 soft-delete)
        const finalCounter = await readPostCommentsCounter(postId);
        expect(finalCounter).toBe(6);
    });

    // -------------------------------------------------------------------------
    // AC-25: APPROVED→REJECTED→APPROVED round-trip via moderation
    // -------------------------------------------------------------------------

    it('AC-25: moderation APPROVED→REJECTED (3→2) then REJECTED→APPROVED (2→3)', async () => {
        // ARRANGE: post with counter = 3 and one tracked comment (APPROVED)
        const user = await createTestUser();
        const { postId } = await seedPost({ authorId: user.id, comments: 3 });
        const { commentId } = await seedComment({
            entityType: 'POST',
            entityId: postId,
            authorId: user.id,
            moderationState: 'APPROVED'
        });

        const headers = editorHeaders(user.id);

        const startCounter = await readPostCommentsCounter(postId);
        expect(startCounter).toBe(3);

        // ACT 1: moderate APPROVED → REJECTED
        const rejectResp = await app.request(`/api/v1/admin/comments/${commentId}/moderation`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ moderationState: 'REJECTED' })
        });
        expect(rejectResp.status).toBe(200);

        const afterReject = await readPostCommentsCounter(postId);
        expect(afterReject).toBe(2);

        // ACT 2: moderate REJECTED → APPROVED (restore approval)
        const approveResp = await app.request(`/api/v1/admin/comments/${commentId}/moderation`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ moderationState: 'APPROVED' })
        });
        expect(approveResp.status).toBe(200);

        const afterApprove = await readPostCommentsCounter(postId);
        expect(afterApprove).toBe(3);
    });

    // -------------------------------------------------------------------------
    // AC-26: event comment created or deleted → events table NOT modified
    // -------------------------------------------------------------------------

    it('AC-26: creating an event comment does NOT modify the events table row', async () => {
        // ARRANGE
        const user = await createTestUser();
        const { eventId } = await seedEvent({ authorId: user.id });

        // Snapshot the event row before
        const before = await readEventRow(eventId);

        const actor = createMockActor(
            RoleEnum.USER,
            [PermissionEnum.EVENT_COMMENT_CREATE],
            user.id
        );
        const headers = createAuthenticatedRequest(actor).headers;

        // ACT: create event comment
        const createResp = await app.request(`/api/v1/protected/events/${eventId}/comments`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ content: 'Event comment test' })
        });
        expect(createResp.status).toBe(201);

        // ASSERT: events table row is identical in critical columns
        const after = await readEventRow(eventId);
        expect(after.id).toBe(before.id);
        expect(after.slug).toBe(before.slug);
        expect(after.name).toBe(before.name);
        // Events table has no `comments` column — assert it is absent
        expect(after).not.toHaveProperty('comments');
    });

    it('AC-26: soft-deleting an event comment does NOT modify the events table row', async () => {
        // ARRANGE: an approved event comment (seeded directly)
        const user = await createTestUser();
        const { eventId } = await seedEvent({ authorId: user.id });
        const { commentId } = await seedComment({
            entityType: 'EVENT',
            entityId: eventId,
            authorId: user.id,
            moderationState: 'APPROVED'
        });

        // Snapshot the event row
        const before = await readEventRow(eventId);

        const actor = createMockActor(RoleEnum.USER, [], user.id);
        const headers = createAuthenticatedRequest(actor).headers;

        // ACT: delete own event comment
        const deleteResp = await app.request(`/api/v1/protected/comments/${commentId}`, {
            method: 'DELETE',
            headers
        });
        expect(deleteResp.status).toBe(200);

        // ASSERT: events table unchanged
        const after = await readEventRow(eventId);
        expect(after.id).toBe(before.id);
        expect(after.slug).toBe(before.slug);
        expect(after).not.toHaveProperty('comments');
    });
});
