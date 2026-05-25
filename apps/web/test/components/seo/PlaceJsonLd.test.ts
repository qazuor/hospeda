/**
 * @file PlaceJsonLd.test.ts
 * @description Source-based unit tests for PlaceJsonLd.astro.
 * Follows the Astro testing pattern: read the source file and assert on content.
 *
 * Covers the entity-disambiguation `sameAs` enhancement: when `sameAs` is passed
 * (e.g. a curated Wikipedia URL for the destination), it is emitted on the
 * TouristDestination structured data; otherwise it is omitted.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/seo/PlaceJsonLd.astro'),
    'utf8'
);

describe('PlaceJsonLd.astro', () => {
    describe('imports', () => {
        it('delegates rendering to JsonLd wrapper', () => {
            expect(src).toContain("import JsonLd from './JsonLd.astro'");
        });
    });

    describe('Props', () => {
        it('declares name prop', () => {
            expect(src).toContain('readonly name: string');
        });

        it('declares the optional sameAs prop as ReadonlyArray', () => {
            expect(src).toContain('readonly sameAs?: ReadonlyArray<string>');
        });
    });

    describe('schema.org shape', () => {
        it('uses schema.org context', () => {
            expect(src).toContain("'@context': 'https://schema.org'");
        });

        it('uses TouristDestination @type', () => {
            expect(src).toContain("'@type': 'TouristDestination'");
        });
    });

    describe('sameAs (entity disambiguation)', () => {
        it('only emits sameAs when present and non-empty', () => {
            expect(src).toMatch(/sameAs\b[^\n]*length/);
        });

        it('attaches sameAs to the structured data object', () => {
            expect(src).toMatch(/structuredData\.sameAs\s*=/);
        });
    });

    describe('rendering', () => {
        it('renders the JsonLd wrapper with the structured data', () => {
            expect(src).toContain('<JsonLd data={structuredData} />');
        });
    });
});
