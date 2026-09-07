/**
 * The copy printed on a listing's QR sheet, in the reader's language (HOS-982).
 *
 * ---
 * WHAT THIS SHEET IS, AND WHAT IT IS NOT
 *
 * It is NOT the brochure. The brochure (`services/commerce-brochure`) is handed
 * to a person: it carries the photo, the description, the opening hours, the
 * contact block — everything somebody would read sitting down. This sheet is
 * TAPED TO A DOOR, left on a counter, or stood on a table. Its whole job is to
 * be scanned from across a room by somebody walking past, so it carries four
 * things and refuses the rest:
 *
 * 1. the business's name, so a passer-by knows whose code this is;
 * 2. a large QR;
 * 3. a sentence telling them to point their camera at it;
 * 4. the brand, so the scan reads as safe rather than as a random sticker.
 *
 * Every field the brochure prints and this one does not is a deliberate
 * omission, not an oversight. A description that has to be read at 40cm defeats
 * a sheet meant to work at 1.2m, and anything printed here ages in ink while the
 * ficha behind the code stays editable.
 *
 * ## Why one module serves three verticals
 *
 * An accommodation, a restaurant and an experience print the SAME sheet. The
 * only thing that differs between them is the path segment of the public page
 * the code resolves to, which is one map below. Splitting this per vertical
 * would give three copies of one page design, and they would drift the first
 * time anyone edited one of them.
 *
 * @module services/listing-qr-sheet/qr-sheet-content
 */

import type { Locale } from '@repo/i18n';
import { trans } from '@repo/i18n';

/** The three verticals that can print a QR sheet (owner decision, HOS-982). */
export type ListingQrSheetVertical = 'accommodation' | 'gastronomy' | 'experience';

/** Everything the renderer needs. No entity types leak past this boundary. */
export interface ListingQrSheetContent {
    /** The business's name, as its public ficha shows it. */
    readonly listingName: string;
    /** The large invitation, e.g. `Escaneá el código`. */
    readonly headline: string;
    /** The sentence under the code that says what to do with it. */
    readonly invite: string;
    /** The platform's name. Not translated — it is a proper noun. */
    readonly brand: string;
    /** One line saying what the platform is, for a reader who has never heard of it. */
    readonly brandTagline: string;
    /**
     * Absolute URL of the public ficha, ALWAYS in {@link MINTED_TARGET_LOCALE}.
     *
     * This is where the code LANDS, never what it encodes: the symbol carries
     * `{site}/qr/{qrSlug}/` so that a listing whose address moves does not
     * strand every sheet already taped to a door (HOS-981/HOS-1129). The route
     * reads this to provision the `qr_codes` row's `targetUrl`.
     *
     * It does NOT follow the `locale` this content was built with — see
     * {@link MINTED_TARGET_LOCALE} for why the reader's language stops at the
     * copy and never reaches this field.
     *
     * It is NOT drawn on the sheet. See `printedDomain` in `qr-sheet-render`.
     */
    readonly url: string;
}

/** The platform's name. A proper noun, so it is a constant and not a key. */
const BRAND_NAME = 'Hospeda';

/**
 * The locale the MINTED destination is pinned to. The market's default, always.
 *
 * ---
 * WHY THE DOWNLOADER'S LANGUAGE STOPS HERE (owner decision, 2026-09-07)
 *
 * The `targetUrl` of a `qr_codes` row is CREATION-ONLY: `getOrCreateForEntity`
 * returns an existing row untouched, so whatever the FIRST download wrote is
 * what every scan resolves to from then on. If that value followed the reader's
 * locale, a host whose browser says `en` — or whose `settings.languageWeb` is
 * `en` — would mint `…/en/alojamientos/cabana-del-rio/` and every passer-by who
 * scanned that door for the rest of the sheet's life would land on the English
 * page. Re-downloading it in Spanish would NOT correct it: the row already
 * exists.
 *
 * That is precisely what `utils/entity-qr.ts` refuses one field earlier, where
 * the encoded path is deliberately `/qr/…` and never `/{lang}/qr/…`: "a locale
 * baked into ink would choose, permanently, what language every future scanner
 * reads the site in". A language-neutral symbol pointing at a language-pinned
 * destination reintroduces exactly the choice the neutral path avoided.
 *
 * So the SHEET is still printed in the reader's language — headline, invitation
 * and tagline all follow `locale`, because the person holding the paper is the
 * host — and only the destination is pinned. The two are different audiences.
 *
 * ## This is reversible without reprinting anything
 *
 * The symbol encodes `/qr/{slug}/`, so the destination is a row an operator can
 * edit at any time. Nothing decided here is printed in ink.
 *
 * ## The alternative, and why it is not in this PR
 *
 * The better long-term answer is for the redirect itself to resolve the
 * SCANNER's language — the person actually reading the page — instead of
 * serving whatever locale the row happens to carry. That belongs to the QR
 * engine (HOS-981) and reaches all four live purposes, not just this sheet, so
 * it is a change to `apps/web/src/pages/qr/[slug].astro` and to every minted
 * row, not a line in this file. Pinning to the market default is the correct
 * behaviour in the meantime and stays correct afterwards.
 */
