/**
 * Type-safe environment variable access for web2.
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
        throw new Error('[web2] Neither PUBLIC_API_URL nor HOSPEDA_API_URL is configured');
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
        throw new Error('[web2] Neither PUBLIC_SITE_URL nor HOSPEDA_SITE_URL is configured');
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
 * Returns true when running in development mode (so developers always see logs locally).
 *
 * @returns True if logging should be active in the browser
 */
export function isLoggingEnabled(): boolean {
    return import.meta.env.DEV === true;
}
