/**
 * @file alojamientos-multiselect-wiring.test.ts
 * @description HOS-96 T-011 — the accommodations base listing's type chips
 * switch from dedicated-route navigation to a real in-place multi-select
 * toggle on `types`, plus the "Clear (N)" bulk-reset chip. The data-fetch
 * side (`accommodationsApi.list({ types, ... })`) is verified as an existing
 * pass-through baseline (the `types` blueprint already worked end-to-end
 * before this spec — HOS-96 framing note), not newly wired here.
 *
 * `.astro` frontmatter cannot render in Vitest — assertions are source-based
 * (scoped slices to avoid false positives from unrelated `/tipo/` references
 * used by the SEO single-value-canonical logic elsewhere in the same file),
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
    resolve(__dirname, '../../src/pages/[lang]/alojamientos/index.astro'),
    'utf8'
);

/** Scope assertions to the typeChips-building block only, avoiding the
 * unrelated `/tipo/` references used elsewhere (SEO single-value canonical
 * via `resolvePromotedFacetCanonical`). */
const typeChipsBlock = src.slice(
    src.indexOf('const typeActiveValues'),
    src.indexOf('// Build initial filter params for the sidebar')
);

function query(href: string): URLSearchParams {
    return new URLSearchParams(href.split('?')[1] ?? '');
}

describe('alojamientos/index.astro — type chips wired to real multi-select (HOS-96 T-011)', () => {
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

        it('builds each type chip href via buildMultiToggleParamHref keyed on the accommodationType paramKey (types)', () => {
            expect(typeChipsBlock).toContain('buildMultiToggleParamHref({');
            expect(typeChipsBlock).toContain('FACET_CONFIG_BY_ID.accommodationType.paramKey');
        });

        it('no longer navigates to the dedicated /tipo/{slug}/ route from the chip href (landing-escape: base listing only)', () => {
            expect(typeChipsBlock).not.toContain('path: `/alojamientos/tipo/');
        });

        it('passes the base listing baseUrl (not the dedicated landing) to buildMultiToggleParamHref', () => {
            expect(typeChipsBlock).toMatch(/buildMultiToggleParamHref\(\{\s*baseUrl,/);
        });

        it('builds a Clear(N) chip for the accommodationType facet and conditionally appends it to the chips array', () => {
            expect(src).toContain('buildClearFacetChip({');
            expect(src).toContain('paramKey: FACET_CONFIG_BY_ID.accommodationType.paramKey');
            expect(src).toMatch(
                /chips=\{typeClearChip\s*\?\s*\[\s*\.\.\.typeChips,\s*typeClearChip\s*\]\s*:\s*typeChips\}/
            );
        });

        it('resolves the Clear(N) label/ariaLabel via the shared common.filterChips i18n keys', () => {
            expect(src).toContain("t('common.filterChips.clearLabel')");
            expect(src).toContain("t('common.filterChips.clearAriaLabel')");
        });
    });

    describe('data-fetch forwarding (existing baseline — types blueprint already worked end-to-end)', () => {
        it('still forwards types (CSV string straight from the URL) to accommodationsApi.list', () => {
            const fetchBlock = src.slice(
                src.indexOf('const result = await accommodationsApi.list({'),
                src.indexOf('const result = await accommodationsApi.list({') + 400
            );
            expect(fetchBlock).toContain('types,');
        });

        it('types is read as a raw URL string, never a JS array (String(array) footgun guard)', () => {
            expect(src).toContain("const types = url.searchParams.get('types') ?? undefined;");
        });
    });
});

describe('accommodations type multi-select — composed helper behavior (HOS-96 T-011)', () => {
    const baseUrl = '/es/alojamientos/';

    it('accumulate: from unfiltered, clicking Hotel produces ?types=HOTEL', () => {
        const href = buildMultiToggleParamHref({
            baseUrl,
            searchParams: new URLSearchParams(''),
            key: 'types',
            value: 'HOTEL'
        });
        expect(query(href).get('types')).toBe('HOTEL');
    });

    it('accumulate: with Hotel active, clicking Cabaña ADDS it (does not replace)', () => {
        const href = buildMultiToggleParamHref({
            baseUrl,
            searchParams: new URLSearchParams('types=HOTEL'),
            key: 'types',
            value: 'CABIN'
        });
        expect(query(href).get('types')).toBe('HOTEL,CABIN');
    });

    it('deselect: clicking the active Hotel chip while Hotel+Cabaña are active removes only Hotel', () => {
        const href = buildMultiToggleParamHref({
            baseUrl,
            searchParams: new URLSearchParams('types=HOTEL,CABIN'),
            key: 'types',
            value: 'HOTEL'
        });
        expect(query(href).get('types')).toBe('CABIN');
    });

    it('Clear(N) chip appears at 2+ active values and its href removes the whole types param', () => {
        const searchParams = new URLSearchParams('q=rio&types=HOTEL,CABIN');
        const activeValues = readFacetActiveValues({ searchParams, paramKey: 'types' });
        const chip = buildClearFacetChip({
            baseUrl,
            searchParams,
            paramKey: 'types',
            count: activeValues.length,
            labelTemplate: 'Limpiar ({{count}})',
            ariaLabelTemplate: 'Limpiar {{count}} filtros',
            icon: (() => null) as never
        });
        expect(chip).toBeDefined();
        expect(chip?.label).toBe('Limpiar (2)');
        const params = new URLSearchParams(chip?.href.split('?')[1] ?? '');
        expect(params.has('types')).toBe(false);
        expect(params.get('q')).toBe('rio');
    });

    it('Clear(N) chip is absent (undefined) with 0 or 1 active values', () => {
        const zero = buildClearFacetChip({
            baseUrl,
            searchParams: new URLSearchParams(''),
            paramKey: 'types',
            count: 0,
            labelTemplate: 'Limpiar ({{count}})',
            ariaLabelTemplate: 'Limpiar {{count}} filtros',
            icon: (() => null) as never
        });
        const one = buildClearFacetChip({
            baseUrl,
            searchParams: new URLSearchParams('types=HOTEL'),
            paramKey: 'types',
            count: 1,
            labelTemplate: 'Limpiar ({{count}})',
            ariaLabelTemplate: 'Limpiar {{count}} filtros',
            icon: (() => null) as never
        });
        expect(zero).toBeUndefined();
        expect(one).toBeUndefined();
    });
});
