/**
 * Everything the two listing-QR surfaces must agree on (HOS-982).
 *
 * ---
 * WHY THIS MODULE EXISTS
 *
 * Two routes now ask for the same code. `qrSheet.ts` renders the printable PDF;
 * `qrCode.ts` returns the symbol as SVG so the owner can SEE it in the dashboard
 * before downloading anything. Both call `resolveEntityQrScanUrl` with the same
 * `(entityType, entityId, purpose)` — which is the lookup key of `qr_codes`, so
 * the second caller is guaranteed to get the ROW the first one created.
 *
 * The row is not the whole of it, and assuming it was is the defect this module
 * grew to fix. Three things fall outside that key and every one of them can
 * differ between the two surfaces with nothing failing anywhere.
 *
 * ## 1. The SYMBOL — same row, different picture
 *
 * `renderQrSvg`'s default error correction is M (~15% recoverable); the sheet
 * renders at Q (~25%) because a code taped to a door gets rained on and has a
 * corner covered, and the argument is written out in `qr-sheet-render.ts`. A
 * route that called `renderQrSvg({ data: url })` and a sheet that called
 * `renderQrMatrix({ data: url, errorCorrectionLevel: QR_ERROR_CORRECTION })`
 * therefore drew DIFFERENT symbols of the same URL — measured, 29 modules at
 * version 3 against 33 at version 4 — while every docblock claimed they were the
 * same artifact.
 *
 * That is not cosmetic, because showing a code invites photographing it: an
 * owner who screenshots the panel and prints it for the counter walks away with
 * the tolerance the sheet deliberately refused. {@link renderListingQrSvg} is
 * the fix — it reads the SHEET's constant rather than redeclaring a level, so
 * the two cannot drift apart again.
 *
 * ## 2 and 3. `targetUrl` and `label` — creation-only
 *
 * `getOrCreateForEntity` returns an existing row untouched, so both fields are
 * decided by whichever route runs FIRST, forever, and nothing anywhere fails if
 * the two routes disagree.
 *
 * That is not a hypothetical ordering. Before HOS-982 PR 2 the sheet was the
 * only caller and therefore always the minter; now the panel renders on the
 * dashboard and the SHEET is almost never first. So the values the panel writes
 * are the ones that stick — and if the sheet's own literals said something
 * different they would quietly become dead code, describing a row nobody
 * writes. One definition, used by both, removes the question.
 *
 * ## What is deliberately NOT here
 *
 * The `resolveEntityQrScanUrl` CALL stays in each route file, with its
 * `EntityTypeEnum` and `QrCodePurposeEnum` spelled as literals. Moving it here
 * would collapse six call sites into one with a variable `entityType`, and
 * `test/utils/entity-qr-purpose.guard.test.ts` — the guard that exists because
 * flipping a `purpose` leaves every test green and prints the wrong
 * destination on paper — reads exactly those literals. A shared helper that
 * blinded that guard would trade a small duplication for the defect the guard
 * was written for.
 *
 * ## What neither surface can currently see: a RETIRED code
 *
 * `QrCodeService._findLiveCodeForEntity` filters on `deletedAt` alone, while the
 * public redirect (`resolveBySlug`) also refuses a row with `isActive: false`.
 * So an operator who retires a code without deleting it leaves both surfaces
 * happily resolving it: the sheet prints it and the panel displays it under a
 * line naming where it leads, and every scan 404s. Not fixed here — the
 * predicate belongs to the QR engine (HOS-981) and reaches all four live
 * purposes, not just this one — but recorded, because the panel's URL line reads
 * like a health check and is not one.
 *
 * @module services/listing-qr-sheet/listing-qr-code
 */

import { buildEntityQrLabel } from '../../utils/entity-qr.js';
import { renderQrSvg } from '../../utils/qr-render.js';
import {
    buildListingPublicUrl,
    type ListingQrSheetVertical,
    MINTED_TARGET_LOCALE
} from './qr-sheet-content.js';
// The SHEET's level, imported rather than repeated. A second declaration would
// agree on the day it was written and nothing would ever say when it stopped.
import { QR_ERROR_CORRECTION } from './qr-sheet-render.js';

/**
 * Renders a listing's code as SVG, at the level the printed sheet uses.
 *
 * The ONLY way the image routes should draw the symbol. Calling `renderQrSvg`
 * directly is what produced two different pictures of one code: its default is
 * M and the sheet is Q (see the module docblock, and `qr-sheet-render.ts` for
 * why Q).
 *
 * @param input - Input parameters.
 * @param input.url - What the symbol encodes: the platform's own
 *   `{site}/qr/{qrSlug}/` redirect, never the final destination (HOS-981).
 * @returns The SVG markup, byte-identical for a given URL.
 */
export function renderListingQrSvg(input: { readonly url: string }): Promise<string> {
    return renderQrSvg({
        data: input.url,
        options: { errorCorrectionLevel: QR_ERROR_CORRECTION }
    });
}

/**
 * The operator-facing description of each vertical's listing code.
 *
 * These are the strings the three sheet routes carried inline before the SVG
 * endpoint existed, kept verbatim: changing one would rename nothing (the rows
 * already minted keep their label) while making new rows disagree with old ones
 * in an admin search — which is the one job `qr_codes.label` has.
 */
export const LISTING_QR_LABEL_DESCRIPTION: Readonly<Record<ListingQrSheetVertical, string>> = {
    accommodation: 'Accommodation listing QR',
    gastronomy: 'Gastronomy listing QR',
    experience: 'Experience listing QR'
};

/**
 * Builds the `label` a listing's code is created with.
 *
 * @param input - Input parameters.
 * @param input.vertical - Which vertical the listing belongs to.
 * @param input.name - The listing's display name.
 * @param input.slug - The listing's slug.
 * @returns The label, already truncated to the column's width.
 */
export function buildListingQrCodeLabel(input: {
    readonly vertical: ListingQrSheetVertical;
    readonly name: string;
    readonly slug: string;
}): string {
    return buildEntityQrLabel({
        description: LISTING_QR_LABEL_DESCRIPTION[input.vertical],
        name: input.name,
        slug: input.slug
    });
}

/**
 * Builds the `targetUrl` a listing's code is created with.
 *
 * Pinned to {@link MINTED_TARGET_LOCALE}, never to the caller's language — the
 * argument is in `qr-sheet-content.ts` and it is the whole reason that constant
 * exists: a locale written here decides, permanently, what language every future
 * SCANNER of that door reads the site in, and re-requesting in another language
 * would not undo it because the row already exists.
 *
 * This is the same value `buildListingQrSheetContent(...).url` produces — both
 * go through `buildListingPublicUrl` at that locale, and
 * `test/services/listing-qr-code.test.ts` asserts the two are equal so the sheet
 * and the panel cannot mint different destinations for one listing.
 *
 * @param input - Input parameters.
 * @param input.vertical - Which vertical the listing belongs to.
 * @param input.slug - The listing's slug.
 * @param input.siteUrl - Public base URL of the web app.
 * @returns The absolute URL of the listing's public page.
 */
export function buildListingQrTargetUrl(input: {
    readonly vertical: ListingQrSheetVertical;
    readonly slug: string;
    readonly siteUrl: string;
}): string {
    return buildListingPublicUrl({
        vertical: input.vertical,
        slug: input.slug,
        locale: MINTED_TARGET_LOCALE,
        siteUrl: input.siteUrl
    });
}
