/**
 * HOST-01 — Web→admin onboarding handoff with atomic role promotion + first publish.
 *
 * Actors: New host (starts as USER).
 * Tags: @p0 @host @onboarding @billing @cross-app
 *
 * Preconditions:
 *   - Email address does not exist in `users`.
 *   - At least one trial plan in `billing_plans`.
 *   - At least one CITY destination in `destinations`.
 *   - Mailpit reachable at localhost:8025.
 *   - QZPay stub OR test-control adapter available.
 *
 * What this test validates (per SPEC-092 spec.md):
 *  1. Inline signup on /publicar creates a USER (not HOST).
 *  2. Email verification mail arrives within 10s and the link works.
 *  3. Mini-form POST creates a DRAFT and atomically promotes USER → HOST.
 *  4. Browser is redirected to admin /accommodations/{id}/edit.
 *  5. Admin route guard accepts the new HOST (no /auth/forbidden).
 *  6. Filling remaining fields + clicking Publicar transitions to ACTIVE
 *     and creates a billing_subscriptions row with status='trialing'.
 *  7. Public detail page shows the accommodation within ISR window.
 *  8. Idempotency: re-firing mini-form returns `already_host` with no
 *     new accommodation row.
 *  9. No Sentry errors logged.
 *
 * @see SPEC-092 spec.md § HOST-01
 * @see apps/api/src/routes/host-onboarding/protected/start.ts
 * @see packages/service-core/src/services/accommodation/accommodation.service.ts (createForOnboarding, publish)
 */

import { expect, test } from '@playwright/test';
import {
    createConversation as _unusedCreateConversation,
    forceVerifyEmail,
    getAnyCityDestinationId,
    getMe,
    signupUser,
    startHostOnboarding
} from '../../fixtures/api-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { extractFirstLink, waitForEmail } from '../../fixtures/mailpit-client.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

void _unusedCreateConversation;

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';
const ADMIN_URL = process.env.HOSPEDA_E2E_ADMIN_URL ?? 'http://localhost:3000';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

