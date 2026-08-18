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
 * Every `.join(',')` in the tree, by byte offset — the ONLY syntactic shape a
 * CSV facet param can be built with, whatever wraps it.
 *
 * The first version of this guard anchored on `.set(x, y.join(','))` instead,
 * and five real shapes walked straight past it: `.append()`, a plain object
 * property (`params.types = values.join(',')` — which is how the seventh
 * writer, `SearchHistoryList.client.tsx`, was already doing it), a template
 * literal, an object literal passed to `new URLSearchParams({...})`, and any
 * `.set(` whose arguments wrapped past the pattern's character budget. Matching
 * the join itself has no such holes.
 */
const CSV_JOIN = /\.join\(','\)/g;

/** How far back to look for the canonicalizing call that feeds a join. */
const CANONICALIZE_LOOKBACK = 240;

/**
 * Files that join on a comma for something that is NOT a facet query param.
 * Each needs a reason, because "it is not a facet" is exactly the claim a
 * future reader has to be able to check without re-deriving it.
 */
const NON_FACET_JOINS: Readonly<Record<string, string>> = Object.freeze({
    'components/GlobalAnnouncements.astro': 'dismissed-announcement ids in a cookie value',
    'components/account/ProfileEditAvatarSection.tsx': "the <input> `accept` attribute's MIME list",
    'components/destination/DestinationPOISection.astro':
        'a `data-poi-categories` attribute read as a SET by the client filter',
    'components/shared/navigation/UserMenu.client.tsx': 'a pre-sorted useMemo cache key'
});

/**
 * Files allowed to serialize a facet CSV param. Every join in these is asserted
 * below to be fed by `canonicalizeFacetValues` — per CALL SITE, not per file,
 * so adding a second uncanonicalized join to an already-listed file fails too.
 */
const FACET_CSV_WRITERS: readonly string[] = [
    'lib/filters/toggle-multi-query-param.ts',
    'components/shared/filters/filter-reducer.ts',
    'components/sections/SearchBar.client.tsx',
    'components/account/SearchHistoryList.client.tsx',
    'components/ai-search/useSearchChat.ts',
    'pages/[lang]/destinos/index.astro',
    'pages/[lang]/alojamientos/index.astro',
    'pages/[lang]/alojamientos/tipo/[type]/index.astro',
    'pages/[lang]/eventos/index.astro',
    'pages/[lang]/publicaciones/index.astro'
];

/**
 * Per-CALL-SITE exemptions inside a facet-writer file: a join that is not a
 * query param at all. Keyed by file, anchored on a literal snippet that must
 * appear within the lookback window of the join, so the exemption covers one
 * site and not the whole file. A snippet that stops matching fails the
 * staleness test below rather than silently widening.
 */
const EXEMPT_JOIN_SITES: Readonly<Record<string, readonly (readonly [string, string])[]>> =
    Object.freeze({
        'pages/[lang]/destinos/index.astro': [
            [
                'const attractionIdsAttr',
                'a `data-attraction-ids` card attribute read as a SET by the client filter'
            ]
        ]
    });

/** Listing surfaces whose chip rows publish crawlable facet links. */
const CAPPED_CHIP_PAGES: readonly string[] = [
    'pages/[lang]/alojamientos/index.astro',
    'pages/[lang]/eventos/index.astro',
    'pages/[lang]/publicaciones/index.astro'
];

/**
 * Every `.join(',')` in `src` that is NOT fed by a canonicalizing call.
 *
 * A literal `.sort().join(',')` counts as canonical too: that is precisely the
 * helper's contract (de-duplicate, then sort), and destinos' inline no-JS
 * script has to inline it because a `<script is:inline>` cannot import.
 */
function uncanonicalizedJoins(src: string, rel: string): number {
    const exemptions = EXEMPT_JOIN_SITES[rel] ?? [];
    let count = 0;
    for (const match of src.matchAll(CSV_JOIN)) {
        const at = match.index ?? 0;
        const before = src.slice(Math.max(0, at - CANONICALIZE_LOOKBACK), at);
        const canonical =
            before.includes('canonicalizeFacetValues') ||
            before.endsWith('.sort()') ||
            exemptions.some(([snippet]) => before.includes(snippet));
        if (!canonical) count += 1;
    }
    return count;
}

