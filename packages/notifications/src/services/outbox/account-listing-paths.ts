/**
 * Where a notice sends the reader inside Mi Cuenta (HOS-2565 §7.5).
 *
 * The per-vertical listing pages live in ONE declarative map, so no renderer
 * branches on a vertical: a renderer asks the map for a path and a new vertical
 * is a type error here until somebody decides its page.
 *
 * @module services/outbox/account-listing-paths
 */

/**
 * The verticals whose listings share the publication machine. Literal values
 * of `VerticalEnum` (`@repo/schemas`), which this package does not depend on.
 */
export type ListingNoticeVertical = 'accommodation' | 'venue' | 'experience';

/** The owner's Mi Cuenta listing page, per vertical. */
export const ACCOUNT_LISTINGS_PATH: Readonly<Record<ListingNoticeVertical, string>> = {
    accommodation: '/es/mi-cuenta/propiedades/',
    venue: '/es/mi-cuenta/comercio/',
    experience: '/es/mi-cuenta/comercio/'
};

/** Mi Suscripción, the page every billing notice sends the reader to. */
export const SUBSCRIPTION_PATH = '/es/mi-cuenta/suscripcion/';

/**
 * The page behind a notice's "Ver recibo" button (HOS-2566). It needs the
 * owner's session: the receipt is read through an authenticated API route, and
 * a receipt that is somebody else's answers the same "not found" as one that
 * does not exist.
 *
 * @param input.siteUrl - Site origin, with or without a trailing slash
 * @param input.receiptId - The receipt row id
 */
export function buildReceiptUrl(input: {
    readonly siteUrl: string;
    readonly receiptId: string;
}): string {
    return `${input.siteUrl.replace(/\/$/, '')}/es/mi-cuenta/recibo/${encodeURIComponent(input.receiptId)}/`;
}

/** The public contact page, where a notice sends a reader with questions. */
export const CONTACT_PATH = '/es/contacto/';

/** Whether a value names a vertical that has a Mi Cuenta listing page. */
export function isListingNoticeVertical(value: unknown): value is ListingNoticeVertical {
    return typeof value === 'string' && Object.hasOwn(ACCOUNT_LISTINGS_PATH, value);
}

/**
 * Absolute URL of the owner's listing page for one vertical.
 *
 * @param input.siteUrl - Site origin, with or without a trailing slash
 * @param input.vertical - A listing vertical
 * @returns The absolute URL
 *
 * @example
 * ```ts
 * resolveAccountListingsUrl({ siteUrl: 'https://hospeda.com.ar', vertical: 'venue' })
 * // "https://hospeda.com.ar/es/mi-cuenta/comercio/"
 * ```
 */
export function resolveAccountListingsUrl(input: {
    readonly siteUrl: string;
    readonly vertical: ListingNoticeVertical;
}): string {
    return `${input.siteUrl.replace(/\/$/, '')}${ACCOUNT_LISTINGS_PATH[input.vertical]}`;
}
