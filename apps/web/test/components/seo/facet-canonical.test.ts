/**
 * @file facet-canonical.test.ts
 * @description HOS-369 WA-3 — locks the invariant that makes every filtered
 * facet URL canonicalize to its clean form: the canonical is built from
 * `Astro.url.pathname`, never from the full URL or its query string.
 *
 * WA-3 was specified as a *verification* task ("confirm the canonical is
 * actually emitted on the destination detail page, which reached the facet
 * pattern via HOS-147 and may not be wired into `resolveFacetSeoDecision`").
 * The verification outcome, recorded here so it cannot silently rot:
 *
 * - `ListingLayout` and `DetailLayout` both default `canonicalPath` to
 *   `Astro.url.pathname`. A query string is structurally incapable of reaching
 *   the canonical, so EVERY page — including the ones that never compute a
 *   canonical themselves — emits the clean URL for any `?facet=` variant.
 * - The destination detail page (`destinos/[...path].astro`) therefore has a
 *   correct canonical WITHOUT wiring `resolveFacetSeoDecision`, and it should
 *   NOT be wired: the HOS-147 POI filter is resolved 100% client-side, so
 *   `?categories=` returns byte-identical SSR HTML. The predicate's only
 *   behavioral difference here would be emitting `noindex` at 2+ values — and
 *   `noindex` on a page whose canonical points elsewhere is a documented
 *   anti-pattern (the directive can propagate to the canonical target). The
 *   canonical alone is the correct and sufficient signal.
 *
 * Companion file: `facet-noindex.test.ts` guards the `noindex` half of the same
 * SEO contract. This file guards the canonical half.
 *
 * Source-based assertions: `.astro` cannot be rendered in Vitest (see
 * apps/web/CLAUDE.md → Testing).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = resolve(__dirname, '../../../src');
const PAGES_DIR = resolve(SRC_DIR, 'pages/[lang]');

const read = (relativePath: string): string => readFileSync(resolve(SRC_DIR, relativePath), 'utf8');

/** The two layouts that own canonical construction for every page. */
const LAYOUTS = ['layouts/ListingLayout.astro', 'layouts/DetailLayout.astro'] as const;

/**
 * Every page that publishes facet query-param views — the URLs whose crawl this
 * spec is closing. Each must canonicalize to its clean path.
 */
const FACET_SURFACE_PAGES = [
    'alojamientos/index.astro',
    'eventos/index.astro',
    'publicaciones/index.astro',
    'gastronomia/index.astro',
    'experiencias/index.astro',
    'destinos/index.astro',
    'destinos/[...path].astro'
] as const;

/**
 * Every line mentioning `canonicalPath` in a source file — the declaration and
 * the prop pass. Scoping to these lines is deliberate: a page may legitimately
 * use `Astro.url.href` for something else entirely (alojamientos passes it as a
 * `currentUrl` prop), and a whole-file ban would be a false positive.
 */
function canonicalPathLines(src: string): readonly string[] {
    return src.split('\n').filter((line) => line.includes('canonicalPath'));
}

describe('WA-3 — the canonical is built from the pathname, never the query string', () => {
    for (const layout of LAYOUTS) {
        describe(layout, () => {
            it('defaults canonicalPath to Astro.url.pathname', () => {
                expect(read(layout)).toContain('canonicalPath = Astro.url.pathname');
            });

            it('never builds the canonical from the full URL or its search string', () => {
                // `Astro.url.pathname` excludes `?...` by construction. Reading
                // `.href` or `.search` here would leak every facet permutation
                // into the canonical, making each filtered URL self-canonical
                // and re-opening the duplicate-URL space this spec is closing.
                const src = read(layout);
                expect(src).not.toContain('Astro.url.search');
                expect(src).not.toContain('Astro.url.href');
            });

            it('feeds the resolved canonical into SEOHead', () => {
                // Non-vacuity anchor: the invariants above are worthless if the
                // canonical is never actually rendered.
                const src = read(layout);
                expect(src).toContain('const canonicalUrl = new URL(canonicalPath, siteBase).href');
                expect(src).toContain('canonical={canonicalUrl}');
            });
        });
    }

    it('SEOHead emits a <link rel="canonical">', () => {
        expect(read('components/seo/SEOHead.astro')).toContain(
            '<link rel="canonical" href={canonical} />'
        );
    });
});

describe('WA-3 — no facet-surface page feeds its query string into the canonical', () => {
    for (const page of FACET_SURFACE_PAGES) {
        it(`${page} keeps its canonical query-free`, () => {
            const src = readFileSync(resolve(PAGES_DIR, page), 'utf8');

            for (const line of canonicalPathLines(src)) {
                expect(line, `canonicalPath line leaks the query: ${line.trim()}`).not.toMatch(
                    /Astro\.url\.(search|href)|\.search\b/
                );
            }
        });
    }

    it('the destination detail page relies on the layout default (no canonical of its own)', () => {
        // Recorded because it is the WA-3 question the spec actually asked. If a
        // future change gives this page an explicit canonical, the loop above
        // still guards it — this assertion just documents today's shape.
        const src = readFileSync(resolve(PAGES_DIR, 'destinos/[...path].astro'), 'utf8');
        expect(canonicalPathLines(src)).toEqual([]);
    });
});
