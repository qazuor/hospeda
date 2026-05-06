/**
 * @file DestinationClimatePlaceholder.test.ts
 * @description Source-based assertions for DestinationClimatePlaceholder.astro.
 * Astro components cannot be DOM-rendered in Vitest; we assert on source content.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/destination/DestinationClimatePlaceholder.astro'),
    'utf8'
);

describe('DestinationClimatePlaceholder.astro', () => {
    describe('imports', () => {
        it('should import SunIcon from @repo/icons', () => {
            expect(src).toContain("from '@repo/icons'");
            expect(src).toContain('SunIcon');
        });

        it('should import createTranslations from @/lib/i18n', () => {
            expect(src).toContain("from '@/lib/i18n'");
            expect(src).toContain('createTranslations');
        });

        it('should import SupportedLocale type', () => {
            expect(src).toContain('SupportedLocale');
        });
    });

    describe('props', () => {
        it('should declare locale as readonly SupportedLocale', () => {
            expect(src).toContain('readonly locale: SupportedLocale');
        });
    });

    describe('rendering', () => {
        it('should render the SunIcon', () => {
            expect(src).toContain('<SunIcon');
        });

        it('should render placeholder body copy via t()', () => {
            expect(src).toContain("'destination.detail.climate.placeholder'");
            expect(src).toContain('Próximamente vas a poder ver información');
        });

        it('should render section title via t()', () => {
            expect(src).toContain("t('destination.detail.climate.title'");
            expect(src).toContain('Clima y mejor época');
        });
    });

    describe('i18n', () => {
        it('should call createTranslations(locale)', () => {
            expect(src).toContain('createTranslations(locale)');
        });

        it('should use t() for aria-label with fallback mentioning próximamente', () => {
            expect(src).toContain("t('destination.detail.climate.ariaLabel'");
            expect(src).toContain('próximamente');
        });
    });

    describe('accessibility', () => {
        it('should include aria-label on the section indicating pending state', () => {
            expect(src).toContain('aria-label={');
            expect(src).toContain('próximamente');
        });

        it('should include aria-labelledby linking section to heading', () => {
            expect(src).toContain('aria-labelledby="dest-climate-title"');
        });

        it('should mark the icon as aria-hidden', () => {
            expect(src).toContain('aria-hidden="true"');
        });

        it('should provide matching id on the section title', () => {
            expect(src).toContain('id="dest-climate-title"');
        });
    });

    describe('styling', () => {
        it('should use CSS custom properties only (no hardcoded hex colors)', () => {
            expect(src).toContain('var(--');
            expect(src).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
        });

        it('should use --radius-card on the placeholder container', () => {
            expect(src).toContain('var(--radius-card)');
        });

        it('should use a dashed border style', () => {
            expect(src).toContain('dashed');
        });

        it('should use --border token for the border color', () => {
            expect(src).toContain('var(--border)');
        });

        it('should use --core-muted-foreground for muted text', () => {
            expect(src).toContain('var(--core-muted-foreground)');
        });

        it('should use --brand-accent for the sun icon color', () => {
            expect(src).toContain('var(--brand-accent)');
        });

        it('should use --font-heading for section title', () => {
            expect(src).toContain('var(--font-heading)');
        });
    });
});
