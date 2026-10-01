/**
 * E2E-5 — A profile edit made on the web is visible to the admin panel.
 *
 * Actors: an authenticated USER editing their own profile, plus a SUPER_ADMIN
 *         reading that same user through the admin tier.
 * Tags: @p0 @guest @cross-app
 *
 * ## What HOS-1267 changed
 *
 * The JSDoc promised "GET /me returns the new firstName". The code asserted
 * `expect(me).not.toBeNull()` and never touched the admin at all, so the only
 * surviving assertion was on the DB row the PATCH had just written — a test of
 * `UPDATE`, not of the cross-app propagation the file is named after.
 *
 * The docblock's promise was also unsatisfiable as written: `/auth/me` responds
 * with `AuthMeResponseSchema`, whose actor carries `name` (Better Auth's alias
 * for `users.display_name`) and has **no `firstName` field at all**.
 *
 * This version asserts the same edit through both consumers' own read
 * endpoints, each anchored against a baseline captured BEFORE the PATCH so a
 * pre-existing value cannot pass for propagation:
 *
 *  1. **Web side** — `GET /api/v1/protected/users/:id`, the endpoint the web
 *     account pages read back (`UserSelfSchema`, which carries `firstName` and
 *     `displayName`).
 *  2. **Admin side** — `GET /api/v1/admin/users/:id` read with a SUPER_ADMIN
 *     session (`UserAdminSchema`). This is the "→ admin" half, and nothing in
 *     the file exercised it before.
 *
 * ### Do not add an assertion on `/auth/me`'s `actor.name` here
 *
 * Measured on 2026-09-21 against this suite: after the PATCH below writes
 * `users.display_name`, the row is correct immediately, and `/auth/me` keeps
 * reporting the PREVIOUS name — `actor.name` is forwarded from Better Auth's
 * session user (`apps/api/src/middlewares/actor.ts`), which is served from its
 * session cache rather than re-read per request. Asserting on it here would
 * make this spec fail for a reason that has nothing to do with cross-app
 * propagation. The staleness itself is worth its own issue, not a flaky p0.
 *
 * @see SPEC-092 spec.md § E2E-5
 * @see https://linear.app/hospeda-beta/issue/HOS-1267
 */

import { expect, test } from '@playwright/test';
import { createUser, forceVerifyEmail } from '../../fixtures/api-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';
const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';

/** The slice of a user read this spec asserts on. */
interface UserEnvelope {
    readonly data?: {
        readonly firstName?: string | null;
        readonly displayName?: string | null;
    } | null;
}

test.describe('E2E-5: profile edit web → admin reflects @p0 @guest @cross-app', () => {
    const userIds: string[] = [];

    test.afterEach(async () => {
        if (userIds.length > 0) {
            await cleanupTestUsers(getDbPool(), userIds);
            userIds.length = 0;
        }
    });

    test('PATCH /protected/users/:id is visible to both the web read-back and the admin read', async ({
        page
    }) => {
        // ── Arrange ────────────────────────────────────────────────────────
        const user = await createUser({ role: 'USER' }, { apiBaseUrl: API_URL });
        userIds.push(user.id);
        await forceVerifyEmail(user.id);

        const superAdmin = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
        userIds.push(superAdmin.id);
        await forceVerifyEmail(superAdmin.id);

        const stamp = Date.now().toString(36);
        const newFirstName = `E2E5First${stamp}`;
        const newDisplayName = `E2E5Display${stamp}`;

        // Better Auth's CSRF guard inspects Origin on session reads.
        const asUser = { cookie: user.sessionCookie, Origin: WEB_URL };
        const asAdmin = { cookie: superAdmin.sessionCookie, Origin: WEB_URL };

        const webUrl = `${API_URL}/api/v1/protected/users/${user.id}`;
        const adminUrl = `${API_URL}/api/v1/admin/users/${user.id}`;

        // ── Controls + baseline, BEFORE the edit ───────────────────────────
        // Both reads must already work, and must NOT already hold the values we
        // are about to write. Without this pair, a route that always answered
        // with the new value — or one nobody could reach — would be
        // indistinguishable from real propagation.
        const webBefore = await page.request.get(webUrl, { headers: asUser });
        expect(
            webBefore.status(),
            `CONTROL FAILED: the user must be able to read their own profile back through ` +
                `/protected/users/:id before the edit. Got ${webBefore.status()}.`
        ).toBe(200);
        const firstNameBeforeWeb = ((await webBefore.json()) as UserEnvelope).data?.firstName;

        const adminBefore = await page.request.get(adminUrl, { headers: asAdmin });
        expect(
            adminBefore.status(),
            `CONTROL FAILED: the SUPER_ADMIN must be able to read this user through the admin ` +
                `tier before the edit. Got ${adminBefore.status()}.`
        ).toBe(200);
        const firstNameBeforeAdmin = ((await adminBefore.json()) as UserEnvelope).data?.firstName;

        expect(
            firstNameBeforeWeb,
            'baseline firstName must differ from the value under test, or the assertions below prove nothing'
        ).not.toBe(newFirstName);
        expect(firstNameBeforeAdmin, 'both tiers must start from the same baseline').toBe(
            firstNameBeforeWeb
        );

        // ── Act: the same PATCH the web app's /mi-cuenta/perfil drives ─────
        const patchRes = await page.request.patch(webUrl, {
            data: { firstName: newFirstName, displayName: newDisplayName },
            headers: asUser
        });
        expect(
            patchRes.ok(),
            `profile patch should succeed (got ${patchRes.status()}: ${await patchRes.text()})`
        ).toBe(true);

        // ── Assert 1 (web): the account page's own read-back ───────────────
        const webAfter = await page.request.get(webUrl, { headers: asUser });
        expect(webAfter.status(), 'web read-back must still succeed after the edit').toBe(200);
        const webBody = (await webAfter.json()) as UserEnvelope;
        expect(
            webBody.data?.firstName,
            'GET /api/v1/protected/users/:id must return the firstName just written'
        ).toBe(newFirstName);
        expect(
            webBody.data?.displayName,
            'GET /api/v1/protected/users/:id must return the displayName just written'
        ).toBe(newDisplayName);

        // ── Assert 2 (admin): what the admin panel reads ───────────────────
        // The "→ admin" half of the file's name. Nothing exercised it before.
        const adminAfter = await page.request.get(adminUrl, { headers: asAdmin });
        expect(adminAfter.status(), 'admin read must still succeed after the edit').toBe(200);
        expect(
            ((await adminAfter.json()) as UserEnvelope).data?.firstName,
            'GET /api/v1/admin/users/:id — the endpoint the admin panel reads — must return the ' +
                'firstName the user set from the web'
        ).toBe(newFirstName);

        // ── Assert 3 (storage): the row itself ─────────────────────────────
        const rows = await execSQL<{ first_name: string | null; display_name: string | null }>(
            'SELECT first_name, display_name FROM users WHERE id = $1',
            [user.id]
        );
        expect(rows[0]?.first_name).toBe(newFirstName);
        expect(rows[0]?.display_name).toBe(newDisplayName);
    });
});
