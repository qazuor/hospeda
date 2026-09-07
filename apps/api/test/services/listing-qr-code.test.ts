/**
 * The two creation-only fields of a listing's code (HOS-982 PR 2).
 *
 * ---
 * WHAT IS AT STAKE
 *
 * `(entityType, entityId, purpose)` decides WHICH row `getOrCreateForEntity`
 * returns, so the sheet and the panel are guaranteed the same code. `targetUrl`
 * and `label` are not part of that key: `getOrCreateForEntity` returns an
 * existing row untouched, so whichever route runs FIRST writes them and the
 * other's values are silently discarded. Nothing fails when the two disagree —
 * there is no error, no second row, no red test. There is just a destination
 * decided by whoever happened to be first.
 *
 * Since PR 2 the panel renders on the dashboard before anybody downloads
 * anything, so the FIRST is almost always the panel. That is the reversal these
 * tests pin: the values the sheet prints must be the values the panel writes.
 *
 * @module test/services/listing-qr-code
 */

import { describe, expect, it } from 'vitest';
import {
    buildListingQrCodeLabel,
    buildListingQrTargetUrl,
    LISTING_QR_LABEL_DESCRIPTION
} from '../../src/services/listing-qr-sheet/listing-qr-code';
import {
    buildListingQrSheetContent,
    type ListingQrSheetVertical
} from '../../src/services/listing-qr-sheet/qr-sheet-content';

const SITE = 'https://hospeda.com.ar';
const SLUG = 'la-parrilla-del-puerto';
const NAME = 'La Parrilla del Puerto';

const VERTICALS: readonly ListingQrSheetVertical[] = ['accommodation', 'gastronomy', 'experience'];

describe('the destination a listing code is minted with', () => {
    it.each(VERTICALS)('is the same for the panel and the sheet — %s', (vertical) => {
        const fromPanel = buildListingQrTargetUrl({ vertical, slug: SLUG, siteUrl: SITE });
        const fromSheet = buildListingQrSheetContent({
            listingName: NAME,
            slug: SLUG,
            vertical,
            locale: 'es',
            siteUrl: SITE
        }).url;

        expect(fromPanel).toBe(fromSheet);
    });

    it.each(
        VERTICALS
    )('stays the market locale even when the sheet is printed in another — %s', (vertical) => {
        // The sheet's COPY follows the reader; its `url` must not. If it did,
        // a host reading the dashboard in English would mint an `/en/`
        // destination and every future scanner of that door would land on
        // the English page — permanently, since the row already exists.
        const printedInEnglish = buildListingQrSheetContent({
            listingName: NAME,
            slug: SLUG,
            vertical,
            locale: 'en',
            siteUrl: SITE
        });

        expect(printedInEnglish.url).toContain('/es/');
        expect(buildListingQrTargetUrl({ vertical, slug: SLUG, siteUrl: SITE })).toBe(
            printedInEnglish.url
        );
    });

    it('names the vertical’s own public path segment', () => {
        // Guards the map itself: three verticals resolving to one segment would
        // satisfy every equality above while pointing two of them at a 404.
        expect(
            buildListingQrTargetUrl({ vertical: 'accommodation', slug: SLUG, siteUrl: SITE })
        ).toBe(`${SITE}/es/alojamientos/${SLUG}/`);
        expect(buildListingQrTargetUrl({ vertical: 'gastronomy', slug: SLUG, siteUrl: SITE })).toBe(
            `${SITE}/es/gastronomia/${SLUG}/`
        );
        expect(buildListingQrTargetUrl({ vertical: 'experience', slug: SLUG, siteUrl: SITE })).toBe(
            `${SITE}/es/experiencias/${SLUG}/`
        );
    });
});

describe('the label a listing code is minted with', () => {
    it('carries BOTH the display name and the slug', () => {
        // `qr_codes.label` is what an admin searches a year from now holding
        // only a photograph of a printed sheet. Either half alone fails a real
        // lookup: two listings may share a trading name, and nobody remembers a
        // slug.
        const label = buildListingQrCodeLabel({ vertical: 'gastronomy', name: NAME, slug: SLUG });

        expect(label).toContain(NAME);
        expect(label).toContain(SLUG);
        expect(label).toContain(LISTING_QR_LABEL_DESCRIPTION.gastronomy);
    });

    it('describes each vertical distinguishably', () => {
        const descriptions = Object.values(LISTING_QR_LABEL_DESCRIPTION);

        expect(new Set(descriptions).size).toBe(descriptions.length);
        // The exact strings the three sheet routes carried inline before the
        // panel existed. Kept verbatim so rows minted after PR 2 stay findable
        // next to rows minted before it, in the same admin search.
        expect(LISTING_QR_LABEL_DESCRIPTION).toStrictEqual({
            accommodation: 'Accommodation listing QR',
            gastronomy: 'Gastronomy listing QR',
            experience: 'Experience listing QR'
        });
    });

    it('truncates to the column width rather than failing the insert', () => {
        // `qr_codes.label` is varchar(200); a listing with a very long name must
        // still get a code.
        const label = buildListingQrCodeLabel({
            vertical: 'experience',
            name: 'N'.repeat(400),
            slug: SLUG
        });

        expect(label.length).toBe(200);
    });
});
