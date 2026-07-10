/**
 * @file publicaciones-multiselect-wiring.test.ts
 * @description HOS-96 T-012 — the blog base listing's category chips switch
 * from dedicated-route navigation (`/publicaciones/categoria/{slug}/`) to a
 * real in-place multi-select toggle on `categories`, the data-fetch is wired
 * to forward the accumulated `categories` CSV string to `postsApi.list`
 * (fixing the "URL changes but the grid doesn't filter" bug), and the
 * "Clear (N)" bulk-reset chip is appended. The dedicated
 * `/publicaciones/categoria/{slug}/` landing page itself is NOT modified —
 * verified it has no chip row of its own, so there is no landing-escape
 * concern to resolve there.
 *
 * `.astro` frontmatter cannot render in Vitest — assertions are source-based,
 * paired with logic tests that exercise the real helpers with the exact
 * param shapes the page constructs.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildClearFacetChip } from '../../src/lib/filters/build-clear-facet-chip';
import { readFacetActiveValues } from '../../src/lib/filters/read-facet-active-values';
import { buildMultiToggleParamHref } from '../../src/lib/filters/toggle-multi-query-param';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/publicaciones/index.astro'),
    'utf8'
);

/** Scope assertions to the postCategoryChips-building block only. */
const chipsBlock = src.slice(
    src.indexOf('const POST_CATEGORY_CHIP_DEFS'),
    src.indexOf('---', src.indexOf('const POST_CATEGORY_CHIP_DEFS'))
);

function query(href: string): URLSearchParams {
    return new URLSearchParams(href.split('?')[1] ?? '');
}

describe('publicaciones/index.astro — category chips wired to real multi-select (HOS-96 T-012)', () => {
    describe('source wiring', () => {
        it('imports buildMultiToggleParamHref and buildClearFacetChip', () => {
            expect(src).toContain(
                "import { buildMultiToggleParamHref } from '@/lib/filters/toggle-multi-query-param'"
            );
            expect(src).toContain(
                "import { buildClearFacetChip } from '@/lib/filters/build-clear-facet-chip'"
            );
        });

        it('imports XCircleIcon for the Clear(N) chip', () => {
            expect(src).toContain('XCircleIcon');
        });

        it('builds each category chip href via buildMultiToggleParamHref keyed on the postCategory paramKey (categories)', () => {
            expect(chipsBlock).toContain('buildMultiToggleParamHref({');
            expect(chipsBlock).toContain('FACET_CONFIG_BY_ID.postCategory.paramKey');
        });

        it('no longer navigates to the dedicated /publicaciones/categoria/{slug}/ route from the chip href', () => {
            expect(chipsBlock).not.toContain('path: `/publicaciones/categoria/');
        });

        it('reads the active categories once (top-level) and reuses it for both the API call and the chip active/href state', () => {
            const occurrences = src.match(/readFacetActiveValues\(\{/g) ?? [];
            expect(occurrences.length).toBe(1);
        });

        it('builds a Clear(N) chip for the postCategory facet and conditionally appends it to the chips array', () => {
            expect(src).toContain('buildClearFacetChip({');
            expect(src).toContain('paramKey: FACET_CONFIG_BY_ID.postCategory.paramKey');
            expect(src).toMatch(
                /chips=\{postCategoryClearChip\s*\?\s*\[\s*\.\.\.postCategoryChips,\s*postCategoryClearChip\s*\]\s*:\s*postCategoryChips\}/
            );
        });

        it('resolves the Clear(N) label/ariaLabel via the shared common.filterChips i18n keys', () => {
            expect(src).toContain("t('common.filterChips.clearLabel')");
            expect(src).toContain("t('common.filterChips.clearAriaLabel')");
        });
    });

    describe('data-fetch forwarding (regression guard: URL changes but grid did not filter)', () => {
        it('forwards categories as a CSV string (not a JS array) to postsApi.list, alongside the singular category', () => {
            const fetchBlock = src.slice(
                src.indexOf('const result = await postsApi.list({'),
                src.indexOf('const result = await postsApi.list({') + 800
            );
            expect(fetchBlock).toContain('category,');
            expect(fetchBlock).toContain('categories:');
            expect(fetchBlock).toMatch(
                /categories:\s*postCategoryActiveValues\.length\s*>\s*0\s*\?\s*postCategoryActiveValues\.join\(','\)\s*:\s*undefined/
            );
        });
    });

    describe('dedicated landing page (verified out of scope — no chip row to migrate)', () => {
        it('the dedicated /categoria/[category]/ landing does not import FilterChips (nothing to touch there)', () => {
            const landingSrc = readFileSync(
                resolve(
                    __dirname,
                    '../../src/pages/[lang]/publicaciones/categoria/[category]/index.astro'
                ),
                'utf8'
            );
            expect(landingSrc).not.toContain('FilterChips');
        });
    });
});

describe('blog category multi-select — composed helper behavior (HOS-96 T-012)', () => {
    const baseUrl = '/es/publicaciones/';

    it('accumulate: from unfiltered, clicking Cultura produces ?categories=CULTURE', () => {
        const href = buildMultiToggleParamHref({
            baseUrl,
            searchParams: new URLSearchParams(''),
            key: 'categories',
            value: 'CULTURE'
        });
        expect(query(href).get('categories')).toBe('CULTURE');
    });

    it('accumulate: with Cultura active, clicking Gastronomía ADDS it (does not replace)', () => {
        const href = buildMultiToggleParamHref({
            baseUrl,
            searchParams: new URLSearchParams('categories=CULTURE'),
            key: 'categories',
            value: 'GASTRONOMY'
        });
        expect(query(href).get('categories')).toBe('CULTURE,GASTRONOMY');
    });

    it('deselect: clicking the active Cultura chip while Cultura+Gastronomía are active removes only Cultura', () => {
        const href = buildMultiToggleParamHref({
            baseUrl,
            searchParams: new URLSearchParams('categories=CULTURE,GASTRONOMY'),
            key: 'categories',
            value: 'CULTURE'
        });
        expect(query(href).get('categories')).toBe('GASTRONOMY');
    });

    it('Clear(N) chip appears at 2+ active values and its href removes the whole categories param', () => {
        const searchParams = new URLSearchParams('q=carnaval&categories=CULTURE,GASTRONOMY');
        const activeValues = readFacetActiveValues({ searchParams, paramKey: 'categories' });
        const chip = buildClearFacetChip({
            baseUrl,
            searchParams,
            paramKey: 'categories',
            count: activeValues.length,
            labelTemplate: 'Limpiar ({{count}})',
            ariaLabelTemplate: 'Limpiar {{count}} filtros',
            icon: (() => null) as never
        });
        expect(chip).toBeDefined();
        expect(chip?.label).toBe('Limpiar (2)');
        const params = new URLSearchParams(chip?.href.split('?')[1] ?? '');
        expect(params.has('categories')).toBe(false);
        expect(params.get('q')).toBe('carnaval');
    });

    it('the CSV string handed to the API matches exactly what the accumulate helper produces (end-to-end shape proof)', () => {
        const searchParams = new URLSearchParams('categories=CULTURE,GASTRONOMY');
        const activeValues = readFacetActiveValues({ searchParams, paramKey: 'categories' });
        const categoriesParam = activeValues.length > 0 ? activeValues.join(',') : undefined;
        expect(categoriesParam).toBe('CULTURE,GASTRONOMY');
        expect(typeof categoriesParam).toBe('string');
    });
});
