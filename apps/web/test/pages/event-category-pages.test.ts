/**
 * Tests for Event Category pages.
 * Covers the category index page and the pagination route.
 * Verifies structure, imports, locale validation, category validation, i18n, SEO, and pagination.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const indexPath = resolve(
    __dirname,
    '../../src/pages/[lang]/eventos/categoria/[category]/index.astro'
);
const paginationPath = resolve(
    __dirname,
    '../../src/pages/[lang]/eventos/categoria/[category]/page/[page].astro'
);

const indexContent = readFileSync(indexPath, 'utf8');
const paginationContent = readFileSync(paginationPath, 'utf8');

// ---------------------------------------------------------------------------
// Index page: /[lang]/eventos/categoria/[category]/
// ---------------------------------------------------------------------------

describe('eventos/categoria/[category]/index.astro', () => {
    describe('Rendering Strategy (SSG)', () => {
        it('should enable prerendering', () => {
            expect(indexContent).toContain('export const prerender = true;');
        });

        it('should export getStaticPaths function', () => {
            expect(indexContent).toContain('export function getStaticPaths()');
        });

        it('should generate paths for all 3 locales', () => {
            expect(indexContent).toContain('SUPPORTED_LOCALES');
        });

        it('should generate paths for all 5 categories', () => {
            expect(indexContent).toContain("'festival'");
            expect(indexContent).toContain("'fair'");
            expect(indexContent).toContain("'sport'");
            expect(indexContent).toContain("'cultural'");
            expect(indexContent).toContain("'gastronomy'");
        });
    });

    describe('Imports', () => {
        it('should import BaseLayout', () => {
            expect(indexContent).toContain(
                "import BaseLayout from '../../../../../layouts/BaseLayout.astro'"
            );
        });

        it('should import SEOHead', () => {
            expect(indexContent).toContain(
                "import SEOHead from '../../../../../components/seo/SEOHead.astro'"
            );
        });

        it('should import Breadcrumb', () => {
            expect(indexContent).toContain(
                "import Breadcrumb from '../../../../../components/ui/Breadcrumb.astro'"
            );
        });

        it('should import Container', () => {
            expect(indexContent).toContain(
                "import Container from '../../../../../components/ui/Container.astro'"
            );
        });

        it('should import Section', () => {
            expect(indexContent).toContain(
                "import Section from '../../../../../components/ui/Section.astro'"
            );
        });

        it('should import EmptyState', () => {
            expect(indexContent).toContain(
                "import EmptyState from '../../../../../components/ui/EmptyState.astro'"
            );
        });

        it('should import Pagination', () => {
            expect(indexContent).toContain(
                "import Pagination from '../../../../../components/ui/Pagination.astro'"
            );
        });

        it('should import EventCard', () => {
            expect(indexContent).toContain(
                "import EventCard from '../../../../../components/event/EventCard.astro'"
            );
        });

        it('should import i18n utilities', () => {
            expect(indexContent).toContain(
                "import { getLocaleFromParams, SUPPORTED_LOCALES } from '../../../../../lib/page-helpers'"
            );
        });

        it('should import t from lib/i18n', () => {
            expect(indexContent).toContain("import { t } from '../../../../../lib/i18n'");
        });

        it('should import eventsApi', () => {
            expect(indexContent).toContain(
                "import { eventsApi } from '../../../../../lib/api/endpoints'"
            );
        });
    });

    describe('Locale Validation', () => {
        it('should extract locale with getLocaleFromParams', () => {
            expect(indexContent).toContain('getLocaleFromParams(Astro.params)');
            expect(indexContent).toContain('if (!locale)');
        });

        it('should redirect to /es/ if locale is invalid', () => {
            expect(indexContent).toContain("return Astro.redirect('/es/');");
        });
    });

    describe('Category Validation', () => {
        it('should define ALLOWED_CATEGORIES constant', () => {
            expect(indexContent).toContain('const ALLOWED_CATEGORIES = [');
        });

        it('should include all 5 allowed categories', () => {
            expect(indexContent).toContain("'festival'");
            expect(indexContent).toContain("'fair'");
            expect(indexContent).toContain("'sport'");
            expect(indexContent).toContain("'cultural'");
            expect(indexContent).toContain("'gastronomy'");
        });

        it('should validate category parameter', () => {
            expect(indexContent).toContain(
                '!ALLOWED_CATEGORIES.includes(category as EventCategory)'
            );
        });

        it('should redirect to events page on invalid category', () => {
            expect(indexContent).toContain('return Astro.redirect(`/${locale}/eventos/`);');
        });

        it('should create TypeScript type from ALLOWED_CATEGORIES', () => {
            expect(indexContent).toContain(
                'type EventCategory = (typeof ALLOWED_CATEGORIES)[number]'
            );
        });

        it('should cast validated category to EventCategory', () => {
            expect(indexContent).toContain('const eventCategory = category as EventCategory;');
        });
    });

    describe('Category API Value Mapping', () => {
        it('should define categoryApiValue mapping', () => {
            expect(indexContent).toContain(
                'const categoryApiValue: Record<EventCategory, string> = {'
            );
        });

        it('should map festival to FESTIVAL', () => {
            expect(indexContent).toContain("festival: 'FESTIVAL'");
        });

        it('should map fair to FAIR', () => {
            expect(indexContent).toContain("fair: 'FAIR'");
        });

        it('should map sport to SPORTS', () => {
            expect(indexContent).toContain("sport: 'SPORTS'");
        });

        it('should map cultural to CULTURAL', () => {
            expect(indexContent).toContain("cultural: 'CULTURAL'");
        });

        it('should map gastronomy to GASTRONOMY', () => {
            expect(indexContent).toContain("gastronomy: 'GASTRONOMY'");
        });
    });

    describe('Localized Category Names', () => {
        it('should use t() for category name', () => {
            expect(indexContent).toContain(
                "t({ locale, namespace: 'event', key: `categoryPage.categories.${eventCategory}.name` })"
            );
        });
    });

    describe('Localized Category Descriptions', () => {
        it('should use t() for category description', () => {
            expect(indexContent).toContain(
                "t({ locale, namespace: 'event', key: `categoryPage.categories.${eventCategory}.description` })"
            );
        });
    });

    describe('Localized Page Titles', () => {
        it('should use t() for page title', () => {
            expect(indexContent).toContain(
                "t({ locale, namespace: 'event', key: `categoryPage.categories.${eventCategory}.pageTitle` })"
            );
        });
    });

    describe('Localized Common Labels', () => {
        it('should use t() for breadcrumb home', () => {
            expect(indexContent).toContain(
                "t({ locale, namespace: 'event', key: 'categoryPage.labels.breadcrumbHome' })"
            );
        });

        it('should use t() for breadcrumb events', () => {
            expect(indexContent).toContain(
                "t({ locale, namespace: 'event', key: 'categoryPage.labels.breadcrumbEvents' })"
            );
        });

        it('should use t() for empty title with category interpolation', () => {
            expect(indexContent).toContain(
                "t({ locale, namespace: 'event', key: 'categoryPage.labels.emptyTitle', params: { category: categoryName.toLowerCase() } })"
            );
        });
    });

    describe('SEO', () => {
        it('should build canonical URL from Astro.url.pathname', () => {
            expect(indexContent).toContain(
                'const canonicalUrl = new URL(Astro.url.pathname, Astro.site).href;'
            );
        });

        it('should render SEOHead in head slot', () => {
            expect(indexContent).toContain('<SEOHead');
            expect(indexContent).toContain('slot="head"');
        });

        it('should pass title and description to SEOHead', () => {
            expect(indexContent).toContain('title={pageTitle}');
            expect(indexContent).toContain('description={categoryDescription}');
        });

        it('should pass canonical URL to SEOHead', () => {
            expect(indexContent).toContain('canonical={canonicalUrl}');
        });

        it('should pass locale directly to SEOHead', () => {
            expect(indexContent).toContain('locale={locale}');
        });

        it('should set page type to website', () => {
            expect(indexContent).toContain('type="website"');
        });
    });

    describe('Breadcrumb', () => {
        it('should define breadcrumbItems array', () => {
            expect(indexContent).toContain('const breadcrumbItems = [');
        });

        it('should include home breadcrumb link', () => {
            expect(indexContent).toContain('{ label: breadcrumbHome, href: `/${locale}/` }');
        });

        it('should include events breadcrumb link', () => {
            expect(indexContent).toContain(
                '{ label: breadcrumbEvents, href: `/${locale}/eventos/` }'
            );
        });

        it('should include category breadcrumb link', () => {
            expect(indexContent).toContain(
                '{ label: categoryName, href: `/${locale}/eventos/categoria/${eventCategory}/` }'
            );
        });

        it('should render Breadcrumb component with items', () => {
            expect(indexContent).toContain('<Breadcrumb items={breadcrumbItems}');
        });
    });

    describe('API Integration', () => {
        it('should extract page from URL search params with default of 1', () => {
            expect(indexContent).toContain(
                "const page = Number.parseInt(Astro.url.searchParams.get('page') || '1', 10);"
            );
        });

        it('should fetch events filtered by category', () => {
            expect(indexContent).toContain('const apiResult = await eventsApi.list({');
            expect(indexContent).toContain('category: categoryApiValue[eventCategory]');
        });

        it('should check apiResult.ok before using data', () => {
            expect(indexContent).toContain('apiResult.ok');
        });

        it('should extract events from API response', () => {
            expect(indexContent).toContain(
                'const events = apiResult.ok ? apiResult.data.items : []'
            );
        });

        it('should extract pagination from API response', () => {
            expect(indexContent).toContain(
                'const pagination = apiResult.ok ? apiResult.data.pagination : null'
            );
        });

        it('should pass page and pageSize to API', () => {
            expect(indexContent).toContain('page, pageSize');
        });
    });

    describe('Event Grid', () => {
        it('should render EventCard components', () => {
            expect(indexContent).toContain('<EventCard event={toEventCardProps(');
            expect(indexContent).toContain('locale={locale}');
        });

        it('should use responsive grid layout', () => {
            expect(indexContent).toContain('grid gap-6 sm:grid-cols-2 lg:grid-cols-3');
        });

        it('should conditionally render events or empty state', () => {
            expect(indexContent).toContain('events.length > 0');
        });
    });

    describe('Empty State', () => {
        it('should generate empty state message', () => {
            expect(indexContent).toContain('const emptyMessage =');
            expect(indexContent).toContain('emptyTitle');
        });

        it('should render EmptyState component with message', () => {
            expect(indexContent).toContain('<EmptyState title={emptyMessage}');
        });
    });

    describe('Pagination', () => {
        it('should conditionally render Pagination when totalPages > 1', () => {
            expect(indexContent).toContain('pagination && pagination.totalPages > 1');
        });

        it('should render Pagination component', () => {
            expect(indexContent).toContain('<Pagination');
        });

        it('should pass currentPage prop', () => {
            expect(indexContent).toContain('currentPage={pagination.page as number}');
        });

        it('should pass totalPages prop', () => {
            expect(indexContent).toContain('totalPages={pagination.totalPages as number}');
        });

        it('should pass baseUrl with category in path', () => {
            expect(indexContent).toContain(
                'baseUrl={`/${locale}/eventos/categoria/${eventCategory}`}'
            );
        });

        it('should pass locale prop', () => {
            expect(indexContent).toContain('locale={locale}');
        });
    });

    describe('Content Sections', () => {
        it('should have category header article', () => {
            expect(indexContent).toContain('id="category-header"');
        });

        it('should have event grid article', () => {
            expect(indexContent).toContain('id="event-grid"');
        });

        it('should have pagination article', () => {
            expect(indexContent).toContain('id="pagination"');
        });

        it('should display category name as h1', () => {
            expect(indexContent).toContain('{categoryName}');
            expect(indexContent).toContain('text-4xl font-bold');
            expect(indexContent).toContain('md:text-5xl');
        });

        it('should display category description', () => {
            expect(indexContent).toContain('{categoryDescription}');
            expect(indexContent).toContain('text-xl leading-relaxed');
        });

        it('should use Container component', () => {
            expect(indexContent).toContain('<Container>');
        });

        it('should use Section component', () => {
            expect(indexContent).toContain('<Section>');
        });
    });

    describe('JSDoc Documentation', () => {
        it('should document getStaticPaths', () => {
            expect(indexContent).toContain(
                '* Returns static paths for all locale + category combinations.'
            );
        });

        it('should document the page', () => {
            expect(indexContent).toContain('* Event by Category page.');
        });

        it('should document the route', () => {
            expect(indexContent).toContain('* @route /[lang]/eventos/categoria/[category]/');
        });

        it('should document the rendering strategy', () => {
            expect(indexContent).toContain('* @rendering SSG');
        });
    });

    describe('File Size', () => {
        it('should be under 500 lines', () => {
            const lines = indexContent.split('\n').length;
            expect(lines).toBeLessThan(500);
        });
    });
});

// ---------------------------------------------------------------------------
// Pagination route: /[lang]/eventos/categoria/[category]/page/[page]/
// ---------------------------------------------------------------------------

describe('eventos/categoria/[category]/page/[page].astro', () => {
    describe('Imports', () => {
        it('should import getLocaleFromParams from page-helpers', () => {
            expect(paginationContent).toContain('getLocaleFromParams');
            expect(paginationContent).toContain("from '../../../../../../lib/page-helpers'");
        });
    });

    describe('Locale Validation', () => {
        it('should extract category and page from params', () => {
            expect(paginationContent).toContain('const { category, page } = Astro.params;');
        });

        it('should validate locale with getLocaleFromParams', () => {
            expect(paginationContent).toContain('getLocaleFromParams(Astro.params)');
            expect(paginationContent).toContain('if (!locale)');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(paginationContent).toContain("return Astro.redirect('/es/');");
        });
    });

    describe('Category Validation', () => {
        it('should define ALLOWED_CATEGORIES', () => {
            expect(paginationContent).toContain('const ALLOWED_CATEGORIES = [');
            expect(paginationContent).toContain("'festival'");
            expect(paginationContent).toContain("'fair'");
            expect(paginationContent).toContain("'sport'");
            expect(paginationContent).toContain("'cultural'");
            expect(paginationContent).toContain("'gastronomy'");
        });

        it('should validate category parameter', () => {
            expect(paginationContent).toContain(
                '!ALLOWED_CATEGORIES.includes(category as (typeof ALLOWED_CATEGORIES)[number])'
            );
        });

        it('should redirect to eventos page on invalid category', () => {
            expect(paginationContent).toContain('return Astro.redirect(`/${locale}/eventos/`);');
        });
    });

    describe('Page Number Validation', () => {
        it('should parse page number as integer', () => {
            expect(paginationContent).toContain(
                "const pageNum = Number.parseInt(page || '1', 10);"
            );
        });

        it('should redirect on invalid page number (NaN or < 1)', () => {
            expect(paginationContent).toContain('if (Number.isNaN(pageNum) || pageNum < 1)');
            expect(paginationContent).toContain(
                'return Astro.redirect(`/${locale}/eventos/categoria/${category}/`);'
            );
        });
    });

    describe('Page 1 Canonical Redirect', () => {
        it('should redirect page 1 to the canonical base URL', () => {
            expect(paginationContent).toContain('if (pageNum === 1)');
            expect(paginationContent).toContain(
                'return Astro.redirect(`/${locale}/eventos/categoria/${category}/`);'
            );
        });
    });

    describe('Rewrite to Index With Query Param', () => {
        it('should rewrite to the category index page with page query parameter', () => {
            expect(paginationContent).toContain(
                'return Astro.rewrite(`/${locale}/eventos/categoria/${category}/?page=${pageNum}`);'
            );
        });
    });

    describe('JSDoc Documentation', () => {
        it('should document the paginated route', () => {
            expect(paginationContent).toContain('* Paginated event category listing route.');
        });

        it('should document the route path', () => {
            expect(paginationContent).toContain(
                '* @route /[lang]/eventos/categoria/[category]/page/[page]/'
            );
        });
    });

    describe('File Size', () => {
        it('should be under 500 lines', () => {
            const lines = paginationContent.split('\n').length;
            expect(lines).toBeLessThan(500);
        });
    });
});
