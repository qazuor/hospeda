/**
 * @file comer-y-salir-rubro.test.ts
 * @description Source-read tests for the venue business-line collection pages
 * (HOS-1787 leaf 6.8). Astro pages cannot be rendered in Vitest, so this asserts
 * on the source structure, like `comer-y-salir-index.test.ts`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BUSINESS_LINES } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

const PAGE_PATH = resolve(
    __dirname,
    '../../src/pages/[lang]/comer-y-salir/rubro/[rubro]/index.astro'
);
const SHIM_PATH = resolve(
    __dirname,
    '../../src/pages/[lang]/comer-y-salir/rubro/[rubro]/page/[page].astro'
);

const src = readFileSync(PAGE_PATH, 'utf8');
const shim = readFileSync(SHIM_PATH, 'utf8');

/** The `applyCacheHeaders({ … })` argument text. */
function cacheArgs(): string {
    const start = src.indexOf('applyCacheHeaders({');
    expect(start, 'applyCacheHeaders({ not found').toBeGreaterThan(-1);
    return src.slice(start, src.indexOf('});', start));
}

describe('comer-y-salir/rubro/[rubro]/index.astro', () => {
    describe('collection copy', () => {
        it('resolves localized collection metadata after destinations load', () => {
            expect(src).toContain('resolveVenueCollectionCopy({');
            expect(src.indexOf('const destinations =')).toBeLessThan(
                src.indexOf('resolveVenueCollectionCopy({')
            );
            expect(src).toContain('ORGANIZATION_INFO.areaServed.name');
            expect(src).toContain('title={heading}');
            expect(src).toContain('subtitle={intro}');
            expect(src).toContain('ogTagline={ogTagline}');
            expect(src).not.toContain("t('venue.listing.subtitle')");
        });
    });

    describe('segment resolution', () => {
        it('resolves the segment through the catalog helper, not a literal', () => {
            expect(src).toContain('resolveVenueBusinessLineCollection({');
            expect(src).toContain('urlSlug: Astro.params.rubro');
        });

        it('answers 404 for an unknown segment BEFORE caching and fetching', () => {
            const resolveAt = src.indexOf('resolveVenueBusinessLineCollection({');
            expect(resolveAt).toBeGreaterThan(-1);

            const segment404At = src.indexOf(
                'return new Response(null, { status: 404 });',
                resolveAt
            );
            const cacheAt = src.indexOf('applyCacheHeaders({');
            const listAt = src.indexOf('venueApi.list({');

            expect(segment404At, 'segment 404 not found').toBeGreaterThan(resolveAt);
            expect(cacheAt, 'applyCacheHeaders not found').toBeGreaterThan(-1);
            expect(listAt, 'venueApi.list not found').toBeGreaterThan(-1);
            expect(segment404At).toBeLessThan(cacheAt);
            expect(segment404At).toBeLessThan(listAt);
        });

        it('builds the base path from the resolved catalog value', () => {
            expect(src).toContain('buildVenueBusinessLineCollectionPath({');
            expect(src).toContain('businessLine: collection.businessLine');
        });
    });

    describe('data', () => {
        it('passes the resolved business line to venueApi.list', () => {
            const start = src.indexOf('venueApi.list({');
            expect(start).toBeGreaterThan(-1);
            const call = src.slice(start, src.indexOf(']);', start));
            expect(call).toContain('businessLine: collection.businessLine');
        });

        it('404s a page beyond the last page through the shared predicate', () => {
            expect(src).toMatch(/isPageOutOfRange\([\s\S]{0,300}?status: 404/);
        });
    });

    describe('cache', () => {
        it('opts into the catalog cache class with the venue collection tag', () => {
            const args = cacheArgs();
            expect(args).toContain("cacheClass: 'catalog'");
            expect(args).toContain('CACHE_TAG_COLLECTIONS.venue');
        });

        it('gates cacheability on pagination params only', () => {
            expect(cacheArgs()).toContain('hasOnlyPaginationParams');
        });
    });

    describe('published-listing filters (HOS-1787 leaf 6.10, AC:6:11)', () => {
        it('fetches the filter options for the resolved collection', () => {
            const start = src.indexOf('venueApi.getFilterOptions(');
            expect(start, 'venueApi.getFilterOptions( not found').toBeGreaterThan(-1);
            const call = src.slice(start, src.indexOf(')', start) + 1);
            expect(call).toContain('businessLine: collection.businessLine');
        });

        it('narrows the sidebar and type chips to published values', () => {
            expect(src).toContain('narrowVenueFilterCatalog(');
            expect(src).toContain('buildVenueFilterGroups(');
            expect(src).toContain('buildVenueTypeChips(');
            // The chips may never fall back to the full enum: that would offer
            // types the collection's published listings do not carry.
            expect(src).not.toContain('VENUE_TYPE_OPTIONS');
        });

        it('renders VenueFilterOptionsDegradation instead of calling the marker', () => {
            expect(src).toContain(
                "import VenueFilterOptionsDegradation from '@/components/venue/VenueFilterOptionsDegradation.astro';"
            );
            expect(src).toMatch(/<VenueFilterOptionsDegradation\s+failed=\{/);
            expect(src).not.toContain('markResponseDegraded');
            const helperImport = src.match(
                /import\s*\{([\s\S]*?)\}\s*from\s*'@\/lib\/venue\/venue-listing-filters'/
            );
            expect(helperImport, 'venue-listing-filters import not found').not.toBeNull();
            expect((helperImport?.[1] ?? '').includes('Degraded')).toBe(false);
        });

        it('passes the options, amenities and features failures to the component', () => {
            const start = src.indexOf('<VenueFilterOptionsDegradation');
            expect(start, '<VenueFilterOptionsDegradation not found').toBeGreaterThan(-1);
            const tag = src.slice(start, src.indexOf('/>', start) + 2);

            expect(tag).toContain('!filterOptionsResult.ok');
            expect(tag).toContain('!amenitiesResult.ok');
            expect(tag).toContain('!featuresResult.ok');
        });

        it('reads and forwards the amenities filter', () => {
            expect(src).toContain("url.searchParams.get('amenities')");
            expect(src).toContain('amenities: amenitiesParam');
            expect(src).toContain('if (amenitiesParam) initialParams.amenities = amenitiesParam;');
        });
    });

    describe('empty collection indexability (HOS-1869, AC:6:2)', () => {
        it('imports the shared emptiness predicate and marks the layout noindex', () => {
            expect(src).toContain('isVenueCollectionEmpty');
            expect(src).toContain('isVenueCollectionEmpty({ fetchOk: result.ok, total })');
            expect(src).toMatch(/noindex=\{isEmptyCollection\}/);
        });

        it('uses the collection empty state with its CTA and publish suggestion', () => {
            expect(src).toContain('venue.listing.collectionEmpty.message');
            expect(src).toContain('venue.listing.collectionEmpty.viewAll');
            expect(src).toContain('venue.listing.collectionEmpty.publish');
            expect(src).toContain('actionUrl={listBaseUrl}');
            expect(src).toContain("path: 'publicar/comer-y-salir'");
        });
    });

    describe('pagination', () => {
        it('builds canonical and neighbour links from the collection path', () => {
            expect(src).toContain('buildPaginationLinks({');
            expect(src).toContain('basePath: baseUrl');
            expect(src).not.toMatch(/page\/\$\{/);
        });

        it('renders Pagination from the collection path without the trailing slash', () => {
            expect(src).toContain('baseUrl={baseUrl.slice(0, -1)}');
        });
    });

    describe('structured data', () => {
        it('mounts CollectionPage, ItemList and Breadcrumb JSON-LD', () => {
            for (const component of [
                'CollectionPageJsonLd',
                'ItemListJsonLd',
                'BreadcrumbJsonLd'
            ]) {
                expect(src).toContain(`import ${component}`);
                expect(src).toContain(`<${component}`);
            }
            expect(src).toContain('slot="head-extra"');
        });
    });

    describe('catalog hygiene', () => {
        it('writes no business-line value or URL slug of its own', () => {
            for (const line of BUSINESS_LINES.venue) {
                expect(src).not.toContain(line.value);
                expect(src).not.toContain(line.urlSlug);
            }
        });

        it('is session-blind', () => {
            expect(src).not.toContain('Astro.locals.user');
        });
    });
});

describe('comer-y-salir/rubro/[rubro]/page/[page].astro', () => {
    it('delegates to the shared pagination handler', () => {
        expect(shim).toContain('handlePaginationRoute');
        expect(shim).not.toMatch(/Astro\.(rewrite|redirect)\(/);
        expect(shim).not.toMatch(/Number\(/);
    });

    it('uses the collection path as its base', () => {
        // biome-ignore lint/suspicious/noTemplateCurlyInString: asserting the shim's literal base path
        expect(shim).toContain(
            'basePath: `/${Astro.params.lang}/comer-y-salir/rubro/${Astro.params.rubro}/`'
        );
    });
});
