/**
 * Tests for the Accommodation List page
 * Verifies structure, imports, locale validation, pagination, sorting, and i18n
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pagePath = resolve(__dirname, '../../src/pages/[lang]/alojamientos/index.astro');
const content = readFileSync(pagePath, 'utf8');

describe('Accommodation List Page', () => {
    describe('Imports', () => {
        it('should import BaseLayout', () => {
            expect(content).toContain("import BaseLayout from '../../../layouts/BaseLayout.astro'");
        });

        it('should import Container', () => {
            expect(content).toContain(
                "import Container from '../../../components/ui/Container.astro'"
            );
        });

        it('should import Breadcrumb', () => {
            expect(content).toContain(
                "import Breadcrumb from '../../../components/ui/Breadcrumb.astro'"
            );
        });

        it('should import SEOHead', () => {
            expect(content).toContain(
                "import SEOHead from '../../../components/seo/SEOHead.astro'"
            );
        });

        it('should import AccommodationCard', () => {
            expect(content).toContain(
                "import AccommodationCard from '../../../components/accommodation/AccommodationCard.astro'"
            );
        });

        it('should import ViewToggle with client directive', () => {
            expect(content).toContain(
                "import { ViewToggle } from '../../../components/ui/ViewToggle.client.tsx'"
            );
        });

        it('should import i18n utilities', () => {
            expect(content).toContain(
                "import { isValidLocale, type SupportedLocale } from '../../../lib/i18n'"
            );
        });

        it('should import accommodationsApi', () => {
            expect(content).toContain(
                "import { accommodationsApi } from '../../../lib/api/endpoints'"
            );
        });

        it('should import EmptyState', () => {
            expect(content).toContain(
                "import EmptyState from '../../../components/ui/EmptyState.astro'"
            );
        });
    });

    describe('Locale Validation', () => {
        it('should extract lang from params', () => {
            expect(content).toContain('const { lang } = Astro.params;');
        });

        it('should validate locale with isValidLocale', () => {
            expect(content).toContain('if (!lang || !isValidLocale(lang))');
        });

        it('should redirect to /es/ if locale is invalid', () => {
            expect(content).toContain("return Astro.redirect('/es/');");
        });

        it('should cast validated locale to SupportedLocale', () => {
            expect(content).toContain('const locale = lang as SupportedLocale;');
        });
    });

    describe('Rendering Strategy (SSG + ISR)', () => {
        it('should enable prerendering', () => {
            expect(content).toContain('export const prerender = true;');
        });

        it('should export getStaticPaths function', () => {
            expect(content).toContain('export function getStaticPaths()');
        });

        it('should generate paths for all 3 locales', () => {
            expect(content).toContain("{ params: { lang: 'es' } }");
            expect(content).toContain("{ params: { lang: 'en' } }");
            expect(content).toContain("{ params: { lang: 'pt' } }");
        });
    });

    describe('URL Query Parameters', () => {
        it('should extract sort parameter from Astro.url with default', () => {
            expect(content).toContain(
                "const sortBy = Astro.url.searchParams.get('sortBy') || 'name';"
            );
        });

        it('should extract page parameter from Astro.url with default', () => {
            expect(content).toContain(
                "const page = Number.parseInt(Astro.url.searchParams.get('page') || '1', 10);"
            );
        });
    });

    describe('Localized Texts', () => {
        it('should define texts for es locale', () => {
            expect(content).toContain('es: {');
            expect(content).toContain("title: 'Alojamientos'");
            expect(content).toContain(
                "description: 'Descubrí los mejores alojamientos en el Litoral argentino'"
            );
        });

        it('should define texts for en locale', () => {
            expect(content).toContain('en: {');
            expect(content).toContain("title: 'Accommodations'");
            expect(content).toContain(
                "description: 'Discover the best accommodations in the Argentine Litoral'"
            );
        });

        it('should define texts for pt locale', () => {
            expect(content).toContain('pt: {');
            expect(content).toContain("title: 'Acomodações'");
            expect(content).toContain(
                "description: 'Descubra as melhores acomodações no Litoral argentino'"
            );
        });

        it('should have all required text keys', () => {
            expect(content).toContain('home:');
            expect(content).toContain('accommodations:');
            expect(content).toContain('sortLabel:');
            expect(content).toContain('sortFeatured:');
            expect(content).toContain('sortPriceAsc:');
            expect(content).toContain('sortPriceDesc:');
            expect(content).toContain('sortRating:');
            expect(content).toContain('sortRecent:');
            expect(content).toContain('showing:');
            expect(content).toContain('of:');
            expect(content).toContain('results:');
            expect(content).toContain('previous:');
            expect(content).toContain('next:');
        });

        it('should select texts based on locale', () => {
            expect(content).toContain('const t = texts[locale];');
        });
    });

    describe('Page Header', () => {
        it('should have page title with h1', () => {
            expect(content).toContain('<h1 class="text-3xl font-bold">{t.title}</h1>');
        });

        it('should display results count', () => {
            expect(content).toContain('{t.showing}');
            expect(content).toContain('{accommodations.length}');
            expect(content).toContain('{totalResults}');
            expect(content).toContain('{t.results}');
        });
    });

    describe('Sort Dropdown', () => {
        it('should have sort label', () => {
            expect(content).toContain('{t.sortLabel}:');
        });

        it('should have select element with id', () => {
            expect(content).toContain('id="sort-select"');
        });

        it('should render 5 sort options', () => {
            expect(content).toContain("{ value: 'featured', label: t.sortFeatured }");
            expect(content).toContain("{ value: 'price_asc', label: t.sortPriceAsc }");
            expect(content).toContain("{ value: 'price_desc', label: t.sortPriceDesc }");
            expect(content).toContain("{ value: 'rating', label: t.sortRating }");
            expect(content).toContain("{ value: 'recent', label: t.sortRecent }");
        });

        it('should select current sort option', () => {
            expect(content).toContain('selected={opt.value === sortBy}');
        });
    });

    describe('ViewToggle Component', () => {
        it('should render ViewToggle with client:idle directive', () => {
            expect(content).toContain('<ViewToggle client:idle />');
        });
    });

    describe('Accommodation Grid', () => {
        it('should have responsive grid layout', () => {
            expect(content).toContain(
                'class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"'
            );
        });

        it('should map accommodations to cards', () => {
            expect(content).toContain('accommodations.map((acc) =>');
            expect(content).toContain('<AccommodationCard accommodation={acc');
            expect(content).toContain('locale={locale}');
        });

        it('should show EmptyState when no accommodations', () => {
            expect(content).toContain('accommodations.length > 0');
            expect(content).toContain('<EmptyState');
        });
    });

    describe('Pagination', () => {
        it('should import Pagination component', () => {
            expect(content).toContain(
                "import Pagination from '../../../components/ui/Pagination.astro'"
            );
        });

        it('should render Pagination component', () => {
            expect(content).toContain('<Pagination');
        });

        it('should pass currentPage prop', () => {
            expect(content).toContain('currentPage={page}');
        });

        it('should pass totalPages prop', () => {
            expect(content).toContain('totalPages={totalPages}');
        });

        it('should pass baseUrl prop', () => {
            expect(content).toContain('baseUrl=');
        });

        it('should pass locale prop', () => {
            expect(content).toContain('locale={locale}');
        });
    });

    describe('Breadcrumb', () => {
        it('should render breadcrumb with items', () => {
            expect(content).toContain('<Breadcrumb items={breadcrumbItems}');
        });

        it('should define breadcrumb items', () => {
            expect(content).toContain('const breadcrumbItems = [');
            expect(content).toContain('{ label: t.home, href: `/${locale}/` }');
            expect(content).toContain(
                '{ label: t.accommodations, href: `/${locale}/alojamientos/` }'
            );
        });
    });

    describe('SEOHead', () => {
        it('should render SEOHead in head slot', () => {
            expect(content).toContain('<SEOHead');
            expect(content).toContain('slot="head"');
        });

        it('should pass title and description', () => {
            expect(content).toContain('title={t.title}');
            expect(content).toContain('description={t.description}');
        });

        it('should pass canonical URL', () => {
            expect(content).toContain('canonical={canonicalUrl}');
        });

        it('should pass locale', () => {
            expect(content).toContain("locale={locale === 'pt' ? 'es' : locale}");
        });
    });

    describe('Sort Change Script', () => {
        it('should have inline script tag', () => {
            expect(content).toContain('<script>');
        });

        it('should get sort select element', () => {
            expect(content).toContain(
                "const sortSelect = document.getElementById('sort-select') as HTMLSelectElement;"
            );
        });

        it('should add change event listener', () => {
            expect(content).toContain("sortSelect.addEventListener('change',");
        });

        it('should update URL with new sort value', () => {
            expect(content).toContain("url.searchParams.set('sortBy', sortSelect.value)");
        });

        it('should reset to page 1 when sort changes', () => {
            expect(content).toContain("url.searchParams.set('page', '1')");
        });

        it('should navigate to new URL', () => {
            expect(content).toContain('window.location.href = url.toString()');
        });
    });

    describe('API Integration', () => {
        it('should fetch accommodations from API', () => {
            expect(content).toContain('const result = await accommodationsApi.list');
        });

        it('should check result.ok before using data', () => {
            expect(content).toContain('result.ok');
        });

        it('should extract accommodations from API response', () => {
            expect(content).toContain('const accommodations = result.ok ? result.data.items : []');
        });

        it('should extract pagination from API response', () => {
            expect(content).toContain('const pagination = result.ok ? result.data.pagination');
        });

        it('should pass pagination parameters to API', () => {
            expect(content).toContain('page,');
            expect(content).toContain('pageSize: perPage');
        });

        it('should use pagination data for display', () => {
            expect(content).toContain('pagination.total');
            expect(content).toContain('pagination.totalPages');
        });
    });

    describe('JSDoc Documentation', () => {
        it('should have page documentation', () => {
            expect(content).toContain('/**');
            expect(content).toContain('* Accommodation List page');
            expect(content).toContain('* @route /[lang]/alojamientos/');
            expect(content).toContain('* @rendering SSG + ISR');
        });

        it('should document localized text strings', () => {
            expect(content).toContain('* Localized text strings for all supported locales.');
        });

        it('should document sort options', () => {
            expect(content).toContain('* Sort options for the select dropdown.');
        });

        it('should document breadcrumb items', () => {
            expect(content).toContain('* Breadcrumb navigation items.');
        });

        it('should document canonical URL', () => {
            expect(content).toContain('* Canonical URL for SEO.');
        });

        it('should document sort change handler', () => {
            expect(content).toContain('* Sort dropdown change handler.');
            expect(content).toContain(
                '* Updates the URL with the new sort value and resets to page 1.'
            );
        });
    });

    describe('TypeScript Types', () => {
        it('should use SupportedLocale type', () => {
            expect(content).toContain('const locale = lang as SupportedLocale;');
        });

        it('should type texts object', () => {
            expect(content).toContain('const texts: Record<');
            expect(content).toContain('SupportedLocale,');
        });

        it('should type accommodation data from API response', () => {
            expect(content).toContain('accommodationsApi');
            expect(content).toContain('result.ok');
        });
    });

    describe('Accessibility', () => {
        it('should use Pagination component for accessible navigation', () => {
            expect(content).toContain('<Pagination');
        });

        it('should have label for sort select', () => {
            expect(content).toContain('<label for="sort-select"');
        });
    });

    describe('Layout and Styling', () => {
        it('should use responsive flexbox for header', () => {
            expect(content).toContain(
                'class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"'
            );
        });

        it('should use responsive grid for accommodations', () => {
            expect(content).toContain(
                'class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"'
            );
        });

        it('should use Pagination component for pagination styling', () => {
            expect(content).toContain('<Pagination');
        });

        it('should have focus styles for select', () => {
            expect(content).toContain('focus:border-primary');
            expect(content).toContain('focus:outline-none');
            expect(content).toContain('focus:ring-1');
            expect(content).toContain('focus:ring-primary');
        });
    });

    describe('File Size', () => {
        it('should be under 500 lines', () => {
            const lines = content.split('\n').length;
            expect(lines).toBeLessThan(500);
        });
    });
});
