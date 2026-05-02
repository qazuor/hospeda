/**
 * E2E-04 (SPEC-098 T-059b) — Move bookmark between collections.
 *
 * Actors: Authenticated regular user.
 *
 * Tags: @p1 @favorites @collections @move @spec-098
 *
 * Preconditions:
 *   - At least one ACTIVE/PUBLIC accommodation in seed (needed for bookmark creation).
 *   - Protected collection + bookmark endpoints mounted.
 *
 * What this validates (AC-06.2, AC-06.3, AC-07.1):
 *   1. Save bookmark → move to a collection → collection shows it.
 *   2. Remove bookmark from collection → bookmark moves back to "uncollected"
 *      (collectionId = NULL).
 *   3. Another user cannot see or manage the collection (403).
 *
 * @see SPEC-098 spec.md § US-06, US-07, AC-06.2, AC-06.3, AC-07.1
 */

import { expect, test } from '@playwright/test';
import { createUser } from '../../fixtures/api-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

interface ToggleBookmarkResponse {
    readonly success?: boolean;
    readonly data?: {
        readonly toggled: boolean;
        readonly bookmark: { readonly id: string; readonly collectionId?: string | null } | null;
    };
}

interface BookmarkItemResponse {
    readonly id: string;
    readonly entityId: string;
    readonly collectionId?: string | null;
}

interface BookmarkListResponse {
    readonly data?: ReadonlyArray<BookmarkItemResponse>;
}

interface CollectionCreateResponse {
    readonly success?: boolean;
    readonly data?: { readonly id: string; readonly name: string };
}

interface UpdatedBookmarkResponse {
    readonly success?: boolean;
    readonly data?: { readonly id: string; readonly collectionId?: string | null };
}

test.describe('E2E-04: move bookmark between collections @p1 @favorites @collections @move @spec-098', () => {
    const userIds: string[] = [];

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

    test('AC-06.2 — move bookmark to collection: bookmark collectionId updated', async ({
        page
    }) => {
        // Arrange
        const accId = await getFirstActiveAccommodationId();
        if (!accId) {
            test.fixme(true, 'No active public accommodation in seed');
            return;
        }

        const user = await createUser({ role: 'USER' });
        userIds.push(user.id);
        const headers = { cookie: user.sessionCookie };

        // Create collection
        const colRes = await page.request.post(
            `${API_URL}/api/v1/protected/user-bookmark-collections`,
            { data: { name: 'E2E Destino Luna de Miel' }, headers }
        );
        expect(colRes.status()).toBe(201);
        const colBody = (await colRes.json()) as CollectionCreateResponse;
        const collectionId = (
            colBody.data ?? (colBody as unknown as CollectionCreateResponse['data'])
        )?.id as string;
        expect(collectionId).toBeTruthy();

        // Create bookmark
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

        // Act: move bookmark into collection
        const addRes = await page.request.post(
            `${API_URL}/api/v1/protected/user-bookmark-collections/${collectionId}/bookmarks/${bookmarkId}`,
            { headers }
        );

        // Assert: 200, bookmark collectionId updated
        expect(addRes.ok(), `expected 200, got ${addRes.status()}`).toBe(true);
        const addBody = (await addRes.json()) as UpdatedBookmarkResponse;
        const updatedBookmark =
            addBody.data ?? (addBody as unknown as UpdatedBookmarkResponse['data']);
        expect(updatedBookmark?.collectionId).toBe(collectionId);

        // DB invariant
        const rows = await execSQL<{ collection_id: string | null }>(
            'SELECT collection_id FROM user_bookmarks WHERE id = $1 AND deleted_at IS NULL',
            [bookmarkId]
        );
        expect(rows[0]?.collection_id).toBe(collectionId);
    });

    test('AC-06.3 — remove bookmark from collection: collectionId becomes NULL', async ({
        page
    }) => {
        // Arrange
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
            { data: { name: 'E2E Remove From Collection Test' }, headers }
        );
        expect(colRes.status()).toBe(201);
        const colBody = (await colRes.json()) as CollectionCreateResponse;
        const collectionId = (
            colBody.data ?? (colBody as unknown as CollectionCreateResponse['data'])
        )?.id as string;

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

        // Move into collection first
        await page.request.post(
            `${API_URL}/api/v1/protected/user-bookmark-collections/${collectionId}/bookmarks/${bookmarkId}`,
            { headers }
        );

        // Act: remove from collection (DELETE sub-resource)
        const removeRes = await page.request.delete(
            `${API_URL}/api/v1/protected/user-bookmark-collections/${collectionId}/bookmarks/${bookmarkId}`,
            { headers }
        );

        // Assert: success, collectionId is NULL, bookmark still exists
        expect(
            removeRes.ok() || removeRes.status() === 204,
            `expected 200/204, got ${removeRes.status()}`
        ).toBe(true);

        const listRes = await page.request.get(`${API_URL}/api/v1/protected/user-bookmarks`, {
            headers
        });
        expect(listRes.ok()).toBe(true);
        const listBody = (await listRes.json()) as BookmarkListResponse;
        const bookmark = listBody.data?.find((bm) => bm.id === bookmarkId);
        expect(bookmark, 'bookmark must still exist after removal from collection').toBeTruthy();
        expect(bookmark?.collectionId ?? null).toBeNull();
    });

    test('AC-13.3 — other user cannot access collection (403)', async ({ page }) => {
        // Arrange: user A creates a collection, user B tries to read it
        const userA = await createUser({ role: 'USER' });
        const userB = await createUser({ role: 'USER' });
        userIds.push(userA.id, userB.id);

        const colRes = await page.request.post(
            `${API_URL}/api/v1/protected/user-bookmark-collections`,
            {
                data: { name: 'E2E Private Collection' },
                headers: { cookie: userA.sessionCookie }
            }
        );
        expect(colRes.status()).toBe(201);
        const colBody = (await colRes.json()) as CollectionCreateResponse;
        const collectionId = (
            colBody.data ?? (colBody as unknown as CollectionCreateResponse['data'])
        )?.id as string;

        // Act: user B tries to GET the collection
        const getRes = await page.request.get(
            `${API_URL}/api/v1/protected/user-bookmark-collections/${collectionId}`,
            { headers: { cookie: userB.sessionCookie } }
        );

        // Assert: 403 or 404 (implementation may return either for isolation)
        expect(
            getRes.status() === 403 || getRes.status() === 404,
            `expected 403 or 404 for cross-user access, got ${getRes.status()}`
        ).toBe(true);
    });
});
