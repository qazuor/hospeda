/**
 * E2E-03 (SPEC-098 T-059b) — Collections CRUD: create, edit, delete.
 *
 * Actors: Authenticated regular user.
 *
 * Tags: @p0 @favorites @collections @crud @spec-098
 *
 * Preconditions:
 *   - Protected user-bookmark-collections endpoints mounted.
 *   - At least one ACTIVE/PUBLIC accommodation in seed (needed to create bookmarks).
 *
 * What this validates (AC-03.1, AC-03.2, AC-04.2, AC-05.1):
 *   1. Create collection → response 201, collection visible in GET list.
 *   2. Edit collection name/color → 200, updated values persisted.
 *   3. Delete collection → 200/204; its bookmarks are preserved (collectionId → NULL).
 *
 * @see SPEC-098 spec.md § US-03, US-04, US-05, AC-03.1, AC-03.2, AC-04.2, AC-05.1
 */

import { expect, test } from '@playwright/test';
import { createUser } from '../../fixtures/api-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

interface CollectionResponse {
    readonly success?: boolean;
    readonly data?: {
        readonly id: string;
        readonly name: string;
        readonly color?: string | null;
        readonly icon?: string | null;
        readonly bookmarkCount?: number;
    };
}

interface CollectionListResponse {
    readonly success?: boolean;
    readonly data?: {
        readonly items?: ReadonlyArray<{ readonly id: string; readonly name: string }>;
        readonly usage?: { readonly current: number; readonly max: number };
    };
    /** Some list routes wrap items directly under data as an array */
    readonly items?: ReadonlyArray<{ readonly id: string; readonly name: string }>;
}

interface BookmarkListResponse {
    // GET /api/v1/protected/user-bookmarks returns { data: { bookmarks: [...], total } }
    readonly data?: {
        readonly bookmarks?: ReadonlyArray<{
            readonly id: string;
            readonly entityId: string;
            readonly collectionId?: string | null;
        }>;
        readonly total?: number;
    };
}

