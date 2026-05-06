/**
 * @file DestinationStatsCard.test.ts
 * @description Source-based assertions for DestinationStatsCard.astro.
 * Astro components cannot be DOM-rendered in Vitest; we assert on source content.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/destination/DestinationStatsCard.astro'),
    'utf8'
);

describe('DestinationStatsCard.astro', () => {
    describe('imports', () => {
        it('should import icon components from @repo/icons', () => {
            expect(src).toContain("from '@repo/icons'");
            expect(src).toContain('BedroomsIcon');
            expect(src).toContain('CalendarIcon');
            expect(src).toContain('LocationIcon');
            expect(src).toContain('StarIcon');
            expect(src).toContain('ChatIcon');
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
        it('should declare stats with all required readonly fields', () => {
            expect(src).toContain('readonly accommodationsCount: number');
            expect(src).toContain('readonly reviewsCount: number');
            expect(src).toContain('readonly averageRating: number');
            expect(src).toContain('readonly attractionsCount: number');
            expect(src).toContain('readonly eventsCount: number');
        });

        it('should declare locale as readonly SupportedLocale', () => {
            expect(src).toContain('readonly locale: SupportedLocale');
        });
    });

    describe('rendering', () => {
        it('should always render the core count rows (accommodations, events, attractions)', () => {
            // The card stays visible even when counts are zero so the sidebar
            // is never silently empty. Rating + reviews stay conditional.
            expect(src).toContain("'destination.detail.stats.accommodations'");
            expect(src).toContain("'destination.detail.stats.events'");
            expect(src).toContain("'destination.detail.stats.attractions'");
        });

        it('should omit rating row when averageRating is 0', () => {
            expect(src).toContain('stats.averageRating > 0');
        });

        it('should omit reviews row when reviewsCount is 0', () => {
            expect(src).toContain('stats.reviewsCount > 0');
        });

        it('should format averageRating with one decimal', () => {
            expect(src).toContain('averageRating.toFixed(1)');
        });
    });

    describe('i18n', () => {
        it('should call createTranslations(locale)', () => {
            expect(src).toContain('createTranslations(locale)');
        });

        it('should use t() for card title with fallback', () => {
            expect(src).toContain("t('destination.detail.stats.title'");
            expect(src).toContain('En este destino');
        });

        it('should use t() for each stat label', () => {
            expect(src).toContain("t('destination.detail.stats.accommodations'");
            expect(src).toContain("t('destination.detail.stats.events'");
            expect(src).toContain("t('destination.detail.stats.attractions'");
            expect(src).toContain("t('destination.detail.stats.rating'");
            expect(src).toContain("t('destination.detail.stats.reviews'");
        });
    });

    describe('accessibility', () => {
        it('should mark decorative icons as aria-hidden', () => {
            expect(src).toContain('aria-hidden="true"');
        });

        it('should use role="list" on the stats list', () => {
            expect(src).toContain('role="list"');
        });
    });

    describe('styling', () => {
        it('should use CSS custom properties only (no hardcoded hex colors)', () => {
            expect(src).toContain('var(--');
            expect(src).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
        });

        it('should use --radius-card on the card', () => {
            expect(src).toContain('var(--radius-card)');
        });

        it('should use --shadow-card', () => {
            expect(src).toContain('var(--shadow-card)');
        });

        it('should use --brand-primary for icon color', () => {
            expect(src).toContain('var(--brand-primary)');
        });
    });
});
