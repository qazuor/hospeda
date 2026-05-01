/**
 * HOST-06 — Password reset flow.
 *
 * Actors: User (forgotten password) + Mailpit + Better Auth.
 * Tags: @p1 @host @auth
 *
 * Preconditions:
 *   - Mailpit reachable at port 8025.
 *   - Better Auth `/api/auth/forget-password` mounted.
 *
 * What this validates:
 *  1. POST `/api/auth/forget-password` for an existing email returns 2xx
 *     (the endpoint is intentionally vague to avoid email-enumeration —
 *     we accept any 2xx and rely on Mailpit to confirm delivery).
 *  2. A reset email arrives at Mailpit within the timeout window.
 *  3. The email body contains a reset link with a token query parameter.
 *  4. POST `/api/auth/reset-password` (Better Auth) with the token + new
 *     password returns 2xx.
 *  5. The user can sign in with the NEW password and is rejected with the
 *     OLD password.
 *
 * @see SPEC-092 spec.md § HOST-06
 */

import { expect, test } from '@playwright/test';
import { signupUser } from '../../fixtures/api-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { extractFirstLink, waitForEmail } from '../../fixtures/mailpit-client.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

test.describe('HOST-06: password reset flow @p1 @host @auth', () => {
    let userId: string | null = null;

    test.afterEach(async () => {
        if (userId) {
            await cleanupTestUsers(getDbPool(), [userId]);
        }
        userId = null;
    });

    test('forgot-password → reset email → new password works, old rejected', async () => {
        const user = await signupUser({}, { apiBaseUrl: API_URL });
        userId = user.id;

        // Force email verified so the reset flow does not stop at the
        // pre-condition check (HOST-06 isolates the password-reset surface,
        // not the email-verification path which HOST-01 covers).
        await execSQL(
            'UPDATE users SET email_verified_at = NOW(), email_verified = true WHERE id = $1',
            [user.id]
        );

        // ── 1. POST /api/auth/forget-password ─────────────────────────────
        const forgetRes = await fetch(`${API_URL}/api/auth/forget-password`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: user.email })
        });
        expect(
            forgetRes.status >= 200 && forgetRes.status < 300,
            `forget-password should return 2xx (got ${forgetRes.status})`
        ).toBe(true);

        // ── 2. Reset email arrives ───────────────────────────────────────
        const email = await waitForEmail({
            to: user.email,
            subject: /reset|recuperar|restablecer/i,
            timeoutMs: 10_000
        });

        // ── 3. Body contains a reset link with a token ────────────────────
        const link = extractFirstLink(email.HTML ?? email.Text ?? '');
        expect(link, 'reset email must include a link').not.toBeNull();
        const url = new URL(link as string);
        const token = url.searchParams.get('token') ?? url.searchParams.get('reset_token');
        expect(token, `reset link must carry a token (link=${link})`).not.toBeNull();

        // ── 4. POST /api/auth/reset-password with new password ────────────
        const newPassword = `New-${Date.now().toString(36)}-Aa1!`;
        const resetRes = await fetch(`${API_URL}/api/auth/reset-password`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ token, newPassword, password: newPassword })
        });
        // Better Auth's exact contract for this endpoint may return 200 or
        // 204; accept any 2xx.
        expect(
            resetRes.status >= 200 && resetRes.status < 300,
            `reset-password should return 2xx (got ${resetRes.status})`
        ).toBe(true);

        // ── 5. Sign in: new password OK, old password rejected ────────────
        const newSignInRes = await fetch(`${API_URL}/api/auth/sign-in/email`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: user.email, password: newPassword })
        });
        expect(
            newSignInRes.status >= 200 && newSignInRes.status < 300,
            `sign-in with new password should succeed (got ${newSignInRes.status})`
        ).toBe(true);

        const oldSignInRes = await fetch(`${API_URL}/api/auth/sign-in/email`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: user.email, password: user.password })
        });
        expect(
            oldSignInRes.status >= 400,
            `sign-in with old password should fail (got ${oldSignInRes.status})`
        ).toBe(true);
    });
});
