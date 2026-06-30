/**
 * @file ThemeFoucScript.test.ts
 * @description Source-level guard for the theme bootstrap script (Bug B2).
 *
 * The site uses Astro's <ClientRouter /> (View Transitions). On every SPA
 * navigation the swap replaces the <html> attributes from the freshly SSR'd
 * document (which carries no data-theme) and Astro does NOT re-run identical
 * is:inline scripts. Without re-applying the theme on `astro:after-swap`, the
 * chosen theme is lost when navigating between pages.
 *
 * These assertions lock the two halves of the contract in place:
 *   1. apply on first paint (FOUC prevention), and
 *   2. re-apply on astro:after-swap (persistence across View Transitions).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = readFileSync(
    join(__dirname, '../../../src/components/shared/ThemeFoucScript.astro'),
    'utf8'
);

describe('ThemeFoucScript (Bug B2 — theme persistence)', () => {
    it('reads the persisted theme from the canonical localStorage key', () => {
        expect(SCRIPT).toContain("localStorage.getItem('theme')");
    });

    it('applies and clears the data-theme attribute on <html>', () => {
        expect(SCRIPT).toMatch(/setAttribute\(\s*'data-theme'\s*,\s*'dark'\s*\)/);
        expect(SCRIPT).toMatch(/removeAttribute\(\s*'data-theme'\s*\)/);
    });

    it('honors the system preference for the "system" choice', () => {
        expect(SCRIPT).toContain('prefers-color-scheme: dark');
        expect(SCRIPT).toContain("stored === 'system'");
    });

    it('applies the theme eagerly on the initial full-page load', () => {
        // astro:after-swap does NOT fire on first load, so the IIFE must also
        // invoke applyStoredTheme() directly. This matches the standalone call,
        // not the function definition nor the listener reference (no parens).
        expect(SCRIPT).toMatch(/^\s*applyStoredTheme\(\);/m);
    });

    it('re-applies the theme after every View Transitions navigation', () => {
        // The keystone of the B2 fix: without this listener the theme is lost
        // on SPA navigation because the inline script is not re-run.
        expect(SCRIPT).toContain("addEventListener('astro:after-swap'");
    });
});
