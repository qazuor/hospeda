/**
 * @file experiencias-index.test.ts
 * @description Source-read tests for the experiences listing page (SPEC-240 T-030).
 * Astro pages cannot be rendered in Vitest — we assert on source structure.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/experiencias/index.astro'),
    'utf8'
);

describe('experiencias/index.astro', () => {
    describe('locale', () => {
        it('reads locale from Astro.locals.locale, not Astro.params.lang', () => {
            expect(src).toContain('Astro.locals.locale');
            expect(src).not.toContain('Astro.params.lang');
        });
    });

    describe('SSR', () => {
        it('does NOT set prerender=true (must be SSR)', () => {
            expect(src).not.toContain('prerender = true');
        });
    });

    describe('API calls', () => {
        it('imports and calls experiencesApi.list for the listing', () => {
            expect(src).toContain('experiencesApi');
            expect(src).toContain('experiencesApi.list');
        });

        it('passes page and pageSize to experiencesApi.list', () => {
            expect(src).toContain('page,');
            expect(src).toContain('pageSize,');
        });

        it('passes the q (search) filter', () => {
            expect(src).toContain('q,');
        });

        it('passes destinationId filter', () => {
            expect(src).toContain('destinationId,');
        });

        it('passes type filter', () => {
            expect(src).toContain('type,');
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
        it('transforms list items via toExperienceCardProps before rendering', () => {
            expect(src).toContain('toExperienceCardProps');
        });
    });

    describe('rendering', () => {
        it('renders ExperienceCard for each listing', () => {
            expect(src).toContain('ExperienceCard');
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

        it('renders FilterSidebar with filter groups', () => {
            expect(src).toContain('FilterSidebar');
            expect(src).toContain('filters={filterGroups}');
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
        it('uses experience i18n namespace for page title', () => {
            expect(src).toContain('experience.listing.title');
        });

        it('uses experience.type for type filter labels', () => {
            expect(src).toContain('experience.type.');
        });
    });

    describe('layout', () => {
        it('uses ListingLayout', () => {
            expect(src).toContain('ListingLayout');
        });

        it('uses Breadcrumbs', () => {
            expect(src).toContain('Breadcrumbs');
        });
    });
});
