import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const paginationPath = resolve(__dirname, '../../src/pages/[lang]/alojamientos/page/[page].astro');
const typeIndexPath = resolve(
    __dirname,
    '../../src/pages/[lang]/alojamientos/tipo/[type]/index.astro'
);
const typePaginationPath = resolve(
    __dirname,
    '../../src/pages/[lang]/alojamientos/tipo/[type]/page/[page].astro'
);
const partialPath = resolve(
    __dirname,
    '../../src/components/accommodation/_AccommodationListLayout.astro'
);

const paginationContent = readFileSync(paginationPath, 'utf8');
const typeIndexContent = readFileSync(typeIndexPath, 'utf8');
const typePaginationContent = readFileSync(typePaginationPath, 'utf8');
const partialContent = readFileSync(partialPath, 'utf8');

describe('[lang]/alojamientos/page/[page].astro', () => {
    describe('Rendering mode', () => {
        it('should export prerender = false for SSR', () => {
            expect(paginationContent).toContain('export const prerender = false');
        });
    });

    describe('Locale handling', () => {
        it('should import getLocaleFromParams', () => {
            expect(paginationContent).toContain('getLocaleFromParams');
        });

        it('should redirect on invalid locale', () => {
            expect(paginationContent).toContain("Astro.redirect('/es/')");
        });
    });

    describe('Page param validation', () => {
        it('should parse page param as integer', () => {
            expect(paginationContent).toContain('Number.parseInt');
            expect(paginationContent).toContain("page ?? '1'");
        });

        it('should redirect on NaN or negative page value', () => {
            expect(paginationContent).toContain('Number.isNaN');
            expect(paginationContent).toContain('alojamientos/');
        });

        it('should redirect page 1 to canonical base URL', () => {
            expect(paginationContent).toContain('pageNum === 1');
            expect(paginationContent).toContain('alojamientos/');
        });
    });

    describe('Rewrite behavior', () => {
        it('should rewrite pages >1 to index with query param', () => {
            expect(paginationContent).toContain('Astro.rewrite');
            expect(paginationContent).toContain('?page=${pageNum}');
            expect(paginationContent).toContain('alojamientos/');
        });
    });
});

describe('[lang]/alojamientos/tipo/[type]/index.astro', () => {
    describe('Imports', () => {
        it('should import AccommodationListLayout partial', () => {
            expect(typeIndexContent).toContain('_AccommodationListLayout.astro');
        });

        it('should import AccommodationFilters types', () => {
            expect(typeIndexContent).toContain('AccommodationFilters');
        });

        it('should import accommodationsApi', () => {
            expect(typeIndexContent).toContain('accommodationsApi');
        });

        it('should import toAccommodationCardProps transform', () => {
            expect(typeIndexContent).toContain('toAccommodationCardProps');
        });

        it('should import createT from i18n', () => {
            expect(typeIndexContent).toContain('createT');
        });
    });

    describe('Type validation', () => {
        it('should define ALLOWED_TYPES as const array', () => {
            expect(typeIndexContent).toContain('ALLOWED_TYPES');
            expect(typeIndexContent).toContain('as const');
        });

        it('should redirect on invalid type', () => {
            expect(typeIndexContent).toContain('alojamientos/');
            expect(typeIndexContent).toContain('Astro.redirect');
        });

        it('should redirect on invalid locale', () => {
            expect(typeIndexContent).toContain("Astro.redirect('/es/')");
        });
    });

    describe('Query params', () => {
        it('should read sortBy param', () => {
            expect(typeIndexContent).toContain("sp.get('sortBy')");
        });

        it('should read page param', () => {
            expect(typeIndexContent).toContain("sp.get('page')");
        });

        it('should read price range params', () => {
            expect(typeIndexContent).toContain("sp.get('priceMin')");
            expect(typeIndexContent).toContain("sp.get('priceMax')");
        });

        it('should read boolean amenity params', () => {
            expect(typeIndexContent).toContain("sp.get('hasWifi')");
            expect(typeIndexContent).toContain("sp.get('allowsPets')");
        });
    });

    describe('API call', () => {
        it('should call accommodationsApi.list with type filter', () => {
            expect(typeIndexContent).toContain('accommodationsApi.list(');
            expect(typeIndexContent).toContain('type:      accommodationType');
        });

        it('should pass sort and pagination params', () => {
            expect(typeIndexContent).toContain('page,');
            expect(typeIndexContent).toContain('PAGE_SIZE');
        });

        it('should include amenities and features', () => {
            expect(typeIndexContent).toContain('includeAmenities: true');
            expect(typeIndexContent).toContain('includeFeatures:  true');
        });
    });

    describe('i18n', () => {
        it('should use type name from translations', () => {
            expect(typeIndexContent).toContain('typePage.typeDetails');
        });

        it('should use createT for translations', () => {
            expect(typeIndexContent).toContain('createT(locale');
        });
    });

    describe('AccommodationListLayout partial usage', () => {
        it('should render AccommodationListLayout with locale', () => {
            expect(typeIndexContent).toContain('<AccommodationListLayout');
            expect(typeIndexContent).toContain('locale={locale');
        });

        it('should pass breadcrumbItems with 3 levels', () => {
            expect(typeIndexContent).toContain('breadcrumbItems={breadcrumbItems}');
            expect(typeIndexContent).toContain('alojamientos/tipo');
        });

        it('should pass cards, pagination and apiError to the partial', () => {
            expect(typeIndexContent).toContain('cards={cards}');
            expect(typeIndexContent).toContain('pagination={pagination}');
            expect(typeIndexContent).toContain('apiError={apiError}');
        });

        it('should pass filter-related props to the partial', () => {
            expect(typeIndexContent).toContain('hasActiveFilters={hasActiveFilters}');
            expect(typeIndexContent).toContain('initialFilters={initialFilters}');
            expect(typeIndexContent).toContain('paginationParams={paginationParams}');
        });
    });
});

