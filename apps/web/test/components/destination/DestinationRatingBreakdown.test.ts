/**
 * @file DestinationRatingBreakdown.test.ts
 * @description Source-based assertions for DestinationRatingBreakdown.astro.
 * Astro components cannot be DOM-rendered in Vitest; we assert on source content.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/destination/DestinationRatingBreakdown.astro'),
    'utf8'
);

describe('DestinationRatingBreakdown.astro', () => {
    describe('imports', () => {
        it('should import createTranslations from @/lib/i18n', () => {
            expect(src).toContain("from '@/lib/i18n'");
            expect(src).toContain('createTranslations');
        });

        it('should import SupportedLocale type', () => {
            expect(src).toContain('SupportedLocale');
        });
    });

    describe('props', () => {
        it('should declare rating as nullable/undefined Record', () => {
            expect(src).toContain('readonly rating:');
            expect(src).toContain('null | undefined');
        });

        it('should declare locale as readonly SupportedLocale', () => {
            expect(src).toContain('readonly locale: SupportedLocale');
        });
    });

    describe('rendering', () => {
        it('should return early when rating is null/undefined', () => {
            expect(src).toContain('if (!rating) return');
        });

        it('should return early when all dimension values are 0', () => {
            expect(src).toContain('activeDimensions.length === 0');
            expect(src).toContain('return');
        });

        it('should filter only dimensions with value > 0', () => {
            expect(src).toContain('val > 0');
        });

        it('should compute percentage as value / 5 * 100', () => {
            expect(src).toContain('/ 5) * 100');
        });

        it('should render a bar fill with inline width style', () => {
            expect(src).toContain('width: ${pct}%');
        });

        it('should render numeric value with one decimal place', () => {
            expect(src).toContain('value.toFixed(1)');
        });
    });

    describe('dimension keys', () => {
        it('should include landscape and gastronomy dimensions', () => {
            expect(src).toContain("'landscape'");
            expect(src).toContain("'gastronomy'");
        });

        it('should include beaches and infrastructure dimensions', () => {
            expect(src).toContain("'beaches'");
            expect(src).toContain("'infrastructure'");
        });

        it('should provide Spanish fallback labels for dimensions', () => {
            expect(src).toContain('Paisaje');
            expect(src).toContain('Gastronomía');
            expect(src).toContain('Playas');
            expect(src).toContain('Infraestructura');
        });
    });

    describe('i18n', () => {
        it('should call createTranslations(locale)', () => {
            expect(src).toContain('createTranslations(locale)');
        });

        it('should use t() for dimension labels with key prefix', () => {
            expect(src).toContain('t(`destination.rating.dimensions.${key}`');
        });
    });

    describe('accessibility', () => {
        it('should use role="meter" on bar tracks', () => {
            expect(src).toContain('role="meter"');
        });

        it('should set aria-valuenow, aria-valuemin, aria-valuemax', () => {
            expect(src).toContain('aria-valuenow={value}');
            expect(src).toContain('aria-valuemin={0}');
            expect(src).toContain('aria-valuemax={5}');
        });

        it('should set aria-label on each bar track', () => {
            expect(src).toContain('aria-label={`${label}:');
        });
    });

    describe('styling', () => {
        it('should use CSS custom properties only (no hardcoded hex colors)', () => {
            expect(src).toContain('var(--');
            expect(src).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
        });

        it('should use --brand-accent for bar fill', () => {
            expect(src).toContain('var(--brand-accent)');
        });

        it('should use --radius-pill on bar tracks', () => {
            expect(src).toContain('var(--radius-pill)');
        });

        it('should use 2-column layout on desktop', () => {
            expect(src).toContain('repeat(2, minmax(0, 1fr))');
        });
    });
});
