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

        it('reads total from pagination response', () => {
            expect(src).toContain('pagination?.total');
        });
    });

    describe('Sidebar rendering', () => {
        it('renders accCount in the sidebar stat list', () => {
            expect(src).toContain('{accCount}');
        });

        it('renders eventsCount in the sidebar stat list', () => {
            expect(src).toContain('{eventsCount}');
        });

        it('does NOT have a TODO placeholder for stats anymore', () => {
            expect(src).not.toContain('statsPlaceholder');
        });

        it('uses i18n keys for stat labels', () => {
            expect(src).toContain("t('destinations.detail.accommodationsCount'");
            expect(src).toContain("t('destinations.detail.eventsCount'");
        });
    });
});
