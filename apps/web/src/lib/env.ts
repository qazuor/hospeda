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
    const url = _env.PUBLIC_API_URL ?? _env.HOSPEDA_API_URL ?? 'http://localhost:3001';
    return url.replace(/\/$/, '');
}

/**
 * Get the site base URL.
 *
 * @returns The site base URL
 */
export function getSiteUrl(): string {
    return _env.PUBLIC_SITE_URL ?? _env.HOSPEDA_SITE_URL ?? 'http://localhost:4321';
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
