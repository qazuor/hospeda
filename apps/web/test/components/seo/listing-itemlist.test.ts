/**
 * @file listing-itemlist.test.ts
 * @description Source-based tests verifying every entity listing wires the
 * reusable ItemListJsonLd component (instead of an inline JSON-LD object or a
 * raw <script set:html>). Astro components cannot be rendered in Vitest, so we
 * assert on page source (the project's documented approach for .astro coverage).
 *
 * SPEC-157 follow-up: extend ItemList JSON-LD from accommodations to events,
 * destinations, and posts via a single component routed through JsonLd
 * (decision D-1, single canonical JSON-LD path).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGES_DIR = resolve(__dirname, '../../../src/pages/[lang]');

/** Listing pages that must render an ItemList JSON-LD via ItemListJsonLd. */
const LISTINGS = [
    'alojamientos/index.astro',
    'eventos/index.astro',
    'destinos/index.astro',
    'publicaciones/index.astro'
] as const;

describe('listings render ItemList JSON-LD via ItemListJsonLd (SPEC-157 follow-up)', () => {
    for (const page of LISTINGS) {
        const src = readFileSync(resolve(PAGES_DIR, page), 'utf8');

        it(`${page} imports ItemListJsonLd`, () => {
            expect(src).toContain(
                "import ItemListJsonLd from '@/components/seo/ItemListJsonLd.astro'"
            );
        });

        it(`${page} mounts ItemListJsonLd in the head-extra slot`, () => {
            expect(src).toMatch(/<ItemListJsonLd[\s\S]*?slot="head-extra"/);
        });

        it(`${page} does NOT inline a raw <script set:html> JSON-LD block`, () => {
            // Inline JSON-LD must route through JsonLd's escaping; a bare
            // <script type="application/ld+json"> in the page would bypass it.
            expect(src).not.toContain('application/ld+json');
        });
    }
});
