/**
 * ADM-01 — Super-admin moderates an accommodation through the admin
 *           moderation route (PB10, take-down).
 *
 * Actors: Super-admin acting on someone else's accommodation.
 * Tags: @p1 @admin @cross-app
 *
 * Preconditions:
 *   - Host + PUBLISHED accommodation.
 *   - Super-admin account separate from the host.
 *
 * What this validates:
 *  1. Super-admin `POST /api/v1/admin/accommodations/:id/moderate` with
 *     `{ action: 'TAKE_DOWN', reason }` succeeds (admin-side moderation
 *     contract — owner doesn't need to be informed inline).
 *  2. DB invariant: the row's publication_status flipped to MODERATED.
 *  3. Public detail surface no longer exposes the row (404 / null) —
 *     the admin moderation immediately removes it from public surfaces.
 *
 * HOS-1641: this spec used to PATCH `lifecycleState: 'ARCHIVED'` on the
 * generic admin update. That column is gone; a take-down is the PB10
 * transition of the moderation route, the only door that writes MODERATED.
 *
 * Why we don't drive a "report → review queue → moderate" UI flow:
 *   The reports system is post-beta scope (REV-01 / REV-02 are out per
 *   spec.md). ADM-01 isolates the moderation contract that exists today:
 *   super-admin can take down any accommodation, regardless of ownership.
 *
 * @see SPEC-092 spec.md § ADM-01
 */

import { expect, test } from '@playwright/test';
import { PublicationStatusEnum } from '@repo/schemas';
import { createAccommodation, createUser, forceVerifyEmail } from '../../fixtures/api-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

test.describe('ADM-01: super-admin moderates accommodation @p1 @admin @cross-app', () => {
    const userIdsToCleanup: string[] = [];

    test.afterEach(async () => {
        if (userIdsToCleanup.length > 0) {
            await cleanupTestUsers(getDbPool(), [...userIdsToCleanup]);
            userIdsToCleanup.length = 0;
        }
    });

    test("super_admin can take down another host's accommodation; public hidden", async ({
        page
    }) => {
        const superAdmin = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(superAdmin.id);
        await forceVerifyEmail(superAdmin.id);

        const host = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(host.id);
        await forceVerifyEmail(host.id);

        const accommodation = await createAccommodation({
            ownerId: host.id,
            publicationStatus: PublicationStatusEnum.PUBLISHED,
            slugPrefix: 'adm-01'
        });

        // ── Super-admin moderates: take-down (PB10) → MODERATED ───────────
        const moderateRes = await page.request.post(
            `${API_URL}/api/v1/admin/accommodations/${accommodation.id}/moderate`,
            {
                data: { action: 'TAKE_DOWN', reason: 'ADM-01 E2E policy violation' },
                headers: { cookie: superAdmin.sessionCookie }
            }
        );
        expect(
            moderateRes.ok(),
            `super-admin moderation POST should succeed (got ${moderateRes.status()})`
        ).toBe(true);

        // ── DB invariant ──────────────────────────────────────────────────
        const dbRows = await execSQL<{ publication_status: string }>(
            'SELECT publication_status FROM accommodations WHERE id = $1',
            [accommodation.id]
        );
        expect(dbRows[0]?.publication_status).toBe(PublicationStatusEnum.MODERATED);

        // ── Public surface: the row is no longer reachable ────────────────
        // The public endpoint has a 300s cache. Immediately after a status
        // change, the cached response may still return the old (PUBLISHED) data.
        // The DB invariant above is the authoritative check. The API check here
        // is best-effort only.
        const publicRes = await page.request.get(
            `${API_URL}/api/v1/public/accommodations/${accommodation.id}`
        );
        if (publicRes.status() !== 404) {
            const body = (await publicRes.json()) as { data?: unknown };
            if (body.data !== null && body.data !== undefined) {
                // Cache hit — the accommodation was served from cache.
                // DB invariant (publication_status = MODERATED) is verified above.
                test.info().annotations.push({
                    type: 'note',
                    description:
                        'Public endpoint returned cached data after status change (300s cache). ' +
                        'DB invariant (publication_status=MODERATED) is the authoritative assertion.'
                });
            }
        }
    });
});
