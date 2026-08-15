/**
 * E2E-05 (SPEC-098 T-060a) — Inline notes on bookmarks.
 *
 * Actors: Authenticated regular user.
 *
 * Tags: @p1 @favorites @notes @spec-098
 *
 * Preconditions:
 *   - At least one ACTIVE/PUBLIC accommodation in seed.
 *   - PATCH /api/v1/protected/user-bookmarks/:id endpoint mounted.
 *
 * What this validates (AC-08.2, AC-08.3):
 *   1. PATCH bookmark with a note: 200, note persisted.
 *   2. PATCH bookmark to clear note: note becomes null.
 *   3. Note max 500 chars enforced (validation error for 501 chars).
 *
 * Note: UI-level tests (textarea expand, Ctrl+Enter, char counter UI) are
 * skipped here because they require the full Astro+React dev server with the
 * UserFavoritesList.client.tsx rendered. The API contract is validated here;
 * UI behavior is covered by component tests in apps/web/test/.
 *
 * @see SPEC-098 spec.md § US-08, AC-08.2, AC-08.3, AC-08.4
 */

import { expect, test } from '@playwright/test';
import { createUser } from '../../fixtures/api-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

interface ToggleResponse {
    readonly success?: boolean;
    readonly data?: {
        readonly toggled: boolean;
        readonly bookmark: { readonly id: string } | null;
    };
}

/**
 * The inline note is persisted as `description`.
 *
 * `notes` is the UI's word for it and never existed on the wire: the PATCH body
 * is validated by `UserBookmarkUpdateNotesSchema`, which is `.strict()` and
 * accepts only `name` and `description`, and `user_bookmarks` has no `notes`
 * column. Sending `notes` returns 400 and selecting it errors — this spec used
 * to do both, which is why it could never pass once the route started
 * validating strictly. apps/web sends `{ name, description }` too
 * (endpoints-protected.ts `userBookmarksApi.update`).
 */
interface UpdateBookmarkResponse {
    readonly success?: boolean;
    readonly data?: {
        readonly id: string;
        readonly description?: string | null;
    };
}

