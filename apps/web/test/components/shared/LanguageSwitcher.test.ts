/**
 * @file LanguageSwitcher.test.ts
 * @description Unit tests for LanguageSwitcher component.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/shared/LanguageSwitcher.astro'),
    'utf8'
);

describe('LanguageSwitcher.astro', () => {
    describe('props', () => {
        it('should accept locale and currentPath props', () => {
            expect(src).toContain('readonly locale: SupportedLocale');
            expect(src).toContain('readonly currentPath: string');
        });
    });

    describe('locale options', () => {
        it('should render all three locales', () => {
            expect(src).toContain('es:');
            expect(src).toContain('en:');
            expect(src).toContain('pt:');
        });

        it('should display locale full names', () => {
            expect(src).toContain('Español');
            expect(src).toContain('English');
            expect(src).toContain('Português');
        });
    });

    describe('accessibility', () => {
        it('should use aria-current for active locale', () => {
            expect(src).toContain('aria-current');
        });

        it('should use t() for aria-label', () => {
            expect(src).toContain("t('nav.changeLanguage'");
        });

        it('should use details/summary for CSS-only dropdown', () => {
            expect(src).toContain('<details');
            expect(src).toContain('<summary');
        });
    });

    describe('URL generation', () => {
        it('should have a function to build locale URLs', () => {
            expect(src).toContain('buildLocaleUrl');
        });

        it('should swap locale prefix in current path', () => {
            expect(src).toContain('replace');
            expect(src).toContain('targetLocale');
        });
    });

    describe('styling', () => {
        it('should use scoped BEM-style classes', () => {
            expect(src).toContain('lang-switcher');
        });

        it('should use CSS custom properties', () => {
            expect(src).toContain('var(--');
        });
    });
});
