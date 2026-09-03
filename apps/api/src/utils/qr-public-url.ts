/**
 * The URL a printed QR code encodes (HOS-981).
 *
 * A redirectable code does NOT encode its target. It encodes the platform's own
 * `/qr/{slug}/` indirection, and that is the entire product: the ink is spent
 * once on a slug, and the destination behind it stays editable forever. Anything
 * that renders a code has to agree on this string down to the byte, because two
 * spellings of it are two different symbols and only one of them matches the
 * sticker already in the field.
 *
 * @module utils/qr-public-url
 */

/**
 * Builds the absolute URL a code with this slug redirects from.
 *
 * The trailing slash is not cosmetic. `apps/web` is configured
 * `trailingSlash: 'always'`, so `/qr/Live2345` answers a redirect rather than
 * the page — an extra hop on the critical path of somebody standing in front of
 * a sign, and one more thing that can go wrong between a camera and a
 * destination. It is written into the printed symbol, so it cannot be corrected
 * later.
 *
 * @param input - Options object (RO-RO).
 * @param input.slug - The code's slug, as stored.
 * @param input.siteUrl - Public base URL of the web app (`HOSPEDA_SITE_URL`).
 *   A trailing slash is tolerated.
 * @returns The absolute `/qr/{slug}/` URL.
 */
export function buildQrScanUrl(input: { slug: string; siteUrl: string }): string {
    const base = input.siteUrl.replace(/\/$/, '');
    // The slug alphabet excludes every character that would need escaping, so
    // this encodes nothing today. It is here so that a value carrying `?` or `#`
    // truncates into a 404 rather than into a different page than intended.
    const slug = encodeURIComponent(input.slug);
    return `${base}/qr/${slug}/`;
}
