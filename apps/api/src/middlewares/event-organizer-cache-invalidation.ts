/** @module middlewares/event-organizer-cache-invalidation */
import type { MiddlewareHandler } from 'hono';
import type { AppBindings } from '../types';
import { createPublicCacheInvalidationMiddleware } from './public-cache-invalidation';

/** Public cached surfaces that embed event-organizer data. */
export const EVENT_ORGANIZER_CACHE_INVALIDATION_PREFIXES = [
    '/api/v1/public/event-organizers',
    '/api/v1/public/events'
] as const;

/** Creates middleware that evicts organizer-dependent public responses after successful writes. */
export function eventOrganizerCacheInvalidationMiddleware(): MiddlewareHandler<AppBindings> {
    return createPublicCacheInvalidationMiddleware({
        pathPrefixes: EVENT_ORGANIZER_CACHE_INVALIDATION_PREFIXES
    });
}
