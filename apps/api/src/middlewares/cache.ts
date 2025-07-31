/**
 * Cache middleware using Hono's built-in cache
 * Uses the Web Standards' Cache API
 */
import { cache } from 'hono/cache';
import { env } from '../utils/env';

/**
 * Creates cache middleware with environment-based configuration
 * @returns Configured cache middleware
 */
export const createCacheMiddleware = () => {
    // Skip cache if disabled
    if (!env.CACHE_ENABLED) {
        return async (
            // biome-ignore lint/suspicious/noExplicitAny: Hono context type
            _c: any,
            // biome-ignore lint/suspicious/noExplicitAny: Hono next function type
            next: any
        ) => {
            await next();
        };
    }

    // Parse endpoint lists from environment
    const publicEndpoints = env.CACHE_PUBLIC_ENDPOINTS.split(',').map((p) => p.trim());
    const privateEndpoints = env.CACHE_PRIVATE_ENDPOINTS.split(',').map((p) => p.trim());
    const noCacheEndpoints = env.CACHE_NO_CACHE_ENDPOINTS.split(',').map((p) => p.trim());

    return cache({
        cacheName: 'hospeda-api',
        cacheControl: `public, max-age=${env.CACHE_DEFAULT_MAX_AGE}, stale-while-revalidate=${env.CACHE_DEFAULT_STALE_WHILE_REVALIDATE}, stale-if-error=${env.CACHE_DEFAULT_STALE_IF_ERROR}`,
        vary: ['Accept-Encoding', 'Accept-Language'],
        keyGenerator: (c) => {
            const path = c.req.path;

            // Check if path matches any configured endpoints
            const isPublic = publicEndpoints.some((endpoint) => path.startsWith(endpoint));
            const isPrivate = privateEndpoints.some((endpoint) => path.startsWith(endpoint));
            const isNoCache = noCacheEndpoints.some((endpoint) => path.startsWith(endpoint));

            if (isNoCache) {
                // Return unique key to prevent caching
                return `${path}-${Date.now()}`;
            }

            if (isPublic) {
                return `public-${path}`;
            }

            if (isPrivate) {
                return `private-${path}-${c.req.header('Authorization') || 'anonymous'}`;
            }

            // Default: no cache for unspecified endpoints
            return `${path}-${Date.now()}`;
        },
        cacheableStatusCodes: [200, 404]
    });
};

/**
 * Default cache middleware instance
 * Uses environment-based configuration
 */
export const cacheMiddleware = createCacheMiddleware();
