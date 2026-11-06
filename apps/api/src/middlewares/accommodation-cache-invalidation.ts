/** @module middlewares/accommodation-cache-invalidation */
import type { MiddlewareHandler } from 'hono';
import type { AppBindings } from '../types';
import { createPublicCacheInvalidationMiddleware } from './public-cache-invalidation';

/**
 * Public cached surfaces that embed accommodation data (HOS-2063).
 *
 * `/public/accommodations` holds the detail (by slug and id), lists, similar and
 * external-reputation reads. `/public/destinations` is included because
 * `GET /public/destinations/:id/accommodations` returns accommodation rows.
 */
export const ACCOMMODATION_CACHE_INVALIDATION_PREFIXES = [
    '/api/v1/public/accommodations',
    '/api/v1/public/destinations'
] as const;

/**
 * Write-route mount points that mutate accommodation data. Every router mounted
 * under these (accommodation CRUD, media, FAQs, occupancy, calendar, reviews,
 * external reputation) is covered, including ones added later.
 */
export const ACCOMMODATION_WRITE_MOUNT_PATHS = [
    '/api/v1/protected/accommodations',
    '/api/v1/admin/accommodations'
] as const;

/** Creates middleware that evicts accommodation-dependent public responses after successful writes. */
export function accommodationCacheInvalidationMiddleware(): MiddlewareHandler<AppBindings> {
    return createPublicCacheInvalidationMiddleware({
        pathPrefixes: ACCOMMODATION_CACHE_INVALIDATION_PREFIXES
    });
}

/**
 * Mounts the invalidation middleware over every accommodation write mount path.
 * Must be called BEFORE the accommodation routers are registered.
 *
 * @param params.app - App (or router) exposing Hono's `use`.
 */
export function mountAccommodationCacheInvalidation({
    app
}: {
    readonly app: { use: (path: string, handler: MiddlewareHandler<AppBindings>) => unknown };
}): void {
    const middleware = accommodationCacheInvalidationMiddleware();
    for (const mountPath of ACCOMMODATION_WRITE_MOUNT_PATHS) {
        app.use(`${mountPath}/*`, middleware);
    }
}
