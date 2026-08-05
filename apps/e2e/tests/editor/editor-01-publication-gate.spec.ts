/**
 * EDITOR-01 — An editor's post is not public until an admin approves it,
 * and once approved the editor can no longer edit it.
 *
 * Actors: one EDITOR (plain, not trusted) + one SUPER_ADMIN.
 * Tags: @p0 @editor
 *
 * This is the whole HOS-374 publication gate in one flow. Before this spec's
 * feature existed, a post was public the instant it was created (§2.1) — so
 * the assertion that matters most here is the NEGATIVE one in the middle:
 * the post exists, its author can see it, and the public cannot.
 *
 * The state lock at the end (§7.6.3) is the first write-side state gate in the
 * repo: an author holding only `POST_UPDATE_OWN` loses edit rights the moment
 * the content is `APPROVED`.
 *
 * @see .specs/HOS-374-editor-web-posts-events/spec.md §6, §7.6.1, §7.6.3
 */

import { expect, test } from '@playwright/test';
import { createUser } from '../../fixtures/api-helpers.ts';
import { getDbPool } from '../../fixtures/db-helpers.ts';
import { createPostAsAuthor } from '../../fixtures/editorial-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';

test.describe('EDITOR-01: publication gate @p0 @editor', () => {
    const userIds: string[] = [];

    test.afterEach(async () => {
        if (userIds.length > 0) {
            await cleanupTestUsers(getDbPool(), userIds);
            userIds.length = 0;
        }
    });

    test('pending post is invisible publicly, approval publishes it, and the author loses edit rights', async ({
        request
    }) => {
        // ── Setup ────────────────────────────────────────────────────────────
        const editor = await createUser({ role: 'EDITOR' }, { apiBaseUrl: API_URL });
        userIds.push(editor.id);

        const admin = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
        userIds.push(admin.id);

        // ── 1. The editor authors a post ─────────────────────────────────────
        const post = await createPostAsAuthor({
            sessionCookie: editor.sessionCookie,
            slugPrefix: 'editor-01',
            apiBaseUrl: API_URL
        });

        // The gate is `moderationState`, not `visibility`: the author's switch is
        // already PUBLIC at creation, so PENDING is the only thing withholding it.
        // Asserting both is what distinguishes "gated" from "merely unpublished".
        expect(post.moderationState).toBe('PENDING');
        expect(post.visibility).toBe('PUBLIC');

        // ── 2. The author can read it back; the public cannot ────────────────
        const ownRead = await request.get(`${API_URL}/api/v1/protected/posts/${post.id}`, {
            headers: { cookie: editor.sessionCookie }
        });
        expect(ownRead.status()).toBe(200);

        const publicReadBefore = await request.get(
            `${API_URL}/api/v1/public/posts/slug/${post.slug}`
        );
        expect(publicReadBefore.status()).toBe(404);

        // The read floor (§7.6.5) applies to the LIST path too, which is a
        // separate query from the single read — a floor on only one of them
        // leaks the post through the other.
        const publicListBefore = await request.get(`${API_URL}/api/v1/public/posts?pageSize=100`);
        expect(publicListBefore.status()).toBe(200);
        const listBeforeBody = (await publicListBefore.json()) as {
            data?: { items?: ReadonlyArray<{ id?: string }> };
        };
        expect((listBeforeBody.data?.items ?? []).map((item) => item.id)).not.toContain(post.id);

        // ── 3. The editor can still edit it while it is PENDING ──────────────
        const editWhilePending = await request.put(`${API_URL}/api/v1/protected/posts/${post.id}`, {
            headers: { cookie: editor.sessionCookie },
            data: { summary: 'Edited by the author while the verdict was still pending.' }
        });
        expect(editWhilePending.status()).toBe(200);

        // ── 4. An admin approves it ──────────────────────────────────────────
        const moderate = await request.post(`${API_URL}/api/v1/admin/posts/${post.id}/moderate`, {
            headers: { cookie: admin.sessionCookie },
            data: { moderationState: 'APPROVED' }
        });
        expect(moderate.status()).toBe(200);

        // ── 5. It is now public ──────────────────────────────────────────────
        const publicReadAfter = await request.get(
            `${API_URL}/api/v1/public/posts/slug/${post.slug}`
        );
        expect(publicReadAfter.status()).toBe(200);

        // ── 6. The author can no longer edit it (§7.6.3 state lock) ──────────
        // A plain EDITOR holds POST_UPDATE_OWN but not POST_PUBLISH_OWN, so the
        // lock bites. This is the assertion that separates the state lock from a
        // plain ownership check: the SAME actor, on the SAME post, was allowed in
        // step 3 and is refused here — only the post's state changed.
        const editAfterApproval = await request.put(
            `${API_URL}/api/v1/protected/posts/${post.id}`,
            {
                headers: { cookie: editor.sessionCookie },
                data: { summary: 'The author should not be able to write this.' }
            }
        );
        expect(editAfterApproval.status()).toBe(403);

        // ── 7. An admin still can ────────────────────────────────────────────
        // The lock is scoped to the author, not to the content: without this the
        // spec would be satisfied by a gate that froze approved posts for
        // everyone, which is not what §7.6.3 says.
        const adminEdit = await request.patch(`${API_URL}/api/v1/admin/posts/${post.id}`, {
            headers: { cookie: admin.sessionCookie },
            data: { summary: 'An admin may still correct approved content.' }
        });
        expect(adminEdit.status()).toBe(200);
    });
});
