/** @module middlewares/public-cache-invalidation */
import type { MiddlewareHandler } from 'hono';
import type { AppBindings } from '../types';
import { invalidateCacheByPathPrefix } from './cache';

/**
 * Creates middleware that evicts public cached responses after a successful write.
 *
 * Runs after the handler: GET requests and non-2xx responses leave the cache
 * untouched, so a failed write never throws away a still-valid entry. The cache
 * is per-process, so eviction only reaches the process that served the write.
 *
 * @param params.pathPrefixes - Public API path prefixes (no query string) to evict.
 */
export function createPublicCacheInvalidationMiddleware({
    pathPrefixes
}: {
    readonly pathPrefixes: readonly string[];
}): MiddlewareHandler<AppBindings> {
    return async (c, next) => {
        await next();
        if (c.req.method === 'GET' || c.res.status < 200 || c.res.status >= 300) return;

        for (const pathPrefix of pathPrefixes) {
            invalidateCacheByPathPrefix({ pathPrefix });
        }
    };
}