export const MINTED_TARGET_LOCALE: Locale = 'es';

/**
 * URL path segment of each vertical's public detail page.
 *
 * The segments are the Spanish ones in EVERY locale — that is the site's URL
 * convention. Mirrors `apps/web/src/lib/seo/entity-public-urls.ts`, which is the
 * web-side source of truth, and duplicated for the same reason
 * `brochure-content.ts` duplicates it: that file lives in the Astro app and this
 * one runs in the API. A divergence would point every printed code at a 404,
 * which is why `test/services/listing-qr-sheet-content.test.ts` asserts the two
 * commerce segments against the brochure's own builder and the accommodation one
 * against a literal.
 */
const PUBLIC_PATH_SEGMENT: Readonly<Record<ListingQrSheetVertical, string>> = {
    accommodation: 'alojamientos',
    gastronomy: 'gastronomia',
    experience: 'experiencias'
};

/**
 * Looks a key up, falling back to Spanish and then to a caller-supplied default.
 *
 * A printed sheet must never carry `[MISSING: …]`, so an absent key degrades to
 * the Spanish string rather than to a marker. Same contract as the brochure's
 * own resolver, for the same reason: paper has no second chance.
 */
function t(input: { locale: Locale; key: string; fallback: string }): string {
    const { locale, key } = input;
    return trans[locale]?.[key] ?? trans.es?.[key] ?? input.fallback;
}

/**
 * Absolute URL of a listing's public ficha.
 *
 * @param input - Input parameters.
 * @param input.vertical - Which vertical the listing belongs to.
 * @param input.slug - The listing's URL slug.
 * @param input.locale - Locale prefix of the page the code should land on.
 * @param input.siteUrl - Public base URL of the web app. A trailing slash is
 *   tolerated.
 * @returns The absolute, trailing-slashed URL of the public page.
 */
export function buildListingPublicUrl(input: {
    readonly vertical: ListingQrSheetVertical;
    readonly slug: string;
    readonly locale: Locale;
    readonly siteUrl: string;
}): string {
    const base = input.siteUrl.replace(/\/$/, '');
    const segment = PUBLIC_PATH_SEGMENT[input.vertical];
    return `${base}/${input.locale}/${segment}/${encodeURIComponent(input.slug)}/`;
}

/**
 * Builds the sheet's copy.
 *
 * @param input - Input parameters.
 * @param input.listingName - The business's public name.
 * @param input.slug - The listing's URL slug.
 * @param input.vertical - Which vertical the listing belongs to.
 * @param input.locale - Locale to print the COPY in. It deliberately does not
 *   reach `url` — see {@link MINTED_TARGET_LOCALE}.
 * @param input.siteUrl - Public base URL of the web app.
 * @returns Printable content, with no entity type attached.
 */
export function buildListingQrSheetContent(input: {
    readonly listingName: string;
    readonly slug: string;
    readonly vertical: ListingQrSheetVertical;
    readonly locale: Locale;
    readonly siteUrl: string;
}): ListingQrSheetContent {
    const { locale } = input;

    return {
        listingName: input.listingName.trim(),
        headline: t({
            locale,
            key: 'common.qrSheet.headline',
            fallback: 'Escaneá el código'
        }),
        invite: t({
            locale,
            key: 'common.qrSheet.invite',
            fallback:
                'Apuntá la cámara de tu teléfono al código para ver la ficha completa: fotos, contacto y cómo llegar.'
        }),
        brand: BRAND_NAME,
        brandTagline: t({
            locale,
            key: 'common.qrSheet.brandTagline',
            fallback: 'Alojamientos, gastronomía y experiencias del Litoral'
        }),
        // NOT `locale`. The copy is the reader's; the destination is the
        // market's, forever — see MINTED_TARGET_LOCALE.
        url: buildListingPublicUrl({
            vertical: input.vertical,
            slug: input.slug,
            locale: MINTED_TARGET_LOCALE,
            siteUrl: input.siteUrl
        })
    };
}
