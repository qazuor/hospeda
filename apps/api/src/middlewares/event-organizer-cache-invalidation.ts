/** @module middlewares/event-organizer-cache-invalidation */
import type { MiddlewareHandler } from 'hono';
import type { AppBindings } from '../types';
import { invalidateCacheByPathPrefix } from './cache';

/** Public cached surfaces that embed event-organizer data. */
export const EVENT_ORGANIZER_CACHE_INVALIDATION_PREFIXES = [
    '/api/v1/public/event-organizers',
    '/api/v1/public/events'
] as const;

/** Creates middleware that evicts organizer-dependent public responses after successful writes. */
export function eventOrganizerCacheInvalidationMiddleware(): MiddlewareHandler<AppBindings> {
    return async (c, next) => {
        await next();
        if (c.req.method === 'GET' || c.res.status < 200 || c.res.status >= 300) return;

        for (const pathPrefix of EVENT_ORGANIZER_CACHE_INVALIDATION_PREFIXES) {
            invalidateCacheByPathPrefix({ pathPrefix });
        }
    };
}
