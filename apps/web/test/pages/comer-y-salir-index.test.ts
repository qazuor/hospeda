/**
 * @file gastronomia-index.test.ts
 * @description Source-read tests for the venue listing page (SPEC-239 T-053).
 * Astro pages cannot be rendered in Vitest — we assert on source structure.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/comer-y-salir/index.astro'),
    'utf8'
);

describe('comer-y-salir/index.astro', () => {
    describe('locale', () => {
        it('reads locale from Astro.locals.locale, not Astro.params.lang', () => {
            expect(src).toContain('Astro.locals.locale');
            expect(src).not.toContain('Astro.params.lang');
        });
    });

    describe('API calls', () => {
        it('imports and calls venueApi.list for the listing', () => {
            expect(src).toContain('venueApi');
            expect(src).toContain('venueApi.list');
        });

        it('passes page and pageSize to venueApi.list', () => {
            expect(src).toContain('page,');
            expect(src).toContain('pageSize,');
        });

        it('passes the q (search) filter to venueApi.list', () => {
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
        it('transforms list items via toVenueCardProps before rendering', () => {
            expect(src).toContain('toVenueCardProps');
        });
    });

    describe('rendering', () => {
        it('emits ItemList JSON-LD for the visible page of cards', () => {
            expect(src).toContain('ItemListJsonLd');
            expect(src).toContain('slot="head-extra"');
            expect(src).toContain('items={itemListEntries}');
        });

        it('renders VenueCard for each card', () => {
            expect(src).toContain('VenueCard');
        });

        it('passes eager prop for first 3 cards', () => {
            expect(src).toContain('eager={i < 3}');
        });

        it('renders EmptyState when no results', () => {
            expect(src).toContain('EmptyState');
        });

        it('splits filtered-empty vs empty-catalog states', () => {
            expect(src).toContain('hasActiveVenueListingFilters');
            expect(src).toContain('const hasActiveFilters = hasActiveVenueListingFilters({');
            expect(src).toContain('{!hasError && cards.length === 0 && hasActiveFilters && (');
            expect(src).toContain('{!hasError && cards.length === 0 && !hasActiveFilters && (');
            expect(src).toContain('venue.listing.emptyCatalog');
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

    describe('published-listing filters (HOS-1787 leaf 6.10, AC:6:11)', () => {
        it('fetches the whole-vertical filter options without a business line', () => {
            expect(src).toContain('venueApi.getFilterOptions()');
        });

        it('renders VenueFilterOptionsDegradation instead of calling the marker', () => {
            expect(src).toContain(
                "import VenueFilterOptionsDegradation from '@/components/venue/VenueFilterOptionsDegradation.astro';"
            );
            expect(src).toMatch(/<VenueFilterOptionsDegradation\s+failed=\{/);
            expect(src).not.toContain('markResponseDegraded');
            const helperImport = src.match(
                /import\s*\{([\s\S]*?)\}\s*from\s*'@\/lib\/venue\/venue-listing-filters'/
            );
            expect(helperImport, 'venue-listing-filters import not found').not.toBeNull();
            expect((helperImport?.[1] ?? '').includes('Degraded')).toBe(false);
        });

        it('passes the options, amenities and features failures to the component', () => {
            const start = src.indexOf('<VenueFilterOptionsDegradation');
            expect(start, '<VenueFilterOptionsDegradation not found').toBeGreaterThan(-1);
            const tag = src.slice(start, src.indexOf('/>', start) + 2);

            expect(tag).toContain('!filterOptionsResult.ok');
            expect(tag).toContain('!amenitiesResult.ok');
            expect(tag).toContain('!featuresResult.ok');
        });

        it('narrows the sidebar and type chips to published values', () => {
            expect(src).toContain('narrowVenueFilterCatalog(');
            expect(src).toContain('buildVenueFilterGroups(');
            expect(src).toContain('buildVenueTypeChips(');
            expect(src).not.toContain('VENUE_TYPE_OPTIONS');
        });

        it('reads and forwards the amenities filter', () => {
            expect(src).toContain("url.searchParams.get('amenities')");
            expect(src).toContain('amenities: amenitiesParam');
            expect(src).toContain('if (amenitiesParam) initialParams.amenities = amenitiesParam;');
        });
    });

    describe('i18n', () => {
        it('uses venue i18n namespace for page title', () => {
            expect(src).toContain('venue.listing.title');
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

    describe('business-line collections (HOS-1868)', () => {
        it('keeps the general listing unscoped by business line', () => {
            // The collection pages filter by line; the general listing must keep
            // showing every venue, so `businessLine` never reaches this call.
            expect(src).not.toMatch(/venueApi\.list\(\{[\s\S]*?\bbusinessLine\b/);
        });

        it('does not import the business-line collection helpers', () => {
            expect(src).not.toContain('business-line-collection');
        });
    });
});
