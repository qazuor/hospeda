/**
 * @file compare-mode-controls-listing-pages.test.ts
 * @description Source-assertion tests verifying `CompareModeControls` (the
 * compare-mode toggle + explainer banner, HOS-85 T-005; entitlement-gate
 * post-review fix) is mounted next to `ListingPageHeader` on all six
 * accommodation listing pages, receives an `isAuthenticated` prop computed
 * from `Astro.locals.user`, and is NOT present on the corresponding
 * `/page/[page].astro` pagination rewrite shims (those only redirect/rewrite
 * to the parent listing — mounting the control there would be both redundant
 * and duplicate the island on the rendered page).
 *
 * Astro pages cannot be rendered in Vitest — we assert on source text, the
 * project's documented approach for `.astro` coverage.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGES_DIR = resolve(__dirname, '../../src/pages/[lang]');

/** The six accommodation listing pages that must mount CompareModeControls. */
const LISTING_PAGES = [
    'alojamientos/index.astro',
    'alojamientos/tipo/[type]/index.astro',
    'alojamientos/mapa.astro',
    'alojamientos/caracteristicas/[slug]/index.astro',
    'alojamientos/comodidades/[slug]/index.astro',
    'destinos/[slug]/alojamientos/index.astro'
] as const;

/**
 * The pagination rewrite shims for five of the six listing pages (mapa.astro
 * has no `/page/N/` segment — it is not paginated via URL segments). These
 * MUST NOT be touched: no ListingPageHeader, no CompareModeControls.
 */
const PAGINATION_SHIMS = [
    'alojamientos/page/[page].astro',
    'alojamientos/tipo/[type]/page/[page].astro',
    'alojamientos/caracteristicas/[slug]/page/[page].astro',
    'alojamientos/comodidades/[slug]/page/[page].astro',
    'destinos/[slug]/alojamientos/page/[page].astro'
] as const;

const readPage = (relativePath: string): string =>
    readFileSync(resolve(PAGES_DIR, relativePath), 'utf8');

describe('CompareModeControls mounted on all six accommodation listing pages (HOS-85 T-005)', () => {
    for (const pagePath of LISTING_PAGES) {
        describe(pagePath, () => {
            const src = readPage(pagePath);

            it('imports CompareModeControls', () => {
                expect(src).toContain(
                    "import CompareModeControls from '@/components/shared/compare/CompareModeControls.astro';"
                );
            });

            it('mounts CompareModeControls with slot="page-header", the locale prop, and the isAuthenticated prop', () => {
                expect(src).toMatch(
                    /<CompareModeControls\s+slot="page-header"\s+locale=\{locale\}\s+isAuthenticated=\{isAuthenticated\}\s*\/>/
                );
            });

            it('computes isAuthenticated from Astro.locals.user', () => {
                expect(src).toMatch(
                    /const isAuthenticated = (Boolean\(Astro\.locals\.user\)|!!Astro\.locals\.user);/
                );
            });

            it('mounts CompareModeControls after ListingPageHeader (same visual position across pages)', () => {
                const headerIdx = src.indexOf('<ListingPageHeader');
                const controlsIdx = src.indexOf('<CompareModeControls');
                expect(headerIdx).toBeGreaterThan(-1);
                expect(controlsIdx).toBeGreaterThan(-1);
                expect(controlsIdx).toBeGreaterThan(headerIdx);
            });
        });
    }
});

describe('Pagination rewrite shims stay untouched (HOS-85 T-005)', () => {
    for (const shimPath of PAGINATION_SHIMS) {
        describe(shimPath, () => {
            const src = readPage(shimPath);

            it('does not mount CompareModeControls', () => {
                expect(src).not.toContain('CompareModeControls');
            });

            it('does not mount ListingPageHeader (shim only rewrites to the parent listing)', () => {
                expect(src).not.toContain('ListingPageHeader');
            });
        });
    }
});
