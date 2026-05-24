/**
 * @file OrganizationJsonLd.test.ts
 * @description Source-based unit tests for OrganizationJsonLd.astro.
 * Follows the Astro testing pattern: read the source file and assert on content.
 *
 * SPEC-157 / REQ-5.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/seo/OrganizationJsonLd.astro'),
    'utf8'
);

describe('OrganizationJsonLd.astro (SPEC-157 REQ-5)', () => {
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

        it('declares logo prop', () => {
            expect(src).toContain('readonly logo: string');
        });

        it('declares sameAs prop as ReadonlyArray', () => {
            expect(src).toContain('readonly sameAs: ReadonlyArray<string>');
        });
    });

    describe('schema.org shape', () => {
        it('uses schema.org context', () => {
            expect(src).toContain("'@context': 'https://schema.org'");
        });

        it('uses Organization @type', () => {
            expect(src).toContain("'@type': 'Organization'");
        });

        it('includes logo in structured data', () => {
            expect(src).toMatch(/logo/);
        });

        it('includes sameAs in structured data', () => {
            expect(src).toMatch(/sameAs/);
        });
    });

    describe('rendering', () => {
        it('renders the JsonLd wrapper with the structured data', () => {
            expect(src).toContain('<JsonLd data={structuredData} />');
        });
    });
});
