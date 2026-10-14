/**
 * SEC-01 — Host A cannot reach Host B's accommodation.
 *
 * Actors: Host A (active) + Host B (active).
 * Tags: @p0 @security
 *
 * ## What this covers, and why it is `/protected/` and not `/admin/`
 *
 * Until HOS-1267 this spec attacked `/api/v1/admin/accommodations/:id` with a
 * host's cookie and accepted any of `[401, 403, 404]`. That green was
 * structurally inevitable: a HOST holds no `ACCESS_PANEL_ADMIN`, so the admin
 * tier's auth middleware short-circuits with 401 **before** any ownership check
 * runs. The same 401 comes back for a host's OWN accommodation, for a
 * non-existent uuid, and for Host B's — so the assertion could not tell
 * isolation working from isolation deleted. The file's own comment said as
 * much.
 *
 * The surface where cross-host isolation actually lives is the protected tier,
 * which is what the web host editor drives:
 *
 *   - `GET    /api/v1/protected/accommodations/:id` — ownership enforced in the
 *     route handler (`accommodation/protected/getById.ts`).
 *   - `PATCH  /api/v1/protected/accommodations/:id` — ownership enforced by the
 *     `ownership` middleware.
 *   - `POST   /api/v1/protected/accommodations/:id/purge` — PB12, the owner's
 *     delete (HOS-1477); `listingAccess` answers 404 for a foreign row.
 *
 * All three answer **404** for a foreign row, never 403: a 403 would confirm
 * the id exists, which is the leak the error contract bans
 * (`apps/api/docs/error-contract.md`, and the comment at
 * `apps/api/src/middlewares/ownership.ts:279`). So this spec asserts 404
 * EXACTLY rather than a set — a regression to 403 is a real finding here, and a
 * three-value set would swallow it.
 *
 * The retired owner door `DELETE /api/v1/protected/accommodations/:id` is also
 * tried, and must answer 404 because it no longer exists (HOS-1477, AC:V6:25).
 *
 * ## The control assertion
 *
 * `A reads its OWN accommodation → 200` runs first and is load-bearing. Without
 * it, a route that 404s for *everyone* — renamed, unmounted, broken — would
 * satisfy every other assertion in the file. The control is what separates
 * "B's row is denied to A" from "nothing is reachable at all".
 *
 * @see SPEC-092 spec.md § SEC-01
 * @see https://linear.app/hospeda-beta/issue/HOS-1267
 */

import { expect, test } from '@playwright/test';
import { PublicationStatusEnum } from '@repo/schemas';
import { createAccommodation, createUser, forceVerifyEmail } from '../../fixtures/api-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

/** The name Host A tries to write onto Host B's row. */
const HIJACK_NAME = 'HACKED BY A';

