/**
 * @file publicaciones-category-chips-active.test.ts
 * @description Source-based assertions that the blog listing's category
 * quick-filter chips compute `active`/`ariaPressed` from the `categories`
 * array query param (the postCategory facet's `paramKey`), while the chip
 * href stays on the existing dedicated-route landing for now — the href
 * migration is a later HOS-96 task (T-011/12/13), not this one.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readFacetActiveValues } from '../../src/lib/filters/read-facet-active-values';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/publicaciones/index.astro'),
    'utf8'
);

describe('publicaciones/index.astro — category chip active/aria-pressed state (HOS-96 T-009)', () => {
    it('imports readFacetActiveValues and FACET_CONFIG_BY_ID', () => {
        expect(src).toContain('readFacetActiveValues');
        expect(src).toContain('FACET_CONFIG_BY_ID');
    });

    it('computes active values from the postCategory facet paramKey (categories)', () => {
        expect(src).toContain('FACET_CONFIG_BY_ID.postCategory.paramKey');
        expect(src).toMatch(/readFacetActiveValues\(\{[^}]*searchParams:\s*url\.searchParams/);
    });

    it('still builds each chip href from the dedicated /publicaciones/categoria/{slug}/ landing (unchanged href)', () => {
        expect(src).toContain('/publicaciones/categoria/');
    });

    it('passes both active and ariaPressed on each post category chip', () => {
        expect(src).toMatch(/postCategoryChips\s*=[\s\S]*?\bactive[\s\S]*?ariaPressed/);
    });
});

describe('readFacetActiveValues — post categories.includes() logic used by the page (HOS-96 T-009)', () => {
    it('given ?categories=CULTURE,GASTRONOMY, Cultura and Gastronomía resolve active/aria-pressed true, others false', () => {
        const activeValues = readFacetActiveValues({
            searchParams: new URLSearchParams('categories=CULTURE,GASTRONOMY'),
            paramKey: 'categories'
        });

        expect(activeValues.includes('CULTURE')).toBe(true);
        expect(activeValues.includes('GASTRONOMY')).toBe(true);
        expect(activeValues.includes('TOURISM')).toBe(false);
    });

    it('given zero active values, every chip resolves false', () => {
        const activeValues = readFacetActiveValues({
            searchParams: new URLSearchParams(''),
            paramKey: 'categories'
        });

        expect(activeValues.includes('CULTURE')).toBe(false);
    });

    it('supports multiple simultaneously active values (not mutually exclusive)', () => {
        const activeValues = readFacetActiveValues({
            searchParams: new URLSearchParams('categories=CULTURE,GASTRONOMY,TOURISM'),
            paramKey: 'categories'
        });

        const activeCount = ['CULTURE', 'GASTRONOMY', 'TOURISM'].filter((v) =>
            activeValues.includes(v)
        ).length;
        expect(activeCount).toBe(3);
    });
});
