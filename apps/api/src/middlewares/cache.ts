/**
 * Cache middleware using Hono's built-in cache
 * Uses the Web Standards' Cache API (requires runtime support)
 */
import { cache } from 'hono/cache';
import { getCacheConfig } from '../utils/env';
import { apiLogger } from '../utils/logger';

/**
 * Creates cache middleware with environment-based configuration
 * @returns Configured cache middleware
 */
export const createCacheMiddleware = () => {
    const cacheConfig = getCacheConfig();

    // Case 1: CACHE_ENABLED=false -> never enable
    if (!cacheConfig.enabled) {
        apiLogger.info('Cache middleware disabled via configuration (CACHE_ENABLED=false)');
        return async (
            // biome-ignore lint/suspicious/noExplicitAny: Hono context type
            _c: any,
            // biome-ignore lint/suspicious/noExplicitAny: Hono next function type
            next: any
        ) => {
            await next();
        };
    }

    // Case 2: CACHE_ENABLED=true -> check runtime support
    const hasCacheApiSupport = typeof globalThis.caches !== 'undefined';

    if (!hasCacheApiSupport) {
        // Case 3: CACHE_ENABLED=true but runtime doesn't support it
        apiLogger.warn(
            'Cache middleware disabled: Web Standards Cache API not available in this runtime (Node.js). Cache would be enabled in compatible runtimes like Cloudflare Workers, Deno, or browsers.'
        );
        return async (
            // biome-ignore lint/suspicious/noExplicitAny: Hono context type
            _c: any,
            // biome-ignore lint/suspicious/noExplicitAny: Hono next function type
            next: any
        ) => {
            await next();
        };
    }

    // Case 2: CACHE_ENABLED=true and runtime supports it -> enable cache
    apiLogger.info('Cache middleware enabled: Web Standards Cache API detected and available');

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
