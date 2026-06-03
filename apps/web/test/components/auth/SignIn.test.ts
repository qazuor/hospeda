/**
 * @file SignIn.test.ts
 * @description Unit tests for SignIn auth component.
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

        it('should accept showOAuth prop', () => {
            expect(src).toContain('showOAuth');
        });
    });

    describe('i18n', () => {
        it('should use t() for loading skeleton aria-label', () => {
            expect(src).toContain("t('auth-ui.loading'");
        });

        it('should not have hardcoded Spanish in aria-labels', () => {
            expect(src).not.toContain('aria-label="Cargando');
        });
    });

    describe('accessibility', () => {
        it('should have aria-busy on loading skeleton', () => {
            expect(src).toContain('aria-busy="true"');
        });
    });

    // SPEC-120 — OAuth failure banner wiring.
    describe('OAuth error banner (SPEC-120)', () => {
        it('declares the initialOAuthError prop on SignInProps', () => {
            expect(src).toContain('initialOAuthError');
            expect(src).toMatch(/readonly\s+code:\s*string/);
            expect(src).toMatch(/description\?:\s*string/);
            expect(src).toMatch(/provider\?:\s*string/);
        });

        it('exposes a providerLabel helper that maps brand ids', () => {
            expect(src).toContain('function providerLabel');
            expect(src).toContain("'Google'");
            expect(src).toContain("'Facebook'");
        });

        it('destructures initialOAuthError in the component signature', () => {
            expect(src).toMatch(/initialOAuthError\s*}\s*:\s*SignInProps/);
        });

        it('resolves the OAuth banner via the i18n catalog with provider interpolation', () => {
            expect(src).toContain('auth-ui.signIn.errors.oauth.');
            expect(src).toContain('provider: providerName');
        });

        it('falls back to the `unknown` key when the specific code is missing', () => {
            expect(src).toContain('auth-ui.signIn.errors.oauth.unknown');
            expect(src).toContain('[MISSING:');
        });

        it('writes error_description to console.warn (never to UI)', () => {
            expect(src).toContain('console.warn(`[OAuth]');
        });

        it('strips OAuth query params on hydration via history.replaceState', () => {
            expect(src).toContain('history.replaceState');
            expect(src).toContain("'error'");
            expect(src).toContain("'error_description'");
            expect(src).toContain("'provider'");
        });

        it('strips the URL hash too (handles Facebook #_=_ legacy bug)', () => {
            expect(src).toMatch(/url\.hash\s*=\s*''/);
        });

        it('preserves unrelated query params (e.g. returnUrl) during cleanup', () => {
            // The cleanup loop only deletes a fixed allowlist of OAuth keys
            // before calling replaceState; it must not blow away the whole
            // search string.
            expect(src).toContain('url.searchParams.delete');
            expect(src).not.toContain("url.search = ''");
        });
    });

    // SPEC-182: cross-origin callbackUrl support. The host-strip+reattach
    // workaround (reverse-proxy localhost fix) must NOT apply when redirectTo
    // is a server-validated external callbackUrl (e.g. the admin panel) — the
    // strip would silently turn the admin URL into a broken web-origin path.
    describe('external redirect (SPEC-182 callbackUrl)', () => {
        it('declares the externalRedirect prop on SignInProps', () => {
            expect(src).toMatch(/readonly externalRedirect\?: boolean/);
        });

        it('honors redirectTo verbatim on credential success when externalRedirect', () => {
            expect(src).toMatch(
                /externalRedirect[\s\S]{0,300}window\.location\.replace\(redirectTo\)/
            );
        });

        it('uses redirectTo verbatim as the OAuth callbackURL when externalRedirect', () => {
            expect(src).toMatch(/externalRedirect[\s\S]{0,500}callbackURL = redirectTo/);
        });
    });
});
