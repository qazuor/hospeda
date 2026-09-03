/**
 * The provider QR's byte-identity contract (HOS-376, pinned by HOS-981).
 *
 * `host-trade-qr.ts` states its contract in prose: "the same slug must always
 * render the same image". Nothing enforced it. The existing route test
 * (`test/routes/host-trade/mine-qr.test.ts`) asserts the response contains
 * `<svg>` and the right slug, which stays green through a changed margin, a
 * changed error-correction level, or a changed colour — every parameter a
 * refactor of the renderer could plausibly move.
 *
 * So the hashes below are frozen against the output measured BEFORE HOS-981
 * moved the drawing into the shared engine. They are not a snapshot to be
 * regenerated when it breaks: a failure here means codes already printed on
 * vans and delivery notes no longer match what the platform now renders, which
 * is a production incident, not a stale fixture.
 *
 * @module test/utils/host-trade-qr-byte-identity
 */

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildHostTradeUsageUrl, renderHostTradeQrSvg } from '../../src/utils/host-trade-qr.js';

/**
 * SHA-256 of the SVG produced by the pre-HOS-981 implementation, measured on
 * 2026-09-02 against `QRCode.toString(url, { type: 'svg', margin: 4,
 * errorCorrectionLevel: 'M' })`.
 */
const FROZEN_RENDERS = [
    {
        slug: 'plomero-centro',
        siteUrl: 'https://hospeda.com.ar',
        sha256: '53a7615987a14cc265fa8e553c8aa6d8844a2d8c7da2996c01be1565fd244528',
        bytes: 2372
    },
    {
        // Trailing slash on the site URL: the same code, normalised.
        slug: 'electricista-norte',
        siteUrl: 'https://hospeda.com.ar/',
        sha256: 'b5eccbcd46f040139f5cf647b2f0e31cd07617526f126a25109a479f4ebe3319',
        bytes: 2828
    }
] as const;

function sha256(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
}

describe('renderHostTradeQrSvg — byte identity', () => {
    for (const frozen of FROZEN_RENDERS) {
        it(`renders '${frozen.slug}' byte-for-byte as it did before HOS-981`, async () => {
            const svg = await renderHostTradeQrSvg({
                slug: frozen.slug,
                siteUrl: frozen.siteUrl
            });

            expect(svg).toHaveLength(frozen.bytes);
            expect(sha256(svg)).toBe(frozen.sha256);
        });
    }

    it('renders the same bytes on every call', async () => {
        const input = { slug: 'plomero-centro', siteUrl: 'https://hospeda.com.ar' };

        const [first, second, third] = await Promise.all([
            renderHostTradeQrSvg(input),
            renderHostTradeQrSvg(input),
            renderHostTradeQrSvg(input)
        ]);

        expect(second).toBe(first);
        expect(third).toBe(first);
    });

    it('renders different bytes for a different slug', async () => {
        const a = await renderHostTradeQrSvg({
            slug: 'plomero-centro',
            siteUrl: 'https://hospeda.com.ar'
        });
        const b = await renderHostTradeQrSvg({
            slug: 'electricista-norte',
            siteUrl: 'https://hospeda.com.ar'
        });

        expect(a).not.toBe(b);
    });

    /**
     * The SVG must carry no `width`/`height`, only a `viewBox`. A fixed size
     * would break the property the format was chosen for — one string serving
     * the dashboard at screen size and the print stylesheet at sticker size.
     */
    it('emits a viewBox and no fixed dimensions', async () => {
        const svg = await renderHostTradeQrSvg({
            slug: 'plomero-centro',
            siteUrl: 'https://hospeda.com.ar'
        });

        expect(svg).toContain('viewBox="0 0 45 45"');
        expect(svg).not.toMatch(/<svg[^>]*\swidth=/);
        expect(svg).not.toMatch(/<svg[^>]*\sheight=/);
    });
});

describe('buildHostTradeUsageUrl', () => {
    it('builds the usage URL for a slug', () => {
        expect(
            buildHostTradeUsageUrl({ slug: 'plomero-centro', siteUrl: 'https://hospeda.com.ar' })
        ).toBe(
            'https://hospeda.com.ar/mi-cuenta/directorio-proveedores/plomero-centro/registrar-uso'
        );
    });

    it('tolerates a trailing slash on the site URL', () => {
        expect(
            buildHostTradeUsageUrl({ slug: 'plomero-centro', siteUrl: 'https://hospeda.com.ar/' })
        ).toBe(
            'https://hospeda.com.ar/mi-cuenta/directorio-proveedores/plomero-centro/registrar-uso'
        );
    });
});
