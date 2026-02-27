/**
 * Tests for Search Results page (Busqueda).
 * Verifies page structure, SEO elements, localization, query handling, and content sections.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const busquedaPath = resolve(__dirname, '../../src/pages/[lang]/busqueda.astro');
const content = readFileSync(busquedaPath, 'utf8');

describe('busqueda.astro', () => {
    describe('Page structure', () => {
        it('should use BaseLayout', () => {
            expect(content).toContain("import BaseLayout from '../../layouts/BaseLayout.astro'");
            expect(content).toContain('<BaseLayout');
        });

        it('should use SEOHead component', () => {
            expect(content).toContain("import SEOHead from '../../components/seo/SEOHead.astro'");
            expect(content).toContain('<SEOHead');
        });

        it('should use Breadcrumb component', () => {
            expect(content).toContain(
                "import Breadcrumb from '../../components/ui/Breadcrumb.astro'"
            );
            expect(content).toContain('<Breadcrumb items={breadcrumbItems}');
        });

        it('should use Container component', () => {
            expect(content).toContain(
                "import Container from '../../components/ui/Container.astro'"
            );
            expect(content).toContain('<Container>');
        });

        it('should use Section component', () => {
            expect(content).toContain("import Section from '../../components/ui/Section.astro'");
            expect(content).toContain('<Section>');
        });
    });

    describe('Locale validation', () => {
        it('should validate locale parameter', () => {
            expect(content).toContain('getLocaleFromParams(Astro.params)');
            expect(content).toContain('if (!locale)');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(content).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers', () => {
            expect(content).toContain('getLocaleFromParams');
            expect(content).toContain('HOME_BREADCRUMB');
        });
    });

    describe('Query parameter handling', () => {
        it('should read query parameter from URL', () => {
            expect(content).toContain("Astro.url.searchParams.get('q')");
        });

        it('should store query in variable', () => {
            expect(content).toContain('const query = Astro.url.searchParams.get');
        });

        it('should default query to empty string', () => {
            expect(content).toContain("|| ''");
        });
    });

    describe('Localization', () => {
        it('should import i18n t function', () => {
            expect(content).toContain("import { t as i18nT } from '../../lib/i18n'");
        });

        it('should define tSearch helper using i18n', () => {
            expect(content).toContain('const tSearch = (key: string)');
            expect(content).toContain("namespace: 'search'");
            expect(content).toContain('`resultsPage.${key}`');
        });

        it('should use tSearch for page title and description', () => {
            expect(content).toContain("const pageTitle = tSearch('title')");
            expect(content).toContain("const pageDescription = tSearch('description')");
        });

        it('should use tSearch for search heading and placeholder', () => {
            expect(content).toContain("const searchHeading = tSearch('heading')");
            expect(content).toContain("const searchPlaceholder = tSearch('placeholder')");
        });

        it('should import HOME_BREADCRUMB from page-helpers', () => {
            expect(content).toContain('HOME_BREADCRUMB');
            expect(content).toContain("from '../../lib/page-helpers'");
        });

        it('should use tSearch for category labels', () => {
            expect(content).toContain(
                "const catAccommodations = tSearch('categories.accommodations')"
            );
            expect(content).toContain("const catDestinations = tSearch('categories.destinations')");
            expect(content).toContain("const catEvents = tSearch('categories.events')");
            expect(content).toContain("const catPosts = tSearch('categories.posts')");
        });

        it('should use tSearch for empty state texts', () => {
            expect(content).toContain("const emptyStateText = tSearch('emptyState')");
            expect(content).toContain("const emptySuggestion = tSearch('emptySuggestion')");
        });

        it('should use tSearch for view all links', () => {
            expect(content).toContain(
                "const viewAllAccommodations = tSearch('viewAll.accommodations')"
            );
            expect(content).toContain(
                "const viewAllDestinations = tSearch('viewAll.destinations')"
            );
            expect(content).toContain("const viewAllEvents = tSearch('viewAll.events')");
            expect(content).toContain("const viewAllPosts = tSearch('viewAll.posts')");
        });

        it('should use tSearch for results count text', () => {
            expect(content).toContain("const resultsFound = tSearch('resultsFound')");
            expect(content).toContain("const noResultsFound = tSearch('noResults')");
        });
    });

    describe('SEO elements', () => {
        it('should generate canonical URL', () => {
            expect(content).toContain('const canonicalUrl = new URL(Astro.url.pathname');
            expect(content).toContain('canonical={canonicalUrl}');
        });

        it('should pass title and description to SEOHead', () => {
            expect(content).toContain('title={pageTitle}');
            expect(content).toContain('description={pageDescription}');
        });

        it('should set page type to website', () => {
            expect(content).toContain('type="website"');
        });

        it('should have noindex directive', () => {
            expect(content).toContain('noindex={true}');
        });
    });

    describe('Breadcrumb navigation', () => {
        it('should create breadcrumb items array', () => {
            expect(content).toContain('const breadcrumbItems = [');
        });

        it('should have home breadcrumb link', () => {
            expect(content).toContain('{ label: HOME_BREADCRUMB[locale], href: `/${locale}/`');
        });

        it('should have search page breadcrumb', () => {
            expect(content).toContain('{ label: pageTitle, href: `/${locale}/busqueda/`');
        });
    });

    describe('Search form', () => {
        it('should have search form with GET method', () => {
            expect(content).toContain('<form method="GET"');
        });

        it('should point to busqueda page', () => {
            expect(content).toContain('action={`/${locale}/busqueda`}');
        });

        it('should have search input with name="q"', () => {
            expect(content).toContain('name="q"');
        });

        it('should pre-fill input with query value', () => {
            expect(content).toContain('value={query}');
        });

        it('should import SearchIcon from @repo/icons', () => {
            expect(content).toContain("from '@repo/icons'");
            expect(content).toContain('SearchIcon');
        });

        it('should have required attribute on input', () => {
            expect(content).toContain('required');
        });
    });

    describe('Search header (when query exists)', () => {
        it('should display search header conditionally', () => {
            expect(content).toContain('query');
            expect(content).toContain('id="search-header"');
        });

        it('should show query in search heading', () => {
            expect(content).toContain('{searchHeading}');
            expect(content).toContain('"{query}"');
        });

        it('should style query text with primary color', () => {
            expect(content).toContain('text-primary');
        });
    });

    describe('Result sections (when query exists)', () => {
        it('should have search-results article', () => {
            expect(content).toContain('id="search-results"');
        });

        it('should have accommodations results section', () => {
            expect(content).toContain('id="accommodations-results"');
            expect(content).toContain('{catAccommodations}');
        });

        it('should have destinations results section', () => {
            expect(content).toContain('id="destinations-results"');
            expect(content).toContain('{catDestinations}');
        });

        it('should have events results section', () => {
            expect(content).toContain('id="events-results"');
            expect(content).toContain('{catEvents}');
        });

        it('should have posts results section', () => {
            expect(content).toContain('id="posts-results"');
            expect(content).toContain('{catPosts}');
        });

        it('should have grid layout for results', () => {
            expect(content).toContain('grid');
        });

        it('should have EmptyState component for no results', () => {
            expect(content).toContain('<EmptyState');
        });
    });

    describe('Error State', () => {
        it('should import GenericErrorState', () => {
            expect(content).toContain(
                "import GenericErrorState from '../../components/error/GenericErrorState.astro'"
            );
        });

        it('should track API error when all requests fail', () => {
            expect(content).toContain('apiError');
        });

        it('should show GenericErrorState when all APIs fail', () => {
            expect(content).toContain('<GenericErrorState');
        });
    });

    describe('Empty state (no query)', () => {
        it('should have empty-state article', () => {
            expect(content).toContain('id="empty-state"');
        });

        it('should display empty state heading', () => {
            expect(content).toContain('{emptyStateText}');
        });

        it('should display suggestion text', () => {
            expect(content).toContain('{emptySuggestion}');
        });

        it('should have popular searches section', () => {
            expect(content).toContain('{popularSearchesHeading}');
        });

        it('should have popular search links', () => {
            expect(content).toContain('popularSearches.map((search)');
        });
    });

    describe('Popular searches', () => {
        it('should define popular searches via i18n mapping', () => {
            expect(content).toContain('const popularSearches');
            expect(content).toContain('[0, 1, 2, 3].map');
        });

        it('should use tSearch for popular search labels', () => {
            expect(content).toContain('tSearch(`popular.${i}.label`)');
        });

        it('should use tSearch for popular search queries', () => {
            expect(content).toContain('tSearch(`popular.${i}.query`)');
        });

        it('should link to busqueda page with query parameter', () => {
            expect(content).toContain('href: `/${locale}/busqueda/?q=');
        });
    });

    describe('Conditional rendering', () => {
        it('should conditionally render search results or empty state', () => {
            expect(content).toContain('query ?');
        });

        it('should use ternary operator for conditional rendering', () => {
            expect(content).toContain(') : (');
        });
    });

    describe('Accessibility', () => {
        it('should have aria-label on search input', () => {
            expect(content).toContain('aria-label={searchPlaceholder}');
        });

        it('should have aria-label on result regions', () => {
            expect(content).toContain('role="region"');
            expect(content).toContain('aria-label={cat');
        });

        it('should have aria-hidden on decorative icons', () => {
            expect(content).toContain('aria-hidden="true"');
        });
    });

    describe('Styling', () => {
        it('should have proper heading styling', () => {
            expect(content).toContain('text-3xl font-bold');
        });

        it('should have section headings with proper styling', () => {
            expect(content).toContain('text-2xl font-semibold');
        });

        it('should have focus styles on interactive elements', () => {
            expect(content).toContain('focus:outline-none');
            expect(content).toContain('focus:ring-2');
            expect(content).toContain('focus-visible:outline');
        });

        it('should have hover styles on links', () => {
            expect(content).toContain('hover:bg-primary');
            expect(content).toContain('hover:text-white');
        });

        it('should have rounded corners on elements', () => {
            expect(content).toContain('rounded-lg');
            expect(content).toContain('rounded-full');
        });
    });

    describe('Form attributes', () => {
        it('should have search input type', () => {
            expect(content).toContain('type="search"');
        });

        it('should have placeholder text', () => {
            expect(content).toContain('placeholder={searchPlaceholder}');
        });
    });
});
