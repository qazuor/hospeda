/**
 * @file eventos-skeleton-swap.test.ts
 * @description Source-read assertions for the data-filters-loading skeleton-swap
 * pattern on the eventos listing page (SPEC-228 T-007).
 *
 * Covers:
 * - The hidden skeleton block is rendered alongside the real events grid.
 * - CSS selectors hide the real grid and show the skeleton when
 *   `html[data-filters-loading]` is set.
 * - EventCardHorizontalSkeleton is imported and used inside the skeleton wrapper.
 *
 * Astro pages cannot be rendered in Vitest — we assert on source text.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(__dirname, '../../src/pages/[lang]/eventos/index.astro'), 'utf8');

describe('eventos/index.astro — skeleton-swap (SPEC-228 T-007)', () => {
    describe('imports', () => {
        it('imports EventCardHorizontalSkeleton from skeletons dir', () => {
            expect(src).toContain(
                "import EventCardHorizontalSkeleton from '@/components/skeletons/EventCardHorizontalSkeleton.astro'"
            );
        });
    });

    describe('skeleton block', () => {
        it('renders a skeleton wrapper with aria-hidden', () => {
            expect(src).toContain('class="events-grid-skeleton"');
            expect(src).toContain('aria-hidden="true"');
        });

        it('uses EventCardHorizontalSkeleton inside the wrapper', () => {
            expect(src).toContain('<EventCardHorizontalSkeleton />');
        });

        it('skeleton block is sibling to the real events-grid', () => {
            const gridIdx = src.indexOf('class="events-grid"');
            const skeletonIdx = src.indexOf('class="events-grid-skeleton"');
            expect(gridIdx).toBeGreaterThan(-1);
            expect(skeletonIdx).toBeGreaterThan(-1);
            // Both appear in the same cards.length > 0 branch — skeleton comes after the real grid
            expect(skeletonIdx).toBeGreaterThan(gridIdx);
        });
    });

    describe('CSS — data-filters-loading toggle', () => {
        it('hides the real grid when html[data-filters-loading] is set', () => {
            expect(src).toContain(':global([data-filters-loading]) .events-grid');
        });

        it('shows the skeleton grid when html[data-filters-loading] is set', () => {
            expect(src).toContain(':global([data-filters-loading]) .events-grid-skeleton');
        });

        it('skeleton grid is hidden by default (display: none)', () => {
            // The rule `.events-grid-skeleton { display: none; }` must precede the toggle
            const defaultHideIdx = src.indexOf('.events-grid-skeleton {\n\t\tdisplay: none;');
            const toggleIdx = src.indexOf(':global([data-filters-loading]) .events-grid-skeleton');
            expect(defaultHideIdx).toBeGreaterThan(-1);
            expect(toggleIdx).toBeGreaterThan(-1);
            expect(toggleIdx).toBeGreaterThan(defaultHideIdx);
        });
    });
});
