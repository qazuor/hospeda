/**
 * Environment-aware origin for the email assets that must exist on the
 * deployment sending the email (HOS-2540).
 *
 * Only the isotipo follows it. `EMAIL_PUBLIC_SITE_URL`, the footer link and
 * `EMAIL_PREFERENCES_URL` keep pointing at production by design (HOS-2519 §5.1).
 *
 * The state is module-level and set once by the host app at startup, so the
 * ~125 templates never have to thread a `siteUrl` through.
 *
 * @module email-assets
 */

/** Production origin: the default asset origin and the footer/preferences origin. */
export const EMAIL_PUBLIC_SITE_URL = 'https://hospeda.com.ar';

/**
 * Path of the hosted isotipo PNG (transparent background, 89x96), relative to the
 * site origin (`apps/web/public/email/`). The "hospeda" wordmark is live text, not
 * part of the image, so dark-mode clients never show a white rectangle.
 *
 * The legacy flattened `hospeda-logo@2x.png` stays in the repo only because emails
 * already sent reference it; nothing renders it anymore.
 */
export const EMAIL_ISOTIPO_PATH = '/email/hospeda-isotipo@2x.png';

/** Input for {@link configureEmailAssets}. */
export interface ConfigureEmailAssetsInput {
    /** Absolute http(s) origin that serves `/email/*` (e.g. the validated `HOSPEDA_SITE_URL`). */
    readonly siteUrl: string;
}

let assetOrigin: string = EMAIL_PUBLIC_SITE_URL;

/**
 * Parses and normalizes an asset origin.
 *
 * Validation uses the WHATWG `URL` parser so `@repo/email` does not take a new
 * dependency just for this check.
 */
function normalizeOrigin(siteUrl: unknown): string {
    if (typeof siteUrl !== 'string' || siteUrl.trim() === '') {
        throw new TypeError('configureEmailAssets: siteUrl must be a non-empty string');
    }
    const trimmed = siteUrl.trim();
    let parsed: URL;
    try {
        parsed = new URL(trimmed);
    } catch {
        throw new TypeError(
            `configureEmailAssets: siteUrl must be an absolute URL, got "${trimmed}"`
        );
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new TypeError(
            `configureEmailAssets: siteUrl must use http or https, got "${parsed.protocol}"`
        );
    }
    return trimmed.replace(/\/+$/, '');
}

/**
 * Sets the origin the email isotipo is served from. Call it once at app startup,
 * before anything renders an email.
 *
 * @param input - See {@link ConfigureEmailAssetsInput}. A trailing slash is stripped.
 * @throws {TypeError} If `siteUrl` is not an absolute http(s) URL.
 *
 * @example
 * ```ts
 * configureEmailAssets({ siteUrl: env.HOSPEDA_SITE_URL });
 * resolveEmailIsotipoUrl(); // 'https://staging.hospeda.com.ar/email/hospeda-isotipo@2x.png'
 * ```
 */
export function configureEmailAssets(input: ConfigureEmailAssetsInput): void {
    assetOrigin = normalizeOrigin(input.siteUrl);
}

/**
 * Absolute URL of the hosted isotipo for the configured origin.
 * Defaults to production until {@link configureEmailAssets} is called.
 *
 * @returns The isotipo URL, e.g. `https://hospeda.com.ar/email/hospeda-isotipo@2x.png`.
 */
export function resolveEmailIsotipoUrl(): string {
    return `${assetOrigin}${EMAIL_ISOTIPO_PATH}`;
}

/**
 * Restores the production default. Intended for tests.
 */
export function resetEmailAssets(): void {
    assetOrigin = EMAIL_PUBLIC_SITE_URL;
}
