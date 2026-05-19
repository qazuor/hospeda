/**
 * @file reset-password.test.ts
 * @description Source-reading tests for the reset-password Astro page.
 *
 * Astro can't be rendered in Vitest, so we assert on the page source to verify
 * it wires SPEC-118 SSR token validation correctly: importing the helper,
 * calling it with the right inputs, and branching the render between the
 * existing `ResetPassword` form island and the `ResetPasswordTokenError`
 * component based on the resolved status.
 *
 * The runtime branching itself is covered by
 * `test/lib/reset-password-status.test.ts`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/auth/reset-password.astro'),
    'utf8'
);

describe('reset-password.astro page (SPEC-118)', () => {
    it('imports the SSR token status helper', () => {
        expect(src).toContain(
            "import { resolveResetPasswordTokenStatusFromApi } from '@/lib/reset-password-status'"
        );
    });

    it('imports both render branches: the form island and the error component', () => {
        expect(src).toContain(
            "import { ResetPassword } from '@/components/auth/ResetPassword.client'"
        );
        expect(src).toContain(
            "import ResetPasswordTokenError from '@/components/auth/ResetPasswordTokenError.astro'"
        );
    });

    it('extracts the token from the URL query string', () => {
        expect(src).toMatch(/Astro\.url\.searchParams\.get\(['"]token['"]\)/);
    });

    it('awaits the SSR helper with the token, api, and logger', () => {
        expect(src).toMatch(/await resolveResetPasswordTokenStatusFromApi\(/);
        expect(src).toContain('api: authApi');
        expect(src).toContain('logger: webLogger');
    });

    it('renders the form when status.kind is valid', () => {
        expect(src).toContain("tokenStatus.kind === 'valid'");
        expect(src).toMatch(/<ResetPassword[^>]+token=\{token\}/);
    });

    it('renders the error component with the resolved reason on the invalid branch', () => {
        expect(src).toMatch(/<ResetPasswordTokenError[^>]+reason=\{tokenStatus\.reason\}/);
        expect(src).toMatch(/<ResetPasswordTokenError[^>]+locale=\{locale\}/);
    });

    it('keeps a JSDoc header referencing SPEC-118', () => {
        expect(src).toContain('SPEC-118');
    });
});
