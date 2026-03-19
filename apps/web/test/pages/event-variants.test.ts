import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const paginationPath = resolve(__dirname, '../../src/pages/[lang]/eventos/page/[page].astro');
const categoryIndexPath = resolve(
    __dirname,
    '../../src/pages/[lang]/eventos/categoria/[category]/index.astro'
);
const categoryPaginationPath = resolve(
    __dirname,
    '../../src/pages/[lang]/eventos/categoria/[category]/page/[page].astro'
);

const paginationContent = readFileSync(paginationPath, 'utf8');
const categoryIndexContent = readFileSync(categoryIndexPath, 'utf8');
const categoryPaginationContent = readFileSync(categoryPaginationPath, 'utf8');

describe('[lang]/eventos/page/[page].astro', () => {
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
            expect(paginationContent).toContain('eventos/');
        });

        it('should redirect page 1 to canonical eventos base URL', () => {
            expect(paginationContent).toContain('pageNum === 1');
            expect(paginationContent).toContain('eventos/');
        });
    });

    describe('Rewrite behavior', () => {
        it('should rewrite pages >1 to eventos index with query param', () => {
            expect(paginationContent).toContain('Astro.rewrite');
            expect(paginationContent).toContain('?page=${pageNum}');
            expect(paginationContent).toContain('eventos/');
        });
    });
});

describe('[lang]/eventos/categoria/[category]/index.astro', () => {
    describe('Rendering mode', () => {
        it('should use SSR (no prerender export)', () => {
            expect(categoryIndexContent).not.toContain('export const prerender = true');
        });

        it('should use getLocaleFromParams for runtime locale resolution', () => {
            expect(categoryIndexContent).toContain('getLocaleFromParams');
        });
    });

    describe('ALLOWED_CATEGORIES', () => {
        it('should define ALLOWED_CATEGORIES as const array', () => {
            expect(categoryIndexContent).toContain('ALLOWED_CATEGORIES');
            expect(categoryIndexContent).toContain('as const');
        });

        it('should include all five event categories', () => {
            expect(categoryIndexContent).toContain("'festival'");
            expect(categoryIndexContent).toContain("'fair'");
            expect(categoryIndexContent).toContain("'sport'");
            expect(categoryIndexContent).toContain("'cultural'");
            expect(categoryIndexContent).toContain("'gastronomy'");
        });
    });

    describe('Imports', () => {
        it('should import BaseLayout', () => {
            expect(categoryIndexContent).toContain('import BaseLayout from');
        });

        it('should import SEOHead', () => {
            expect(categoryIndexContent).toContain('import SEOHead from');
        });

        it('should import Breadcrumb from shared', () => {
            expect(categoryIndexContent).toContain('import Breadcrumb from');
            expect(categoryIndexContent).toContain('shared/Breadcrumb.astro');
        });

        it('should import EventCard from shared', () => {
            expect(categoryIndexContent).toContain('import EventCard from');
            expect(categoryIndexContent).toContain('shared/EventCard.astro');
        });

        it('should import EmptyState from shared', () => {
            expect(categoryIndexContent).toContain('import EmptyState from');
        });

        it('should import Pagination from shared', () => {
            expect(categoryIndexContent).toContain('import Pagination from');
        });

        it('should import eventsApi', () => {
            expect(categoryIndexContent).toContain('eventsApi');
        });

        it('should import toEventCardProps transform', () => {
            expect(categoryIndexContent).toContain('toEventCardProps');
        });

        it('should import createT from i18n', () => {
            expect(categoryIndexContent).toContain('createT');
            expect(categoryIndexContent).toContain("from '../../../../../lib/i18n'");
        });
    });

    describe('Category validation', () => {
        it('should redirect on invalid locale', () => {
            expect(categoryIndexContent).toContain("Astro.redirect('/es/')");
        });

        it('should redirect to events index on invalid category', () => {
            expect(categoryIndexContent).toContain('ALLOWED_CATEGORIES.includes');
            expect(categoryIndexContent).toContain('eventos');
            expect(categoryIndexContent).toContain('Astro.redirect');
        });
    });

    describe('CATEGORY_API_VALUE mapping', () => {
        it('should define CATEGORY_API_VALUE map', () => {
            expect(categoryIndexContent).toContain('CATEGORY_API_VALUE');
        });

        it('should map festival to FESTIVAL', () => {
            expect(categoryIndexContent).toContain("festival: 'FESTIVAL'");
        });

        it('should map sport to SPORTS', () => {
            expect(categoryIndexContent).toContain("sport: 'SPORTS'");
        });

        it('should map cultural to CULTURAL', () => {
            expect(categoryIndexContent).toContain("cultural: 'CULTURAL'");
        });

        it('should map fair to FAIR', () => {
            expect(categoryIndexContent).toContain("fair: 'FAIR'");
        });

        it('should map gastronomy to GASTRONOMY', () => {
            expect(categoryIndexContent).toContain("gastronomy: 'GASTRONOMY'");
        });
    });

    describe('API call', () => {
        it('should call eventsApi.list with CATEGORY_API_VALUE', () => {
            expect(categoryIndexContent).toContain('eventsApi.list(');
            expect(categoryIndexContent).toContain('category: CATEGORY_API_VALUE[eventCategory]');
        });

        it('should pass pagination params', () => {
            expect(categoryIndexContent).toContain('page,');
            expect(categoryIndexContent).toContain('PAGE_SIZE');
        });

        it('should read page from URL searchParams', () => {
            expect(categoryIndexContent).toContain("Astro.url.searchParams.get('page')");
        });
    });

    describe('i18n', () => {
        it('should use createT for translations', () => {
            expect(categoryIndexContent).toContain('createT(locale');
        });

        it('should translate category name', () => {
            expect(categoryIndexContent).toContain('events.categoryPage.categories');
        });

        it('should use HOME_BREADCRUMB for breadcrumb home label', () => {
            expect(categoryIndexContent).toContain('HOME_BREADCRUMB');
        });
    });

    describe('Pagination base URL', () => {
        it('should define paginationBaseUrl for segment-mode pagination', () => {
            expect(categoryIndexContent).toContain('paginationBaseUrl');
            expect(categoryIndexContent).toContain('eventos/categoria/${eventCategory}');
        });
    });

    describe('Template structure', () => {
        it('should render BaseLayout with locale', () => {
            expect(categoryIndexContent).toContain('<BaseLayout');
            expect(categoryIndexContent).toContain('locale={locale}');
        });

        it('should render SEOHead in head slot', () => {
            expect(categoryIndexContent).toContain('<SEOHead');
            expect(categoryIndexContent).toContain('slot="head"');
            expect(categoryIndexContent).toContain('canonical=');
        });

        it('should render Breadcrumb with home + events + category', () => {
            expect(categoryIndexContent).toContain('<Breadcrumb');
            expect(categoryIndexContent).toContain('breadcrumbItems');
        });

        it('should render category header with h1', () => {
            expect(categoryIndexContent).toContain('text-4xl font-bold');
            expect(categoryIndexContent).toContain('pageTitle');
        });

        it('should render back link to all events', () => {
            expect(categoryIndexContent).toContain("'events.categoryPage.labels.allEvents'");
        });

        it('should render event grid with 3-column layout', () => {
            expect(categoryIndexContent).toContain('lg:grid-cols-3');
            expect(categoryIndexContent).toContain('<EventCard');
        });

        it('should render EmptyState for both error and empty state', () => {
            expect(categoryIndexContent).toContain('<EmptyState');
            expect(categoryIndexContent).toContain('errorTitle');
            expect(categoryIndexContent).toContain('noEventsTitle');
        });

        it('should render Pagination conditionally', () => {
            expect(categoryIndexContent).toContain('<Pagination');
            expect(categoryIndexContent).toContain('pagination.totalPages > 1');
        });

        it('should render Pagination with paginationBaseUrl', () => {
            expect(categoryIndexContent).toContain('baseUrl={paginationBaseUrl}');
        });
    });

    describe('Canonical URL', () => {
        it('should build canonical URL from Astro.url', () => {
            expect(categoryIndexContent).toContain('canonicalUrl');
            expect(categoryIndexContent).toContain('Astro.url.pathname');
        });
    });
});

