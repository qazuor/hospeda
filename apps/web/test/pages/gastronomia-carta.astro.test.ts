/**
 * @file gastronomia-carta.astro.test.ts
 * @description HOS-1044 G-1 — structural verification of the dedicated public
 * menu page `/{lang}/gastronomia/{slug}/carta/`.
 *
 * Astro pages cannot be rendered through Vitest/jsdom (see
 * `alojamientos-fotos-gallery.test.ts`), so every assertion operates on the
 * raw source text of the page.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const CARTA_PATH = resolve(__dirname, '../../src/pages/[lang]/gastronomia/[slug]/carta.astro');
const LISTING_PATH = resolve(__dirname, '../../src/pages/[lang]/gastronomia/[slug].astro');

const cartaSrc = readFileSync(CARTA_PATH, 'utf8');
const listingSrc = readFileSync(LISTING_PATH, 'utf8');

// ---------------------------------------------------------------------------
// 1. RENDERING MODE — SSR, mirrors the listing
// ---------------------------------------------------------------------------
describe('carta.astro — rendering mode', () => {
    it('is SSR (prerender = false)', () => {
        expect(cartaSrc).toContain('export const prerender = false');
    });

    it('does NOT export getStaticPaths (not SSG)', () => {
        expect(cartaSrc).not.toContain('getStaticPaths');
    });
});

// ---------------------------------------------------------------------------
// 2. 404 GUARDS (AC-1)
// ---------------------------------------------------------------------------
describe('carta.astro — 404 guards', () => {
    it('guards against a missing slug param with a 404', () => {
        expect(cartaSrc).toContain('status: 404');
        expect(cartaSrc).toContain('!slug');
    });

    it('404s (or propagates 410) when the API lookup fails, same as the listing', () => {
        expect(cartaSrc).toContain('!result.ok');
        expect(cartaSrc).toContain('result.error.status === 410 ? 410 : 404');
    });

    it('404s a non-PUBLIC visibility, same rule as the listing', () => {
        expect(cartaSrc).toContain("visibility !== 'PUBLIC'");
    });

    it('404s a venue with no menu content at all (neither carta nor file)', () => {
        expect(cartaSrc).toContain('hasMenuContent');
        expect(cartaSrc).toMatch(/menuSections\?\.length\s*\?\?\s*0\)\s*>\s*0/);
        expect(cartaSrc).toContain('gastronomy.menuFileUrl && gastronomy.menuFileKind');
        expect(cartaSrc).toMatch(
            /if\s*\(!hasMenuContent\)\s*\{\s*\n\s*return new Response\(null, \{ status: 404 \}\);/
        );
    });
});

// ---------------------------------------------------------------------------
// 3. REUSES GastronomyMenu.astro — never reimplements the carta render (NG)
// ---------------------------------------------------------------------------
describe('carta.astro — reuses GastronomyMenu.astro verbatim', () => {
    it('imports GastronomyMenu from the shared component', () => {
        expect(cartaSrc).toContain(
            "import GastronomyMenu from '@/components/gastronomy/GastronomyMenu.astro'"
        );
    });

    it('mounts GastronomyMenu with the same props the listing forwards to it', () => {
        expect(cartaSrc).toContain('<GastronomyMenu');
        expect(cartaSrc).toContain('menuSections={gastronomy.menuSections}');
        expect(cartaSrc).toContain('fileUrl={gastronomy.menuFileUrl}');
        expect(cartaSrc).toContain('fileKind={gastronomy.menuFileKind}');
    });

    it('does NOT re-declare menu section/item markup of its own', () => {
        // The carta section markup (`.gastro-menu__section`, dish list, etc.)
        // belongs to GastronomyMenu.astro alone — this page must not fork it.
        expect(cartaSrc).not.toContain('gastro-menu__section');
        expect(cartaSrc).not.toContain('gastro-menu__item');
    });
});

// ---------------------------------------------------------------------------
// 4. NO QR / ENTITLEMENT LOGIC (NG-1, out of scope for this page)
// ---------------------------------------------------------------------------
describe('carta.astro — stays out of QR and entitlement scope', () => {
    it('never imports the qrcode engine', () => {
        expect(cartaSrc).not.toMatch(/from ['"]qrcode['"]/);
    });

    it('never calls the QR service or mints a code on this read path', () => {
        expect(cartaSrc).not.toContain('qrCodeService');
        expect(cartaSrc).not.toContain('getOrCreateForEntity');
        expect(cartaSrc).not.toContain('QrCodePurposeEnum');
    });

    it('never references an entitlement gate', () => {
        expect(cartaSrc).not.toContain('requireEntitlement');
        expect(cartaSrc).not.toContain('EntitlementKey');
        expect(cartaSrc).not.toContain('commerceVerticalEntitlementMiddleware');
    });
});

// ---------------------------------------------------------------------------
// 5. SEO — canonical points at the LISTING, noindex, no self-JSON-LD
// ---------------------------------------------------------------------------
describe('carta.astro — SEO (canonical to listing, noindex, out of sitemap by construction)', () => {
    it('passes noindex to DetailLayout', () => {
        expect(cartaSrc).toContain('noindex={true}');
    });

    it('builds the canonical path from the LISTING url, not its own route', () => {
        expect(cartaSrc).toContain('canonicalPath={listingUrl}');
        expect(cartaSrc).toMatch(/const listingPath = `gastronomia\/\$\{gastronomy\.slug\}`/);
        expect(cartaSrc).toContain('buildUrl({ locale, path: listingPath })');
    });

    it('links back to the full listing', () => {
        expect(cartaSrc).toContain('href={listingUrl}');
    });
});

// ---------------------------------------------------------------------------
// 6. EDGE CACHEABILITY — mirrors the listing's own tags (HOS-369 W2-4 pattern)
// ---------------------------------------------------------------------------
describe('carta.astro — cache headers mirror the listing', () => {
    it('imports and calls applyCacheHeaders, same as the listing', () => {
        expect(cartaSrc).toContain(
            "import { applyCacheHeaders } from '@/lib/cache/response-cache'"
        );
        expect(cartaSrc).toContain('applyCacheHeaders({');
        expect(listingSrc).toContain('applyCacheHeaders({');
    });

    it('builds entity cache tags scoped to this gastronomy entity', () => {
        expect(cartaSrc).toContain("entity: 'gastronomy'");
        expect(cartaSrc).toContain('buildEntityCacheTags');
    });

    it('does NOT purge by the collection-wide list tag as the primary tag (detail page, not a listing)', () => {
        // Same reasoning as the listing: CACHE_TAG_COLLECTIONS.gastronomy is only
        // the fallback when no entity tag resolves, never the primary tag.
        expect(cartaSrc).toContain('CACHE_TAG_COLLECTIONS.gastronomy');
        expect(cartaSrc).toContain("cacheClass: 'detail'");
    });
});

// ---------------------------------------------------------------------------
// 7. i18n — no hardcoded visible strings
// ---------------------------------------------------------------------------
describe('carta.astro — copy goes through @repo/i18n', () => {
    it('uses createTranslations, not literal Spanish copy', () => {
        expect(cartaSrc).toContain("import { createTranslations } from '@/lib/i18n'");
        expect(cartaSrc).toContain("t('gastronomy.detail.menuCarta.title'");
        expect(cartaSrc).toContain("t('gastronomy.detail.menuCarta.backToListing'");
    });
});
