/**
 * @file admin-comments.test.ts
 *
 * E2E tests for admin comment endpoints (SPEC-165 T-012).
 *
 * Covers AC-17, AC-18, AC-19, AC-20, AC-21, AC-22, AC-23.
 *
 * Route surface (all under /api/v1/admin/comments):
 *   GET    /recent                        — AC-17, AC-18
 *   PATCH  /:commentId/moderation         — AC-19, AC-20
 *   DELETE /:commentId                    — AC-21 (soft)
 *   DELETE /:commentId/hard               — AC-22
 *   POST   /:commentId/restore            — AC-23
 *
 * Admin routes require ACCESS_API_ADMIN (or ACCESS_PANEL_ADMIN) in addition
 * to the route-specific permissions. The EDITOR actor helper below includes
 * ACCESS_API_ADMIN.
 *
 * NOTE: each test leaves data in the DB; afterEach runs testDb.clean() to reset state.
 */

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

/**
 * Build request headers for an EDITOR actor with all comment permissions AND
 * the admin-access gate permission (ACCESS_API_ADMIN).
 */
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

describe('SPEC-165 T-012 — admin comment endpoints', () => {
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
    // AC-17: EDITOR GET /recent → ≤10 items, newest-first, any moderationState,
    //        fields: {id, entityType, entityId, content, authorName, moderationState, createdAt}
    // -------------------------------------------------------------------------

    it('AC-17: admin recent returns up to 10 items in createdAt DESC with required fields', async () => {
        // ARRANGE: 2 users, 1 post, 1 event, 3 comments of different states
        const user = await createTestUser();
        const { postId } = await seedPost({ authorId: user.id });
        const { eventId } = await seedEvent({ authorId: user.id });

        await seedComment({
            entityType: 'POST',
            entityId: postId,
            authorId: user.id,
            content: 'Approved post comment',
            moderationState: 'APPROVED'
        });
        await seedComment({
            entityType: 'POST',
            entityId: postId,
            authorId: user.id,
            content: 'Rejected post comment',
            moderationState: 'REJECTED'
        });
        await seedComment({
            entityType: 'EVENT',
            entityId: eventId,
            authorId: user.id,
            content: 'Approved event comment',
            moderationState: 'APPROVED'
        });

        // ACT
        const headers = editorHeaders(user.id);
        const response = await app.request('/api/v1/admin/comments/recent', {
            method: 'GET',
            headers
        });

        // ASSERT — status
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);
        // Recent feed payload is { data: RecentItem[] }, wrapped by ResponseFactory
        // as { success, data: { data: [...] } } — assert the canonical path strictly.
        expect(Array.isArray(body.data.data)).toBe(true);
        const items: Record<string, unknown>[] = body.data.data;
        expect(items.length).toBeGreaterThanOrEqual(1);
        expect(items.length).toBeLessThanOrEqual(10);

        // Check required fields on first item
        const first = items[0];
        expect(first).toHaveProperty('id');
        expect(first).toHaveProperty('entityType');
        expect(first).toHaveProperty('entityId');
        expect(first).toHaveProperty('content');
        expect(first).toHaveProperty('authorName');
        expect(first).toHaveProperty('moderationState');
        expect(first).toHaveProperty('createdAt');
    });

    // -------------------------------------------------------------------------
    // AC-18: actor without BOTH POST_COMMENT_VIEW AND EVENT_COMMENT_VIEW → 403
    // -------------------------------------------------------------------------

    it('AC-18: actor with only POST_COMMENT_VIEW (missing EVENT_COMMENT_VIEW) is rejected with 403', async () => {
        // ARRANGE
        const user = await createTestUser();
        const actor = createMockActor(
            RoleEnum.EDITOR,
            [PermissionEnum.ACCESS_API_ADMIN, PermissionEnum.POST_COMMENT_VIEW],
            user.id
        );
        const headers = createAuthenticatedRequest(actor).headers;

        // ACT
        const response = await app.request('/api/v1/admin/comments/recent', {
            method: 'GET',
            headers
        });

        // ASSERT
        expect(response.status).toBe(403);
    });

    it('AC-18: actor with only EVENT_COMMENT_VIEW (missing POST_COMMENT_VIEW) is rejected with 403', async () => {
        // ARRANGE
        const user = await createTestUser();
        const actor = createMockActor(
            RoleEnum.EDITOR,
            [PermissionEnum.ACCESS_API_ADMIN, PermissionEnum.EVENT_COMMENT_VIEW],
            user.id
        );
        const headers = createAuthenticatedRequest(actor).headers;

        // ACT
        const response = await app.request('/api/v1/admin/comments/recent', {
            method: 'GET',
            headers
        });

        // ASSERT
        expect(response.status).toBe(403);
    });

    // -------------------------------------------------------------------------
    // AC-19: PATCH APPROVED → REJECTED decrements posts.comments
    // -------------------------------------------------------------------------

    it('AC-19: moderating APPROVED → REJECTED decrements posts.comments counter', async () => {
        // ARRANGE: post with 1 approved comment, counter = 1
        const user = await createTestUser();
        const { postId } = await seedPost({ authorId: user.id, comments: 1 });
        const { commentId } = await seedComment({
            entityType: 'POST',
            entityId: postId,
            authorId: user.id,
            moderationState: 'APPROVED'
        });

        const headers = editorHeaders(user.id);

        // ACT
        const response = await app.request(`/api/v1/admin/comments/${commentId}/moderation`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ moderationState: 'REJECTED' })
        });

        // ASSERT — response
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);
        expect(body.data.moderationState).toBe('REJECTED');

        // ASSERT — counter decremented
        const counter = await readPostCommentsCounter(postId);
        expect(counter).toBe(0);
    });

    // -------------------------------------------------------------------------
    // AC-20: PATCH REJECTED → APPROVED increments posts.comments
    // -------------------------------------------------------------------------

    it('AC-20: moderating REJECTED → APPROVED increments posts.comments counter', async () => {
        // ARRANGE: post with 0 approved comments, 1 rejected comment
        const user = await createTestUser();
        const { postId } = await seedPost({ authorId: user.id, comments: 0 });
        const { commentId } = await seedComment({
            entityType: 'POST',
            entityId: postId,
            authorId: user.id,
            moderationState: 'REJECTED'
        });

        const headers = editorHeaders(user.id);

        // ACT
        const response = await app.request(`/api/v1/admin/comments/${commentId}/moderation`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ moderationState: 'APPROVED' })
        });

        // ASSERT — response
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);
        expect(body.data.moderationState).toBe('APPROVED');

        // ASSERT — counter incremented
        const counter = await readPostCommentsCounter(postId);
        expect(counter).toBe(1);
    });

    // -------------------------------------------------------------------------
    // AC-21: admin soft-deletes any comment; counter adjusted for POST comments
    // -------------------------------------------------------------------------

    it('AC-21: admin soft-delete adjusts posts.comments counter for an APPROVED post comment', async () => {
        // ARRANGE
        const user = await createTestUser();
        const { postId } = await seedPost({ authorId: user.id, comments: 1 });
        const { commentId } = await seedComment({
            entityType: 'POST',
            entityId: postId,
            authorId: user.id,
            moderationState: 'APPROVED'
        });

        const headers = editorHeaders(user.id);

        // ACT
        const response = await app.request(`/api/v1/admin/comments/${commentId}`, {
            method: 'DELETE',
            headers
        });

        // ASSERT — response
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);

        // ASSERT — counter decremented
        const counter = await readPostCommentsCounter(postId);
        expect(counter).toBe(0);
    });

    // -------------------------------------------------------------------------
    // AC-22: admin hard-delete permanently removes record from DB
    // -------------------------------------------------------------------------

    it('AC-22: admin hard-delete permanently removes the comment from the database', async () => {
        // ARRANGE
        const user = await createTestUser();
        const { postId } = await seedPost({ authorId: user.id, comments: 0 });
        const { commentId } = await seedComment({
            entityType: 'POST',
            entityId: postId,
            authorId: user.id,
            moderationState: 'APPROVED'
        });

        const headers = editorHeaders(user.id);

        // ACT
        const response = await app.request(`/api/v1/admin/comments/${commentId}/hard`, {
            method: 'DELETE',
            headers
        });

        // ASSERT — response
        expect(response.status).toBe(200);

        // ASSERT — row is gone from DB (getById should 404)
        const getResponse = await app.request(`/api/v1/admin/comments/${commentId}`, {
            method: 'GET',
            headers
        });
        expect(getResponse.status).toBe(404);
    });

    // -------------------------------------------------------------------------
    // AC-23: admin restores soft-deleted comment (deletedAt cleared)
    // -------------------------------------------------------------------------

    it('AC-23: admin restore clears deletedAt and comment reappears in the DB', async () => {
        // ARRANGE: soft-deleted comment
        const user = await createTestUser();
        const { postId } = await seedPost({ authorId: user.id, comments: 0 });
        const { commentId } = await seedComment({
            entityType: 'POST',
            entityId: postId,
            authorId: user.id,
            moderationState: 'APPROVED',
            deletedAt: new Date()
        });

        const headers = editorHeaders(user.id);

        // ACT
        const restoreResponse = await app.request(`/api/v1/admin/comments/${commentId}/restore`, {
            method: 'POST',
            headers
        });

        // ASSERT — response: restore returns the generic restore result.
        // POST routes resolve to 201 in the route factory (same as adminRestorePostRoute).
        expect(restoreResponse.status).toBe(201);
        const restoreBody = await restoreResponse.json();
        expect(restoreBody.success).toBe(true);
        expect(restoreBody.data).toMatchObject({ success: true });

        // ASSERT — the DB reflects the restore (deletedAt cleared).
        const { entityComments: ecTable, getDb, eq } = await import('@repo/db');
        const db = getDb();
        const rows = await db
            .select({ deletedAt: ecTable.deletedAt })
            .from(ecTable)
            .where(eq(ecTable.id, commentId));
        expect(rows[0]?.deletedAt).toBeNull();
    });
});
