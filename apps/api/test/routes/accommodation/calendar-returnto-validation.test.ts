/**
 * Google Calendar connect/callback — `returnTo` open-redirect guard tests
 * (HOS-157 Phase 2 — Layer 4).
 *
 * Exercises the two independent layers of the same guard:
 * - `SafeReturnToSchema` (connect route, `calendarConnectGoogle.ts`) — an
 *   EARLY string-level sanity filter that rejects the obvious open-redirect
 *   bypasses before a `returnTo` value is ever stored in the OAuth state.
 * - `buildWebRedirect` (callback route, `calendarGoogleCallback.ts`) — the
 *   AUTHORITATIVE guard: resolves the candidate with `new URL()` and keeps it
 *   only when the resulting origin equals the configured site origin,
 *   defeating WHATWG-parser quirks (leading `/\`, embedded control
 *   characters) that string denylisting alone can miss.
 *
 * `env.HOSPEDA_SITE_URL` is NOT mocked here — it is already pinned to a
 * deterministic value (`http://localhost:4321`) by `test/setup.ts`, which
 * every test file in this suite shares. Replacing the whole `env` module
 * with a partial mock would drop unrelated exports (e.g. `validateApiEnv`)
 * that other transitively-imported modules rely on at import time.
 * `env.HOSPEDA_SITE_URL` is read inside each test body (not hoisted to
 * module scope) because `test/setup.ts` populates it from a `beforeAll`
 * hook, which only runs AFTER this file's module-level code has already
 * been collected.
 *
 * @module test/routes/accommodation/calendar-returnto-validation
 */

import { describe, expect, it } from 'vitest';
import { SafeReturnToSchema } from '../../../src/routes/accommodation/protected/calendarConnectGoogle.js';
import { buildWebRedirect } from '../../../src/routes/accommodation/protected/calendarGoogleCallback.js';
import { env } from '../../../src/utils/env.js';

describe('calendar-sync Google connect/callback — returnTo open-redirect guard', () => {
    describe('SafeReturnToSchema (connect route — early sanity filter)', () => {
        it.each([
            ['protocol-relative //', '//evil.com'],
            ['absolute https:// URL', 'https://evil.com'],
            ['leading backslash', '/\\evil.com'],
            ['embedded tab', '/\tx'],
            ['embedded LF', '/\nx'],
            ['embedded CR', '/\rx']
        ])('should reject %s', (_label, value) => {
            const result = SafeReturnToSchema.safeParse(value);
            expect(result.success).toBe(false);
        });

        it('should accept a legit same-origin relative path', () => {
            const result = SafeReturnToSchema.safeParse('/es/mi-cuenta/propiedades/acc-1/editar/');
            expect(result.success).toBe(true);
        });
    });

    describe('buildWebRedirect (callback route — authoritative guard)', () => {
        it.each([
            ['leading backslash', '/\\evil.com'],
            ['embedded tab before a path', '/\t/evil.com'],
            ['embedded CR before a path', '/\r/evil.com'],
            ['protocol-relative //', '//evil.com']
        ])('should stay on the site origin for %s', (_label, returnTo) => {
            const redirect = buildWebRedirect({ result: 'connected', returnTo });
            expect(redirect.startsWith(env.HOSPEDA_SITE_URL)).toBe(true);
            expect(redirect).not.toContain('evil.com');
        });

        it('should preserve a legit same-origin path', () => {
            const redirect = buildWebRedirect({ result: 'connected', returnTo: '/es/x' });
            expect(redirect.startsWith(`${env.HOSPEDA_SITE_URL}/es/x`)).toBe(true);
        });
    });
});
