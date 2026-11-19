/** @module middlewares/partner-cache-invalidation */
import type { MiddlewareHandler } from 'hono';
import type { AppBindings } from '../types';
import { createPublicCacheInvalidationMiddleware } from './public-cache-invalidation';

/**
 * Public cached surfaces that embed partner data (HOS-2368).
 *
 * `/public/partners` holds the detail (by slug), the lists and the carousel
 * reads. Its payload embeds the partner type (`type.name`), so partner-type
 * writes evict it too.
 */
export const PARTNER_CACHE_INVALIDATION_PREFIXES = ['/api/v1/public/partners'] as const;

/**
 * Write-route mount points that can change a public partner payload: the admin
 * partner CRUD, the partner-type catalog, and the partner self-service routes.
 * Every router mounted under these is covered, including ones added later.
 */
export const PARTNER_WRITE_MOUNT_PATHS = [
    '/api/v1/admin/partners',
    '/api/v1/admin/partner-types',
    '/api/v1/protected/partners'
] as const;

/** Creates middleware that evicts partner-dependent public responses after successful writes. */
export function partnerCacheInvalidationMiddleware(): MiddlewareHandler<AppBindings> {
    return createPublicCacheInvalidationMiddleware({
        pathPrefixes: PARTNER_CACHE_INVALIDATION_PREFIXES
    });
}

/**
 * Mounts the invalidation middleware over every partner write mount path.
 * Must be called BEFORE the partner routers are registered.
 *
 * @param params.app - App (or router) exposing Hono's `use`.
 */
export function mountPartnerCacheInvalidation({
    app
}: {
    readonly app: { use: (path: string, handler: MiddlewareHandler<AppBindings>) => unknown };
}): void {
    const middleware = partnerCacheInvalidationMiddleware();
    for (const mountPath of PARTNER_WRITE_MOUNT_PATHS) {
        app.use(`${mountPath}/*`, middleware);
    }
}
