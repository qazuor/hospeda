/**
 * @file signin.test.ts
 * @description Source-level tests for the signin Astro page.
 *
 * Astro components cannot be rendered in Vitest, so behavior is asserted by
 * inspecting the source for the expected wiring (per the web CLAUDE.md
 * "Astro component test" pattern). For runtime behavior of the React island
 * the page mounts, see `apps/web/test/components/auth/SignIn.test.ts`.
 *
 * @module test/pages/auth/signin
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(__dirname, '../../../src/pages/[lang]/auth/signin.astro'), 'utf8');

describe('signin.astro', () => {
    describe('returnUrl handling (pre-existing)', () => {
        it('reads returnUrl from query params', () => {
            expect(src).toContain("Astro.url.searchParams.get('returnUrl')");
        });

        it('rejects unsafe return paths (open-redirect guard)', () => {
            expect(src).toContain('isSafeRelativePath');
        });
    });

    // SPEC-120 — pick up OAuth failure signal from the API redirect chain.
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

        it('passes initialOAuthError to the SignIn island', () => {
            expect(src).toContain('initialOAuthError={initialOAuthError}');
        });
    });
});
