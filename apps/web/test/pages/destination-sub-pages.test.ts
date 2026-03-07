import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const paginationPath = resolve(__dirname, '../../src/pages/[lang]/destinos/page/[page].astro');
const accommodationsIndexPath = resolve(
    __dirname,
    '../../src/pages/[lang]/destinos/[slug]/alojamientos/index.astro'
);
const accommodationsPaginationPath = resolve(
    __dirname,
    '../../src/pages/[lang]/destinos/[slug]/alojamientos/page/[page].astro'
);

const paginationContent = readFileSync(paginationPath, 'utf8');
const accommodationsIndexContent = readFileSync(accommodationsIndexPath, 'utf8');
const accommodationsPaginationContent = readFileSync(accommodationsPaginationPath, 'utf8');

describe('[lang]/destinos/page/[page].astro', () => {
    describe('Locale handling', () => {
        it('should import getLocaleFromParams', () => {
            expect(paginationContent).toContain('getLocaleFromParams');
        });

        it('should redirect on invalid locale', () => {
            expect(paginationContent).toContain("Astro.redirect('/es/')");
        });
    });

    describe('Page param validation', () => {
        it('should parse page param as integer', () => {
            expect(paginationContent).toContain('Number.parseInt');
            expect(paginationContent).toContain("page || '1'");
        });

        it('should redirect on NaN or negative page value', () => {
            expect(paginationContent).toContain('Number.isNaN');
            expect(paginationContent).toContain('destinos/');
        });

        it('should redirect page 1 to canonical destinos base URL', () => {
            expect(paginationContent).toContain('pageNum === 1');
            expect(paginationContent).toContain('destinos/');
        });
    });

    describe('Rewrite behavior', () => {
        it('should rewrite pages >1 to destinos index with query param', () => {
            expect(paginationContent).toContain('Astro.rewrite');
            expect(paginationContent).toContain('?page=${pageNum}');
            expect(paginationContent).toContain('destinos/');
        });
    });
});

