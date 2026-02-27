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

        it('should import AccommodationCardDetailed', () => {
            expect(content).toContain(
                "import AccommodationCardDetailed from '../../../components/accommodation/AccommodationCardDetailed.astro'"
            );
        });

        it('should import FilterChipsBar client component', () => {
            expect(content).toContain('FilterChipsBar');
        });

        it('should import i18n utilities', () => {
            expect(content).toContain('getLocaleFromParams');
            expect(content).toContain('type SupportedLocale');
            expect(content).toContain("from '../../../lib/page-helpers'");
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

        it('should import AccommodationErrorState', () => {
            expect(content).toContain(
                "import AccommodationErrorState from '../../../components/error/AccommodationErrorState.astro'"
            );
        });
    });

    describe('Locale Validation', () => {
        it('should extract locale from params', () => {
            expect(content).toContain('getLocaleFromParams(Astro.params)');
        });

        it('should validate locale with getLocaleFromParams', () => {
            expect(content).toContain('if (!locale)');
        });

        it('should redirect to /es/ if locale is invalid', () => {
            expect(content).toContain("return Astro.redirect('/es/')");
        });

        it('should have validated locale as SupportedLocale', () => {
            expect(content).toContain('const locale = getLocaleFromParams(Astro.params)');
        });
    });

    describe('Rendering Strategy (SSR)', () => {
        it('should use SSR (no prerender)', () => {
            expect(content).toContain('export const prerender = false');
        });
    });

    describe('URL Query Parameters', () => {
        it('should extract sort parameter from URL', () => {
            expect(content).toContain("sp.get('sortBy')");
        });

        it('should extract page parameter from URL', () => {
            expect(content).toContain("sp.get('page')");
        });
    });

    describe('Localized Texts', () => {
        it('should import i18n t function', () => {
            expect(content).toContain("import { t as i18nT } from '../../../lib/i18n'");
        });

        it('should define tList helper using i18n', () => {
            expect(content).toContain('const tList = (key: string)');
            expect(content).toContain("namespace: 'accommodations'");
            expect(content).toContain('`listPage.${key}`');
        });

        it('should use tList for title', () => {
            expect(content).toContain("tList('title')");
        });

        it('should use tList for showing/results', () => {
            expect(content).toContain("tList('showing')");
            expect(content).toContain("tList('results')");
        });
    });

    describe('Page Header', () => {
        it('should have page title with h1', () => {
            expect(content).toContain('<h1');
            expect(content).toContain("{tList('title')}");
        });

        it('should display results count', () => {
            expect(content).toContain("{tList('showing')}");
            expect(content).toContain("{tList('results')}");
        });
    });

    describe('Sort Dropdown', () => {
        it('should have SortDropdown component', () => {
            expect(content).toContain('SortDropdown');
        });

        it('should pass current sort to SortDropdown', () => {
            expect(content).toContain('currentSort={sortParam}');
        });
    });

    describe('FilterChipsBar Component', () => {
        it('should render FilterChipsBar with client:idle directive', () => {
            expect(content).toContain('FilterChipsBar');
            expect(content).toContain('client:idle');
        });
    });

    describe('Accommodation Grid', () => {
        it('should have responsive grid layout', () => {
            expect(content).toContain('grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3');
        });

        it('should map accommodations to cards', () => {
            expect(content).toContain('cards.map');
            expect(content).toContain('AccommodationCardDetailed');
            expect(content).toContain('locale={locale}');
        });

        it('should show EmptyState when no accommodations', () => {
            expect(content).toContain('cards.length > 0');
            expect(content).toContain('<EmptyState');
        });

        it('should track API error state', () => {
            expect(content).toContain('const apiError = !result.ok');
        });

        it('should show AccommodationErrorState when API fails', () => {
            expect(content).toContain('<AccommodationErrorState');
            expect(content).toContain('apiError');
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
            expect(content).toContain('totalPages={pagination.totalPages}');
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
            expect(content).toContain("{ label: tList('home'), href: `/${locale}/` }");
        });
    });

    describe('SEOHead', () => {
        it('should render SEOHead in head slot', () => {
            expect(content).toContain('<SEOHead');
            expect(content).toContain('slot="head"');
        });

        it('should pass title and description', () => {
            expect(content).toContain("title={tList('title')}");
            expect(content).toContain("description={tList('description')}");
        });

        it('should pass canonical URL', () => {
            expect(content).toContain('canonical={canonicalUrl}');
        });

        it('should pass locale', () => {
            expect(content).toContain('locale={locale}');
        });
    });

    describe('Sort Change Script', () => {
        it('should use SortDropdown component for sort handling', () => {
            expect(content).toContain('SortDropdown');
        });
    });

    describe('API Integration', () => {
        it('should fetch accommodations from API', () => {
            expect(content).toContain('await accommodationsApi.list');
        });

        it('should check result.ok before using data', () => {
            expect(content).toContain('result.ok');
        });

        it('should extract accommodations from API response', () => {
            expect(content).toContain('result.ok ? (result.data.items');
        });

        it('should extract pagination from API response', () => {
            expect(content).toContain('result.ok');
            expect(content).toContain('pagination');
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
            expect(content).toContain('* @rendering SSR');
        });

        it('should document localized text strings', () => {
            expect(content).toContain('i18n');
        });

        it('should document sort options', () => {
            expect(content).toContain('SORT_MAP');
        });

        it('should document breadcrumb items', () => {
            expect(content).toContain('breadcrumbItems');
        });

        it('should document canonical URL', () => {
            expect(content).toContain('canonicalUrl');
        });

        it('should document sort change handler', () => {
            expect(content).toContain('SortDropdown');
        });
    });

    describe('TypeScript Types', () => {
        it('should use SupportedLocale type', () => {
            expect(content).toContain('SupportedLocale');
        });

        it('should use i18n t function for translations', () => {
            expect(content).toContain('i18nT');
            expect(content).toContain('tList');
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
    });

    describe('Layout and Styling', () => {
        it('should use responsive flexbox for header', () => {
            expect(content).toContain('flex flex-col gap-3 sm:flex-row');
        });

        it('should use responsive grid for accommodations', () => {
            expect(content).toContain('grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3');
        });

        it('should use Pagination component for pagination styling', () => {
            expect(content).toContain('<Pagination');
        });
    });

    describe('File Size', () => {
        it('should be under 500 lines', () => {
            const lines = content.split('\n').length;
            expect(lines).toBeLessThan(500);
        });
    });
});
