import { QrCodeErrorCorrectionLevelEnum } from '@repo/schemas';
import { renderQrSvg } from './qr-render.js';

/**
 * The provider's static usage QR (HOS-376 §6.2a, T-029).
 *
 * There is no table here, no token and no expiry, and that is the design rather
 * than a shortcut. The code encodes a plain URL carrying the listing's slug,
 * which is already UNIQUE, and the host who scans it is identified by his own
 * session — so the QR needs to prove nothing. What it buys is that the sticker
 * on a van, the one on a delivery note and the one on the provider's phone are
 * the same code, printed once, valid forever.
 *
 * The cost of that is the constraint every function here works under: the same
 * slug must always render the same image. Nothing in this module may depend on
 * the clock, on randomness, or on anything a redeploy could change.
 *
 * Since HOS-981 the drawing itself is delegated to the shared engine in
 * `./qr-render.js`. The options below are the SAME values the engine would
 * default to; they stay written out here because this module's contract is that
 * its output never moves, and a code already printed on a van must not change
 * because someone later changed a default somewhere else.
 */

/** Quiet zone, in modules, around the symbol. */
const QR_MARGIN = 4;

/**
 * Error-correction level.
 *
 * `M` (~15% recoverable) rather than `L`: these codes end up on stickers that
 * get scuffed, on paper that gets folded, and photographed at an angle in bad
 * light. The extra modules cost print area, which is cheap; a code that stops
 * scanning once it is dirty costs the declaration the whole channel exists for.
 */
const QR_ERROR_CORRECTION = QrCodeErrorCorrectionLevelEnum.M;

/** Path the QR sends a host to, relative to the site root. */
const USAGE_PATH_PREFIX = '/mi-cuenta/directorio-proveedores';
const USAGE_PATH_SUFFIX = 'registrar-uso';

/**
 * Builds the URL a provider's QR encodes.
 *
 * @param input.slug - The listing's UNIQUE slug.
 * @param input.siteUrl - Public base URL of the web app (`HOSPEDA_SITE_URL`).
 *   A trailing slash is tolerated.
 * @returns The absolute URL of the usage-registration page.
 */
export function buildHostTradeUsageUrl(input: { slug: string; siteUrl: string }): string {
    const base = input.siteUrl.replace(/\/$/, '');
    // The slug is slug-shaped by construction, so this encodes nothing today.
    // It is here so that a value carrying `?` or `#` truncates into a 404
    // rather than into a different page than the one intended.
    const slug = encodeURIComponent(input.slug);
    return `${base}${USAGE_PATH_PREFIX}/${slug}/${USAGE_PATH_SUFFIX}`;
}

/**
 * Renders the provider's QR as an SVG document.
 *
 * SVG rather than a raster: the same string serves the dashboard at screen size
 * and the print stylesheet at sticker size, and a QR is the one image where
 * resampling costs scans.
 *
 * @param input.slug - The listing's UNIQUE slug.
 * @param input.siteUrl - Public base URL of the web app (`HOSPEDA_SITE_URL`).
 * @returns The SVG markup, byte-identical for a given slug and site URL.
 */
export async function renderHostTradeQrSvg(input: {
    slug: string;
    siteUrl: string;
}): Promise<string> {
    return renderQrSvg({
        data: buildHostTradeUsageUrl(input),
        options: {
            margin: QR_MARGIN,
            errorCorrectionLevel: QR_ERROR_CORRECTION
        }
    });
}
