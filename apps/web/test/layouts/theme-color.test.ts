/**
 * @file theme-color.test.ts
 * @description Source-level tests for SPEC-157 REQ-18: meta theme-color + manifest
 * reconciliation.
 *
 * Verifies that:
 *  - All three root layouts emit `<meta name="theme-color">` with the brand hex.
 *  - AuthLayout and ErrorLayout include `<link rel="manifest">`.
 *  - site.webmanifest `theme_color` matches the brand hex (no longer #10B981).
 *  - BRAND_THEME_COLOR constant is defined and equals the brand hex.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRAND_THEME_COLOR } from '../../src/lib/constants';

const LAYOUTS_DIR = resolve(__dirname, '../../src/layouts');
const PUBLIC_DIR = resolve(__dirname, '../../public');

const baseLayoutSrc = readFileSync(resolve(LAYOUTS_DIR, 'BaseLayout.astro'), 'utf8');
const authLayoutSrc = readFileSync(resolve(LAYOUTS_DIR, 'AuthLayout.astro'), 'utf8');
const errorLayoutSrc = readFileSync(resolve(LAYOUTS_DIR, 'ErrorLayout.astro'), 'utf8');
const manifestRaw = readFileSync(resolve(PUBLIC_DIR, 'site.webmanifest'), 'utf8');
const manifest = JSON.parse(manifestRaw) as { theme_color: string; [key: string]: unknown };

describe('SPEC-157 REQ-18 — meta theme-color + manifest reconciliation', () => {
    describe('BRAND_THEME_COLOR constant', () => {
        it('is defined and is the brand blue hex', () => {
            expect(BRAND_THEME_COLOR).toBe('#3885f9');
        });
    });

    describe('BaseLayout.astro', () => {
        it('emits <meta name="theme-color"> referencing BRAND_THEME_COLOR', () => {
            // Source files use {BRAND_THEME_COLOR} (Astro expression), not the literal
            // hex value. We assert the meta tag is present AND uses the constant so
            // the value cannot drift by accident.
            expect(baseLayoutSrc).toContain('name="theme-color"');
            expect(baseLayoutSrc).toContain('{BRAND_THEME_COLOR}');
            expect(baseLayoutSrc).toContain('import { BRAND_THEME_COLOR }');
        });
    });

    describe('AuthLayout.astro', () => {
        it('emits <meta name="theme-color"> referencing BRAND_THEME_COLOR', () => {
            expect(authLayoutSrc).toContain('name="theme-color"');
            expect(authLayoutSrc).toContain('{BRAND_THEME_COLOR}');
            expect(authLayoutSrc).toContain('import { BRAND_THEME_COLOR }');
        });

        it('includes <link rel="manifest"> pointing to /site.webmanifest', () => {
            expect(authLayoutSrc).toMatch(/<link\s+rel="manifest"\s+href="\/site\.webmanifest"/);
        });
    });

    describe('ErrorLayout.astro', () => {
        it('emits <meta name="theme-color"> referencing BRAND_THEME_COLOR', () => {
            expect(errorLayoutSrc).toContain('name="theme-color"');
            expect(errorLayoutSrc).toContain('{BRAND_THEME_COLOR}');
            expect(errorLayoutSrc).toContain('import { BRAND_THEME_COLOR }');
        });

        it('includes <link rel="manifest"> pointing to /site.webmanifest', () => {
            expect(errorLayoutSrc).toMatch(/<link\s+rel="manifest"\s+href="\/site\.webmanifest"/);
        });
    });

    describe('site.webmanifest', () => {
        it('theme_color matches BRAND_THEME_COLOR (no longer #10B981)', () => {
            expect(manifest.theme_color).toBe(BRAND_THEME_COLOR);
        });

        it('theme_color is not the old green #10B981', () => {
            expect(manifest.theme_color).not.toBe('#10B981');
        });
    });
});
