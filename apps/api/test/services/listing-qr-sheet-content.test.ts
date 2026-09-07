/**
 * The copy and the destination of a listing's printable QR sheet (HOS-982).
 *
 * ---
 * WHAT THESE TESTS ARE ACTUALLY DEFENDING
 *
 * Two things, and the second is the one that costs money to get wrong.
 *
 * 1. **The copy comes from the locale files.** Asserted against LITERAL strings
 *    rather than against `trans[locale][key]`, on purpose: re-deriving the
 *    expectation with the very lookup under test passes whether the renderer
 *    reads i18n or hardcodes Spanish, which is the whole failure mode.
 *
 * 2. **The path segment of each vertical's public page.** This is the one value
 *    in the module that, if wrong, points every printed code at a 404 — and a
 *    printed code cannot be corrected. `apps/web/src/lib/seo/entity-public-urls.ts`
 *    is the web-side source of truth and lives in another app, so the API cannot
 *    import it. What it CAN do is tie itself to the other API-side copy of the
 *    same map: the brochure's `buildPublicListingUrl`, which HOS-1058 already
 *    pinned. Two independently-written copies asserted equal is not a proof, but
 *    it turns a silent divergence into a red test.
 *
 * @module test/services/listing-qr-sheet-content
 */

import { describe, expect, it } from 'vitest';
import { buildPublicListingUrl } from '../../src/services/commerce-brochure/brochure-content.js';
import {
    buildListingPublicUrl,
    buildListingQrSheetContent
} from '../../src/services/listing-qr-sheet/qr-sheet-content.js';

const SITE = 'https://hospeda.com.ar';

describe('where the printed code lands (HOS-982)', () => {
    it('agrees with the brochure on both commerce verticals, segment for segment', () => {
        for (const vertical of ['gastronomy', 'experience'] as const) {
            expect(
                buildListingPublicUrl({ vertical, slug: 'el-fogon', locale: 'es', siteUrl: SITE })
            ).toBe(
                buildPublicListingUrl({ vertical, slug: 'el-fogon', locale: 'es', siteUrl: SITE })
            );
        }
    });

    it('sends an accommodation to /alojamientos/, the segment the site actually serves', () => {
        // Spelled out rather than derived: the accommodation segment has no
        // second copy in the API to compare against, so the literal IS the
        // contract. `/alojamientos/` in every locale is the site's convention —
        // `/en/accommodations/x/` does not exist and 404s.
        expect(
            buildListingPublicUrl({
                vertical: 'accommodation',
                slug: 'cabana-del-rio',
                locale: 'en',
                siteUrl: SITE
            })
        ).toBe('https://hospeda.com.ar/en/alojamientos/cabana-del-rio/');
    });

    it('keeps the locale prefix and the trailing slash', () => {
        for (const locale of ['es', 'en', 'pt'] as const) {
            const url = buildListingPublicUrl({
                vertical: 'gastronomy',
                slug: 'el-fogon',
                locale,
                siteUrl: SITE
            });
            expect(url.startsWith(`${SITE}/${locale}/`)).toBe(true);
            expect(url.endsWith('/')).toBe(true);
        }
    });

    it('tolerates a trailing slash on the site URL rather than doubling it', () => {
        expect(
            buildListingPublicUrl({
                vertical: 'experience',
                slug: 'kayak',
                locale: 'es',
                siteUrl: 'https://hospeda.com.ar/'
            })
        ).toBe('https://hospeda.com.ar/es/experiencias/kayak/');
    });

    it('escapes a slug rather than letting it change the path', () => {
        expect(
            buildListingPublicUrl({
                vertical: 'gastronomy',
                slug: 'a/b',
                locale: 'es',
                siteUrl: SITE
            })
        ).toBe('https://hospeda.com.ar/es/gastronomia/a%2Fb/');
    });
});

