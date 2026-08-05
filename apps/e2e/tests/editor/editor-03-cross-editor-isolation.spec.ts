/**
 * EDITOR-03 — An editor cannot see or edit another editor's content.
 *
 * Actors: two plain EDITORs, each with one post.
 * Tags: @p0 @editor
 *
 * HOS-374 §7.6.2 REVERSES the SPEC-169 verdict: `EDITOR` used to hold
 * `POST_VIEW_ALL` / `POST_UPDATE`, making the role a shared editorial mailbox
 * where anyone could rewrite anyone (§2.3). The role is now author-scoped, and
 * this spec is what keeps it that way.
 *
 * The listing assertion is the one that would rot silently: a route that
 * accepted `authorId` from the query, or that forgot the `authorId = actor.id`
 * filter, would still return 200 with a plausible-looking page — the leak only
 * shows up when you check WHOSE posts came back.
 *
 * @see .specs/HOS-374-editor-web-posts-events/spec.md §6, §7.6.2
 */

import { expect, test } from '@playwright/test';
import { createUser } from '../../fixtures/api-helpers.ts';
import { getDbPool } from '../../fixtures/db-helpers.ts';
import { createPostAsAuthor } from '../../fixtures/editorial-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';

test.describe('EDITOR-03: cross-editor isolation @p0 @editor', () => {
    const userIds: string[] = [];

    test.afterEach(async () => {
        if (userIds.length > 0) {
            await cleanupTestUsers(getDbPool(), userIds);
            userIds.length = 0;
        }
    });

    test('editor A cannot list, read or edit editor B post', async ({ request }) => {
        const editorA = await createUser({ role: 'EDITOR' }, { apiBaseUrl: API_URL });
        userIds.push(editorA.id);

        const editorB = await createUser({ role: 'EDITOR' }, { apiBaseUrl: API_URL });
        userIds.push(editorB.id);

        const postA = await createPostAsAuthor({
            sessionCookie: editorA.sessionCookie,
            slugPrefix: 'editor-03-a',
            apiBaseUrl: API_URL
        });
        const postB = await createPostAsAuthor({
            sessionCookie: editorB.sessionCookie,
            slugPrefix: 'editor-03-b',
            apiBaseUrl: API_URL
        });

        // ── 1. A's own listing contains A's post and NOT B's ──────────────────
        const listAsA = await request.get(`${API_URL}/api/v1/protected/posts?pageSize=100`, {
            headers: { cookie: editorA.sessionCookie }
        });
        expect(listAsA.status()).toBe(200);

        const listBody = (await listAsA.json()) as {
            data?: { items?: ReadonlyArray<{ id?: string }> };
        };
        const visibleIds = (listBody.data?.items ?? []).map((item) => item.id);
        // Both halves matter: the presence check proves the listing works at all,
        // so the absence check below cannot pass vacuously on an empty page.
        expect(visibleIds).toContain(postA.id);
        expect(visibleIds).not.toContain(postB.id);

        // ── 2. A cannot widen the scope by asking for B ───────────────────────
        // `authorId` is not an accepted query parameter; a route that honored it
        // would be author-scoped in name only.
        const listSpoofed = await request.get(
            `${API_URL}/api/v1/protected/posts?pageSize=100&authorId=${editorB.id}`,
            { headers: { cookie: editorA.sessionCookie } }
        );
        const spoofedBody = (await listSpoofed.json()) as {
            data?: { items?: ReadonlyArray<{ id?: string }> };
        };
        expect((spoofedBody.data?.items ?? []).map((item) => item.id)).not.toContain(postB.id);

        // ── 3. A cannot read B's post ────────────────────────────────────────
        const readB = await request.get(`${API_URL}/api/v1/protected/posts/${postB.id}`, {
            headers: { cookie: editorA.sessionCookie }
        });
        expect([403, 404]).toContain(readB.status());

        // ── 4. A cannot edit B's post ────────────────────────────────────────
        const editB = await request.put(`${API_URL}/api/v1/protected/posts/${postB.id}`, {
            headers: { cookie: editorA.sessionCookie },
            data: { summary: 'Editor A should never be able to write this.' }
        });
        expect([403, 404]).toContain(editB.status());

        // ── 5. B's post is unchanged ─────────────────────────────────────────
        // A rejected write that still landed would be the worst outcome, and a
        // status-code assertion alone cannot rule it out.
        const readAsB = await request.get(`${API_URL}/api/v1/protected/posts/${postB.id}`, {
            headers: { cookie: editorB.sessionCookie }
        });
        expect(readAsB.status()).toBe(200);
        const bBody = (await readAsB.json()) as { data?: { summary?: string } };
        expect(bBody.data?.summary).not.toContain('Editor A should never');

        // ── 6. A cannot delete B's post ──────────────────────────────────────
        const deleteB = await request.delete(`${API_URL}/api/v1/protected/posts/${postB.id}`, {
            headers: { cookie: editorA.sessionCookie }
        });
        expect([403, 404]).toContain(deleteB.status());
    });
});
