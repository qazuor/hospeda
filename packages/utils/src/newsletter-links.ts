/**
 * Newsletter link builders (HOS-2617).
 *
 * Single source of truth for the URLs that point a recipient at the
 * unsubscribe flow. The campaign mail, the test send and the guest welcome
 * mail all build their link through here so none of them can drift to a web
 * route that does not exist.
 *
 * @module utils/newsletter-links
 */

/**
 * Path of the web confirmation page, relative to `/{locale}/`. Must match a
 * file under `apps/web/src/pages/[lang]/` (enforced by a guard test).
 */
export const NEWSLETTER_UNSUBSCRIBE_PAGE_PATH = 'newsletter/unsubscribe' as const;

/** Path of the API endpoint that performs (POST) the unsubscribe. */
export const NEWSLETTER_UNSUBSCRIBE_API_PATH = '/api/v1/public/newsletter/unsubscribe' as const;

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

/** Input of {@link buildNewsletterUnsubscribePageUrl}. */
export interface BuildNewsletterUnsubscribePageUrlInput {
    /** Web site origin, e.g. `https://hospeda.com.ar`. */
    readonly siteUrl: string;
    /** Locale prefix of the page. */
    readonly locale: string;
    /** HMAC unsubscribe token. Omitted from the URL when empty. */
    readonly token?: string | undefined;
}

/**
 * Builds the web page URL where the recipient confirms the unsubscribe.
 * Opening it never unsubscribes by itself: the page asks for a click.
 *
 * @param input - Site origin, locale and optional token.
 * @returns Absolute URL, with a trailing slash on the path.
 *
 * @example
 * ```ts
 * buildNewsletterUnsubscribePageUrl({ siteUrl: 'https://hospeda.com.ar', locale: 'es', token: 'abc' });
 * // 'https://hospeda.com.ar/es/newsletter/unsubscribe/?token=abc'
 * ```
 */
export const buildNewsletterUnsubscribePageUrl = ({
    siteUrl,
    locale,
    token
}: BuildNewsletterUnsubscribePageUrlInput): string => {
    const base = `${stripTrailingSlash(siteUrl)}/${locale}/${NEWSLETTER_UNSUBSCRIBE_PAGE_PATH}/`;
    return token ? `${base}?token=${encodeURIComponent(token)}` : base;
};

/** Input of {@link buildNewsletterUnsubscribeApiUrl}. */
export interface BuildNewsletterUnsubscribeApiUrlInput {
    /** API origin, e.g. `https://api.hospeda.com.ar`. */
    readonly apiUrl: string;
    /** HMAC unsubscribe token. */
    readonly token: string;
}

/**
 * Builds the API URL used by RFC 8058 one-click unsubscribe (`POST`).
 *
 * @param input - API origin and token.
 * @returns Absolute URL carrying the token in the query string.
 */
export const buildNewsletterUnsubscribeApiUrl = ({
    apiUrl,
    token
}: BuildNewsletterUnsubscribeApiUrlInput): string =>
    `${stripTrailingSlash(apiUrl)}${NEWSLETTER_UNSUBSCRIBE_API_PATH}?token=${encodeURIComponent(token)}`;
