/**
 * @file WebSiteJsonLd.test.ts
 * @description Source-based unit tests for WebSiteJsonLd.astro.
 * Follows the Astro testing pattern: read the source file and assert on content.
 *
 * SPEC-157 / REQ-5.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/seo/WebSiteJsonLd.astro'),
    'utf8'
);

describe('WebSiteJsonLd.astro (SPEC-157 REQ-5)', () => {
    describe('imports', () => {
        it('delegates rendering to JsonLd wrapper', () => {
            expect(src).toContain("import JsonLd from './JsonLd.astro'");
        });
    });

    describe('Props', () => {
        it('declares name prop', () => {
            expect(src).toContain('readonly name: string');
        });

        it('declares url prop', () => {
            expect(src).toContain('readonly url: string');
        });

        // The `locale` prop existed only to build the SearchAction target URL.
        it('no longer declares a locale prop (SearchAction removed)', () => {
            expect(src).not.toContain('readonly locale: string');
        });
    });

    describe('schema.org shape', () => {
        it('uses schema.org context', () => {
            expect(src).toContain("'@context': 'https://schema.org'");
        });

        it('uses WebSite @type', () => {
            expect(src).toContain("'@type': 'WebSite'");
        });
    });

    // The global site-search feature was cut from the product: the `/busqueda/`
    // page and the `GET /api/v1/public/search` endpoint behind it were deleted.
    // The `WebSite` structured data (name + url) is still valid and stays; the
    // sitelinks-searchbox `SearchAction` is gone, because advertising a search
    // target that 404s is worse than advertising none.
    describe('SearchAction removed (global search cut)', () => {
        it('does not emit a potentialAction', () => {
            expect(src).not.toContain('potentialAction');
        });

        it('does not emit a SearchAction @type', () => {
            expect(src).not.toContain("'@type': 'SearchAction'");
        });

        it('does not emit the {search_term_string} placeholder', () => {
            expect(src).not.toContain('{search_term_string}');
        });

        it('does not reference the removed /busqueda/ path', () => {
            expect(src).not.toContain('busqueda');
        });
    });

    describe('rendering', () => {
        it('renders the JsonLd wrapper with the structured data', () => {
            expect(src).toContain('<JsonLd data={structuredData} />');
        });
    });
});