describe('the sheet copy (HOS-982)', () => {
    function build(locale: 'es' | 'en' | 'pt') {
        return buildListingQrSheetContent({
            listingName: '  La Parrilla del Puerto  ',
            slug: 'la-parrilla-del-puerto',
            vertical: 'gastronomy',
            locale,
            siteUrl: SITE
        });
    }

    it('prints the headline in the reader’s language, not Spanish everywhere', () => {
        expect(build('es').headline).toBe('Escaneá el código');
        expect(build('en').headline).toBe('Scan the code');
        expect(build('pt').headline).toBe('Escaneie o código');
    });

    it('carries a real invitation and a real tagline in all three locales', () => {
        for (const locale of ['es', 'en', 'pt'] as const) {
            const content = build(locale);
            for (const line of [content.invite, content.brandTagline, content.headline]) {
                expect(line.length).toBeGreaterThan(10);
                // A locale file miss renders as this marker in the admin and as
                // the raw dotted key on the web. Neither belongs on paper.
                expect(line).not.toContain('MISSING');
                expect(line).not.toContain('common.qrSheet');
            }
        }
    });

    it('leaves the brand untranslated — it is a proper noun', () => {
        for (const locale of ['es', 'en', 'pt'] as const) {
            expect(build(locale).brand).toBe('Hospeda');
        }
    });

    it('trims the owner-typed name and keeps its accents', () => {
        expect(build('es').listingName).toBe('La Parrilla del Puerto');
        expect(
            buildListingQrSheetContent({
                listingName: 'Café Río Uruguay',
                slug: 'cafe-rio-uruguay',
                vertical: 'gastronomy',
                locale: 'es',
                siteUrl: SITE
            }).listingName
        ).toBe('Café Río Uruguay');
    });

    it('carries the ficha URL as the destination, for the route to mint the code with', () => {
        expect(build('es').url).toBe(
            'https://hospeda.com.ar/es/gastronomia/la-parrilla-del-puerto/'
        );
    });
});

/**
 * The finding this describe exists for: the FIRST downloader's language was
 * being minted into `qr_codes.targetUrl`, which is a creation-only column — so
 * a host browsing in English would have pinned every future scanner of that
 * door to the English page, permanently, and re-downloading in Spanish would
 * not have undone it.
 */
describe('the downloader’s language never reaches the minted destination (HOS-982)', () => {
    function urlFor(locale: 'es' | 'en' | 'pt'): string {
        return buildListingQrSheetContent({
            listingName: 'Cabaña del Río',
            slug: 'cabana-del-rio',
            vertical: 'accommodation',
            locale,
            siteUrl: SITE
        }).url;
    }

    it('mints the market’s locale whatever language the sheet is printed in', () => {
        for (const locale of ['es', 'en', 'pt'] as const) {
            expect(urlFor(locale)).toBe('https://hospeda.com.ar/es/alojamientos/cabana-del-rio/');
        }
    });

    it('is not vacuous: the same locales DO change the copy', () => {
        // Without this the assertion above would also pass if `locale` had been
        // dropped from the builder entirely, or if the fixture happened to
        // resolve to Spanish for every value.
        const headlines = (['es', 'en', 'pt'] as const).map(
            (locale) =>
                buildListingQrSheetContent({
                    listingName: 'Cabaña del Río',
                    slug: 'cabana-del-rio',
                    vertical: 'accommodation',
                    locale,
                    siteUrl: SITE
                }).headline
        );
        expect(new Set(headlines).size).toBe(3);
    });

    it('pins the destination in all three verticals, not just the one that was measured', () => {
        for (const vertical of ['accommodation', 'gastronomy', 'experience'] as const) {
            const english = buildListingQrSheetContent({
                listingName: 'El Fogón',
                slug: 'el-fogon',
                vertical,
                locale: 'en',
                siteUrl: SITE
            }).url;
            expect(english).toContain('/es/');
            expect(english).not.toContain('/en/');
        }
    });

    it('agrees with the builder called with the market locale by hand', () => {
        // Ties the pinned value to `buildListingPublicUrl` rather than to a
        // literal, so a change to the path shape cannot make one of the two
        // drift while this stays green.
        expect(urlFor('pt')).toBe(
            buildListingPublicUrl({
                vertical: 'accommodation',
                slug: 'cabana-del-rio',
                locale: 'es',
                siteUrl: SITE
            })
        );
    });
});
