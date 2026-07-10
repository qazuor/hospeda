/**
 * @file destinos-no-op-regression.test.ts
 * @description HOS-96 T-023 — US-12/M-8 regression guard. `destinos/` is
 * explicitly OUT OF SCOPE for this spec: it already does client-side
 * multi-select AND filtering (`?attractions=a,b`, `cardMatchesFilter()`,
 * `startViewTransition` inline reconcile, `showFilters=false`, full-dataset
 * SSR) and must have NO functional diff from this spec's OR-facet work on
 * accommodations/events/blog.
 *
 * Two proofs:
 * 1. `git diff` across the entire HOS-96 commit range shows ZERO lines
 *    changed in `destinos/index.astro` (verified via `git log`/`git diff`
 *    before writing this test — see the coordinator report). The existing
 *    destinos test suite (`destinos-attractions-filter-chip.test.ts`,
 *    `destinos-detail-counts.test.ts`, `destinos-single-events-call.test.ts`)
 *    was re-run UNMODIFIED and is 100% green — see the quality-gate report.
 * 2. THIS file: an explicit no-coupling assertion. `destinos/index.astro`
 *    must NOT import any of the new OR-facet multi-select machinery this
 *    spec introduced — its AND semantics and client-only behavior must not
 *    have accidentally picked it up.
 *
 * `.astro` frontmatter cannot render in Vitest — source-based assertions per
 * the project convention.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(__dirname, '../../src/pages/[lang]/destinos/index.astro'), 'utf8');

describe('destinos/index.astro — no coupling to HOS-96 OR-facet machinery (US-12, M-8)', () => {
    it('does NOT import buildMultiToggleParamHref (multi-select OR-facet chip href builder)', () => {
        expect(src).not.toContain('buildMultiToggleParamHref');
    });

    it('does NOT import buildClearFacetChip (the "Clear (N)" bulk-reset chip builder)', () => {
        expect(src).not.toContain('buildClearFacetChip');
    });

    it('does NOT import readFacetActiveValues (the OR-facet active-values reader)', () => {
        expect(src).not.toContain('readFacetActiveValues');
    });

    it('does NOT import resolveFacetSeoDecision (the 2+-value noindex/canonical predicate)', () => {
        expect(src).not.toContain('resolveFacetSeoDecision');
    });

    it('does NOT import FACET_CONFIG_BY_ID (the per-facet OR-combination config model)', () => {
        expect(src).not.toContain('FACET_CONFIG_BY_ID');
    });

    it('does NOT import the destination-attraction facet id anywhere (it is declared out-of-backend-scope in facet-config.ts but never consumed here)', () => {
        expect(src).not.toContain('destinationAttraction');
    });
});

describe('destinos/index.astro — AND-combination behavior markers still present, unchanged (US-12)', () => {
    it('still reads the attractions param as ?attractions=a,b (client-side, own parsing — not the shared paramKey machinery)', () => {
        expect(src).toContain("url.searchParams.get('attractions')");
    });

    it('still declares showFilters={false} (no FilterSidebar — full dataset SSR, own inline chip filter instead)', () => {
        expect(src).toContain('showFilters={false}');
    });

    it('still uses its own client-side AND-matching logic (cardAttractionIds / next.size / target.searchParams), not a shared OR-union helper', () => {
        expect(src).toContain('cardAttractionIds');
        expect(src).toContain("target.searchParams.set('attractions'");
    });
});