describe('[lang]/alojamientos/tipo/[type]/page/[page].astro', () => {
    describe('Rendering mode', () => {
        it('should export prerender = false for SSR', () => {
            expect(typePaginationContent).toContain('export const prerender = false');
        });
    });

    describe('Locale handling', () => {
        it('should import getLocaleFromParams', () => {
            expect(typePaginationContent).toContain('getLocaleFromParams');
        });

        it('should redirect on invalid locale', () => {
            expect(typePaginationContent).toContain("Astro.redirect('/es/')");
        });
    });

    describe('Type validation', () => {
        it('should define ALLOWED_TYPES', () => {
            expect(typePaginationContent).toContain('ALLOWED_TYPES');
        });

        it('should redirect to accommodations list on invalid type', () => {
            expect(typePaginationContent).toContain('alojamientos/');
        });

        it('should redirect to type base URL on valid type but bad page', () => {
            expect(typePaginationContent).toContain('tipo/${type}/');
        });
    });

    describe('Page param validation', () => {
        it('should parse page param as integer', () => {
            expect(typePaginationContent).toContain('Number.parseInt');
        });

        it('should redirect on NaN or negative page value', () => {
            expect(typePaginationContent).toContain('Number.isNaN');
        });

        it('should redirect page 1 to canonical type base URL', () => {
            expect(typePaginationContent).toContain('pageNum === 1');
            expect(typePaginationContent).toContain('tipo/${type}/');
        });
    });

    describe('Rewrite behavior', () => {
        it('should rewrite pages >1 to type index with query param', () => {
            expect(typePaginationContent).toContain('Astro.rewrite');
            expect(typePaginationContent).toContain('?page=${pageNum}');
            expect(typePaginationContent).toContain('tipo/${type}/');
        });
    });
});

describe('_AccommodationListLayout.astro (shared partial for type pages)', () => {
    describe('Template structure shared across listing variants', () => {
        it('should render FilterSidebar with client:visible', () => {
            expect(partialContent).toContain('client:visible');
        });

        it('should render AccommodationCard in grid', () => {
            expect(partialContent).toContain('<AccommodationCard');
            expect(partialContent).toContain('card={card}');
        });

        it('should render EmptyState on error and on no results', () => {
            expect(partialContent).toContain('<EmptyState');
        });

        it('should render Pagination conditionally', () => {
            expect(partialContent).toContain('<Pagination');
            expect(partialContent).toContain('totalPages > 1');
        });

        it('should render Pagination with searchParams to preserve filters', () => {
            expect(partialContent).toContain('searchParams={paginationParams}');
        });

        it('should use responsive grid for cards', () => {
            expect(partialContent).toContain('xl:grid-cols-3');
        });
    });
});
