/**
 * @file DestinationRating.test.ts
 * @description Source-based assertions for DestinationRating.astro.
 * Astro components cannot be DOM-rendered in Vitest, so we verify by reading
 * the source file and asserting on its contents — the same pattern used for
 * sibling card components.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../../src/components/shared/cards/DestinationRating.astro'),
    'utf8'
);

describe('DestinationRating.astro', () => {
    describe('imports', () => {
        it('should import StarIcon from @repo/icons', () => {
            expect(src).toContain("from '@repo/icons'");
            expect(src).toContain('StarIcon');
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
        it('should declare averageRating as readonly number', () => {
            expect(src).toContain('readonly averageRating: number');
        });

        it('should declare reviewsCount as readonly number', () => {
            expect(src).toContain('readonly reviewsCount: number');
        });

        it('should declare locale as readonly SupportedLocale', () => {
            expect(src).toContain('readonly locale: SupportedLocale');
        });

        it('should declare onDark as optional readonly boolean', () => {
            expect(src).toContain('readonly onDark?: boolean');
        });

        it('should declare size as optional readonly number', () => {
            expect(src).toContain('readonly size?: number');
        });
    });

    describe('rendering', () => {
        it('should render 5 StarIcon glyphs', () => {
            expect(src).toContain('Array.from({ length: 5 })');
            expect(src).toContain('<StarIcon');
        });

        it('should switch StarIcon weight between fill and regular based on fullStars', () => {
            expect(src).toContain("weight={i < fullStars ? 'fill' : 'regular'}");
        });

        it('should display averageRating as a decimal with one fractional digit', () => {
            expect(src).toContain('averageRating.toFixed(1)');
        });

        it('should conditionally render reviews count when reviewsCount > 0', () => {
            expect(src).toContain('reviewsCount > 0');
            expect(src).toContain('reviewsCount');
        });
    });

    describe('i18n', () => {
        it('should use createTranslations(locale)', () => {
            expect(src).toContain('createTranslations(locale)');
        });

        it('should use t() for the rating aria-label', () => {
            expect(src).toContain("t('destination.card.rating.label'");
            expect(src).toContain("t('destination.card.rating.of5'");
        });

        it('should use t() for the reviews label', () => {
            expect(src).toContain("t('common.reviews'");
        });
    });

    describe('accessibility', () => {
        it('should expose an aria-label on the rating container', () => {
            expect(src).toContain('aria-label={ariaLabel}');
        });

        it('should mark each star as aria-hidden', () => {
            expect(src).toContain('aria-hidden="true"');
        });
    });

    describe('styling', () => {
        it('should use CSS custom properties (no hardcoded hex colors)', () => {
            expect(src).toContain('var(--');
            expect(src).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
        });

        it('should expose a dest-rating--on-dark modifier for overlay surfaces', () => {
            expect(src).toContain('dest-rating--on-dark');
        });

        it('should use --rating-star token for filled stars', () => {
            expect(src).toContain('var(--rating-star)');
        });
    });
});
