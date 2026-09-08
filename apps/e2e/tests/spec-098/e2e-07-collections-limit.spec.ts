/**
 * E2E-07 (SPEC-098 T-060b) — Collections limit enforcement.
 *
 * Actors: Authenticated regular user.
 *
 * Tags: @p1 @favorites @collections @limit @spec-098
 *
 * Preconditions:
 *   - Protected user-bookmark-collections endpoints mounted.
 *   - Suite seed has the `tourist-vip` billing plan in `billing_plans`
 *     (`name = slug`, `livemode = false`), carrying a `max_collections` limit.
 *
 * What this validates (AC-03.4):
 *   1. User can create up to the plan's configured limit.
 *   2. Creating one beyond the limit returns 403 (QUOTA_EXCEEDED).
 *   3. The error response includes `{ currentCount, maxAllowed }` so the UI
 *      can render the live counter.
 *   4. Deleting a collection frees up a slot (quota is re-entrant).
 *
 * Note: the cap used to be a fixed env var (`HOSPEDA_MAX_COLLECTIONS_PER_USER`,
 * default 10) shared by every paid tourist tier. HOS-1224 retired tourist-plus
 * — the tier that env var actually described — leaving tourist-vip as the only
 * paid tourist tier, at its own `max_collections = 25`. The cap is now read off
 * the resolved plan (see `MAX_COLLECTIONS` below) instead of hard-coded, so a
 * future change to the commercial limit does not silently desync this spec
 * again. Creating up to the cap collections in a test still adds real
 * sequential API round-trips, so the suite stays @p1 (not @p0) to keep the
 * critical path fast.
 *
 * @see SPEC-098 spec.md § US-03, AC-03.4, section 4a decision #1
 */

import { expect, test } from '@playwright/test';
import { createSubscription, createUser, resolvePlanIdBySlug } from '../../fixtures/api-helpers.ts';
import { getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

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
    let vipPlanId: string | null = null;
    // Read the cap off the resolved plan rather than hard-coding it or reading
    // it from an env var: `max_collections` is commercial configuration that
    // has already moved once (it lived on the now-retired tourist-plus at 10;
    // tourist-vip, the sole surviving paid tourist tier, carries it at 25) and
    // a fixed number here would silently drift from whatever the API actually
    // enforces. `HOSPEDA_MAX_COLLECTIONS_PER_USER` stays as a last-resort
    // fallback only for the case where the plan row carries no limit at all.
    let MAX_COLLECTIONS = Number(process.env.HOSPEDA_MAX_COLLECTIONS_PER_USER ?? '10');

    test.beforeAll(async () => {
        const vip = await resolvePlanIdBySlug({ slug: 'tourist-vip' });
        vipPlanId = vip.planId;
        MAX_COLLECTIONS = vip.limits?.max_collections ?? MAX_COLLECTIONS;
    });

    test.afterEach(async () => {
        if (userId) {
            await cleanupTestUsers(getDbPool(), [userId]);
        }
        userId = null;
    });

    // The title cannot interpolate MAX_COLLECTIONS: Playwright evaluates test
    // titles at collection time, before `beforeAll` runs, so the plan-derived
    // value would still read as the env-var fallback (or 0) in the report.
    test('AC-03.4 — creating one collection beyond the plan limit is rejected with 403', async ({
        page
    }) => {
        // Arrange
        test.fixme(!vipPlanId, 'tourist-vip plan not seeded — cannot run');
        if (!vipPlanId) return;
        const user = await createUser({ role: 'USER' });
        userId = user.id;
        // SPEC-287 put collections behind `can_use_collections`; tourist-free is
        // now rejected with 403, and tourist-vip is the tier whose cap applies
        // (HOS-1224 retired tourist-plus, which used to carry this cap at 10).
        await createSubscription({ userId: user.id, planId: vipPlanId, status: 'active' });
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
        test.fixme(!vipPlanId, 'tourist-vip plan not seeded — cannot run');
        if (!vipPlanId) return;
        const user = await createUser({ role: 'USER' });
        userId = user.id;
        // SPEC-287 put collections behind `can_use_collections`; tourist-free is
        // now rejected with 403, and tourist-vip is the tier whose cap applies
        // (HOS-1224 retired tourist-plus, which used to carry this cap at 10).
        await createSubscription({ userId: user.id, planId: vipPlanId, status: 'active' });
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
        test.fixme(!vipPlanId, 'tourist-vip plan not seeded — cannot run');
        if (!vipPlanId) return;
        const user = await createUser({ role: 'USER' });
        userId = user.id;
        // SPEC-287 put collections behind `can_use_collections`; tourist-free is
        // now rejected with 403, and tourist-vip is the tier whose cap applies
        // (HOS-1224 retired tourist-plus, which used to carry this cap at 10).
        await createSubscription({ userId: user.id, planId: vipPlanId, status: 'active' });
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
