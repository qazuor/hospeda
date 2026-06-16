/**
 * @file DestinationClimatePlaceholder.test.ts
 * @description Source-based assertions for DestinationClimateCard.astro.
 * The placeholder was replaced by DestinationClimateCard in SPEC-215.
 * Astro components cannot be DOM-rendered in Vitest; we assert on source content.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/destination/DestinationClimateCard.astro'),
    'utf8'
);

describe('DestinationClimateCard.astro', () => {
    describe('imports', () => {
        it('should import createTranslations from @/lib/i18n', () => {
            expect(src).toContain("from '@/lib/i18n'");
            expect(src).toContain('createTranslations');
        });

        it('should import SupportedLocale type', () => {
            expect(src).toContain('SupportedLocale');
        });

        it('should import DestinationWeatherIsland', () => {
            expect(src).toContain('DestinationWeatherIsland');
        });
    });

    describe('props', () => {
        it('should declare locale as readonly SupportedLocale', () => {
            expect(src).toContain('readonly locale: SupportedLocale');
        });

        it('should declare destinationId prop', () => {
            expect(src).toContain('readonly destinationId: string');
        });

        it('should declare apiUrl prop', () => {
            expect(src).toContain('readonly apiUrl: string');
        });

        it('should declare climate prop nullable', () => {
            expect(src).toContain('readonly climate: ClimateInput | null');
        });
    });

    describe('rendering', () => {
        it('should render the card title via t()', () => {
            expect(src).toContain("t('destination.climate.title'");
        });

        it('should wire DestinationWeatherIsland with client:idle', () => {
            expect(src).toContain('client:idle');
            expect(src).toContain('<DestinationWeatherIsland');
        });

        it('should pass locale, destinationId and apiUrl to the island', () => {
            expect(src).toContain('locale={locale}');
            expect(src).toContain('destinationId={destinationId}');
            expect(src).toContain('apiUrl={apiUrl}');
        });
    });

    describe('i18n', () => {
        it('should call createTranslations(locale)', () => {
            expect(src).toContain('createTranslations(locale)');
        });
    });

    describe('accessibility', () => {
        it('should include aria-labelledby on the section', () => {
            expect(src).toContain('aria-labelledby="dest-climate-card-title"');
        });

        it('should provide matching id on the section title', () => {
            expect(src).toContain('id="dest-climate-card-title"');
        });
    });

    describe('styling', () => {
        it('should use CSS custom properties only (no hardcoded hex colors)', () => {
            expect(src).toContain('var(--');
            expect(src).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
        });

        it('should use --radius-card on the card container', () => {
            expect(src).toContain('var(--radius-card');
        });

        it('should use --core-card for card background', () => {
            expect(src).toContain('var(--core-card)');
        });

        it('should use --font-heading for the title', () => {
            expect(src).toContain('var(--font-heading)');
        });

        it('should use --brand-primary for season name', () => {
            expect(src).toContain('var(--brand-primary)');
        });
    });
});