describe('[lang]/eventos/categoria/[category]/page/[page].astro', () => {
    describe('Locale handling', () => {
        it('should import getLocaleFromParams', () => {
            expect(categoryPaginationContent).toContain('getLocaleFromParams');
        });

        it('should redirect on invalid locale', () => {
            expect(categoryPaginationContent).toContain("Astro.redirect('/es/')");
        });
    });

    describe('Category validation', () => {
        it('should define ALLOWED_CATEGORIES', () => {
            expect(categoryPaginationContent).toContain('ALLOWED_CATEGORIES');
        });

        it('should redirect to eventos list on invalid category', () => {
            expect(categoryPaginationContent).toContain('eventos/');
            expect(categoryPaginationContent).toContain('ALLOWED_CATEGORIES.includes');
        });

        it('should redirect to category base URL on valid type but bad page', () => {
            expect(categoryPaginationContent).toContain('categoria/${category}/');
        });
    });

    describe('Page param validation', () => {
        it('should parse page param as integer with nullish coalescing', () => {
            expect(categoryPaginationContent).toContain('Number.parseInt');
            expect(categoryPaginationContent).toContain("page ?? '1'");
        });

        it('should redirect on NaN or negative page', () => {
            expect(categoryPaginationContent).toContain('Number.isNaN');
        });

        it('should redirect page 1 to canonical category base URL', () => {
            expect(categoryPaginationContent).toContain('pageNum === 1');
            expect(categoryPaginationContent).toContain('categoria/${category}/');
        });
    });

    describe('Rewrite behavior', () => {
        it('should rewrite pages >1 to category index with query param', () => {
            expect(categoryPaginationContent).toContain('Astro.rewrite');
            expect(categoryPaginationContent).toContain('?page=${pageNum}');
            expect(categoryPaginationContent).toContain('categoria/${category}/');
        });
    });
});
