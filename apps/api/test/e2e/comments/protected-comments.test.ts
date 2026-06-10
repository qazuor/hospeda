/**
 * @file protected-comments.test.ts
 *
 * E2E tests for protected (authenticated) comment endpoints (SPEC-165 T-012).
 *
 * Covers AC-11, AC-12, AC-13, AC-14, AC-15, AC-16.
 *
 * Route surface:
 *   POST   /api/v1/protected/posts/:postId/comments   (create)
 *   DELETE /api/v1/protected/comments/:commentId      (delete own)
 *
 * AC-14 (rate limit) requires HOSPEDA_TESTING_RATE_LIMIT='true'. When absent the
 * rate limiter is bypassed in NODE_ENV=test (see apps/api/src/middlewares/rate-limit.ts).
 * The test is guarded with it.skipIf so it does not produce a silent false-pass.
 *
 * NOTE: each test leaves data in the DB; afterEach runs testDb.clean() to reset state.
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app.js';
import { createAuthenticatedRequest, createMockActor } from '../../helpers/auth.js';
import { readPostCommentsCounter, seedComment, seedPost } from '../setup/seed-comment-helpers.js';
import { createTestUser } from '../setup/seed-helpers.js';
import { testDb } from '../setup/test-database.js';

const rateLimitEnabled = process.env.HOSPEDA_TESTING_RATE_LIMIT === 'true';

describe('SPEC-165 T-012 — protected comment endpoints', () => {
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
    // AC-11: authenticated user with POST_COMMENT_CREATE → 201, APPROVED, counter +1
    // -------------------------------------------------------------------------

    it('AC-11: creates a comment with state APPROVED and increments posts.comments counter', async () => {
        // ARRANGE
        const author = await createTestUser();
        const { postId } = await seedPost({ authorId: author.id, comments: 0 });

        const actor = createMockActor(
            RoleEnum.USER,
            [PermissionEnum.POST_COMMENT_CREATE],
            author.id
        );
        const authHeaders = createAuthenticatedRequest(actor).headers;

        // ACT
        const response = await app.request(`/api/v1/protected/posts/${postId}/comments`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ content: 'A valid comment' })
        });

        // ASSERT — HTTP response
        expect(response.status).toBe(201);
        const body = await response.json();
        expect(body.success).toBe(true);
        expect(body.data.moderationState).toBe('APPROVED');
        expect(body.data.entityId).toBe(postId);

        // ASSERT — counter incremented (DB read)
        const counter = await readPostCommentsCounter(postId);
        expect(counter).toBe(1);
    });

    // -------------------------------------------------------------------------
    // AC-12: unauthenticated POST → 401
    // -------------------------------------------------------------------------

    it('AC-12: unauthenticated POST to protected create returns 401', async () => {
        // ARRANGE
        const author = await createTestUser();
        const { postId } = await seedPost({ authorId: author.id });

        // ACT — include user-agent (required by header validation) but no auth headers
        const response = await app.request(`/api/v1/protected/posts/${postId}/comments`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify({ content: 'Unauthorized attempt' })
        });

        // ASSERT
        expect(response.status).toBe(401);
    });

    // -------------------------------------------------------------------------
    // AC-13: content > 2000 chars → 400 (validation error), no record inserted
    // -------------------------------------------------------------------------

    it('AC-13: content over 2000 chars returns a validation error and no comment is inserted', async () => {
        // ARRANGE
        const author = await createTestUser();
        const { postId } = await seedPost({ authorId: author.id, comments: 0 });

        const actor = createMockActor(
            RoleEnum.USER,
            [PermissionEnum.POST_COMMENT_CREATE],
            author.id
        );
        const authHeaders = createAuthenticatedRequest(actor).headers;
        const oversizedContent = 'x'.repeat(2001);

        // ACT
        const response = await app.request(`/api/v1/protected/posts/${postId}/comments`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ content: oversizedContent })
        });

        // ASSERT — rejection (route returns 400 for Zod validation failure)
        expect([400, 422]).toContain(response.status);

        // ASSERT — counter did not change
        const counter = await readPostCommentsCounter(postId);
        expect(counter).toBe(0);
    });

    // -------------------------------------------------------------------------
    // AC-14: 6 requests within 60s → 6th gets 429 (rate-limit bypass in tests)
    // -------------------------------------------------------------------------

    it.skipIf(!rateLimitEnabled)(
        'AC-14: 6th POST within 60s returns 429 and no record is inserted (requires HOSPEDA_TESTING_RATE_LIMIT=true)',
        async () => {
            // ARRANGE
            const author = await createTestUser();
            const { postId } = await seedPost({ authorId: author.id, comments: 0 });

            const actor = createMockActor(
                RoleEnum.USER,
                [PermissionEnum.POST_COMMENT_CREATE],
                author.id
            );
            const authHeaders = createAuthenticatedRequest(actor).headers;

            // ACT: send 5 successful requests
            for (let i = 1; i <= 5; i++) {
                const r = await app.request(`/api/v1/protected/posts/${postId}/comments`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify({ content: `Comment ${i}` })
                });
                expect(r.status).toBe(201);
            }

            const counterAfter5 = await readPostCommentsCounter(postId);
            expect(counterAfter5).toBe(5);

            // 6th request should be rate-limited
            const sixth = await app.request(`/api/v1/protected/posts/${postId}/comments`, {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({ content: 'Should be rejected' })
            });
            expect(sixth.status).toBe(429);

            // Counter must NOT have incremented
            const counterAfter6 = await readPostCommentsCounter(postId);
            expect(counterAfter6).toBe(5);
        }
    );

    // -------------------------------------------------------------------------
    // AC-15: author deletes own comment → soft-deleted 200, counter decremented
    // -------------------------------------------------------------------------

    it('AC-15: author soft-deletes own APPROVED comment, posts.comments decremented', async () => {
        // ARRANGE: post with 1 approved comment (seeded directly so counter starts at 1)
        const author = await createTestUser();
        const { postId } = await seedPost({ authorId: author.id, comments: 1 });
        const { commentId } = await seedComment({
            entityType: 'POST',
            entityId: postId,
            authorId: author.id,
            moderationState: 'APPROVED'
        });

        const actor = createMockActor(RoleEnum.USER, [], author.id);
        const authHeaders = createAuthenticatedRequest(actor).headers;

        // ACT
        const response = await app.request(`/api/v1/protected/comments/${commentId}`, {
            method: 'DELETE',
            headers: authHeaders
        });

        // ASSERT — HTTP response
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);

        // ASSERT — counter decremented
        const counter = await readPostCommentsCounter(postId);
        expect(counter).toBe(0);
    });

    // -------------------------------------------------------------------------
    // AC-16: non-author deletes someone else's comment → 403
    // -------------------------------------------------------------------------

    it("AC-16: non-author DELETE of another user's comment returns 403", async () => {
        // ARRANGE
        const owner = await createTestUser();
        const other = await createTestUser();
        const { postId } = await seedPost({ authorId: owner.id, comments: 1 });
        const { commentId } = await seedComment({
            entityType: 'POST',
            entityId: postId,
            authorId: owner.id,
            moderationState: 'APPROVED'
        });

        // other user tries to delete owner's comment
        const actor = createMockActor(RoleEnum.USER, [], other.id);
        const authHeaders = createAuthenticatedRequest(actor).headers;

        // ACT
        const response = await app.request(`/api/v1/protected/comments/${commentId}`, {
            method: 'DELETE',
            headers: authHeaders
        });

        // ASSERT
        expect(response.status).toBe(403);

        // Counter must be unchanged
        const counter = await readPostCommentsCounter(postId);
        expect(counter).toBe(1);
    });
});
