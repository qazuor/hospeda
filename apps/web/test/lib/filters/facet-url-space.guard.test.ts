/**
 * @file facet-url-space.guard.test.ts
 * @description Static guard keeping the HOS-524 fix from eroding: every writer
 * of a multi-select facet CSV query param must serialize through the shared
 * canonical order, and every quick-filter chip row must resolve its hrefs
 * through the depth-capped builder.
 *
 * Why a static guard and not more unit tests: the failure mode is a NEW call
 * site — a future facet, a new listing, a second sidebar — that serializes its
 * own CSV param or links chips with the raw toggle builder. No behavioral test
 * of the existing code can see that; only a scan of the tree can. This is the
 * same shape as the repo's other "N call sites must not forget the gate"
 * guards.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = join(__dirname, '../../../src');

/** Every source file that could serialize a query param. */
function collectSourceFiles(dir: string): readonly string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            out.push(...collectSourceFiles(full));
        } else if (/\.(ts|tsx|astro)$/.test(entry)) {
            out.push(full);
        }
    }
    return out;
}

/**
 * A `<params>.set(<key>, <something>.join(','))` write — the exact shape that
 * serializes a facet's values into a CSV query param. Anchored on the `.set(`
 * call so a rename of the surrounding helper cannot slip past it, and matched
 * across line breaks because Biome wraps the longer call sites.
 */
const CSV_PARAM_WRITE = /\.set\(\s*[^;]{0,120}?\.join\(','\)/;

/**
 * The files allowed to write a facet CSV param. Every one of them is asserted
 * below to canonicalize; this list exists so a NEW writer fails the guard
 * instead of silently inheriting the old click-ordered behavior.
 */
const KNOWN_CSV_WRITERS: readonly string[] = [
    'lib/filters/toggle-multi-query-param.ts',
    'components/shared/filters/filter-reducer.ts',
    'pages/[lang]/destinos/index.astro',
    // Found BY this guard while it was being written — three writers the
    // HOS-524 analysis had missed: the hero search bar (a fourth `?types=`
    // writer) and the removable active-filter chips on both accommodation
    // listings, which re-serialize the surviving values after a removal.
    'components/sections/SearchBar.client.tsx',
    'pages/[lang]/alojamientos/index.astro',
    'pages/[lang]/alojamientos/tipo/[type]/index.astro'
];

/** Listing surfaces whose chip rows publish crawlable facet links. */
const CAPPED_CHIP_PAGES: readonly string[] = [
    'pages/[lang]/alojamientos/index.astro',
    'pages/[lang]/eventos/index.astro',
    'pages/[lang]/publicaciones/index.astro'
];

describe('HOS-524 facet URL-space guard', () => {
    const files = collectSourceFiles(SRC_ROOT);

    it('finds source files to scan (the scan itself must not silently be empty)', () => {
        expect(files.length).toBeGreaterThan(100);
    });

    it('no source file outside the known writers serializes a facet CSV query param', () => {
        const offenders = files
            .map((file) => ({ rel: relative(SRC_ROOT, file), src: readFileSync(file, 'utf8') }))
            .filter(({ src }) => CSV_PARAM_WRITE.test(src))
            .map(({ rel }) => rel)
            .filter((rel) => !KNOWN_CSV_WRITERS.includes(rel));

        expect(
            offenders,
            `New CSV query-param writer(s) found: ${offenders.join(', ')}. Serialize through canonicalizeFacetValues() (src/lib/filters/canonical-facet-order.ts) and add the file to KNOWN_CSV_WRITERS, or the facet re-opens the permutation URL space HOS-524 closed.`
        ).toEqual([]);
    });

    it.each(KNOWN_CSV_WRITERS)('%s canonicalizes before serializing', (rel) => {
        const src = readFileSync(join(SRC_ROOT, rel), 'utf8');
        expect(src).toContain('canonicalizeFacetValues');
    });

    it.each(CAPPED_CHIP_PAGES)('%s resolves chip hrefs through the depth cap', (rel) => {
        const src = readFileSync(join(SRC_ROOT, rel), 'utf8');
        expect(src).toContain('resolveFacetChipHref(');
        // The raw toggle builder has no cap: importing it here would let a chip
        // row link one level deeper forever.
        expect(src).not.toContain(
            "import { buildMultiToggleParamHref } from '@/lib/filters/toggle-multi-query-param'"
        );
    });

    it("destinos' inline no-JS filter script sorts its own CSV write (it cannot import the helper)", () => {
        const src = readFileSync(join(SRC_ROOT, 'pages/[lang]/destinos/index.astro'), 'utf8');
        expect(src).toContain("Array.from(active).sort().join(',')");
    });

    it('destinos reads its depth cap from the shared constant, never a literal', () => {
        const src = readFileSync(join(SRC_ROOT, 'pages/[lang]/destinos/index.astro'), 'utf8');
        expect(src).toContain('FACET_CHIP_MAX_ACTIVE_VALUES');
        expect(src).toContain('data-facet-max-active');
    });
});
