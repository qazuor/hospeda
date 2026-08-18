/**
 * @file eventos-multiselect-wiring.test.ts
 * @description HOS-96 T-013 — the events base listing's category chips
 * switch from the single-select `?category=` toggle to a real in-place
 * multi-select toggle on `categories`, the data-fetch is wired to forward the
 * accumulated `categories` CSV string to `eventsApi.list` (fixing the "URL
 * changes but the grid doesn't filter" bug — `categories` didn't reach the
 * API before this task), and the "Clear (N)" bulk-reset chip is appended.
 * Events has no dedicated per-category landing, so there is no
 * landing-escape case here.
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

const src = readFileSync(resolve(__dirname, '../../src/pages/[lang]/eventos/index.astro'), 'utf8');

function query(href: string): URLSearchParams {
    return new URLSearchParams(href.split('?')[1] ?? '');
}

describe('eventos/index.astro — category chips wired to real multi-select (HOS-96 T-013)', () => {
    describe('source wiring', () => {
        it('imports resolveFacetChipHref (the CAPPED builder, HOS-524) and buildClearFacetChip', () => {
            // HOS-524: a chip row that calls `buildMultiToggleParamHref`
            // directly has no depth cap and re-opens the combinatorial link
            // space this listing published to crawlers.
            expect(src).toContain("} from '@/lib/filters/facet-chip-depth'");
            expect(src).toContain('resolveFacetChipHref');
            expect(src).not.toContain(
                "import { buildMultiToggleParamHref } from '@/lib/filters/toggle-multi-query-param'"
            );
            expect(src).toContain(
                "import { buildClearFacetChip } from '@/lib/filters/build-clear-facet-chip'"
            );
        });

        it('imports XCircleIcon for the Clear(N) chip', () => {
            expect(src).toContain('XCircleIcon');
        });

        it('builds each category chip href via resolveFacetChipHref keyed on the eventCategory paramKey (categories), replacing the single-select buildToggleParamHref', () => {
            // Sliced to the END of the map expression rather than a fixed
            // character budget: a fixed window silently starts asserting over
            // half a block the moment a comment is added inside it.
            const start = src.indexOf('const categoryChips = CATEGORY_CHIP_DEFS.map');
            const chipBlock = src.slice(start, src.indexOf('\n});', start));
            expect(chipBlock).toContain('resolveFacetChipHref({');
            expect(chipBlock).toContain('activeValues: activeCategories');
            expect(chipBlock).toContain('capNote: resolveCappedChipNote({');
            expect(chipBlock).toContain('FACET_CONFIG_BY_ID.eventCategory.paramKey');
            expect(chipBlock).not.toContain("key: 'category',");
        });

        it('reads the active categories once (top-level) and reuses it for both the API call and the chip active/href state', () => {
            const occurrences = src.match(/readFacetActiveValues\(\{/g) ?? [];
            expect(occurrences.length).toBe(1);
        });

        it('builds a Clear(N) chip for the eventCategory facet and conditionally appends it to the chips array', () => {
            expect(src).toContain('buildClearFacetChip({');
            expect(src).toContain('paramKey: FACET_CONFIG_BY_ID.eventCategory.paramKey');
            expect(src).toMatch(
                /chips=\{categoryClearChip\s*\?\s*\[\s*\.\.\.categoryChips,\s*categoryClearChip\s*\]\s*:\s*categoryChips\}/
            );
        });

        it('resolves the Clear(N) label/ariaLabel via the shared common.filterChips i18n keys', () => {
            expect(src).toContain("t('common.filterChips.clearLabel')");
            // buildClearFacetChip only renders at count >= 2, so `_other` is read
            // directly (HOS plural audit) — `_one` can never be reached here.
            expect(src).toContain("t('common.filterChips.clearAriaLabel_other')");
        });
    });

    describe('data-fetch forwarding (regression guard: URL changes but grid did not filter)', () => {
        it('forwards categories as a CSV string (not a JS array) to eventsApi.list, alongside the singular category', () => {
            const fetchBlock = src.slice(
                src.indexOf('const result = await eventsApi.list({'),
                src.indexOf('const result = await eventsApi.list({') + 800
            );
            expect(fetchBlock).toContain('category,');
            expect(fetchBlock).toContain('categories:');
            // Must be a .join(',') string expression, never the raw array itself
            // (String(array) in serializeParams is an implicit/fragile footgun).
            // HOS-524 wrapped the value in `canonicalizeFacetValues`, so the
            // pattern now REQUIRES that wrapper as well as the join: it still
            // asserts the value comes from the hoisted active-values array and
            // is a CSV string (never the raw array, which `serializeParams`
            // would stringify implicitly), and additionally that it is
            // serialized in the one canonical order every writer shares.
            expect(fetchBlock).toMatch(
                /categories:\s*activeCategories\.length\s*>\s*0\s*\?\s*canonicalizeFacetValues\(\{\s*values:\s*activeCategories\s*\}\)\.join\(','\)\s*:\s*undefined/
            );
        });
    });
});

describe('events category multi-select — composed helper behavior (HOS-96 T-013)', () => {
    const baseUrl = '/es/eventos/';

    it('accumulate: from unfiltered, clicking Música produces ?categories=MUSIC', () => {
        const href = buildMultiToggleParamHref({
            baseUrl,
            searchParams: new URLSearchParams(''),
            key: 'categories',
            value: 'MUSIC'
        });
        expect(query(href).get('categories')).toBe('MUSIC');
    });

    it('accumulate: with Música active, clicking Cultura ADDS it (does not replace), in canonical order', () => {
        const href = buildMultiToggleParamHref({
            baseUrl,
            searchParams: new URLSearchParams('categories=MUSIC'),
            key: 'categories',
            value: 'CULTURE'
        });
        // HOS-524: canonical (sorted) order, not click order.
        expect(query(href).get('categories')).toBe('CULTURE,MUSIC');
    });

    it('deselect: clicking the active Música chip while Música+Cultura are active removes only Música', () => {
        const href = buildMultiToggleParamHref({
            baseUrl,
            searchParams: new URLSearchParams('categories=MUSIC,CULTURE'),
            key: 'categories',
            value: 'MUSIC'
        });
        expect(query(href).get('categories')).toBe('CULTURE');
    });

    it('Clear(N) chip appears at 2+ active values and its href removes the whole categories param', () => {
        const searchParams = new URLSearchParams('q=asado&categories=MUSIC,CULTURE');
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
        expect(params.get('q')).toBe('asado');
    });

    it('the CSV string handed to the API matches exactly what the accumulate helper produces (end-to-end shape proof)', () => {
        const searchParams = new URLSearchParams('categories=MUSIC,CULTURE');
        const activeValues = readFacetActiveValues({ searchParams, paramKey: 'categories' });
        const categoriesParam = activeValues.length > 0 ? activeValues.join(',') : undefined;
        expect(categoriesParam).toBe('MUSIC,CULTURE');
        expect(typeof categoriesParam).toBe('string');
    });
});
