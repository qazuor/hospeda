/**
 * @file publicaciones-skeleton-swap.test.ts
 * @description Source-read assertions for the data-filters-loading skeleton-swap
 * pattern on the publicaciones listing page (SPEC-228 T-008).
 *
 * Covers:
 * - PostGridSkeleton is imported and rendered in the new filter-loading path.
 * - The existing ArticleCardSkeleton usage in the error branch is untouched.
 * - CSS selectors hide the real grid and show the skeleton block when
 *   `html[data-filters-loading]` is set.
 *
 * Astro pages cannot be rendered in Vitest — we assert on source text.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/publicaciones/index.astro'),
    'utf8'
);

describe('publicaciones/index.astro — skeleton-swap (SPEC-228 T-008)', () => {
    describe('imports', () => {
        it('imports PostGridSkeleton from skeletons dir', () => {
            expect(src).toContain(
                "import PostGridSkeleton from '@/components/skeletons/PostGridSkeleton.astro'"
            );
        });

        it('still imports ArticleCardSkeleton (error branch must be untouched)', () => {
            expect(src).toContain(
                "import ArticleCardSkeleton from '@/components/shared/cards/ArticleCardSkeleton.astro'"
            );
        });
    });

    describe('skeleton block', () => {
        it('renders a PostGridSkeleton wrapper with aria-hidden', () => {
            expect(src).toContain('class="posts-grid-skeleton"');
            expect(src).toContain('aria-hidden="true"');
        });

        it('uses PostGridSkeleton inside the filter-loading wrapper', () => {
            expect(src).toContain('<PostGridSkeleton />');
        });

        it('skeleton block is sibling to the real posts-grid', () => {
            const gridIdx = src.indexOf('class="posts-grid"');
            const skeletonIdx = src.indexOf('class="posts-grid-skeleton"');
            expect(gridIdx).toBeGreaterThan(-1);
            expect(skeletonIdx).toBeGreaterThan(-1);
            // skeleton wrapper appears after the real grid within the same branch
            expect(skeletonIdx).toBeGreaterThan(gridIdx);
        });
    });

    describe('error branch — ArticleCardSkeleton untouched', () => {
        it('error branch still renders ArticleCardSkeleton', () => {
            expect(src).toContain('<ArticleCardSkeleton />');
        });

        it('ArticleCardSkeleton is NOT inside the posts-grid-skeleton wrapper', () => {
            const skeletonWrapperIdx = src.indexOf('class="posts-grid-skeleton"');
            const articleSkeletonIdx = src.indexOf('<ArticleCardSkeleton />');
            // ArticleCardSkeleton must appear BEFORE the posts-grid-skeleton wrapper
            // (it lives in the earlier error branch, not in the filter-loading block)
            expect(articleSkeletonIdx).toBeGreaterThan(-1);
            expect(skeletonWrapperIdx).toBeGreaterThan(-1);
            expect(articleSkeletonIdx).toBeLessThan(skeletonWrapperIdx);
        });
    });

    describe('CSS — data-filters-loading toggle', () => {
        it('hides the real grid when html[data-filters-loading] is set', () => {
            expect(src).toContain(':global([data-filters-loading]) .posts-grid');
        });

        it('shows the skeleton block when html[data-filters-loading] is set', () => {
            expect(src).toContain(':global([data-filters-loading]) .posts-grid-skeleton');
        });

        it('skeleton block is hidden by default (display: none)', () => {
            const defaultHideIdx = src.indexOf('.posts-grid-skeleton {\n        display: none;');
            const toggleIdx = src.indexOf(':global([data-filters-loading]) .posts-grid-skeleton');
            expect(defaultHideIdx).toBeGreaterThan(-1);
            expect(toggleIdx).toBeGreaterThan(-1);
            expect(toggleIdx).toBeGreaterThan(defaultHideIdx);
        });
    });
});
