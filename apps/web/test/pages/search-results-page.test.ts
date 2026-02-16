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
            expect(content).toContain('const { lang } = Astro.params');
            expect(content).toContain('if (!lang || !isValidLocale(lang))');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(content).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers', () => {
            expect(content).toContain('isValidLocale');
            expect(content).toContain('type SupportedLocale');
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
        it('should have localized titles for all supported locales', () => {
            expect(content).toContain("es: 'Resultados de búsqueda'");
            expect(content).toContain("en: 'Search Results'");
            expect(content).toContain("pt: 'Resultados da busca'");
        });

        it('should have localized meta descriptions', () => {
            expect(content).toContain('const descriptions: Record<SupportedLocale, string>');
            expect(content).toContain('alojamientos, destinos, eventos y publicaciones');
        });

        it('should have localized home breadcrumb labels', () => {
            expect(content).toContain('const homeLabels: Record<SupportedLocale, string>');
            expect(content).toContain("es: 'Inicio'");
            expect(content).toContain("en: 'Home'");
            expect(content).toContain("pt: 'Início'");
        });

        it('should have localized search headings', () => {
            expect(content).toContain('const searchHeadings: Record<SupportedLocale, string>');
            expect(content).toContain("es: 'Resultados para'");
            expect(content).toContain("en: 'Results for'");
            expect(content).toContain("pt: 'Resultados para'");
        });

        it('should have localized search placeholders', () => {
            expect(content).toContain('const searchPlaceholders: Record<SupportedLocale, string>');
            expect(content).toContain('Buscar alojamientos');
        });

        it('should have localized category labels', () => {
            expect(content).toContain('const categoryLabels: Record<SupportedLocale,');
            expect(content).toContain('accommodations:');
            expect(content).toContain('destinations:');
            expect(content).toContain('events:');
            expect(content).toContain('posts:');
        });

        it('should have localized empty state texts', () => {
            expect(content).toContain('const emptyStateTexts: Record<SupportedLocale, string>');
            expect(content).toContain('No se encontraron resultados');
        });

        it('should have localized empty state suggestions', () => {
            expect(content).toContain('const emptySuggestions: Record<SupportedLocale, string>');
            expect(content).toContain('Intenta con otros términos');
        });
    });

    describe('SEO elements', () => {
        it('should generate canonical URL', () => {
            expect(content).toContain('const canonicalUrl = new URL(Astro.url.pathname');
            expect(content).toContain('canonical={canonicalUrl}');
        });

        it('should pass title and description to SEOHead', () => {
            expect(content).toContain('title={titles[locale]}');
            expect(content).toContain('description={descriptions[locale]}');
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
            expect(content).toContain('{ label: homeLabels[locale], href: `/${locale}/`');
        });

        it('should have search page breadcrumb', () => {
            expect(content).toContain('{ label: titles[locale], href: `/${locale}/busqueda/`');
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
            expect(content).toContain('{');
            expect(content).toContain('query');
            expect(content).toContain('id="search-header"');
        });

        it('should show query in search heading', () => {
            expect(content).toContain('{searchHeadings[locale]}');
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
            expect(content).toContain('{categoryLabels[locale].accommodations}');
        });

        it('should have destinations results section', () => {
            expect(content).toContain('id="destinations-results"');
            expect(content).toContain('{categoryLabels[locale].destinations}');
        });

        it('should have events results section', () => {
            expect(content).toContain('id="events-results"');
            expect(content).toContain('{categoryLabels[locale].events}');
        });

        it('should have posts results section', () => {
            expect(content).toContain('id="posts-results"');
            expect(content).toContain('{categoryLabels[locale].posts}');
        });

        it('should have grid layout for results', () => {
            expect(content).toContain('grid');
        });

        it('should have EmptyState component for no results', () => {
            expect(content).toContain('<EmptyState');
        });
    });

    describe('Empty state (no query)', () => {
        it('should have empty-state article', () => {
            expect(content).toContain('id="empty-state"');
        });

        it('should display empty state heading', () => {
            expect(content).toContain('{emptyStateTexts[locale]}');
        });

        it('should display suggestion text', () => {
            expect(content).toContain('{emptySuggestions[locale]}');
        });

        it('should have popular searches section', () => {
            expect(content).toContain('{popularSearchesHeadings[locale]}');
        });

        it('should have popular search links', () => {
            expect(content).toContain('popularSearches[locale]');
            expect(content).toContain('.map((search)');
        });
    });

    describe('Popular searches', () => {
        it('should define popular searches for all locales', () => {
            expect(content).toContain('const popularSearches: Record<SupportedLocale,');
        });

        it('should have Hoteles/Hotels search', () => {
            expect(content).toContain('Hoteles');
            expect(content).toContain('Hotels');
        });

        it('should have Cabañas/Cabins search', () => {
            expect(content).toContain('Cabañas');
            expect(content).toContain('Cabins');
        });

        it('should have Concepción del Uruguay search', () => {
            expect(content).toContain('Concepción del Uruguay');
        });

        it('should have Eventos/Events search', () => {
            expect(content).toContain('Eventos');
            expect(content).toContain('Events');
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
            expect(content).toContain('aria-label={searchPlaceholders[locale]}');
        });

        it('should have aria-label on result regions', () => {
            expect(content).toContain('role="region"');
            expect(content).toContain('aria-label={categoryLabels[locale]');
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
            expect(content).toContain('placeholder={searchPlaceholders[locale]}');
        });
    });
});
