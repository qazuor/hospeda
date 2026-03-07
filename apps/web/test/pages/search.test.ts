/**
 * @file search.test.ts
 * @description Source-content tests for busqueda.astro.
 * Validates search form structure, multi-entity results grid, API call
 * patterns, empty state, popular searches, and semantic token usage.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(__dirname, '../../src/pages/[lang]/busqueda.astro'), 'utf8');

describe('busqueda.astro — search results page', () => {
    describe('rendering strategy', () => {
        it('has prerender = false for SSR', () => {
            expect(src).toContain('export const prerender = false');
        });
    });

    describe('layout and SEO', () => {
        it('uses BaseLayout', () => {
            expect(src).toContain('BaseLayout');
        });

        it('uses SEOHead', () => {
            expect(src).toContain('SEOHead');
        });

        it('sets noindex to avoid indexing search result pages', () => {
            expect(src).toContain('noindex={true}');
        });

        it('builds canonical URL', () => {
            expect(src).toContain('canonicalUrl');
        });
    });

    describe('imports and dependencies', () => {
        it('imports Breadcrumb', () => {
            expect(src).toContain('Breadcrumb');
        });

        it('imports EmptyState', () => {
            expect(src).toContain('EmptyState');
        });

        it('imports AccommodationCard', () => {
            expect(src).toContain('AccommodationCard');
        });

        it('imports DestinationCard', () => {
            expect(src).toContain('DestinationCard');
        });

        it('imports EventCard', () => {
            expect(src).toContain('EventCard');
        });

        it('imports FeaturedArticleCard', () => {
            expect(src).toContain('FeaturedArticleCard');
        });

        it('imports SearchIcon from @repo/icons', () => {
            expect(src).toContain('SearchIcon');
            expect(src).toContain("from '@repo/icons'");
        });

        it('imports all four entity API wrappers', () => {
            expect(src).toContain('accommodationsApi');
            expect(src).toContain('destinationsApi');
            expect(src).toContain('eventsApi');
            expect(src).toContain('postsApi');
        });

        it('imports all four entity transform helpers', () => {
            expect(src).toContain('toAccommodationCardProps');
            expect(src).toContain('toDestinationCardProps');
            expect(src).toContain('toEventCardProps');
            expect(src).toContain('toPostCardProps');
        });
    });

    describe('locale validation', () => {
        it('calls getLocaleFromParams', () => {
            expect(src).toContain('getLocaleFromParams(Astro.params)');
        });

        it('redirects on invalid locale', () => {
            expect(src).toContain("Astro.redirect('/es/busqueda/')");
        });
    });

    describe('search query extraction', () => {
        it('reads query from Astro.url.searchParams', () => {
            expect(src).toContain("Astro.url.searchParams.get('q')");
        });

        it('defaults to empty string when q is absent', () => {
            expect(src).toContain("?? ''");
        });
    });

    describe('search form', () => {
        it('renders form with GET method', () => {
            expect(src).toContain('method="GET"');
        });

        it('form action points to busqueda URL', () => {
            expect(src).toContain("path: 'busqueda'");
        });

        it('renders search input with name q', () => {
            expect(src).toContain('name="q"');
        });

        it('renders search input with type search', () => {
            expect(src).toContain('type="search"');
        });

        it('renders search input with aria-label', () => {
            expect(src).toContain('aria-label={searchPlaceholder}');
        });

        it('marks input as required', () => {
            expect(src).toContain('required');
        });
    });

    describe('parallel API calls', () => {
        it('runs all four API calls in parallel with Promise.all', () => {
            expect(src).toContain('Promise.all');
            expect(src).toContain('accommodationsApi.list');
            expect(src).toContain('destinationsApi.list');
            expect(src).toContain('eventsApi.list');
            expect(src).toContain('postsApi.list');
        });

        it('limits each API call to 6 results', () => {
            const matches = src.match(/pageSize: 6/g) ?? [];
            expect(matches.length).toBeGreaterThanOrEqual(4);
        });

        it('only runs API calls when query is present', () => {
            expect(src).toContain('if (query)');
        });
    });

    describe('results display', () => {
        it('computes totalResults from all entity arrays', () => {
            expect(src).toContain('totalResults');
            expect(src).toContain('accommodations.length');
            expect(src).toContain('destinations.length');
            expect(src).toContain('events.length');
            expect(src).toContain('posts.length');
        });

        it('renders accommodations section with aria-labelledby', () => {
            expect(src).toContain('aria-labelledby="accommodations-heading"');
        });

        it('renders destinations section with aria-labelledby', () => {
            expect(src).toContain('aria-labelledby="destinations-heading"');
        });

        it('renders events section with aria-labelledby', () => {
            expect(src).toContain('aria-labelledby="events-heading"');
        });

        it('renders posts section with aria-labelledby', () => {
            expect(src).toContain('aria-labelledby="posts-heading"');
        });

        it('renders view-all links for each entity type', () => {
            expect(src).toContain('viewAllAccommodations');
            expect(src).toContain('viewAllDestinations');
            expect(src).toContain('viewAllEvents');
            expect(src).toContain('viewAllPosts');
        });
    });

    describe('empty state', () => {
        it('renders EmptyState when no results found', () => {
            expect(src).toContain('EmptyState');
            expect(src).toContain('emptyStateTitle');
        });
    });

    describe('popular searches', () => {
        it('shows popular searches section when no query is provided', () => {
            expect(src).toContain('popularSearches');
            expect(src).toContain('popularSearchesHeading');
        });

        it('filters out popular searches with empty labels', () => {
            expect(src).toContain('.filter((s) => Boolean(s.label))');
        });

        it('builds popular search URLs with buildUrlWithParams', () => {
            expect(src).toContain('buildUrlWithParams');
        });
    });

    describe('semantic tokens — no hardcoded colors', () => {
        it('does not use bg-white', () => {
            expect(src).not.toContain('bg-white');
        });

        it('does not use text-gray-', () => {
            expect(src).not.toContain('text-gray-');
        });

        it('uses semantic token text-foreground', () => {
            expect(src).toContain('text-foreground');
        });

        it('uses semantic token text-muted-foreground', () => {
            expect(src).toContain('text-muted-foreground');
        });

        it('uses semantic token border-border', () => {
            expect(src).toContain('border-border');
        });

        it('uses semantic token bg-background', () => {
            expect(src).toContain('bg-background');
        });
    });

    describe('breadcrumb', () => {
        it('renders Breadcrumb component', () => {
            expect(src).toContain('<Breadcrumb items={breadcrumbItems}');
        });

        it('includes busqueda path in breadcrumb', () => {
            expect(src).toContain("path: 'busqueda'");
        });
    });
});