describe('[lang]/destinos/[slug]/alojamientos/index.astro', () => {
    describe('Rendering mode', () => {
        it('should be SSR (no prerender)', () => {
            expect(accommodationsIndexContent).not.toContain('export const prerender = true');
        });

        it('should not use getStaticPaths', () => {
            expect(accommodationsIndexContent).not.toContain('getStaticPaths');
        });
    });

    describe('Imports', () => {
        it('should import BaseLayout', () => {
            expect(accommodationsIndexContent).toContain('import BaseLayout from');
        });

        it('should import SEOHead', () => {
            expect(accommodationsIndexContent).toContain('import SEOHead from');
        });

        it('should import Breadcrumb from shared', () => {
            expect(accommodationsIndexContent).toContain('import Breadcrumb from');
            expect(accommodationsIndexContent).toContain('shared/Breadcrumb.astro');
        });

        it('should import AccommodationCard from shared', () => {
            expect(accommodationsIndexContent).toContain('import AccommodationCard from');
            expect(accommodationsIndexContent).toContain('shared/AccommodationCard.astro');
        });

        it('should import EmptyState from shared', () => {
            expect(accommodationsIndexContent).toContain('import EmptyState from');
        });

        it('should import Pagination from shared', () => {
            expect(accommodationsIndexContent).toContain('import Pagination from');
        });

        it('should import createT from i18n', () => {
            expect(accommodationsIndexContent).toContain('createT');
        });

        it('should import buildUrl from urls', () => {
            expect(accommodationsIndexContent).toContain('buildUrl');
        });

        it('should import destinationsApi', () => {
            expect(accommodationsIndexContent).toContain('destinationsApi');
        });

        it('should import toAccommodationCardProps transform', () => {
            expect(accommodationsIndexContent).toContain('toAccommodationCardProps');
        });
    });

    describe('Data fetching', () => {
        it('should resolve destination by slug from API', () => {
            expect(accommodationsIndexContent).toContain('destinationsApi.getBySlug');
            expect(accommodationsIndexContent).toContain('{ slug }');
        });

        it('should fetch accommodations for destination by id', () => {
            expect(accommodationsIndexContent).toContain('destinationsApi.getAccommodations');
            expect(accommodationsIndexContent).toContain('id: destinationId');
        });

        it('should get page from query string', () => {
            expect(accommodationsIndexContent).toContain('Astro.url.searchParams');
            expect(accommodationsIndexContent).toContain('const pageSize = 12');
        });

        it('should skip API call when destinationId is missing', () => {
            expect(accommodationsIndexContent).toContain('destinationId');
            expect(accommodationsIndexContent).toContain('if (destinationId)');
        });
    });

    describe('Locale handling', () => {
        it('should redirect on invalid locale', () => {
            expect(accommodationsIndexContent).toContain("Astro.redirect('/es/')");
        });

        it('should redirect when slug is missing', () => {
            expect(accommodationsIndexContent).toContain('!slug');
            expect(accommodationsIndexContent).toContain('destinos');
        });
    });

    describe('i18n', () => {
        it('should use createT for translations', () => {
            expect(accommodationsIndexContent).toContain('createT(locale)');
        });

        it('should translate accommodations page title', () => {
            expect(accommodationsIndexContent).toContain("'destination.accommodations.title'");
        });

        it('should use HOME_BREADCRUMB for breadcrumb', () => {
            expect(accommodationsIndexContent).toContain('HOME_BREADCRUMB');
        });
    });

    describe('Template structure', () => {
        it('should render BaseLayout with locale', () => {
            expect(accommodationsIndexContent).toContain('<BaseLayout');
            expect(accommodationsIndexContent).toContain('locale={locale}');
        });

        it('should render SEOHead in head slot', () => {
            expect(accommodationsIndexContent).toContain('<SEOHead');
            expect(accommodationsIndexContent).toContain('slot="head"');
            expect(accommodationsIndexContent).toContain('canonical=');
        });

        it('should render Breadcrumb with 4 levels', () => {
            expect(accommodationsIndexContent).toContain('<Breadcrumb');
            expect(accommodationsIndexContent).toContain('breadcrumbItems');
            expect(accommodationsIndexContent).toContain('destinos/${slug}/alojamientos');
        });

        it('should render AccommodationCard in grid', () => {
            expect(accommodationsIndexContent).toContain('<AccommodationCard');
        });

        it('should render EmptyState when no accommodations', () => {
            expect(accommodationsIndexContent).toContain('<EmptyState');
            expect(accommodationsIndexContent).toContain('noResultsTitle');
        });

        it('should render Pagination when totalPages > 1', () => {
            expect(accommodationsIndexContent).toContain('<Pagination');
            expect(accommodationsIndexContent).toContain('pagination.totalPages > 1');
        });

        it('should use 3-column grid for cards', () => {
            expect(accommodationsIndexContent).toContain('lg:grid-cols-3');
        });

        it('should use semantic color tokens', () => {
            expect(accommodationsIndexContent).toContain('text-foreground');
            expect(accommodationsIndexContent).toContain('text-muted-foreground');
            expect(accommodationsIndexContent).not.toContain('text-gray-');
        });
    });
});

describe('[lang]/destinos/[slug]/alojamientos/page/[page].astro', () => {
    describe('Locale handling', () => {
        it('should import getLocaleFromParams', () => {
            expect(accommodationsPaginationContent).toContain('getLocaleFromParams');
        });

        it('should redirect on invalid locale', () => {
            expect(accommodationsPaginationContent).toContain("Astro.redirect('/es/')");
        });

        it('should redirect when slug is missing', () => {
            expect(accommodationsPaginationContent).toContain('!slug');
            expect(accommodationsPaginationContent).toContain('destinos/');
        });
    });

    describe('Page param validation', () => {
        it('should parse page param as integer with nullish coalescing', () => {
            expect(accommodationsPaginationContent).toContain('Number.parseInt');
            expect(accommodationsPaginationContent).toContain("page ?? '1'");
        });

        it('should redirect on NaN or negative page', () => {
            expect(accommodationsPaginationContent).toContain('Number.isNaN');
            expect(accommodationsPaginationContent).toContain('alojamientos/');
        });

        it('should redirect page 1 to canonical accommodations base URL', () => {
            expect(accommodationsPaginationContent).toContain('pageNum === 1');
            expect(accommodationsPaginationContent).toContain('alojamientos/');
        });
    });

    describe('Rewrite behavior', () => {
        it('should rewrite pages >1 to accommodations index with query param', () => {
            expect(accommodationsPaginationContent).toContain('Astro.rewrite');
            expect(accommodationsPaginationContent).toContain('?page=${pageNum}');
            expect(accommodationsPaginationContent).toContain('alojamientos/');
        });

        it('should include slug in rewrite URL', () => {
            expect(accommodationsPaginationContent).toContain('${slug}/alojamientos/');
        });
    });
});
