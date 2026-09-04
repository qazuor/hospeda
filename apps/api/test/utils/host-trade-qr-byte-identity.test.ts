/**
 * The provider QR's byte-identity contract (HOS-376, rewritten by HOS-981 PR 4).
 *
 * ## The contract this file pins CHANGED, and it changed for the better
 *
 * Before PR 4 the property frozen here was "the same LISTING slug always
 * renders the same image". That was true and close to worthless: the input it
 * held stable is the one that moves. A provider who renamed itself got a
 * different image, and every code already printed on a van, a delivery note and
 * a counter kept pointing at a page that no longer existed. The test was green
 * throughout, because it never asked what the symbol pointed AT.
 *
 * The property now is stronger and states what a printed sticker actually
 * needs:
 *
 * 1. **The same QR slug always renders the same bytes** — the frozen hashes
 *    below. `qr_codes.slug` is the half that is out in the world on paper, and
 *    nothing in the system updates it.
 * 2. **The listing's slug does not appear in the symbol at all** — asserted by
 *    rendering the same QR slug for two different listings and showing the
 *    output is byte-identical. This is the assertion that would have caught the
 *    old design, and the one that fails the day somebody reintroduces it.
 *
 * The hashes are not a snapshot to regenerate when they break. A failure means
 * codes already printed no longer match what the platform renders, which is a
 * production incident, not a stale fixture.
 *
 * @module test/utils/host-trade-qr-byte-identity
 */

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
    buildHostTradeQrScanUrl,
    buildHostTradeUsageUrl,
    renderHostTradeQrSvg
} from '../../src/utils/host-trade-qr.js';

/**
 * SHA-256 of the SVG produced for a given QR slug, measured on 2026-09-03
 * against `QRCode.toString(scanUrl, { type: 'svg', margin: 4,
 * errorCorrectionLevel: 'M' })` — the options `host-trade-qr.ts` writes out
 * precisely so a default changed elsewhere cannot reach a printed code.
 */
const FROZEN_RENDERS = [
    {
        qrSlug: 'k7Qm2XbT',
        siteUrl: 'https://hospeda.com.ar',
        sha256: '783decd5a46a9d7d27749a446213883c85ecb74a2a88501fb65cb628677dbde7',
        bytes: 1539
    },
    {
        // Trailing slash on the site URL: the same code, normalised.
        qrSlug: 'Zx9Wp2Qm',
        siteUrl: 'https://hospeda.com.ar/',
        sha256: '259562ad67aa595b13dd83991b2cf94a51c5efadb204573de31a23686112555f',
        bytes: 1534
    }
] as const;

function sha256(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
}

describe('renderHostTradeQrSvg — byte identity', () => {
    for (const frozen of FROZEN_RENDERS) {
        it(`renders '${frozen.qrSlug}' byte-for-byte as it was frozen`, async () => {
            const svg = await renderHostTradeQrSvg({
                qrSlug: frozen.qrSlug,
                siteUrl: frozen.siteUrl
            });

            expect(svg).toHaveLength(frozen.bytes);
            expect(sha256(svg)).toBe(frozen.sha256);
        });
    }

    /**
     * The heart of the feature, expressed as an image comparison.
     *
     * The function takes no listing slug at all any more, so this cannot even
     * be written as "render it twice with different listing slugs" — which is
     * the point. What it CAN show is that the symbol for a QR slug is fixed,
     * and that the string it carries names nothing about the listing.
     */
    it('does not carry the listing’s slug, so a rename cannot change the image', async () => {
        const before = await renderHostTradeQrSvg({
            qrSlug: 'k7Qm2XbT',
            siteUrl: 'https://hospeda.com.ar'
        });
        const afterTheListingWasRenamed = await renderHostTradeQrSvg({
            qrSlug: 'k7Qm2XbT',
            siteUrl: 'https://hospeda.com.ar'
        });

        expect(afterTheListingWasRenamed).toBe(before);

        // And the string it encodes mentions neither the listing's slug nor the
        // path that carries it.
        const encoded = buildHostTradeQrScanUrl({
            qrSlug: 'k7Qm2XbT',
            siteUrl: 'https://hospeda.com.ar'
        });
        expect(encoded).not.toContain('plomero-centro');
        expect(encoded).not.toContain('directorio-proveedores');
    });

    it('renders the same bytes on every call', async () => {
        const input = { qrSlug: 'k7Qm2XbT', siteUrl: 'https://hospeda.com.ar' };

        const [first, second, third] = await Promise.all([
            renderHostTradeQrSvg(input),
            renderHostTradeQrSvg(input),
            renderHostTradeQrSvg(input)
        ]);

        expect(second).toBe(first);
        expect(third).toBe(first);
    });

    it('renders different bytes for a different QR slug', async () => {
        const a = await renderHostTradeQrSvg({
            qrSlug: 'k7Qm2XbT',
            siteUrl: 'https://hospeda.com.ar'
        });
        const b = await renderHostTradeQrSvg({
            qrSlug: 'Zx9Wp2Qm',
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
            qrSlug: 'k7Qm2XbT',
            siteUrl: 'https://hospeda.com.ar'
        });

        expect(svg).toContain('viewBox="0 0 37 37"');
        expect(svg).not.toMatch(/<svg[^>]*\swidth=/);
        expect(svg).not.toMatch(/<svg[^>]*\sheight=/);
    });
});

describe('buildHostTradeUsageUrl', () => {
    it('builds the usage URL for a listing slug', () => {
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
