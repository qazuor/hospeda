/**
 * NL-01 — Newsletter subscription flow (authenticated + guest paths).
 *
 * Actors: Authenticated user, guest visitor.
 * Tags: @p1 @newsletter
 *
 * Preconditions:
 *   - Web app reachable at HOSPEDA_E2E_WEB_URL.
 *   - API reachable at HOSPEDA_E2E_API_URL.
 *   - HOSPEDA_NEWSLETTER_HMAC_SECRET configured on the API.
 *
 * Validates:
 *   - Authenticated submission via POST /api/v1/protected/newsletter/subscribe
 *     creates a newsletter_subscribers row with status='pending_verification'.
 *   - Guest submission via the same endpoint without a session is rejected
 *     with 401 (the web app surfaces a login popover instead of sending).
 *   - The footer NewsletterForm renders on the public landing page.
 *
 * @see SPEC-101 US-101-01, US-101-02
 */

import { expect, test } from '@playwright/test';
import { forceVerifyEmail, signupUser } from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';
const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';

test.describe('NL-01: newsletter subscribe flow @p1 @newsletter', () => {
    let userId: string | null = null;
    const createdEmails: string[] = [];

    test.beforeEach(async ({ page }) => {
        await seedCookieConsent(page);
    });

    test.afterEach(async () => {
        if (userId) {
            await cleanupTestUsers(getDbPool(), [userId]);
            userId = null;
        }
        for (const email of createdEmails) {
            await execSQL('DELETE FROM newsletter_subscribers WHERE email = $1', [email]).catch(
                () => undefined
            );
        }
        createdEmails.length = 0;
    });

    test('authenticated user can subscribe — DB row created in pending_verification', async ({
        page
    }) => {
        // ── 1. Setup authenticated user ────────────────────────────────────
        const user = await signupUser({}, { apiBaseUrl: API_URL });
        userId = user.id;
        await forceVerifyEmail(user.id);
        createdEmails.push(user.email);

        // ── 2. Submit subscribe request via protected endpoint ─────────────
        const response = await page.request.post(
            `${API_URL}/api/v1/protected/newsletter/subscribe`,
            {
                data: { email: user.email, locale: 'es' },
                headers: { cookie: user.sessionCookie }
            }
        );

        expect([200, 201].includes(response.status())).toBe(true);

        // ── 3. DB invariant: subscriber row created in pending_verification ─
        const rows = await execSQL<{ id: string; status: string }>(
            'SELECT id, status FROM newsletter_subscribers WHERE email = $1 LIMIT 1',
            [user.email]
        );
        expect(rows.length).toBe(1);
        expect(rows[0]?.status).toBe('pending_verification');
    });

    test('guest user gets 401 from protected subscribe endpoint', async ({ page }) => {
        // No auth cookie attached — the web app surfaces a login popover for
        // this case; the API itself returns 401 because the endpoint is
        // mounted under /protected/.
        const ghostEmail = `e2e-guest-${Date.now()}@hospeda-test.local`;
        const response = await page.request.post(
            `${API_URL}/api/v1/protected/newsletter/subscribe`,
            {
                data: { email: ghostEmail, locale: 'es' }
            }
        );
        expect(response.status()).toBe(401);

        // No DB row written for the ghost email.
        const rows = await execSQL<{ id: string }>(
            'SELECT id FROM newsletter_subscribers WHERE email = $1',
            [ghostEmail]
        );
        expect(rows.length).toBe(0);
    });

    test('footer renders newsletter form on the public web page', async ({ page }) => {
        await page.goto(`${WEB_URL}/`);
        // The NewsletterForm island lives in the footer — assert the email
        // input is present. The exact label depends on i18n; we match the
        // input by type/name pattern to keep the assertion locale-agnostic.
        const emailInput = page
            .locator('footer input[type="email"], footer input[name*="email" i]')
            .first();
        await expect(emailInput).toBeVisible();
    });
});
