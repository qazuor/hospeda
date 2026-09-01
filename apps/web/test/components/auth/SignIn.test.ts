/**
 * @file SignIn.test.ts
 * @description Unit tests for SignIn auth component.
 *
 * HOS-959: the OAuth block (Google/Facebook buttons, `handleOauth`, the
 * SPEC-120 error banner, `providerLabel`, and the query-param cleanup
 * effect) moved OUT of this component and into `AuthTabs.client.tsx` — see
 * `test/components/auth/AuthTabs.client.test.tsx` for that coverage now.
 * What used to be the "OAuth error banner (SPEC-120)" describe block here,
 * and the OAuth half of "external redirect (SPEC-182 callbackUrl)", no
 * longer apply to THIS file's source — SignIn.client.tsx has no OAuth code
 * left to assert on. The credential-submit half of SPEC-182 (forwarding
 * `redirectTo`/`externalRedirect` on a successful password sign-in) is
 * unaffected and still lives here.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/auth/SignIn.client.tsx'),
    'utf8'
);

describe('SignIn.client.tsx', () => {
    describe('imports', () => {
        it('should import createTranslations from i18n', () => {
            expect(src).toContain('createTranslations');
        });

        it('should import SupportedLocale type', () => {
            expect(src).toContain('SupportedLocale');
        });
    });

    describe('props', () => {
        it('should accept locale prop', () => {
            expect(src).toContain('locale');
        });

        it('should accept redirectTo prop', () => {
            expect(src).toContain('redirectTo');
        });

        // HOS-959: email is now a controlled value owned by AuthTabs (so it
        // survives a tab switch), not local state.
        it('should accept email and onEmailChange as controlled props', () => {
            expect(src).toMatch(/readonly email: string/);
            expect(src).toMatch(/readonly onEmailChange: \(value: string\) => void/);
        });

        it('should no longer own a local email useState (HOS-959 — controlled by AuthTabs)', () => {
            expect(src).not.toMatch(/const\s+\[\s*email\s*,\s*setEmail\s*\]\s*=\s*useState/);
        });

        it('should no longer declare showOAuth (HOS-959 — OAuth block moved to AuthTabs)', () => {
            expect(src).not.toContain('showOAuth');
        });
    });

    describe('i18n', () => {
        it('should use t() for the form aria-label', () => {
            expect(src).toContain("aria-label={t('auth.signIn.submit', 'Iniciar sesión')}");
        });

        it('should not have hardcoded Spanish in aria-labels', () => {
            expect(src).not.toContain('aria-label="Cargando');
        });

        it('should not keep the legacy loading skeleton i18n key', () => {
            expect(src).not.toContain("t('auth-ui.loading'");
        });
    });

    describe('accessibility', () => {
        it('should render a named form for first-paint sign-in', () => {
            expect(src).toContain('<form');
            expect(src).toContain("aria-label={t('auth.signIn.submit', 'Iniciar sesión')}");
        });
    });

    // HOS-959: this component no longer renders or knows about OAuth at all
    // — no button, no handler, no icons, no error banner. Assert the
    // negative so a future edit that re-introduces a second copy trips this
    // guard immediately instead of silently duplicating AuthTabs's block.
    describe('no OAuth surface left (HOS-959)', () => {
        it('does not declare initialOAuthError', () => {
            expect(src).not.toContain('initialOAuthError');
        });

        it('does not define a providerLabel helper', () => {
            expect(src).not.toContain('function providerLabel');
        });

        it('does not call signIn.social', () => {
            expect(src).not.toContain('signIn.social');
        });

        it('does not render an OAuth button or icon component', () => {
            expect(src).not.toContain('GoogleIcon');
            expect(src).not.toContain('FacebookIcon');
        });

        it('does not use history.replaceState (that cleanup effect moved too)', () => {
            expect(src).not.toContain('history.replaceState');
        });
    });

    // SPEC-182: cross-origin callbackUrl support. The host-strip+reattach
    // workaround (reverse-proxy localhost fix) must NOT apply when redirectTo
    // is a server-validated external callbackUrl (e.g. the admin panel) — the
    // strip would silently turn the admin URL into a broken web-origin path.
    // HOS-959: only the credential-submit path lives here now; the OAuth
    // path moved to AuthTabs.client.tsx (see its own externalRedirect test).
    describe('external redirect (SPEC-182 callbackUrl, credential submit)', () => {
        it('declares the externalRedirect prop on SignInProps', () => {
            expect(src).toMatch(/readonly externalRedirect\?: boolean/);
        });

        it('forwards redirectTo and externalRedirect to the shared redirect resolver on credential success', () => {
            expect(src).toMatch(
                /window\.location\.replace\(\s*resolvePostAuthRedirectUrl\(\{\s*target: redirectTo,\s*currentOrigin: window\.location\.origin,\s*externalRedirect\s*\}\)\s*\)/
            );
        });
    });
});
