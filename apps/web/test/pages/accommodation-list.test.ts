import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pagePath = resolve(__dirname, '../../src/pages/[lang]/alojamientos/index.astro');
const content = readFileSync(pagePath, 'utf8');

const partialPath = resolve(
    __dirname,
    '../../src/components/accommodation/_AccommodationListLayout.astro'
);
const partialContent = readFileSync(partialPath, 'utf8');

describe('[lang]/alojamientos/index.astro', () => {
    describe('Imports', () => {
        it('should import AccommodationListLayout partial', () => {
            expect(content).toContain('_AccommodationListLayout.astro');
        });

        it('should import accommodationsApi', () => {
            expect(content).toContain('accommodationsApi');
        });

        it('should import toAccommodationCardProps transform', () => {
            expect(content).toContain('toAccommodationCardProps');
        });

        it('should import createT from i18n', () => {
            expect(content).toContain('createT');
        });

        it('should import buildUrl from urls', () => {
            expect(content).toContain('buildUrl');
        });
    });

    describe('Query params handling', () => {
        it('should read q search param', () => {
            expect(content).toContain("sp.get('q')");
        });

        it('should read sortBy param with featured default', () => {
            expect(content).toContain("sp.get('sortBy')");
            expect(content).toContain("'featured'");
        });

        it('should read page param with parseInt and Math.max', () => {
            expect(content).toContain("sp.get('page')");
            expect(content).toContain('Number.parseInt');
            expect(content).toContain('Math.max');
        });

        it('should read types param for accommodation type filter', () => {
            expect(content).toContain("sp.get('types')");
        });

        it('should read price range params', () => {
            expect(content).toContain("sp.get('priceMin')");
            expect(content).toContain("sp.get('priceMax')");
        });

        it('should read capacity filter params', () => {
            expect(content).toContain("sp.get('minGuests')");
            expect(content).toContain("sp.get('minBedrooms')");
            expect(content).toContain("sp.get('minBathrooms')");
        });

        it('should read rating filter param', () => {
            expect(content).toContain("sp.get('minRating')");
        });

        it('should read boolean amenity filter params', () => {
            expect(content).toContain("sp.get('hasWifi')");
            expect(content).toContain("sp.get('hasPool')");
            expect(content).toContain("sp.get('allowsPets')");
            expect(content).toContain("sp.get('hasParking')");
        });

        it('should read destination filter param', () => {
            expect(content).toContain("sp.get('destination')");
        });
    });

    describe('Sort map', () => {
        it('should define SORT_MAP as readonly record', () => {
            expect(content).toContain('SORT_MAP');
            expect(content).toContain('Readonly<Record');
        });

        it('should include featured sort option', () => {
            expect(content).toContain('featured:');
            expect(content).toContain('isFeatured');
        });

        it('should include rating sort option', () => {
            expect(content).toContain('rating:');
            expect(content).toContain('averageRating');
        });

        it('should include recent sort option', () => {
            expect(content).toContain('recent:');
            expect(content).toContain('createdAt');
        });
    });

    describe('API call', () => {
        it('should call accommodationsApi.list with pagination params', () => {
            expect(content).toContain('accommodationsApi.list(');
            expect(content).toContain('page,');
            expect(content).toContain('PAGE_SIZE');
        });

        it('should pass sort params to API', () => {
            expect(content).toContain('sortConfig.sortBy');
            expect(content).toContain('sortConfig.sortOrder');
        });

        it('should pass amenity/feature includes', () => {
            expect(content).toContain('includeAmenities: true');
            expect(content).toContain('includeFeatures:  true');
        });

        it('should handle API error state', () => {
            expect(content).toContain('apiError');
            expect(content).toContain('!apiResult.ok');
        });

        it('should extract items and pagination from response', () => {
            expect(content).toContain('apiResult.data.items');
            expect(content).toContain('apiResult.data.pagination');
        });

        it('should map accommodations to card props', () => {
            expect(content).toContain('toAccommodationCardProps');
            expect(content).toContain('const cards =');
        });
    });

    describe('i18n', () => {
        it('should use locale from params', () => {
            expect(content).toContain('getLocaleFromParams');
        });

        it('should redirect on invalid locale', () => {
            expect(content).toContain("Astro.redirect('/es/')");
        });

        it('should create translations with createT', () => {
            expect(content).toContain('createT(locale');
        });

        it('should translate page title', () => {
            expect(content).toContain("'accommodations.listPage.title'");
        });

        it('should use HOME_BREADCRUMB for breadcrumb', () => {
            expect(content).toContain('HOME_BREADCRUMB');
        });
    });

    describe('Active filters', () => {
        it('should compute hasActiveFilters', () => {
            expect(content).toContain('hasActiveFilters');
            expect(content).toContain('typesFilter.length > 0');
        });
    });

    describe('Initial filters for sidebar', () => {
        it('should reconstruct initialFilters from URL params', () => {
            expect(content).toContain('initialFilters');
            expect(content).toContain('AccommodationFilters');
        });
    });

    describe('Canonical URL', () => {
        it('should build canonical URL from Astro.url', () => {
            expect(content).toContain('canonicalUrl');
            expect(content).toContain('Astro.url.pathname');
            expect(content).toContain('Astro.site');
        });
    });

    describe('AccommodationListLayout partial usage', () => {
        it('should render AccommodationListLayout with locale', () => {
            expect(content).toContain('<AccommodationListLayout');
            expect(content).toContain('locale={locale');
        });

        it('should pass title and description to the partial', () => {
            expect(content).toContain('title={pageTitle}');
            expect(content).toContain('description={pageDescription}');
        });

        it('should pass breadcrumbItems to the partial', () => {
            expect(content).toContain('breadcrumbItems={breadcrumbItems}');
        });

        it('should pass cards, pagination and apiError to the partial', () => {
            expect(content).toContain('cards={cards}');
            expect(content).toContain('pagination={pagination}');
            expect(content).toContain('apiError={apiError}');
        });

        it('should pass filter-related props to the partial', () => {
            expect(content).toContain('hasActiveFilters={hasActiveFilters}');
            expect(content).toContain('initialFilters={initialFilters}');
            expect(content).toContain('paginationParams={paginationParams}');
        });
    });
});

