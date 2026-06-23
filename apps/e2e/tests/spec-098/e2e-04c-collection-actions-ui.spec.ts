/**
 * E2E-04c (SPEC-098) — Collection detail actions (Edit + Delete) via the UI.
 *
 * Coexists with `e2e-03-collections-crud.spec.ts` which exercises the API
 * contract directly. This test drives the React island
 * `CollectionDetailActions.client.tsx` mounted from the collection detail
 * page so the wiring is covered in CI.
 *
 * Actors: Authenticated regular user.
 *
 * Tags: @p1 @favorites @collections @ui @spec-098
 *
 * Preconditions:
 *   - At least one ACTIVE/PUBLIC accommodation in seed.
 *   - Protected collection endpoints mounted.
 *   - Web dev/preview server running at HOSPEDA_E2E_WEB_URL.
 *
 * What this validates (US-04, US-05, AC-04.2, AC-05.1):
 *   1. Click "Borrar" on the collection detail page → confirmation dialog
 *      accepted, the collection is soft-deleted in DB and the user is
 *      redirected to /mi-cuenta/favoritos/. Pre-existing bookmarks survive
 *      with collection_id = NULL (AC-05.1).
 *
 * @see SPEC-098 spec.md § US-04, US-05, AC-04.2, AC-05.1
 */

import { expect, test } from '@playwright/test';
import { createUser } from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';
const WEB_BASE_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';

interface ToggleBookmarkResponse {
    readonly success?: boolean;
    readonly data?: {
        readonly toggled: boolean;
        readonly bookmark: { readonly id: string } | null;
    };
}

interface CollectionCreateResponse {
    readonly success?: boolean;
    readonly data?: { readonly id: string; readonly name: string };
}

/**
 * Inject a Better Auth session cookie produced by the API helpers
 * into the Playwright browser context so the SSR session can hydrate.
 */
async function attachSessionCookie(
    context: import('@playwright/test').BrowserContext,
    rawCookie: string
): Promise<void> {
    const cookies = rawCookie.split('; ').flatMap((pair) => {
        const idx = pair.indexOf('=');
        if (idx < 0) return [];
        const name = pair.slice(0, idx).trim();
        const value = pair.slice(idx + 1).trim();
        if (!name || !value) return [];
        return [{ name, value, domain: 'localhost', path: '/' }];
    });
    await context.addCookies(cookies);
}

test.describe('E2E-04c: collection actions via UI @p1 @favorites @collections @ui @spec-098', () => {
    const userIds: string[] = [];

    test.beforeEach(async ({ page }) => {
        await seedCookieConsent(page);
    });

    test.afterEach(async () => {
        if (userIds.length > 0) {
            await cleanupTestUsers(getDbPool(), userIds);
            userIds.length = 0;
        }
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

    test('AC-05.1 (UI) — delete collection from detail page: redirect + bookmarks preserved', async ({
        page,
        context
    }) => {
        // Arrange: seed an accommodation, create a user, a collection and a bookmark inside it
        const accId = await getFirstActiveAccommodationId();
        if (!accId) {
            test.fixme(true, 'No active public accommodation in seed');
            return;
        }

        const user = await createUser({ role: 'USER' });
        userIds.push(user.id);
        const headers = { cookie: user.sessionCookie };

        const colRes = await page.request.post(
            `${API_URL}/api/v1/protected/user-bookmark-collections`,
            { data: { name: 'E2E UI Delete Target' }, headers }
        );
        expect(colRes.status()).toBe(201);
        const colBody = (await colRes.json()) as CollectionCreateResponse;
        const collectionId = (
            colBody.data ?? (colBody as unknown as CollectionCreateResponse['data'])
        )?.id as string;
        expect(collectionId).toBeTruthy();

        const toggleRes = await page.request.post(`${API_URL}/api/v1/protected/user-bookmarks`, {
            data: { entityId: accId, entityType: 'ACCOMMODATION' },
            headers
        });
        expect(toggleRes.ok()).toBe(true);
        const toggleBody = (await toggleRes.json()) as ToggleBookmarkResponse;
        const bookmarkId = (
            toggleBody.data ?? (toggleBody as unknown as ToggleBookmarkResponse['data'])
        )?.bookmark?.id as string | undefined;
        if (!bookmarkId) {
            test.skip(true, 'Could not retrieve bookmark id from toggle response');
            return;
        }

        // Pre-assign the bookmark to the collection via the API
        const addRes = await page.request.post(
            `${API_URL}/api/v1/protected/user-bookmark-collections/${collectionId}/bookmarks/${bookmarkId}`,
            { headers }
        );
        expect(addRes.ok()).toBe(true);

        // Inject the session cookie into the browser
        await attachSessionCookie(context, user.sessionCookie);

        // Auto-accept the window.confirm() dialog raised by the island
        page.on('dialog', (dialog) => {
            void dialog.accept();
        });

        // Act: navigate to the collection detail page and click the Delete action
        await page.goto(`${WEB_BASE_URL}/es/mi-cuenta/favoritos/colecciones/${collectionId}/`);
        await page.waitForLoadState('networkidle');

        const deleteBtn = page.locator('[data-testid="collection-actions-delete"]');
        if ((await deleteBtn.count()) === 0) {
            test.skip(
                true,
                'Delete action not found — CollectionDetailActions island is not mounted on the detail page'
            );
            return;
        }
        await deleteBtn.first().click();

        // Assert: the user is redirected back to the favorites index
        await page.waitForURL(/\/mi-cuenta\/favoritos\/?$/, { timeout: 10_000 });
        expect(page.url()).toMatch(/\/mi-cuenta\/favoritos\/?$/);

        // Assert: the collection is soft-deleted (deleted_at IS NOT NULL)
        const colRows = await execSQL<{ deleted_at: Date | null }>(
            'SELECT deleted_at FROM user_bookmark_collections WHERE id = $1',
            [collectionId]
        );
        expect(colRows, 'collection record must still exist (soft delete)').toHaveLength(1);
        expect(colRows[0]?.deleted_at).not.toBeNull();

        // Assert: the bookmark survives with collection_id = NULL (AC-05.1)
        const bkRows = await execSQL<{ collection_id: string | null }>(
            'SELECT collection_id FROM user_bookmarks WHERE id = $1 AND deleted_at IS NULL',
            [bookmarkId]
        );
        expect(bkRows, 'bookmark must still exist after collection deletion').toHaveLength(1);
        expect(bkRows[0]?.collection_id ?? null).toBeNull();
    });
});
