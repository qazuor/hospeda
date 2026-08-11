/**
 * @fileoverview The provider's static QR (HOS-376 T-029).
 *
 * The QR carries a URL and nothing else — no token, no row, no expiry. What the
 * tests below pin is the consequence of that choice: the same slug must always
 * produce the same image, because the code is printed on a sticker, a van and a
 * delivery note, and a QR that changed between renders would leave the printed
 * ones pointing nowhere.
 */
import { describe, expect, it } from 'vitest';
import { buildHostTradeUsageUrl, renderHostTradeQrSvg } from '../../src/utils/host-trade-qr';

const SITE = 'https://hospeda.com.ar';

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
        const svg = await renderHostTradeQrSvg({ slug: 'plomero-centro', siteUrl: SITE });

        expect(svg).toContain('<svg');
        expect(svg).toContain('</svg>');
    });

    /**
     * The static QR's whole premise: printed once, valid forever. Two renders
     * of the same slug have to be byte-identical, or a reprint would not match
     * the sticker already on the van.
     */
    it('is deterministic for the same slug', async () => {
        const first = await renderHostTradeQrSvg({ slug: 'plomero-centro', siteUrl: SITE });
        const second = await renderHostTradeQrSvg({ slug: 'plomero-centro', siteUrl: SITE });

        expect(first).toBe(second);
    });

    it('encodes a different image for a different slug', async () => {
        const one = await renderHostTradeQrSvg({ slug: 'plomero-centro', siteUrl: SITE });
        const other = await renderHostTradeQrSvg({ slug: 'electricista-norte', siteUrl: SITE });

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
        const svg = await renderHostTradeQrSvg({ slug: 'plomero-centro', siteUrl: SITE });

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
