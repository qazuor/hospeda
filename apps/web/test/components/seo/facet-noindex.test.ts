/**
 * @file facet-noindex.test.ts
 * @description Source-based tests verifying that every facet/filter listing
 * sub-page opts into `noindex` via its ListingLayout. Astro components cannot
 * be rendered in Vitest, so we assert on the page source (the project's
 * documented approach for .astro coverage).
 *
 * SPEC-157 follow-up: facet pages (filter/taxonomy sub-listings) must be
 * unconditionally noindex,follow.
 *
 * HOS-96 T-017/18/19 UPDATED the "main listings must NEVER be noindex"
 * invariant this file previously asserted — that is now FALSE BY DESIGN.
 * `alojamientos/`, `eventos/`, and `publicaciones/` each wire the shared
 * `resolveFacetSeoDecision` predicate (US-6/US-7): with 2+ active facet
 * values (`?types=A,B` / `?categories=A,B`) the listing DOES emit
 * `noindex,follow`. The invariant this file now guards is narrower and more
 * precise: `noindex` on a main listing must be CONDITIONAL — driven by
 * `facetSeoDecision.noindex`, never a hardcoded `noindex={true}` — so a main
 * listing is noindex ONLY for 2+ facet values, never unconditionally.
 * `destinos/index.astro` is explicitly OUT OF SCOPE for HOS-96 (US-12,
 * client-side-only AND facet) and must stay entirely free of `noindex`, same
 * as before this task.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGES_DIR = resolve(__dirname, '../../../src/pages/[lang]');

/** Facet/filter sub-listing index pages that must declare noindex={true}. */
const FACET_PAGES = [
    'alojamientos/caracteristicas/[slug]/index.astro',
    'alojamientos/comodidades/[slug]/index.astro',
    // 'eventos/categoria/[category]/index.astro' promoted to a first-class,
    // indexable landing (SPEC-306) — see PROMOTED_FACET_LANDINGS below.
    'publicaciones/categoria/[category]/index.astro',
    'publicaciones/etiqueta/[tag]/index.astro',
    'publicaciones/autor/[slug]/index.astro'
] as const;

/**
 * Main listing index pages whose `noindex` is CONDITIONAL on the HOS-96
 * multi-select facet SEO decision (2+ active values -> noindex; 0-1 ->
 * indexable). Every page here must wire `noindex={facetSeoDecision.noindex}`
 * — never a hardcoded `noindex={true}`.
 */
const CONDITIONAL_NOINDEX_LISTINGS = [
    'alojamientos/index.astro',
    'eventos/index.astro',
    'publicaciones/index.astro'
] as const;

/**
 * `destinos/` is explicitly OUT OF SCOPE for HOS-96 (US-12) — its facet
 * (destination attractions) is `operator: 'AND'`, client-side-only, and
 * never a backend/SEO concern. It must stay entirely free of `noindex`,
 * unconditionally, same as before this task.
 */
const UNCONDITIONALLY_INDEXABLE_LISTINGS = ['destinos/index.astro'] as const;

/**
 * Facet landing pages promoted to first-class, indexable status (SPEC-306
 * OQ-1): event category and accommodation type. These get the full listing
 * UI (sidebar + combinable filters) and must NOT declare `noindex={true}`,
 * same invariant as before.
 */
const PROMOTED_FACET_LANDINGS = [
    'alojamientos/tipo/[type]/index.astro',
    'eventos/categoria/[category]/index.astro'
] as const;

describe('facet pages are noindex (SPEC-157 follow-up)', () => {
    for (const page of FACET_PAGES) {
        it(`${page} passes noindex={true} to its layout`, () => {
            const src = readFileSync(resolve(PAGES_DIR, page), 'utf8');
            expect(src).toContain('noindex={true}');
        });
    }
});

describe('main listings are noindex ONLY conditionally, never unconditionally (HOS-96 T-017/18/19)', () => {
    for (const page of CONDITIONAL_NOINDEX_LISTINGS) {
        it(`${page} wires noindex to facetSeoDecision.noindex (the shared 2+-value predicate), not a hardcoded value`, () => {
            const src = readFileSync(resolve(PAGES_DIR, page), 'utf8');
            expect(src).toContain('noindex={facetSeoDecision.noindex}');
            // A conditional wiring must never ALSO carry a hardcoded
            // noindex={true}/{false} literal — that would defeat the point.
            expect(src).not.toContain('noindex={true}');
            expect(src).not.toContain('noindex={false}');
        });

        it(`${page} calls the shared resolveFacetSeoDecision predicate (no per-page reimplementation)`, () => {
            const src = readFileSync(resolve(PAGES_DIR, page), 'utf8');
            expect(src).toContain(
                "import { resolveFacetSeoDecision } from '@/lib/seo/promoted-facet-canonical'"
            );
        });
    }
});

describe('destinos stays unconditionally indexable (HOS-96 US-12 — out of scope, unchanged)', () => {
    for (const page of UNCONDITIONALLY_INDEXABLE_LISTINGS) {
        it(`${page} does NOT set noindex at all`, () => {
            const src = readFileSync(resolve(PAGES_DIR, page), 'utf8');
            expect(src).not.toContain('noindex');
        });
    }
});

describe('promoted facet landings stay indexable (SPEC-306)', () => {
    for (const page of PROMOTED_FACET_LANDINGS) {
        it(`${page} does NOT declare noindex={true}`, () => {
            const src = readFileSync(resolve(PAGES_DIR, page), 'utf8');
            expect(src).not.toContain('noindex={true}');
        });
    }
});
