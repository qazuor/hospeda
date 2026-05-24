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

        it('declares locale prop', () => {
            expect(src).toContain('readonly locale: string');
        });
    });

    describe('schema.org shape', () => {
        it('uses schema.org context', () => {
            expect(src).toContain("'@context': 'https://schema.org'");
        });

        it('uses WebSite @type', () => {
            expect(src).toContain("'@type': 'WebSite'");
        });

        it('includes a potentialAction of type SearchAction', () => {
            expect(src).toContain("'@type': 'SearchAction'");
        });

        it('SearchAction target contains the literal {search_term_string} placeholder', () => {
            expect(src).toContain('{search_term_string}');
        });

        it('SearchAction includes query-input required name=search_term_string', () => {
            expect(src).toContain('required name=search_term_string');
        });

        it('SearchAction target points to /busqueda/ search path', () => {
            expect(src).toContain('busqueda');
        });
    });

    describe('rendering', () => {
        it('renders the JsonLd wrapper with the structured data', () => {
            expect(src).toContain('<JsonLd data={structuredData} />');
        });
    });
});
