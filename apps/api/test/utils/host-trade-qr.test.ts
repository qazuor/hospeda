/**
 * @fileoverview The provider QR's two URLs (HOS-376 T-029, HOS-981 PR 4).
 *
 * Until HOS-981 PR 4 there was one URL and the symbol drew it. There are now
 * two, and telling them apart is the whole point of the change:
 *
 * - `buildHostTradeQrScanUrl` is what the SYMBOL encodes — the platform's own
 *   redirect, `/qr/{qrSlug}/`, whose slug nothing ever updates.
 * - `buildHostTradeUsageUrl` is where that redirect LANDS — the
 *   usage-registration page, which carries the listing's slug and therefore
 *   moves whenever the listing is renamed.
 *
 * Drawing the second one is what made a rename break every sticker already in
 * the field, so the assertions below do not stop at "an SVG came back": they
 * pin WHICH string was drawn, by rendering the expected data through the shared
 * engine and comparing bytes.
 */
import { QrCodeErrorCorrectionLevelEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    buildHostTradeQrScanUrl,
    buildHostTradeUsageUrl,
    renderHostTradeQrSvg
} from '../../src/utils/host-trade-qr';
import { renderQrSvg } from '../../src/utils/qr-render';

const SITE = 'https://hospeda.com.ar';
const QR_SLUG = 'k7Qm2XbT';

/** The engine options `host-trade-qr.ts` states as its frozen contract. */
const ENGINE_OPTIONS = {
    margin: 4,
    errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum.M
};

describe('buildHostTradeQrScanUrl', () => {
    /**
     * `apps/web` runs with `trailingSlash: 'always'`, so the slash-less form
     * costs every scan a redirect before the redirect the code exists for — and
     * on a printed code that hop can never be taken back.
     */
    it('points at the platform’s own redirect, with the trailing slash', () => {
        expect(buildHostTradeQrScanUrl({ qrSlug: QR_SLUG, siteUrl: SITE })).toBe(
            'https://hospeda.com.ar/qr/k7Qm2XbT/'
        );
    });

    it('does not double the slash when the site URL carries a trailing one', () => {
        expect(buildHostTradeQrScanUrl({ qrSlug: QR_SLUG, siteUrl: `${SITE}/` })).toBe(
            'https://hospeda.com.ar/qr/k7Qm2XbT/'
        );
    });

    /**
     * The route is language-neutral by design: a locale set in ink would choose
     * permanently what language every future scanner reads the site in.
     */
    it('carries no locale segment', () => {
        const url = buildHostTradeQrScanUrl({ qrSlug: QR_SLUG, siteUrl: SITE });

        expect(new URL(url).pathname).toBe('/qr/k7Qm2XbT/');
    });

    it('encodes a slug that would otherwise change the URL’s shape', () => {
        expect(buildHostTradeQrScanUrl({ qrSlug: 'a?b#c', siteUrl: SITE })).toBe(
            'https://hospeda.com.ar/qr/a%3Fb%23c/'
        );
    });
});

describe('buildHostTradeUsageUrl', () => {
    it('points at the provider’s usage-registration page', () => {
        expect(buildHostTradeUsageUrl({ slug: 'plomero-centro', siteUrl: SITE })).toBe(
            'https://hospeda.com.ar/mi-cuenta/directorio-proveedores/plomero-centro/registrar-uso'
        );
    });

    it('does not double the slash when the site URL carries a trailing one', () => {
        expect(buildHostTradeUsageUrl({ slug: 'plomero-centro', siteUrl: `${SITE}/` })).toBe(
            'https://hospeda.com.ar/mi-cuenta/directorio-proveedores/plomero-centro/registrar-uso'
        );
    });

    /**
     * The slug is UNIQUE and slug-shaped, so this encodes nothing in practice.
     * It is here because the day something else reaches this function, a slug
     * carrying `?` or `#` would silently truncate the path rather than 404.
     */
    it('encodes a slug that would otherwise change the URL’s shape', () => {
        expect(buildHostTradeUsageUrl({ slug: 'a?b#c', siteUrl: SITE })).toBe(
            'https://hospeda.com.ar/mi-cuenta/directorio-proveedores/a%3Fb%23c/registrar-uso'
        );
    });
});

describe('renderHostTradeQrSvg', () => {
    it('returns an SVG document', async () => {
        const svg = await renderHostTradeQrSvg({ qrSlug: QR_SLUG, siteUrl: SITE });

        expect(svg).toContain('<svg');
        expect(svg).toContain('</svg>');
    });

    /**
     * The assertion this file exists for.
     *
     * A QR is a bitmap of modules — nothing in the markup spells out the string
     * it carries — so "does it encode the right URL?" cannot be asked of the
     * output directly. It CAN be answered by drawing the expected string
     * through the same engine with the same options and comparing bytes, which
     * is what makes this fail the moment the renderer is handed anything else.
     */
    it('draws the /qr/ redirect, not the usage-registration URL', async () => {
        const svg = await renderHostTradeQrSvg({ qrSlug: QR_SLUG, siteUrl: SITE });

        const expected = await renderQrSvg({
            data: 'https://hospeda.com.ar/qr/k7Qm2XbT/',
            options: ENGINE_OPTIONS
        });
        const usagePageDrawing = await renderQrSvg({
            data: buildHostTradeUsageUrl({ slug: 'plomero-centro', siteUrl: SITE }),
            options: ENGINE_OPTIONS
        });

        expect(svg).toBe(expected);
        expect(svg).not.toBe(usagePageDrawing);
    });

    it('is deterministic for the same QR slug', async () => {
        const first = await renderHostTradeQrSvg({ qrSlug: QR_SLUG, siteUrl: SITE });
        const second = await renderHostTradeQrSvg({ qrSlug: QR_SLUG, siteUrl: SITE });

        expect(first).toBe(second);
    });

    it('encodes a different image for a different QR slug', async () => {
        const one = await renderHostTradeQrSvg({ qrSlug: QR_SLUG, siteUrl: SITE });
        const other = await renderHostTradeQrSvg({ qrSlug: 'Zx9Wp2Qm', siteUrl: SITE });

        expect(one).not.toBe(other);
    });

    /**
     * A QR printed flush against its background is decoration: readers need the
     * quiet zone the format requires, or they fail on a busy sticker.
     *
     * Asserted by MEASURING it — the dark path's first coordinate is where the
     * symbol starts, so it must sit at least a margin in from the origin. A
     * weaker check (that a square viewBox exists) is equally true with no
     * margin at all, and pins nothing.
     */
    it('keeps a quiet zone around the symbol', async () => {
        const svg = await renderHostTradeQrSvg({ qrSlug: QR_SLUG, siteUrl: SITE });

        const darkPath = svg.match(/<path stroke="#000000" d="([^"]+)"/)?.[1];
        expect(darkPath).toBeDefined();

        const starts = [...(darkPath as string).matchAll(/M(\d+(?:\.\d+)?) (\d+(?:\.\d+)?)/g)];
        expect(starts.length).toBeGreaterThan(0);

        const minX = Math.min(...starts.map((m) => Number(m[1])));
        const minY = Math.min(...starts.map((m) => Number(m[2])));
        expect(minX).toBeGreaterThanOrEqual(4);
        expect(minY).toBeGreaterThanOrEqual(4);
    });
});
