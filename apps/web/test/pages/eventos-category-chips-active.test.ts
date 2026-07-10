/**
 * @file eventos-category-chips-active.test.ts
 * @description Source-based assertions that the events listing's category
 * quick-filter chips compute `active` from the `categories` array query
 * param (the eventCategory facet's `paramKey`), which drives `aria-current`
 * on the chip anchor (NOT `aria-pressed` — removed post-T-009 after the CI
 * a11y sweep flagged it as an `aria-allowed-attr` violation; `aria-pressed`
 * is only valid on `role="button"`, not an `<a href>`). HOS-96 T-013 switched
 * the chip href itself to the real multi-select toggle on `categories` too
 * (superseding the original T-009 "href stays single-select for now" interim
 * state) — see `eventos-multiselect-wiring.test.ts` for the full T-013
 * coverage (accumulate/remove/Clear(N)/API-forwarding).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readFacetActiveValues } from '../../src/lib/filters/read-facet-active-values';

const src = readFileSync(resolve(__dirname, '../../src/pages/[lang]/eventos/index.astro'), 'utf8');

describe('eventos/index.astro — category chip active/aria-current state (HOS-96 T-009)', () => {
    it('imports readFacetActiveValues and FACET_CONFIG_BY_ID', () => {
        expect(src).toContain('readFacetActiveValues');
        expect(src).toContain('FACET_CONFIG_BY_ID');
    });

    it('computes active values from the eventCategory facet paramKey (categories)', () => {
        expect(src).toContain('FACET_CONFIG_BY_ID.eventCategory.paramKey');
        expect(src).toMatch(/readFacetActiveValues\(\{[^}]*searchParams:\s*url\.searchParams/);
    });

    it('builds each chip href via buildMultiToggleParamHref keyed on the categories array param (HOS-96 T-013)', () => {
        expect(src).toContain('FACET_CONFIG_BY_ID.eventCategory.paramKey');
        expect(src).toContain('buildMultiToggleParamHref({');
        expect(src).not.toContain("key: 'category',");
    });

    it('passes active on each category chip (drives aria-current + the active class in FilterChips.astro; NOT ariaPressed, removed post-a11y-sweep)', () => {
        expect(src).toMatch(/categoryChips\s*=[\s\S]*?\bactive\b/);
        expect(src).not.toContain('ariaPressed');
    });
});

describe('readFacetActiveValues — event categories.includes() logic used by the page (HOS-96 T-009)', () => {
    it('given ?categories=MUSIC,CULTURE, Música and Cultura resolve active/aria-current true, others false', () => {
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
