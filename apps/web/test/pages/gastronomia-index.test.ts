/**
 * @file gastronomia-index.test.ts
 * @description Source-read tests for the gastronomy listing page (SPEC-239 T-053).
 * Astro pages cannot be rendered in Vitest — we assert on source structure.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/gastronomia/index.astro'),
    'utf8'
);

describe('gastronomia/index.astro', () => {
    describe('locale', () => {
        it('reads locale from Astro.locals.locale, not Astro.params.lang', () => {
            expect(src).toContain('Astro.locals.locale');
            expect(src).not.toContain('Astro.params.lang');
        });
    });

    describe('API calls', () => {
        it('imports and calls gastronomyApi.list for the listing', () => {
            expect(src).toContain('gastronomyApi');
            expect(src).toContain('gastronomyApi.list');
        });

        it('passes page and pageSize to gastronomyApi.list', () => {
            expect(src).toContain('page,');
            expect(src).toContain('pageSize,');
        });

        it('passes the q (search) filter to gastronomyApi.list', () => {
            expect(src).toContain('q,');
        });

        it('passes destinationId filter', () => {
            expect(src).toContain('destinationId,');
        });

        it('passes type filter', () => {
            expect(src).toContain('type,');
        });

        it('passes priceRange filter', () => {
            expect(src).toContain('priceRange,');
        });

        it('passes isFeatured filter', () => {
            expect(src).toContain('isFeatured,');
        });

        it('passes minRating filter', () => {
            expect(src).toContain('minRating,');
        });

        it('fetches destinations for the filter dropdown', () => {
            expect(src).toContain('destinationsApi');
            expect(src).toContain('destinationsApi.list');
        });
    });

    describe('transform', () => {
        it('transforms list items via toGastronomyCardProps before rendering', () => {
            expect(src).toContain('toGastronomyCardProps');
        });
    });

    describe('rendering', () => {
        it('renders GastronomyCard for each card', () => {
            expect(src).toContain('GastronomyCard');
        });

        it('passes eager prop for first 3 cards', () => {
            expect(src).toContain('eager={i < 3}');
        });

        it('renders EmptyState when no results', () => {
            expect(src).toContain('EmptyState');
        });

        it('renders ErrorBanner on fetch failure', () => {
            expect(src).toContain('ErrorBanner');
        });

        it('renders Pagination when totalPages > 1', () => {
            expect(src).toContain('Pagination');
            expect(src).toContain('totalPages > 1');
        });

        it('renders FilterSidebar with filters and sortOptions', () => {
            expect(src).toContain('FilterSidebar');
            expect(src).toContain('filters={filterGroups}');
            expect(src).toContain('sortOptions={sortOptions}');
        });
    });

    describe('filter groups', () => {
        it('includes a search (q) filter group', () => {
            expect(src).toContain("id: 'q'");
        });

        it('includes a destinationId select-search filter', () => {
            expect(src).toContain("id: 'destinationId'");
            expect(src).toContain("type: 'select-search'");
        });

        it('includes a type checkbox filter', () => {
            expect(src).toContain("id: 'type'");
            expect(src).toContain("type: 'checkbox'");
        });

        it('includes a priceRange checkbox filter', () => {
            expect(src).toContain("id: 'priceRange'");
        });

        it('includes a toggle for isFeatured', () => {
            expect(src).toContain("id: 'isFeatured'");
            expect(src).toContain("type: 'toggle'");
        });

        it('includes a stars filter for minRating', () => {
            expect(src).toContain("id: 'minRating'");
            expect(src).toContain("type: 'stars'");
        });
    });

    describe('i18n', () => {
        it('uses gastronomy i18n namespace for page title', () => {
            expect(src).toContain('gastronomy.listing.title');
        });

        it('uses gastronomy.types for type filter labels', () => {
            expect(src).toContain('gastronomy.types.');
        });

        it('uses gastronomy.card.priceRange for price range labels', () => {
            expect(src).toContain('gastronomy.card.priceRange.');
        });
    });

    describe('layout', () => {
        it('uses ListingLayout', () => {
            expect(src).toContain('ListingLayout');
        });

        it('uses showFilters=true with left filter position', () => {
            expect(src).toContain('showFilters={true}');
            expect(src).toContain('filterPosition="left"');
        });

        it('uses Breadcrumbs', () => {
            expect(src).toContain('Breadcrumbs');
        });
    });

    describe('SSR', () => {
        it('does NOT set prerender=true (must be SSR)', () => {
            expect(src).not.toContain('prerender = true');
        });
    });
});
