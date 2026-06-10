/**
 * E2E-3 — Authenticated favorite toggle round-trip.
 *
 * Actors: Authenticated user (regular, no host role required).
 * Tags: @p0 @guest @cross-app
 *
 * Preconditions:
 *   - At least one ACTIVE/PUBLIC accommodation (seeded).
 *   - Protected user-bookmarks endpoints mounted.
 *
 * What this validates:
 *  1. First POST `/api/v1/protected/user-bookmarks` creates the bookmark
 *     (`toggled: true`, `bookmark` non-null).
 *  2. GET `/api/v1/protected/user-bookmarks` lists the bookmark.
 *  3. Second POST with the same payload toggles it off
 *     (`toggled: false`, `bookmark: null`).
 *  4. GET listing no longer includes the bookmark for the user.
 *
 * @see SPEC-092 spec.md § E2E-3
 */

import { expect, test } from '@playwright/test';
import { createUser, forceVerifyEmail } from '../../fixtures/api-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

interface BookmarkResponse {
    readonly success?: boolean;
    readonly data?: {
        readonly toggled: boolean;
        readonly bookmark: { readonly id: string } | null;
    };
}

interface BookmarkListResponse {
    // GET /api/v1/protected/user-bookmarks returns the handler result
    // { bookmarks: [...], total } wrapped by the route factory into { data: { bookmarks, total } }.
    readonly data?: {
        readonly bookmarks?: ReadonlyArray<{ id: string; entityId: string }>;
        readonly total?: number;
    };
}

test.describe('E2E-3: favorite toggle round-trip @p0 @guest @cross-app', () => {
    let userId: string | null = null;

    test.afterEach(async () => {
        if (userId) {
            await cleanupTestUsers(getDbPool(), [userId]);
        }
        userId = null;
    });

    test('toggle on → list shows it → toggle off → list excludes it', async ({ page }) => {
        const user = await createUser({ role: 'USER' }, { apiBaseUrl: API_URL });
        userId = user.id;
        await forceVerifyEmail(user.id);

        const accRows = await execSQL<{ id: string }>(
            `SELECT id FROM accommodations
             WHERE lifecycle_state = 'ACTIVE'
               AND visibility = 'PUBLIC'
               AND deleted_at IS NULL
             ORDER BY created_at ASC
             LIMIT 1`
        );
        const accommodationId = accRows[0]?.id;
        if (!accommodationId) {
            test.fixme(true, 'No active public accommodation in seed — E2E-3 cannot run');
            return;
        }

        const headers = { cookie: user.sessionCookie };

        // ── 1. Toggle on (create) ──────────────────────────────────────────
        const onRes = await page.request.post(`${API_URL}/api/v1/protected/user-bookmarks`, {
            data: { entityId: accommodationId, entityType: 'ACCOMMODATION' },
            headers
        });
        expect(onRes.ok(), `toggle-on should be 2xx (got ${onRes.status()})`).toBe(true);
        const onBody = (await onRes.json()) as BookmarkResponse;
        const onPayload = onBody.data ?? (onBody as unknown as BookmarkResponse['data']);
        expect(onPayload?.toggled).toBe(true);
        expect(onPayload?.bookmark?.id).toBeTruthy();

        // ── 2. List shows it ──────────────────────────────────────────────
        const listOnRes = await page.request.get(`${API_URL}/api/v1/protected/user-bookmarks`, {
            headers
        });
        expect(listOnRes.ok()).toBe(true);
        const listOnBody = (await listOnRes.json()) as BookmarkListResponse;
        const ids = listOnBody.data?.bookmarks?.map((row) => row.entityId) ?? [];
        expect(ids).toContain(accommodationId);

        // ── 3. Toggle off (delete via same POST) ──────────────────────────
        const offRes = await page.request.post(`${API_URL}/api/v1/protected/user-bookmarks`, {
            data: { entityId: accommodationId, entityType: 'ACCOMMODATION' },
            headers
        });
        expect(offRes.ok(), `toggle-off should be 2xx (got ${offRes.status()})`).toBe(true);
        const offBody = (await offRes.json()) as BookmarkResponse;
        const offPayload = offBody.data ?? (offBody as unknown as BookmarkResponse['data']);
        expect(offPayload?.toggled).toBe(false);
        expect(offPayload?.bookmark).toBeNull();

        // ── 4. List no longer includes it ─────────────────────────────────
        const listOffRes = await page.request.get(`${API_URL}/api/v1/protected/user-bookmarks`, {
            headers
        });
        if (listOffRes.ok()) {
            const listOffBody = (await listOffRes.json()) as BookmarkListResponse;
            const idsAfter = listOffBody.data?.bookmarks?.map((row) => row.entityId) ?? [];
            expect(idsAfter).not.toContain(accommodationId);
        }
    });
});
