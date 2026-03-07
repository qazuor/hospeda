/**
 * Type-safe environment variable access.
 * Resolves HOSPEDA_ vs PUBLIC_ naming with proper fallbacks.
 */

/**
 * Get the API base URL.
 *
 * @returns The API base URL
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
 * @returns The site base URL
 */
export function getSiteUrl(): string {
    const url =
        import.meta.env.PUBLIC_SITE_URL ||
        import.meta.env.HOSPEDA_SITE_URL ||
        'http://localhost:4321';
    return url;
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
