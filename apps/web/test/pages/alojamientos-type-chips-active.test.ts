/**
 * @file alojamientos-type-chips-active.test.ts
 * @description Source-based assertions that the accommodations listing's
 * quick-filter type chips compute `active`/`ariaPressed` from the `types`
 * array query param (HOS-96 T-009). Astro components cannot be rendered in
 * Vitest, so we assert against the source text — following this repo's
 * established `.astro` testing convention.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readFacetActiveValues } from '../../src/lib/filters/read-facet-active-values';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/alojamientos/index.astro'),
    'utf8'
);

describe('alojamientos/index.astro — type chip active/aria-pressed state (HOS-96 T-009)', () => {
    it('imports readFacetActiveValues and FACET_CONFIG_BY_ID', () => {
        expect(src).toContain('readFacetActiveValues');
        expect(src).toContain('FACET_CONFIG_BY_ID');
    });

    it('computes active values from the accommodationType facet paramKey (types)', () => {
        expect(src).toContain('FACET_CONFIG_BY_ID.accommodationType.paramKey');
        expect(src).toMatch(/readFacetActiveValues\(\{[^}]*searchParams:\s*url\.searchParams/);
    });

    it('passes both active and ariaPressed on each type chip', () => {
        expect(src).toMatch(/typeChips\s*=[\s\S]*?\bactive[\s\S]*?ariaPressed/);
    });
});

describe('readFacetActiveValues — accommodation types.includes() logic used by the page (HOS-96 T-009)', () => {
    it('given ?types=HOTEL,CABIN, Hotel and Cabaña resolve active/aria-pressed true, others false', () => {
        const activeValues = readFacetActiveValues({
            searchParams: new URLSearchParams('types=HOTEL,CABIN'),
            paramKey: 'types'
        });

        expect(activeValues.includes('HOTEL')).toBe(true);
        expect(activeValues.includes('CABIN')).toBe(true);
        expect(activeValues.includes('APARTMENT')).toBe(false);
        expect(activeValues.includes('COUNTRY_HOUSE')).toBe(false);
    });

    it('given zero active values, every chip resolves false', () => {
        const activeValues = readFacetActiveValues({
            searchParams: new URLSearchParams(''),
            paramKey: 'types'
        });

        expect(activeValues.includes('HOTEL')).toBe(false);
        expect(activeValues.includes('CABIN')).toBe(false);
    });

    it('supports multiple simultaneously active values (not mutually exclusive)', () => {
        const activeValues = readFacetActiveValues({
            searchParams: new URLSearchParams('types=HOTEL,CABIN,APARTMENT'),
            paramKey: 'types'
        });

        const activeCount = ['HOTEL', 'CABIN', 'APARTMENT'].filter((v) =>
            activeValues.includes(v)
        ).length;
        expect(activeCount).toBe(3);
    });
});
