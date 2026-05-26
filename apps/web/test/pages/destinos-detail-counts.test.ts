/**
 * @file destinos-detail-counts.test.ts
 * @description Source-based assertions for T-045: real accommodation and event
 * counts on the destination detail catch-all page.
 *
 * Verifies that the page issues parallel count queries and renders the stat
 * values in the sidebar (no more TODO placeholder).
 *
 * Astro components cannot be rendered in Vitest — we assert against source text.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = resolve(__dirname, '../../src');

const src = readFileSync(resolve(SRC_DIR, 'pages/[lang]/destinos/[...path].astro'), 'utf8');

describe('destinos/[...path].astro — real counts (T-045)', () => {
    describe('Parallel data fetching', () => {
        it('uses Promise.all for parallel queries', () => {
            expect(src).toContain('Promise.all');
        });

        it('fetches accommodation count separately from preview list', () => {
            // The page should call getByDestination twice (preview + count)
            const occurrences = (src.match(/getByDestination/g) ?? []).length;
            expect(occurrences).toBeGreaterThanOrEqual(2);
        });

        it('fetches events for the destination using destinationId filter', () => {
            expect(src).toContain('destinationId: destId');
        });
    });

    describe('Count variables', () => {
        it('declares accCount variable', () => {
            expect(src).toContain('accCount');
        });

        it('declares eventsCount variable', () => {
            expect(src).toContain('eventsCount');
        });

        it('extracts the total count via the extractTotal helper', () => {
            // The page now uses extractTotal which handles both pagination.total
            // and bare-array length fallbacks for endpoints (like accommodations
            // by destination) that don't ship pagination metadata.
            expect(src).toContain('extractTotal(');
        });
    });

    describe('Sidebar rendering', () => {
        it('delegates the sidebar to DestinationStatsCard', () => {
            expect(src).toContain('DestinationStatsCard');
            expect(src).toContain('<DestinationStatsCard');
        });

        it('feeds the stats card with locally derived counts as fallback', () => {
            // When the dedicated stats endpoint fails, the page falls back to
            // accCount / eventsCount / attractions.length to keep the sidebar populated.
            expect(src).toContain('accommodationsCount: accCount');
            expect(src).toContain('eventsCount');
            expect(src).toContain('attractionsCount');
        });

        it('does NOT have a TODO placeholder for stats anymore', () => {
            expect(src).not.toContain('statsPlaceholder');
        });

        it('does NOT inline the i18n keys for stat labels (delegated to component)', () => {
            // Stat labels are owned by DestinationStatsCard; the page should not
            // duplicate them.
            expect(src).not.toContain("t('destinations.detail.accommodationsCount'");
            expect(src).not.toContain("t('destinations.detail.eventsCount'");
        });
    });

    describe('New section components are wired', () => {
        it('imports DestinationGallery and DestinationReviewsSection (which encapsulates RatingBreakdown)', () => {
            expect(src).toContain('DestinationGallery');
            expect(src).toContain('DestinationReviewsSection');
        });

        it('imports DestinationFaqAccordion (SPEC-158) and DestinationClimatePlaceholder', () => {
            expect(src).toContain('DestinationFaqAccordion');
            expect(src).toContain('DestinationClimatePlaceholder');
        });

        it('wires the FAQ accordion + FAQPage JSON-LD behind a faqs guard (SPEC-158)', () => {
            expect(src).toContain('toDestinationFaqs');
            expect(src).toContain('FAQPageJsonLd');
            expect(src).toContain('faqs.length > 0');
        });

        it('fetches aggregated stats via destinationsApi.getStats', () => {
            expect(src).toContain('destinationsApi.getStats');
        });
    });
});
