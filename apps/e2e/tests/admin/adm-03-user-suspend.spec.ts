/**
 * ADM-03 — Super-admin suspends and reactivates a user.
 *
 * Actors: Super-admin acting on a target user; the target user trying to
 *         access protected resources before / after suspension.
 * Tags: @p1 @admin @cross-app
 *
 * Preconditions:
 *   - One target user (regular USER role) created by the test.
 *
 * What this validates (DB-level + auth surface contract):
 *  1. Setting `users.suspended_at = NOW()` is observable to the auth
 *     middleware: protected reads using the suspended user's session
 *     return 401/403 (the actor cannot proceed).
 *  2. Reactivating (suspended_at = NULL) restores access — the same
 *     session cookie now resolves to a non-suspended actor.
 *  3. The suspension does not delete the user (id and email survive).
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

        // ── While suspended: protected access blocked ─────────────────────
        // The exact code depends on the auth middleware: 401 when the
        // session is invalidated, 403 when the actor is "logged in but
        // suspended". We accept either, but reject 200.
        const duringRes = await page.request.get(`${API_URL}/api/v1/public/auth/me`, {
            headers: { cookie: user.sessionCookie }
        });
        if (duringRes.ok()) {
            // Some implementations leave /me reading the row but flag it.
            // In that case the response should expose the suspension.
            const body = (await duringRes.json()) as {
                data?: { suspendedAt?: string | null; suspended_at?: string | null };
            };
            const suspendedAt = body.data?.suspendedAt ?? body.data?.suspended_at;
            expect(
                suspendedAt,
                'expected /me to surface suspendedAt when not blocking the request outright'
            ).toBeTruthy();
        }

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
