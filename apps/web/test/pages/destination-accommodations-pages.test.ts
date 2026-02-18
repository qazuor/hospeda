/**
 * Tests for Destination Accommodations pages.
 * Verifies structure, imports, locale/slug validation, API integration,
 * SEO elements, breadcrumb navigation, pagination, and empty state handling.
 *
 * Covers:
 *   - apps/web/src/pages/[lang]/destinos/[slug]/alojamientos/index.astro
 *   - apps/web/src/pages/[lang]/destinos/[slug]/alojamientos/page/[page].astro
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const indexPath = resolve(
    __dirname,
    '../../src/pages/[lang]/destinos/[slug]/alojamientos/index.astro'
);
const paginationPath = resolve(
    __dirname,
    '../../src/pages/[lang]/destinos/[slug]/alojamientos/page/[page].astro'
);

const indexContent = readFileSync(indexPath, 'utf8');
const paginationContent = readFileSync(paginationPath, 'utf8');

// ---------------------------------------------------------------------------
// index.astro
// ---------------------------------------------------------------------------
describe('destinos/[slug]/alojamientos/index.astro', () => {
    describe('Rendering Strategy (SSR)', () => {
        it('should NOT have prerender export (pure SSR)', () => {
            expect(indexContent).not.toContain('export const prerender = true');
        });

        it('should NOT have getStaticPaths (dynamic slug requires SSR)', () => {
            expect(indexContent).not.toContain('getStaticPaths');
        });
    });

    describe('JSDoc Documentation', () => {
        it('should have page documentation block', () => {
            expect(indexContent).toContain('/**');
            expect(indexContent).toContain('* Destination accommodations listing page.');
        });

        it('should document the route', () => {
            expect(indexContent).toContain('* @route /[lang]/destinos/[slug]/alojamientos/');
        });

        it('should document the rendering strategy', () => {
            expect(indexContent).toContain('* @rendering SSR');
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

        it('should import AccommodationCard', () => {
            expect(indexContent).toContain(
                "import AccommodationCard from '../../../../../components/accommodation/AccommodationCard.astro'"
            );
        });

        it('should import DestinationErrorState', () => {
            expect(indexContent).toContain(
                "import DestinationErrorState from '../../../../../components/error/DestinationErrorState.astro'"
            );
        });

        it('should import i18n utilities', () => {
            expect(indexContent).toContain(
                "import { isValidLocale, type SupportedLocale } from '../../../../../lib/i18n'"
            );
        });

        it('should import destinationsApi', () => {
            expect(indexContent).toContain(
                "import { destinationsApi } from '../../../../../lib/api/endpoints'"
            );
        });
    });

    describe('Locale Validation', () => {
        it('should extract lang and slug from params', () => {
            expect(indexContent).toContain('const { lang, slug } = Astro.params;');
        });

        it('should validate locale with isValidLocale', () => {
            expect(indexContent).toContain('if (!lang || !isValidLocale(lang))');
        });

        it('should redirect to /es/ if locale is invalid', () => {
            expect(indexContent).toContain("return Astro.redirect('/es/');");
        });

        it('should cast validated locale to SupportedLocale', () => {
            expect(indexContent).toContain('const locale = lang as SupportedLocale;');
        });
    });

    describe('Slug Validation', () => {
        it('should validate slug parameter', () => {
            expect(indexContent).toContain('if (!slug)');
        });

        it('should redirect to destinos listing when slug is missing', () => {
            expect(indexContent).toContain('return Astro.redirect(`/${locale}/destinos/`);');
        });
    });

    describe('Localized Labels', () => {
        it('should define labels record for all locales', () => {
            expect(indexContent).toContain('const labels: Record<SupportedLocale');
        });

        it('should define Spanish labels', () => {
            expect(indexContent).toContain("home: 'Inicio'");
            expect(indexContent).toContain("destinations: 'Destinos'");
            expect(indexContent).toContain("accommodations: 'Alojamientos'");
        });

        it('should define English labels', () => {
            expect(indexContent).toContain("home: 'Home'");
            expect(indexContent).toContain("destinations: 'Destinations'");
            expect(indexContent).toContain("accommodations: 'Accommodations'");
        });

        it('should define Portuguese labels', () => {
            expect(indexContent).toContain("home: 'Início'");
            expect(indexContent).toContain("destinations: 'Destinos'");
            expect(indexContent).toContain("accommodations: 'Acomodações'");
        });

        it('should define noResults label for Spanish', () => {
            expect(indexContent).toContain(
                "noResults: 'No hay alojamientos disponibles para este destino'"
            );
        });

        it('should define noResults label for English', () => {
            expect(indexContent).toContain(
                "noResults: 'No accommodations available for this destination'"
            );
        });

        it('should define noResults label for Portuguese', () => {
            expect(indexContent).toContain(
                "noResults: 'Não há acomodações disponíveis para este destino'"
            );
        });

        it('should define pageTitle prefix for Spanish', () => {
            expect(indexContent).toContain("pageTitle: 'Alojamientos en'");
        });

        it('should define pageTitle prefix for English', () => {
            expect(indexContent).toContain("pageTitle: 'Accommodations in'");
        });

        it('should define pageTitle prefix for Portuguese', () => {
            expect(indexContent).toContain("pageTitle: 'Acomodações em'");
        });

        it('should select texts based on locale', () => {
            expect(indexContent).toContain('const t = labels[locale];');
        });
    });

    describe('API Integration - Destination', () => {
        it('should fetch destination by slug', () => {
            expect(indexContent).toContain('await destinationsApi.getBySlug({ slug })');
        });

        it('should check destinationResult.ok', () => {
            expect(indexContent).toContain('destinationResult.ok');
        });

        it('should set 404 response status when destination not found', () => {
            expect(indexContent).toContain('Astro.response.status = 404');
        });

        it('should extract destination data safely', () => {
            expect(indexContent).toContain('const destination = destinationResult.ok');
        });

        it('should extract destinationId from destination data', () => {
            expect(indexContent).toContain('const destinationId = destination?.id');
        });

        it('should extract destinationName with slug fallback', () => {
            expect(indexContent).toContain('const destinationName =');
            expect(indexContent).toContain('?? slug');
        });
    });

    describe('API Integration - Accommodations', () => {
        it('should get page from URL query string with default 1', () => {
            expect(indexContent).toContain(
                "const page = Number.parseInt(Astro.url.searchParams.get('page') || '1', 10);"
            );
        });

        it('should define pageSize constant', () => {
            expect(indexContent).toContain('const pageSize = 12;');
        });

        it('should fetch accommodations only when destinationId exists', () => {
            expect(indexContent).toContain('const accommodationsResult = destinationId');
            expect(indexContent).toContain(
                'await destinationsApi.getAccommodations({ id: destinationId, page, pageSize })'
            );
        });

        it('should fallback to null when destination not found', () => {
            expect(indexContent).toContain(': null;');
        });

        it('should extract accommodations from result', () => {
            expect(indexContent).toContain(
                'const accommodations = accommodationsResult?.ok ? accommodationsResult.data.items : []'
            );
        });

        it('should extract pagination from result', () => {
            expect(indexContent).toContain(
                'const pagination = accommodationsResult?.ok ? accommodationsResult.data.pagination : null'
            );
        });
    });

    describe('SEO Metadata', () => {
        it('should compute pageTitle from locale prefix and destination name', () => {
            expect(indexContent).toContain('const pageTitle = `${t.pageTitle} ${destinationName}`');
        });

        it('should compute pageDescription from locale prefix and destination name', () => {
            expect(indexContent).toContain(
                'const pageDescription = `${t.pageDescription} ${destinationName}.`'
            );
        });

        it('should build canonical URL from pathname and site', () => {
            expect(indexContent).toContain(
                'const canonicalUrl = new URL(Astro.url.pathname, Astro.site).href'
            );
        });

        it('should build baseUrl for pagination', () => {
            expect(indexContent).toContain(
                'const baseUrl = `/${locale}/destinos/${slug}/alojamientos`'
            );
        });

        it('should render SEOHead in head slot', () => {
            expect(indexContent).toContain('<SEOHead');
            expect(indexContent).toContain('slot="head"');
        });

        it('should pass title to SEOHead', () => {
            expect(indexContent).toContain('title={pageTitle}');
        });

        it('should pass description to SEOHead', () => {
            expect(indexContent).toContain('description={pageDescription}');
        });

        it('should pass canonical URL to SEOHead', () => {
            expect(indexContent).toContain('canonical={canonicalUrl}');
        });

        it('should handle Portuguese locale mapping for SEOHead', () => {
            expect(indexContent).toContain("locale={locale === 'pt' ? 'es' : locale}");
        });

        it('should set type to website in SEOHead', () => {
            expect(indexContent).toContain('type="website"');
        });
    });

    describe('Breadcrumb Navigation', () => {
        it('should define breadcrumb items array', () => {
            expect(indexContent).toContain('const breadcrumbItems = [');
        });

        it('should have home breadcrumb item', () => {
            expect(indexContent).toContain('{ label: t.home, href: `/${locale}/` }');
        });

        it('should have destinations breadcrumb item', () => {
            expect(indexContent).toContain(
                '{ label: t.destinations, href: `/${locale}/destinos/` }'
            );
        });

        it('should have destination name breadcrumb item', () => {
            expect(indexContent).toContain(
                '{ label: destinationName, href: `/${locale}/destinos/${slug}/` }'
            );
        });

        it('should have accommodations breadcrumb item as last step', () => {
            expect(indexContent).toContain('{ label: t.accommodations, href: `${baseUrl}/` }');
        });

        it('should render Breadcrumb component with items', () => {
            expect(indexContent).toContain('<Breadcrumb items={breadcrumbItems}');
        });
    });

    describe('Layout Structure', () => {
        it('should use BaseLayout', () => {
            expect(indexContent).toContain('<BaseLayout');
        });

        it('should pass title and description to BaseLayout', () => {
            expect(indexContent).toContain('title={pageTitle}');
            expect(indexContent).toContain('description={pageDescription}');
        });

        it('should pass locale to BaseLayout', () => {
            expect(indexContent).toContain('locale={locale}');
        });

        it('should wrap content in Container', () => {
            expect(indexContent).toContain('<Container>');
        });

        it('should wrap content in Section', () => {
            expect(indexContent).toContain('<Section>');
        });
    });

    describe('Error State Handling', () => {
        it('should have destination-error article for not-found case', () => {
            expect(indexContent).toContain('id="destination-error"');
        });

        it('should render DestinationErrorState when destination not found', () => {
            expect(indexContent).toContain('<DestinationErrorState');
        });

        it('should pass locale to DestinationErrorState', () => {
            expect(indexContent).toContain('locale={locale}');
        });

        it('should pass retryHref pointing to destinations listing', () => {
            expect(indexContent).toContain('retryHref={`/${locale}/destinos/`}');
        });

        it('should conditionally render based on destination existence', () => {
            expect(indexContent).toContain('!destination');
        });
    });

    describe('Destination Header Section', () => {
        it('should have destination-header article', () => {
            expect(indexContent).toContain('id="destination-header"');
        });

        it('should render h1 with large bold styling', () => {
            expect(indexContent).toContain('text-4xl font-bold');
            expect(indexContent).toContain('md:text-5xl');
        });

        it('should display destination name prominently', () => {
            expect(indexContent).toContain('{destinationName}');
        });

        it('should display page description text', () => {
            expect(indexContent).toContain('{t.pageDescription}');
        });
    });

    describe('Accommodation Grid', () => {
        it('should have accommodation-grid article', () => {
            expect(indexContent).toContain('id="accommodation-grid"');
        });

        it('should use responsive grid layout', () => {
            expect(indexContent).toContain('grid gap-6 sm:grid-cols-2 lg:grid-cols-3');
        });

        it('should map accommodations to AccommodationCard components', () => {
            expect(indexContent).toContain('accommodations.map((accommodation) =>');
            expect(indexContent).toContain('<AccommodationCard');
        });

        it('should pass locale to AccommodationCard', () => {
            expect(indexContent).toContain('locale={locale}');
        });

        it('should conditionally render grid or EmptyState', () => {
            expect(indexContent).toContain('accommodations.length > 0');
        });
    });

    describe('Empty State', () => {
        it('should render EmptyState when no accommodations', () => {
            expect(indexContent).toContain('<EmptyState');
        });

        it('should pass noResults label as title to EmptyState', () => {
            expect(indexContent).toContain('title={t.noResults}');
        });

        it('should pass noResultsDetail as message to EmptyState', () => {
            expect(indexContent).toContain('message={t.noResultsDetail}');
        });
    });

    describe('Pagination', () => {
        it('should have pagination article', () => {
            expect(indexContent).toContain('id="pagination"');
        });

        it('should conditionally render pagination when totalPages > 1', () => {
            expect(indexContent).toContain('pagination && pagination.totalPages > 1');
        });

        it('should render Pagination component', () => {
            expect(indexContent).toContain('<Pagination');
        });

        it('should pass currentPage to Pagination', () => {
            expect(indexContent).toContain('currentPage={pagination.page');
        });

        it('should pass totalPages to Pagination', () => {
            expect(indexContent).toContain('totalPages={pagination.totalPages');
        });

        it('should pass baseUrl to Pagination', () => {
            expect(indexContent).toContain('baseUrl={baseUrl}');
        });

        it('should pass locale to Pagination', () => {
            expect(indexContent).toContain('locale={locale}');
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
// page/[page].astro
// ---------------------------------------------------------------------------
describe('destinos/[slug]/alojamientos/page/[page].astro', () => {
    describe('JSDoc Documentation', () => {
        it('should have page documentation block', () => {
            expect(paginationContent).toContain('/**');
            expect(paginationContent).toContain('* Paginated destination accommodations route.');
        });

        it('should document the route', () => {
            expect(paginationContent).toContain(
                '* @route /[lang]/destinos/[slug]/alojamientos/page/[page]/'
            );
        });

        it('should document rendering strategy as SSR', () => {
            expect(paginationContent).toContain('* @rendering SSR');
        });
    });

    describe('Imports', () => {
        it('should import isValidLocale from i18n', () => {
            expect(paginationContent).toContain(
                "import { isValidLocale } from '../../../../../../lib/i18n'"
            );
        });
    });

    describe('Rendering Strategy (SSR)', () => {
        it('should NOT export prerender (pure SSR)', () => {
            expect(paginationContent).not.toContain('export const prerender = true');
        });
    });

    describe('Parameter Extraction', () => {
        it('should extract lang, slug, and page from params', () => {
            expect(paginationContent).toContain('const { lang, slug, page } = Astro.params;');
        });
    });

    describe('Locale Validation', () => {
        it('should validate locale with isValidLocale', () => {
            expect(paginationContent).toContain('if (!lang || !isValidLocale(lang))');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(paginationContent).toContain("return Astro.redirect('/es/');");
        });
    });

    describe('Slug Validation', () => {
        it('should validate slug parameter', () => {
            expect(paginationContent).toContain('if (!slug)');
        });

        it('should redirect to destinos listing when slug is missing', () => {
            expect(paginationContent).toContain('return Astro.redirect(`/${lang}/destinos/`);');
        });
    });

    describe('Page Number Validation', () => {
        it('should parse page number as integer with default 1', () => {
            expect(paginationContent).toContain(
                "const pageNum = Number.parseInt(page || '1', 10);"
            );
        });

        it('should redirect on NaN or negative page number', () => {
            expect(paginationContent).toContain('if (Number.isNaN(pageNum) || pageNum < 1)');
            expect(paginationContent).toContain(
                'return Astro.redirect(`/${lang}/destinos/${slug}/alojamientos/`);'
            );
        });
    });

    describe('Page 1 Canonical Redirect', () => {
        it('should redirect page 1 to the canonical base URL', () => {
            expect(paginationContent).toContain('if (pageNum === 1)');
            expect(paginationContent).toContain(
                'return Astro.redirect(`/${lang}/destinos/${slug}/alojamientos/`);'
            );
        });
    });

    describe('Rewrite to Index with Query Param', () => {
        it('should rewrite to accommodations index with page query param', () => {
            expect(paginationContent).toContain(
                'return Astro.rewrite(`/${lang}/destinos/${slug}/alojamientos/?page=${pageNum}`);'
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
