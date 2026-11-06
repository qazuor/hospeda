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
