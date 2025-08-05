/**
 * Cache middleware using Hono's built-in cache
 * Uses the Web Standards' Cache API
 */
import { cache } from 'hono/cache';
import { getCacheConfig } from '../utils/env';

/**
 * Creates cache middleware with environment-based configuration
 * @returns Configured cache middleware
 */
export const createCacheMiddleware = () => {
    const cacheConfig = getCacheConfig();

    // Skip cache if disabled
    if (!cacheConfig.enabled) {
        return async (
            // biome-ignore lint/suspicious/noExplicitAny: Hono context type
            _c: any,
            // biome-ignore lint/suspicious/noExplicitAny: Hono next function type
            next: any
        ) => {
            await next();
        };
    }

    return cache({
        cacheName: 'hospeda-api',
        cacheControl: `public, max-age=${cacheConfig.maxAge}, stale-while-revalidate=${cacheConfig.staleWhileRevalidate}, stale-if-error=${cacheConfig.staleIfError}`,
        vary: ['Accept-Encoding', 'Accept-Language'],
        keyGenerator: (c) => {
            const path = c.req.path;

            // Check if path matches any configured endpoints
            const isPublic = cacheConfig.publicEndpoints.some((endpoint) =>
                path.startsWith(endpoint)
            );
            const isPrivate = cacheConfig.privateEndpoints.some((endpoint) =>
                path.startsWith(endpoint)
            );
            const isNoCache = cacheConfig.noCacheEndpoints.some((endpoint) =>
                path.startsWith(endpoint)
            );

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
