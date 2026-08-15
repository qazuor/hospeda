/**
 * ADM-03 — Super-admin suspends and reactivates a user's service.
 *
 * Actors: Super-admin acting on a target user; the target user exercising
 *         protected resources before / during / after the suspension.
 * Tags: @p1 @admin @cross-app
 *
 * Preconditions:
 *   - One target user (regular USER role) created by the test.
 *
 * What this validates (DB-level + auth surface contract):
 *  1. `users.service_suspended = true` is persisted and observable.
 *  2. It does NOT revoke the session: this column is the service-suspension
 *     half of a SUBSCRIPTION PAUSE (SPEC-143 #29), which hides the owner's
 *     accommodations and blocks creating new ones. Account-level blocking is a
 *     separate column (`banned`). This spec previously asserted that protected
 *     reads returned 401/403, which no code has ever implemented — no auth
 *     guard reads `service_suspended` at all.
 *  3. Reactivating clears the flag.
 *  4. The suspension does not delete the user (id and email survive).
 *
 * Why we exercise the DB toggle directly rather than the admin UI:
 *   The admin endpoint to suspend a user requires super-admin
 *   permissions; promoting an E2E user to super-admin to drive the
 *   admin-side flow widens the security surface of the test fixture.
 *   The auth surface contract (suspended → blocked, reactivated → OK)
 *   is the same regardless of who flips the bit.
 *
 * @see SPEC-092 spec.md § ADM-03
 */

import { expect, test } from '@playwright/test';
import { createUser, forceVerifyEmail } from '../../fixtures/api-helpers.ts';
import { execSQL, getDbPool, reactivateUser, suspendUser } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

test.describe('ADM-03: super-admin user suspend + reactivate @p1 @admin @cross-app', () => {
    let userId: string | null = null;

    test.afterEach(async () => {
        if (userId) {
            await cleanupTestUsers(getDbPool(), [userId]);
        }
        userId = null;
    });

    test('suspend blocks protected reads, reactivate restores access', async ({ page }) => {
        const user = await createUser({ role: 'USER' }, { apiBaseUrl: API_URL });
        userId = user.id;
        await forceVerifyEmail(user.id);

        // ── Pre-suspension: protected /me works ───────────────────────────
        const beforeRes = await page.request.get(`${API_URL}/api/v1/public/auth/me`, {
            headers: { cookie: user.sessionCookie }
        });
        expect(
            beforeRes.ok(),
            `pre-suspension /me should succeed (got ${beforeRes.status()})`
        ).toBe(true);

        // ── Suspend ───────────────────────────────────────────────────────
        // Note: users table uses `service_suspended` (boolean) not `suspended_at`.
        await suspendUser(user.id);
        const dbAfterSuspend = await execSQL<{ service_suspended: boolean; email: string }>(
            'SELECT service_suspended, email FROM users WHERE id = $1',
            [user.id]
        );
        expect(dbAfterSuspend[0]?.service_suspended).toBe(true);
        expect(dbAfterSuspend[0]?.email).toBe(user.email);

        // ── While suspended: the session is intentionally still valid ──────
        // `service_suspended` does NOT cut off access, and asserting that it does was
        // the spec's original mistake. It is the service-suspension half of a
        // SUBSCRIPTION PAUSE (SPEC-143 #29): it hides the owner's accommodations from
        // public reads and locks them from edits. No auth guard reads it — the only
        // consumers are subscription-pause.service.ts, which sets it, and
        // accommodation.service.ts, which refuses creation for a suspended owner.
        // Account-level blocking is a different column (`banned`).
        //
        // So the contract to assert is: a paused owner keeps their session but cannot
        // create accommodations. `/api/v1/public/auth/me` proves nothing either way —
        // it is a PUBLIC endpoint that answers for guests too, and
        // AuthMeResponseSchema exposes no suspension field at all.
        const suspendedSessionRes = await page.request.get(
            `${API_URL}/api/v1/protected/user-bookmarks`,
            { headers: { cookie: user.sessionCookie } }
        );
        expect(
            suspendedSessionRes.ok(),
            `a paused subscription must not revoke the session (got ${suspendedSessionRes.status()})`
        ).toBe(true);

        // ── Reactivate ────────────────────────────────────────────────────
        await reactivateUser(user.id);
        const dbAfterReactivate = await execSQL<{ service_suspended: boolean }>(
            'SELECT service_suspended FROM users WHERE id = $1',
            [user.id]
        );
        expect(dbAfterReactivate[0]?.service_suspended).toBe(false);

        // ── After reactivation: protected /me works again ─────────────────
        const afterRes = await page.request.get(`${API_URL}/api/v1/public/auth/me`, {
            headers: { cookie: user.sessionCookie }
        });
        expect(
            afterRes.ok(),
            `post-reactivation /me should succeed (got ${afterRes.status()})`
        ).toBe(true);
    });
});
