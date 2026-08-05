/**
 * EDITOR-02 — A trusted editor publishes and unpublishes their own content.
 *
 * Actors: one trusted EDITOR + one plain EDITOR (the negative control).
 * Tags: @p1 @editor
 *
 * The point of keeping `moderationState` and `visibility` orthogonal (§7.6.1)
 * is that a trusted editor can pull their own approved post back down, fix it,
 * and put it up again WITHOUT re-entering the review queue. A single combined
 * "published" field cannot express that, so the load-bearing assertion here is
 * that the verdict SURVIVES the unpublish.
 *
 * The plain editor is not decoration: `POST_PUBLISH_OWN` is the only thing that
 * separates the two accounts, and without the negative case this spec would
 * pass just as happily if the endpoint were ungated.
 *
 * @see .specs/HOS-374-editor-web-posts-events/spec.md §6, §7.6.1, §7.6.2
 */

import { expect, test } from '@playwright/test';
import { createUser } from '../../fixtures/api-helpers.ts';
import { getDbPool } from '../../fixtures/db-helpers.ts';
import { createPostAsAuthor, setTrustedEditor } from '../../fixtures/editorial-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';

test.describe('EDITOR-02: trusted editor publish/unpublish @p1 @editor', () => {
    const userIds: string[] = [];

    test.afterEach(async () => {
        if (userIds.length > 0) {
            await cleanupTestUsers(getDbPool(), userIds);
            userIds.length = 0;
        }
    });

    test('a trusted editor unpublishes and republishes their own post, keeping the verdict', async ({
        request
    }) => {
        const editor = await createUser({ role: 'EDITOR' }, { apiBaseUrl: API_URL });
        userIds.push(editor.id);
        await setTrustedEditor(editor.id);

        const admin = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
        userIds.push(admin.id);

        const post = await createPostAsAuthor({
            sessionCookie: editor.sessionCookie,
            slugPrefix: 'editor-02',
            apiBaseUrl: API_URL
        });

        // Approve it first, so the verdict has something to survive.
        const moderate = await request.post(`${API_URL}/api/v1/admin/posts/${post.id}/moderate`, {
            headers: { cookie: admin.sessionCookie },
            data: { moderationState: 'APPROVED' }
        });
        // 201, not 200 — see the note in editor-01: POST → 201 is the factory's
        // convention, action-POSTs included.
        expect(moderate.status()).toBe(201);
        expect(
            (await request.get(`${API_URL}/api/v1/public/posts/slug/${post.slug}`)).status()
        ).toBe(200);

        // ── Unpublish: the author's switch drops, the verdict does not ───────
        const unpublish = await request.post(
            `${API_URL}/api/v1/protected/posts/${post.id}/publish-state`,
            {
                headers: { cookie: editor.sessionCookie },
                data: { visibility: 'PRIVATE' }
            }
        );
        expect(unpublish.status()).toBe(201);

        const unpublished = (await unpublish.json()) as {
            data?: { visibility?: string; moderationState?: string };
        };
        expect(unpublished.data?.visibility).toBe('PRIVATE');
        // This is the assertion the whole orthogonality decision exists for.
        expect(unpublished.data?.moderationState).toBe('APPROVED');

        // 403, NOT 404 — and that asymmetry is deliberate here only in the sense
        // that this spec records what the API actually does. A post withheld by
        // `moderationState` answers 404 (see editor-01), while one withheld by
        // `visibility` answers 403, which confirms to an anonymous caller that
        // the slug exists. The codebase convention elsewhere (accommodation,
        // point-of-interest) is NOT_FOUND for content the caller may not see.
        // Pinned exactly rather than as `[403, 404]` so that closing the gap
        // fails this line loudly instead of passing unnoticed.
        const publicWhileUnpublished = await request.get(
            `${API_URL}/api/v1/public/posts/slug/${post.slug}`
        );
        expect(publicWhileUnpublished.status()).toBe(403);

        // The invariant that does NOT depend on which status code is chosen:
        // an unpublished post is absent from the public listing.
        const publicList = await request.get(`${API_URL}/api/v1/public/posts?pageSize=100`);
        const listBody = (await publicList.json()) as {
            data?: { items?: ReadonlyArray<{ id?: string }> };
        };
        expect((listBody.data?.items ?? []).map((item) => item.id)).not.toContain(post.id);

        // ── A trusted editor may edit their own APPROVED post ────────────────
        // The §7.6.3 state lock is bypassed by holding PUBLISH_OWN, because the
        // same actor could unpublish → edit → republish anyway.
        const edit = await request.put(`${API_URL}/api/v1/protected/posts/${post.id}`, {
            headers: { cookie: editor.sessionCookie },
            data: { summary: 'Corrected while it was down, without losing the approval.' }
        });
        expect(edit.status()).toBe(200);

        // ── Republish: public again, still without a second review ───────────
        const republish = await request.post(
            `${API_URL}/api/v1/protected/posts/${post.id}/publish-state`,
            {
                headers: { cookie: editor.sessionCookie },
                data: { visibility: 'PUBLIC' }
            }
        );
        expect(republish.status()).toBe(201);

        const republished = (await republish.json()) as {
            data?: { visibility?: string; moderationState?: string };
        };
        expect(republished.data?.visibility).toBe('PUBLIC');
        expect(republished.data?.moderationState).toBe('APPROVED');

        expect(
            (await request.get(`${API_URL}/api/v1/public/posts/slug/${post.slug}`)).status()
        ).toBe(200);
    });

    test('a plain editor cannot set the publication state of their own post', async ({
        request
    }) => {
        const editor = await createUser({ role: 'EDITOR' }, { apiBaseUrl: API_URL });
        userIds.push(editor.id);

        const post = await createPostAsAuthor({
            sessionCookie: editor.sessionCookie,
            slugPrefix: 'editor-02-plain',
            apiBaseUrl: API_URL
        });

        const attempt = await request.post(
            `${API_URL}/api/v1/protected/posts/${post.id}/publish-state`,
            {
                headers: { cookie: editor.sessionCookie },
                data: { visibility: 'PRIVATE' }
            }
        );
        expect(attempt.status()).toBe(403);
    });
});
