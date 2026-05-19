/**
 * HOST-06b — Reset-password token check endpoint (SPEC-118).
 *
 * Actors: User (forgotten password) + Mailpit + Better Auth +
 *         Hospeda public auth API.
 * Tags: @p1 @host @auth @spec-118
 *
 * Preconditions:
 *   - Mailpit reachable at port 8025.
 *   - Better Auth `/api/auth/forget-password` mounted.
 *   - SPEC-118 endpoint `/api/v1/public/auth/reset-password/check` mounted.
 *
 * What this validates:
 *  1. A fresh, unconsumed reset token: check returns `{ valid: true }`.
 *  2. After consuming the token via `POST /api/auth/reset-password`, the
 *     check returns `{ valid: false, reason: 'invalid' }` (per the Phase 0
 *     decision that used-vs-unknown collapse to a single `invalid` reason).
 *  3. A hand-tampered token returns `{ valid: false, reason: 'invalid' }`.
 *  4. The endpoint rejects an empty `?token=` with HTTP 400 (Zod validation).
 *
 * The HOST-06 sibling spec covers the rest of the happy path
 * (sign-in with new password, sign-in rejected with old password); this
 * spec focuses on the check endpoint surface introduced by SPEC-118.
 *
 * @see SPEC-118
 */

import { expect, test } from '@playwright/test';
import { signupUser } from '../../fixtures/api-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { extractFirstLink, waitForEmail } from '../../fixtures/mailpit-client.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';
const CHECK_URL = `${API_URL}/api/v1/public/auth/reset-password/check`;

const tamperToken = (token: string): string => {
    // Flip the first character of the token deterministically so the resulting
    // value is the same length but won't match any row in `verifications`.
    const first = token[0];
    const replacement = first === 'a' ? 'b' : 'a';
    return replacement + token.slice(1);
};

test.describe('HOST-06b: reset-password token check (SPEC-118) @p1 @host @auth @spec-118', () => {
    let userId: string | null = null;

    test.afterEach(async () => {
        if (userId) {
            await cleanupTestUsers(getDbPool(), [userId]);
        }
        userId = null;
    });

    test('check returns valid:true for a fresh token, invalid after consume, invalid for tampered', async () => {
        const user = await signupUser({}, { apiBaseUrl: API_URL });
        userId = user.id;

        // Force email verified — HOST-01 covers the verification path.
        await execSQL(
            'UPDATE users SET email_verified_at = NOW(), email_verified = true WHERE id = $1',
            [user.id]
        );

        // ── 1. Trigger forget-password ────────────────────────────────────
        const forgetRes = await fetch(`${API_URL}/api/auth/forget-password`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: user.email })
        });
        expect(
            forgetRes.status >= 200 && forgetRes.status < 300,
            `forget-password should return 2xx (got ${forgetRes.status})`
        ).toBe(true);

        // ── 2. Extract token from the reset email ─────────────────────────
        const email = await waitForEmail({
            to: user.email,
            subject: /reset|recuperar|restablecer/i,
            timeoutMs: 10_000
        });
        const link = extractFirstLink(email.HTML ?? email.Text ?? '');
        expect(link).not.toBeNull();
        const token = new URL(link as string).searchParams.get('token');
        expect(token, 'reset link must carry a token').not.toBeNull();
        const validToken = token as string;

        // ── 3. Fresh token → valid:true ───────────────────────────────────
        const freshRes = await fetch(`${CHECK_URL}?token=${encodeURIComponent(validToken)}`, {
            method: 'GET'
        });
        expect(freshRes.status).toBe(200);
        const freshBody = (await freshRes.json()) as {
            data: { valid: boolean; reason?: string };
        };
        expect(freshBody.data).toEqual({ valid: true });

        // ── 4. Tampered token → invalid ───────────────────────────────────
        const tamperedRes = await fetch(
            `${CHECK_URL}?token=${encodeURIComponent(tamperToken(validToken))}`,
            { method: 'GET' }
        );
        expect(tamperedRes.status).toBe(200);
        const tamperedBody = (await tamperedRes.json()) as {
            data: { valid: boolean; reason?: string };
        };
        expect(tamperedBody.data).toEqual({ valid: false, reason: 'invalid' });

        // ── 5. Consume the real token via the Better Auth reset endpoint ──
        const newPassword = `New-${Date.now().toString(36)}-Aa1!`;
        const consumeRes = await fetch(`${API_URL}/api/auth/reset-password`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ token: validToken, newPassword, password: newPassword })
        });
        expect(
            consumeRes.status >= 200 && consumeRes.status < 300,
            `reset-password consume should return 2xx (got ${consumeRes.status})`
        ).toBe(true);

        // ── 6. Same token after consume → invalid ─────────────────────────
        // Better Auth deletes the verifications row on consume; SPEC-118's
        // contract collapses "used" + "tampered" + "unknown" into `invalid`.
        const consumedRes = await fetch(`${CHECK_URL}?token=${encodeURIComponent(validToken)}`, {
            method: 'GET'
        });
        expect(consumedRes.status).toBe(200);
        const consumedBody = (await consumedRes.json()) as {
            data: { valid: boolean; reason?: string };
        };
        expect(consumedBody.data).toEqual({ valid: false, reason: 'invalid' });
    });

    test('check rejects an empty token with HTTP 400', async () => {
        const emptyRes = await fetch(`${CHECK_URL}?token=`, { method: 'GET' });
        expect(emptyRes.status).toBe(400);
    });
});
