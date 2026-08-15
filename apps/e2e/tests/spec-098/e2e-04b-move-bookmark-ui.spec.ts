/**
 * E2E-04b (SPEC-098) — Move bookmark between collections via the favorites UI.
 *
 * Coexists with `e2e-04-move-bookmark.spec.ts` which exercises the API
 * contract directly. This test drives the React UI (MoveToCollectionModal +
 * UserFavoritesList) end-to-end so the wiring is covered in CI.
 *
 * Actors: Authenticated regular user.
 *
 * Tags: @p1 @favorites @collections @move @ui @spec-098
 *
 * Preconditions:
 *   - At least one ACTIVE/PUBLIC accommodation in seed.
 *   - Protected collection + bookmark endpoints mounted.
 *   - Web dev/preview server running at HOSPEDA_E2E_WEB_URL.
 *
 * What this validates (US-06, US-07, AC-06.2, AC-06.3, AC-07.1):
 *   1. UI: open modal from favorites list, select an existing collection,
 *      click "Mover" → bookmark.collection_id updates in DB and the modal
 *      closes.
 *   2. UI: re-open the modal, select "Sin colección", click "Mover" →
 *      bookmark.collection_id becomes NULL but the bookmark itself is
 *      preserved (AC-07.1 — DELETE sub-resource path).
 *
 * @see SPEC-098 spec.md § US-06, US-07, AC-06.2, AC-06.3, AC-07.1
 */

import { expect, test } from '@playwright/test';
import {
    createSubscription,
    createUser,
    markProfileCompleted,
    resolvePlanIdBySlug
} from '../../fixtures/api-helpers.ts';
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

