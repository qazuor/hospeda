/**
 * E2E-2 — Signup → onboarding → publish → mi-cuenta/propiedades visible.
 *
 * Actors: New user going through the full host onboarding flow.
 * Tags: @p0 @host @onboarding @cross-app
 *
 * Preconditions:
 *   - At least one CITY destination in seed.
 *   - Mailpit reachable (verification email).
 *
 * What this validates (cross-app handoff contract, slimmer than HOST-01):
 *  1. Signup + email verify produces a USER row.
 *  2. POST host-onboarding/start creates a DRAFT and atomically promotes
 *     USER → HOST.
 *  3. The protected accommodations list (`/api/v1/protected/accommodations`)
 *     — the same endpoint /mi-cuenta/propiedades reads — returns the new
 *     accommodation for the host.
 *  4. /me reflects the HOST role.
 *
 * Why this is separate from HOST-01:
 *   HOST-01 covers the full UI-driven flow including admin redirect,
 *   first publish, billing trial creation, and idempotency. E2E-2
 *   isolates the *cross-app handoff visibility* contract: after the
 *   protected APIs the web app calls, what does the user see?
 *
 * @see SPEC-092 spec.md § E2E-2
 */

import { expect, test } from '@playwright/test';
import {
    forceVerifyEmail,
    getAnyCityDestinationId,
    getMe,
    refreshSession,
    signupUser,
    startHostOnboarding
} from '../../fixtures/api-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

test.describe('E2E-2: signup → onboarding → /mi-cuenta visible @p0 @host @onboarding @cross-app', () => {
    let userId: string | null = null;

    test.afterEach(async () => {
        if (userId) {
            await cleanupTestUsers(getDbPool(), [userId]);
        }
        userId = null;
    });

    test('full handoff: signup → onboarding → protected list shows new accommodation', async ({
        page
    }) => {
        const user = await signupUser({}, { apiBaseUrl: API_URL });
        userId = user.id;
        await forceVerifyEmail(user.id);

        const cityId = await getAnyCityDestinationId();
        const result = await startHostOnboarding(
            {
                sessionCookie: user.sessionCookie,
                name: 'E2E-2 Casa',
                summary: 'Acceptance test for E2E-2 cross-app handoff',
                type: 'house',
                cityDestinationId: cityId
            },
            { apiBaseUrl: API_URL }
        );
        expect(result.status).toBe('created');
        expect(result.accommodationId).not.toBeNull();

        // Better Auth caches the session for up to 300s. After startHostOnboarding
        // promotes USER → HOST in the DB, the old session still reflects USER.
        // Refresh to get a cookie with the current role.
        const hostSessionCookie = await refreshSession(user, { apiBaseUrl: API_URL });

        // /me reflects HOST role.
        const me = await getMe(hostSessionCookie, { apiBaseUrl: API_URL });
        expect(me?.role).toBe('HOST');

        // Protected list — the endpoint /mi-cuenta/propiedades drives —
        // includes the new accommodation.
        const listRes = await page.request.get(
            `${API_URL}/api/v1/protected/accommodations?pageSize=50`,
            { headers: { cookie: hostSessionCookie } }
        );
        expect(listRes.ok(), `protected list should be 200 (got ${listRes.status()})`).toBe(true);
        // The list endpoint uses createListRoute which returns { data: { items: [...], pagination } }.
        const listBody = (await listRes.json()) as {
            data?: {
                items?: ReadonlyArray<{ id: string; ownerId?: string }>;
                pagination?: unknown;
            };
        };
        const ids = listBody.data?.items?.map((row) => row.id) ?? [];
        expect(
            ids.includes(result.accommodationId as string),
            `protected list should include the new accommodation ${result.accommodationId}`
        ).toBe(true);

        // DB invariant: one accommodation owned by the new host.
        const accs = await execSQL<{ id: string; lifecycle_state: string }>(
            'SELECT id, lifecycle_state FROM accommodations WHERE owner_id = $1',
            [user.id]
        );
        expect(accs.length).toBe(1);
        expect(accs[0]?.lifecycle_state).toBe('DRAFT');
    });
});