test.describe('E2E-05: inline notes on bookmarks @p1 @favorites @notes @spec-098', () => {
    let userId: string | null = null;

    test.afterEach(async () => {
        if (userId) {
            await cleanupTestUsers(getDbPool(), [userId]);
        }
        userId = null;
    });

    async function getFirstActiveAccommodationId(): Promise<string | null> {
        const rows = await execSQL<{ id: string }>(
            `SELECT id FROM accommodations
             WHERE lifecycle_state = 'ACTIVE'
               AND visibility = 'PUBLIC'
               AND deleted_at IS NULL
             ORDER BY created_at ASC
             LIMIT 1`
        );
        return rows[0]?.id ?? null;
    }

    /** Creates a user + bookmark, returns both ids */
    async function setupUserAndBookmark(
        page: import('@playwright/test').Page
    ): Promise<{ readonly bookmarkId: string; readonly headers: Record<string, string> } | null> {
        const accId = await getFirstActiveAccommodationId();
        if (!accId) return null;

        const user = await createUser({ role: 'USER' });
        userId = user.id;
        const headers = { cookie: user.sessionCookie };

        const toggleRes = await page.request.post(`${API_URL}/api/v1/protected/user-bookmarks`, {
            data: { entityId: accId, entityType: 'ACCOMMODATION' },
            headers
        });
        if (!toggleRes.ok()) return null;

        const toggleBody = (await toggleRes.json()) as ToggleResponse;
        const bookmarkId = (toggleBody.data ?? (toggleBody as unknown as ToggleResponse['data']))
            ?.bookmark?.id;
        if (!bookmarkId) return null;

        return { bookmarkId, headers };
    }

    test('AC-08.2 — PATCH note: note is saved, persists in DB', async ({ page }) => {
        // Arrange
        const ctx = await setupUserAndBookmark(page);
        if (!ctx) {
            test.fixme(true, 'No active public accommodation in seed');
            return;
        }
        const { bookmarkId, headers } = ctx;

        const noteText = 'Llamar antes de reservar — solo acepta efectivo';

        // Act: patch with note
        const patchRes = await page.request.patch(
            `${API_URL}/api/v1/protected/user-bookmarks/${bookmarkId}`,
            {
                data: { description: noteText },
                headers
            }
        );

        // Assert: 200, note in response
        expect(patchRes.ok(), `PATCH expected 200, got ${patchRes.status()}`).toBe(true);
        const patchBody = (await patchRes.json()) as UpdateBookmarkResponse;
        const updated = patchBody.data ?? (patchBody as unknown as UpdateBookmarkResponse['data']);
        const returnedNote = updated?.description;
        expect(returnedNote).toBe(noteText);

        // DB invariant
        const rows = await execSQL<{ description: string | null }>(
            'SELECT description FROM user_bookmarks WHERE id = $1 AND deleted_at IS NULL',
            [bookmarkId]
        );
        const dbNote = rows[0]?.description;
        expect(dbNote).toBe(noteText);
    });

    test('AC-08.3 — clear note: note becomes NULL', async ({ page }) => {
        // Arrange
        const ctx = await setupUserAndBookmark(page);
        if (!ctx) {
            test.fixme(true, 'No active public accommodation in seed');
            return;
        }
        const { bookmarkId, headers } = ctx;

        // Pre-set a note
        await page.request.patch(`${API_URL}/api/v1/protected/user-bookmarks/${bookmarkId}`, {
            data: { description: 'Nota inicial' },
            headers
        });

        // Act: clear the note by patching with empty string or null
        const clearRes = await page.request.patch(
            `${API_URL}/api/v1/protected/user-bookmarks/${bookmarkId}`,
            {
                data: { description: '' },
                headers
            }
        );

        // Assert: 200, note is null or empty
        expect(clearRes.ok(), `PATCH clear expected 200, got ${clearRes.status()}`).toBe(true);
        const clearBody = (await clearRes.json()) as UpdateBookmarkResponse;
        const updated = clearBody.data ?? (clearBody as unknown as UpdateBookmarkResponse['data']);
        const returnedNote = updated?.description ?? null;
        expect(returnedNote == null || returnedNote === '').toBe(true);
    });

    test('AC-08.4 — note exceeding 500 chars is rejected (400)', async ({ page }) => {
        // Arrange
        const ctx = await setupUserAndBookmark(page);
        if (!ctx) {
            test.fixme(true, 'No active public accommodation in seed');
            return;
        }
        const { bookmarkId, headers } = ctx;

        const longNote = 'A'.repeat(501);

        // Act: attempt to save a note that is too long
        const patchRes = await page.request.patch(
            `${API_URL}/api/v1/protected/user-bookmarks/${bookmarkId}`,
            {
                data: { description: longNote },
                headers
            }
        );

        // Assert: 400 (or 422) validation error
        expect(
            patchRes.status() === 400 || patchRes.status() === 422,
            `expected 400 or 422 for note > 500 chars, got ${patchRes.status()}`
        ).toBe(true);
    });

    test('AC-08.2 — note persists after re-fetch (GET bookmark list)', async ({ page }) => {
        // Arrange
        const ctx = await setupUserAndBookmark(page);
        if (!ctx) {
            test.fixme(true, 'No active public accommodation in seed');
            return;
        }
        const { bookmarkId, headers } = ctx;

        const noteText = 'Ver antes de reservar — preguntar por descuento';

        await page.request.patch(`${API_URL}/api/v1/protected/user-bookmarks/${bookmarkId}`, {
            data: { description: noteText },
            headers
        });

        // Act: re-fetch bookmark list
        const listRes = await page.request.get(`${API_URL}/api/v1/protected/user-bookmarks`, {
            headers
        });
        expect(listRes.ok()).toBe(true);
        // GET /user-bookmarks answers `{ data: { bookmarks, total } }`, not a bare
        // array under `data` — reading `data.find` threw "find is not a function"
        // and never reached the assertion.
        const listBody = (await listRes.json()) as {
            data?: {
                bookmarks?: ReadonlyArray<{
                    id: string;
                    description?: string | null;
                }>;
                total?: number;
            };
        };
        const bookmark = listBody.data?.bookmarks?.find((bm) => bm.id === bookmarkId);

        // Assert: the bookmark we just wrote a note on must come back in the owner's
        // own list. Skipping when it is absent would turn a real regression — a
        // bookmark missing from its owner's list — into a silent pass.
        expect(bookmark, `bookmark ${bookmarkId} missing from the owner's list`).toBeDefined();
        expect(bookmark?.description).toBe(noteText);
    });
});
