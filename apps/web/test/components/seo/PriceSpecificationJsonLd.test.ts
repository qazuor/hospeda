/**
 * @file PriceSpecificationJsonLd.test.ts
 * @description Source-based unit tests for PriceSpecificationJsonLd.astro.
 *
 * SPEC-096 / REQ-096-41 (T-052).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/seo/PriceSpecificationJsonLd.astro'),
    'utf8'
);

describe('PriceSpecificationJsonLd.astro', () => {
    describe('imports', () => {
        it('delegates to JsonLd wrapper', () => {
            expect(src).toContain("import JsonLd from './JsonLd.astro'");
        });
    });

    describe('Props', () => {
        it('exports a PriceSpecificationPlan interface', () => {
            expect(src).toContain('export interface PriceSpecificationPlan');
        });

        it('declares plans array prop', () => {
            expect(src).toContain('readonly plans: ReadonlyArray<PriceSpecificationPlan>');
        });

        it('declares all required plan fields', () => {
            expect(src).toContain('readonly name: string');
            expect(src).toContain('readonly description: string');
            expect(src).toContain('readonly priceCurrency: string');
            expect(src).toContain('readonly price: number');
            expect(src).toContain('readonly url: string');
        });
    });

    describe('schema.org shape', () => {
        it('uses schema.org context', () => {
            expect(src).toContain("'@context': 'https://schema.org'");
        });

        it('uses Offer type', () => {
            expect(src).toContain("'@type': 'Offer'");
        });

        it('nests a UnitPriceSpecification', () => {
            expect(src).toContain("'@type': 'UnitPriceSpecification'");
            expect(src).toContain('priceSpecification:');
        });

        it('uses MON unitCode for monthly billing', () => {
            expect(src).toMatch(/unitCode:\s*'MON'/);
        });

        it('includes a referenceQuantity', () => {
            expect(src).toContain('referenceQuantity:');
            expect(src).toContain("'@type': 'QuantitativeValue'");
        });
    });

    describe('rendering', () => {
        it('emits one JsonLd block per plan', () => {
            expect(src).toContain('offers.map((offer) => <JsonLd data={offer} />)');
        });
    });
});