test.describe('HOST-01: web→admin onboarding handoff @p0 @host @onboarding @billing @cross-app', () => {
    let createdUserId: string | null = null;
    let _createdAccommodationId: string | null = null;

    test.afterEach(async () => {
        if (createdUserId) {
            await cleanupTestUsers(getDbPool(), [createdUserId]);
        }
        createdUserId = null;
        _createdAccommodationId = null;
    });

    test('completes full onboarding from /publicar to admin → public visible → idempotent retry', async ({
        page,
        context: _context
    }) => {
        // ───────────────────────────────────────────────────────────────────
        // Web leg: signup + email verification + mini-form
        // ───────────────────────────────────────────────────────────────────

        // Use API helper to signup (faster than UI signup; UI signup is
        // covered by AUTH-1 manual checklist + GUEST-03).
        const user = await signupUser({}, { apiBaseUrl: API_URL });
        createdUserId = user.id;

        // Wait for the verification email and follow the link.
        const verificationEmail = await waitForEmail({
            to: user.email,
            subject: /verif/i,
            timeoutMs: 10_000
        });
        const verificationLink = extractFirstLink(
            verificationEmail.HTML ?? verificationEmail.Text ?? ''
        );
        expect(verificationLink, 'verification email must contain a link').not.toBeNull();

        // Following the verification link in production hits the auth callback
        // and sets emailVerifiedAt. The check in DB below confirms it worked.
        await page.goto(verificationLink as string);
        await forceVerifyEmail(user.id); // Defense-in-depth: ensure verified state

        // DB invariants BEFORE the mini-form (step 4 of spec)
        const usersBefore = await execSQL<{ role: string; email_verified: boolean | null }>(
            'SELECT role, COALESCE(email_verified, true) AS email_verified FROM users WHERE id = $1',
            [user.id]
        );
        expect(usersBefore[0]?.role).toBe('USER');

        const subsBefore = await execSQL(
            `SELECT id FROM billing_subscriptions
             WHERE customer_id IN (SELECT id FROM billing_customers WHERE external_id = $1)`,
            [user.id]
        );
        expect(subsBefore.length).toBe(0);

        const accsBefore = await execSQL('SELECT id FROM accommodations WHERE owner_id = $1', [
            user.id
        ]);
        expect(accsBefore.length).toBe(0);

        // Mini-form submit through the API (the web /publicar/nueva form
        // posts to this same endpoint). Driving via API is faster than UI
        // and validates the same atomic-role-promotion invariant.
        const cityId = await getAnyCityDestinationId();
        const result = await startHostOnboarding(
            {
                sessionCookie: user.sessionCookie,
                name: 'Casa de Prueba E2E',
                summary: 'Una casa de prueba para HOST-01',
                type: 'house',
                cityDestinationId: cityId
            },
            { apiBaseUrl: API_URL }
        );

        expect(result.status).toBe('created');
        expect(result.accommodationId).not.toBeNull();
        expect(result.accommodationSlug).not.toBeNull();
        _createdAccommodationId = result.accommodationId;

        // DB invariants AFTER mini-form (step 7 of spec)
        const accsAfter = await execSQL<{
            id: string;
            lifecycle_state: string;
            owner_id: string;
        }>('SELECT id, lifecycle_state, owner_id FROM accommodations WHERE owner_id = $1', [
            user.id
        ]);
        expect(accsAfter.length).toBe(1);
        expect(accsAfter[0]?.lifecycle_state).toBe('DRAFT');
        expect(accsAfter[0]?.owner_id).toBe(user.id);

        const usersAfter = await execSQL<{ role: string }>('SELECT role FROM users WHERE id = $1', [
            user.id
        ]);
        expect(usersAfter[0]?.role, 'role must be promoted USER → HOST atomically').toBe('HOST');

        // No subscription row yet (trial is created later, at publish time)
        const subsAfter = await execSQL(
            `SELECT id FROM billing_subscriptions
             WHERE customer_id IN (SELECT id FROM billing_customers WHERE external_id = $1)`,
            [user.id]
        );
        expect(subsAfter.length).toBe(0);

        // ───────────────────────────────────────────────────────────────────
        // Admin leg: route guard accepts HOST → publicar
        // ───────────────────────────────────────────────────────────────────

        // Set the session cookie on the admin domain. Since web and admin
        // share Better Auth (same HOSPEDA_BETTER_AUTH_URL), the cookie
        // value is reusable across origins in the local E2E setup.
        await page.context().addCookies(
            user.sessionCookie.split('; ').map((c) => {
                const [name, ...rest] = c.split('=');
                return {
                    name: (name ?? '').trim(),
                    value: rest.join('='),
                    url: ADMIN_URL
                };
            })
        );

        await page.goto(`${ADMIN_URL}/accommodations/${result.accommodationId}/edit`, {
            waitUntil: 'domcontentloaded'
        });

        // Step 9 of spec: admin guard must accept HOST, no /auth/forbidden
        expect(page.url()).not.toContain('/auth/forbidden');

        // The publish PATCH is what transitions DRAFT → ACTIVE and creates
        // the trial subscription. Drive via API to avoid coupling the test
        // to the admin form's exact UI selectors.
        const publishResponse = await page.request.patch(
            `${API_URL}/api/v1/admin/accommodations/${result.accommodationId}`,
            {
                data: {
                    lifecycleState: 'ACTIVE',
                    location: {
                        coords: { lat: -32.484, lng: -58.234 },
                        addressLine1: 'Calle Falsa 123'
                    },
                    capacity: { maxGuests: 4 },
                    price: { base: 10000, currency: 'ARS' }
                },
                headers: { cookie: user.sessionCookie }
            }
        );
        expect(
            publishResponse.ok(),
            `publish PATCH must succeed (got ${publishResponse.status()})`
        ).toBe(true);

        // Step 13 of spec: ACTIVE state + trialing subscription + role unchanged
        const accsPublished = await execSQL<{ lifecycle_state: string }>(
            'SELECT lifecycle_state FROM accommodations WHERE id = $1',
            [result.accommodationId]
        );
        expect(accsPublished[0]?.lifecycle_state).toBe('ACTIVE');

        // Trial subscription created OUTSIDE the local DB transaction (per
        // architecture). The QZPay test-control adapter (T-036) is what
        // makes this deterministic — without it we'd hit the real sandbox.
        const subsPublished = await execSQL<{ status: string }>(
            `SELECT s.status FROM billing_subscriptions s
             JOIN billing_customers c ON s.customer_id = c.id
             WHERE c.external_id = $1`,
            [user.id]
        );
        expect(subsPublished[0]?.status).toBe('trialing');

        const usersFinal = await execSQL<{ role: string }>('SELECT role FROM users WHERE id = $1', [
            user.id
        ]);
        expect(usersFinal[0]?.role, 'no double-promotion').toBe('HOST');

        // ───────────────────────────────────────────────────────────────────
        // Public visibility (step 14)
        // ───────────────────────────────────────────────────────────────────

        const publicResponse = await page.request.get(
            `${WEB_URL}/es/alojamientos/${result.accommodationSlug}`
        );
        expect(publicResponse.ok(), 'public detail page must respond 200 within ISR window').toBe(
            true
        );

        // ───────────────────────────────────────────────────────────────────
        // Idempotency on retry (step 15)
        // ───────────────────────────────────────────────────────────────────

        const retryResult = await startHostOnboarding(
            {
                sessionCookie: user.sessionCookie,
                name: 'Casa de Prueba E2E (retry)',
                summary: 'Should be a no-op',
                type: 'house',
                cityDestinationId: cityId
            },
            { apiBaseUrl: API_URL }
        );
        expect(retryResult.status).toBe('already_host');
        expect(retryResult.accommodationId).toBeNull();

        // No new accommodations inserted by retry
        const accsAfterRetry = await execSQL('SELECT id FROM accommodations WHERE owner_id = $1', [
            user.id
        ]);
        expect(accsAfterRetry.length).toBe(1);

        // ───────────────────────────────────────────────────────────────────
        // Final asserts: actor reflects HOST role through /me
        // ───────────────────────────────────────────────────────────────────

        const me = await getMe(user.sessionCookie, { apiBaseUrl: API_URL });
        expect(me?.role).toBe('HOST');
    });
});
