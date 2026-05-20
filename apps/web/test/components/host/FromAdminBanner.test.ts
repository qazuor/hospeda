/**
 * @file FromAdminBanner.test.ts
 * @description Source-reading unit tests for FromAdminBanner.astro. Astro
 * components cannot be rendered in Vitest, so the assertions verify the
 * source's structure, accessibility, i18n wiring, and tokenized styling.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/host/FromAdminBanner.astro'),
    'utf8'
);

describe('FromAdminBanner.astro', () => {
    describe('file structure', () => {
        it('has a JSDoc file header', () => {
            expect(src).toContain('@file FromAdminBanner.astro');
        });

        it('defines a Props interface', () => {
            expect(src).toContain('interface Props');
        });

        it('declares locale as a readonly SupportedLocale prop', () => {
            expect(src).toContain('readonly locale: SupportedLocale');
        });
    });

    describe('i18n wiring', () => {
        it('imports createTranslations from @/lib/i18n', () => {
            expect(src).toContain("import { createTranslations } from '@/lib/i18n'");
        });

        it('uses host.fromAdminBanner.title i18n key', () => {
            expect(src).toContain("t('host.fromAdminBanner.title'");
        });

        it('uses host.fromAdminBanner.message i18n key', () => {
            expect(src).toContain("t('host.fromAdminBanner.message'");
        });
    });

    describe('accessibility', () => {
        it('wraps content in an aside with role="status"', () => {
            expect(src).toContain('<aside');
            expect(src).toContain('role="status"');
        });

        it('sets aria-live="polite" so the banner does not interrupt screen readers', () => {
            expect(src).toContain('aria-live="polite"');
        });

        it('hides the decorative icon from assistive tech', () => {
            expect(src).toContain('aria-hidden="true"');
        });

        it('exposes a data-testid hook for integration tests', () => {
            expect(src).toContain('data-testid="from-admin-banner"');
        });
    });

    describe('styling — tokens only, no hardcoded values', () => {
        it('uses --surface-warm for the banner background', () => {
            expect(src).toContain('var(--surface-warm)');
        });

        it('uses --brand-accent for the left accent border', () => {
            expect(src).toContain('var(--brand-accent)');
        });

        it('uses --radius-card (not deprecated --radius-organic-*)', () => {
            expect(src).toContain('var(--radius-card)');
            expect(src).not.toContain('--radius-organic');
        });

        it('uses --font-heading for the title', () => {
            expect(src).toContain('var(--font-heading)');
        });

        it('uses --core-foreground for the title color', () => {
            expect(src).toContain('var(--core-foreground)');
        });

        it('uses --core-muted-foreground for the message color', () => {
            expect(src).toContain('var(--core-muted-foreground)');
        });

        it('uses --shadow-card for the elevation', () => {
            expect(src).toContain('var(--shadow-card)');
        });
    });

    describe('no Tailwind utilities (web app convention)', () => {
        it('does not use Tailwind utility classes on elements', () => {
            // No `class="text-...` or `bg-...` patterns.
            expect(src).not.toMatch(/class="[^"]*\btext-(slate|gray|red|green|blue)-\d/);
            expect(src).not.toMatch(/class="[^"]*\bbg-(slate|gray|red|green|blue)-\d/);
        });
    });
});
