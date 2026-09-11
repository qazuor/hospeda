/**
 * @file signin.test.ts
 * @description Source-level tests for the signin Astro page.
 *
 * Astro components cannot be rendered in Vitest, so behavior is asserted by
 * inspecting the source for the expected wiring (per the web CLAUDE.md
 * "Astro component test" pattern). For runtime behavior of the React island
 * the page mounts, see `apps/web/test/components/auth/AuthTabs.client.test.tsx`.
 *
 * HOS-959: this page now renders the unified `AuthTabs` island instead of
 * `SignIn` directly, and the `returnUrl`/`redirect`/`callbackUrl` redirect
 * computation moved into the shared, independently-testable
 * `resolveAuthTabsRedirectConfig` helper (see
 * `test/lib/auth-tabs-config.test.ts` for the BEHAVIORAL coverage of that
 * logic — real inputs/outputs, not string matching, which a plain
 * importable function makes possible for the first time here). What this
 * file can still assert, being a source-string test, is that the page
 * actually WIRES to that helper and forwards its output to the island.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(__dirname, '../../../src/pages/[lang]/auth/signin.astro'), 'utf8');

describe('signin.astro', () => {
    describe('renders the unified AuthTabs island (HOS-959)', () => {
        it('imports AuthTabs, not SignIn directly', () => {
            expect(src).toContain("import { AuthTabs } from '@/components/auth/AuthTabs.client'");
            expect(src).not.toContain("from '@/components/auth/SignIn.client'");
        });

        it('renders AuthTabs with initialTab="signin"', () => {
            expect(src).toContain('<AuthTabs');
            expect(src).toContain('initialTab="signin"');
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

        it('lets a valid callbackUrl take precedence over returnPath on the auth redirect', () => {
            expect(src).toMatch(
                /Astro\.redirect\(\s*validatedCallbackUrl\s*\?\?\s*returnPath\s*\)/
            );
        });
    });

    // SPEC-120 — pick up OAuth failure signal from the API redirect chain.
    // This parsing stays LOCAL to each page (not shared) — HOS-959 requires
    // BOTH signin.astro and signup.astro to carry it, since the shared OAuth
    // block in AuthTabs is reachable from either URL.
    describe('OAuth error query reading (SPEC-120)', () => {
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
            // Strict charset to prevent injection into i18n keys / console output.
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
});
