/**
 * Turns a certificate into the HTTP response the browser saves (HOS-1057).
 *
 * ---
 * WHO MAY READ AN ISSUED CERTIFICATE — THE DECISION, WRITTEN DOWN
 *
 * **A certificate is readable ONLY by the owner of the experience that issued
 * it, over an authenticated request. There is no public certificate URL, and
 * that is a decision rather than an omission.**
 *
 * The issue asks for something the recipient can "descargar, imprimir o
 * compartir", and it is worth being precise about what that means here: what
 * gets shared is the PDF FILE. The provider issues it, hands it over — printed,
 * or as a file — and from there it travels the way a photo travels. It carries
 * the provider's name, the experience's name and a QR back to the experience's
 * public ficha, so the marketing loop the issue is actually about (every share
 * carries the provider and Hospeda with it) is closed by the artifact, not by a
 * URL.
 *
 * A public `/certificados/<token>` page would have bought one extra thing — a
 * link a recipient can post — and cost three:
 *
 *   1. **It publishes a named person.** The row holds somebody's full name and
 *      the day they were somewhere, typed by a third party who never asked
 *      them. Putting that behind a guessable-length token on the open internet
 *      is a data decision the owner has not made and this issue did not ask
 *      for.
 *   2. **It is a verification claim nothing backs.** A public certificate page
 *      reads as Hospeda attesting that this happened. Hospeda witnessed
 *      nothing: the provider typed a name into a box. The PDF can say "the
 *      provider certifies"; a hosted page under our domain says more than that
 *      whatever its copy claims.
 *   3. **It is not reversible.** A token that leaks cannot be un-leaked, while
 *      adding one later is an additive column and an additive route.
 *
 * So the surface is: the OWNER issues, lists and downloads, all behind
 * `requireEntitlement(ISSUE_EXPERIENCE_CERTIFICATE)` and an ownership check
 * that answers 404 rather than 403. If the owner later wants a public
 * verification page, that is HOS-work with a data decision attached, and this
 * module is where the reasoning it has to overturn lives.
 *
 * ## Why the file comes out of a route at all
 *
 * Same constraint HOS-1058 measured: several surfaces of the product block a
 * download the PAGE starts, so the bytes have to come from a route that returns
 * a file. The web client fetches this route WITH credentials — the API is a
 * different origin, so a plain `<a href="{API}/…">` travels without the session
 * cookie and saves a 401 to disk — and hands the resulting blob to the user.
 *
 * @module services/experience-certificate/certificate-response
 */

import type { CertificateContent } from './certificate-content.js';
import { renderCertificatePdf } from './certificate-render.js';

/**
 * Bytes a downloaded filename may carry.
 *
 * The recipient's name reaches this function already bounded and stripped of
 * control characters by `ExperienceCertificateRecipientNameSchema`, but
 * `Content-Disposition` is header-injection territory and the name is
 * provider-typed, so it is re-restricted here rather than trusted. Belt and
 * braces on the one string on this path that a person authored.
 */
const FILENAME_SAFE = /[^a-z0-9-]/g;

/** Prefix of every downloaded file. Not translated: it is a filename, not copy. */
const FILENAME_PREFIX = 'certificado';

/** Turns arbitrary text into a filename fragment. */
function toFilenameFragment(value: string): string {
    return (
        value
            .toLowerCase()
            // Decompose accents and drop the combining marks, so "Martín" becomes
            // "martin" rather than "mart-n".
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .replace(FILENAME_SAFE, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
    );
}

/**
 * Renders a certificate and wraps it in a downloadable response.
 *
 * @param input.content - The printable content.
 * @param input.recipientName - Who it was issued to, used for the filename.
 * @param input.qrUrl - What the QR encodes: the platform's own
 *   `{site}/qr/{qrSlug}/` redirect, resolved by the route (HOS-1129). NOT
 *   `content.publicUrl` — that is where the redirect lands, and a framed sheet
 *   is the least correctable surface the product prints on.
 * @returns A `Response` carrying `application/pdf`.
 */
export async function buildCertificateResponse(input: {
    content: CertificateContent;
    recipientName: string;
    qrUrl: string;
}): Promise<Response> {
    const pdf = await renderCertificatePdf({ content: input.content, qrUrl: input.qrUrl });

    const fragment = toFilenameFragment(input.recipientName);
    const filename = `${FILENAME_PREFIX}-${fragment || 'hospeda'}.pdf`;

    return new Response(pdf, {
        status: 200,
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': String(pdf.byteLength),
            // The sheet names a private individual and is regenerated from a row
            // the owner can correct. Nothing about it should sit in a shared
            // cache, and generation is cheap.
            'Cache-Control': 'private, no-store'
        }
    });
}
