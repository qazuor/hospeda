/**
 * @file eventos-category-chips-active.test.ts
 * @description Source-based assertions that the events listing's category
 * quick-filter chips compute `active`/`ariaPressed` from the `categories`
 * array query param (the eventCategory facet's `paramKey`), while the chip
 * href stays on the existing single-select `?category=` toggle for now — the
 * href migration is a later HOS-96 task (T-011/12/13), not this one.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readFacetActiveValues } from '../../src/lib/filters/read-facet-active-values';

const src = readFileSync(resolve(__dirname, '../../src/pages/[lang]/eventos/index.astro'), 'utf8');

describe('eventos/index.astro — category chip active/aria-pressed state (HOS-96 T-009)', () => {
    it('imports readFacetActiveValues and FACET_CONFIG_BY_ID', () => {
        expect(src).toContain('readFacetActiveValues');
        expect(src).toContain('FACET_CONFIG_BY_ID');
    });

    it('computes active values from the eventCategory facet paramKey (categories)', () => {
        expect(src).toContain('FACET_CONFIG_BY_ID.eventCategory.paramKey');
        expect(src).toMatch(/readFacetActiveValues\(\{[^}]*searchParams:\s*url\.searchParams/);
    });

    it('still builds each chip href via buildToggleParamHref keyed on the singular category param (unchanged href)', () => {
        expect(src).toContain("key: 'category',");
        expect(src).toContain('buildToggleParamHref({');
    });

    it('passes both active and ariaPressed on each category chip', () => {
        expect(src).toMatch(/categoryChips\s*=[\s\S]*?\bactive[\s\S]*?ariaPressed/);
    });
});

describe('readFacetActiveValues — event categories.includes() logic used by the page (HOS-96 T-009)', () => {
    it('given ?categories=MUSIC,CULTURE, Música and Cultura resolve active/aria-pressed true, others false', () => {
        const activeValues = readFacetActiveValues({
            searchParams: new URLSearchParams('categories=MUSIC,CULTURE'),
            paramKey: 'categories'
        });

        expect(activeValues.includes('MUSIC')).toBe(true);
        expect(activeValues.includes('CULTURE')).toBe(true);
        expect(activeValues.includes('SPORTS')).toBe(false);
    });

    it('given zero active values, every chip resolves false', () => {
        const activeValues = readFacetActiveValues({
            searchParams: new URLSearchParams(''),
            paramKey: 'categories'
        });

        expect(activeValues.includes('MUSIC')).toBe(false);
    });

    it('supports multiple simultaneously active values (not mutually exclusive)', () => {
        const activeValues = readFacetActiveValues({
            searchParams: new URLSearchParams('categories=MUSIC,CULTURE,FESTIVAL'),
            paramKey: 'categories'
        });

        const activeCount = ['MUSIC', 'CULTURE', 'FESTIVAL'].filter((v) =>
            activeValues.includes(v)
        ).length;
        expect(activeCount).toBe(3);
    });
});
