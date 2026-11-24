/**
 * Environment-aware origin for the email assets that must exist on the
 * deployment sending the email (HOS-2540).
 *
 * The isotipo and the user-layout images (HOS-2565 PR-4, {@link resolveEmailAssetUrl})
 * follow it. `EMAIL_PUBLIC_SITE_URL`, the footer links and
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
    /**
     * Public origin of the Umami instance that serves open pixels (`HOSPEDA_UMAMI_URL`,
     * HOS-2359). A pixel is rendered only when this is an `https:` URL: unset, an
     * internal `http://` URL or garbage means "no pixel", and UTMs are still applied.
     */
    readonly pixelBaseUrl?: string;
}

let assetOrigin: string = EMAIL_PUBLIC_SITE_URL;
let pixelOrigin: string | null = null;

/**
 * Normalizes a pixel origin, answering `null` for anything that is not an absolute
 * `https:` URL. Never throws: a bad Umami URL must not stop the api from booting or
 * an email from sending; it only means no pixel.
 */
function normalizePixelOrigin(pixelBaseUrl: string | undefined): string | null {
    if (typeof pixelBaseUrl !== 'string' || pixelBaseUrl.trim() === '') {
        return null;
    }
    const trimmed = pixelBaseUrl.trim();
    try {
        if (new URL(trimmed).protocol !== 'https:') {
            return null;
        }
    } catch {
        return null;
    }
    return trimmed.replace(/\/+$/, '');
}

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
    pixelOrigin = normalizePixelOrigin(input.pixelBaseUrl);
}

/**
 * Origin of the configured web site (the asset origin). Used as one of the "own web"
 * origins whose links receive UTMs (HOS-2359).
 *
 * @returns The site origin, without a trailing slash.
 */
export function resolveEmailSiteOrigin(): string {
    return assetOrigin;
}

/**
 * Origin that serves open pixels, or `null` when no pixel must be rendered (no
 * `https:` Umami URL configured).
 *
 * @returns The pixel origin without a trailing slash, or `null`.
 */
export function resolveEmailPixelBaseUrl(): string | null {
    return pixelOrigin;
}

/**
 * Absolute URL of the hosted isotipo for the configured origin.
 * Defaults to production until {@link configureEmailAssets} is called.
 *
 * @returns The isotipo URL, e.g. `https://hospeda.com.ar/email/hospeda-isotipo@2x.png`.
 */
export function resolveEmailIsotipoUrl(): string {
    return resolveEmailAssetUrl({ path: EMAIL_ISOTIPO_PATH });
}

/** A path under the site's `/email/` folder (`apps/web/public/email/`). */
export type EmailAssetPath = `/email/${string}`;

/**
 * Absolute URL of any hosted email asset for the configured origin (HOS-2565 §9.3).
 * Defaults to production until {@link configureEmailAssets} is called, so staging
 * emails load their images from staging.
 *
 * @param input - The asset path, always under `/email/`.
 * @returns The absolute asset URL.
 *
 * @example
 * ```ts
 * resolveEmailAssetUrl({ path: '/email/user/header-wave@2x.png' });
 * // 'https://hospeda.com.ar/email/user/header-wave@2x.png'
 * ```
 */
export function resolveEmailAssetUrl(input: { readonly path: EmailAssetPath }): string {
    return `${assetOrigin}${input.path}`;
}

/**
 * Restores the production default. Intended for tests.
 */
export function resetEmailAssets(): void {
    assetOrigin = EMAIL_PUBLIC_SITE_URL;
    pixelOrigin = null;
}