test.describe('SEC-01: cross-host isolation @p0 @security', () => {
    const userIds: string[] = [];

    test.afterEach(async () => {
        if (userIds.length > 0) {
            await cleanupTestUsers(getDbPool(), userIds);
            userIds.length = 0;
        }
    });

    test('Host A cannot GET/PATCH/DELETE Host B accommodation via /protected/; B unchanged', async ({
        page
    }) => {
        // ── Arrange: two hosts, one accommodation each ─────────────────────
        const hostA = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        await forceVerifyEmail(hostA.id);
        userIds.push(hostA.id);

        const hostB = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        await forceVerifyEmail(hostB.id);
        userIds.push(hostB.id);

        const accA = await createAccommodation({
            ownerId: hostA.id,
            publicationStatus: PublicationStatusEnum.PUBLISHED,
            slugPrefix: 'sec-01-a'
        });
        const accB = await createAccommodation({
            ownerId: hostB.id,
            publicationStatus: PublicationStatusEnum.PUBLISHED,
            slugPrefix: 'sec-01-b'
        });

        const asHostA = { cookie: hostA.sessionCookie };

        // ── Control: A reads its OWN row → 200 ─────────────────────────────
        // See the header: without this, a route that denies everyone would
        // pass every assertion below.
        const ownGet = await page.request.get(
            `${API_URL}/api/v1/protected/accommodations/${accA.id}`,
            { headers: asHostA }
        );
        expect(
            ownGet.status(),
            `CONTROL FAILED: Host A must be able to read its own accommodation through ` +
                `/protected/accommodations/:id. Got ${ownGet.status()}. Until this is 200 the ` +
                'isolation assertions below prove nothing — a route nobody can reach 404s for ' +
                'a foreign row too.'
        ).toBe(200);

        // ── 1. GET B's row as A → 404 (never 200, never 403) ───────────────
        const foreignGet = await page.request.get(
            `${API_URL}/api/v1/protected/accommodations/${accB.id}`,
            { headers: asHostA }
        );
        expect(
            foreignGet.status(),
            "Host A must not read Host B's accommodation. 404 is the contract: a 403 would " +
                'confirm the id exists (apps/api/docs/error-contract.md).'
        ).toBe(404);

        // ── 2. PATCH B's row as A → 404, and nothing is written ────────────
        const foreignPatch = await page.request.patch(
            `${API_URL}/api/v1/protected/accommodations/${accB.id}`,
            { data: { name: HIJACK_NAME }, headers: asHostA }
        );
        expect(
            foreignPatch.status(),
            "Host A must not patch Host B's accommodation (expected 404, the ownership " +
                "middleware's answer for a foreign row)."
        ).toBe(404);

        // ── 3. Purge B's row as A (PB12) → 404 ─────────────────────────────
        const foreignPurge = await page.request.post(
            `${API_URL}/api/v1/protected/accommodations/${accB.id}/purge`,
            { headers: asHostA }
        );
        expect(
            foreignPurge.status(),
            "Host A must not purge Host B's accommodation through PB12 (expected 404)."
        ).toBe(404);

        // ── 3b. The retired owner door → 404: it no longer exists ──────────
        const retiredDelete = await page.request.delete(
            `${API_URL}/api/v1/protected/accommodations/${accB.id}`,
            { headers: asHostA }
        );
        expect(
            retiredDelete.status(),
            'DELETE /protected/accommodations/:id was retired by HOS-1477 (expected 404).'
        ).toBe(404);

        // ── 4. DB invariant: B's row survived all the attempts ─────────────
        // The status assertions above say the API refused; these say nothing
        // reached the table anyway. Both are needed: a handler could answer 404
        // after having already written.
        const accBAfter = await execSQL<{
            name: string;
            deleted_at: Date | null;
            publication_status: string;
        }>('SELECT name, deleted_at, publication_status FROM accommodations WHERE id = $1', [
            accB.id
        ]);
        expect(accBAfter[0]?.name, "Host B's accommodation name must be untouched").not.toBe(
            HIJACK_NAME
        );
        expect(
            accBAfter[0]?.publication_status,
            "Host B's accommodation must not have been purged"
        ).not.toBe('PURGED');
        expect(
            accBAfter[0]?.deleted_at,
            "Host B's accommodation must not have been soft-deleted"
        ).toBeNull();

        // ── 5. B's own session still reads B's row → 200 ───────────────────
        // The mirror of the control: proves the refusals above were about WHO
        // asked, not about the row having been broken by the attempts.
        const ownerGet = await page.request.get(
            `${API_URL}/api/v1/protected/accommodations/${accB.id}`,
            { headers: { cookie: hostB.sessionCookie } }
        );
        expect(
            ownerGet.status(),
            'Host B must still be able to read its own accommodation after the attempts'
        ).toBe(200);

        // ── 6. No data leak in the refusal bodies ──────────────────────────
        for (const [label, response] of [
            ['GET', foreignGet],
            ['PATCH', foreignPatch],
            ['PURGE', foreignPurge],
            ['DELETE (retired)', retiredDelete]
        ] as const) {
            const body = await response.text();
            expect(body, `${label} refusal must not leak B's slug`).not.toContain(accB.slug);
            expect(body, `${label} refusal must not leak B's owner email`).not.toContain(
                hostB.email
            );
        }
    });
});
