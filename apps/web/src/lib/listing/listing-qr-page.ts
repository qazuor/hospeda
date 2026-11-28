/**
 * @file listing-qr-page.ts
 * @description Where a listing's QR page lives, and the one-time notice that
 * announces it after the first publish (HOS-2688).
 *
 * ## The page
 *
 * The QR left the owner card (owner decision, HOS-2688): the card's «⋯» menu
 * links to a page of its own, one per listing, next to that listing's editor:
 *
 * - accommodation → `mi-cuenta/propiedades/{id}/codigo-qr`
 * - venue / experience → `mi-cuenta/comercio/{vertical}/{id}/codigo-qr`
 *
 * Same shape as the editor routes (`…/{id}/editar`), so a listing's pages stay
 * under one prefix.
 *
 * ## The notice
 *
 * When a listing is published for the first time its owner sees ONE notice
 * saying the printable QR is ready, with a link to the page. Two existing
 * mechanisms carry it, nothing new is stored server-side:
 *
 * - the publish island reloads the page on success, so the notice travels as
 *   a toast queued for the next page (`queueToastForNextPage`, sessionStorage);
 * - "once per listing" is a per-browser record of the listings already
 *   announced ({@link claimListingQrNotice}, localStorage). It is a
 *   convenience, not an audit trail: storage that throws or is cleared only
 *   means the notice may show again, never that publishing fails.
 *
 * @module lib/listing/listing-qr-page
 */

/** The three verticals whose listings print a QR sheet. */
export type ListingQrVertical = 'accommodation' | 'venue' | 'experience';

/** Last path segment of the QR page, under the listing's own prefix. */
export const LISTING_QR_PAGE_SEGMENT = 'codigo-qr';

/** localStorage key holding the ids of the listings whose notice was shown. */
export const LISTING_QR_NOTICE_STORAGE_KEY = 'hospeda.listingQrNoticeShown';

/**
 * How many listing ids the record keeps. An owner publishes a handful of
 * listings; the cap only keeps a pathological record from growing forever.
 * The oldest ids fall off first.
 */
export const LISTING_QR_NOTICE_MAX_IDS = 200;

/**
 * Builds the locale-less path of a listing's QR page (feed it to `buildUrl`).
 *
 * @param input - Input parameters.
 * @param input.vertical - The listing's vertical.
 * @param input.listingId - The listing's id.
 * @returns E.g. `mi-cuenta/propiedades/abc/codigo-qr`.
 *
 * @example
 * ```ts
 * buildUrl({ locale, path: buildListingQrPagePath({ vertical: 'venue', listingId }) });
 * ```
 */
export function buildListingQrPagePath(input: {
    readonly vertical: ListingQrVertical;
    readonly listingId: string;
}): string {
    const id = encodeURIComponent(input.listingId);
    const base: Readonly<Record<ListingQrVertical, string>> = {
        accommodation: `mi-cuenta/propiedades/${id}`,
        venue: `mi-cuenta/comercio/venue/${id}`,
        experience: `mi-cuenta/comercio/experience/${id}`
    };
    return `${base[input.vertical]}/${LISTING_QR_PAGE_SEGMENT}`;
}

/** The slice of `Storage` the notice record needs. */
export type NoticeStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** The browser's localStorage, or `null` where it is absent or refuses access. */
function defaultStorage(): NoticeStorage | null {
    try {
        return typeof window === 'undefined' ? null : window.localStorage;
    } catch {
        return null;
    }
}

/** Reads the record, treating anything unreadable as empty. */
function readShownIds(storage: NoticeStorage): readonly string[] {
    try {
        const parsed: unknown = JSON.parse(storage.getItem(LISTING_QR_NOTICE_STORAGE_KEY) ?? '[]');
        return Array.isArray(parsed)
            ? parsed.filter((value): value is string => typeof value === 'string')
            : [];
    } catch {
        return [];
    }
}

/**
 * Claims the listing's one-time QR notice.
 *
 * Returns `true` exactly once per listing (per browser) and records the claim;
 * every later call for the same listing returns `false`. Without usable storage
 * it returns `true` and records nothing — showing a notice twice is a smaller
 * failure than never showing it.
 *
 * @param input - Input parameters.
 * @param input.listingId - The listing that was just published.
 * @param input.storage - Storage to record in. Defaults to `window.localStorage`.
 * @returns Whether the notice should be shown now.
 */
export function claimListingQrNotice(input: {
    readonly listingId: string;
    readonly storage?: NoticeStorage | null;
}): boolean {
    const storage = input.storage === undefined ? defaultStorage() : input.storage;
    if (!storage) return true;

    const shown = readShownIds(storage);
    if (shown.includes(input.listingId)) return false;

    const next = [...shown, input.listingId].slice(-LISTING_QR_NOTICE_MAX_IDS);
    try {
        storage.setItem(LISTING_QR_NOTICE_STORAGE_KEY, JSON.stringify(next));
    } catch {
        // Quota or private mode: the notice still shows, it just may show again.
    }
    return true;
}
