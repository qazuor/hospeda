import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pagePath = resolve(__dirname, '../../src/pages/[lang]/eventos/index.astro');
const content = readFileSync(pagePath, 'utf8');

describe('[lang]/eventos/index.astro', () => {
    describe('Imports', () => {
        it('should import BaseLayout', () => {
            expect(content).toContain('import BaseLayout from');
            expect(content).toContain('BaseLayout.astro');
        });

        it('should import SEOHead', () => {
            expect(content).toContain('import SEOHead from');
            expect(content).toContain('SEOHead.astro');
        });

        it('should import Breadcrumb from shared', () => {
            expect(content).toContain('import Breadcrumb from');
            expect(content).toContain('shared/Breadcrumb.astro');
        });

        it('should import EventCard from shared', () => {
            expect(content).toContain('import EventCard from');
            expect(content).toContain('shared/EventCard.astro');
        });

        it('should import EmptyState from shared', () => {
            expect(content).toContain('import EmptyState from');
            expect(content).toContain('shared/EmptyState.astro');
        });

        it('should import Pagination from shared', () => {
            expect(content).toContain('import Pagination from');
            expect(content).toContain('shared/Pagination.astro');
        });

        it('should import icon components from @repo/icons', () => {
            expect(content).toContain('@repo/icons');
            expect(content).toContain('CalendarIcon');
            expect(content).toContain('ClockIcon');
            expect(content).toContain('ListIcon');
        });

        it('should import eventsApi', () => {
            expect(content).toContain('eventsApi');
        });

        it('should import toEventCardProps transform', () => {
            expect(content).toContain('toEventCardProps');
        });

        it('should import createT from i18n', () => {
            expect(content).toContain('createT');
            expect(content).toContain("from '../../../lib/i18n'");
        });

        it('should import buildUrl and buildUrlWithParams from urls', () => {
            expect(content).toContain('buildUrl');
            expect(content).toContain('buildUrlWithParams');
        });
    });

    describe('Query params handling', () => {
        it('should read timeframe param with upcoming default', () => {
            expect(content).toContain("searchParams.get('timeframe')");
            expect(content).toContain("'upcoming'");
        });

        it('should read category filter param', () => {
            expect(content).toContain("searchParams.get('category')");
        });

        it('should read page param with parseInt and Math.max', () => {
            expect(content).toContain("searchParams.get('page')");
            expect(content).toContain('Number.parseInt');
            expect(content).toContain('Math.max');
        });

        it('should use Astro.url.searchParams', () => {
            expect(content).toContain('Astro.url.searchParams');
        });
    });

    describe('Timeframe tabs', () => {
        it('should define TimeframeTab interface', () => {
            expect(content).toContain('interface TimeframeTab');
        });

        it('should define timeframeTabs array', () => {
            expect(content).toContain('timeframeTabs');
        });

        it('should define buildTimeframeUrl helper', () => {
            expect(content).toContain('function buildTimeframeUrl');
        });

        it('should define buildCategoryUrl helper', () => {
            expect(content).toContain('function buildCategoryUrl');
        });
    });

    describe('Category options', () => {
        it('should define categories array', () => {
            expect(content).toContain('categories');
        });

        it('should include festival category', () => {
            expect(content).toContain("'festival'");
        });

        it('should include fair category', () => {
            expect(content).toContain("'fair'");
        });

        it('should include sport category', () => {
            expect(content).toContain("'sport'");
        });

        it('should include cultural category', () => {
            expect(content).toContain("'cultural'");
        });

        it('should include gastronomy category', () => {
            expect(content).toContain("'gastronomy'");
        });
    });

    describe('API call', () => {
        it('should call eventsApi.list with pagination params', () => {
            expect(content).toContain('eventsApi.list(apiParams)');
            expect(content).toContain('page,');
            expect(content).toContain('PAGE_SIZE');
        });

        it('should pass sortBy startDate to API', () => {
            expect(content).toContain("sortBy: 'startDate'");
        });

        it('should conditionally pass category filter', () => {
            expect(content).toContain('category ? { category }');
        });

        it('should handle API error state', () => {
            expect(content).toContain('apiError');
            expect(content).toContain('!apiResult.ok');
        });

        it('should extract events and pagination from response', () => {
            expect(content).toContain('apiResult.data.items');
            expect(content).toContain('apiResult.data.pagination');
        });

        it('should map events to card props', () => {
            expect(content).toContain('toEventCardProps');
            expect(content).toContain('const eventCards');
        });
    });

    describe('i18n', () => {
        it('should use locale from params', () => {
            expect(content).toContain('getLocaleFromParams');
        });

        it('should redirect on invalid locale', () => {
            expect(content).toContain("Astro.redirect('/es/')");
        });

        it('should use createT for translations', () => {
            expect(content).toContain('createT(locale');
        });

        it('should translate page title', () => {
            expect(content).toContain("'events.listPage.title'");
        });

        it('should translate upcoming, past, all labels', () => {
            expect(content).toContain("'events.listPage.upcoming'");
            expect(content).toContain("'events.listPage.past'");
            expect(content).toContain("'events.listPage.all'");
        });

        it('should translate category filter labels', () => {
            expect(content).toContain("'events.listPage.festival'");
            expect(content).toContain("'events.listPage.cultural'");
        });

        it('should use HOME_BREADCRUMB for breadcrumb home label', () => {
            expect(content).toContain('HOME_BREADCRUMB');
        });
    });

    describe('Template structure', () => {
        it('should render BaseLayout with title and locale', () => {
            expect(content).toContain('<BaseLayout');
            expect(content).toContain('locale={locale}');
        });

        it('should render SEOHead in head slot', () => {
            expect(content).toContain('<SEOHead');
            expect(content).toContain('slot="head"');
            expect(content).toContain('canonical=');
        });

        it('should render Breadcrumb', () => {
            expect(content).toContain('<Breadcrumb');
            expect(content).toContain('items={breadcrumbItems}');
        });

        it('should render timeframe tab bar with role=tablist', () => {
            expect(content).toContain('role="tablist"');
            expect(content).toContain('role="tab"');
            expect(content).toContain('aria-selected=');
        });

        it('should render timeframe tabs using CalendarIcon, ClockIcon, ListIcon', () => {
            expect(content).toContain('<CalendarIcon');
            expect(content).toContain('<ClockIcon');
            expect(content).toContain('<ListIcon');
        });

        it('should render category filter as HTML links (no JS)', () => {
            expect(content).toContain('aria-labelledby="category-filter-label"');
            expect(content).toContain('buildCategoryUrl(value)');
        });

        it('should render events grid with 3-column layout', () => {
            expect(content).toContain('grid-cols-1');
            expect(content).toContain('lg:grid-cols-3');
        });

        it('should render EventCard components in grid', () => {
            expect(content).toContain('<EventCard');
            expect(content).toContain('locale={locale}');
        });

        it('should render EmptyState on API error', () => {
            expect(content).toContain('<EmptyState');
            expect(content).toContain('errorTitle');
        });

        it('should render EmptyState when no events', () => {
            expect(content).toContain('noEventsTitle');
            expect(content).toContain('noEventsMessage');
        });

        it('should render Pagination with searchParams to preserve filters', () => {
            expect(content).toContain('<Pagination');
            expect(content).toContain('searchParams={paginationParams}');
        });
    });

    describe('Pagination params', () => {
        it('should build paginationParams preserving timeframe and category', () => {
            expect(content).toContain('paginationParams');
            expect(content).toContain('new URLSearchParams({ timeframe })');
        });
    });

    describe('Canonical URL', () => {
        it('should build canonical URL from Astro.url', () => {
            expect(content).toContain('canonicalUrl');
            expect(content).toContain('Astro.url.pathname');
            expect(content).toContain('Astro.site');
        });
    });
});
