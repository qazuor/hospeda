/**
 * @file auth.setup.ts
 * @description SPEC-153 T-153-32 — Playwright setup project that logs the
 * super admin in once and persists the Better Auth session to a storageState
 * file the capture project reuses.
 *
 * Credentials come from env (no secret committed):
 *   VISUAL_TEST_ADMIN_EMAIL, VISUAL_TEST_ADMIN_PASSWORD
 *
 * Login goes through the API (default http://localhost:3001) from the
 * browser context so the Better Auth session cookie is stored against the
 * API origin; storageState then captures it for the authenticated capture
 * runs.
 */

import { expect, test as setup } from '@playwright/test';

const STORAGE_STATE = 'tests/visual-snapshots/.auth/admin.json';
const API_URL = process.env.VISUAL_TEST_API_URL ?? 'http://localhost:3001';

setup('authenticate super admin', async ({ page }) => {
    const email = process.env.VISUAL_TEST_ADMIN_EMAIL;
    const password = process.env.VISUAL_TEST_ADMIN_PASSWORD;
    if (!email || !password) {
        throw new Error(
            'Set VISUAL_TEST_ADMIN_EMAIL and VISUAL_TEST_ADMIN_PASSWORD to capture admin snapshots.'
        );
    }

    // Visit the app first so the browser has an origin to attach cookies to.
    await page.goto('/');

    const result = await page.evaluate(
        async ({ apiUrl, em, pw }) => {
            const res = await fetch(`${apiUrl}/api/auth/sign-in/email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email: em, password: pw })
            });
            const session = await fetch(`${apiUrl}/api/auth/get-session`, {
                credentials: 'include'
            });
            return { signInStatus: res.status, sessionStatus: session.status };
        },
        { apiUrl: API_URL, em: email, pw: password }
    );

    expect(result.signInStatus, 'sign-in should succeed').toBe(200);
    expect(result.sessionStatus, 'session should resolve').toBe(200);

    await page.context().storageState({ path: STORAGE_STATE });
});
