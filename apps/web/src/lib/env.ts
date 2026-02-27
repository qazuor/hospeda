/**
 * Type-safe environment variable access.
 * Resolves HOSPEDA_ vs PUBLIC_ naming with proper fallbacks.
 *
 * This module provides helper functions to access environment variables
 * in a type-safe manner. The astro.config.mjs maps HOSPEDA_* variables
 * to PUBLIC_* variables via Vite define, making them accessible via
 * import.meta.env on both server and client sides.
 */

/**
 * Get the API base URL.
 *
 * Priority order:
 * 1. PUBLIC_API_URL (from Vite define or platform env)
 * 2. HOSPEDA_API_URL (from monorepo .env.local)
 * 3. Default: http://localhost:3001
 *
 * @returns The API base URL
 *
 * @example
 * ```ts
 * const apiUrl = getApiUrl();
 * const response = await fetch(`${apiUrl}/api/destinations`);
 * ```
 */
export function getApiUrl(): string {
    const url =
        import.meta.env.PUBLIC_API_URL ||
        import.meta.env.HOSPEDA_API_URL ||
        'http://localhost:3001';
    return url.replace(/\/$/, '');
}

/**
 * Get the site base URL.
 *
 * Priority order:
 * 1. PUBLIC_SITE_URL (from Vite define or platform env)
 * 2. HOSPEDA_SITE_URL (from monorepo .env.local)
 * 3. Default: http://localhost:4322
 *
 * @returns The site base URL
 *
 * @example
 * ```ts
 * const siteUrl = getSiteUrl();
 * const canonicalUrl = `${siteUrl}${Astro.url.pathname}`;
 * ```
 */
export function getSiteUrl(): string {
    const url =
        import.meta.env.PUBLIC_SITE_URL ||
        import.meta.env.HOSPEDA_SITE_URL ||
        'http://localhost:4322';
    return url;
}

/**
 * Check if running in production.
 *
 * @returns True if in production mode
 *
 * @example
 * ```ts
 * if (isProduction()) {
 *   // Enable production-only features
 * }
 * ```
 */
export function isProduction(): boolean {
    return import.meta.env.PROD === true;
}

/**
 * Check if running in development.
 *
 * @returns True if in development mode
 *
 * @example
 * ```ts
 * if (isDevelopment()) {
 *   // Enable dev-only debugging
 * }
 * ```
 */
export function isDevelopment(): boolean {
    return import.meta.env.DEV === true;
}
