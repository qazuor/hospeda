import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildListingSummary } from '../../src/lib/listing-results';

function source(path: string): string {
    return readFileSync(resolve(__dirname, '../../src', path), 'utf8');
}

describe('listing audit', () => {
    it('localizes the result noun and suppresses zero-result captions', () => {
        expect(buildListingSummary({ locale: 'es', kind: 'accommodations', count: 8 })).toBe(
            '8 alojamientos'
        );
        expect(buildListingSummary({ locale: 'en', kind: 'events', count: 1 })).toBe('1 event');
        expect(buildListingSummary({ locale: 'pt', kind: 'posts', count: 2 })).toBe('2 artigos');
        expect(
            buildListingSummary({ locale: 'es', kind: 'accommodations', count: 0 })
        ).toBeUndefined();
        expect(
            buildListingSummary({ locale: 'es', kind: 'venues', count: 3, facetLabel: 'noche' })
        ).toBe('Mostrando 3 locales de noche');
    });

    it('puts sorting in the grid toolbar without a viewport-height floor', () => {
        const layout = source('layouts/ListingLayout.astro');

        expect(layout).toMatch(/class="listing-toolbar"[\s\S]*<ListingSort/);
        expect(layout).not.toMatch(/min-height:\s*calc\(100vh/);
    });

    it('uses the same located set for map results and links to the list when needed', () => {
        const map = source('pages/[lang]/alojamientos/mapa.astro');

        expect(map).toContain('totalCount={locatedCount}');
        expect(map).toContain('filteredLocatedCount={locatedCount}');
        expect(map).toContain('initialItems={locatedCards}');
        expect(source('components/maps/AccommodationsListingMap.client.tsx')).not.toContain(
            'caption.textContent'
        );
        expect(map).toMatch(/unlocatedCount > 0[\s\S]*href=\{listHref\}/);
    });

    it('never displays the destination filter banner while hidden', () => {
        const listing = source('pages/[lang]/destinos/index.astro');

        expect(listing).toContain('hidden={!showEmptyBanner}');
        expect(listing).toMatch(/\.dest-listing__empty-filter:not\(\[hidden\]\)\s*\{/);
        expect(listing).not.toMatch(/\.dest-listing__empty-filter\s*\{/);
    });

    it('hides zero accommodation counts and limits destination attraction chips', () => {
        const card = source('components/shared/cards/DestinationCard.astro');
        const stats = source('components/destination/DestinationStatsCard.astro');

        expect(card).toContain('destination.accommodationsCount > 0');
        expect(card.match(/accommodationsLabel && </g)).toHaveLength(2);
        expect(stats).toContain('if (stats.accommodationsCount > 0)');
    });

    it('keeps the destination card within 500 lines and delegates the attraction variant', () => {
        const card = source('components/shared/cards/DestinationCard.astro');

        expect(card.trimEnd().split('\n').length).toBeLessThanOrEqual(500);
        expect(card).toContain('<DestinationCardAttractions');
        const attractions = source('components/shared/cards/DestinationCardAttractions.astro');
        expect(attractions).toContain('MAX_ATTRACTIONS_ON_CARD = 2');
        expect(attractions).toMatch(/\.dest-card__attraction\s*\{[^}]*font-size: 0\.75rem/);
    });

    it('uses the shared feedback implementation for authors and retires both legacy files', () => {
        const authors = source('pages/[lang]/autores/[slug]/index.astro');

        expect(authors).toContain("from '@/components/shared/feedback/EmptyState.astro'");
        expect(authors).toMatch(/<EmptyState[\s\S]*title=[\s\S]*message=[\s\S]*actionLabel=/);
        for (const name of ['EmptyState', 'ErrorBanner']) {
            expect(existsSync(resolve(__dirname, `../../src/components/${name}.astro`))).toBe(
                false
            );
        }
    });

    it('keeps type navigation and an exit visible on empty type landings', () => {
        const listing = source('pages/[lang]/alojamientos/tipo/[type]/index.astro');

        expect(listing).toContain('noindex={hasError || total === 0}');
        expect(listing).toContain('actionUrl={allAccommodationsHref}');
        expect(listing.indexOf('<FilterChips')).toBeLessThan(listing.indexOf('<EmptyState'));
        expect(listing).toMatch(
            /href: buildAccommodationTypeChipHref\(\{[\s\S]*searchParams: url\.searchParams/
        );
    });

    it('shows a localized query-specific recovery message and a full-list action', () => {
        const listing = source('pages/[lang]/alojamientos/index.astro');
        const empty = source('components/shared/feedback/EmptyState.astro');

        expect(listing).toContain(
            "t('ui.listing.noAccommodationQuery', undefined, { query: q.trim() })"
        );
        expect(listing).toContain("actionLabel={t('ui.listing.allAccommodations')}");
        expect(empty).toMatch(/\.empty-state__chip\s*\{[^}]*min-height: 44px/);
        expect(empty).toMatch(/\.empty-state__suggestion-link\s*\{[^}]*min-height: 44px/);
    });

    it('uses the shared active-facet control for the event and venue routes', () => {
        const event = source('pages/[lang]/eventos/categoria/[category]/index.astro');
        const venue = source('pages/[lang]/comer-y-salir/rubro/[rubro]/index.astro');

        expect(event).toMatch(
            /<ActiveFacet[^>]*label=\{categoryName\}[^>]*clearHref=\{allEventsHref\}/
        );
        expect(venue).toMatch(
            /<ActiveFacet[^>]*label=\{businessLineLabel\}[^>]*clearHref=\{listBaseUrl\}/
        );
        expect(venue).toContain("type: 'section-header', label: businessLineLabel");
    });

    it('gives attraction pages an explanatory subtitle and centers sparse rows', () => {
        const attraction = source('pages/[lang]/destinos/atraccion/[slug]/index.astro');
        const index = source('pages/[lang]/destinos/index.astro');

        expect(attraction).toContain("subtitle={t('destinations.byAttraction.subtitle'");
        expect(attraction).toMatch(/\.dest-grid\s*\{[^}]*justify-content: center/);
        expect(index).toContain("t('destinations.byAttraction.filterTitle')");
    });

    it('offers geographic search from empty destination accommodation previews', () => {
        const detail = source('pages/[lang]/destinos/[...path].astro');

        expect(detail).toMatch(
            /latitude: String\(destLat\), longitude: String\(destLng\), radius: '50', sortBy: 'distance'/
        );
        expect(detail).toContain(
            "nearbyStaysHref ? 'ui.listing.nearbyAccommodations' : 'ui.listing.allAccommodations'"
        );
        expect(detail).toMatch(
            /class="btn-gradient btn-gradient--outline-primary" href=\{nearbyStaysHref/
        );
    });
});
