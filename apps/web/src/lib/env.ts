/**
 * Type-safe environment variable access for web.
 * Delegates to the validated env from `src/env.ts` instead of constructing
 * ad-hoc fallback chains with `import.meta.env`.
 *
 * NEVER use `import.meta.env` directly in application code.
 * NEVER use `HOSPEDA_*` variables in client-side code.
 */

import type { ServerEnv } from '../env.js';
import { validateWebEnv } from '../env.js';

/** Resolved lazily on first access so module import never throws. */
let _env: ServerEnv | undefined;

function getEnv(): ServerEnv {
    if (!_env) {
        _env = validateWebEnv();
    }
    return _env;
}

/**
 * Get the API base URL.
 *
 * Prefers `PUBLIC_API_URL` (available on both server and client) then falls
 * back to `HOSPEDA_API_URL` (server-only). Strips trailing slash.
 *
 * @returns The API base URL without a trailing slash
 * @throws {Error} If neither PUBLIC_API_URL nor HOSPEDA_API_URL is configured
 */
export function getApiUrl(): string {
    const env = getEnv();
    const url = env.PUBLIC_API_URL ?? env.HOSPEDA_API_URL;
    if (!url) {
        throw new Error('[web] Neither PUBLIC_API_URL nor HOSPEDA_API_URL is configured');
    }
    return url.replace(/\/$/, '');
}

/**
 * Get the site base URL.
 *
 * @returns The site base URL
 * @throws {Error} If neither PUBLIC_SITE_URL nor HOSPEDA_SITE_URL is configured
 */
export function getSiteUrl(): string {
    const env = getEnv();
    const url = env.PUBLIC_SITE_URL ?? env.HOSPEDA_SITE_URL;
    if (!url) {
        throw new Error('[web] Neither PUBLIC_SITE_URL nor HOSPEDA_SITE_URL is configured');
    }
    return url;
}

/**
 * Get the admin panel base URL.
 *
 * Used to redirect hosts to the admin app after creating a property draft
 * and for any other deep link from the public site into the admin panel.
 * Strips the trailing slash so callers can append paths safely.
 *
 * Returns `undefined` when neither env var is set so display-only callers
 * (header menu, dashboard widgets) can render without an admin link instead
 * of crashing the page. Runtime-critical callers that must redirect to the
 * admin app should use `getAdminUrlOrThrow()` and return a 500 / 404 when
 * the URL is missing.
 *
 * @returns The admin base URL without a trailing slash, or undefined
 */
export function getAdminUrl(): string | undefined {
    const env = getEnv();
    const url = env.PUBLIC_ADMIN_URL ?? env.HOSPEDA_ADMIN_URL;
    if (!url) {
        return undefined;
    }
    return url.replace(/\/$/, '');
}

/**
 * Get the admin panel base URL, throwing when it is not configured.
 *
 * Use this in flows that REQUIRE the admin URL at runtime (e.g. server-side
 * redirects to the admin app). Display-only callers should use
 * `getAdminUrl()` and degrade gracefully when it returns undefined.
 *
 * @returns The admin base URL without a trailing slash
 * @throws {Error} If neither PUBLIC_ADMIN_URL nor HOSPEDA_ADMIN_URL is configured
 */
export function getAdminUrlOrThrow(): string {
    const url = getAdminUrl();
    if (!url) {
        throw new Error('[web] Neither PUBLIC_ADMIN_URL nor HOSPEDA_ADMIN_URL is configured');
    }
    return url;
}

/**
 * Get the deploy version (git hash or release tag).
 *
 * @returns The deploy version string, or undefined if not set
 */
export function getDeployVersion(): string | undefined {
    return getEnv().PUBLIC_VERSION;
}

/**
 * Check if running in production.
 *
 * @returns True if in production mode
 */
export function isProduction(): boolean {
    return import.meta.env.PROD === true;
}

/**
 * Check if running in development.
 *
 * @returns True if in development mode
 */
export function isDevelopment(): boolean {
    return import.meta.env.DEV === true;
}

/**
 * Get the ISR revalidation secret.
 *
 * Used to authenticate on-demand revalidation requests sent from the API to the web app.
 * Must match the `HOSPEDA_REVALIDATION_SECRET` configured in the API.
 *
 * @returns The revalidation secret, or undefined if not configured
 */
export function getRevalidationSecret(): string | undefined {
    return getEnv().HOSPEDA_REVALIDATION_SECRET;
}

/**
 * Check if client-side logging is explicitly enabled via the PUBLIC_ENABLE_LOGGING flag.
 *
 * Returns true when running in development mode (so developers always see logs locally),
 * or when PUBLIC_ENABLE_LOGGING is explicitly set to 'true' in production.
 *
 * @returns True if logging should be active in the browser
 */
export function isLoggingEnabled(): boolean {
    if (import.meta.env.DEV === true) return true;
    return getEnv().PUBLIC_ENABLE_LOGGING === 'true';
}

/**
 * Check whether the feedback FAB widget is enabled.
 *
 * Controlled by the `PUBLIC_FEEDBACK_ENABLED` env var (Zod-transformed to boolean).
 * Defaults to `false` so local/dev environments are unaffected. Set to `'true'` in
 * preview/production to show the FAB.
 *
 * @returns True when the FAB should be rendered
 */
export function isFeedbackEnabled(): boolean {
    return getEnv().PUBLIC_FEEDBACK_ENABLED === true;
}

/**
 * Get the raw `HOSPEDA_NOINDEX_HOSTS` env var value.
 *
 * Server-only. Returns the comma-separated string as configured, or undefined
 * when unset. Callers normalize the value via `parseNoindexHosts()` in
 * `src/lib/middleware-helpers.ts` to obtain a deduped lowercase host list
 * (defaults to `staging.hospeda.com.ar` when undefined).
 *
 * @returns The raw env var value, or undefined when unset
 */
export function getNoindexHosts(): string | undefined {
    return getEnv().HOSPEDA_NOINDEX_HOSTS;
}
