/**
 * Turns brochure content into the HTTP response the browser saves (HOS-1058).
 *
 * ---
 * WHY THE FILE COMES OUT OF A SERVER ROUTE
 *
 * HOS-1058's one hard technical constraint: several surfaces of the product
 * block a download the PAGE starts, so the bytes have to come from a route that
 * returns a file. That is what this module produces — a real
 * `application/pdf` body with a `Content-Disposition`, generated server-side
 * from the listing's public projection.
 *
 * The browser still needs one local step to hand the file to the user, because
 * the API is a different origin and a plain `<a href="{API}/…">` would travel
 * without the session cookie and save a 401 to disk — measured on this exact
 * shape in HOS-376, and documented in `ProviderQrPanel.client.tsx`. So the web
 * client fetches this route WITH credentials and hands the resulting blob to
 * the user. What HOS-1058 forbids is a PDF assembled in the page; the file this
 * route returns is assembled here.
 *
 * @module services/commerce-brochure/brochure-response
 */

import type { BrochureContent } from './brochure-content.js';
import { loadBrochureCover } from './brochure-cover.js';
import { renderBrochurePdf } from './brochure-render.js';

/**
 * Bytes a downloaded filename may carry.
 *
 * A listing name reaches this function as a slug, but the value is
 * attacker-influenced in principle and `Content-Disposition` is header-injection
 * territory, so it is re-restricted here rather than trusted.
 */
const FILENAME_SAFE = /[^a-z0-9-]/g;

/** Prefix of every downloaded file. Not translated: it is a filename, not copy. */
const FILENAME_PREFIX = 'ficha';

/**
 * Renders a brochure and wraps it in a downloadable response.
 *
 * @param input.content - The printable content, already built from the
 *   listing's PUBLIC projection.
 * @param input.slug - The listing slug, used for the download filename.
 * @param input.qrUrl - What the QR encodes: the platform's own
 *   `{site}/qr/{qrSlug}/` redirect, resolved by the route (HOS-1129). NOT
 *   `content.url` — that is the destination, and printing it into the symbol is
 *   what made the sheet uncorrectable and its scans uncountable.
 * @returns A `Response` carrying `application/pdf`.
 */
export async function buildBrochureResponse(input: {
    content: BrochureContent;
    slug: string;
    qrUrl: string;
}): Promise<Response> {
    const cover = await loadBrochureCover({ url: input.content.coverImageUrl });
    const pdf = await renderBrochurePdf({ content: input.content, cover, qrUrl: input.qrUrl });

    const safeSlug = input.slug.toLowerCase().replace(FILENAME_SAFE, '-').replace(/-+/g, '-');
    const filename = `${FILENAME_PREFIX}-${safeSlug || 'hospeda'}.pdf`;

    return new Response(pdf, {
        status: 200,
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': String(pdf.byteLength),
            // The sheet is derived from a listing the owner can edit at any
            // moment, and it is the artifact that ends up photocopied. A stale
            // cached copy is worse than a regenerated one, and generation is
            // cheap.
            'Cache-Control': 'private, no-store'
        }
    });
}
