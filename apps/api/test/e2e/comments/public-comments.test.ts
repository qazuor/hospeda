/**
 * @file public-comments.test.ts
 *
 * E2E tests for public comment read endpoints (SPEC-165 T-012).
 *
 * Covers AC-8, AC-9, AC-10.
 *
 * Route surface:
 *   GET /api/v1/public/posts/:postId/comments
 *   GET /api/v1/public/events/:eventId/comments
 *
 * These endpoints require NO authentication (public tier). Responses MUST NOT
 * expose `moderationState`. Only APPROVED, non-deleted comments are returned.
 *
 * NOTE: HTTP-based e2e tests seed data via direct DB inserts that must be
 * visible to the Hono app (which uses getDb() — a separate connection).
 * We use testDb.clean() in afterEach to wipe state between tests.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app.js';
import { seedComment, seedEvent, seedPost } from '../setup/seed-comment-helpers.js';
import { createTestUser } from '../setup/seed-helpers.js';
import { testDb } from '../setup/test-database.js';

/** Minimal headers for an unauthenticated public request. */
const PUBLIC_HEADERS = { accept: 'application/json', 'user-agent': 'vitest' };

describe('SPEC-165 T-012 — public comments endpoints', () => {
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
    // AC-8: published post with 3 approved + 1 rejected → GET returns exactly 3
    // -------------------------------------------------------------------------

    it('AC-8: returns exactly the 3 APPROVED comments for a published post, oldest-first, no moderationState field', async () => {
        // ARRANGE
        const author = await createTestUser();
        const { postId } = await seedPost({ authorId: author.id });

        // Insert 3 APPROVED comments + 1 REJECTED comment.
        await seedComment({
            entityType: 'POST',
            entityId: postId,
            authorId: author.id,
            content: 'First comment',
            moderationState: 'APPROVED'
        });
        await seedComment({
            entityType: 'POST',
            entityId: postId,
            authorId: author.id,
            content: 'Second comment',
            moderationState: 'APPROVED'
        });
        await seedComment({
            entityType: 'POST',
            entityId: postId,
            authorId: author.id,
            content: 'Third comment',
            moderationState: 'APPROVED'
        });
        await seedComment({
            entityType: 'POST',
            entityId: postId,
            authorId: author.id,
            content: 'Rejected comment',
            moderationState: 'REJECTED'
        });

        // ACT
        const response = await app.request(`/api/v1/public/posts/${postId}/comments`, {
            method: 'GET',
            headers: PUBLIC_HEADERS
        });

        // ASSERT
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);
        expect(Array.isArray(body.data.items)).toBe(true);
        expect(body.data.items).toHaveLength(3);

        // Oldest-first order
        const contents = body.data.items.map((item: Record<string, unknown>) => item.content);
        expect(contents[0]).toBe('First comment');
        expect(contents[2]).toBe('Third comment');

        // No moderationState exposed to public
        for (const item of body.data.items as Record<string, unknown>[]) {
            expect(item).not.toHaveProperty('moderationState');
        }
    });

    // -------------------------------------------------------------------------
    // AC-9: non-existent post or not-published post → 404
    // -------------------------------------------------------------------------

    it('AC-9a: returns 404 for a non-existent postId', async () => {
        // ACT
        const nonExistentId = '00000000-0000-4000-8000-000000000001';
        const response = await app.request(`/api/v1/public/posts/${nonExistentId}/comments`, {
            method: 'GET',
            headers: PUBLIC_HEADERS
        });

        // ASSERT
        expect(response.status).toBe(404);
    });

    it('AC-9b: returns 404 for a post that exists but is not publicly visible (visibility != PUBLIC)', async () => {
        // ARRANGE: insert post with PRIVATE visibility (not published from service POV)
        // The service checks visibility === 'PUBLIC' to determine if a post is published.
        const author = await createTestUser();
        const { postId } = await seedPost({ authorId: author.id, visibility: 'PRIVATE' });

        // ACT
        const response = await app.request(`/api/v1/public/posts/${postId}/comments`, {
            method: 'GET',
            headers: PUBLIC_HEADERS
        });

        // ASSERT
        expect(response.status).toBe(404);
    });

    // -------------------------------------------------------------------------
    // AC-10: published event with zero approved comments → 200 empty items
    // -------------------------------------------------------------------------

    it('AC-10: published event with zero approved comments returns 200 with empty items array', async () => {
        // ARRANGE
        const author = await createTestUser();
        const { eventId } = await seedEvent({ authorId: author.id });

        // ACT
        const response = await app.request(`/api/v1/public/events/${eventId}/comments`, {
            method: 'GET',
            headers: PUBLIC_HEADERS
        });

        // ASSERT
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);
        expect(body.data.items).toHaveLength(0);
    });
});
