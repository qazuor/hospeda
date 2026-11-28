/**
 * The Hospeda isotipo as a PNG for the receipt header (HOS-2682).
 *
 * The artwork is the owner's vector isotipo the QR codes already paint
 * (`utils/qr-hospeda-isotipo.ts`), rasterised with the same `resvg` the QR
 * renderer uses, so the receipt and the QR codes can never show different
 * marks. Nothing is read from disk: the API ships as one bundle with no loose
 * assets.
 *
 * Rasterised once per process and reused: the bytes depend on nothing but the
 * constant artwork, and `resvg` is deterministic, so every receipt embeds the
 * same image and the PDF stays byte-stable.
 *
 * @module services/payment-receipt/receipt-logo
 */

import { Resvg } from '@resvg/resvg-js';
import {
    HOSPEDA_ISOTIPO_MARKUP,
    HOSPEDA_ISOTIPO_VIEWBOX_ATTRIBUTE
} from '../../utils/qr-hospeda-isotipo.js';

/** Pixel size of the rasterised mark: sharp at the ~46pt it is drawn, even printed. */
const LOGO_PIXELS = 384;

let cached: Uint8Array | undefined;

/**
 * Returns the isotipo as PNG bytes, rasterising it on first use.
 *
 * @returns A square, transparent-background PNG of the isotipo.
 */
export function getReceiptLogoPng(): Uint8Array {
    if (!cached) {
        const svg =
            `<svg xmlns="http://www.w3.org/2000/svg" width="${LOGO_PIXELS}" ` +
            `height="${LOGO_PIXELS}" viewBox="${HOSPEDA_ISOTIPO_VIEWBOX_ATTRIBUTE}">` +
            `${HOSPEDA_ISOTIPO_MARKUP}</svg>`;
        cached = new Uint8Array(
            new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng()
        );
    }
    return cached;
}