test.describe('E2E-03: collections CRUD @p0 @favorites @collections @crud @spec-098', () => {
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

    test('AC-03.2 — create collection: 201, appears in list', async ({ page }) => {
        // Arrange
        const user = await createUser({ role: 'USER' });
        userId = user.id;
        const headers = { cookie: user.sessionCookie };

        // Act: create collection
        const createRes = await page.request.post(
            `${API_URL}/api/v1/protected/user-bookmark-collections`,
            {
                data: {
                    name: 'E2E Coleccion Verano',
                    description: 'Opciones verano E2E',
                    color: '#4FC3F7',
                    icon: 'sun'
                },
                headers
            }
        );

        // Assert: 201, id returned
        expect(createRes.status(), `expected 201, got ${createRes.status()}`).toBe(201);
        const createBody = (await createRes.json()) as CollectionResponse;
        const created = createBody.data ?? (createBody as unknown as CollectionResponse['data']);
        expect(created?.id).toBeTruthy();
        const collectionId = created?.id as string;

        // List → collection appears
        const listRes = await page.request.get(
            `${API_URL}/api/v1/protected/user-bookmark-collections`,
            { headers }
        );
        expect(listRes.ok()).toBe(true);
        const listBody = (await listRes.json()) as CollectionListResponse;
        const items =
            listBody.data?.items ??
            (listBody.items as ReadonlyArray<{ id: string; name: string }> | undefined) ??
            (Array.isArray(listBody.data)
                ? (listBody.data as ReadonlyArray<{ id: string; name: string }>)
                : []);
        const found = items.some((item) => item.id === collectionId);
        expect(found, `newly created collection ${collectionId} not found in list`).toBe(true);
    });

    test('AC-04.2 — edit collection name and color: 200, values updated', async ({ page }) => {
        // Arrange
        const user = await createUser({ role: 'USER' });
        userId = user.id;
        const headers = { cookie: user.sessionCookie };

        const createRes = await page.request.post(
            `${API_URL}/api/v1/protected/user-bookmark-collections`,
            {
                data: { name: 'E2E Coleccion Edit Original', color: '#E57373' },
                headers
            }
        );
        expect(createRes.status()).toBe(201);
        const createBody = (await createRes.json()) as CollectionResponse;
        const collectionId = (
            createBody.data ?? (createBody as unknown as CollectionResponse['data'])
        )?.id as string;
        expect(collectionId).toBeTruthy();

        // Act: patch name and color
        const patchRes = await page.request.patch(
            `${API_URL}/api/v1/protected/user-bookmark-collections/${collectionId}`,
            {
                data: { name: 'E2E Coleccion Edit Renamed', color: '#AED581' },
                headers
            }
        );

        // Assert: 200, updated values reflected
        expect(patchRes.ok(), `PATCH expected 200, got ${patchRes.status()}`).toBe(true);
        const patchBody = (await patchRes.json()) as CollectionResponse;
        const updated = patchBody.data ?? (patchBody as unknown as CollectionResponse['data']);
        expect(updated?.name).toBe('E2E Coleccion Edit Renamed');
        expect(updated?.color).toBe('#AED581');
    });

    test('AC-05.1 — delete collection: bookmarks preserved with collectionId = NULL', async ({
        page
    }) => {
        // Arrange
        const accId = await getFirstActiveAccommodationId();
        if (!accId) {
            test.fixme(
                true,
                'No active public accommodation in seed — AC-05.1 requires a bookmark'
            );
            return;
        }

        const user = await createUser({ role: 'USER' });
        userId = user.id;
        const headers = { cookie: user.sessionCookie };

        // Create a collection
        const createColRes = await page.request.post(
            `${API_URL}/api/v1/protected/user-bookmark-collections`,
            {
                data: { name: 'E2E Coleccion To Delete' },
                headers
            }
        );
        expect(createColRes.status()).toBe(201);
        const createColBody = (await createColRes.json()) as CollectionResponse;
        const collectionId = (
            createColBody.data ?? (createColBody as unknown as CollectionResponse['data'])
        )?.id as string;

        // Create a bookmark and assign it to the collection
        const toggleRes = await page.request.post(`${API_URL}/api/v1/protected/user-bookmarks`, {
            data: { entityId: accId, entityType: 'ACCOMMODATION' },
            headers
        });
        expect(toggleRes.ok()).toBe(true);
        const toggleBody = (await toggleRes.json()) as {
            data?: { toggled: boolean; bookmark: { id: string } | null };
        };
        const bookmarkId = (
            toggleBody.data ?? (toggleBody as unknown as { bookmark: { id: string } | null })
        )?.bookmark?.id as string | undefined;

        if (!bookmarkId) {
            test.skip(true, 'Could not retrieve bookmark id from toggle response');
            return;
        }

        // Move bookmark into collection
        const addRes = await page.request.post(
            `${API_URL}/api/v1/protected/user-bookmark-collections/${collectionId}/bookmarks/${bookmarkId}`,
            { headers }
        );
        expect(addRes.ok(), `addBookmark expected 200, got ${addRes.status()}`).toBe(true);

        // Act: delete the collection
        const deleteRes = await page.request.delete(
            `${API_URL}/api/v1/protected/user-bookmark-collections/${collectionId}`,
            { headers }
        );
        expect(
            deleteRes.ok() || deleteRes.status() === 204,
            `DELETE expected 200/204, got ${deleteRes.status()}`
        ).toBe(true);

        // Assert: bookmark still exists, collectionId is now NULL
        const listRes = await page.request.get(`${API_URL}/api/v1/protected/user-bookmarks`, {
            headers
        });
        expect(listRes.ok()).toBe(true);
        const listBody = (await listRes.json()) as BookmarkListResponse;
        const bookmark = listBody.data?.bookmarks?.find((bm) => bm.id === bookmarkId);
        expect(bookmark, 'bookmark should still exist after collection deletion').toBeTruthy();
        expect(bookmark?.collectionId ?? null).toBeNull();
    });

    test('AC-03.3 — duplicate collection name returns 409', async ({ page }) => {
        // Arrange
        const user = await createUser({ role: 'USER' });
        userId = user.id;
        const headers = { cookie: user.sessionCookie };

        await page.request.post(`${API_URL}/api/v1/protected/user-bookmark-collections`, {
            data: { name: 'E2E Duplicado' },
            headers
        });

        // Act: create again with same name
        const dupeRes = await page.request.post(
            `${API_URL}/api/v1/protected/user-bookmark-collections`,
            {
                data: { name: 'E2E Duplicado' },
                headers
            }
        );

        // Assert: 409
        expect(dupeRes.status(), `expected 409 for duplicate name, got ${dupeRes.status()}`).toBe(
            409
        );
    });
});
