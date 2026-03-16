/**
 * Type-safe environment variable access.
 * Delegates to the validated env from `src/env.ts` instead of constructing
 * ad-hoc fallback chains with `import.meta.env`.
 */

import { validateWebEnv } from '../env.js';

const _env = validateWebEnv();

/**
 * Get the API base URL.
 *
 * @returns The API base URL without a trailing slash
 */
export function getApiUrl(): string {
    const url = _env.PUBLIC_API_URL ?? _env.HOSPEDA_API_URL;
    if (!url) {
        throw new Error('[web] Neither PUBLIC_API_URL nor HOSPEDA_API_URL is configured');
    }
    return url.replace(/\/$/, '');
}

/**
 * Get the site base URL.
 *
 * @returns The site base URL
 */
export function getSiteUrl(): string {
    const url = _env.PUBLIC_SITE_URL ?? _env.HOSPEDA_SITE_URL;
    if (!url) {
        throw new Error('[web] Neither PUBLIC_SITE_URL nor HOSPEDA_SITE_URL is configured');
    }
    return url;
}

/**
 * Get the deploy version (git hash or release tag).
 *
 * @returns The deploy version string, or undefined if not set
 */
export function getDeployVersion(): string | undefined {
    return _env.PUBLIC_VERSION;
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
    return _env.HOSPEDA_REVALIDATION_SECRET;
}

/**
 * Check if client-side logging is explicitly enabled via the PUBLIC_ENABLE_LOGGING flag.
 *
 * Returns true when the environment variable is set to `'true'` OR when running in
 * development mode (so developers always see logs locally without setting the flag).
 *
 * @returns True if logging should be active in the browser
 */
export function isLoggingEnabled(): boolean {
    return import.meta.env.DEV === true || import.meta.env.PUBLIC_ENABLE_LOGGING === 'true';
}
