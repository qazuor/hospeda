import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pagePath = resolve(__dirname, '../../src/pages/[lang]/destinos/index.astro');
const content = readFileSync(pagePath, 'utf8');

describe('[lang]/destinos/index.astro', () => {
    describe('Rendering mode', () => {
        it('should use SSR (no prerender export)', () => {
            expect(content).not.toContain('export const prerender = true');
        });

        it('should use getLocaleFromParams for runtime locale resolution', () => {
            expect(content).toContain('getLocaleFromParams');
        });
    });

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

        it('should import DestinationCard from shared', () => {
            expect(content).toContain('import DestinationCard from');
            expect(content).toContain('shared/DestinationCard.astro');
        });

        it('should import EmptyState from shared', () => {
            expect(content).toContain('import EmptyState from');
            expect(content).toContain('shared/EmptyState.astro');
        });

        it('should import Pagination from shared', () => {
            expect(content).toContain('import Pagination from');
            expect(content).toContain('shared/Pagination.astro');
        });

        it('should import LocationIcon from @repo/icons', () => {
            expect(content).toContain('LocationIcon');
            expect(content).toContain('@repo/icons');
        });

        it('should import createT from i18n', () => {
            expect(content).toContain('createT');
            expect(content).toContain("from '../../../lib/i18n'");
        });

        it('should import buildUrl from urls', () => {
            expect(content).toContain('buildUrl');
            expect(content).toContain("from '../../../lib/urls'");
        });

        it('should import destinationsApi', () => {
            expect(content).toContain('destinationsApi');
            expect(content).toContain("from '../../../lib/api/endpoints'");
        });

        it('should import toDestinationCardProps transform', () => {
            expect(content).toContain('toDestinationCardProps');
        });

        it('should import getLocaleFromParams and HOME_BREADCRUMB', () => {
            expect(content).toContain('getLocaleFromParams');
            expect(content).toContain('HOME_BREADCRUMB');
        });
    });

    describe('API call', () => {
        it('should call destinationsApi.list with page and pageSize', () => {
            expect(content).toContain('destinationsApi.list({ page, pageSize })');
        });

        it('should read page number from URL searchParams', () => {
            expect(content).toContain("sp.get('page')");
            expect(content).toContain('const pageSize = 12');
        });

        it('should handle API error state', () => {
            expect(content).toContain('apiError');
            expect(content).toContain('!result.ok');
        });

        it('should extract destinations from response', () => {
            expect(content).toContain('result.data.items');
            expect(content).toContain('result.data.pagination');
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

        it('should translate listing title', () => {
            expect(content).toContain("'destination.listing.title'");
        });

        it('should translate hero heading', () => {
            expect(content).toContain("'destination.listing.hero.heading'");
        });

        it('should use HOME_BREADCRUMB for breadcrumb label', () => {
            expect(content).toContain('HOME_BREADCRUMB[locale');
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

        it('should render hero section with aria-labelledby', () => {
            expect(content).toContain('aria-labelledby="destinations-hero-heading"');
        });

        it('should render h1 with hero heading id', () => {
            expect(content).toContain('id="destinations-hero-heading"');
        });

        it('should render destination grid with role="list"', () => {
            expect(content).toContain('role="list"');
        });

        it('should render DestinationCard with role="listitem" wrapper', () => {
            expect(content).toContain('<DestinationCard');
            expect(content).toContain('role="listitem"');
        });

        it('should render destination grid with 3-column layout', () => {
            expect(content).toContain('lg:grid-cols-3');
        });

        it('should render EmptyState for API error', () => {
            expect(content).toContain('<EmptyState');
            expect(content).toContain("'destination.error.title'");
        });

        it('should render EmptyState for empty results', () => {
            expect(content).toContain('emptyStateTitle');
            expect(content).toContain('emptyStateMessage');
        });

        it('should render Pagination when totalPages > 1', () => {
            expect(content).toContain('<Pagination');
            expect(content).toContain('pagination.totalPages > 1');
        });

        it('should render regional highlight section', () => {
            expect(content).toContain('aria-labelledby="regional-heading"');
            expect(content).toContain('id="regional-heading"');
        });

        it('should render province highlights with LocationIcon', () => {
            expect(content).toContain('<LocationIcon');
            expect(content).toContain('aria-hidden="true"');
            expect(content).toContain('Entre Rios');
            expect(content).toContain('Corrientes');
            expect(content).toContain('Santa Fe');
        });

        it('should use semantic CSS tokens', () => {
            expect(content).toContain('bg-card');
            expect(content).toContain('text-foreground');
            expect(content).toContain('text-muted-foreground');
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