describe('_AccommodationListLayout.astro (shared partial)', () => {
    describe('Imports', () => {
        it('should import BaseLayout', () => {
            expect(partialContent).toContain('import BaseLayout from');
            expect(partialContent).toContain('BaseLayout.astro');
        });

        it('should import SEOHead', () => {
            expect(partialContent).toContain('import SEOHead from');
            expect(partialContent).toContain('SEOHead.astro');
        });

        it('should import Breadcrumb from shared', () => {
            expect(partialContent).toContain('import Breadcrumb from');
            expect(partialContent).toContain('shared/Breadcrumb.astro');
        });

        it('should import AccommodationCard from shared', () => {
            expect(partialContent).toContain('import AccommodationCard from');
            expect(partialContent).toContain('shared/AccommodationCard.astro');
        });

        it('should import EmptyState from shared', () => {
            expect(partialContent).toContain('import EmptyState from');
        });

        it('should import Pagination from shared', () => {
            expect(partialContent).toContain('import Pagination from');
        });

        it('should import SortDropdown from shared', () => {
            expect(partialContent).toContain('import SortDropdown from');
        });

        it('should import FilterSidebar client island', () => {
            expect(partialContent).toContain('FilterSidebar');
            expect(partialContent).toContain('FilterSidebar.client');
        });

        it('should import createT from i18n', () => {
            expect(partialContent).toContain('createT');
        });
    });

    describe('Props interface', () => {
        it('should define a Props interface with readonly fields', () => {
            expect(partialContent).toContain('interface Props');
            expect(partialContent).toContain('readonly locale');
            expect(partialContent).toContain('readonly title');
            expect(partialContent).toContain('readonly cards');
            expect(partialContent).toContain('readonly pagination');
            expect(partialContent).toContain('readonly apiError');
            expect(partialContent).toContain('readonly hasActiveFilters');
            expect(partialContent).toContain('readonly initialFilters');
        });

        it('should type cards as AccommodationCardData array', () => {
            expect(partialContent).toContain('AccommodationCardData');
        });
    });

    describe('Template structure', () => {
        it('should render BaseLayout with locale', () => {
            expect(partialContent).toContain('<BaseLayout');
            expect(partialContent).toContain('locale={locale}');
        });

        it('should render SEOHead in head slot', () => {
            expect(partialContent).toContain('<SEOHead');
            expect(partialContent).toContain('slot="head"');
            expect(partialContent).toContain('canonical=');
        });

        it('should render Breadcrumb component', () => {
            expect(partialContent).toContain('<Breadcrumb');
            expect(partialContent).toContain('items={breadcrumbItems}');
        });

        it('should render plain HTML search form (no JS island)', () => {
            expect(partialContent).toContain('<form');
            expect(partialContent).toContain('method="get"');
            expect(partialContent).toContain('name="q"');
        });

        it('should render FilterSidebar with client:visible', () => {
            expect(partialContent).toContain('FilterSidebar');
            expect(partialContent).toContain('client:visible');
        });

        it('should render SortDropdown', () => {
            expect(partialContent).toContain('<SortDropdown');
            expect(partialContent).toContain('currentSort={sortParam}');
        });

        it('should render accommodation grid with responsive columns', () => {
            expect(partialContent).toContain('grid-cols-1');
            expect(partialContent).toContain('xl:grid-cols-3');
        });

        it('should render AccommodationCard in grid', () => {
            expect(partialContent).toContain('<AccommodationCard');
            expect(partialContent).toContain('card={card}');
        });

        it('should render EmptyState on error and on no results', () => {
            expect(partialContent).toContain('<EmptyState');
        });

        it('should render Pagination with searchParams to preserve filters', () => {
            expect(partialContent).toContain('<Pagination');
            expect(partialContent).toContain('searchParams={paginationParams}');
        });

        it('should show results count with pagination total', () => {
            expect(partialContent).toContain('pagination.total');
        });

        it('should render active filter indicator and clear link', () => {
            expect(partialContent).toContain('hasActiveFilters');
            expect(partialContent).toContain('clearFiltersUrl');
        });
    });
});
