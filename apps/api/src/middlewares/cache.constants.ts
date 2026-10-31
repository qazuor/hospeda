/**
 * Cache and compression endpoint classification constants.
 *
 * These path prefixes are part of the API surface contract — they are code,
 * not configuration. Operators do not (and should not) tune them via env vars.
 * Changing the cacheability of an endpoint is an architectural decision that
 * goes through code review, not deploy-time configuration.
 */

/**
 * Path prefixes served from the API's in-process response cache under a key with
 * no actor in it. Used for read-only endpoints with no per-user data.
 * (Being listed does not make a response CDN-cacheable: the cache middleware
 * emits no `Cache-Control`; the one route that sets `public` does so itself.)
 */
export const PUBLIC_CACHE_ENDPOINTS = [
    '/api/v1/public/authors',
    '/api/v1/public/accommodations',
    '/api/v1/public/destinations',
    '/api/v1/public/events',
    '/api/v1/public/posts',
    '/api/v1/public/amenities',
    '/api/v1/public/features',
    '/api/v1/public/attractions',
    // HOS-294 T-008. Both partner reads are actor-blind: the list forces
    // ACTIVE/active at the model, and the detail route's payload is the row
    // itself with no branch on who is asking. Neither was classified at all
    // before this, so the home carousel and the ficha were the one public
    // surface with no cache policy.
    '/api/v1/public/partners',
    '/api/v1/public/event-locations',
    '/api/v1/public/event-organizers',
    '/api/v1/public/exchange-rates',
    '/api/v1/public/posts/tags',
    '/api/v1/public/stats',
    '/api/v1/public/testimonials',
    '/health'
] as const;

/**
 * Path prefixes cached in-process for ANONYMOUS callers only, in a separate
 * `private:` keyspace. A request carrying credentials bypasses the cache
 * entirely (HOS-1923), so per-user answers are never stored here.
 */
export const PRIVATE_CACHE_ENDPOINTS = [
    '/api/v1/public/users',
    '/api/v1/public/conversations',
    '/api/v1/public/user-bookmarks'
] as const;

/**
 * Path prefixes that must always hit the origin (no-store).
 * Diagnostics, docs, webhooks, admin metrics, and Better Auth (cookie-bound).
 */
export const NO_CACHE_ENDPOINTS = [
    '/health/db',
    '/docs',
    '/api/v1/webhooks',
    '/api/v1/admin/metrics',
    '/api/auth'
] as const;

/**
 * Path prefixes that bypass response compression.
 * Useful for health checks where overhead matters more than bytes saved.
 */
export const COMPRESSION_EXCLUDE_ENDPOINTS = ['/health/db', '/docs'] as const;
