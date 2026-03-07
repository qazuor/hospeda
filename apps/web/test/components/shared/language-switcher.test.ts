/**
 * @file language-switcher.test.ts
 * @description Tests for LanguageSwitcher.astro component.
 *
 * Verifies locale links, active locale highlighting, semantic color tokens,
 * accessibility attributes, pipe separators, and type imports.
 * Astro components are tested by reading source content directly.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/shared/LanguageSwitcher.astro');
const content = readFileSync(componentPath, 'utf8');

describe('LanguageSwitcher.astro', () => {
    describe('Props interface', () => {
        it('should define a Props interface', () => {
            expect(content).toContain('interface Props');
        });

        it('should accept a readonly locale prop of type SupportedLocale', () => {
            expect(content).toContain('readonly locale: SupportedLocale');
        });

        it('should accept an optional readonly class prop', () => {
            expect(content).toContain('readonly class?: string');
        });
    });

    describe('Type imports', () => {
        it('should import SupportedLocale as a type from @/lib/i18n', () => {
            expect(content).toContain("import type { SupportedLocale } from '@/lib/i18n'");
        });

        it('should import SUPPORTED_LOCALES from @/lib/i18n', () => {
            expect(content).toContain("import { SUPPORTED_LOCALES } from '@/lib/i18n'");
        });
    });

    describe('Locale links', () => {
        it('should iterate over SUPPORTED_LOCALES', () => {
            expect(content).toContain('SUPPORTED_LOCALES.map');
        });

        it('should include ES label', () => {
            expect(content).toContain("'ES'");
        });

        it('should include EN label', () => {
            expect(content).toContain("'EN'");
        });

        it('should include PT label', () => {
            expect(content).toContain("'PT'");
        });

        it('should render inactive locales as anchor links', () => {
            expect(content).toContain('<a');
            expect(content).toContain('href={buildLocaleUrl({ targetLocale: loc })}');
        });

        it('should set hreflang on locale links', () => {
            expect(content).toContain('hreflang={loc}');
        });

        it('should render the active locale as a non-interactive span', () => {
            expect(content).toContain('aria-current="true"');
        });
    });

    describe('URL building', () => {
        it('should define buildLocaleUrl helper function', () => {
            expect(content).toContain('function buildLocaleUrl');
        });

        it('should use Astro.url.pathname to build alternate URLs', () => {
            expect(content).toContain('Astro.url.pathname');
        });

        it('should swap the locale segment in the path', () => {
            expect(content).toContain('segments[0] = targetLocale');
        });

        it('should prepend locale if no locale segment exists', () => {
            expect(content).toContain('segments.unshift(targetLocale)');
        });
    });

    describe('Semantic color tokens', () => {
        it('should use text-primary for the active locale', () => {
            expect(content).toContain('text-primary');
        });

        it('should use text-muted-foreground for inactive locales', () => {
            expect(content).toContain('text-muted-foreground');
        });

        it('should use hover:text-foreground for inactive locale hover state', () => {
            expect(content).toContain('hover:text-foreground');
        });

        it('should not contain any hardcoded color values', () => {
            // Ensure no raw palette values like text-blue-600, text-gray-400, etc.
            expect(content).not.toMatch(
                /text-(blue|gray|red|green|yellow|zinc|slate|stone|neutral|orange|amber|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)-\d{3}/
            );
        });
    });

    describe('Accessibility', () => {
        it('should use a <nav> as the root element', () => {
            expect(content).toContain('<nav');
        });

        it('should have aria-label="Language switcher" on the nav', () => {
            expect(content).toContain('aria-label="Language switcher"');
        });

        it('should mark the active locale with aria-current="true"', () => {
            expect(content).toContain('aria-current="true"');
        });

        it('should include descriptive aria-label on the active locale span', () => {
            expect(content).toContain('aria-label={`Current language: ${label}`}');
        });

        it('should include descriptive aria-label on inactive locale links', () => {
            expect(content).toContain('aria-label={`Switch to ${label}`}');
        });

        it('should mark pipe separators as aria-hidden', () => {
            expect(content).toContain('aria-hidden="true"');
        });
    });

    describe('Pipe separators', () => {
        it('should render pipe separators between locales', () => {
            expect(content).toContain('|');
        });

        it('should not render a separator after the last locale', () => {
            expect(content).toContain('index < SUPPORTED_LOCALES.length - 1');
        });
    });

    describe('Styling', () => {
        it('should use class:list for conditional classes on the nav', () => {
            expect(content).toContain('class:list');
        });

        it('should use text-xs for compact sizing', () => {
            expect(content).toContain('text-xs');
        });

        it('should use font-bold to highlight the active locale', () => {
            expect(content).toContain('font-bold');
        });

        it('should include transition-colors for smooth hover transitions', () => {
            expect(content).toContain('transition-colors');
        });

        it('should apply select-none on separators to prevent text selection', () => {
            expect(content).toContain('select-none');
        });
    });
});
