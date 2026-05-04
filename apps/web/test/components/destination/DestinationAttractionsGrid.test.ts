/**
 * @file DestinationAttractionsGrid.test.ts
 * @description Source-based assertions for DestinationAttractionsGrid.astro.
 * Astro components cannot be DOM-rendered in Vitest, so we verify by reading
 * the source file and asserting on its contents.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/destination/DestinationAttractionsGrid.astro'),
    'utf8'
);

describe('DestinationAttractionsGrid.astro', () => {
    describe('imports', () => {
        it('should import LocationIcon from @repo/icons', () => {
            expect(src).toContain("from '@repo/icons'");
            expect(src).toContain('LocationIcon');
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
        it('should declare attractions as readonly ReadonlyArray', () => {
            expect(src).toContain('readonly attractions: ReadonlyArray<AttractionItem>');
        });

        it('should declare locale as readonly SupportedLocale', () => {
            expect(src).toContain('readonly locale: SupportedLocale');
        });

        it('should declare maxItems as optional with default 8', () => {
            expect(src).toContain('readonly maxItems?: number');
            expect(src).toContain('maxItems = 8');
        });
    });

    describe('rendering', () => {
        it('should return early (render nothing) when attractions is empty', () => {
            expect(src).toContain('attractions.length === 0');
            expect(src).toContain('return');
        });

        it('should sort by displayWeight descending', () => {
            expect(src).toContain('wB - wA');
        });

        it('should fall back to alphabetical sort when weights are equal', () => {
            expect(src).toContain('localeCompare');
        });

        it('should slice to maxItems', () => {
            expect(src).toContain('.slice(0, maxItems)');
        });

        it('should render attraction name as heading', () => {
            expect(src).toContain('attraction.name');
        });

        it('should conditionally render description', () => {
            expect(src).toContain('attraction.description');
        });
    });

    describe('i18n', () => {
        it('should call createTranslations(locale)', () => {
            expect(src).toContain('createTranslations(locale)');
        });

        it('should use t() for section title with fallback', () => {
            expect(src).toContain("t('destination.detail.attractions.title'");
            expect(src).toContain('Qué hacer acá');
        });
    });

    describe('accessibility', () => {
        it('should mark decorative icons as aria-hidden', () => {
            expect(src).toContain('aria-hidden="true"');
        });

        it('should provide aria-labelledby on the section', () => {
            expect(src).toContain('aria-labelledby="attractions-title"');
        });

        it('should label the section heading with matching id', () => {
            expect(src).toContain('id="attractions-title"');
        });
    });

    describe('styling', () => {
        it('should use CSS custom properties only (no hardcoded hex colors)', () => {
            expect(src).toContain('var(--');
            expect(src).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
        });

        it('should use --radius-organic-sm on cards', () => {
            expect(src).toContain('var(--radius-organic-sm)');
        });

        it('should use --shadow-card', () => {
            expect(src).toContain('var(--shadow-card)');
        });

        it('should use --core-foreground and --core-muted-foreground tokens', () => {
            expect(src).toContain('var(--core-foreground)');
            expect(src).toContain('var(--core-muted-foreground)');
        });

        it('should clamp description to 2 lines', () => {
            expect(src).toContain('-webkit-line-clamp: 2');
        });
    });
});