test.describe('E2E-04b: move bookmark via UI @p1 @favorites @collections @move @ui @spec-098', () => {
    const userIds: string[] = [];
    let plusPlanId: string | null = null;

    test.beforeAll(async () => {
        ({ planId: plusPlanId } = await resolvePlanIdBySlug({ slug: 'tourist-plus' }));
    });

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

    test('AC-06.2 (UI) — move bookmark to existing collection updates DB', async ({
        page,
        context
    }) => {
        // Arrange: seed an accommodation, create a user, a collection and a bookmark
        const accId = await getFirstActiveAccommodationId();
        if (!accId) {
            test.fixme(true, 'No active public accommodation in seed');
            return;
        }

        test.fixme(!plusPlanId, 'tourist-plus plan not seeded — cannot run');
        if (!plusPlanId) return;
        const user = await createUser({ role: 'USER' });
        userIds.push(user.id);
        // SPEC-287 put collections behind `can_use_collections`; tourist-free is 403.
        await createSubscription({ userId: user.id, planId: plusPlanId, status: 'active' });
        // SPEC-113 bounces users with profile_completed = false to the completion
        // form, so a UI spec never reaches the account page it asserts on.
        await markProfileCompleted({ userId: user.id });
        const headers = { cookie: user.sessionCookie };

        const colRes = await page.request.post(
            `${API_URL}/api/v1/protected/user-bookmark-collections`,
            { data: { name: 'E2E UI Move Target' }, headers }
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

        // Inject the session cookie into the browser
        await attachSessionCookie(context, user.sessionCookie);

        // Act: navigate to the favorites page and open the move modal
        await page.goto(`${WEB_BASE_URL}/es/mi-cuenta/favoritos/`);
        await page.waitForLoadState('networkidle');

        // The move button is unconditional inside BookmarkGrid, so its absence means
        // the bookmark did not render — a real regression. This used to `test.skip`
        // with "integration is missing", which was false (UserFavoritesList has wired
        // MoveToCollectionModal since the SPEC-098 closeout) and silently swallowed
        // the redirect that markProfileCompleted now prevents.
        const moveBtn = page.locator(`[data-testid="move-bookmark-button-${bookmarkId}"]`);
        await expect(
            moveBtn,
            `move button for bookmark ${bookmarkId} not rendered on ${page.url()}`
        ).toHaveCount(1);
        await moveBtn.first().click();

        // Modal should open
        const modal = page.locator('[data-testid="move-bookmark-modal"]');
        await expect(modal).toBeVisible({ timeout: 5_000 });

        // Select the target collection radio
        const targetOption = page.locator(
            `[data-testid="move-bookmark-collection-option-${collectionId}"]`
        );
        await targetOption.click();

        // Confirm
        await page.locator('[data-testid="move-bookmark-confirm"]').click();

        // Modal closes after success
        await expect(modal).toBeHidden({ timeout: 5_000 });

        // Assert: DB updated
        const rows = await execSQL<{ collection_id: string | null }>(
            'SELECT collection_id FROM user_bookmarks WHERE id = $1 AND deleted_at IS NULL',
            [bookmarkId]
        );
        expect(rows[0]?.collection_id).toBe(collectionId);
    });

    test('AC-06.3 (UI) — move bookmark to "Sin colección" sets collection_id to NULL', async ({
        page,
        context
    }) => {
        // Arrange: seed accommodation, user, collection, bookmark already inside collection
        const accId = await getFirstActiveAccommodationId();
        if (!accId) {
            test.fixme(true, 'No active public accommodation in seed');
            return;
        }

        test.fixme(!plusPlanId, 'tourist-plus plan not seeded — cannot run');
        if (!plusPlanId) return;
        const user = await createUser({ role: 'USER' });
        userIds.push(user.id);
        // SPEC-287 put collections behind `can_use_collections`; tourist-free is 403.
        await createSubscription({ userId: user.id, planId: plusPlanId, status: 'active' });
        // SPEC-113 bounces users with profile_completed = false to the completion
        // form, so a UI spec never reaches the account page it asserts on.
        await markProfileCompleted({ userId: user.id });
        const headers = { cookie: user.sessionCookie };

        const colRes = await page.request.post(
            `${API_URL}/api/v1/protected/user-bookmark-collections`,
            { data: { name: 'E2E UI Move Source' }, headers }
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

        // Act: navigate to the favorites page
        await page.goto(`${WEB_BASE_URL}/es/mi-cuenta/favoritos/`);
        await page.waitForLoadState('networkidle');

        // The bookmark currently lives inside the collection so it is NOT shown
        // in the "Sin colección" section. We open the modal from the collection
        // detail page instead. The collection card links there, but for the UI
        // wiring of this assertion the favorites page lists the move button on
        // every uncollected bookmark only. The current MVP wiring only exposes
        // the move button on uncollected cards. To exercise the "remove from
        // collection" path through the UI, we navigate to the collection
        // detail page and use the dedicated CollectionBookmarkRemoveBtn
        // (already wired in [id].astro).
        await page.goto(`${WEB_BASE_URL}/es/mi-cuenta/favoritos/colecciones/${collectionId}/`);
        await page.waitForLoadState('networkidle');

        // CollectionBookmarkRemoveBtn asks for confirmation with window.confirm().
        // Playwright DISMISSES dialogs unless a handler accepts them, so without this
        // the confirm returns false and handleRemove() returns before issuing the
        // DELETE — the click looks successful and nothing happens. e2e-04c already
        // does this for the same reason.
        page.on('dialog', (dialog) => {
            void dialog.accept();
        });

        const removeBtn = page.locator('[data-testid="collection-bookmark-remove-btn"]').first();
        await expect(
            removeBtn,
            `remove-from-collection button not rendered on ${page.url()}`
        ).toBeVisible();

        // CollectionBookmarkRemoveBtn is mounted `client:visible`, so the button is
        // server-rendered before React attaches its onClick. A single click plus
        // `networkidle` silently did nothing when it landed pre-hydration: no request
        // was ever sent, and the spec then blamed the DELETE for not clearing
        // collection_id. Retry the click until the DELETE actually goes out — the
        // request is the evidence that the handler ran.
        const deleteUrlFragment = `/user-bookmark-collections/${collectionId}/bookmarks/${bookmarkId}`;
        await expect(async () => {
            await Promise.all([
                page.waitForResponse(
                    (res) =>
                        res.url().includes(deleteUrlFragment) &&
                        res.request().method() === 'DELETE',
                    { timeout: 3_000 }
                ),
                removeBtn.click()
            ]);
        }).toPass({ timeout: 20_000 });

        // The island reloads the page after a successful DELETE.
        await page.waitForLoadState('networkidle');

        // Assert: DB reflects the removal (collection_id = NULL, bookmark still exists)
        const rows = await execSQL<{ collection_id: string | null }>(
            'SELECT collection_id FROM user_bookmarks WHERE id = $1 AND deleted_at IS NULL',
            [bookmarkId]
        );
        expect(rows, 'bookmark must still exist after removal from collection').toHaveLength(1);
        expect(rows[0]?.collection_id ?? null).toBeNull();
    });
});
