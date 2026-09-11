/**
 * Turns QR-sheet content into the HTTP response the browser saves (HOS-982).
 *
 * ---
 * WHY THE FILE COMES OUT OF A SERVER ROUTE
 *
 * Same constraint the brochure hit (HOS-1058): several surfaces of the product
 * block a download the PAGE starts, so the bytes have to come from a route that
 * returns a file. The browser still needs one local step to hand the file to the
 * user, because the API is a different origin and a plain `<a href="{API}/…">`
 * would travel without the session cookie and save a 401 to disk — measured on
 * this exact shape in HOS-376. So the web client (PR 2) fetches this route WITH
 * credentials and hands the resulting blob to the user.
 *
 * @module services/listing-qr-sheet/qr-sheet-response
 */

import type { ListingQrSheetContent } from './qr-sheet-content.js';
import { renderListingQrSheetPdf } from './qr-sheet-render.js';

/**
 * Bytes a downloaded filename may carry.
 *
 * The value reaches this function as a slug, but it is attacker-influenced in
 * principle and `Content-Disposition` is header-injection territory, so it is
 * re-restricted here rather than trusted.
 */
const FILENAME_SAFE = /[^a-z0-9-]/g;

/** Prefix of every downloaded file. Not translated: it is a filename, not copy. */
const FILENAME_PREFIX = 'qr';

/**
 * Renders the sheet and wraps it in a downloadable response.
 *
 * @param input - Input parameters.
 * @param input.content - The printable copy, already built for the locale.
 * @param input.slug - The listing slug, used for the download filename.
 * @param input.qrUrl - What the QR encodes: the platform's own
 *   `{site}/qr/{qrSlug}/` redirect, resolved by the route. NOT `content.url` —
 *   that is the destination, and printing it into the symbol is what makes a
 *   sheet uncorrectable and its scans uncountable.
 * @returns A `Response` carrying `application/pdf`.
 */
export async function buildListingQrSheetResponse(input: {
    readonly content: ListingQrSheetContent;
    readonly slug: string;
    readonly qrUrl: string;
}): Promise<Response> {
    const pdf = await renderListingQrSheetPdf({ content: input.content, qrUrl: input.qrUrl });

    const safeSlug = input.slug.toLowerCase().replace(FILENAME_SAFE, '-').replace(/-+/g, '-');
    const filename = `${FILENAME_PREFIX}-${safeSlug || 'hospeda'}.pdf`;

    return new Response(pdf, {
        status: 200,
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': String(pdf.byteLength),
            // The sheet carries the listing's name, which its owner can change
            // at any moment, and it is the artifact that ends up photocopied. A
            // stale cached copy is worse than a regenerated one, and generation
            // is cheap: no photo is fetched and no image is embedded.
            'Cache-Control': 'private, no-store'
        }
    });
}
