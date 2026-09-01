/**
 * @file signup.test.ts
 * @description Source-level tests for the signup Astro page.
 *
 * There was no `signup.astro` page test before HOS-959. This page now
 * renders the unified `AuthTabs` island (same component signin.astro
 * renders, with `initialTab="signup"`) and shares its redirect computation
 * with signin.astro via `resolveAuthTabsRedirectConfig` — see
 * `test/lib/auth-tabs-config.test.ts` for the BEHAVIORAL coverage of that
 * helper (real inputs/outputs), and `test/pages/auth/signin.test.ts` for the
 * mirrored wiring assertions on the sign-in page. Astro components cannot be
 * rendered in Vitest, so behavior is asserted by inspecting the source (per
 * the web CLAUDE.md "Astro component test" pattern).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(__dirname, '../../../src/pages/[lang]/auth/signup.astro'), 'utf8');

describe('signup.astro', () => {
    describe('renders the unified AuthTabs island (HOS-959)', () => {
        it('imports AuthTabs, not SignUp directly', () => {
            expect(src).toContain("import { AuthTabs } from '@/components/auth/AuthTabs.client'");
            expect(src).not.toContain("from '@/components/auth/SignUp.client'");
        });

        it('renders AuthTabs with initialTab="signup"', () => {
            expect(src).toContain('<AuthTabs');
            expect(src).toContain('initialTab="signup"');
        });

        it('forwards signInConfig and signUpConfig to the island', () => {
            expect(src).toContain('signInConfig={signInConfig}');
            expect(src).toContain('signUpConfig={signUpConfig}');
        });

        it('forwards both signInPath and signUpPath for the tab-switch URL rewrite', () => {
            expect(src).toContain('signInPath={signInPath}');
            expect(src).toContain('signUpPath={signUpPath}');
            expect(src).toContain("buildUrl({ locale, path: 'auth/signin' })");
            expect(src).toContain("buildUrl({ locale, path: 'auth/signup' })");
        });
    });

    describe('redirect config wiring (HOS-959)', () => {
        it('computes redirect config via the shared resolveAuthTabsRedirectConfig helper', () => {
            expect(src).toContain(
                "import { resolveAuthTabsRedirectConfig } from '@/lib/auth-tabs-config'"
            );
            expect(src).toContain('resolveAuthTabsRedirectConfig(');
        });

        it('passes Astro.url as astroUrl into the helper', () => {
            expect(src).toContain('astroUrl: Astro.url');
        });

        it('resolves the allowlist against the configured site/admin origins and prod flag', () => {
            expect(src).toContain('getSiteUrl');
            expect(src).toContain('getAdminUrl');
            expect(src).toContain('isProduction');
        });

        it('destructures returnPath and validatedCallbackUrl for the already-authenticated redirect', () => {
            expect(src).toMatch(
                /const\s*\{\s*returnPath,\s*validatedCallbackUrl,\s*signInConfig,\s*signUpConfig\s*\}\s*=\s*resolveAuthTabsRedirectConfig/
            );
        });

        // HOS-959 deliberate behavior ADDITION (owner-approved): a validated
        // callbackUrl now takes precedence over returnPath for an
        // already-authenticated visitor on THIS page too, mirroring
        // signin.astro — previously signup.astro ignored callbackUrl
        // entirely. The browser destination for password registration is
        // still verify-email-sent, since there is no session to redirect with
        // at submit time; what HOS-838 changed is that the caller's
        // destination now travels inside the verification email
        // (`verificationCallbackUrl`), covered behaviorally in
        // auth-tabs-config.test.ts, not here.
        it('lets a valid callbackUrl take precedence over returnPath on the auth redirect', () => {
            expect(src).toMatch(
                /Astro\.redirect\(\s*validatedCallbackUrl\s*\?\?\s*returnPath\s*\)/
            );
        });
    });

    // SPEC-120 — pick up OAuth failure signal from the API redirect chain.
    // HOS-959: signup.astro did NOT parse this before — it must now, since
    // the shared OAuth block in AuthTabs is reachable from either URL and an
    // OAuth failure returning to /auth/signup needs somewhere to surface.
    describe('OAuth error query reading (SPEC-120, new on this page — HOS-959)', () => {
        it('reads ?error= from the query string', () => {
            expect(src).toContain("Astro.url.searchParams.get('error')");
        });

        it('reads ?error_description= from the query string', () => {
            expect(src).toContain("Astro.url.searchParams.get('error_description')");
        });

        it('reads ?provider= from the query string', () => {
            expect(src).toContain("Astro.url.searchParams.get('provider')");
        });

        it('validates the error code against a strict allowlist regex', () => {
            expect(src).toMatch(/\/\^\[a-z_\]\{1,64\}\$\//);
        });

        it('falls back to `unknown` when the error code does not match the allowlist', () => {
            expect(src).toContain("'unknown'");
        });

        it('validates the provider against a strict allowlist regex', () => {
            expect(src).toMatch(/\/\^\[a-z\]\{1,32\}\$\//);
        });

        it('truncates error_description to a safe length', () => {
            expect(src).toMatch(/slice\(0,\s*200\)/);
        });

        it('builds the initialOAuthError prop only when an error code is present', () => {
            expect(src).toContain('const initialOAuthError =');
            expect(src).toContain('oauthErrorCode');
        });

        it('passes initialOAuthError to the AuthTabs island', () => {
            expect(src).toContain('initialOAuthError={initialOAuthError}');
        });
    });

    describe('"already have an account" footer link (pre-existing, HOS-810)', () => {
        it('forwards returnUrl to the sign-in link when a destination was requested', () => {
            expect(src).toContain('const rawReturn =');
            expect(src).toMatch(/rawReturn === ''/);
            expect(src).toContain('signInHref');
        });
    });
});
