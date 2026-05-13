/**
 * NL-02 — Newsletter verify endpoint redirects.
 *
 * Actors: New subscriber clicking the email confirmation link.
 * Tags: @p1 @newsletter
 *
 * Preconditions:
 *   - API reachable at HOSPEDA_E2E_API_URL.
 *   - Web app reachable at HOSPEDA_E2E_WEB_URL (verify redirects land there).
 *   - HOSPEDA_E2E_NEWSLETTER_HMAC_SECRET set to the same secret the API
 *     boots with (otherwise we cannot mint valid tokens). Falls back to
 *     HOSPEDA_NEWSLETTER_HMAC_SECRET so a single env var works for both.
 *
 * Validates:
 *   - GET /api/v1/public/newsletter/verify?token=<valid> 302s to
 *     /{locale}/newsletter/confirmado/.
 *   - GET with an expired token 302s to /newsletter/error/?reason=token_expired.
 *   - GET with a structurally invalid token 302s to
 *     /newsletter/error/?reason=invalid_token.
 *
 * @see SPEC-101 US-101-04
 */

import { expect, test } from '@playwright/test';
import { generateVerificationToken } from '@repo/service-core';
import { execSQL } from '../../fixtures/db-helpers.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

// 72h TTL is the production default. To force an expired token we backdate
// the issuedAt timestamp well past that window.
const EXPIRED_ISSUED_AT = new Date('2020-01-01T00:00:00Z');

function getNewsletterSecret(): string {
    return (
        process.env.HOSPEDA_E2E_NEWSLETTER_HMAC_SECRET ??
        process.env.HOSPEDA_NEWSLETTER_HMAC_SECRET ??
        ''
    );
}

test.describe('NL-02: newsletter verify-flow redirects @p1 @newsletter', () => {
    let subscriberId: string | null = null;

    test.beforeAll(() => {
        const secret = getNewsletterSecret();
        if (!secret) {
            throw new Error(
                'NL-02 requires HOSPEDA_E2E_NEWSLETTER_HMAC_SECRET or HOSPEDA_NEWSLETTER_HMAC_SECRET to be set.'
            );
        }
    });

    test.afterEach(async () => {
        if (subscriberId) {
            await execSQL('DELETE FROM newsletter_subscribers WHERE id = $1', [subscriberId]).catch(
                () => undefined
            );
            subscriberId = null;
        }
    });

    test('valid token redirects to /es/newsletter/confirmado/', async ({ page }) => {
        // Seed a pending_verification subscriber directly in DB.
        const email = `e2e-verify-${Date.now()}@hospeda-test.local`;
        const rows = await execSQL<{ id: string }>(
            `INSERT INTO newsletter_subscribers (email, status, locale, created_at, updated_at)
             VALUES ($1, 'pending_verification', 'es', NOW(), NOW())
             RETURNING id`,
            [email]
        );
        subscriberId = rows[0]?.id ?? null;
        expect(subscriberId).not.toBeNull();

        const token = generateVerificationToken({
            subscriberId: subscriberId as string,
            channel: 'email',
            secret: getNewsletterSecret()
        });

        const response = await page.request.get(
            `${API_URL}/api/v1/public/newsletter/verify?token=${encodeURIComponent(token)}&locale=es`,
            { maxRedirects: 0 }
        );

        expect(response.status()).toBe(302);
        const location = response.headers().location ?? '';
        expect(location).toContain('/es/newsletter/confirmado/');

        // DB invariant: subscriber transitioned to 'active'.
        const updated = await execSQL<{ status: string }>(
            'SELECT status FROM newsletter_subscribers WHERE id = $1',
            [subscriberId as string]
        );
        expect(updated[0]?.status).toBe('active');
    });

    test('expired token redirects to error page with reason=token_expired', async ({ page }) => {
        const email = `e2e-verify-exp-${Date.now()}@hospeda-test.local`;
        const rows = await execSQL<{ id: string }>(
            `INSERT INTO newsletter_subscribers (email, status, locale, created_at, updated_at)
             VALUES ($1, 'pending_verification', 'es', NOW(), NOW())
             RETURNING id`,
            [email]
        );
        subscriberId = rows[0]?.id ?? null;
        expect(subscriberId).not.toBeNull();

        const token = generateVerificationToken({
            subscriberId: subscriberId as string,
            channel: 'email',
            secret: getNewsletterSecret(),
            issuedAt: EXPIRED_ISSUED_AT
        });

        const response = await page.request.get(
            `${API_URL}/api/v1/public/newsletter/verify?token=${encodeURIComponent(token)}&locale=es`,
            { maxRedirects: 0 }
        );

        expect(response.status()).toBe(302);
        const location = response.headers().location ?? '';
        expect(location).toContain('/es/newsletter/error/');
        expect(location).toContain('reason=token_expired');
    });

    test('invalid token redirects to error page with reason=invalid_token', async ({ page }) => {
        const response = await page.request.get(
            `${API_URL}/api/v1/public/newsletter/verify?token=not-a-real-token&locale=es`,
            { maxRedirects: 0 }
        );

        expect(response.status()).toBe(302);
        const location = response.headers().location ?? '';
        expect(location).toContain('/es/newsletter/error/');
        expect(location).toContain('reason=invalid_token');
    });
});
