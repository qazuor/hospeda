/**
 * @file facet-noindex.test.ts
 * @description Source-based tests verifying that every facet/filter listing
 * sub-page opts into `noindex` via its ListingLayout. Astro components cannot
 * be rendered in Vitest, so we assert on the page source (the project's
 * documented approach for .astro coverage).
 *
 * SPEC-157 follow-up: facet pages (filter/taxonomy sub-listings) must be
 * noindex,follow. The MAIN listings (alojamientos/, eventos/, destinos/,
 * publicaciones/ index) must NOT be noindex.
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

/** Main listing index pages that must NOT declare noindex. */
const MAIN_LISTINGS = [
    'alojamientos/index.astro',
    'eventos/index.astro',
    'destinos/index.astro',
    'publicaciones/index.astro'
] as const;

/**
 * Facet landing pages promoted to first-class, indexable status (SPEC-306
 * OQ-1): event category and accommodation type. These get the full listing
 * UI (sidebar + combinable filters) and must NOT declare `noindex={true}`,
 * same invariant as `MAIN_LISTINGS`.
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

describe('main listings stay indexable (SPEC-157 follow-up)', () => {
    for (const page of MAIN_LISTINGS) {
        it(`${page} does NOT set noindex`, () => {
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
