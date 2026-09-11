import { QrCodeErrorCorrectionLevelEnum } from '@repo/schemas';
import { buildHostTradeUsageUrl } from '@repo/service-core';
import { buildQrScanUrl } from './entity-qr.js';
import { renderQrSvg } from './qr-render.js';

/**
 * The provider's printable QR (HOS-376 §6.2a, HOS-981 PR 4).
 *
 * ## What changed, and why the old design had to go
 *
 * Until HOS-981 PR 4 this module drew the usage-registration URL directly, so
 * the sticker on a van encoded `…/directorio-proveedores/{listingSlug}/…`. That
 * made the printed code a hostage of a mutable field: rename the listing and
 * every code already in the field points at a page that no longer exists, with
 * nothing to correct — ink is not editable.
 *
 * Now the code draws `{siteUrl}/qr/{qrSlug}/`, an identifier the platform owns
 * and resolves with a 302 to a row it can edit. Two things follow, and both are
 * improvements on the old contract rather than compromises:
 *
 * 1. The image is stable across a listing RENAME, because it depends on the QR's
 *    slug, which nothing updates. The old contract — "the same listing slug
 *    always renders the same image" — was true and useless: the input it held
 *    stable was the one that moves.
 * 2. The scan becomes countable, because it now passes through us.
 *
 * The usage-registration route is untouched. It stopped being what the QR
 * encodes and became where the redirect lands.
 *
 * ## What has NOT changed
 *
 * Determinism. Nothing here may read the clock, call a random source, or depend
 * on anything a redeploy could move: the same QR slug must draw the same bytes
 * forever, or a reprint stops matching the sticker beside it. The two options
 * below are the SAME values the shared engine would default to, written out
 * because this module's contract is that its output never moves and a default
 * changed elsewhere must not reach a code already on a van.
 *
 * @module utils/host-trade-qr
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

/**
 * Re-exported so `apps/api` keeps one import site for the provider QR's two
 * URLs. The builder itself lives in `@repo/service-core` because
 * `HostTradeService` rebuilds the same string when a listing is renamed, and
 * two spellings of that path would diverge into a silent 404.
 */
export { buildHostTradeUsageUrl };

/**
 * Builds the URL the QR actually encodes.
 *
 * A thin alias over {@link buildQrScanUrl} since HOS-1129, which gave the
 * brochure and the certificate the same redirect. The path itself is spelled
 * once, in `utils/entity-qr.ts`: a second spelling would not fail anywhere —
 * it would quietly start sending one family of already-printed codes to a 404.
 * The name survives so the provider's call sites still say which code they
 * mean.
 *
 * @param input - Input parameters.
 * @param input.qrSlug - The QR CODE's slug (`qr_codes.slug`), not the listing's.
 * @param input.siteUrl - Public base URL of the web app (`HOSPEDA_SITE_URL`).
 *   A trailing slash is tolerated.
 * @returns The absolute URL encoded in the symbol.
 */
export function buildHostTradeQrScanUrl(input: {
    readonly qrSlug: string;
    readonly siteUrl: string;
}): string {
    return buildQrScanUrl(input);
}

/**
 * Renders the provider's QR as an SVG document.
 *
 * SVG rather than a raster: the same string serves the dashboard at screen size
 * and the print stylesheet at sticker size, and a QR is the one image where
 * resampling costs scans.
 *
 * The parameter is named `qrSlug`, not `slug`, so that no call site can pass a
 * listing slug by habit and have it silently drawn — the rename is what makes
 * the compiler visit every caller.
 *
 * @param input - Input parameters.
 * @param input.qrSlug - The QR CODE's slug (`qr_codes.slug`).
 * @param input.siteUrl - Public base URL of the web app (`HOSPEDA_SITE_URL`).
 * @returns The SVG markup, byte-identical for a given QR slug and site URL.
 */
export async function renderHostTradeQrSvg(input: {
    readonly qrSlug: string;
    readonly siteUrl: string;
}): Promise<string> {
    return renderQrSvg({
        data: buildHostTradeQrScanUrl(input),
        options: {
            margin: QR_MARGIN,
            errorCorrectionLevel: QR_ERROR_CORRECTION
        }
    });
}
