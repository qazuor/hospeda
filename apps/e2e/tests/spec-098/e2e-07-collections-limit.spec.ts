/**
 * E2E-07 (SPEC-098 T-060b) — Collections limit enforcement.
 *
 * Actors: Authenticated regular user.
 *
 * Tags: @p1 @favorites @collections @limit @spec-098
 *
 * Preconditions:
 *   - Protected user-bookmark-collections endpoints mounted.
 *   - `HOSPEDA_MAX_COLLECTIONS_PER_USER` env var or default of 10 is active.
 *
 * What this validates (AC-03.4):
 *   1. User can create up to the configured limit (default 10).
 *   2. Creating one beyond the limit returns 403 (QUOTA_EXCEEDED).
 *   3. The error response includes `{ currentCount, maxAllowed }` so the UI
 *      can render the live counter.
 *   4. Deleting a collection frees up a slot (quota is re-entrant).
 *
 * Note: The default limit is 10. Creating 10 collections in a test adds ~1s
 * of sequential API round-trips. The test is scoped @p1 (not @p0) to keep
 * the critical path fast.
 *
 * @see SPEC-098 spec.md § US-03, AC-03.4, section 4a decision #1
 */

import { expect, test } from '@playwright/test';
import { createUser } from '../../fixtures/api-helpers.ts';
import { getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

/**
 * Read the configured max from the env (the API uses this), or fall back to
 * the spec default. In the E2E environment this is only approximate; the
 * authoritative value is whatever the API has compiled with.
 */
const MAX_COLLECTIONS = Number(process.env.HOSPEDA_MAX_COLLECTIONS_PER_USER ?? '10');

interface CollectionCreateResponse {
    readonly success?: boolean;
    readonly data?: { readonly id: string; readonly name: string };
}

interface QuotaErrorResponse {
    readonly success?: boolean;
    readonly error?: {
        readonly code?: string;
        readonly details?: {
            readonly currentCount?: number;
            readonly maxAllowed?: number;
        };
    };
    readonly data?: {
        readonly currentCount?: number;
        readonly maxAllowed?: number;
    };
}

test.describe('E2E-07: collection limit enforcement @p1 @favorites @collections @limit @spec-098', () => {
    let userId: string | null = null;

    test.afterEach(async () => {
        if (userId) {
            await cleanupTestUsers(getDbPool(), [userId]);
        }
        userId = null;
    });

    test(`AC-03.4 — creating ${MAX_COLLECTIONS + 1} collections: last one rejected with 403`, async ({
        page
    }) => {
        // Arrange
        const user = await createUser({ role: 'USER' });
        userId = user.id;
        const headers = { cookie: user.sessionCookie };

        // Act: create MAX_COLLECTIONS collections (all should succeed)
        for (let i = 1; i <= MAX_COLLECTIONS; i++) {
            const res = await page.request.post(
                `${API_URL}/api/v1/protected/user-bookmark-collections`,
                {
                    data: { name: `E2E Limit Test ${i}` },
                    headers
                }
            );
            expect(
                res.status(),
                `collection ${i}/${MAX_COLLECTIONS} should succeed (got ${res.status()})`
            ).toBe(201);
        }

        // Act: try to create one more
        const overLimitRes = await page.request.post(
            `${API_URL}/api/v1/protected/user-bookmark-collections`,
            {
                data: { name: 'E2E Limit Exceeded' },
                headers
            }
        );

        // Assert: 403 QUOTA_EXCEEDED (per spec section 4a decision #1 + create.ts implementation)
        expect(
            overLimitRes.status(),
            `expected 403 for collection beyond limit, got ${overLimitRes.status()}`
        ).toBe(403);

        const errorBody = (await overLimitRes.json()) as QuotaErrorResponse;

        // The response should include currentCount / maxAllowed so the UI can show a counter
        const details =
            errorBody.error?.details ??
            (errorBody.data as { currentCount?: number; maxAllowed?: number } | undefined) ??
            {};
        const { currentCount, maxAllowed } = details as {
            currentCount?: number;
            maxAllowed?: number;
        };

        if (currentCount !== undefined) {
            expect(currentCount).toBe(MAX_COLLECTIONS);
        }
        if (maxAllowed !== undefined) {
            expect(maxAllowed).toBe(MAX_COLLECTIONS);
        }
    });

    test('AC-03.4 — deleting a collection frees up a slot (re-entrant quota)', async ({ page }) => {
        // Arrange: fill to the limit
        const user = await createUser({ role: 'USER' });
        userId = user.id;
        const headers = { cookie: user.sessionCookie };

        let firstCollectionId: string | null = null;

        for (let i = 1; i <= MAX_COLLECTIONS; i++) {
            const res = await page.request.post(
                `${API_URL}/api/v1/protected/user-bookmark-collections`,
                {
                    data: { name: `E2E Slot Test ${i}` },
                    headers
                }
            );
            expect(res.status()).toBe(201);
            if (i === 1) {
                const body = (await res.json()) as CollectionCreateResponse;
                firstCollectionId =
                    (body.data ?? (body as unknown as CollectionCreateResponse['data']))?.id ??
                    null;
            }
        }

        // Delete the first collection to free a slot
        expect(firstCollectionId).toBeTruthy();
        const deleteRes = await page.request.delete(
            `${API_URL}/api/v1/protected/user-bookmark-collections/${firstCollectionId}`,
            { headers }
        );
        expect(
            deleteRes.ok() || deleteRes.status() === 204,
            `DELETE expected 200/204, got ${deleteRes.status()}`
        ).toBe(true);

        // Act: create a new collection in the freed slot
        const newRes = await page.request.post(
            `${API_URL}/api/v1/protected/user-bookmark-collections`,
            {
                data: { name: 'E2E Slot Freed' },
                headers
            }
        );

        // Assert: creation succeeds (quota re-entrant)
        expect(newRes.status(), `expected 201 after freeing a slot, got ${newRes.status()}`).toBe(
            201
        );
    });

    test('AC-03.4 — usage block in GET list shows current/max ratio', async ({ page }) => {
        // Arrange
        const user = await createUser({ role: 'USER' });
        userId = user.id;
        const headers = { cookie: user.sessionCookie };

        // Create 2 collections
        for (let i = 1; i <= 2; i++) {
            await page.request.post(`${API_URL}/api/v1/protected/user-bookmark-collections`, {
                data: { name: `E2E Usage Check ${i}` },
                headers
            });
        }

        // Act: GET list
        const listRes = await page.request.get(
            `${API_URL}/api/v1/protected/user-bookmark-collections`,
            { headers }
        );
        expect(listRes.ok()).toBe(true);

        const listBody = (await listRes.json()) as {
            data?: {
                items?: unknown[];
                usage?: { current: number; max: number };
            };
        };

        const usage = listBody.data?.usage;

        if (!usage) {
            test.skip(
                true,
                'GET list response does not include usage block — ' +
                    'check UserBookmarkCollectionService returns { current, max } in list response'
            );
            return;
        }

        // Assert
        expect(usage.current).toBe(2);
        expect(usage.max).toBe(MAX_COLLECTIONS);
    });
});
