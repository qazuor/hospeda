/**
 * The values that CREATE a listing's `LISTING` code, in one place (HOS-982).
 *
 * ---
 * WHY THIS MODULE EXISTS
 *
 * Two routes now ask for the same code. `qrSheet.ts` renders the printable PDF;
 * `qrCode.ts` returns the symbol as SVG so the owner can SEE it in the dashboard
 * before downloading anything. Both call `resolveEntityQrScanUrl` with the same
 * `(entityType, entityId, purpose)` — which is the lookup key of `qr_codes`, so
 * the second caller is guaranteed to get the row the first one created and the
 * printed sheet is guaranteed to carry the symbol the panel showed.
 *
 * What is NOT guaranteed by that key is `targetUrl` and `label`, and this module
 * is about exactly those two. `getOrCreateForEntity` returns an existing row
 * untouched, so both fields are **creation-only**: whichever route runs FIRST
 * decides them, forever, and nothing anywhere fails if the two routes disagree.
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
 * @module services/listing-qr-sheet/listing-qr-code
 */

import { buildEntityQrLabel } from '../../utils/entity-qr.js';
import {
    buildListingPublicUrl,
    type ListingQrSheetVertical,
    MINTED_TARGET_LOCALE
} from './qr-sheet-content.js';

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
