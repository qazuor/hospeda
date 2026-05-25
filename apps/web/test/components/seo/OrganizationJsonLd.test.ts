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
import { ORGANIZATION_INFO } from '../../../src/lib/constants';

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

    // -----------------------------------------------------------------------
    // AEO enrichment: optional contact / address / area / description props
    // -----------------------------------------------------------------------

    describe('enriched optional props', () => {
        it('declares description / telephone / email / address / areaServed / foundingDate props', () => {
            expect(src).toContain('description?:');
            expect(src).toContain('telephone?:');
            expect(src).toContain('email?:');
            expect(src).toContain('address?:');
            expect(src).toContain('areaServed?:');
            expect(src).toContain('foundingDate?:');
        });

        it('emits an @id of `${url}#organization` for entity linking', () => {
            expect(src).toMatch(/['"]@id['"]\s*:\s*`\$\{url\}#organization`/);
        });

        it('emits a PostalAddress shape from address fields', () => {
            expect(src).toContain("'@type': 'PostalAddress'");
            expect(src).toContain('streetAddress');
            expect(src).toContain('addressLocality');
            expect(src).toContain('addressRegion');
            expect(src).toContain('postalCode');
            expect(src).toContain('addressCountry');
        });

        it('emits a ContactPoint shape with customer service type', () => {
            expect(src).toContain("'@type': 'ContactPoint'");
            expect(src).toContain("contactType: 'customer service'");
        });

        it('emits an areaServed State contained in a Country', () => {
            expect(src).toContain("'@type': 'State'");
            expect(src).toContain("'@type': 'Country'");
            expect(src).toContain('containedInPlace');
        });

        it('conditionally spreads optional fields so undefined never leaks', () => {
            expect(src).toMatch(/\.\.\.\(/);
        });
    });
});

describe('ORGANIZATION_INFO constant', () => {
    it('has the expected description', () => {
        expect(ORGANIZATION_INFO.description).toContain(
            'plataforma para descubrir y reservar alojamientos'
        );
    });

    it('has the confirmed telephone (no stray 9)', () => {
        expect(ORGANIZATION_INFO.telephone).toBe('+543442453797');
    });

    it('has the public contact email', () => {
        expect(ORGANIZATION_INFO.email).toBe('info@hospeda.com.ar');
    });

    it('has the full postal address', () => {
        expect(ORGANIZATION_INFO.address).toEqual({
            streetAddress: 'Ruta Provincial 39, km 142, lote 19',
            addressLocality: 'Concepción del Uruguay',
            addressRegion: 'Entre Ríos',
            postalCode: '3260',
            addressCountry: 'AR'
        });
    });

    it('models areaServed as Entre Ríos within Argentina', () => {
        expect(ORGANIZATION_INFO.areaServed.name).toBe('Entre Ríos');
        expect(ORGANIZATION_INFO.areaServed.containedInPlace.name).toBe('Argentina');
    });

    it('has the founding date', () => {
        expect(ORGANIZATION_INFO.foundingDate).toBe('2026');
    });
});
