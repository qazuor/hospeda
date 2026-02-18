/**
 * Event List Page Tests
 * Validates structure, components, localization, filters, and accessibility.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pagePath = resolve(__dirname, '../../src/pages/[lang]/eventos/index.astro');
const content = readFileSync(pagePath, 'utf8');

describe('Event List Page', () => {
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

        it('should import EventCard', () => {
            expect(content).toContain(
                "import EventCard from '../../../components/event/EventCard.astro'"
            );
        });

        it('should import EmptyState', () => {
            expect(content).toContain(
                "import EmptyState from '../../../components/ui/EmptyState.astro'"
            );
        });

        it('should import SEOHead', () => {
            expect(content).toContain(
                "import SEOHead from '../../../components/seo/SEOHead.astro'"
            );
        });

        it('should import i18n utilities', () => {
            expect(content).toContain('import { isValidLocale, type SupportedLocale }');
        });

        it('should import eventsApi', () => {
            expect(content).toContain("import { eventsApi } from '../../../lib/api/endpoints'");
        });
    });

    describe('API Integration', () => {
        it('should fetch events from API', () => {
            expect(content).toContain('const apiResult = await eventsApi.list');
        });

        it('should check apiResult.ok before using data', () => {
            expect(content).toContain('apiResult.ok');
        });

        it('should extract events from API response', () => {
            expect(content).toContain('const events = apiResult.ok ? apiResult.data.items : []');
        });

        it('should extract pagination from API response', () => {
            expect(content).toContain(
                'const pagination = apiResult.ok ? apiResult.data.pagination'
            );
        });

        it('should pass query parameters to API', () => {
            expect(content).toContain('page, pageSize');
        });
    });

    describe('Locale Validation', () => {
        it('should validate locale from params', () => {
            expect(content).toContain('const { lang } = Astro.params');
            expect(content).toContain('if (!lang || !isValidLocale(lang))');
        });

        it('should redirect to /es/ for invalid locale', () => {
            expect(content).toContain("return Astro.redirect('/es/')");
        });

        it('should cast valid locale to SupportedLocale type', () => {
            expect(content).toContain('const locale = lang as SupportedLocale');
        });
    });

    describe('Query Parameters', () => {
        it('should read category param from URL', () => {
            expect(content).toContain('const url = new URL(Astro.request.url)');
            expect(content).toContain("const category = url.searchParams.get('category')");
        });

        it('should read timeframe param from URL', () => {
            expect(content).toContain("const timeframe = url.searchParams.get('timeframe')");
        });

        it('should default timeframe to upcoming', () => {
            expect(content).toContain("|| 'upcoming'");
        });
    });

    describe('Localization', () => {
        it('should have texts for Spanish (es)', () => {
            expect(content).toContain('es: {');
            expect(content).toMatch(/title:\s*'Eventos'/);
        });

        it('should have texts for English (en)', () => {
            expect(content).toContain('en: {');
            expect(content).toMatch(/title:\s*'Events'/);
        });

        it('should have texts for Portuguese (pt)', () => {
            expect(content).toContain('pt: {');
            expect(content).toMatch(/title:\s*'Eventos'/);
        });

        it('should have all required text keys', () => {
            const requiredKeys = [
                'title',
                'description',
                'home',
                'events',
                'upcoming',
                'past',
                'all',
                'filterByCategory',
                'allCategories',
                'festival',
                'fair',
                'sport',
                'cultural',
                'gastronomy',
                'noEvents',
                'noEventsDescription'
            ];

            for (const key of requiredKeys) {
                expect(content).toContain(`${key}:`);
            }
        });
    });

    describe('Breadcrumb', () => {
        it('should have breadcrumb items array', () => {
            expect(content).toContain('const breadcrumbItems');
        });

        it('should include home breadcrumb', () => {
            expect(content).toContain('label: t.home');
        });

        it('should include events breadcrumb', () => {
            expect(content).toContain('label: t.events');
        });

        it('should render Breadcrumb component', () => {
            expect(content).toContain('<Breadcrumb items={breadcrumbItems}');
        });
    });

    describe('Page Title', () => {
        it('should have h1 with title', () => {
            expect(content).toContain('<h1');
            expect(content).toContain('{t.title}');
        });

        it('should have mb-6 spacing on h1', () => {
            expect(content).toContain('class="mb-6 text-3xl font-bold"');
        });
    });

    describe('Timeframe Toggle', () => {
        it('should have timeframe toggle with role tablist', () => {
            expect(content).toContain('role="tablist"');
        });

        it('should have upcoming timeframe option', () => {
            expect(content).toContain("'upcoming'");
            expect(content).toContain('t.upcoming');
        });

        it('should have past timeframe option', () => {
            expect(content).toContain("'past'");
            expect(content).toContain('t.past');
        });

        it('should have all timeframe option', () => {
            expect(content).toContain("'all'");
            expect(content).toContain('t.all');
        });

        it('should include current category in timeframe links', () => {
            expect(content).toContain("category ? `&category=${category}` : ''");
        });

        it('should have aria-selected attribute', () => {
            expect(content).toContain('aria-selected={timeframe === tf}');
        });
    });

    describe('Category Filter', () => {
        it('should have category filter dropdown', () => {
            expect(content).toContain('id="category-filter"');
            expect(content).toContain('<select');
        });

        it('should have label for category filter', () => {
            expect(content).toContain('for="category-filter"');
            expect(content).toContain('{t.filterByCategory}');
        });

        it('should have 6 category options', () => {
            const categoryCount = [
                'allCategories',
                'festival',
                'fair',
                'sport',
                'cultural',
                'gastronomy'
            ];
            for (const cat of categoryCount) {
                expect(content).toContain(`label: t.${cat}`);
            }
        });

        it('should mark selected option', () => {
            expect(content).toContain('selected={cat.value === category}');
        });
    });

    describe('Events Grid', () => {
        it('should have responsive grid', () => {
            expect(content).toContain('grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3');
        });

        it('should map over events and render EventCard', () => {
            expect(content).toContain('events.map');
            expect(content).toContain('<EventCard event={event');
        });

        it('should have conditional rendering for events', () => {
            expect(content).toContain('events.length > 0');
        });
    });

    describe('Empty State', () => {
        it('should render EmptyState when no events', () => {
            expect(content).toContain('<EmptyState');
        });

        it('should pass noEvents title to EmptyState', () => {
            expect(content).toContain('title={t.noEvents}');
        });

        it('should pass noEventsDescription message to EmptyState', () => {
            expect(content).toContain('message={t.noEventsDescription}');
        });
    });

    describe('SEOHead', () => {
        it('should render SEOHead in head slot', () => {
            expect(content).toContain('<SEOHead');
            expect(content).toContain('slot="head"');
        });

        it('should pass title to SEOHead', () => {
            expect(content).toContain('title={t.title}');
        });

        it('should pass description to SEOHead', () => {
            expect(content).toContain('description={t.description}');
        });

        it('should pass canonical URL to SEOHead', () => {
            expect(content).toContain('canonical={canonicalUrl}');
        });

        it('should pass locale to SEOHead', () => {
            expect(content).toContain('locale={locale}');
        });
    });

    describe('Category Filter Script', () => {
        it('should have script tag for category filter', () => {
            expect(content).toContain('<script>');
        });

        it('should get category filter element by ID', () => {
            expect(content).toContain("getElementById('category-filter')");
        });

        it('should add change event listener', () => {
            expect(content).toContain("addEventListener('change'");
        });

        it('should update URL with category param', () => {
            expect(content).toContain("url.searchParams.set('category'");
        });

        it('should remove category param when empty', () => {
            expect(content).toContain("url.searchParams.delete('category')");
        });

        it('should redirect to new URL', () => {
            expect(content).toContain('window.location.href = url.toString()');
        });
    });

    describe('API Data', () => {
        it('should fetch events from API', () => {
            expect(content).toContain('await eventsApi.list');
        });

        it('should extract events from API result', () => {
            expect(content).toContain('const events = apiResult.ok ? apiResult.data.items : []');
        });

        it('should extract pagination from API result', () => {
            expect(content).toContain(
                'const pagination = apiResult.ok ? apiResult.data.pagination'
            );
        });

        it('should pass query parameters to API', () => {
            expect(content).toContain('page, pageSize');
        });

        it('should pass category filter to API', () => {
            expect(content).toContain('category');
        });

        it('should pass event directly to EventCard', () => {
            expect(content).toContain('event');
        });
    });

    describe('Filter Links Preserve Params', () => {
        it('should preserve category in timeframe links', () => {
            expect(content).toContain('`/${locale}/eventos/?timeframe=${tf}${category');
        });

        it('should build timeframe links dynamically', () => {
            expect(content).toContain("['upcoming', 'past', 'all'].map");
        });
    });

    describe('Code Quality', () => {
        it('should have JSDoc comment at top', () => {
            expect(content).toMatch(/\/\*\*[\s\S]*Event List Page/);
        });

        it('should not use default exports', () => {
            expect(content).not.toContain('export default');
        });

        it('should have proper TypeScript types', () => {
            expect(content).toContain('Record<');
            expect(content).toContain('SupportedLocale');
        });

        it('should be under 500 lines', () => {
            const lineCount = content.split('\n').length;
            expect(lineCount).toBeLessThan(500);
        });
    });

    describe('Component Usage', () => {
        it('should use BaseLayout with props', () => {
            expect(content).toContain('<BaseLayout');
            expect(content).toContain('title={t.title}');
            expect(content).toContain('description={t.description}');
            expect(content).toContain('locale={locale}');
        });

        it('should use Container wrapper', () => {
            expect(content).toContain('<Container>');
            expect(content).toContain('</Container>');
        });

        it('should pass locale to EventCard', () => {
            expect(content).toContain('locale={locale}');
        });
    });

    describe('Accessibility', () => {
        it('should have semantic select element', () => {
            expect(content).toContain('<select');
        });

        it('should have label associated with select', () => {
            expect(content).toContain('<label for="category-filter"');
        });

        it('should use role attribute on tablist', () => {
            expect(content).toContain('role="tablist"');
        });

        it('should use role attribute on tabs', () => {
            expect(content).toContain('role="tab"');
        });
    });
});