describe('HOS-524 facet URL-space guard', () => {
    const files = collectSourceFiles(SRC_ROOT).map((file) => ({
        rel: relative(SRC_ROOT, file),
        src: readFileSync(file, 'utf8')
    }));

    it('finds source files to scan (the scan itself must not silently be empty)', () => {
        expect(files.length).toBeGreaterThan(100);
    });

    it("every file that joins on ',' is either a declared facet writer or a declared non-facet use", () => {
        const undeclared = files
            .filter(({ src }) => src.includes(".join(',')"))
            .map(({ rel }) => rel)
            .filter(
                (rel) =>
                    !FACET_CSV_WRITERS.includes(rel) &&
                    !Object.hasOwn(NON_FACET_JOINS, rel) &&
                    rel !== 'lib/filters/canonical-facet-order.ts'
            );

        expect(
            undeclared,
            `Undeclared comma-join(s): ${undeclared.join(', ')}. If it serializes a facet query param, route it through canonicalizeFacetValues() and add it to FACET_CSV_WRITERS; if it does not, add it to NON_FACET_JOINS with the reason.`
        ).toEqual([]);
    });

    it.each(FACET_CSV_WRITERS)('%s canonicalizes at EVERY call site', (rel) => {
        const src = readFileSync(join(SRC_ROOT, rel), 'utf8');
        expect(
            uncanonicalizedJoins(src, rel),
            `${rel} builds a CSV param without canonicalizeFacetValues() within ${CANONICALIZE_LOOKBACK} characters. Per call site, not per file: a second join in an already-listed file re-opens the permutation URL space HOS-524 closed.`
        ).toBe(0);
    });

    it.each(CAPPED_CHIP_PAGES)('%s resolves chip hrefs through the depth cap', (rel) => {
        const src = readFileSync(join(SRC_ROOT, rel), 'utf8');
        expect(src).toContain('resolveFacetChipHref(');
        // Matched on any IMPORT of the symbol, not on one exact import line: a
        // combined import (`import { buildClearFacetChip,
        // buildMultiToggleParamHref } from ...`) walked past the exact-string
        // check this replaces. Prose in the file's JSDoc names the uncapped
        // builder on purpose (to say not to use it), so the predicate has to be
        // about importing it, not about mentioning it.
        expect(src).not.toMatch(/import\s*\{[^}]*\bbuildMultiToggleParamHref\b[^}]*\}/);
    });

    it('every declared per-call-site exemption still matches its file (no stale escape hatch)', () => {
        const stale: string[] = [];
        for (const [rel, sites] of Object.entries(EXEMPT_JOIN_SITES)) {
            const src = readFileSync(join(SRC_ROOT, rel), 'utf8');
            for (const [snippet] of sites) {
                if (!src.includes(snippet)) stale.push(`${rel}: ${snippet}`);
            }
        }
        expect(
            stale,
            `Exemption(s) whose anchor no longer exists: ${stale.join(', ')}. A stale anchor silently exempts nothing today and anything tomorrow — delete it.`
        ).toEqual([]);
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

    it('every capped chip surface ships a screen-reader note, never an aria-label on a generic element', () => {
        // ARIA prohibits naming a `generic` element, which is what both a
        // role-less <span> and an <a> without href are. An aria-label there is
        // not weak — it is never computed at all.
        const chips = readFileSync(
            join(SRC_ROOT, 'components/shared/ui/FilterChips.astro'),
            'utf8'
        );
        const cappedBranch = chips.slice(
            chips.indexOf(') : ('),
            chips.indexOf(')}\n', chips.indexOf(') : ('))
        );
        expect(cappedBranch).toContain('<span');
        expect(cappedBranch).toContain('aria-disabled="true"');
        expect(cappedBranch).toContain('class="sr-only"');
        expect(cappedBranch).not.toContain('aria-label');

        const destinos = readFileSync(join(SRC_ROOT, 'pages/[lang]/destinos/index.astro'), 'utf8');
        expect(destinos).toContain('data-capped-note');
        expect(destinos).toContain('class="sr-only"');
    });
});
