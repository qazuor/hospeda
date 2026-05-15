/**
 * @file ResetPasswordTokenError.test.ts
 * @description Source-reading tests for the SPEC-118 error state component.
 * Astro can't be rendered in Vitest, so we assert on the file's text to
 * verify structure, props, i18n key usage, and CTA wiring.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/components/auth/ResetPasswordTokenError.astro'),
    'utf8'
);

describe('ResetPasswordTokenError.astro (SPEC-118)', () => {
    it('declares a Props interface with locale + reason', () => {
        expect(src).toContain('interface Props');
        expect(src).toContain('readonly locale: SupportedLocale');
        expect(src).toMatch(/readonly reason: 'expired' \| 'invalid'/);
    });

    it('uses createT to localise the title and description', () => {
        expect(src).toContain("import { createT } from '@/lib/i18n'");
        expect(src).toContain('createT(locale)');
        expect(src).toContain('auth-ui.pages.resetPassword.tokenError.');
    });

    it('renders both expired and invalid keyspaces via dynamic key construction', () => {
        // Title/description keys are interpolated via `${reason}` rather than
        // duplicated; assert both halves of the dynamic key exist.
        expect(src).toContain('`auth-ui.pages.resetPassword.tokenError.${reason}.title`');
        expect(src).toContain('`auth-ui.pages.resetPassword.tokenError.${reason}.description`');
    });

    it('exposes a CTA labelled with requestNewLinkCta', () => {
        expect(src).toContain('auth-ui.pages.resetPassword.tokenError.requestNewLinkCta');
    });

    it('links the CTA to the localised forgot-password route via buildUrl', () => {
        expect(src).toContain("import { buildUrl } from '@/lib/urls'");
        expect(src).toContain("path: 'auth/forgot-password'");
    });

    it('exposes a test selector and a data-reason attribute for E2E hooks', () => {
        expect(src).toContain('data-testid="reset-password-token-error"');
        expect(src).toContain('data-reason={reason}');
    });

    it('does not render a password input (only the form should)', () => {
        expect(src).not.toMatch(/<input[^>]*type="password"/);
    });

    it('uses semantic CSS tokens for the destructive icon colour', () => {
        expect(src).toContain('var(--destructive');
    });

    it('uses the brand-primary token for the CTA, not a hardcoded brand colour', () => {
        // Hex literals are only acceptable as CSS variable fallbacks
        // (e.g. `var(--primary-foreground, #fff)`); ensure every hex sits inside one.
        const hexMatches = src.match(/#[0-9a-fA-F]{3,6}/g) ?? [];
        for (const hex of hexMatches) {
            const idx = src.indexOf(hex);
            const before = src.slice(Math.max(0, idx - 60), idx);
            expect(before).toMatch(/var\([^)]*,\s*$/);
        }
    });
});
